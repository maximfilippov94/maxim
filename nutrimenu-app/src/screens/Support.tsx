/**
 * Поддержка.
 *
 * Вопросы о сервисе — вход не работает, кнопка не нажимается, счёт.
 * Про питание клиент пишет специалисту в чат, и смешивать эти два
 * разговора нельзя: переписку со специалистом владелец не читает.
 *
 * Экран один на клиента и специалиста: обращение у них устроено
 * одинаково, различается только, кто его пишет.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, Ticket, TicketMessage, TICKET_STATUS } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { SysButton } from '../ui/system';
import { haptic } from '../haptics';
import { Loading, Fail } from './Shopping';

type View_ = { kind: 'list' } | { kind: 'new' } | { kind: 'thread'; id: number };

export default function Support() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState<Ticket[] | null>(null);
  const [topics, setTopics] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<View_>({ kind: 'list' });

  const load = useCallback(async () => {
    try {
      const r = await api<{ tickets: Ticket[]; topics: Record<string, string> }>('/support');
      setList(r.tickets ?? []); setTopics(r.topics ?? {}); setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось открыть'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (err && !list) return <Fail title="Поддержка" text={err} />;
  if (!list) return <Loading title="Поддержка" />;

  if (view.kind === 'new')
    return <NewTicket topics={topics} onDone={() => { setView({ kind: 'list' }); load(); }}
                      onBack={() => setView({ kind: 'list' })} />;
  if (view.kind === 'thread')
    return <Thread id={view.id} topics={topics}
                   onBack={() => { setView({ kind: 'list' }); load(); }} />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Поддержка" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
      }} showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.duration(220)}>
          <Card style={{ marginTop: S.md }}>
            <Muted style={{ lineHeight: 20 }}>
              Здесь отвечают на вопросы о сервисе. Про питание, меню и вес
              пишите своему специалисту — у него ваша история.
            </Muted>
          </Card>
        </Animated.View>

        <View style={{ marginTop: S.md }}>
          <SysButton label="Новое обращение" variant="prominent"
            onPress={() => { haptic.tap(); setView({ kind: 'new' }); }} />
        </View>

        {list.length === 0 ? (
          <Card style={{ marginTop: S.md }}>
            <Muted style={{ lineHeight: 19 }}>Обращений пока не было.</Muted>
          </Card>
        ) : list.map((t, i) => (
          <Animated.View key={t.id}
            entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(200)}>
            <Pressable onPress={() => { haptic.tap(); setView({ kind: 'thread', id: t.id }); }}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
              <Card style={{ marginTop: S.md, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                  <Text style={{ ...FONT.h3, color: p.text, flex: 1 }} numberOfLines={1}>
                    {t.subject}
                  </Text>
                  {/* Точка «есть новое» — только у живого обращения:
                      у закрытого она зовёт туда, где всё уже решено. */}
                  {t.unread && t.status !== 'closed' ? (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.danger }} />
                  ) : null}
                </View>
                <Muted numberOfLines={1}>{t.last_body ?? ''}</Muted>
                <Text style={{
                  ...FONT.small, marginTop: 2,
                  color: t.status === 'closed' ? p.text3 : p.accent,
                }}>{TICKET_STATUS[t.status]}</Text>
              </Card>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

/* --- Новое обращение --- */
function NewTicket({ topics, onDone, onBack }: {
  topics: Record<string, string>; onDone: () => void; onBack: () => void;
}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const keys = Object.keys(topics);
  const [topic, setTopic] = useState(keys[0] ?? 'other');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = useCallback(async () => {
    setBusy(true);
    try {
      await api('/support', { method: 'POST', body: { topic, subject: subject.trim(), body: body.trim() } });
      haptic.success(); onDone();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не отправилось'); }
    finally { setBusy(false); }
  }, [topic, subject, body, onDone]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Новое обращение" onBack={onBack} back />
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
        }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Label>О чём вопрос</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.sm }}>
            {keys.map(k => {
              const on = topic === k;
              return (
                <Pressable key={k} onPress={() => { haptic.tap(); setTopic(k); }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill,
                    backgroundColor: on ? p.primary : p.inset,
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <Text style={{
                    ...FONT.small, fontWeight: '600',
                    color: on ? p.onPrimary : p.text2,
                  }}>{topics[k]}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: S.lg }}><Label>Тема</Label></View>
          <TextInput value={subject} onChangeText={setSubject} maxLength={120}
            placeholder="Коротко: что не так" placeholderTextColor={p.text3}
            style={{
              backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15, marginTop: S.sm,
            }} />

          <View style={{ marginTop: S.lg }}><Label>Опишите подробнее</Label></View>
          <TextInput value={body} onChangeText={setBody} multiline
            placeholder="Что вы делали, что ожидали и что получилось"
            placeholderTextColor={p.text3}
            style={{
              backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
              minHeight: 130, textAlignVertical: 'top', marginTop: S.sm, lineHeight: 21,
            }} />

          {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}

          <View style={{ marginTop: S.lg }}>
            <SysButton label="Отправить" variant="prominent"
              disabled={busy || !subject.trim() || body.trim().length < 5}
              onPress={send} />
          </View>
          <Muted style={{ marginTop: S.md, lineHeight: 19 }}>
            Ответ придёт уведомлением сюда и письмом на вашу почту.
          </Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* --- Переписка --- */
function Thread({ id, topics, onBack }: {
  id: number; topics: Record<string, string>; onBack: () => void;
}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ ticket: Ticket; messages: TicketMessage[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<{ ticket: Ticket; messages: TicketMessage[] }>(`/support/${id}`));
      setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось открыть'); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = useCallback(async () => {
    if (text.trim().length < 2) return;
    setBusy(true);
    try {
      await api(`/support/${id}/reply`, { method: 'POST', body: { body: text.trim() } });
      setText(''); haptic.success(); load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не отправилось'); }
    finally { setBusy(false); }
  }, [id, text, load]);

  const close = useCallback(async () => {
    try { await api(`/support/${id}/close`, { method: 'POST' }); haptic.success(); onBack(); }
    catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не получилось'); }
  }, [id, onBack]);

  if (err && !data) return <Fail title="Обращение" text={err} />;
  if (!data) return <Loading title="Обращение" />;
  const closed = data.ticket.status === 'closed';

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={topics[data.ticket.topic] ?? 'Обращение'} onBack={onBack} back />
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
        }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Text style={{ ...FONT.h2, color: p.text, marginTop: S.md }}>{data.ticket.subject}</Text>

          {data.messages.map(m => (
            <View key={m.id} style={{
              marginTop: S.md, maxWidth: '88%',
              alignSelf: m.from_admin ? 'flex-start' : 'flex-end',
              backgroundColor: m.from_admin ? p.surface : p.primarySoft,
              borderRadius: R.lg, paddingHorizontal: S.lg, paddingVertical: 11,
            }}>
              <Text style={{ ...FONT.small, fontWeight: '600', color: p.text2, marginBottom: 3 }}>
                {m.from_admin ? 'Поддержка' : 'Вы'}
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 21, color: p.text }}>{m.body}</Text>
              <Text style={{ ...FONT.small, color: p.text3, marginTop: 5 }}>
                {(m.created_at ?? '').slice(0, 16).replace('T', ' ')}
              </Text>
            </View>
          ))}

          {closed ? (
            <Muted style={{ marginTop: S.lg, lineHeight: 19 }}>
              Обращение закрыто. Напишите — и оно откроется снова.
            </Muted>
          ) : null}

          <View style={{ marginTop: S.lg }}><Label>Дописать</Label></View>
          <TextInput value={text} onChangeText={setText} multiline
            placeholder="Ваше сообщение" placeholderTextColor={p.text3}
            style={{
              backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
              minHeight: 90, textAlignVertical: 'top', marginTop: S.sm, lineHeight: 21,
            }} />
          {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.sm }}>{err}</Text> : null}

          <View style={{ marginTop: S.md, gap: S.sm }}>
            <SysButton label="Отправить" variant="prominent"
              disabled={busy || text.trim().length < 2} onPress={send} />
            {closed ? null : <SysButton label="Вопрос решён, закрыть" onPress={close} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
