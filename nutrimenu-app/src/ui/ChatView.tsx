/**
 * Переписка. Одна и та же лента у клиента и у специалиста: адреса
 * эндпоинтов и подпись в шапке разные, а всё остальное — пузыри,
 * вложения, строка ввода — общее. Держать две копии одного экрана
 * значит чинить каждую правку дважды.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Keyboard, ActivityIndicator,
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
}

export function ChatView({
  endpoint, attachEndpoint, extra, mineType,
  title, subtitle, avatarUrl, back, bottomInset = 96, emptyNote,
}: ChatViewProps) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const sv = useRef<ScrollView>(null);

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
      const r = await api<{ messages: ChatMessage[] }>(endpoint);
      setMsgs(r.messages ?? []); setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

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
    try {
      await api(endpoint, { method: 'POST', body: { ...extra, body } });
      await load();
    } catch (e: any) {
      haptic.error();
      setMsgs(m => (m ?? []).filter(x => x.id !== local.id));
      setDraft(body);
      setErr(e?.message ?? 'Сообщение не отправилось');
    } finally { setBusy(false); }
  }, [draft, busy, endpoint, extra, mineType, load]);

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
                <Bubble m={mm} mine={mm.author_type === mineType} />
              </View>
            );
          })}
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
          onChange={t => { setDraft(t); setErr(null); }}
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

function Bubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const { p } = useApp();
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
          <Text style={{ fontSize: 15, lineHeight: 20, color: mine ? p.onPrimary : p.text }}>
            {m.body}
          </Text>
        ) : null}
      </View>
      <Text style={{ ...FONT.small, color: p.text3, marginTop: 2, marginHorizontal: 4 }}>
        {hhmm(m.created_at)}
      </Text>
    </Animated.View>
  );
}
