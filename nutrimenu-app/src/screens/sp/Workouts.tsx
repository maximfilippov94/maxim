/**
 * Тренировки тренера — то, что он собирает и назначает.
 *
 * В приложении этого раздела не было вовсе: тренер видел подопечных и
 * их прогресс, но саму тренировку собрать не мог — только в браузере.
 *
 * Строка отвечает на три вопроса сразу: из чего тренировка состоит,
 * сколько идёт и кому назначена. Без последнего список превращается в
 * одинаковые названия: «Ноги», «Ноги 2», «Ноги лёгкие» — и непонятно,
 * какая из них в работе.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api, SpWorkoutRow, WO_LEVELS } from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Empty } from '../../ui/system';
import { plural } from '../../format';
import { haptic } from '../../haptics';

/** Переключатель двух сторон раздела — как в вебе. */
function Seg({ onClients }: { onClients: () => void }) {
  const { p } = useApp();
  return (
    <View style={{
      flexDirection: 'row', margin: S.lg, marginBottom: S.sm,
      backgroundColor: p.inset, borderRadius: R.control, padding: 3,
    }}>
      {[['Программы', true], ['Подопечные', false]].map(([label, on]) => (
        <Pressable key={String(label)}
          onPress={() => { if (!on) { haptic.tap(); onClients(); } }}
          style={{
            flex: 1, height: 36, alignItems: 'center', justifyContent: 'center',
            borderRadius: R.control - 3,
            backgroundColor: on ? p.surface : 'transparent',
          }}>
          <Text style={{
            fontSize: 14, fontWeight: on ? '600' : '400',
            color: on ? p.text : p.text2,
          }}>{String(label)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SpWorkouts() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<SpWorkoutRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ workouts: SpWorkoutRow[] }>('/specialist/workouts')
      .then(r => { setRows(r.workouts ?? []); setErr(null); })
      .catch(e => { setRows([]); setErr(e?.message ?? 'Не открылось'); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (id: number) => {
    haptic.tap();
    router.push({ pathname: '/sp-workout/[id]', params: { id: String(id) } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title="Тренировки" right={
        <Pressable onPress={() => { haptic.tap(); router.push('/sp-workout-form'); }} hitSlop={10}>
          <Text style={{ ...FONT.body, color: p.accent, fontWeight: '600' }}>Новая</Text>
        </Pressable>
      } />
      <Seg onClients={() => router.replace('/sp-wo-clients')} />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}>
        {err ? <Muted style={{ paddingHorizontal: S.lg }}>{err}</Muted> : null}
        {!rows ? <ActivityIndicator color={p.accent} style={{ marginTop: 40 }} />
          : !rows.length ? (
            <Empty icon="dumbbell" title="Тренировок пока нет"
              note="Соберите первую из библиотеки упражнений — потом её можно назначить сразу нескольким клиентам и повторять каждую неделю." />
          ) : rows.map((w, i) => (
            <Animated.View key={w.id} entering={FadeInDown.delay(i * 35).duration(240)}>
              <Pressable onPress={() => open(w.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: S.md,
                  marginHorizontal: S.lg, marginBottom: S.sm, padding: S.md,
                  borderRadius: R.md, borderWidth: 1, borderColor: p.border,
                  backgroundColor: pressed ? p.ov1 : p.surface,
                  /* Скрытую тренировку видно по бледности: она остаётся в
                     списке, потому что история выполнения к ней привязана. */
                  opacity: w.is_active ? 1 : 0.55,
                })}>
                <View style={{
                  width: 40, height: 40, borderRadius: R.sm,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: p.inset,
                }}>
                  <Icon name="dumbbell" size={20} color={p.text2} width={1.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ ...FONT.body, color: p.text, fontWeight: '600' }}>
                    {w.title}
                  </Text>
                  <Text numberOfLines={1} style={{ ...FONT.small, color: p.text3, marginTop: 1 }}>
                    {w.items} {plural(w.items, ['упражнение', 'упражнения', 'упражнений'])}
                    {' · '}{w.duration_min} мин · {WO_LEVELS[w.level] ?? ''}
                  </Text>
                  <Text numberOfLines={1} style={{ ...FONT.small, color: w.assigned ? p.text2 : p.text3, marginTop: 1 }}>
                    {w.assigned
                      ? `назначена ${w.assigned} ${plural(w.assigned, ['клиенту', 'клиентам', 'клиентам'])}`
                      : 'пока никому не назначена'}
                    {w.is_active ? '' : ' · скрыта'}
                  </Text>
                </View>
                <Icon name="chevr" size={14} color={p.text3} width={2} />
              </Pressable>
            </Animated.View>
          ))}
      </ScrollView>
    </View>
  );
}
