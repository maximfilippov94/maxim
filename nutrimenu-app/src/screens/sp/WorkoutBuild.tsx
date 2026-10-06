/**
 * Состав тренировки: что делать, сколько подходов и сколько отдыхать.
 *
 * Состав уходит на сервер целиком одним запросом, а не по упражнению:
 * строки здесь двигают и убирают, и синхронизировать порядок частями —
 * верный способ получить на экране одно, а в базе другое. Пока состав
 * не сохранён, он живёт только на этом экране, поэтому уйти с него с
 * несохранёнными правками экран не даёт молча.
 *
 * Умолчания зависят от упражнения: у кардио меряют время, у силового —
 * подходы. «3 × 12» для беговой дорожки бессмысленно.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useApp } from '../../store';
import {
  api, mediaUrl, SpWorkoutFull, ExerciseLib, ExerciseRow, WoDraftRow,
} from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Label, Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { SysButton, Empty } from '../../ui/system';
import { useToast } from '../../ui/Toast';
import { plural } from '../../format';
import { haptic } from '../../haptics';

/** Как строка состава читается одной фразой. */
function rowNote(r: WoDraftRow): string {
  const rest = `отдых ${r.rest_sec} с`;
  if (r.kind === 'cardio') return `${Math.round((r.duration_sec ?? 600) / 60)} мин · ${rest}`;
  const w = r.target_weight_kg ? ` · ${r.target_weight_kg} кг` : '';
  return `${r.sets ?? 3} × ${r.reps ?? 12} · ${rest}${w}`;
}

export default function SpWorkoutBuild() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id ?? 0) || 0;

  const [title, setTitle] = useState('');
  const [rows, setRows] = useState<WoDraftRow[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [lib, setLib] = useState<ExerciseLib | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [edit, setEdit] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ workout: SpWorkoutFull }>(`/specialist/workouts/${id}`);
      setTitle(r.workout.title ?? '');
      setRows((r.workout.exercises ?? []).map(e => ({
        exercise_id: (e as unknown as { exercise_id?: number }).exercise_id ?? e.id,
        name: e.name, kind: e.kind,
        sets: e.sets, reps: e.reps, rest_sec: e.rest_sec ?? 60,
        duration_sec: e.duration_sec, target_weight_kg: e.target_weight_kg,
        note: '',
      })));
    } catch (e: any) {
      setRows([]); setErr(e?.message ?? 'Не открылось');
    }
  }, [id]);
  /* Правило React Compiler считает вызов, меняющий состояние, нежелательным
     внутри эффекта; здесь это осознанно — данные приходят с сервера, и
     другого места для первого запроса нет. Общий переход на иной способ
     загрузки вынесен отдельной задачей (MIGRATION.md). */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  /* Библиотеку тянем один раз и фильтруем на месте: сто двадцать
     упражнений — не тот объём, ради которого стоит ходить на сервер за
     каждой буквой в поиске. */
  const openPick = useCallback(async () => {
    haptic.tap();
    setPickOpen(true);
    if (lib) return;
    try { setLib(await api<ExerciseLib>('/specialist/exercises')); }
    catch (e: any) { setErr(e?.message ?? 'Библиотека не открылась'); setPickOpen(false); }
  }, [lib]);

  const found = useMemo(() => {
    const all = lib?.exercises ?? [];
    const needle = q.trim().toLowerCase();
    return all.filter(e =>
      (!group || e.muscle_group === group) &&
      (!needle || e.name.toLowerCase().includes(needle)
        || String(e.muscles_main ?? '').toLowerCase().includes(needle)));
  }, [lib, q, group]);

  const add = useCallback((e: ExerciseRow) => {
    setRows(prev => {
      const list = prev ?? [];
      if (list.some(r => r.exercise_id === e.id)) return list;
      haptic.success();
      setDirty(true);
      return [...list, e.kind === 'cardio'
        ? { exercise_id: e.id, name: e.name, kind: 'cardio' as const, duration_sec: 600, rest_sec: 60 }
        : { exercise_id: e.id, name: e.name, kind: 'strength' as const, sets: 3, reps: 12, rest_sec: 60 }];
    });
  }, []);

  const move = useCallback((i: number, d: -1 | 1) => {
    setRows(prev => {
      const list = [...(prev ?? [])];
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j], list[i]];
      haptic.select(); setDirty(true);
      return list;
    });
  }, []);

  const drop = useCallback((i: number) => {
    setRows(prev => (prev ?? []).filter((_, k) => k !== i));
    setDirty(true); setEdit(null); haptic.tap();
  }, []);

  const patch = useCallback((i: number, part: Partial<WoDraftRow>) => {
    setRows(prev => (prev ?? []).map((r, k) => (k === i ? { ...r, ...part } : r)));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    const list = rows ?? [];
    setBusy(true); setErr(null);
    try {
      await api(`/specialist/workouts/${id}/exercises`, {
        method: 'PUT',
        body: {
          exercises: list.map(r => ({
            exercise_id: r.exercise_id, sets: r.sets, reps: r.reps,
            rest_sec: r.rest_sec, duration_sec: r.duration_sec,
            target_weight_kg: r.target_weight_kg, note: r.note ?? '',
          })),
        },
      });
      haptic.success(); setDirty(false);
      toast(list.length ? 'Состав сохранён' : 'Состав очищен');
      router.replace({ pathname: '/sp-workout/[id]', params: { id: String(id) } });
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Состав не сохранился');
    } finally { setBusy(false); }
  }, [rows, id, toast]);

  const leave = useCallback(() => {
    if (!dirty) { router.back(); return; }
    Alert.alert('Выйти без сохранения?', 'Набранный состав не сохранится.', [
      { text: 'Остаться', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [dirty]);

  if (!rows) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back title="Состав" />
        <ActivityIndicator color={p.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const r = edit != null ? rows[edit] : null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {/* Уходя с несохранёнными правками, человек теряет весь набранный
          состав — спрашиваем, вместо того чтобы молча его выбросить. */}
      <NavBar title={title || 'Состав'} back onBack={leave}
        right={rows.length ? (
          <Pressable onPress={save} disabled={busy} hitSlop={10}>
            <Text style={{ ...FONT.body, color: busy ? p.text3 : p.primary, fontWeight: '600' }}>
              Готово
            </Text>
          </Pressable>
        ) : undefined} />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}>

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, paddingHorizontal: S.lg, paddingTop: S.sm }}>
            {err}
          </Text>
        ) : null}

        {!rows.length ? (
          <Empty icon="dumbbell" title="Упражнений пока нет"
            note="Добавьте их из общей библиотеки — её ведёт EQUA, своих упражнений заводить не нужно." />
        ) : rows.map((row, i) => (
          <Pressable key={`${row.exercise_id}-${i}`}
            onPress={() => { haptic.tap(); setEdit(i); }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: S.md,
              marginHorizontal: S.lg, marginTop: S.sm, padding: S.md,
              borderRadius: R.md, borderWidth: 1, borderColor: p.border,
              backgroundColor: pressed ? p.ov1 : p.surface,
            })}>
            <Text style={{ ...FONT.small, color: p.text3, width: 18 }}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ ...FONT.body, color: p.text }}>{row.name}</Text>
              <Text style={{ ...FONT.small, color: p.text3, marginTop: 1 }}>{rowNote(row)}</Text>
            </View>
            {/* Порядок меняют кнопками, а не перетаскиванием: ручка,
                которая не тянет, читается как поломка, а настоящее
                перетаскивание внутри прокрутки отбирает у списка жест. */}
            <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={8}
              style={{ padding: 4, opacity: i === 0 ? 0.25 : 1 }}>
              <View style={{ transform: [{ rotate: '90deg' }] }}>
                <Icon name="chevr" size={14} color={p.text2} width={2} />
              </View>
            </Pressable>
            <Pressable onPress={() => move(i, 1)} disabled={i === rows.length - 1} hitSlop={8}
              style={{ padding: 4, opacity: i === rows.length - 1 ? 0.25 : 1 }}>
              <View style={{ transform: [{ rotate: '-90deg' }] }}>
                <Icon name="chevr" size={14} color={p.text2} width={2} />
              </View>
            </Pressable>
          </Pressable>
        ))}

        <View style={{ paddingHorizontal: S.lg, paddingTop: S.lg, gap: S.md }}>
          <SysButton label="Добавить упражнения" icon="plus" onPress={openPick} />
          {rows.length ? (
            <SysButton label={busy ? 'Сохраняю…' : 'Сохранить состав'} variant="prominent"
              disabled={busy} onPress={save} />
          ) : null}
        </View>
      </ScrollView>

      {/* ------------------------------------------------ библиотека */}
      <Modal visible={pickOpen} animationType="slide"
        onRequestClose={() => setPickOpen(false)}>
        <View style={{ flex: 1, backgroundColor: p.bg }}>
          <NavBar title="Библиотека" onBack={() => setPickOpen(false)} back
            right={
              <Pressable onPress={() => { haptic.tap(); setPickOpen(false); }} hitSlop={10}>
                <Text style={{ ...FONT.body, color: p.accent, fontWeight: '600' }}>Готово</Text>
              </Pressable>
            } />

          <View style={{ paddingHorizontal: S.lg, paddingTop: S.sm }}>
            <TextInput value={q} onChangeText={setQ} placeholder="Поиск упражнений"
              placeholderTextColor={p.text3} returnKeyType="search"
              style={{
                backgroundColor: p.inset, color: p.text, borderRadius: R.control,
                paddingHorizontal: S.lg, paddingVertical: 11, fontSize: 16,
              }} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: S.lg, paddingVertical: S.md, gap: S.sm }}>
            {[['', 'Все'] as [string, string]]
              .concat(Object.entries(lib?.groups ?? {}))
              .map(([k, l]) => {
                const on = k === group;
                return (
                  <Pressable key={k || 'all'} onPress={() => { haptic.select(); setGroup(k); }}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill,
                      backgroundColor: on ? p.primary : 'transparent',
                      borderWidth: on ? 0 : 1, borderColor: p.btnLine,
                    }}>
                    <Text style={{
                      fontSize: 14, fontWeight: on ? '600' : '400',
                      color: on ? p.onPrimary : p.text2,
                    }}>{l}</Text>
                  </Pressable>
                );
              })}
          </ScrollView>

          {!lib ? <ActivityIndicator color={p.accent} style={{ marginTop: 30 }} /> : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {!found.length ? (
                <Muted style={{ paddingHorizontal: S.lg, paddingTop: S.lg }}>Ничего не нашлось</Muted>
              ) : found.map(e => {
                const added = rows.some(x => x.exercise_id === e.id);
                const thumb = mediaUrl(e.image_start_url ?? null);
                return (
                  <View key={e.id} style={{
                    flexDirection: 'row', alignItems: 'center', gap: S.md,
                    paddingHorizontal: S.lg, paddingVertical: S.sm,
                  }}>
                    <Image source={{ uri: thumb ?? undefined }} contentFit="cover"
                      transition={160} cachePolicy="memory-disk"
                      style={{ width: 48, height: 48, borderRadius: R.sm, backgroundColor: p.inset }} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ ...FONT.body, color: p.text }}>{e.name}</Text>
                      <Text numberOfLines={1} style={{ ...FONT.small, color: p.text3 }}>
                        {lib.groups[e.muscle_group] ?? ''}
                        {e.equipment && lib.equipment[e.equipment]
                          ? ` · ${lib.equipment[e.equipment]}` : ''}
                      </Text>
                    </View>
                    {/* Экран не закрываем после добавления: упражнений в
                        тренировку идёт несколько. */}
                    <Pressable onPress={() => add(e)} disabled={added} hitSlop={8}
                      style={{
                        width: 32, height: 32, borderRadius: 16,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: added ? p.primarySoft : 'transparent',
                        borderWidth: added ? 0 : 1, borderColor: p.btnLine,
                      }}>
                      <Icon name={added ? 'check' : 'plus'} size={14}
                        color={added ? p.accent : p.text2} width={2.2} />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {rows.length ? (
            <View style={{
              paddingHorizontal: S.lg, paddingTop: S.sm,
              paddingBottom: insets.bottom + S.md,
              borderTopWidth: 1, borderTopColor: p.border, backgroundColor: p.surface,
            }}>
              <Text style={{ ...FONT.small, color: p.text2, marginBottom: S.sm }}>
                {rows.length} {plural(rows.length, ['упражнение', 'упражнения', 'упражнений'])} в тренировке
              </Text>
              <SysButton label="К параметрам" variant="prominent"
                onPress={() => { haptic.tap(); setPickOpen(false); }} />
            </View>
          ) : null}
        </View>
      </Modal>

      {/* --------------------------------------- параметры упражнения */}
      <Modal visible={edit != null} animationType="slide" transparent
        onRequestClose={() => setEdit(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={() => setEdit(null)} />
        <View style={{
          backgroundColor: p.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: S.xl, paddingTop: S.xl,
          paddingBottom: insets.bottom + S.xl,
        }}>
          {r && edit != null ? (
            <>
              <Text style={{ ...FONT.h3, color: p.text, marginBottom: S.lg }}>{r.name}</Text>

              {r.kind === 'cardio' ? (
                <>
                  <Label>Минуты</Label>
                  <NumField key={`dur-${edit}`} value={String(Math.round((r.duration_sec ?? 600) / 60))}
                    onChange={v => patch(edit, { duration_sec: Math.max(60, (Number(v) || 10) * 60) })} />
                </>
              ) : (
                <View style={{ flexDirection: 'row', gap: S.md }}>
                  <View style={{ flex: 1 }}>
                    <Label>Подходы</Label>
                    <NumField key={`sets-${edit}`} value={String(r.sets ?? 3)}
                      onChange={v => patch(edit, { sets: Math.min(20, Math.max(1, Number(v) || 3)) })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label>Повторы</Label>
                    <NumField key={`reps-${edit}`} value={String(r.reps ?? 12)}
                      onChange={v => patch(edit, { reps: Math.min(200, Math.max(1, Number(v) || 12)) })} />
                  </View>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: S.md }}>
                <View style={{ flex: 1 }}>
                  <Label>Отдых, секунд</Label>
                  <NumField key={`rest-${edit}`} value={String(r.rest_sec ?? 60)}
                    onChange={v => patch(edit, { rest_sec: Math.min(600, Math.max(0, Number(v) || 0)) })} />
                </View>
                {r.kind === 'cardio' ? null : (
                  <View style={{ flex: 1 }}>
                    <Label>Вес, кг</Label>
                    <NumField key={`wt-${edit}`} value={r.target_weight_kg != null ? String(r.target_weight_kg) : ''}
                      decimal
                      onChange={v => patch(edit, {
                        target_weight_kg: v === '' ? null : Number(v.replace(',', '.')),
                      })} />
                  </View>
                )}
              </View>

              <View style={{ marginTop: S.md, gap: S.md }}>
                <SysButton label="Готово" variant="prominent"
                  onPress={() => { haptic.tap(); setEdit(null); }} />
                <SysButton label="Убрать из тренировки" variant="destructive"
                  onPress={() => drop(edit)} />
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

/**
 * Числовое поле: правка идёт сразу в состав, без отдельного «применить».
 *
 * Внешнее значение не подхватывает на ходу специально — иначе округление
 * сервера перебивало бы цифру под пальцем. Когда шторка открывается для
 * другой строки, поле пересоздаётся по ключу.
 */
function NumField({ value, onChange, decimal }: {
  value: string; onChange: (v: string) => void; decimal?: boolean;
}) {
  const { p } = useApp();
  const [raw, setRaw] = useState(value);
  return (
    <TextInput
      value={raw}
      onChangeText={t => {
        const clean = decimal ? t.replace(/[^0-9.,]/g, '') : t.replace(/[^0-9]/g, '');
        setRaw(clean);
      }}
      onEndEditing={() => onChange(raw)}
      onBlur={() => onChange(raw)}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      maxLength={decimal ? 6 : 4}
      placeholder={decimal ? '—' : ''}
      placeholderTextColor={p.text3}
      style={{
        backgroundColor: p.inset, color: p.text, borderRadius: R.md,
        paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 17, fontWeight: '600',
        marginTop: S.sm, marginBottom: S.lg,
      }}
    />
  );
}
