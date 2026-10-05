/**
 * Анкета тренировок для EQUA AI.
 *
 * Без неё программу собирать не из чего: место, инвентарь, частота и
 * ограничения — это и есть половина программы, и сервер отказывает,
 * пока ответов нет.
 *
 * Шесть обязательных вопросов и три необязательных. Обязательные
 * проверяет сервер; экран не даёт пройти дальше без ответа, чтобы
 * человек не узнал об отказе в самом конце.
 *
 * Место и инвентарь — с выбором нескольких: занимаются и дома, и в зале,
 * а гантели с резинками соседствуют чаще, чем встречаются по одному.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../store';
import { api } from '../api';
import { S, R, FONT } from '../theme';
import { Icon } from '../ui/Icon';
import { Muted } from '../ui/base';
import { SysButton } from '../ui/system';
import { haptic } from '../haptics';

type QType = 'one' | 'many' | 'textOrNo' | 'text';
interface Q {
  key: string; title: string; sub: string; type: QType;
  opts?: [string | number, string, string?][];
  placeholder?: string;
  /** Обязательные — те, без которых сервер не принимает анкету. */
  required?: boolean;
}

const QS: Q[] = [
  { key: 'place', title: 'Где вы занимаетесь?', sub: 'Можно выбрать несколько.',
    type: 'many', required: true, opts: [
      ['home', 'Дома', 'Своё пространство и свой инвентарь'],
      ['gym', 'В зале', 'Тренажёры и свободные веса'],
      ['outdoor', 'На улице', 'Бег, площадка, парк'],
    ] },
  { key: 'equipment', title: 'Что есть из инвентаря?', sub: 'Отметьте всё, что доступно.',
    type: 'many', required: true, opts: [
      ['none', 'Ничего', 'Только вес тела'],
      ['dumbbells', 'Гантели'], ['barbell', 'Штанга'],
      ['machine', 'Тренажёры'], ['bands', 'Резинки'],
      ['pullup', 'Турник'],
    ] },
  { key: 'days_per_week', title: 'Сколько раз в неделю?', sub: 'Честно — программа строится под это.',
    type: 'one', required: true, opts: [
      [2, '2 раза', 'Минимум, который работает'],
      [3, '3 раза', 'Обычный ритм'],
      [4, '4 раза', 'Можно делить по группам мышц'],
      [5, '5 раз', 'Для тех, кто уже в режиме'],
    ] },
  { key: 'session_minutes', title: 'Сколько длится занятие?', sub: 'Вместе с разминкой.',
    type: 'one', required: true, opts: [
      [30, '30 минут'], [45, '45 минут'], [60, 'Час'], [90, 'Полтора часа'],
    ] },
  { key: 'experience', title: 'Какой у вас опыт?', sub: 'От этого зависят веса и сложность.',
    type: 'one', required: true, opts: [
      ['beginner', 'Начинающий', 'Меньше полугода или возвращаюсь'],
      ['intermediate', 'Средний', 'Занимаюсь регулярно больше года'],
      ['advanced', 'Продвинутый', 'Много лет, знаю свои рабочие веса'],
    ] },
  { key: 'limitations', title: 'Есть ограничения по здоровью?',
    sub: 'Спина, колени, давление — всё, что меняет упражнения.',
    type: 'textOrNo', required: true, placeholder: 'Например: болит поясница при наклонах' },
  { key: 'goal', title: 'Чего хотите от тренировок?', sub: 'Необязательно, но помогает.',
    type: 'text', placeholder: 'Например: убрать живот и подтянуть руки' },
  { key: 'priority_zones', title: 'Над чем поработать особенно?', sub: 'Необязательно.',
    type: 'textOrNo', placeholder: 'Например: ноги и ягодицы' },
  { key: 'dislikes', title: 'Что не хотите делать?', sub: 'Необязательно — заменим.',
    type: 'textOrNo', placeholder: 'Например: без прыжков и без бега' },
];

const DRAFT = 'nm_ai_fit_draft';

export default function AIFitness() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ plan?: string }>();
  const plan = params.plan ?? 'workouts';

  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string | string[]>>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    AsyncStorage.getItem(DRAFT)
      .then(raw => {
        if (raw) {
          const d = JSON.parse(raw);
          if (d?.data) { setData(d.data); setStep(Math.min(d.step ?? 0, QS.length - 1)); }
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const keep = useCallback((next: typeof data, nextStep: number) => {
    AsyncStorage.setItem(DRAFT, JSON.stringify({ data: next, step: nextStep })).catch(() => {});
  }, []);

  const q = QS[step];
  /* Через useMemo, иначе значение пересчитывается каждый рендер и тянет
     за собой перезапуск обработчиков, которые от него зависят. */
  const value = useMemo(
    () => data[q.key] ?? (q.type === 'many' ? [] : ''),
    [data, q.key, q.type],
  );
  const chosen = Array.isArray(value) ? value : [];
  const last = step === QS.length - 1;

  const set = useCallback((v: string | string[]) => {
    setData(prev => {
      const next = { ...prev, [q.key]: v };
      keep(next, step);
      return next;
    });
    setErr(null);
  }, [q.key, step, keep]);

  const toggle = useCallback((v: string) => {
    const now = Array.isArray(data[q.key]) ? (data[q.key] as string[]) : [];
    /* «Ничего» и реальный инвентарь взаимно исключают друг друга: список
       с «ничего» и гантелями одновременно сервер примет, а программа по
       нему выйдет бессмысленной. */
    if (q.key === 'equipment' && v === 'none') { set(['none']); return; }
    const next = now.includes(v)
      ? now.filter(x => x !== v)
      : [...now.filter(x => !(q.key === 'equipment' && x === 'none')), v];
    set(next);
  }, [data, q.key, set]);

  const send = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      await api('/client/ai/fitness', {
        method: 'POST',
        body: {
          place: data.place ?? [],
          equipment: data.equipment ?? [],
          days_per_week: Number(data.days_per_week ?? 3),
          session_minutes: Number(data.session_minutes ?? 45),
          experience: data.experience ?? 'beginner',
          /* Поле обязано присутствовать — пустую строку сервер примет,
             отсутствие ключа нет. */
          limitations: String(data.limitations ?? ''),
          goal: String(data.goal ?? ''),
          priority_zones: String(data.priority_zones ?? ''),
          dislikes: String(data.dislikes ?? ''),
        },
      });
      haptic.success();
      await AsyncStorage.removeItem(DRAFT).catch(() => {});
      router.replace({ pathname: '/ai', params: { plan } });
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Анкета не сохранилась');
    } finally { setBusy(false); }
  }, [data, plan]);

  const next = useCallback(() => {
    const empty = q.type === 'many' ? !chosen.length : !String(value).trim();
    if (q.required && empty) {
      haptic.error();
      setErr(q.type === 'many' ? 'Выберите хотя бы один вариант' : 'Ответьте на вопрос');
      return;
    }
    if (!last) { haptic.tap(); setStep(s => { keep(data, s + 1); return s + 1; }); return; }
    send();
  }, [q, chosen.length, value, last, data, keep, send]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.accent} />
      </View>
    );
  }

  const isNo = String(value).toLowerCase() === 'нет';

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: S.md,
        paddingHorizontal: S.lg, height: 44,
      }}>
        <Pressable hitSlop={12}
          onPress={() => {
            haptic.tap();
            if (step) { setStep(s => s - 1); setErr(null); } else router.back();
          }}>
          <Icon name="back" size={22} color={p.accent} width={2.2} />
        </Pressable>
        <Text style={{ ...FONT.label, color: p.text3 }}>EQUA AI · ТРЕНИРОВКИ</Text>
        <Text style={{ ...FONT.small, color: p.text3, marginLeft: 'auto' }}>
          {step + 1} из {QS.length}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 3, paddingHorizontal: S.lg, paddingTop: S.sm }}>
        {QS.map((_, i) => (
          <View key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            backgroundColor: i <= step ? p.primary : p.track,
          }} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: S.xl,
      }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View key={step} entering={FadeInRight.duration(200)} exiting={FadeOutLeft.duration(130)}>
          <Text style={{ ...FONT.h2, color: p.text }}>{q.title}</Text>
          <Text style={{ ...FONT.body, color: p.text2, marginTop: 6, marginBottom: S.lg }}>
            {q.sub}
          </Text>

          {q.type === 'one' || q.type === 'many' ? q.opts!.map(([v, label, note]) => {
            const on = q.type === 'many'
              ? chosen.includes(String(v))
              : String(value) === String(v);
            return (
              <Pressable key={String(v)}
                onPress={() => {
                  haptic.select();
                  if (q.type === 'many') toggle(String(v)); else set(String(v));
                }}>
                {({ pressed }) => (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: S.md,
                    paddingVertical: 13, paddingHorizontal: S.lg, marginBottom: S.sm,
                    borderRadius: R.md, borderWidth: 1,
                    borderColor: on ? p.primary : p.border,
                    backgroundColor: on ? p.primarySoft : pressed ? p.ov1 : 'transparent',
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, color: p.text, fontWeight: on ? '600' : '400' }}>
                        {label}
                      </Text>
                      {note ? (
                        <Text style={{ ...FONT.small, color: p.text3, marginTop: 2 }}>{note}</Text>
                      ) : null}
                    </View>
                    {on ? <Icon name="check" size={16} color={p.accent} width={2.4} /> : null}
                  </View>
                )}
              </Pressable>
            );
          }) : (
            <>
              {q.type === 'textOrNo' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.md }}>
                  <Pressable onPress={() => { haptic.select(); set('нет'); }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 18, paddingVertical: 9, borderRadius: R.pill,
                      backgroundColor: isNo ? p.primary : 'transparent',
                      borderWidth: isNo ? 0 : 1, borderColor: p.btnLine,
                      opacity: pressed ? 0.7 : 1,
                    })}>
                    <Text style={{
                      fontSize: 15, fontWeight: isNo ? '600' : '400',
                      color: isNo ? p.onPrimary : p.text2,
                    }}>Нет</Text>
                  </Pressable>
                  <Muted>или напишите</Muted>
                </View>
              ) : null}
              <TextInput
                value={isNo ? '' : String(value)}
                onChangeText={set}
                multiline maxLength={300}
                placeholder={q.placeholder ?? 'Ответьте своими словами'}
                placeholderTextColor={p.text3}
                style={{
                  backgroundColor: p.inset, color: p.text, borderRadius: R.md,
                  paddingHorizontal: S.lg, paddingTop: 12, paddingBottom: 12,
                  fontSize: 16, minHeight: 100, textAlignVertical: 'top',
                }} />
              {q.key === 'limitations' ? (
                <Muted style={{ marginTop: S.md, lineHeight: 18 }}>
                  При травмах и болезнях программу должен одобрить врач:
                  EQUA AI не ставит диагнозов.
                </Muted>
              ) : null}
            </>
          )}

          {err ? (
            <Text style={{ ...FONT.small, color: p.danger, marginTop: S.lg }}>{err}</Text>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.md, gap: S.sm }}>
        {busy ? <ActivityIndicator color={p.accent} style={{ marginBottom: 4 }} /> : null}
        <SysButton label={last ? 'Отправить ответы' : 'Далее'} variant="prominent"
          disabled={busy} onPress={next} />
        {!q.required ? (
          <Muted style={{ textAlign: 'center' }}>Можно пропустить</Muted>
        ) : null}
      </View>
    </View>
  );
}
