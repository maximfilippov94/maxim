import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../../store';
import { api, SpClient } from '../../api';
import { S, R, FONT } from '../../theme';
import { Card, Label, Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Face } from '../../ui/Face';
import { Empty } from '../../ui/system';
import { kg, plural } from '../../format';
import { haptic } from '../../haptics';

type Filter = 'all' | 'attention' | 'unread' | 'nomenu';
const FILTERS: [Filter, string][] = [
  ['all', 'Все'],
  ['attention', 'Требуют внимания'],
  ['unread', 'С сообщениями'],
  ['nomenu', 'Без меню'],
];

/** «сегодня» / «3 дня назад» — когда клиент был в приложении. */
const ago = (s?: string | null) => {
  if (!s) return 'не заходил';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(+d)) return String(s).slice(0, 10);
  const days = Math.floor((Date.now() - +d) / 86400000);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} ${plural(days, ['день', 'дня', 'дней'])} назад`;
};

export default function SpClients() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<SpClient[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');

  const load = useCallback(async () => {
    try { setList((await api<{ clients: SpClient[] }>('/specialist/clients')).clients ?? []); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    let a = list ?? [];
    if (f === 'unread') a = a.filter(c => (c.unread ?? 0) > 0);
    if (f === 'nomenu') a = a.filter(c => c.menu_status !== 'published');
    /* «Требуют внимания» считаем так же, как сводка на главной:
       неделя без отметок или вовсе ни одного захода. */
    if (f === 'attention') a = a.filter(c => !c.last_activity || (c.logged7 ?? 0) === 0);
    const s = q.trim().toLowerCase();
    if (s) a = a.filter(c => c.name.toLowerCase().includes(s)
      || (c.email ?? '').toLowerCase().includes(s));
    return a;
  }, [list, f, q]);

  if (!list && !err) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + S.lg, paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + 100,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>

      <Label>{list?.length ?? 0} {plural(list?.length ?? 0, ['клиент', 'клиента', 'клиентов'])}</Label>
      <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs, marginBottom: S.lg }}>Клиенты</Text>

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: S.sm,
        backgroundColor: p.surface, borderRadius: R.md, paddingHorizontal: S.lg,
        borderWidth: 1, borderColor: p.borderSoft, marginBottom: S.md,
      }}>
        <Icon name="user" size={17} color={p.text3} />
        <TextInput
          value={q} onChangeText={setQ}
          placeholder="Имя или почта" placeholderTextColor={p.text3}
          style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: p.text }}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={10}>
            <Icon name="close" size={15} color={p.text3} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: S.sm, paddingBottom: S.md }}>
        {FILTERS.map(([k, l]) => {
          const on = k === f;
          return (
            <Pressable key={k} onPress={() => { haptic.select(); setF(k); }}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill,
                backgroundColor: on ? p.primary : p.surface,
                borderWidth: on ? 0 : 1, borderColor: p.borderSoft,
                opacity: pressed && !on ? 0.7 : 1,
              })}>
              <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
                color: on ? p.onPrimary : p.text2 }}>{l}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {err ? (
        <Text style={{ ...FONT.small, color: p.danger, marginBottom: S.md }}>{err}</Text>
      ) : null}

      {shown.length === 0 ? (
        <Empty icon="person.2" title={q ? 'Никого не нашли' : 'Здесь пусто'}
          note={q ? 'Попробуйте другое имя.' : 'Пригласите клиента кодом из раздела «Ещё».'} />
      ) : shown.map((c, i) => (
        <Animated.View key={c.id} entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(220)}>
          <Row c={c} />
        </Animated.View>
      ))}
    </ScrollView>
  );
}

function Row({ c }: { c: SpClient }) {
  const { p } = useApp();
  const done = c.logged7 ? Math.round((c.eaten7 ?? 0) / c.logged7 * 100) : null;
  return (
    <Pressable onPress={() => { haptic.tap(); router.push(`/sp-client/${c.id}`); }}>
      {({ pressed }) => (
        <Card style={{ marginBottom: S.sm, opacity: pressed ? 0.7 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <Face url={c.avatar_url} name={c.name} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={1}>{c.name}</Text>
              <Muted style={{ marginTop: 2 }} numberOfLines={1}>
                {[c.goal, c.weight_kg ? `${kg(c.weight_kg)} кг` : null].filter(Boolean).join(' · ') || '—'}
              </Muted>
            </View>
            {c.unread ? (
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
                backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: p.onPrimary }}>{c.unread}</Text>
              </View>
            ) : null}
            <Icon name="chevr" size={13} color={p.text3} width={2} />
          </View>
          <View style={{ flexDirection: 'row', gap: S.lg, marginTop: S.md }}>
            <Tag label="Меню" value={c.menu_status === 'published' ? 'опубликовано' : 'нет'} />
            <Tag label="Отметки" value={done == null ? '—' : `${done}%`} />
            <Tag label="Заходил" value={ago(c.last_activity)} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  const { p } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...FONT.label, color: p.text3, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ ...FONT.small, color: p.text2, marginTop: 2 }} numberOfLines={1}>{value}</Text>
    </View>
  );
}
