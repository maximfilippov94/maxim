import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api, SpDashboard, SpClient } from '../../api';
import { S, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Label, Muted, Bar } from '../../ui/base';
import { SysChart, Empty } from '../../ui/system';
import { plural } from '../../format';
import { Loading } from '../Shopping';

export default function SpAnalytics() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<SpDashboard | null>(null);
  const [cs, setCs] = useState<SpClient[] | null>(null);

  useEffect(() => {
    api<SpDashboard>('/specialist/dashboard').then(setD).catch(() => setD(null));
    api<{ clients: SpClient[] }>('/specialist/clients')
      .then(r => setCs(r.clients ?? [])).catch(() => setCs([]));
  }, []);

  if (!d || !cs) return <Loading title="Аналитика" />;

  /* Разбивка по целям: чем занят кабинет на самом деле, а не сколько
     всего клиентов в списке. */
  const goals: Record<string, number> = {};
  for (const c of cs) goals[c.goal || 'Цель не задана'] = (goals[c.goal || 'Цель не задана'] ?? 0) + 1;
  const goalRows = Object.entries(goals).sort((a, b) => b[1] - a[1]);

  const withMenu = cs.filter(c => c.menu_status === 'published').length;
  const active = cs.filter(c => c.last_activity).length;
  /* Приверженность по каждому: считаем только тех, у кого есть отметки —
     нули от не начавших занижают среднее и вводят в заблуждение. */
  const scored = cs.filter(c => (c.logged7 ?? 0) > 0)
    .map(c => Math.round((c.eaten7 ?? 0) / (c.logged7 || 1) * 100));

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Аналитика" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
      }} showsVerticalScrollIndicator={false}>

        <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.md }}>
          <Card style={{ flex: 1 }}>
            <Label>Клиентов</Label>
            <Text style={{ fontSize: 26, fontWeight: '700', color: p.text, marginTop: 3 }}>
              {d.clients}
            </Text>
            <Muted>{active} заходили</Muted>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label>С меню</Label>
            <Text style={{ fontSize: 26, fontWeight: '700', color: p.text, marginTop: 3 }}>
              {withMenu}
            </Text>
            <View style={{ marginTop: 8 }}>
              <Bar value={cs.length ? withMenu / cs.length : 0} />
            </View>
          </Card>
        </View>

        <Animated.View entering={FadeInDown.delay(40).duration(240)}>
          <Card style={{ marginTop: S.md }}>
            <Label>Приверженность меню</Label>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
              <Text style={{ ...FONT.num, color: p.text }}>{d.avg_adherence}%</Text>
              <Muted style={{ marginLeft: 8 }}>
                по {scored.length} {plural(scored.length, ['клиенту', 'клиентам', 'клиентам'])}
              </Muted>
            </View>
            {scored.length >= 2 ? (
              <View style={{ marginTop: S.md }}>
                <SysChart color={p.primary} height={130}
                  points={scored.slice(0, 20).map((v, i) => ({ x: String(i + 1), y: v }))} />
              </View>
            ) : (
              <Muted style={{ marginTop: S.md }}>
                График появится, когда отметки будут хотя бы у двух клиентов.
              </Muted>
            )}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(240)}
          style={{ flexDirection: 'row', gap: S.md, marginTop: S.md }}>
          <Card style={{ flex: 1 }}>
            <Label>Отметок за неделю</Label>
            <Text style={{ fontSize: 22, fontWeight: '700', color: p.text, marginTop: 3 }}>
              {d.meals_week}
            </Text>
            <Muted>сегодня {d.meals_today}</Muted>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label>Средний вес</Label>
            <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 3,
              color: (d.avg_weight_delta ?? 0) < 0 ? p.mp : p.text }}>
              {d.avg_weight_delta == null ? '—'
                : `${d.avg_weight_delta > 0 ? '+' : '−'}${Math.abs(d.avg_weight_delta)}`}
            </Text>
            <Muted>кг за период</Muted>
          </Card>
        </Animated.View>

        <Text style={{ ...FONT.h3, color: p.text, marginTop: S.xl, marginBottom: S.sm }}>
          Цели клиентов
        </Text>
        {goalRows.length === 0 ? (
          <Empty icon="chart.pie" height={160} title="Пока нечего считать"
            note="Появятся клиенты — появится и разбивка." />
        ) : (
          <Card style={{ padding: 0 }}>
            {goalRows.map(([g, n], i) => (
              <View key={g} style={{
                paddingVertical: 12, paddingHorizontal: S.lg,
                borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, color: p.text }}>{g}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: p.text }}>{n}</Text>
                </View>
                <View style={{ marginTop: 7 }}>
                  <Bar value={cs.length ? n / cs.length : 0} height={4} />
                </View>
              </View>
            ))}
          </Card>
        )}

        <Muted style={{ marginTop: S.lg, lineHeight: 18 }}>
          Меню без публикации: {d.no_menu} · заканчиваются на днях: {d.menus_ending}
        </Muted>
      </ScrollView>
    </View>
  );
}
