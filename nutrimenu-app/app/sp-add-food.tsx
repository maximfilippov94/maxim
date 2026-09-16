/**
 * Назначение продукта в меню — в два шага.
 *
 * Не всё в меню рецепт: «150 г индейки» или банан на перекус — это
 * продукт, а не блюдо. Раньше специалисту приходилось заводить блюдо
 * из одного ингредиента руками, и база блюд обрастала записями вроде
 * «Банан», которые никто не готовит.
 *
 * Сначала поиск по справочнику, потом граммовка: видно, сколько выйдет
 * ккал и БЖУ именно в этой порции. Под капотом сервер сам заводит
 * блюдо-однокомпонентник — позиция меню умеет ссылаться только на
 * блюдо, — но специалисту этого знать не нужно.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { api, Food, MEAL_TITLES, MealKey } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { useApp } from '../src/store';
import { Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { Empty, SysButton } from '../src/ui/system';
import { NavBar } from '../src/ui/NavBar';
import { round, dayTitle } from '../src/format';
import { haptic } from '../src/haptics';

/** КБЖУ продукта в заданной граммовке. */
const macros = (f: Food, g: number) => {
  const k = g / 100;
  return {
    kcal: Math.round(f.kcal * k * 10) / 10,
    protein: Math.round(f.protein * k * 10) / 10,
    fat: Math.round(f.fat * k * 10) / 10,
    carbs: Math.round(f.carbs * k * 10) / 10,
  };
};

export default function SpAddFood() {
  const { p } = useApp();
  const { menu, day, meal, start } = useLocalSearchParams<{
    menu?: string; day?: string; meal?: string; start?: string;
  }>();
  const menuId = Number(menu ?? 0);
  const dayNo = Number(day ?? 1);
  const mealKey = (meal ?? 'lunch') as MealKey;

  const [q, setQ] = useState('');
  const [found, setFound] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  /* Ищем с задержкой: запрос на каждую букву — это и лишняя нагрузка,
     и мигающий список под пальцем. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const wait = q.trim() ? 220 : 0;
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const j = await api<{ ingredients: Food[] }>(
          `/specialist/ingredients?limit=40&q=${encodeURIComponent(q.trim())}`);
        setFound(j.ingredients ?? []);
      } catch { setFound([]); }
      setLoading(false);
    }, wait);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const g = Math.max(0, Number(grams) || 0);
  const m = useMemo(() => (picked ? macros(picked, g) : null), [picked, g]);

  const add = async () => {
    if (!picked || busy) return;
    if (!(g > 0 && g <= 5000)) { setErr('Вес — от 1 до 5000 г'); return; }
    setBusy(true); setErr('');
    try {
      await api(`/specialist/menus/${menuId}/items`, {
        method: 'POST',
        body: { day_number: dayNo, meal_type: mealKey, ingredient_id: picked.id, portion_g: g },
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? 'Не удалось добавить');
      setBusy(false);
    }
  };

  /* ---------- Шаг «граммовка» ---------- */
  if (picked) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar title="Сколько положить" back onBack={() => setPicked(null)} />
        <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.md }}
          keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeIn.duration(200)}>
            <Text style={{ ...FONT.h2, color: p.text }}>{picked.name}</Text>
            <Muted>
              {round(picked.kcal)} ккал · Б {picked.protein} Ж {picked.fat} У {picked.carbs} / 100 г
            </Muted>
          </Animated.View>

          <View>
            <Text style={{ ...FONT.small, color: p.text3, marginBottom: 6 }}>Сколько, граммов</Text>
            <TextInput
              value={grams} onChangeText={setGrams}
              keyboardType="number-pad" selectTextOnFocus
              style={{
                ...FONT.body, color: p.text, backgroundColor: p.surface,
                borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 14,
                borderWidth: 1, borderColor: p.border,
              }} />
          </View>

          <View style={{ flexDirection: 'row', gap: S.sm }}>
            {[50, 100, 150, 200].map(v => (
              <Pressable key={v} onPress={() => { haptic.select(); setGrams(String(v)); }}
                style={({ pressed }) => ({
                  flex: 1, alignItems: 'center', paddingVertical: 10,
                  borderRadius: R.md, backgroundColor: p.surface,
                  borderWidth: 1, borderColor: p.border, opacity: pressed ? 0.7 : 1,
                })}>
                <Text style={{ ...FONT.small, color: p.text2 }}>{v} г</Text>
              </Pressable>
            ))}
          </View>

          {m ? (
            <View style={{ backgroundColor: p.surface, borderRadius: R.md, padding: S.lg }}>
              <Text style={{ ...FONT.num, color: p.text }}>{round(m.kcal)} ккал</Text>
              <Muted>Б {m.protein} · Ж {m.fat} · У {m.carbs}</Muted>
            </View>
          ) : null}

          {err ? <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text> : null}

          <SysButton label={`Добавить в ${MEAL_TITLES[mealKey].toLowerCase()}`}
            variant="prominent" disabled={busy} onPress={add} />
          {start ? <Muted>{dayTitle(String(start), dayNo, true)}</Muted> : null}
        </ScrollView>
      </View>
    );
  }

  /* ---------- Шаг «поиск» ---------- */
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={`Продукт · ${MEAL_TITLES[mealKey]}`} back />
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: S.sm,
          backgroundColor: p.surface, borderRadius: R.pill, paddingHorizontal: S.lg,
        }}>
          <Icon name="search" size={16} color={p.text3} />
          <TextInput value={q} onChangeText={setQ} placeholder="Найти продукт"
            placeholderTextColor={p.text3} autoCorrect={false}
            style={{ ...FONT.body, color: p.text, flex: 1, paddingVertical: 12 }} />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: S.xl }} color={p.primary} />
        ) : found.length === 0 ? (
          <Empty icon="magnifyingglass" title="Ничего не нашлось"
            note={q.trim() ? 'Попробуйте другое название.' : 'Начните вводить название.'} />
        ) : (
          <View style={{ marginTop: S.md }}>
            {found.map((f, i) => (
              <Animated.View key={f.id} entering={FadeInDown.delay(Math.min(i, 8) * 24).duration(220)}>
                <Pressable onPress={() => {
                  haptic.tap();
                  setGrams(String(round(f.per_serving_g) || 100));
                  setPicked(f);
                }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: S.md,
                    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.border,
                    opacity: pressed ? 0.6 : 1,
                  })}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ ...FONT.body, fontWeight: '600', color: p.text }}>{f.name}</Text>
                    <Muted>
                      {round(f.kcal)} ккал · Б {f.protein} Ж {f.fat} У {f.carbs} / 100 г
                    </Muted>
                  </View>
                  <Icon name="plus" size={16} color={p.primary} width={2.4} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
