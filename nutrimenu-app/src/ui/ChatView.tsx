/**
 * Переписка. Одна и та же лента у клиента и у специалиста: адреса
 * эндпоинтов и подпись в шапке разные, а всё остальное — пузыри,
 * вложения, строка ввода — общее. Держать две копии одного экрана
 * значит чинить каждую правку дважды.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Keyboard, ActivityIndicator, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown, useAnimatedKeyboard, useAnimatedStyle,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { api, ChatMessage } from '../api';
import { S, R, FONT } from '../theme';
import { Glass } from './Glass';
import { Face } from './Face';
import { Empty } from './system';
import { ChatBar, AttachSource } from './ChatBar';
import { Attachment } from './Attachment';
import { setAudioModeAsync } from 'expo-audio';
import { pickMedia, shootPhoto } from '../photo';
import { uploadFile } from '../upload';
import { haptic } from '../haptics';
import { mdLite } from './mdLite';
import { Icon } from './Icon';

const hhmm = (s: string) => String(s).slice(11, 16);

const dayLabel = (s: string) => {
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((+now - +d) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

export interface ChatViewProps {
  /** Адрес ленты: GET за сообщениями, POST — отправка */
  endpoint: string;
  /** Куда уходит файл перед отправкой ссылкой */
  attachEndpoint: string;
  /** Поля, которые нужно добавить к каждому POST (например client_id) */
  extra?: Record<string, unknown>;
  /** Чья сторона «моя»: у клиента это client, у специалиста specialist */
  mineType: 'client' | 'specialist';
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  /** Строка возврата вместо плавающей шапки — на экранах со стеком */
  back?: React.ReactNode;
  /** Отступ снизу под панель вкладок */
  bottomInset?: number;
  emptyNote?: string;
  /** Куда сообщать, что человек набирает текст. Без адреса не сообщаем. */
  typingEndpoint?: string;
  /* --- Режим EQUA AI ---------------------------------------------------
     Лента та же: сообщения идут через те же маршруты, собеседник —
     AI-специалист. Отличается поведение вокруг ответа: он приходит не от
     человека, а от модели, и его ждут здесь и сейчас. */
  /** Подпись в пузыре ожидания, например «EQUA AI печатает…». */
  typingLabel?: string;
  /** Разобрать ответ собеседника как лёгкую разметку модели. */
  markdown?: boolean;
  /** Оценка ответа: 1 — понравился, 0 — нет. Без неё сердца не рисуются. */
  onReact?: (messageId: number, rating: 1 | 0) => void;
}

export function ChatView({
  endpoint, attachEndpoint, extra, mineType,
  title, subtitle, avatarUrl, back, bottomInset = 96, emptyNote,
  typingEndpoint, typingLabel, markdown, onReact,
}: ChatViewProps) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const sv = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);

  /* Строка ввода едет вместе с клавиатурой и прилипает к её верхнему
     краю — как в мессенджерах. Отдельно висящая панель, из-под которой
     выезжает клавиатура, выглядит так, будто её забыли подвинуть. */
  const kb = useAnimatedKeyboard();
  const rest = insets.bottom + bottomInset;
  const pad = useAnimatedStyle(() => ({ height: Math.max(kb.height.value, rest) }));

  /* Клавиатура закрывает низ переписки — подматываем ленту к концу,
     иначе последнее сообщение оказывается под ней. */
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow',
      () => sv.current?.scrollToEnd({ animated: true }));
    return () => sub.remove();
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: ChatMessage[]; typing?: boolean }>(endpoint);
      setMsgs(r.messages ?? []); setPeerTyping(!!r.typing); setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  /* Догрузка новых сообщений.
   *
   * Собеседник пишет — строка должна появиться сама, а не по возвращению
   * на экран. Просим у сервера только то, что новее последнего
   * показанного: гонять всю переписку каждые несколько секунд незачем.
   * Свои, ещё не отправленные строки имеют отрицательный номер и в
   * расчёт не идут. */
  const pull = useCallback(async () => {
    const after = (msgs ?? []).reduce((m, x) => (x.id > m ? x.id : m), 0);
    try {
      const sep = endpoint.includes('?') ? '&' : '?';
      const r = await api<{ messages: ChatMessage[]; typing?: boolean }>(
        `${endpoint}${sep}after_id=${after}`);
      /* Сервер говорит, печатает ли собеседник прямо сейчас. Признак
         живёт несколько секунд и обновляется тем же опросом, что и
         сообщения, — отдельного запроса ради него не нужно. */
      setPeerTyping(!!r.typing);
      const fresh = (r.messages ?? []).filter(x => x.id > after);
      if (fresh.length) setMsgs(m => [...(m ?? []), ...fresh]);
    } catch { /* сеть моргнула — попробуем на следующем круге */ }
  }, [endpoint, msgs]);

  /* Опрашиваем, только пока экран открыт: ушли — таймер снят. */
  useFocusEffect(useCallback(() => {
    const t = setInterval(() => { pull(); }, 3000);
    return () => clearInterval(t);
  }, [pull]));

  /* Голосовые должны звучать и при включённом бесшумном режиме — как в
     мессенджерах: человек нажал «играть», он ждёт звук, а не тишину. */
  useEffect(() => {
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || busy) return;
    /* Своё сообщение показываем сразу — ждать ответа сервера, чтобы
       увидеть собственный текст, ощущается как заедание. */
    const local: ChatMessage = {
      id: -Date.now(), author_type: mineType, body,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    setMsgs(m => [...(m ?? []), local]);
    setDraft('');
    haptic.tap();
    setBusy(true);
    /* Ответ модели ждут здесь и сейчас, и ждать его можно долго. Даём
       возможность прервать: запрос обрывается, а написанное остаётся
       в ленте — человек сам решит, спрашивать ли заново. */
    const ctl = typingLabel ? new AbortController() : null;
    abortRef.current = ctl;
    try {
      /* Сервер возвращает созданную строку: подменяем ею свою временную,
         чтобы у сообщения появился настоящий номер и оно не пришло
         второй раз опросом. */
      const r = await api<{ message?: ChatMessage }>(endpoint, {
        method: 'POST', body: { ...extra, body }, signal: ctl?.signal,
      });
      if (r?.message) setMsgs(m => (m ?? []).map(x => (x.id === local.id ? r.message! : x)));
      else await load();
    } catch (e: any) {
      haptic.error();
      /* Прервали сами — это не ошибка: вопрос остаётся в ленте, ругаться
         на человека за собственное нажатие незачем. */
      if (!ctl?.signal.aborted) {
        setMsgs(m => (m ?? []).filter(x => x.id !== local.id));
        setDraft(body);
        setErr(e?.message ?? 'Сообщение не отправилось');
      }
    } finally { setBusy(false); abortRef.current = null; }
  }, [draft, busy, endpoint, extra, mineType, load, typingLabel]);

  /* Собеседнику видно, что ему пишут. Сообщаем не на каждую букву:
     сервер держит признак несколько секунд, поэтому хватает одного
     сигнала на начало набора и одного на его окончание. */
  const typingSent = useRef(false);
  const typingOff = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(() => {
    if (typingOff.current) { clearTimeout(typingOff.current); typingOff.current = null; }
    if (!typingEndpoint || !typingSent.current) return;
    typingSent.current = false;
    api(typingEndpoint, { method: 'POST', body: { ...extra, active: false }, dedupe: false })
      .catch(() => {});
  }, [typingEndpoint, extra]);

  const notifyTyping = useCallback((active: boolean) => {
    if (!typingEndpoint) return;
    if (!active) { stopTyping(); return; }
    if (typingOff.current) clearTimeout(typingOff.current);
    if (!typingSent.current) {
      typingSent.current = true;
      api(typingEndpoint, { method: 'POST', body: { ...extra, active: true }, dedupe: false })
        .catch(() => {});
    }
    /* Перестал печатать — через несколько секунд снимаем признак сами,
       иначе «печатает» будет висеть у собеседника до отправки. */
    typingOff.current = setTimeout(stopTyping, 4000);
  }, [typingEndpoint, extra, stopTyping]);

  /* Ушли с экрана с набранным текстом — признак снимаем, иначе он
     останется висеть у собеседника. */
  useEffect(() => stopTyping, [stopTyping]);

  /** Прервать ожидание ответа модели. */
  const stop = useCallback(() => {
    haptic.tap();
    abortRef.current?.abort();
  }, []);

  const upload = useCallback(async (file: { uri: string; name: string; type: string }) => {
    setBusy(true); setErr(null);
    try {
      const url = await uploadFile(attachEndpoint, file);
      await api(endpoint, { method: 'POST', body: { ...extra, attachment_url: url } });
      haptic.success();
      await load();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось отправить файл');
    } finally { setBusy(false); }
  }, [attachEndpoint, endpoint, extra, load]);

  const attach = useCallback(async (from: AttachSource) => {
    try {
      const f = from === 'camera' ? await shootPhoto() : await pickMedia();
      if (f) await upload(f);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось выбрать файл'); }
  }, [upload]);

  const voice = useCallback(async (uri: string) => {
    const ext = (uri.split('?')[0].split('.').pop() || 'm4a').toLowerCase();
    /* Диктофон отдаёт путь без схемы на части устройств, а системной
       выгрузке нужен полный file://. */
    const full = /^[a-z]+:/i.test(uri) ? uri : 'file://' + uri;
    await upload({
      uri: full, name: `voice.${ext}`,
      type: ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/mp4',
    });
  }, [upload]);

  const empty = msgs && msgs.length === 0;
  const topPad = back ? S.md : insets.top + 72;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>

      {back}

      {msgs === null && !err ? (
        <ActivityIndicator color={p.primary} style={{ marginTop: topPad + 20 }} />
      ) : empty ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Empty icon="bubble.left.and.bubble.right"
            title="Пока ни одного сообщения"
            note={emptyNote ?? 'Напишите первым — переписка появится здесь.'} />
        </View>
      ) : (
        <ScrollView
          ref={sv}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: S.lg, paddingTop: topPad, paddingBottom: S.lg,
          }}
          onContentSizeChange={() => sv.current?.scrollToEnd({ animated: false })}
          /* Потянул ленту вниз — клавиатура уезжает следом за пальцем */
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {(msgs ?? []).map((mm, i) => {
            const prev = (msgs ?? [])[i - 1];
            const newDay = !prev
              || String(prev.created_at).slice(0, 10) !== String(mm.created_at).slice(0, 10);
            return (
              <View key={mm.id}>
                {newDay ? (
                  <Text style={{
                    ...FONT.small, color: p.text3, textAlign: 'center',
                    marginTop: i ? S.lg : 0, marginBottom: S.md,
                  }}>{dayLabel(mm.created_at)}</Text>
                ) : null}
                <Bubble m={mm} mine={mm.author_type === mineType}
                  markdown={markdown} onReact={onReact} />
              </View>
            );
          })}
          {/* Пока модель думает — отдельный пузырь вместо пустоты. Рядом
              «Остановить»: ждать молча непонятно сколько. */}
          {(typingLabel && busy) || peerTyping ? (
            <Animated.View entering={FadeInDown.duration(180)}
              style={{ alignItems: 'flex-start', marginBottom: S.sm }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: S.sm,
                backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
                borderRadius: R.lg, borderBottomLeftRadius: 4,
                paddingHorizontal: 12, paddingVertical: 10,
              }}>
                <ActivityIndicator size="small" color={p.text3} />
                <Text style={{ ...FONT.callout, color: p.text3 }}>
                  {busy && typingLabel ? typingLabel : `${title} печатает`}
                </Text>
                {/* Прервать можно только собственное ожидание ответа
                    модели. Человека на том конце остановить нельзя. */}
                {busy && typingLabel ? <Pressable onPress={stop} hitSlop={10}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingLeft: S.sm })}>
                  <Text style={{ ...FONT.callout, color: p.accent, fontWeight: '700' }}>
                    Остановить
                  </Text>
                </Pressable> : null}
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>
      )}

      {/* Шапка поверх переписки, как в мессенджерах: имя всегда на виду,
          а сообщения проходят под стеклом, а не упираются в полосу. */}
      {back ? null : (
        <View style={{ position: 'absolute', top: insets.top + 6, left: S.lg, right: S.lg }}
          pointerEvents="box-none">
          <Glass radius={R.pill} style={{
            flexDirection: 'row', alignItems: 'center', gap: S.md,
            paddingHorizontal: 8, paddingVertical: 7,
          }}>
            <Face url={avatarUrl} name={title} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: p.text }} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={{ ...FONT.small, color: p.text3 }}>{subtitle}</Text>
              ) : null}
            </View>
          </Glass>
        </View>
      )}

      {err ? (
        <Text style={{ ...FONT.small, color: p.danger, paddingHorizontal: S.lg, paddingBottom: S.sm }}>
          {err}
        </Text>
      ) : null}

      <View style={{ paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: S.sm }}>
        <ChatBar
          value={draft}
          onChange={t => { setDraft(t); setErr(null); notifyTyping(t.length > 0); }}
          onSend={send}
          onAttach={attach}
          onVoice={voice}
          busy={busy}
          onError={setErr}
        />
      </View>
      {/* Пустое место под строкой: с закрытой клавиатурой — под панель
          вкладок, с открытой — ровно на её высоту. */}
      <Animated.View style={pad} />
    </View>
  );
}

function Bubble({ m, mine, markdown, onReact }: {
  m: ChatMessage; mine: boolean;
  markdown?: boolean;
  onReact?: (messageId: number, rating: 1 | 0) => void;
}) {
  const { p } = useApp();
  const [rated, setRated] = useState<1 | 0 | null>(null);
  const att = m.attachment_url;
  /* У картинок и видео своя рамка — пузырь вокруг них лишний. */
  const bare = !!att && !m.body;

  return (
    <Animated.View entering={FadeInDown.duration(200)}
      style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: S.sm }}>
      <View style={{
        maxWidth: '82%',
        backgroundColor: mine ? p.primary : p.surface,
        borderWidth: mine ? 0 : 1, borderColor: p.border,
        borderRadius: R.lg,
        borderBottomRightRadius: mine ? 4 : R.lg,
        borderBottomLeftRadius: mine ? R.lg : 4,
        paddingHorizontal: bare ? 4 : 12,
        paddingVertical: bare ? 4 : 8,
        gap: att && m.body ? S.sm : 0,
      }}>
        {att ? <Attachment url={att} mine={mine} /> : null}
        {m.body ? (
          /* Время дописано в конец последней строки, а не стоит под
             пузырём отдельной строкой: короткая реплика остаётся
             однострочной, а длинная не оставляет под собой дыру. Если
             время не влезает, оно переносится само. */
          <Text style={{ fontSize: 15, lineHeight: 20, color: mine ? p.onPrimary : p.text }}>
            {/* Ответ модели приходит markdown-ом. Разбираем его в жирный
                текст и маркеры — звёздочки посреди реплики выглядят как
                сбой, а не как разметка. */}
            {markdown && !mine
              ? mdLite(m.body).map((line, li, all) => (
                  <Text key={li}>
                    {line.map((sp, si) => (
                      <Text key={si} style={sp.bold ? { fontWeight: '700' } : undefined}>
                        {sp.text}
                      </Text>
                    ))}
                    {li < all.length - 1 ? '\n' : ''}
                  </Text>
                ))
              : m.body}
            {'   '}
            <Text style={{
              fontSize: 11, lineHeight: 20,
              color: mine ? p.onPrimary : p.text3, opacity: mine ? 0.7 : 1,
            }}>{hhmm(m.created_at)}</Text>
          </Text>
        ) : null}
        {/* У вложения без подписи время ложится поверх нижнего угла на
            затемнении — иначе под снимком висела бы пустая строка. */}
        {att && !m.body ? (
          <View style={{
            position: 'absolute', right: 10, bottom: 10,
            paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}>
            <Text style={{ fontSize: 11, color: '#fff' }}>{hhmm(m.created_at)}</Text>
          </View>
        ) : null}
      </View>
      {/* Оценка ответа. Не палец вверх и вниз, а сердце и перечёркнутое
          сердце — так в вебе: речь о том, попал ли совет, а не о том,
          прав ли собеседник. */}
      {onReact && !mine && m.id > 0 ? (
        <View style={{ flexDirection: 'row', gap: S.xs, marginTop: 2, marginLeft: 4 }}>
          {([1, 0] as const).map(r => (
            <Pressable key={r} hitSlop={8}
              onPress={() => { haptic.select(); setRated(r); onReact(m.id, r); }}
              style={({ pressed }) => ({
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}>
              <Icon
                name={r === 1 ? 'heart' : 'heart-off'}
                size={16}
                color={rated === r ? p.accent : p.text3}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}
