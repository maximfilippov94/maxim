/**
 * Тренировка целиком: из чего состоит, кому назначена, что с ней можно
 * сделать.
 *
 * Удаление здесь намеренно не всегда доступно: сервер отказывает, если
 * тренировка назначена или по ней есть история выполнения, — иначе из
 * истории клиента пропадёт, что он делал. Такую скрывают, и экран
 * говорит об этом словами отказа, а не общим «не получилось».
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../store';
import { api, SpWorkoutFull, WO_LEVELS, WEEKDAYS, assignDays } from '../../api';
import { S, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { ListGroup, ListHead, ListRow } from '../../ui/List';
import { SysButton, Empty } from '../../ui/system';
import { useToast } from '../../ui/Toast';
import { plural } from '../../format';
import { haptic } from '../../haptics';

const dmy = (s?: string | null) => {
  if (!s) return '—';
  const x = String(s).slice(0, 10).split('-');
  return x.length === 3 ? `${x[2]}.${x[1]}.${x[0]}` : String(s);
};

/** Как читается повтор назначения: разово или по дням недели. */
function repeatNote(a: Parameters<typeof assignDays>[0]): string {
  if (a.repeat_kind !== 'weekly') return `один раз, ${dmy(a.start_date)}`;
  const days = assignDays(a);
  const names = days.map(d => WEEKDAYS.find(([n]) => n === d)?.[1] ?? '').filter(Boolean);
  return names.length
    ? `каждую неделю: ${names.join(', ')}`
    : `каждую неделю с ${dmy(a.start_date)}`;
}

export default function SpWorkout() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id ?? 0) || 0;

  const [w, setW] = useState<SpWorkoutFull | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ workout: SpWorkoutFull }>(`/specialist/workouts/${id}`)
      .then(r => { setW(r.workout); setErr(null); })
      .catch(e => setErr(e?.message ?? 'Не открылось'));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hide = useCallback(async () => {
    if (!w) return;
    setBusy(true);
    try {
      await api(`/specialist/workouts/${id}`, {
        method: 'PATCH', body: { is_active: w.is_active ? 0 : 1 },
      });
      haptic.success();
      toast(w.is_active ? 'Тренировка скрыта' : 'Тренировка снова в работе');
      load();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не получилось');
    } finally { setBusy(false); }
  }, [w, id, load, toast]);

  const remove = useCallback(() => {
    Alert.alert('Удалить тренировку?', 'Это насовсем.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api(`/specialist/workouts/${id}`, { method: 'DELETE' });
            haptic.success(); toast('Тренировка удалена');
            router.back();
          } catch (e: any) {
            /* Отказ сервера показываем как есть: он объясняет, почему
               удалить нельзя и что делать вместо этого. */
            haptic.error(); setErr(e?.message ?? 'Не удалилось');
          } finally { setBusy(false); }
        },
      },
    ]);
  }, [id, toast]);

  const unassign = useCallback((aid: number, name?: string) => {
    Alert.alert('Снять назначение?', name
      ? `${name} больше не увидит эту тренировку в плане. История выполнения останется.`
      : 'История выполнения останется.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Снять', style: 'destructive',
        onPress: async () => {
          try {
            await api(`/specialist/assignments/${aid}`, { method: 'DELETE' });
            haptic.success(); toast('Назначение снято'); load();
          } catch (e: any) {
            haptic.error(); setErr(e?.message ?? 'Не получилось');
          }
        },
      },
    ]);
  }, [load, toast]);

  if (!w) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back title="Тренировка" />
        {err ? <Muted style={{ padding: S.lg }}>{err}</Muted>
          : <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />}
      </View>
    );
  }

  const items = w.exercises ?? [];
  const asg = w.assignments ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title={w.is_active ? 'Тренировка' : 'Скрытая тренировка'} right={
        <Pressable hitSlop={10}
          onPress={() => { haptic.tap();
            router.push({ pathname: '/sp-workout-form', params: { id: String(id) } }); }}>
          <Text style={{ ...FONT.body, color: p.primary }}>Правка</Text>
        </Pressable>
      } />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>

        <View style={{ paddingHorizontal: S.lg, paddingTop: S.md }}>
          <Text style={{ ...FONT.h1, color: p.text }}>{w.title}</Text>
          <Text style={{ ...FONT.small, color: p.text3, marginTop: 4 }}>
            {w.duration_min} мин · {WO_LEVELS[w.level] ?? ''} ·{' '}
            {items.length} {plural(items.length, ['упражнение', 'упражнения', 'упражнений'])}
          </Text>
          {w.description ? (
            <Text style={{ ...FONT.body, color: p.text2, marginTop: S.md, lineHeight: 22 }}>
              {w.description}
            </Text>
          ) : null}
        </View>

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, paddingHorizontal: S.lg, paddingTop: S.md }}>
            {err}
          </Text>
        ) : null}

        <ListHead>Состав</ListHead>
        {!items.length ? (
          <View style={{ paddingHorizontal: S.lg }}>
            <Muted>Упражнений пока нет — без них тренировку нельзя назначить.</Muted>
          </View>
        ) : (
          <ListGroup>
            {items.map((e, i) => (
              <ListRow key={e.id} first={i === 0} label={`${i + 1}. ${e.name}`}
                value={e.kind === 'cardio'
                  ? `${Math.round((e.duration_sec ?? 600) / 60)} мин`
                  : `${e.sets ?? 3} × ${e.reps ?? 12}`} />
            ))}
          </ListGroup>
        )}
        <View style={{ paddingHorizontal: S.lg, paddingTop: S.md }}>
          <SysButton label={items.length ? 'Изменить состав' : 'Собрать состав'} icon="dumbbell"
            onPress={() => { haptic.tap();
              router.push({ pathname: '/sp-workout-build', params: { id: String(id) } }); }} />
        </View>

        <ListHead>Кому назначена</ListHead>
        {!asg.length ? (
          <Empty icon="person.2" title="Пока никому" height={180}
            note="Назначьте тренировку — она появится у клиента в плане на выбранный день." />
        ) : (
          <ListGroup>
            {asg.map((a, i) => (
              <ListRow key={a.id} first={i === 0}
                label={a.client_name ?? `Клиент ${a.client_id}`}
                value={repeatNote(a)}
                action
                right={
                  <Pressable onPress={() => unassign(a.id, a.client_name)} hitSlop={10}
                    style={{ paddingHorizontal: 4 }}>
                    <Icon name="close" size={16} color={p.text3} width={2} />
                  </Pressable>
                } />
            ))}
          </ListGroup>
        )}

        <View style={{ paddingHorizontal: S.lg, paddingTop: S.md, gap: S.md }}>
          <SysButton label="Назначить клиенту" variant="prominent"
            disabled={!items.length}
            onPress={() => { haptic.tap();
              router.push({ pathname: '/sp-workout-assign', params: { id: String(id) } }); }} />
          {!items.length ? (
            <Muted>Сначала соберите состав: пустую тренировку назначать нечему.</Muted>
          ) : null}
          <SysButton label={w.is_active ? 'Скрыть из списка' : 'Вернуть в работу'}
            disabled={busy} onPress={hide} />
          <SysButton label="Удалить" variant="destructive" disabled={busy} onPress={remove} />
        </View>
      </ScrollView>
    </View>
  );
}
