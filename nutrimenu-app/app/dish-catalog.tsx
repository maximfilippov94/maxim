import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useApp } from '../src/store';
import { api, Dish, FoodMeal, FOOD_MEALS, TodayResponse, MEAL_TITLES } from '../src/api';
import { round } from '../src/format';
import { S, R, FONT } from '../src/theme';
import { NavBar } from '../src/ui/NavBar';
import { Card, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton } from '../src/ui/system';
import { haptic } from '../src/haptics';
import { mediaUrl } from '../src/api';

type CatalogDish = Pick<Dish, 'id' | 'name' | 'photo_url' | 'photo_thumb_url' | 'base_portion_g'
  | 'kcal_100' | 'protein_100' | 'fat_100' | 'carbs_100'>;

export default function DishCatalog() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ meal?: string }>();
  const meal = (FOOD_MEALS.find(([key]) => key === params.meal)?.[0] ?? 'snack2') as FoodMeal;
  const [q, setQ] = useState('');
  const [dishes, setDishes] = useState<CatalogDish[] | null>(null);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [picked, setPicked] = useState<CatalogDish | null>(null);
  const [grams, setGrams] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadToday = useCallback(() => {
    api<TodayResponse>('/client/today', { noCache: true }).then(setToday).catch(() => setToday(null));
  }, []);
  useEffect(() => { loadToday(); }, [loadToday]);

  useEffect(() => {
    let alive = true;
    setDishes(null); setErr(null);
    const t = setTimeout(() => {
      api<{ dishes: CatalogDish[] }>(`/client/dish-catalog?q=${encodeURIComponent(q.trim())}`, { noCache: true })
        .then(r => { if (alive) setDishes(r.dishes ?? []); })
        .catch((e: any) => { if (alive) { setDishes([]); setErr(e?.message ?? 'Не удалось загрузить каталог'); } });
    }, q.trim() ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const targets = useMemo(() => (today?.items ?? [])
    .filter(item => item.meal_type === meal && !item.hidden), [today, meal]);
  const choose = (dish: CatalogDish) => {
    haptic.tap(); setPicked(dish); setGrams(String(round(dish.base_portion_g || 100))); setErr(null);
  };

  const save = async (target?: { id: number; dish_name: string }) => {
    if (!picked || busy) return;
    const g = Math.round(Number(grams.replace(',', '.')) || 0);
    if (!(g > 0 && g <= 5000)) { setErr('Порция должна быть от 1 до 5000 г'); haptic.error(); return; }
    setBusy(true); setErr(null);
    try {
      if (target) {
        await api(`/client/dish-catalog/${picked.id}/replace`, {
          method: 'POST', body: { menu_item_id: target.id, grams: g, meal },
        });
      } else {
        await api(`/client/dish-catalog/${picked.id}/log`, {
          method: 'POST', body: { grams: g, meal },
        });
      }
      haptic.success(); router.back();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось сохранить блюдо'); }
    finally { setBusy(false); }
  };

  const confirmReplace = (target: typeof targets[number]) => {
    Alert.alert('Заменить блюдо?', `«${target.dish_name}» будет заменено на «${picked?.name}». Выбор также повлияет на будущие меню EQUA AI.`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Заменить', onPress: () => { void save(target); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={picked ? picked.name : 'Каталог блюд'} back onBack={picked ? () => setPicked(null) : undefined} />
      {picked ? (
        <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + 36, gap: S.md }} keyboardShouldPersistTaps="handled">
          <Muted>{MEAL_TITLES[meal]} · КБЖУ на 100 г: {round(picked.kcal_100)} ккал · Б {round(picked.protein_100)} · Ж {round(picked.fat_100)} · У {round(picked.carbs_100)}</Muted>
          <Text style={{ ...FONT.small, color: p.text2 }}>Порция, граммов</Text>
          <TextInput value={grams} onChangeText={setGrams} keyboardType="number-pad" selectTextOnFocus
            style={{ backgroundColor: p.inset, color: p.text, borderRadius: R.md, padding: S.lg, fontSize: 18 }} />
          {targets.length > 0 ? (
            <>
              <Text style={{ ...FONT.h2, color: p.text, marginTop: S.sm }}>В плане на этот приём уже есть блюдо</Text>
              <Muted>Можно записать блюдо отдельно или заменить назначенное. Перед заменой попросим подтвердить действие.</Muted>
              {targets.map(target => (
                <SysButton key={target.id} label={`Заменить «${target.dish_name}»`} onPress={() => confirmReplace(target)} />
              ))}
              <SysButton label="Добавить отдельно в дневник" variant="prominent" onPress={() => { void save(); }} />
            </>
          ) : <SysButton label="Добавить в дневник" variant="prominent" onPress={() => { void save(); }} />}
          {err ? <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text> : null}
          {busy ? <ActivityIndicator color={p.accent} /> : null}
        </ScrollView>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginHorizontal: S.lg, marginTop: S.sm,
            paddingHorizontal: S.md, borderRadius: R.pill, backgroundColor: p.surface }}>
            <Icon name="search" size={16} color={p.text3} />
            <TextInput value={q} onChangeText={setQ} placeholder="Найти блюдо" placeholderTextColor={p.text3}
              style={{ flex: 1, color: p.text, paddingVertical: 12, fontSize: 15 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
            {dishes === null ? <ActivityIndicator color={p.accent} style={{ marginTop: S.xl }} />
              : err ? <Muted>{err}</Muted>
              : dishes.length === 0 ? <Muted>{q ? 'Ничего не найдено.' : 'Каталог пока пуст.'}</Muted>
              : dishes.map(dish => (
                <Pressable key={dish.id} onPress={() => choose(dish)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.sm }}>
                    {dish.photo_thumb_url || dish.photo_url ? <Image source={{ uri: mediaUrl(dish.photo_thumb_url || dish.photo_url) || undefined }} style={{ width: 58, height: 58, borderRadius: R.md }} contentFit="cover" /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...FONT.body, fontWeight: '600', color: p.text }}>{dish.name}</Text>
                      <Muted style={{ marginTop: 4 }}>{round(dish.kcal_100)} ккал · Б {round(dish.protein_100)} Ж {round(dish.fat_100)} У {round(dish.carbs_100)} / 100 г</Muted>
                    </View>
                    <Icon name="chevr" size={15} color={p.text3} />
                  </Card>
                </Pressable>
              ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}
