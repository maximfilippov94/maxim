import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api, Dish, MEAL_TITLES } from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Empty } from '../../ui/system';
import { round, plural } from '../../format';
import { Loading, Fail } from '../Shopping';

/** «Обед · Ужин» из поля meal_types, которое хранится строкой JSON. */
const meals = (v?: string | null) => {
  if (!v) return '';
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a.map((k: string) => MEAL_TITLES[k] ?? k).join(' · ') : '';
  } catch { return ''; }
};

export default function SpDishes() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<Dish[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api<{ dishes: Dish[] }>('/specialist/dishes')
      .then(r => setList(r.dishes ?? []))
      .catch(e => setErr(e.message));
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list ?? []).filter(d => !s || d.name.toLowerCase().includes(s));
  }, [list, q]);

  if (err) return <Fail title="База блюд" text={err} />;
  if (!list) return <Loading title="База блюд" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="База блюд" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
      }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

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

        <Muted style={{ marginBottom: S.md }}>
          {list.length} {plural(list.length, ['блюдо', 'блюда', 'блюд'])} в каталоге
        </Muted>

        {shown.length === 0 ? (
          <Empty icon="fork.knife" title="Ничего не нашли"
            note="Проверьте название или добавьте блюдо в браузере." />
        ) : shown.map((d, i) => {
          const portion = d.base_portion_g || 250;
          return (
            <Animated.View key={d.id} entering={FadeInDown.delay(Math.min(i, 10) * 20).duration(200)}>
              <Card style={{ marginBottom: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.md }}>
                  <Text style={{ ...FONT.h3, color: p.text, flex: 1 }} numberOfLines={1}>
                    {d.name}
                  </Text>
                  <Text style={{ ...FONT.h3, color: p.text }}>
                    {round(d.kcal_100 * portion / 100)}
                  </Text>
                  <Muted>ккал</Muted>
                </View>
                <Muted style={{ marginTop: 3 }}>
                  {[`${round(portion)} г`, meals(d.meal_types),
                    d.cook_minutes ? `${d.cook_minutes} мин` : null].filter(Boolean).join(' · ')}
                </Muted>
                <Muted style={{ marginTop: 2 }}>
                  На 100 г: Б {round(d.protein_100)} · Ж {round(d.fat_100)} · У {round(d.carbs_100)}
                </Muted>
              </Card>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}
