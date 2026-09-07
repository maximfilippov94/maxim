import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { Image } from 'expo-image';
import {
  api, mediaUrl, Dish, MEAL_TITLES, MEAL_KEYS, MealKey, dishMeals,
} from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Muted, Pills } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Empty } from '../../ui/system';
import { round, plural } from '../../format';
import { haptic } from '../../haptics';
import { Loading, Fail } from '../Shopping';

/** «Обед · Ужин» из поля meal_types, которое хранится строкой JSON. */
const meals = (v?: string | null) => {
  if (!v) return '';
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a.map((k: string) => MEAL_TITLES[k] ?? k).join(' · ') : '';
  } catch { return ''; }
};

type Scope = 'all' | 'mine' | 'public';
const SCOPES: [Scope, string][] = [
  ['all', 'Все'], ['mine', 'Свои'], ['public', 'Общие'],
];

type MealTab = MealKey | 'all';
const MEAL_TABS: [MealTab, string][] = [['all', 'Все приёмы'], ...MEAL_KEYS];
/** Блюдо без приёма — обычно недозаполненная карточка; такие в конец. */
const NO_MEAL = 'Без приёма';

export default function SpDishes() {
  const { p, me } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<Dish[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [meal, setMeal] = useState<MealTab>('all');

  /* Перечитываем при каждом возвращении с редактора: иначе только что
     заведённое блюдо не появится, пока не переоткроешь экран. */
  useFocusEffect(React.useCallback(() => {
    api<{ dishes: Dish[] }>('/specialist/dishes')
      .then(r => setList(r.dishes ?? []))
      .catch(e => setErr(e.message));
  }, []));

  const my = me?.user?.id;
  const mine = useMemo(() => (list ?? []).filter(d => d.created_by === my), [list, my]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list ?? [])
      .filter(d => scope === 'all'
        || (scope === 'mine' ? d.created_by === my : d.created_by !== my))
      .filter(d => meal === 'all' || dishMeals(d).includes(meal))
      .filter(d => !s || d.name.toLowerCase().includes(s))
      /* Числа в названиях сравниваем как числа: иначе «№100» встаёт
         между «№10» и «№11», и список выглядит перепутанным. */
      .sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }));
  }, [list, q, scope, meal, my]);

  /* Когда приём не выбран, раскладываем по приёмам с подзаголовками:
     каталог в сотню блюд одним списком листать бессмысленно. Блюдо
     попадает в раздел первого своего приёма — иначе оно двоилось бы. */
  const sections = useMemo(() => {
    if (meal !== 'all') return [{ title: '', items: shown }];
    const by = new Map<string, Dish[]>();
    for (const d of shown) {
      const ms = dishMeals(d);
      const title = ms.length
        ? (MEAL_KEYS.find(([k]) => k === ms[0])?.[1] ?? NO_MEAL)
        : NO_MEAL;
      (by.get(title) ?? by.set(title, []).get(title)!).push(d);
    }
    return [...MEAL_KEYS.map(([, l]) => l), NO_MEAL]
      .filter(t => by.has(t))
      .map(title => ({ title, items: by.get(title)! }));
  }, [shown, meal]);

  if (err) return <Fail title="База блюд" text={err} />;
  if (!list) return <Loading title="База блюд" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="База блюд" back
        right={
          <Pressable onPress={() => { haptic.tap(); router.push('/sp-dish-edit'); }} hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Icon name="plus" size={21} color={p.primary} width={2.2} />
          </Pressable>
        } />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
      }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <Pills items={SCOPES} value={scope} onChange={setScope}
          style={{ marginTop: S.md }} />
        <Pills items={MEAL_TABS} value={meal} onChange={setMeal} scroll
          style={{ marginTop: S.sm, marginHorizontal: -S.lg, paddingHorizontal: S.lg }} />

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: S.sm,
          backgroundColor: p.surface, borderRadius: R.md, paddingHorizontal: S.lg,
          borderWidth: 1, borderColor: p.borderSoft, marginTop: S.md, marginBottom: S.md,
        }}>
          <Icon name="bowl" size={17} color={p.text3} />
          <TextInput value={q} onChangeText={setQ}
            placeholder="Название блюда" placeholderTextColor={p.text3}
            style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: p.text }} />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={10}>
              <Icon name="close" size={15} color={p.text3} />
            </Pressable>
          ) : null}
        </View>

        {/* Сколько блюд со снимком — сразу видно, доехали ли фотографии
            на сервер: имя файла легко перепутать, а молчаливый прочерк
            в карточке об этом не скажет. */}
        <Muted style={{ marginBottom: S.md }}>
          {shown.length} {plural(shown.length, ['блюдо', 'блюда', 'блюд'])} ·
          {' '}своих {mine.length} · с фото {shown.filter(d => d.photo_url).length}
        </Muted>

        {shown.length === 0 ? (
          <Empty icon="fork.knife"
            title={scope === 'mine' && !q ? 'Своих блюд пока нет' : 'Ничего не нашли'}
            note={scope === 'mine' && !q
              ? 'Кнопка «плюс» сверху заведёт первое — оно будет видно только вам.'
              : 'Проверьте название или заведите своё блюдо кнопкой «плюс».'} />
        ) : sections.map(sec => (
          <View key={sec.title || 'all'}>
            {sec.title ? (
              <Text style={{ ...FONT.h3, color: p.text2, marginTop: S.xs, marginBottom: S.sm }}>
                {sec.title}
              </Text>
            ) : null}
            {sec.items.map((d, i) => (
              <DishRow key={d.id} dish={d} index={i} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Строка каталога: снимок, название, калорийность базовой порции. */
function DishRow({ dish: d, index }: { dish: Dish; index: number }) {
  const { p } = useApp();
  const portion = d.base_portion_g || 250;
  const photo = mediaUrl(d.photo_url);
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 20).duration(200)}>
      <Pressable onPress={() => { haptic.tap(); router.push(`/sp-dish-edit?id=${d.id}`); }}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Card style={{ marginBottom: S.sm, flexDirection: 'row', gap: S.md }}>
          <View style={{
            width: 56, height: 56, borderRadius: R.md, backgroundColor: p.inset,
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {/* Значок под снимком: пока фото едет или если оно не
                открылось, квадрат не остаётся пустым. */}
            <Icon name="bowl" size={20} color={p.text3} />
            {photo ? (
              <Image source={{ uri: photo }}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                contentFit="cover" transition={200} cachePolicy="memory-disk" />
            ) : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
              <Text style={{ ...FONT.h3, color: p.text, flex: 1 }} numberOfLines={1}>
                {d.name}
              </Text>
              <Text style={{ ...FONT.h3, color: p.text }}>
                {round(d.kcal_100 * portion / 100)}
              </Text>
              <Muted>ккал</Muted>
            </View>
            <Muted style={{ marginTop: 3 }} numberOfLines={1}>
              {[`${round(portion)} г`, meals(d.meal_types),
                d.cook_minutes ? `${d.cook_minutes} мин` : null].filter(Boolean).join(' · ')}
            </Muted>
            <Muted style={{ marginTop: 2 }}>
              На 100 г: Б {round(d.protein_100)} · Ж {round(d.fat_100)} · У {round(d.carbs_100)}
            </Muted>
          </View>
        </Card>
      </Pressable>
    </Animated.View>
  );
}
