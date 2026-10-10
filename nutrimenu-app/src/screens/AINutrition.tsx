/**
 * Анкета питания для EQUA AI.
 *
 * Без неё подписку не оформить: сервер отвечает «Сначала ответьте на
 * вопросы о питании» и не собирает меню. В приложении анкеты не было —
 * человек упирался в браузер на шаге, с которого начинается весь план.
 *
 * Десять вопросов по одному на экран, те же, что в вебе. По одному — не
 * ради красоты: это длинная анкета о себе, и форма из десяти полей
 * подряд на телефоне читается как работа, а не как разговор.
 *
 * Черновик держим на устройстве: анкету заполняют в метро, с перерывами,
 * и потерять её на восьмом вопросе из-за свёрнутого приложения — верный
 * способ не получить ответов вовсе.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

type QType = 'choice' | 'text' | 'textOrNo';
interface Q {
  key: string; title: string; sub: string; type: QType;
  opts?: [string | number, string, string?][];
  placeholder?: string;
  /** Вопрос о здоровье — к нему своя оговорка. */
  health?: boolean;
}

/* Вопросы и варианты — ровно те, что в вебе: сервер сопоставляет ответы
   по ключам, а значения цели и формата питания хранит как есть. */
const QS: Q[] = [
  { key: 'diet', title: 'Какой формат питания вам подходит?', sub: 'Выберите один вариант.',
    type: 'choice', opts: [
      ['omnivore', 'Обычное', 'Ем мясо, рыбу и другие продукты'],
      ['vegetarian', 'Вегетарианское', 'Без мяса и рыбы'],
      ['pescatarian', 'Рыба и морепродукты', 'Без мяса, но с рыбой'],
      ['vegan', 'Веганское', 'Только растительные продукты'],
    ] },
  { key: 'meals_per_day', title: 'Сколько приёмов пищи вам удобно?',
    sub: 'Мы распределим дневной рацион под этот ритм.', type: 'choice', opts: [
      [3, '3 приёма', 'Простой базовый режим'],
      [4, '4 приёма', 'С дополнительным перекусом'],
      [5, '5 приёмов', 'Небольшими порциями чаще'],
    ] },
  { key: 'cooking_minutes', title: 'Сколько времени готовы тратить на готовку?',
    sub: 'Это повлияет на сложность рецептов.', type: 'choice', opts: [
      [15, 'До 15 минут', 'Максимально быстро'],
      [30, 'До 30 минут', 'Оптимальный вариант'],
      [60, 'До часа', 'Можно готовить сложнее'],
    ] },
  { key: 'goal', title: 'Какая у вас главная цель?', sub: 'Выберите то, что сейчас важнее всего.',
    type: 'choice', opts: [
      ['Снизить вес', 'Снизить вес', 'С дефицитом без жёстких ограничений'],
      ['Сохранить вес', 'Сохранить вес', 'Поддерживать текущую форму'],
      ['Набрать вес', 'Набрать вес', 'Сбалансированно увеличить рацион'],
      ['Наладить питание', 'Наладить питание', 'Режим, качество и устойчивые привычки'],
    ] },
  { key: 'allergies', title: 'Есть аллергии или непереносимости?',
    sub: 'Если нет — просто выберите «Нет».', type: 'textOrNo',
    placeholder: 'Например: арахис, лактоза' },
  { key: 'excluded', title: 'Что точно исключить из меню?',
    sub: 'Продукты, которые вы не едите по любой причине.', type: 'textOrNo',
    placeholder: 'Например: свинина, грибы' },
  { key: 'likes', title: 'Что любите, а что не хотите видеть?',
    sub: 'Напишите коротко — например: люблю рыбу и сырники; не люблю брокколи.',
    type: 'text', placeholder: 'Люблю: …  Не люблю: …' },
  { key: 'schedule', title: 'Расскажите про ваш обычный день',
    sub: 'Нам нужны ориентиры, чтобы правильно поставить приёмы пищи.',
    type: 'text', placeholder: 'Например: подъём 7:00, работа 9–18, сон 23:30' },
  { key: 'must_have', title: 'Что обязательно оставить в рационе?',
    sub: 'Не будем строить план вокруг запретов.', type: 'textOrNo',
    placeholder: 'Например: кофе утром, десерт по выходным' },
  { key: 'health_notes', title: 'Есть другие важные ограничения?',
    sub: 'Напишите только то, что нужно учесть при составлении меню.',
    type: 'textOrNo', placeholder: 'Например: не могу есть острое', health: true },
];

const DRAFT = 'nm_ai_nut_draft';

export default function AINutrition() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ plan?: string }>();
  const plan = params.plan ?? 'nutrition';

  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* Черновик читаем один раз при входе. */
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

  const keep = useCallback((next: Record<string, string>, nextStep: number) => {
    AsyncStorage.setItem(DRAFT, JSON.stringify({ data: next, step: nextStep })).catch(() => {});
  }, []);

  const q = QS[step];
  const value = data[q.key] ?? '';
  const last = step === QS.length - 1;

  const set = useCallback((v: string) => {
    setData(prev => {
      const next = { ...prev, [q.key]: v };
      keep(next, step);
      return next;
    });
    setErr(null);
  }, [q.key, step, keep]);

  const send = useCallback(async (answers: Record<string, string>) => {
    setBusy(true); setErr(null);
    try {
      await api('/client/ai/nutrition', { method: 'POST', body: answers });
      haptic.success();
      await AsyncStorage.removeItem(DRAFT).catch(() => {});
      /* Не возвращаем человека к каталогу наборов. Для полного плана
         сразу продолжаем анкетой тренировок, для питания — AI-разбором. */
      if (plan === 'both') {
        router.replace({ pathname: '/ai-fitness', params: { plan } });
      } else {
        router.replace({ pathname: '/ai-intake', params: { plan } });
      }
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Анкета не сохранилась');
    } finally { setBusy(false); }
  }, [plan]);

  const next = useCallback(() => {
    /* Пустым можно оставить только то, что спрашивают словами: выбор из
       вариантов — это и есть расчёт, без него меню не собрать. */
    if (q.type === 'choice' && !value) {
      haptic.error(); setErr('Выберите вариант'); return;
    }
    if (!last) { haptic.tap(); setStep(s => { keep(data, s + 1); return s + 1; }); return; }
    send(data);
  }, [q.type, value, last, data, keep, send]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.accent} />
      </View>
    );
  }

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
        <Text style={{ ...FONT.label, color: p.text3 }}>EQUA AI · ПИТАНИЕ</Text>
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

          {q.type === 'choice' ? q.opts!.map(([v, label, note]) => {
            const on = String(value) === String(v);
            return (
              <Pressable key={String(v)} onPress={() => { haptic.select(); set(String(v)); }}>
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
                      backgroundColor: value.toLowerCase() === 'нет' ? p.primary : 'transparent',
                      borderWidth: value.toLowerCase() === 'нет' ? 0 : 1, borderColor: p.btnLine,
                      opacity: pressed ? 0.7 : 1,
                    })}>
                    <Text style={{
                      fontSize: 15, fontWeight: value.toLowerCase() === 'нет' ? '600' : '400',
                      color: value.toLowerCase() === 'нет' ? p.onPrimary : p.text2,
                    }}>Нет</Text>
                  </Pressable>
                  <Muted>или напишите</Muted>
                </View>
              ) : null}
              <TextInput
                value={value.toLowerCase() === 'нет' ? '' : value}
                onChangeText={set}
                multiline maxLength={500}
                placeholder={q.placeholder ?? 'Ответьте своими словами'}
                placeholderTextColor={p.text3}
                style={{
                  backgroundColor: p.inset, color: p.text, borderRadius: R.md,
                  paddingHorizontal: S.lg, paddingTop: 12, paddingBottom: 12,
                  fontSize: 16, minHeight: 104, textAlignVertical: 'top',
                }} />
              {q.health ? (
                <Muted style={{ marginTop: S.md, lineHeight: 18 }}>
                  При заболеваниях план питания должен согласовать врач: EQUA AI
                  не ставит диагнозов и не назначает лечение.
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
        {q.type !== 'choice' && !value ? (
          <Muted style={{ textAlign: 'center' }}>
            Можно пропустить — ответ не обязателен
          </Muted>
        ) : null}
      </View>
    </View>
  );
}