/**
 * Блоки экрана «Сегодня», которых не было в мобильной версии: тренировка на
 * сегодня, женское здоровье и источник плана (специалист или EQUA AI).
 *
 * Поля берутся те же, что отдаёт сервер вебу, — ничего не выдумано:
 * тренировка приходит из `/client/workouts`, цикл из `/client/health`,
 * доступ к AI — полем `ai_access` ответа `/client/today`.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useApp } from '../store';
import { S, R, FONT, LAYOUT } from '../theme';
import { Icon } from './Icon';
import { mediaUrl } from '../api';
import { haptic } from '../haptics';

/* ---------- то, что присылает сервер ---------- */

export interface WorkoutToday {
  has_trainer?: boolean;
  today?: { id: number; title: string; duration_min?: number; exercises?: number; cover?: string; status?: string } | null;
  week?: { date: string; status: string; cover?: string; title?: string }[];
}

export interface CycleSummary {
  period_active?: boolean;
  cycle_day?: number | null;
  phase_label?: string | null;
}
export interface HealthResponse {
  cycle?: {
    enabled?: boolean;
    summary?: CycleSummary | null;
    logs?: { logged_on: string; energy?: string | null }[];
  } | null;
}

export interface AiAccess {
  plan?: string | null;
  title?: string | null;
  has_nutrition?: boolean;
  has_workouts?: boolean;
  expires_at?: string | null;
  days_left?: number | null;
  active?: boolean;
  has_access?: boolean;
}

/* ---------- Тренировка на сегодня ---------- */

/**
 * Показывается, только когда у человека есть тренер. День без занятия — это
 * не пустота, а запланированный отдых, и так и подписан: иначе человек решит,
 * что программа не загрузилась.
 */
export function TodayWorkout({ data }: { data: WorkoutToday | null }) {
  const { p } = useApp();
  if (!data?.has_trainer) return null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const planned = data.today ?? null;
  const fromWeek = (data.week ?? []).find(x => x.date === todayIso) ?? null;
  const done = fromWeek?.status === 'done';
  const item = planned ?? fromWeek;

  if (!item) {
    return (
      <Pressable
        onPress={() => router.push('/client/workouts')}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: p.ov1 }]}>
          <Icon name="moon" size={20} color={p.text3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[FONT.caption, { color: p.text3 }]}>Движение сегодня</Text>
          <Text style={[FONT.h3, { color: p.text }]}>День восстановления</Text>
        </View>
      </Pressable>
    );
  }

  const title = (planned?.title ?? fromWeek?.title ?? 'Тренировка') as string;
  const cover = (planned?.cover ?? fromWeek?.cover ?? '') as string;
  const mins = planned?.duration_min;
  const count = planned?.exercises;

  return (
    <Pressable
      onPress={() => { haptic.select(); router.push('/client/workouts'); }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      {cover
        ? <Image source={{ uri: mediaUrl(cover) ?? undefined }} style={styles.cover} contentFit="cover" transition={160} />
        : <View style={[styles.cover, { backgroundColor: p.inset, alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name="dumbbell" size={22} color={p.text3} />
          </View>}
      <View style={{ flex: 1 }}>
        <Text style={[FONT.caption, { color: done ? p.good : p.text3 }]}>
          {done ? 'Тренировка выполнена' : 'Тренировка сегодня'}
        </Text>
        <Text style={[FONT.h3, { color: p.text }]} numberOfLines={2}>{title}</Text>
        {(mins || count) ? (
          <Text style={[FONT.caption, { color: p.text3, marginTop: 2 }]}>
            {[mins ? `${mins} мин` : null, count ? `${count} упр.` : null].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      <Icon name="chevr" size={18} color={p.text3} />
    </Pressable>
  );
}

/* ---------- Женское здоровье ---------- */

/**
 * Палитра блока намеренно не розовая: тёплый беж и шалфей вместо привычного
 * «женского» розового, лайм остаётся цветом действия. Так раздел читается
 * как часть EQUA, а не как вставка из другого приложения.
 */
const CYCLE_TINT = {
  dark: { fill: 'rgba(197,208,178,0.12)', art: '#C5D0B2' },
  light: { fill: '#EFEFE6', art: '#9FB08A' },
} as const;

export function TodayCycle({ health }: { health: HealthResponse | null }) {
  const { p } = useApp();
  const c = health?.cycle;
  const s = c?.summary;
  if (!c?.enabled || !s) return null;

  const tint = CYCLE_TINT[p.name];
  const note = s.period_active
    ? 'Идёт менструация'
    : s.cycle_day
      ? `${s.cycle_day}-й день цикла`
      : 'Календарь включён';

  return (
    <Pressable
      onPress={() => { haptic.select(); router.push('/cycle'); }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: tint.fill, borderColor: p.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: p.surface }]}>
        <Icon name="heart" size={19} color={tint.art} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[FONT.caption, { color: p.text3 }]}>{s.phase_label || 'Женское здоровье'}</Text>
        <Text style={[FONT.h3, { color: p.text }]}>{note}</Text>
      </View>
      <Icon name="chevr" size={18} color={p.text3} />
    </Pressable>
  );
}

/* ---------- Кто ведёт план ---------- */

/**
 * Один блок на оба случая: живой специалист или EQUA AI. Человеку важно
 * видеть, кто отвечает за его план, и попасть к нему в один тап — в вебе
 * это сделано так же.
 */
export function TodayPlanSource({
  specialistName,
  ai,
}: {
  specialistName?: string | null;
  ai?: AiAccess | null;
}) {
  const { p } = useApp();
  const aiOn = !!(ai?.active || ai?.has_access);

  if (specialistName) {
    return (
      <Pressable
        onPress={() => { haptic.select(); router.push('/specialist'); }}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: p.primarySoft }]}>
          <Icon name="user" size={19} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[FONT.caption, { color: p.text3 }]}>Ваш специалист</Text>
          <Text style={[FONT.h3, { color: p.text }]} numberOfLines={1}>{specialistName}</Text>
        </View>
        <Icon name="chevr" size={18} color={p.text3} />
      </Pressable>
    );
  }

  if (!aiOn) return null;

  const left = typeof ai?.days_left === 'number' ? ai.days_left : null;
  return (
    <Pressable
      onPress={() => { haptic.select(); router.push('/ai-chat'); }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: p.primarySoft }]}>
        <Icon name="sparkles" size={19} color={p.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[FONT.caption, { color: p.text3 }]}>{ai?.title || 'EQUA AI'}</Text>
        <Text style={[FONT.h3, { color: p.text }]}>
          {left !== null && left >= 0 ? `Осталось ${left} дн.` : 'План ведёт EQUA AI'}
        </Text>
      </View>
      <Icon name="chevr" size={18} color={p.text3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    minHeight: LAYOUT.rowMin,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cover: { width: 56, height: 56, borderRadius: R.control },
  icon: {
    width: 42, height: 42, borderRadius: R.control,
    alignItems: 'center', justifyContent: 'center',
  },
});
