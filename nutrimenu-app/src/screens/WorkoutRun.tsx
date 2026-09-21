/**
 * Выполнение тренировки: одно упражнение на экран.
 *
 * Здесь человек стоит в зале с телефоном в руке, поэтому экран устроен
 * как одна колонка действий: что делать → сколько сделал → дальше.
 * Хром убран, снимок занимает верх, панель с полями и кнопкой — низ,
 * куда достаёт большой палец.
 *
 * Отдых — отдельный слой поверх: кольцо отсчитывает ровно столько,
 * сколько задал тренер, и идёт linear, потому что это и есть таймер, а
 * не украшение. «+15 сек» не перезапускает кольцо, а продлевает его от
 * текущего положения.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  FadeIn, SlideInDown, useAnimatedProps, useSharedValue, withTiming, Easing,
} from 'react-native-reanimated';
import { useApp } from '../store';
import { api, mediaUrl, WoSession, WoExercise, WO_LEVELS } from '../api';
import { S, R, FONT } from '../theme';
import { Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { plural } from '../format';
import { haptic } from '../haptics';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ACircle = Animated.createAnimatedComponent(Circle);
const RING = 54, LEN = 2 * Math.PI * RING;
const EQUIP: Record<string, string> = {
  none: 'Без инвентаря', dumbbells: 'Гантели', barbell: 'Штанга',
  machine: 'Тренажёр', rope: 'Скакалка',
};

export default function WorkoutRun() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const q = useLocalSearchParams<{ id?: string }>();
  const id = Number(q.id) || 0;

  const [s, setS] = useState<WoSession | null>(null);
  const [i, setI] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [secs, setSecs] = useState('');
  const [rest, setRest] = useState<{ sec: number; next: WoExercise | null; jump: number | null } | null>(null);
  const [info, setInfo] = useState(false);

  useEffect(() => {
    api<{ session: WoSession }>(`/client/sessions/${id}`)
      .then(r => setS(r.session))
      .catch(e => setErr(e?.message ?? 'Тренировка не открылась'));
  }, [id]);

  const ex = s?.exercises ?? [];
  const x = ex[i];
  const mine = (s?.sets ?? []).filter(r => r.workout_exercise_id === x?.id);

  /* Поля подставляем от прошлого подхода: человек редко меняет вес
     между подходами, а набирать его заново — работа на ровном месте. */
  useEffect(() => {
    if (!x) return;
    const last = mine[mine.length - 1];
    setWeight(String(last?.weight_kg ?? x.target_weight_kg ?? ''));
    setReps(String(last?.reps_done ?? x.reps ?? 10));
    setSecs(String(x.duration_sec ?? 0));
  }, [x?.id, mine.length]);

  const isTime = !!x && x.duration_sec != null;
  const total = x?.sets ?? 1;

  const step = (v: string, d: number, set: (t: string) => void) => {
    haptic.select();
    set(String(Math.max(0, Math.round(((parseFloat(v) || 0) + d) * 10) / 10)));
  };

  const saveSet = useCallback(async () => {
    if (!s || !x) return;
    setBusy(true);
    const body: any = { workout_exercise_id: x.id, set_number: mine.length + 1 };
    if (isTime) body.duration_sec = Number(secs) || 0;
    else {
      body.reps_done = Number(reps) || 0;
      if (weight !== '' && weight !== 'null') body.weight_kg = Number(weight) || 0;
    }
    try {
      const r = await api<{ id: number }>(`/client/sessions/${s.id}/sets`, { method: 'POST', body });
      haptic.success();
      const next: WoSession = { ...s, sets: [...s.sets, { id: r.id, ...body, reps_done: body.reps_done ?? null,
        weight_kg: body.weight_kg ?? null, duration_sec: body.duration_sec ?? null }] };
      setS(next);
      const doneN = mine.length + 1;
      const nx = ex[i + 1] ?? null;
      if (doneN >= total) {
        if (nx) setRest({ sec: x.rest_sec || 60, next: nx, jump: i + 1 });
        else finishAsk();
      } else setRest({ sec: x.rest_sec || 60, next: x, jump: null });
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Подход не записался'); }
    finally { setBusy(false); }
  }, [s, x, mine.length, isTime, secs, reps, weight, ex, i, total]);

  const finishAsk = useCallback(() => {
    if (!s) return;
    router.replace({ pathname: '/wo-finish', params: { id: String(s.id) } });
  }, [s]);

  if (err) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + 60, paddingHorizontal: S.lg }}>
        <Text style={{ ...FONT.h2, color: p.text }}>Не открылось</Text>
        <Muted style={{ marginTop: S.sm }}>{err}</Muted>
        <View style={{ marginTop: S.xl }}>
          <SysButton label="Назад" onPress={() => router.back()} />
        </View>
      </View>
    );
  }
  if (!s || !x) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  const shot = mediaUrl(x.image_start_url || x.image_end_url);
  const nextX = ex[i + 1];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + S.xl }}>
        {/* Снимок и служебная строка поверх него */}
        <View style={{
          aspectRatio: shot ? 1 : 16 / 9, backgroundColor: p.inset,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {shot ? (
            <Image source={{ uri: shot }} style={{ width: '100%', height: '100%' }}
              contentFit="cover" transition={220} />
          ) : <Icon name="dumbbell" size={54} color={p.text3} />}

          <View style={{
            position: 'absolute', top: insets.top + 8, left: S.lg, right: S.lg,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <RoundBtn icon="close" label="Выйти из тренировки" onPress={() => router.back()} />
            <View style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
              backgroundColor: 'rgba(9,16,18,0.55)',
            }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                {i + 1} из {ex.length}
              </Text>
            </View>
            <RoundBtn icon="info" label="Об упражнении"
              onPress={() => { haptic.tap(); setInfo(true); }} />
          </View>

          <View style={{
            position: 'absolute', left: S.lg, right: S.lg, bottom: 34,
            flexDirection: 'row', gap: 4,
          }}>
            {ex.map((_, k) => (
              <View key={k} style={{
                flex: 1, height: 3, borderRadius: 999,
                backgroundColor: k < i ? p.primary : k === i ? '#fff' : 'rgba(255,255,255,0.35)',
              }} />
            ))}
          </View>
        </View>

        {/* Панель действий */}
        <View style={{
          marginTop: -22, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          backgroundColor: p.surface, padding: S.xl,
        }}>
          <Text style={{ ...FONT.h2, color: p.text }}>{x.name}</Text>
          {x.muscles_main ? <Muted style={{ marginTop: 3 }}>{x.muscles_main}</Muted> : null}

          <Text style={{ ...FONT.body, color: p.text2, marginTop: S.lg }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: p.text }}>
              {isTime ? `${x.duration_sec} сек` : `${total} × ${x.reps}`}
            </Text>
            {!isTime && x.target_weight_kg ? ` · ${x.target_weight_kg} кг` : ''}
            {` · отдых ${x.rest_sec} сек`}
          </Text>

          {/* Полоса подходов: сделанные заливаются, оставшиеся ждут */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.lg }}>
            {Array.from({ length: total }, (_, k) => {
              const on = k < mine.length;
              return (
                <Animated.View key={k} entering={FadeIn.duration(180)} style={{
                  width: 38, height: 38, borderRadius: 12, alignItems: 'center',
                  justifyContent: 'center', backgroundColor: on ? p.primary : p.inset,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: on ? p.onPrimary : p.text3 }}>
                    {on ? '✓' : k + 1}
                  </Text>
                </Animated.View>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.xl }}>
            {isTime ? (
              <NumField label="Секунды" value={secs} onChange={setSecs}
                onStep={d => step(secs, d, setSecs)} stepBy={5} />
            ) : (
              <>
                <NumField label="Вес, кг" value={weight} onChange={setWeight}
                  onStep={d => step(weight, d, setWeight)} stepBy={2.5} />
                <NumField label="Повторы" value={reps} onChange={setReps}
                  onStep={d => step(reps, d, setReps)} stepBy={1} />
              </>
            )}
          </View>

          <View style={{ marginTop: S.xl }}>
            <SysButton variant="prominent" disabled={busy}
              label={mine.length + 1 >= total ? 'Завершить последний подход'
                : `Завершить подход ${mine.length + 1}`}
              onPress={saveSet} />
          </View>

          {nextX ? (
            <View style={{
              marginTop: S.lg, backgroundColor: p.inset, borderRadius: R.md,
              paddingVertical: 9, paddingHorizontal: S.md, alignItems: 'center',
            }}>
              <Text style={{ fontSize: 12.5, color: p.text3 }}>
                Далее: <Text style={{ color: p.text, fontWeight: '700' }}>{nextX.name}</Text>
              </Text>
            </View>
          ) : null}

          <View style={{
            flexDirection: 'row', alignItems: 'center',
            justifyContent: 'space-between', marginTop: S.lg,
          }}>
            <Pressable disabled={!i} onPress={() => { haptic.tap(); setI(i - 1); }}
              style={({ pressed }) => ({ opacity: !i ? 0.35 : pressed ? 0.5 : 1, padding: 8 })}>
              <Text style={{ ...FONT.body, color: p.text2 }}>← Назад</Text>
            </Pressable>
            <Pressable onPress={() => { haptic.tap(); if (i + 1 < ex.length) setI(i + 1); else finishAsk(); }}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 8 })}>
              <Text style={{ ...FONT.body, color: p.accent }}>
                {i + 1 < ex.length ? 'Дальше →' : 'К итогу →'}
              </Text>
            </Pressable>
          </View>

          {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}
        </View>
      </ScrollView>

      {rest ? (
        <RestOverlay sec={rest.sec} next={rest.next}
          onDone={() => { const j = rest.jump; setRest(null); if (j != null) setI(j); }} />
      ) : null}

      <ExerciseSheet x={x} open={info} onClose={() => setInfo(false)} />
    </View>
  );
}

function RoundBtn({ icon, label, onPress }: {
  icon: string; label: string; onPress: () => void;
}) {
  const { p } = useApp();
  return (
    /* 44 точки: в зале по этим кнопкам попадают мокрыми руками, и
       «почти попал» здесь стоит дороже, чем на любом другом экране. */
    <Pressable onPress={onPress} hitSlop={8}
      accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: p.surface, transform: [{ scale: pressed ? 0.94 : 1 }],
      })}>
      <Icon name={icon as any} size={18} color={p.text} />
    </Pressable>
  );
}

function NumField({ label, value, onChange, onStep, stepBy }: {
  label: string; value: string; onChange: (t: string) => void;
  onStep: (d: number) => void; stepBy: number;
}) {
  const { p } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...FONT.label, color: p.text3, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.inset, borderRadius: R.md, overflow: 'hidden',
      }}>
        <Pressable onPress={() => onStep(-stepBy)}
          accessibilityRole="button" accessibilityLabel={`${label}: меньше`}
          style={({ pressed }) => ({
            width: 44, height: 52, alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}>
          <Text style={{ fontSize: 22, color: p.text2 }}>−</Text>
        </Pressable>
        <TextInput value={value === 'null' ? '' : value} onChangeText={onChange}
          keyboardType="decimal-pad" selectTextOnFocus
          style={{
            flex: 1, height: 52, textAlign: 'center', color: p.text,
            fontSize: 19, fontWeight: '700', padding: 0,
          }} />
        <Pressable onPress={() => onStep(stepBy)}
          accessibilityRole="button" accessibilityLabel={`${label}: больше`}
          style={({ pressed }) => ({
            width: 44, height: 52, alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}>
          <Text style={{ fontSize: 22, color: p.text2 }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ---------- Отдых ---------- */
function RestOverlay({ sec, next, onDone }: {
  sec: number; next: WoExercise | null; onDone: () => void;
}) {
  const { p } = useApp();
  const off = useSharedValue(0);
  const endRef = useRef(Date.now() + sec * 1000);
  const [left, setLeft] = useState(sec);

  useEffect(() => {
    off.value = 0;
    off.value = withTiming(LEN, { duration: sec * 1000, easing: Easing.linear });
    const t = setInterval(() => {
      const l = (endRef.current - Date.now()) / 1000;
      setLeft(Math.max(0, l));
      if (l <= 0) { clearInterval(t); onDone(); }
    }, 200);
    return () => clearInterval(t);
  }, []);

  const props = useAnimatedProps(() => ({ strokeDashoffset: off.value }));

  /* «+15 сек» продлевает отсчёт от текущего положения кольца, а не
     начинает его заново: иначе время «прыгает» назад. */
  const plus = () => {
    haptic.select();
    endRef.current += 15000;
    const rest = Math.max(0, (endRef.current - Date.now()) / 1000);
    off.value = withTiming(LEN, { duration: rest * 1000, easing: Easing.linear });
  };

  const mm = Math.floor(left / 60), ss = Math.floor(left % 60);

  return (
    <Modal transparent animationType="fade" onRequestClose={onDone}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(9,16,18,0.72)',
        alignItems: 'center', justifyContent: 'center', padding: S.lg,
      }}>
        <Animated.View entering={FadeIn.duration(200)} style={{
          width: '100%', maxWidth: 360, backgroundColor: p.surface,
          borderRadius: 24, padding: S.xxl, alignItems: 'center',
        }}>
          <Text style={{ ...FONT.label, color: p.text3, textTransform: 'uppercase' }}>Отдых</Text>
          <View style={{ width: 180, height: 180, marginVertical: S.lg }}>
            <Svg width="100%" height="100%" viewBox="0 0 120 120"
              style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={60} cy={60} r={RING} stroke={p.track} strokeWidth={8} fill="none" />
              <ACircle cx={60} cy={60} r={RING} stroke={p.primary} strokeWidth={8} fill="none"
                strokeLinecap="round" strokeDasharray={LEN} animatedProps={props} />
            </Svg>
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 40, fontWeight: '700', color: p.text }}>
                {mm}:{String(ss).padStart(2, '0')}
              </Text>
            </View>
          </View>

          {next ? (
            <View style={{
              width: '100%', backgroundColor: p.inset, borderRadius: R.md,
              padding: S.md, marginBottom: S.lg, alignItems: 'center',
            }}>
              <Muted>Следующее</Muted>
              <Text style={{ fontSize: 15, fontWeight: '700', color: p.text, marginVertical: 2 }}>
                {next.name}
              </Text>
              <Muted>
                {next.duration_sec != null ? `${next.duration_sec} сек`
                  : `${next.sets} × ${next.reps}`}
              </Muted>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: S.md, width: '100%' }}>
            <View style={{ flex: 1 }}><SysButton label="+15 сек" onPress={plus} /></View>
            <View style={{ flex: 1 }}>
              <SysButton label="Пропустить" variant="prominent" onPress={onDone} />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ---------- Детали упражнения ---------- */
function ExerciseSheet({ x, open, onClose }: {
  x: WoExercise; open: boolean; onClose: () => void;
}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'how' | 'mus' | 'tip'>('how');
  /* Две картинки — начало и конец движения. Показываем по очереди:
     статичная пара не объясняет, что между ними происходит. */
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!open || !x.image_start_url || !x.image_end_url) return;
    const t = setInterval(() => setFrame(f => f ^ 1), 1400);
    return () => clearInterval(t);
  }, [open, x.image_start_url, x.image_end_url]);

  const url = mediaUrl(frame && x.image_end_url ? x.image_end_url
    : (x.image_start_url || x.image_end_url));

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(9,16,18,0.6)' }} />
      <Animated.View entering={SlideInDown.duration(280)} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%',
        backgroundColor: p.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingBottom: insets.bottom + S.lg,
      }}>
        <View style={{
          width: 38, height: 4, borderRadius: 999, backgroundColor: p.border,
          alignSelf: 'center', marginTop: 10,
        }} />
        <ScrollView contentContainerStyle={{ padding: S.lg }}>
          <View style={{
            aspectRatio: url ? 4 / 3 : 16 / 6, borderRadius: R.lg, overflow: 'hidden',
            backgroundColor: p.inset, alignItems: 'center', justifyContent: 'center',
            marginBottom: S.lg,
          }}>
            {url ? (
              <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }}
                contentFit="cover" transition={260} />
            ) : <Icon name="dumbbell" size={44} color={p.text3} />}
          </View>

          <Text style={{ ...FONT.h2, color: p.text }}>{x.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: S.md }}>
            {[WO_LEVELS[x.level], EQUIP[x.equipment], x.kind === 'cardio' ? 'Кардио' : null]
              .filter(Boolean).map(t => (
                <View key={t as string} style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                  backgroundColor: p.inset,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: p.text2 }}>{t}</Text>
                </View>
              ))}
          </View>

          <View style={{
            flexDirection: 'row', gap: S.lg, borderBottomWidth: 1,
            borderBottomColor: p.borderSoft, marginBottom: S.lg,
          }}>
            {([['how', 'Описание'], ['mus', 'Мышцы'], ['tip', 'Советы']] as const).map(([k, l]) => (
              <Pressable key={k} onPress={() => { haptic.select(); setTab(k); }}
                accessibilityRole="button" accessibilityState={{ selected: tab === k }}
                style={{
                  minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, marginBottom: -1,
                  borderBottomColor: tab === k ? p.primary : 'transparent',
                }}>
                <Text style={{
                  fontSize: 13.5, fontWeight: '700', color: tab === k ? p.text : p.text3,
                }}>{l}</Text>
              </Pressable>
            ))}
          </View>

          <Animated.View key={tab} entering={FadeIn.duration(200)} style={{ minHeight: 96 }}>
            {tab === 'mus' ? (
              <>
                <Muted>Основные</Muted>
                <Text style={{ ...FONT.body, color: p.text, marginBottom: S.md }}>
                  {x.muscles_main || '—'}
                </Text>
                <Muted>Дополнительные</Muted>
                <Text style={{ ...FONT.body, color: p.text }}>{x.muscles_extra || '—'}</Text>
              </>
            ) : (
              <Text style={{ ...FONT.body, color: p.text2, lineHeight: 22 }}>
                {tab === 'tip'
                  ? (x.tips || 'Особых замечаний нет — держите технику и дышите ровно.')
                  : (x.instructions || 'Описание появится позже.')}
              </Text>
            )}
          </Animated.View>

          <View style={{ marginTop: S.xl }}>
            <SysButton label="Понятно" onPress={onClose} />
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
