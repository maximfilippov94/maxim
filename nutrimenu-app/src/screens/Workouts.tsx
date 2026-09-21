/**
 * Тренировки клиента — главный экран раздела.
 *
 * Три вида на одних данных: «Неделя» отвечает на вопрос «что сегодня»,
 * «Программа» — «что вообще назначено», «История» — «сколько я уже
 * сделал». Данные недели приходят одним запросом: три обращения ради
 * одного экрана — это три повода показать спиннер.
 *
 * Движение здесь сдержанное: бегунок вкладок едет 240 мс (ease-out),
 * карточки въезжают со сдвигом в 40 мс друг за другом, нажатия дают
 * отклик за 140 мс. Ничего, что человек видит десятки раз в день, не
 * анимируется дольше.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import Animated, {
  FadeInDown, useAnimatedStyle, useSharedValue, withTiming, Easing,
} from 'react-native-reanimated';
import { useApp } from '../store';
import {
  api, mediaUrl, WoWeek, WoPlanItem, WoHistoryItem, WO_LEVELS, WO_FEEL,
} from '../api';
import { S, R, FONT } from '../theme';
import { Card, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton, Empty } from '../ui/system';
import { plural } from '../format';
import { haptic } from '../haptics';

/* Кривая и длительность — те же, что в вебе: один язык движения на два
   продукта. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const TABS: [string, string][] = [['week', 'Неделя'], ['plan', 'Программа'], ['history', 'История']];

function today10() {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dayLabel(ds: string) {
  const t = today10();
  if (ds === t) return 'Сегодня';
  const tm = new Date(); tm.setDate(tm.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  if (ds === `${tm.getFullYear()}-${p(tm.getMonth() + 1)}-${p(tm.getDate())}`) return 'Завтра';
  return new Date(ds + 'T00:00:00')
    .toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
}
function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function meta(p: { items: number; duration_min: number; level: number }) {
  return `${p.items} ${plural(p.items, ['упражнение', 'упражнения', 'упражнений'])}`
    + ` · ${p.duration_min} мин · ${WO_LEVELS[p.level] ?? ''}`;
}

/* Снимок упражнения. Картинки может не быть — тогда знак, а не пустой
   прямоугольник: пустота читается как несработавшая загрузка. */
function Shot({ url, size = 56 }: { url?: string | null; size?: number }) {
  const { p } = useApp();
  const src = mediaUrl(url);
  return (
    <View style={{
      width: size, height: size, borderRadius: R.md, overflow: 'hidden',
      backgroundColor: p.inset, alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name="dumbbell" size={size / 2.6} color={p.text3} />
      {src ? (
        <Image source={{ uri: src }} style={{ position: 'absolute', width: '100%', height: '100%' }}
          contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : null}
    </View>
  );
}

export default function Workouts() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'week' | 'plan' | 'history'>('week');
  const [d, setD] = useState<WoWeek | null>(null);
  const [hist, setHist] = useState<WoHistoryItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<WoWeek>('/client/workouts')
      .then(setD).catch(e => setErr(e?.message ?? 'Не открылось'));
  }, []);
  /* Возврат с экрана выполнения должен показывать свежий план, а не
     тот, что был до тренировки. */
  useFocusEffect(useCallback(() => { load(); setHist(null); }, [load]));

  useEffect(() => {
    if (tab === 'history' && !hist)
      api<{ history: WoHistoryItem[] }>('/client/workouts/history')
        .then(r => setHist(r.history ?? [])).catch(() => setHist([]));
  }, [tab, hist]);

  const idx = useSharedValue(0);
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(idx.value * 100, { duration: 240, easing: EASE_OUT }) }],
  }));

  const pick = (k: 'week' | 'plan' | 'history', i: number) => {
    if (k === tab) return;
    haptic.select(); idx.value = i; setTab(k);
  };

  const start = useCallback(async (it: WoPlanItem) => {
    try {
      const r = await api<{ session: { id: number; status: string } }>(
        `/client/workouts/${it.assignment_id}/start`,
        { method: 'POST', body: { planned_on: it.date } });
      haptic.success();
      if (r.session.status === 'done')
        router.push({ pathname: '/wo-done', params: { id: String(r.session.id) } });
      else router.push({ pathname: '/wo-run', params: { id: String(r.session.id) } });
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось начать'); }
  }, []);

  const skip = useCallback(async (it: WoPlanItem) => {
    try {
      await api(`/client/workouts/${it.assignment_id}/skip`,
        { method: 'POST', body: { planned_on: it.date } });
      haptic.select(); load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не получилось'); }
  }, [load]);

  if (err && !d) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + 40 }}>
        <Empty icon="exclamationmark.triangle" title="Тренировки не открылись" note={err} />
      </View>
    );
  }
  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  const pad = {
    paddingTop: insets.top + S.lg, paddingHorizontal: S.lg,
    paddingBottom: insets.bottom + 150,
  };

  if (!d.has_trainer) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={pad}>
        <Text style={{ ...FONT.h1, color: p.text, marginBottom: S.xl }}>Тренировки</Text>
        <Empty icon="figure.strengthtraining.traditional" title="Тренера пока нет"
          note={'Программу составляет тренер: подходы, веса и техника под вашу цель. '
            + 'Питание при этом остаётся у нутрициолога — одно другому не мешает.'} />
        <View style={{ marginTop: S.lg }}>
          <SysButton label="Найти тренера" variant="prominent"
            onPress={() => { haptic.tap(); router.push('/specialist'); }} />
        </View>
      </ScrollView>
    );
  }

  const t = today10();
  const doneToday = d.week.find(x => x.date === t && x.status === 'done');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={pad}
      showsVerticalScrollIndicator={false}>
      <Text style={{ ...FONT.h1, color: p.text, marginBottom: S.lg }}>Тренировки</Text>

      {/* Сегменты: бегунок едет, а не перекрашивается — так видно, откуда
          и куда переключились. */}
      <View style={{
        flexDirection: 'row', backgroundColor: p.inset, borderRadius: 999,
        padding: 4, marginBottom: S.xl, position: 'relative',
      }}>
        <Animated.View style={[{
          position: 'absolute', top: 4, bottom: 4, left: 4, width: '33.333%',
          borderRadius: 999, backgroundColor: p.surface,
        }, indicator]} />
        {TABS.map(([k, l], i) => (
          <Pressable key={k} onPress={() => pick(k as any, i)}
            /* 44 точки — пальцевый минимум; ниже палец промахивается. */
            style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            accessibilityRole="button" accessibilityState={{ selected: tab === k }}>
            <Text style={{
              fontSize: 13.5, fontWeight: '700',
              color: tab === k ? p.text : p.text3,
            }}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'week' ? (
        <WeekView d={d} doneToday={doneToday} onStart={start} onSkip={skip} />
      ) : tab === 'plan' ? (
        <PlanView d={d} onStart={start} />
      ) : (
        <HistoryView list={hist} />
      )}

      {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}
    </ScrollView>
  );
}

/* ---------- Вид «Неделя»: полоса дней, сегодня, следующая ---------- */
function WeekView({ d, doneToday, onStart, onSkip }: {
  d: WoWeek; doneToday?: WoPlanItem;
  onStart: (it: WoPlanItem) => void; onSkip: (it: WoPlanItem) => void;
}) {
  const { p } = useApp();
  const t = today10();
  const by: Record<string, WoPlanItem> = {};
  d.week.forEach(x => { if (!by[x.date] || x.status !== 'planned') by[x.date] = x; });
  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date((d.week_start || t) + 'T00:00:00'); dt.setDate(dt.getDate() + i);
    const pad = (n: number) => String(n).padStart(2, '0');
    const ds = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    return { ds, n: dt.getDate(), it: by[ds], today: ds === t };
  });
  const done = d.week.filter(x => x.status === 'done').length;
  const it = d.today;

  return (
    <>
      <Animated.View entering={FadeInDown.duration(260)}>
        <Card style={{ marginBottom: S.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ ...FONT.label, color: p.text3, textTransform: 'uppercase' }}>
                Эта неделя
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: p.text, marginTop: 2 }}>
                {done} из {d.week.length} {plural(d.week.length, ['тренировки', 'тренировок', 'тренировок'])}
              </Text>
            </View>
            <View style={{ width: 96, height: 6, borderRadius: 999, backgroundColor: p.track }}>
              <View style={{
                width: `${d.week.length ? (done / d.week.length) * 100 : 0}%`,
                height: '100%', borderRadius: 999, backgroundColor: p.primary,
              }} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: S.md, gap: 4 }}>
            {days.map(x => {
              const st = x.it?.status ?? 'rest';
              const fill = st === 'done' ? p.primary
                : st === 'skipped' ? p.danger + '22' : p.inset;
              const bd = st === 'planned' || st === 'in_progress' ? p.primary : 'transparent';
              const col = st === 'done' ? p.onPrimary
                : st === 'skipped' ? p.danger
                : st === 'planned' || st === 'in_progress' ? p.text : p.text3;
              return (
                <View key={x.ds} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: x.today ? p.accent : p.text3 }}>
                    {DOW[new Date(x.ds + 'T00:00:00').getDay() === 0 ? 6
                      : new Date(x.ds + 'T00:00:00').getDay() - 1]}
                  </Text>
                  <View style={{
                    width: 34, height: 34, borderRadius: 17, alignItems: 'center',
                    justifyContent: 'center', backgroundColor: fill,
                    borderWidth: 1.5, borderColor: bd,
                  }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: col }}>{x.n}</Text>
                  </View>
                  <View style={{ height: 14 }}>
                    {st === 'done' ? <Icon name="check" size={13} color={p.accent} />
                      : st === 'skipped' ? <Icon name="close" size={13} color={p.danger} /> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      </Animated.View>

      {it ? (
        <Animated.View entering={FadeInDown.delay(40).duration(260)}>
          <HeroCard it={it} badge={it.status === 'in_progress' ? 'Продолжаем' : 'Сегодня'}
            onStart={onStart} onSkip={onSkip} />
        </Animated.View>
      ) : doneToday ? (
        <Animated.View entering={FadeInDown.delay(40).duration(260)}>
          <Card style={{ marginBottom: S.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <Shot url={doneToday.cover} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: p.text }}>{doneToday.title}</Text>
                <Muted>{meta(doneToday)}</Muted>
              </View>
              <Icon name="check" size={18} color={p.accent} />
            </View>
            <View style={{ marginTop: S.lg }}>
              <SysButton label="Посмотреть итог" onPress={() => router.push({
                pathname: '/wo-done', params: { id: String(doneToday.session_id) } })} />
            </View>
          </Card>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(40).duration(260)}>
          <Card style={{ marginBottom: S.lg, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <View style={{
              width: 46, height: 46, borderRadius: 14, backgroundColor: p.inset,
              alignItems: 'center', justifyContent: 'center',
            }}><Icon name="moon" size={20} color={p.text3} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: p.text }}>Сегодня отдых</Text>
              <Muted>Восстановление — часть программы. Мышца растёт не в зале.</Muted>
            </View>
          </Card>
        </Animated.View>
      )}

      {d.next ? (
        <Animated.View entering={FadeInDown.delay(80).duration(260)}>
          <Text style={{ ...FONT.h3, color: p.text, marginBottom: S.sm }}>Следующая тренировка</Text>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md }}>
            <Shot url={d.next.cover} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: p.text }}>{d.next.title}</Text>
              <Muted numberOfLines={2}>{dayLabel(d.next.date)} · {meta(d.next)}</Muted>
            </View>
          </Card>
        </Animated.View>
      ) : null}
    </>
  );
}

/* Карточка сегодняшней тренировки: снимок, три цифры и одно главное
   действие. Вторым — «пропустить»: пропуск тоже факт, и прятать его
   значит получать молчание вместо данных. */
function HeroCard({ it, badge, onStart, onSkip }: {
  it: WoPlanItem; badge: string;
  onStart: (i: WoPlanItem) => void; onSkip: (i: WoPlanItem) => void;
}) {
  const { p } = useApp();
  const cover = mediaUrl(it.cover);
  return (
    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: S.lg }}>
      <View style={{
        aspectRatio: cover ? 16 / 10 : 16 / 4, backgroundColor: p.inset,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {cover ? (
          <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }}
            contentFit="cover" transition={220} />
        ) : <Icon name="dumbbell" size={26} color={p.text3} />}
        <View style={{
          position: 'absolute', top: 12, left: 12, paddingHorizontal: 11, paddingVertical: 6,
          borderRadius: 999, backgroundColor: p.primary,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: p.onPrimary }}>{badge}</Text>
        </View>
      </View>
      <View style={{ padding: S.lg }}>
        <Text style={{ ...FONT.h2, color: p.text }}>{it.title}</Text>
        <Muted style={{ marginTop: 2 }}>{meta(it)}</Muted>
        {it.description ? (
          <Text style={{ ...FONT.body, color: p.text2, marginTop: S.md }}>{it.description}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg, marginBottom: S.lg }}>
          {[[String(it.duration_min), 'минут'], ['≈' + it.kcal, 'ккал'],
            [String(it.items), plural(it.items, ['упражнение', 'упражнения', 'упражнений'])]]
            .map(([v, l]) => (
              <View key={l} style={{
                flex: 1, backgroundColor: p.inset, borderRadius: R.md,
                paddingVertical: 11, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 19, fontWeight: '700', color: p.text }}>{v}</Text>
                <Text numberOfLines={1} style={{ fontSize: 11.5, color: p.text3 }}>{l}</Text>
              </View>
            ))}
        </View>
        <SysButton label={it.status === 'in_progress' ? 'Продолжить тренировку' : 'Начать тренировку'}
          variant="prominent" onPress={() => { haptic.tap(); onStart(it); }} />
        <Pressable onPress={() => onSkip(it)}
          style={({ pressed }) => ({ marginTop: S.md, alignItems: 'center', opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ ...FONT.body, color: p.text3 }}>Пропустить сегодня</Text>
        </Pressable>
      </View>
    </Card>
  );
}

/* ---------- Вид «Программа» ---------- */
function PlanView({ d, onStart }: { d: WoWeek; onStart: (i: WoPlanItem) => void }) {
  const { p } = useApp();
  const t = today10();
  const by: Record<string, WoPlanItem[]> = {};
  d.week.forEach(x => { (by[x.date] = by[x.date] ?? []).push(x); });
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => {
        const dt = new Date((d.week_start || t) + 'T00:00:00'); dt.setDate(dt.getDate() + i);
        const pad = (n: number) => String(n).padStart(2, '0');
        const ds = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        const list = by[ds] ?? [];
        return (
          <Animated.View key={ds} entering={FadeInDown.delay(i * 40).duration(260)}>
            <Card style={{
              marginBottom: S.sm, padding: S.md,
              borderWidth: ds === t ? 1.5 : undefined,
              borderColor: ds === t ? p.primarySoft : undefined,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: p.text }}>{DOW[i]}</Text>
                <Muted>{dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</Muted>
                {ds === t ? (
                  <Text style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: '700', color: p.accent,
                  }}>сегодня</Text>
                ) : null}
              </View>
              {list.length ? list.map(x => (
                <Pressable key={x.assignment_id + x.date}
                  onPress={() => {
                    if (x.session_id && (x.status === 'done' || x.status === 'in_progress'))
                      router.push({ pathname: x.status === 'done' ? '/wo-done' : '/wo-run',
                        params: { id: String(x.session_id) } });
                    else if (x.date <= t) onStart(x);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: S.md,
                    paddingVertical: S.md, transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}>
                  <Shot url={x.cover} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: p.text }}>{x.title}</Text>
                    <Muted numberOfLines={2}>{meta(x)} · ≈{x.kcal} ккал</Muted>
                  </View>
                  <Mark status={x.status} />
                </Pressable>
              )) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: S.sm }}>
                  <Icon name="moon" size={16} color={p.text3} />
                  <Muted>Отдых</Muted>
                </View>
              )}
            </Card>
          </Animated.View>
        );
      })}
    </>
  );
}

function Mark({ status }: { status: WoPlanItem['status'] }) {
  const { p } = useApp();
  const bg = status === 'done' ? p.primary
    : status === 'skipped' ? p.danger + '22'
    : status === 'in_progress' ? p.primarySoft : 'transparent';
  const col = status === 'done' ? p.onPrimary
    : status === 'skipped' ? p.danger
    : status === 'in_progress' ? p.accent : p.text3;
  return (
    <View style={{
      width: 30, height: 30, borderRadius: 15, backgroundColor: bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={status === 'done' ? 'check' : status === 'skipped' ? 'close'
        : status === 'in_progress' ? 'play' : 'chevr'} size={15} color={col} />
    </View>
  );
}

/* ---------- Вид «История» ---------- */
function HistoryView({ list }: { list: WoHistoryItem[] | null }) {
  const { p } = useApp();
  if (!list) return <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />;
  if (!list.length)
    return (
      <Empty icon="chart.bar" title="История пуста"
        note={'Здесь будут проведённые тренировки: длительность, расход и ваша оценка. '
          + 'Первая появится сразу после «Завершить».'} />
    );
  const done = list.filter(s => s.status === 'done');
  const secs = done.reduce((a, s) => a + (s.duration_sec ?? 0), 0);
  const kcal = done.reduce((a, s) => a + (s.kcal ?? 0), 0);
  return (
    <>
      <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
        {[[String(done.length), 'тренировок'], [String(Math.round(secs / 3600)), 'часов'],
          [String(kcal), 'ккал']].map(([v, l]) => (
          <Card key={l} style={{ flex: 1, alignItems: 'center', paddingVertical: S.lg }}>
            <Text style={{ fontSize: 21, fontWeight: '700', color: p.text }}>{v}</Text>
            <Text numberOfLines={1} style={{ fontSize: 11.5, color: p.text3 }}>{l}</Text>
          </Card>
        ))}
      </View>
      <Card style={{ padding: 0 }}>
        {list.map((s, i) => (
          <Pressable key={s.id}
            onPress={() => s.status === 'done'
              && router.push({ pathname: '/wo-done', params: { id: String(s.id) } })}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: S.md,
              paddingVertical: S.md, paddingHorizontal: S.lg,
              borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}>
            <Mark status={s.status} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: p.text }}>{s.title}</Text>
              <Muted numberOfLines={2}>
                {dayLabel(s.planned_on)}
                {s.status === 'done'
                  ? ` · ${mmss(s.duration_sec ?? 0)} · ≈${s.kcal ?? 0} ккал` : ' · пропущена'}
              </Muted>
            </View>
            {s.feeling ? (
              <Text accessibilityLabel={`Нагрузка: ${WO_FEEL[s.feeling - 1][1]}`}
                style={{ fontSize: 20 }}>{WO_FEEL[s.feeling - 1][2]}</Text>
            ) : null}
          </Pressable>
        ))}
      </Card>
    </>
  );
}
