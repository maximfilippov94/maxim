import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { api, ChatResponse, ChatMessage, Specialist } from '../api';
import { S, R, FONT } from '../theme';
import { Glass } from '../ui/Glass';
import { Empty } from '../ui/system';
import { ChatBar, AttachSource } from '../ui/ChatBar';
import { Attachment } from '../ui/Attachment';
import { pickMedia, shootPhoto, fileForm } from '../photo';
import { haptic } from '../haptics';

/** «14:05» из «2026-09-04 14:05:27» — время локальное, как его записал сервер. */
const hhmm = (s: string) => String(s).slice(11, 16);

/** «4 сентября» — разделитель между днями переписки. */
const dayLabel = (s: string) => {
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((+now - +d) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

export default function Chat() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [spec, setSpec] = useState<Specialist | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const sv = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<ChatResponse>('/client/messages');
      setMsgs(r.messages ?? []);
      setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, []);

  useEffect(() => {
    load();
    api<{ specialist: Specialist | null }>('/client/my-specialist')
      .then(r => setSpec(r.specialist)).catch(() => {});
  }, [load]);

  /* Возвращаясь в чат, хочется видеть новое, а не то, что было при
     первом открытии: экран остаётся в памяти между вкладками. */
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const post = useCallback(async (body: object, optimistic?: ChatMessage) => {
    setBusy(true);
    if (optimistic) setMsgs(m => [...(m ?? []), optimistic]);
    try {
      await api('/client/messages', { method: 'POST', body });
      await load();
    } catch (e: any) {
      haptic.error();
      if (optimistic) setMsgs(m => (m ?? []).filter(x => x.id !== optimistic.id));
      setErr(e?.message ?? 'Сообщение не отправилось');
      throw e;
    } finally { setBusy(false); }
  }, [load]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || busy) return;
    /* Своё сообщение показываем сразу — ждать ответа сервера, чтобы
       увидеть собственный текст, ощущается как заедание. */
    const local: ChatMessage = {
      id: -Date.now(), author_type: 'client', body,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    setDraft('');
    haptic.tap();
    try { await post({ body }, local); }
    catch { setDraft(body); }
  }, [draft, busy, post]);

  /** Файл сначала уходит на сервер, потом ссылка — сообщением. */
  const upload = useCallback(async (file: { uri: string; name: string; type: string }) => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ url: string }>('/client/attachment', {
        method: 'POST', body: fileForm(file),
      });
      await api('/client/messages', { method: 'POST', body: { attachment_url: r.url } });
      haptic.success();
      await load();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось отправить файл');
    } finally { setBusy(false); }
  }, [load]);

  const attach = useCallback(async (from: AttachSource) => {
    try {
      const f = from === 'camera' ? await shootPhoto() : await pickMedia();
      if (f) await upload(f);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось выбрать файл'); }
  }, [upload]);

  const voice = useCallback(async (uri: string) => {
    const ext = (uri.split('?')[0].split('.').pop() || 'm4a').toLowerCase();
    await upload({
      uri,
      name: `voice.${ext}`,
      type: ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/mp4',
    });
  }, [upload]);

  const empty = msgs && msgs.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {msgs === null && !err ? (
        <ActivityIndicator color={p.primary} style={{ marginTop: insets.top + 80 }} />
      ) : empty ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Empty icon="bubble.left.and.bubble.right"
            title="Пока ни одного сообщения"
            note="Напишите специалисту — он ответит здесь." />
        </View>
      ) : (
        <ScrollView
          ref={sv}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: S.lg,
            paddingTop: insets.top + 72,
            paddingBottom: S.lg,
          }}
          onContentSizeChange={() => sv.current?.scrollToEnd({ animated: false })}
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
                <Bubble m={mm} />
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Шапка поверх переписки, как в мессенджерах: имя всегда на виду,
          а сообщения проходят под стеклом, а не упираются в полосу. */}
      <View style={{
        position: 'absolute', top: insets.top + 6, left: S.lg, right: S.lg,
      }} pointerEvents="box-none">
        <Glass radius={R.pill} style={{
          flexDirection: 'row', alignItems: 'center', gap: S.md,
          paddingHorizontal: 8, paddingVertical: 7,
        }}>
          <Face url={spec?.avatar_url} name={spec?.name ?? 'Специалист'} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: p.text }} numberOfLines={1}>
              {spec?.name ?? 'Специалист'}
            </Text>
            <Text style={{ ...FONT.small, color: p.text3 }}>
              {spec ? 'ваш специалист' : 'специалист не назначен'}
            </Text>
          </View>
        </Glass>
      </View>

      {err ? (
        <Text style={{ ...FONT.small, color: p.danger, paddingHorizontal: S.lg, paddingBottom: S.sm }}>
          {err}
        </Text>
      ) : null}

      <View style={{
        paddingHorizontal: S.lg, paddingTop: S.sm,
        paddingBottom: insets.bottom + 96,
      }}>
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
    </KeyboardAvoidingView>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const { p } = useApp();
  const mine = m.author_type === 'client';
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

/** Фото специалиста, а если его нет — первая буква имени. */
function Face({ url, name }: { url?: string | null; name: string }) {
  const { p } = useApp();
  if (url) {
    return (
      <Image source={{ uri: url }}
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.inset }}
        contentFit="cover" transition={200} cachePolicy="memory-disk" />
    );
  }
  return (
    <View style={{
      width: 36, height: 36, borderRadius: 18, backgroundColor: p.primarySoft,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: p.primary }}>
        {(name || '·').trim()[0]?.toUpperCase() ?? '·'}
      </Text>
    </View>
  );
}
