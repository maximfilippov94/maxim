/**
 * Анкета при первом входе.
 *
 * В приложении её не было: человек, зарегистрировавшийся с телефона,
 * попадал на «Сегодня» без цели и без норм КБЖУ — экран без плана, по
 * которому непонятно, что делать. Веб в этом случае уводит на анкету и
 * не пускает дальше, пока она не заполнена.
 *
 * Четыре шага и те же вопросы, что в вебе: цель, данные о себе,
 * активность, исключения из меню. Последний можно пропустить — он про
 * предпочтения, а не про расчёт.
 *
 * Нормы считает клиент, не сервер (так же в вебе): формула
 * Миффлина — Сан Жеора, поправка на активность и цель. Повторяю её
 * ровно, иначе у человека, заполнившего анкету с телефона, нормы
 * оказались бы другими, чем у заполнившего в браузере.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useApp } from '../store';
import { api } from '../api';
import { S, R, FONT } from '../theme';
import { Logo } from '../ui/Logo';
import { Icon } from '../ui/Icon';
import { Muted } from '../ui/base';
import { SysButton } from '../ui/system';
import { haptic } from '../haptics';

/* Значения цели — русские строки: именно в таком виде их хранит сервер и
   читают остальные экраны. Менять на коды нельзя, разойдётся с вебом. */
const GOALS: [string, string][] = [
  ['Снижение веса', 'Снизить вес'],
  ['Поддержание', 'Поддерживать форму'],
  ['Набор мышечной массы', 'Набрать мышечную массу'],
  ['Здоровье ЖКТ', 'Улучшить самочувствие и питание'],
];
const ACTIVITY: [string, string, string][] = [
  ['low', 'Низкая', 'В основном сидячий образ жизни'],
  ['medium', 'Средняя', 'Тренировки 2–3 раза в неделю'],
  ['high', 'Высокая', 'Спорт или много движения почти каждый день'],
];
const DISLIKES = ['Рыба', 'Мясо', 'Молочное', 'Глютен', 'Орехи',
  'Грибы', 'Яйца', 'Мёд', 'Свинина', 'Лактоза'];

/** Нормы КБЖУ. Та же формула, что в вебе, — цифры должны совпадать. */
function targets(sex: string, age: number, h: number, w: number,
                 activity: string, goal: string) {
  let kcal = 10 * w + 6.25 * h - 5 * age + (sex === 'm' ? 5 : -161);
  kcal *= ({ low: 1.3, medium: 1.5, high: 1.7 } as Record<string, number>)[activity] ?? 1.5;
  if (goal === 'Снижение веса') kcal *= 0.85;
  else if (goal === 'Набор мышечной массы') kcal *= 1.1;
  kcal = Math.max(1000, Math.round(kcal / 10) * 10);
  const protein = Math.round((goal === 'Набор мышечной массы' ? 2 : 1.8) * w);
  const fat = Math.round(0.9 * w);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { target_kcal: kcal, target_protein: protein, target_fat: fat, target_carbs: carbs };
}

const TOTAL = 4;

export default function Onboarding() {
  const { p, refreshMe } = useApp();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [sex, setSex] = useState('');
  const [age, setAge] = useState('');
  const [h, setH] = useState('');
  const [w, setW] = useState('');
  const [activity, setActivity] = useState('');
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = useCallback(async (skip: boolean) => {
    setBusy(true); setErr(null);
    const nw = +w, nh = +h, nage = +age;
    try {
      await api('/client/onboarding', {
        method: 'POST',
        body: {
          answers: {
            goal, sex, age: nage, height_cm: nh, weight_kg: nw,
            activity_level: activity,
            dislikes: skip ? [] : dislikes,
            ...targets(sex, nage, nh, nw, activity, goal),
          },
        },
      });
      haptic.success();
      /* Кабинет перечитываем: экраны ниже читают цель и нормы из профиля,
         и без обновления «Сегодня» откроется с прежними прочерками. */
      await refreshMe();
      router.replace('/client');
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Анкета не сохранилась');
    } finally { setBusy(false); }
  }, [goal, sex, age, h, w, activity, dislikes, refreshMe]);

  const next = useCallback(() => {
    setErr(null);
    if (step === 1 && !goal) { haptic.error(); setErr('Выберите цель'); return; }
    if (step === 2 && (!sex || !(+age > 0) || !(+h > 0) || !(+w > 0))) {
      haptic.error(); setErr('Укажите пол, возраст, рост и вес'); return;
    }
    if (step === 3 && !activity) { haptic.error(); setErr('Выберите уровень активности'); return; }
    if (step < TOTAL) { haptic.tap(); setStep(s => s + 1); return; }
    save(false);
  }, [step, goal, sex, age, h, w, activity, save]);

  const head = step === 1 ? ['ВАША ЦЕЛЬ', 'С чего начнём?', 'От этого зависит расчёт питания и рекомендации.']
    : step === 2 ? ['О ВАС', 'Рассчитаем ориентиры', 'Данные можно изменить позже в профиле.']
    : step === 3 ? ['АКТИВНОСТЬ', 'Как проходит ваша неделя?', 'Выберите наиболее близкий вариант.']
    : ['ПРЕДПОЧТЕНИЯ', 'Что исключить из меню?', 'Этот шаг можно пропустить.'];

  const field = {
    backgroundColor: p.inset, color: p.text, borderRadius: R.md,
    paddingHorizontal: S.lg, paddingVertical: 13, fontSize: 17, marginTop: 6,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: S.md,
        paddingHorizontal: S.lg, height: 44,
      }}>
        {step > 1 ? (
          <Pressable onPress={() => { haptic.tap(); setStep(s => s - 1); setErr(null); }} hitSlop={12}>
            <Icon name="back" size={22} color={p.accent} width={2.2} />
          </Pressable>
        ) : null}
        <Logo width={74} color={p.text} />
        <Text style={{ ...FONT.label, color: p.text3, marginLeft: 'auto' }}>{head[0]}</Text>
      </View>

      {/* Полоса шагов: человек должен видеть, что анкета короткая. */}
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: S.lg, paddingTop: S.sm }}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <View key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            backgroundColor: i < step ? p.primary : p.track,
          }} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: S.xl,
      }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View key={step} entering={FadeInRight.duration(220)} exiting={FadeOutLeft.duration(140)}>
          <Text style={{ ...FONT.h1, color: p.text }}>{head[1]}</Text>
          <Text style={{ ...FONT.body, color: p.text2, marginTop: 6, marginBottom: S.lg }}>
            {head[2]}
          </Text>

          {step === 1 ? GOALS.map(([value, label]) => (
            <Choice key={value} label={label} on={goal === value}
              onPress={() => { haptic.select(); setGoal(value); setErr(null); }} />
          )) : null}

          {step === 2 ? (
            <>
              <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
                {[['f', 'Женский'], ['m', 'Мужской']].map(([k, l]) => {
                  const on = sex === k;
                  return (
                    <Pressable key={k} onPress={() => { haptic.select(); setSex(k); setErr(null); }}
                      style={({ pressed }) => ({
                        flex: 1, paddingVertical: 12, borderRadius: R.control, alignItems: 'center',
                        backgroundColor: on ? p.primary : 'transparent',
                        borderWidth: on ? 0 : 1, borderColor: p.btnLine,
                        opacity: pressed && !on ? 0.6 : 1,
                      })}>
                      <Text style={{
                        fontSize: 15, fontWeight: on ? '600' : '400',
                        color: on ? p.onPrimary : p.text2,
                      }}>{l}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ ...FONT.caption, color: p.text3 }}>Возраст</Text>
              <TextInput value={age} onChangeText={t => { setAge(t.replace(/[^0-9]/g, '')); setErr(null); }}
                keyboardType="number-pad" maxLength={3} placeholder="32"
                placeholderTextColor={p.text3} style={field} />
              <Text style={{ ...FONT.caption, color: p.text3, marginTop: S.md }}>Рост, см</Text>
              <TextInput value={h} onChangeText={t => { setH(t.replace(/[^0-9]/g, '')); setErr(null); }}
                keyboardType="number-pad" maxLength={3} placeholder="170"
                placeholderTextColor={p.text3} style={field} />
              <Text style={{ ...FONT.caption, color: p.text3, marginTop: S.md }}>Вес, кг</Text>
              <TextInput value={w}
                onChangeText={t => { setW(t.replace(/[^0-9.,]/g, '').replace(',', '.')); setErr(null); }}
                keyboardType="decimal-pad" maxLength={5} placeholder="68"
                placeholderTextColor={p.text3} style={field} />
            </>
          ) : null}

          {step === 3 ? ACTIVITY.map(([value, label, note]) => (
            <Choice key={value} label={label} note={note} on={activity === value}
              onPress={() => { haptic.select(); setActivity(value); setErr(null); }} />
          )) : null}

          {step === 4 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {DISLIKES.map(x => {
                const on = dislikes.includes(x);
                return (
                  <Pressable key={x}
                    onPress={() => { haptic.select();
                      setDislikes(d => d.includes(x) ? d.filter(y => y !== x) : [...d, x]); }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 15, paddingVertical: 9, borderRadius: R.pill,
                      backgroundColor: on ? p.primary : 'transparent',
                      borderWidth: on ? 0 : 1, borderColor: p.btnLine,
                      opacity: pressed && !on ? 0.6 : 1,
                    })}>
                    <Text style={{
                      fontSize: 14, fontWeight: on ? '600' : '400',
                      color: on ? p.onPrimary : p.text2,
                    }}>{x}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {err ? (
            <Text style={{ ...FONT.small, color: p.danger, marginTop: S.lg }}>{err}</Text>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.md, gap: S.sm,
      }}>
        {busy ? <ActivityIndicator color={p.accent} style={{ marginBottom: S.sm }} /> : null}
        <SysButton label={step === TOTAL ? 'Сохранить анкету' : 'Далее'} variant="prominent"
          disabled={busy} onPress={next} />
        {step === TOTAL ? (
          <SysButton label="Пропустить ограничения" disabled={busy} onPress={() => save(true)} />
        ) : null}
        <Muted style={{ textAlign: 'center', marginTop: 2 }}>
          Данные нужны для персонализации и остаются в вашем профиле.
        </Muted>
      </View>
    </View>
  );
}

/** Вариант ответа: крупная строка с галочкой, а не радиокнопка. */
function Choice({ label, note, on, onPress }: {
  label: string; note?: string; on: boolean; onPress: () => void;
}) {
  const { p } = useApp();
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: S.md,
          paddingVertical: 14, paddingHorizontal: S.lg, marginBottom: S.sm,
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
}
