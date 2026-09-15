import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, Food, FoodMeal, FOOD_MEALS, MEAL_TIME } from '../api';
import { round, plural } from '../format';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { haptic } from '../haptics';

type Picked = { ingredient_id: number; name: string; grams: number;
  kcal: number; protein: number; fat: number; carbs: number };

const macros = (f: Food, g: number) => {
  const k = g / 100;
  const r = (v: number) => Math.round(v * k * 10) / 10;
  return { kcal: r(f.kcal), protein: r(f.protein), fat: r(f.fat), carbs: r(f.carbs) };
};
/** Сколько весит штука или порция — чтобы не набирать «60» для яйца руками. */
const stepOf = (f: Food) =>
  f.unit === 'pc' && f.piece_g ? { g: f.piece_g, label: '1 шт.' }
  : f.per_serving_g ? { g: f.per_serving_g, label: 'порция' }
  : null;

/**
 * «Съел своё» — запись приёма пищи набором продуктов.
 *
 * Экран идёт шагами внутри одного экрана, а не стопкой окон: человек
 * стоит у плиты с телефоном в одной руке, и каждое лишнее окно — это
 * ещё один способ потерять уже набранное.
 */
export default function FoodLog() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const { meal: mealParam } = useLocalSearchParams<{ meal?: string }>();

  /* Экран открывают из нужной секции дня, поэтому приём пищи уже
     выбран: человек нажал «Добавить еду» под «Обедом», а не вообще. */
  const [meal, setMeal] = useState<FoodMeal>(
    (FOOD_MEALS.find(m => m[0] === mealParam)?.[0]) ?? 'snack2');
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Food[] | null>(null);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [cart, setCart] = useState<Picked[]>([]);
  const [own, setOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* Ищем с задержкой: запрос на каждую букву — и нагрузка, и список,
     мигающий под пальцем. */
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const j = await api<{ foods: Food[] }>(`/client/foods?limit=30&q=${encodeURIComponent(q.trim())}`);
        if (alive) setFound(j.foods ?? []);
      } catch { if (alive) setFound([]); }
    }, q.trim() ? 220 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const open = useCallback((f: Food) => {
    haptic.tap();
    const st = stepOf(f);
    setGrams(String(round(st ? st.g : 100)));
    setPicked(f);
  }, []);

  const add = useCallback(() => {
    if (!picked) return;
    const g = Math.round(Number(grams.replace(',', '.')) || 0);
    if (!(g > 0 && g <= 5000)) { haptic.error(); setErr('Вес — от 1 до 5000 г'); return; }
    setCart(c => [...c, { ingredient_id: picked.id, name: picked.name, grams: g, ...macros(picked, g) }]);
    haptic.success(); setErr(null); setPicked(null);
  }, [picked, grams]);

  const save = useCallback(async () => {
    if (!cart.length || busy) return;
    setBusy(true); setErr(null);
    try {
      await api('/client/food-log', { method: 'POST', body: {
        meal, items: cart.map(c => ({ ingredient_id: c.ingredient_id, grams: c.grams })) } });
      haptic.success();
      router.back();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не сохранилось'); }
    finally { setBusy(false); }
  }, [cart, meal, busy]);

  const total = useMemo(() => cart.reduce((s, c) => s + c.kcal, 0), [cart]);

  /* ---------- Шаг «сколько граммов» ---------- */
  if (picked) {
    const g = Number(grams.replace(',', '.')) || 0;
    const m = macros(picked, g);
    const st = stepOf(picked);
    const quick = st ? [1, 2, 3].map(n => ({ g: round(st.g * n), label: `${n} × ${st.label}` }))
                     : [50, 100, 150, 200].map(n => ({ g: n, label: `${n} г` }));
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar title={picked.name} back onBack={() => setPicked(null)} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32, gap: S.md }}
          keyboardShouldPersistTaps="handled">
          <Muted style={{ marginTop: S.sm }}>
            {round(picked.kcal)} ккал · Б {picked.protein} Ж {picked.fat} У {picked.carbs} / 100 г
          </Muted>
          <View>
            <Label>Сколько, граммов</Label>
            <TextInput value={grams} onChangeText={t => { setGrams(t); setErr(null); }}
              keyboardType="number-pad" selectTextOnFocus
              style={{ marginTop: S.sm, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
                paddingHorizontal: S.lg, paddingVertical: 13, fontSize: 19, fontWeight: '700' }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
            {quick.map(x => (
              <Pressable key={x.label} onPress={() => { haptic.select(); setGrams(String(x.g)); }}
                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill,
                  backgroundColor: p.surface, borderWidth: 1, borderColor: p.border }}>
                <Text style={{ ...FONT.body, color: p.text2 }}>{x.label}</Text>
              </Pressable>
            ))}
          </View>
          <Card style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.md }}>
            <Text style={{ fontSize: 21, fontWeight: '800', color: p.text }}>{round(m.kcal)} ккал</Text>
            <Muted>Б {m.protein} · Ж {m.fat} · У {m.carbs}</Muted>
          </Card>
          {err ? <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text> : null}
          <SysButton label="Добавить" variant="prominent" onPress={add} />
        </ScrollView>
      </View>
    );
  }

  /* ---------- Шаг «свой продукт» ---------- */
  if (own) return <OwnFood onDone={f => { setOwn(false); setFound([f]); open(f); }}
                           onCancel={() => setOwn(false)} initial={q.trim()} />;

  /* ---------- Шаг «поиск» ---------- */
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Съел своё" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.md }}>
          {FOOD_MEALS.map(([v, t]) => {
            const on = v === meal;
            return (
              <Pressable key={v} onPress={() => { haptic.select(); setMeal(v); }}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill,
                  alignItems: 'flex-start',
                  backgroundColor: on ? p.primary : p.surface,
                  borderWidth: on ? 0 : 1, borderColor: p.border }}>
                <Text style={{ ...FONT.body, fontWeight: on ? '600' : '400',
                  color: on ? p.onPrimary : p.text2 }}>{t}</Text>
                <Text style={{ fontSize: 10.5, opacity: 0.7,
                  color: on ? p.onPrimary : p.text3 }}>{MEAL_TIME[v]}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.md,
          backgroundColor: p.surface, borderRadius: R.pill, paddingHorizontal: S.lg }}>
          <Icon name="search" size={16} color={p.text3} />
          <TextInput value={q} onChangeText={setQ} placeholder="Свёкла, йогурт, гречка"
            placeholderTextColor={p.text3} autoCorrect={false}
            style={{ flex: 1, color: p.text, paddingVertical: 11, fontSize: 15 }} />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={10}>
              <Icon name="close" size={16} color={p.text3} />
            </Pressable>
          ) : null}
        </View>

        {found === null ? (
          <ActivityIndicator color={p.accent} style={{ marginTop: S.xl }} />
        ) : found.length === 0 ? (
          <View style={{ gap: S.md, marginTop: S.lg, alignItems: 'flex-start' }}>
            <Muted>{q.trim() ? 'Такого продукта нет в справочнике.' : 'Начните вводить название.'}</Muted>
            {q.trim() ? <SysButton label="Добавить свой продукт" onPress={() => setOwn(true)} /> : null}
          </View>
        ) : (
          <View style={{ marginTop: S.sm }}>
            {found.map((f, i) => (
              <Animated.View key={f.id} entering={FadeInDown.delay(Math.min(i, 8) * 20).duration(180)}>
                <Pressable onPress={() => open(f)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: S.md,
                    minHeight: 52, paddingVertical: 10,
                    borderBottomWidth: 1, borderBottomColor: p.border,
                    opacity: pressed ? 0.7 : 1 })}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ ...FONT.body, fontWeight: '600', color: p.text }}>{f.name}</Text>
                    <Muted style={{ marginTop: 2 }}>
                      {round(f.kcal)} ккал · Б {f.protein} Ж {f.fat} У {f.carbs} / 100 г
                    </Muted>
                  </View>
                  <Icon name="plus" size={18} color={p.accent} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}

        {cart.length ? (
          <View style={{ marginTop: S.lg }}>
            <Label>Съедено</Label>
            <Card style={{ marginTop: S.sm, padding: 0 }}>
              {cart.map((c, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md,
                  padding: S.lg, borderTopWidth: i ? 1 : 0, borderTopColor: p.border }}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ ...FONT.body, fontWeight: '600', color: p.text }}>{c.name}</Text>
                    <Muted style={{ marginTop: 1 }}>{round(c.grams)} г · {round(c.kcal)} ккал</Muted>
                  </View>
                  <Pressable hitSlop={10} onPress={() => { haptic.tap(); setCart(x => x.filter((_, k) => k !== i)); }}>
                    <Icon name="close" size={17} color={p.text3} />
                  </Pressable>
                </View>
              ))}
            </Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'baseline', marginTop: S.md }}>
              <Muted>{cart.length} {plural(cart.length, ['продукт', 'продукта', 'продуктов'])}</Muted>
              <Text style={{ fontSize: 18, fontWeight: '800', color: p.text }}>{round(total)} ккал</Text>
            </View>
            {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.sm }}>{err}</Text> : null}
            <View style={{ marginTop: S.md }}>
              <SysButton label="Сохранить" variant="prominent" disabled={busy} onPress={save} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Своего продукта нет в справочнике — заводим по упаковке. */
function OwnFood({ initial, onDone, onCancel }: {
  initial: string; onDone: (f: Food) => void; onCancel: () => void;
}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initial);
  const [kcal, setKcal] = useState('');
  const [prot, setProt] = useState('');
  const [fat, setFat] = useState('');
  const [carb, setCarb] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const num = (v: string) => Number(v.replace(',', '.')) || 0;
  const save = useCallback(async () => {
    if (!name.trim()) { setErr('Как называется продукт?'); return; }
    setBusy(true); setErr(null);
    try {
      const j = await api<{ food: Food }>('/client/foods', { method: 'POST', body: {
        name: name.trim(), kcal: num(kcal), protein: num(prot), fat: num(fat), carbs: num(carb) } });
      haptic.success(); onDone(j.food);
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не добавилось'); }
    finally { setBusy(false); }
  }, [name, kcal, prot, fat, carb, onDone]);

  const field = (label: string, v: string, set: (s: string) => void, numeric = true) => (
    <View style={{ flex: numeric ? 1 : undefined }}>
      <Label>{label}</Label>
      <TextInput value={v} onChangeText={t => { set(t); setErr(null); }}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        style={{ marginTop: 6, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
          paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Свой продукт" back onBack={onCancel} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32, gap: S.md }}
        keyboardShouldPersistTaps="handled">
        <Muted style={{ marginTop: S.sm }}>
          Значения указывайте на 100 г — так они написаны на этикетке.
        </Muted>
        {field('Название', name, setName, false)}
        <View style={{ flexDirection: 'row', gap: S.md }}>
          {field('Ккал', kcal, setKcal)}
          {field('Белки, г', prot, setProt)}
        </View>
        <View style={{ flexDirection: 'row', gap: S.md }}>
          {field('Жиры, г', fat, setFat)}
          {field('Углеводы, г', carb, setCarb)}
        </View>
        {err ? <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text> : null}
        <SysButton label="Добавить в справочник" variant="prominent" disabled={busy} onPress={save} />
      </ScrollView>
    </View>
  );
}
