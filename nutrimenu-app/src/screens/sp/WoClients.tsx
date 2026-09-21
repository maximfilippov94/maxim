/**
 * Подопечные тренера.
 *
 * Список у тренера отвечает на другой вопрос, чем у нутрициолога: не
 * «кто что ел», а «кто сегодня в зале и кто третью неделю не доходит».
 * Поэтому состояние дня стоит пилюлей под именем, а доля выполненного
 * за месяц — цифрой справа, где её видно, не читая строку.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api, WoClientRow, WO_CLIENT_STATE } from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Muted } from '../../ui/base';
import { Face } from '../../ui/Face';
import { Empty } from '../../ui/system';
import { plural } from '../../format';
import { haptic } from '../../haptics';

export default function WoClients() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<WoClientRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    api<{ clients: WoClientRow[] }>('/specialist/workout-clients')
      .then(r => setRows(r.clients ?? []))
      .catch(e => setErr(e?.message ?? 'Не открылось'));
  }, []));

  const tone = (st: string) =>
    st === 'done' ? p.accent
    : st === 'in_progress' ? p.mc
    : st === 'skipped' ? p.danger
    : st === 'planned' ? p.warn : p.text3;
  const soft = (st: string) =>
    st === 'done' ? p.primarySoft
    : st === 'skipped' ? p.danger + '1F'
    : st === 'planned' ? p.warn + '1F' : p.inset;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title="Подопечные" />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 140,
      }} showsVerticalScrollIndicator={false}>
        {err ? <Muted>{err}</Muted> : null}
        {!rows ? <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />
          : !rows.length ? (
            <Empty icon="person.2" title="Подопечных пока нет"
              note="Клиент появится здесь, как только подключит вашу услугу или придёт по вашему коду." />
          ) : rows.map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(i * 40).duration(260)}>
              <Pressable onPress={() => { haptic.tap();
                  router.push({ pathname: '/sp-client/[id]', params: { id: String(c.id) } }); }}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.99 : 1 }] })}>
                <Card style={{
                  flexDirection: 'row', alignItems: 'center', gap: S.md,
                  padding: S.md, marginBottom: S.sm,
                }}>
                  <Face url={c.avatar_url} name={c.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: p.text }}>{c.name}</Text>
                    <View style={{
                      alignSelf: 'flex-start', marginVertical: 3,
                      paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.pill,
                      backgroundColor: soft(c.today_status),
                    }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: tone(c.today_status) }}>
                        {WO_CLIENT_STATE[c.today_status] ?? '—'}
                      </Text>
                    </View>
                    <Muted numberOfLines={2}>
                      {c.today && c.today_status !== 'rest' ? c.today.title + ' · ' : ''}
                      {c.done30} {plural(c.done30, ['тренировка', 'тренировки', 'тренировок'])} за месяц
                      {c.missed30 ? ` · ${c.missed30} ${plural(c.missed30,
                        ['пропуск', 'пропуска', 'пропусков'])}` : ''}
                    </Muted>
                  </View>
                  {c.pct30 == null ? null : (
                    <View style={{
                      paddingHorizontal: 11, paddingVertical: 7, borderRadius: R.pill,
                      backgroundColor: p.inset, flexDirection: 'row', alignItems: 'baseline',
                    }}>
                      <Text style={{
                        fontSize: 16, fontWeight: '700',
                        color: c.pct30 >= 70 ? p.accent : c.pct30 >= 40 ? p.warn : p.danger,
                      }}>{c.pct30}</Text>
                      <Text style={{ fontSize: 11, color: p.text3 }}>%</Text>
                    </View>
                  )}
                </Card>
              </Pressable>
            </Animated.View>
          ))}
      </ScrollView>
    </View>
  );
}
