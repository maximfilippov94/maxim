import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../../store';
import { api, SpDashboard, SpAttention } from '../../api';
import { S, R, FONT } from '../../theme';
import { Card, Label, Muted, Bar } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Empty } from '../../ui/system';
import { Face } from '../../ui/Face';
import { plural } from '../../format';
import { haptic } from '../../haptics';

export default function SpHome() {
  const { p, me } = useApp();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<SpDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setD(await api<SpDashboard>('/specialist/dashboard')); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!d && !err) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  /* План на сегодня: не сводка цифр, а список того, что стоит сделать.
     Пустой список — это тоже ответ: сегодня всё в порядке. */
  const plan: [string, string, string, () => void][] = [];
  if (d?.unread_messages) {
    plan.push(['chat', `${d.unread_messages} ${plural(d.unread_messages, ['новое сообщение', 'новых сообщения', 'новых сообщений'])}`,
      'ответить клиентам', () => router.push('/sp/chats')]);
  }
  if (d?.no_menu) {
    plan.push(['cal', `${d.no_menu} ${plural(d.no_menu, ['клиенту', 'клиентам', 'клиентам'])} нужно меню`,
      'без опубликованного меню', () => router.push('/sp/clients')]);
  }
  if (d?.menus_ending) {
    plan.push(['cal', `${d.menus_ending} ${plural(d.menus_ending, ['меню заканчивается', 'меню заканчиваются', 'меню заканчиваются'])}`,
      'продлить на следующую неделю', () => router.push('/sp/clients')]);
  }
  if (d?.attention?.length) {
    plan.push(['flame', `${d.attention.length} ${plural(d.attention.length, ['клиент требует', 'клиента требуют', 'клиентов требуют'])} внимания`,
      'пропали из приложения', () => {}]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + S.lg, paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + 150,
      }}
      refreshControl={
        <RefreshControl refreshing={busy} tintColor={p.text3}
          onRefresh={async () => { setBusy(true); await load(); setBusy(false); }} />
      }
      showsVerticalScrollIndicator={false}>

      <Label>{me?.user?.name ?? 'Кабинет'}</Label>
      <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs, marginBottom: S.lg }}>Главная</Text>

      {err ? (
        <Card style={{ marginBottom: S.md }}>
          <Text style={{ ...FONT.body, color: p.premium }}>{err}</Text>
        </Card>
      ) : null}

      <Animated.View entering={FadeInDown.duration(240)}>
        <Card style={{ marginBottom: S.md }}>
          <Label>План на сегодня</Label>
          {plan.length === 0 ? (
            <Muted style={{ marginTop: S.md, lineHeight: 18 }}>
              Ничего срочного: сообщения прочитаны, меню на местах.
            </Muted>
          ) : plan.map(([icon, title, note, go], i) => (
            <Pressable key={title} onPress={() => { haptic.tap(); go(); }}>
              {({ pressed }) => (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: S.md,
                  paddingVertical: 11,
                  borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
                  opacity: pressed ? 0.6 : 1,
                }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 16, backgroundColor: p.primarySoft,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={icon} size={16} color={p.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...FONT.h3, color: p.text }}>{title}</Text>
                    <Muted style={{ marginTop: 1 }}>{note}</Muted>
                  </View>
                  <Icon name="chevr" size={13} color={p.text3} width={2} />
                </View>
              )}
            </Pressable>
          ))}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(50).duration(240)}
        style={{ flexDirection: 'row', gap: S.md, marginBottom: S.md }}>
        <Card style={{ flex: 1 }}>
          <Label>Клиентов</Label>
          <Text style={{ fontSize: 26, fontWeight: '700', color: p.text, marginTop: 3 }}>
            {d?.clients ?? 0}
          </Text>
          <Muted>{d?.active_week ?? 0} активны за неделю</Muted>
        </Card>
        <Card style={{ flex: 1 }}>
          <Label>Приверженность</Label>
          <Text style={{ fontSize: 26, fontWeight: '700', color: p.text, marginTop: 3 }}>
            {d?.avg_adherence ?? 0}%
          </Text>
          <View style={{ marginTop: 8 }}>
            <Bar value={(d?.avg_adherence ?? 0) / 100} />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(90).duration(240)}
        style={{ flexDirection: 'row', gap: S.md, marginBottom: S.md }}>
        <Card style={{ flex: 1 }}>
          <Label>Отмечено за неделю</Label>
          <Text style={{ fontSize: 22, fontWeight: '700', color: p.text, marginTop: 3 }}>
            {d?.meals_week ?? 0}
          </Text>
          <Muted>сегодня {d?.meals_today ?? 0}</Muted>
        </Card>
        <Card style={{ flex: 1 }}>
          <Label>Средний вес</Label>
          <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 3,
            color: (d?.avg_weight_delta ?? 0) < 0 ? p.mp : p.text }}>
            {d?.avg_weight_delta == null ? '—'
              : `${d.avg_weight_delta > 0 ? '+' : '−'}${Math.abs(d.avg_weight_delta)}`}
          </Text>
          <Muted>кг за период</Muted>
        </Card>
      </Animated.View>

      <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>
        Требуют внимания
      </Text>
      {!d?.attention?.length ? (
        <Empty icon="checkmark.seal" height={180}
          title="Все на связи"
          note="Никто не пропал из приложения и не забросил отметки." />
      ) : d.attention.map((c, i) => (
        <Animated.View key={c.id} entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(220)}>
          <AttentionRow c={c} />
        </Animated.View>
      ))}
    </ScrollView>
  );
}

function AttentionRow({ c }: { c: SpAttention }) {
  const { p } = useApp();
  return (
    <Pressable onPress={() => { haptic.tap(); router.push(`/sp-client/${c.id}`); }}>
      {({ pressed }) => (
        <Card style={{ marginBottom: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.md,
          opacity: pressed ? 0.7 : 1 }}>
          <Face url={c.avatar_url} name={c.name} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={1}>{c.name}</Text>
            <Muted style={{ marginTop: 2 }} >{c.reasons[0] ?? 'нужен взгляд'}</Muted>
          </View>
          {c.unread ? (
            <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
              backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: p.onPrimary }}>{c.unread}</Text>
            </View>
          ) : <Icon name="chevr" size={13} color={p.text3} width={2} />}
        </Card>
      )}
    </Pressable>
  );
}
