/**
 * Основное о тренировке: название, описание, длительность, уровень.
 *
 * Тот же экран правит уже собранную — поля и проверки у них одни, а два
 * отдельных экрана расходятся в мелочах при первой же правке сервера.
 *
 * Новая тренировка ведёт дальше, к составу, а не обратно в список:
 * тренировка без упражнений не назначается, и оставить её в списке
 * пустой — значит оставить работу на половине.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../store';
import { api, SpWorkoutFull, WO_LEVELS } from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Label, Muted } from '../../ui/base';
import { SysButton } from '../../ui/system';
import { haptic } from '../../haptics';

export default function SpWorkoutForm() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id ?? 0) || 0;

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [dur, setDur] = useState('45');
  const [level, setLevel] = useState(2);
  const [ready, setReady] = useState(!id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* При правке поля заполняем с сервера: держать копию списка ради
     этого экрана — лишний способ показать устаревшее название. */
  const fill = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api<{ workout: SpWorkoutFull }>(`/specialist/workouts/${id}`);
      setTitle(r.workout.title ?? '');
      setDesc(r.workout.description ?? '');
      setDur(String(r.workout.duration_min ?? 45));
      setLevel(r.workout.level ?? 2);
    } catch (e: any) {
      setErr(e?.message ?? 'Не открылось');
    } finally { setReady(true); }
  }, [id]);
  /* Правило React Compiler считает вызов, меняющий состояние, нежелательным
     внутри эффекта; здесь это осознанно — данные приходят с сервера, и
     другого места для первого запроса нет. Общий переход на иной способ
     загрузки вынесен отдельной задачей (MIGRATION.md). */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fill(); }, [fill]);

  const save = useCallback(async () => {
    const t = title.trim();
    if (!t) { haptic.error(); setErr('Название тренировки обязательно'); return; }
    const d = parseInt(dur, 10);
    if (!isFinite(d) || d < 5 || d > 240) {
      haptic.error(); setErr('Продолжительность — от 5 до 240 минут'); return;
    }
    setBusy(true); setErr(null);
    try {
      const body = { title: t, description: desc.trim(), duration_min: d, level };
      if (id) {
        await api(`/specialist/workouts/${id}`, { method: 'PATCH', body });
        haptic.success();
        router.back();
      } else {
        const r = await api<{ workout: SpWorkoutFull }>('/specialist/workouts',
          { method: 'POST', body });
        haptic.success();
        router.replace({ pathname: '/sp-workout-build', params: { id: String(r.workout.id) } });
      }
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не сохранилось');
    } finally { setBusy(false); }
  }, [title, desc, dur, level, id]);

  const field = {
    backgroundColor: p.inset, color: p.text, borderRadius: R.md,
    paddingHorizontal: S.lg, paddingVertical: 13, fontSize: 16,
    marginTop: S.sm, marginBottom: S.lg,
  } as const;

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back title="Правка тренировки" />
        <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title={id ? 'Правка тренировки' : 'Новая тренировка'} />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.xl, paddingTop: S.md, paddingBottom: insets.bottom + 40,
      }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <Label>Название</Label>
        <TextInput value={title} onChangeText={t => { setTitle(t); setErr(null); }}
          placeholder="Ноги и ягодицы" placeholderTextColor={p.text3}
          maxLength={120} style={field} />

        <Label>Описание — его увидит клиент</Label>
        <TextInput value={desc} onChangeText={setDesc} multiline maxLength={600}
          placeholder="Силовая на нижнюю часть тела. Подходит для среднего уровня."
          placeholderTextColor={p.text3}
          style={{ ...field, minHeight: 92, paddingTop: 12, textAlignVertical: 'top', fontSize: 15 }} />

        <Label>Продолжительность, минут</Label>
        <TextInput value={dur}
          onChangeText={t => { setDur(t.replace(/[^0-9]/g, '')); setErr(null); }}
          keyboardType="number-pad" maxLength={3} style={field} />

        <Label>Уровень</Label>
        <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
          {Object.entries(WO_LEVELS).map(([k, l]) => {
            const on = Number(k) === level;
            return (
              <Pressable key={k} onPress={() => { haptic.select(); setLevel(Number(k)); }}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 10, borderRadius: R.control,
                  alignItems: 'center',
                  backgroundColor: on ? p.primary : 'transparent',
                  borderWidth: on ? 0 : 1, borderColor: p.btnLine,
                  opacity: pressed && !on ? 0.6 : 1,
                })}>
                <Text numberOfLines={1} style={{
                  fontSize: 14, fontWeight: on ? '600' : '400',
                  color: on ? p.onPrimary : p.text2,
                }}>{l}</Text>
              </Pressable>
            );
          })}
        </View>

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginTop: S.lg }}>{err}</Text>
        ) : null}
        {!id ? (
          <Muted style={{ marginTop: S.lg }}>
            Дальше выберете упражнения — без них тренировку нельзя назначить.
          </Muted>
        ) : null}

        <View style={{ marginTop: S.xl }}>
          <SysButton label={id ? 'Сохранить' : 'Дальше — упражнения'} variant="prominent"
            disabled={busy} onPress={save} />
        </View>
      </ScrollView>
    </View>
  );
}
