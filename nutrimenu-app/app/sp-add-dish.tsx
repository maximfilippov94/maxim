/**
 * Добавление блюда в меню — в два шага.
 *
 * Сначала выбор: сетка квадратных карточек с фотографиями. Тарелку
 * узнают по виду быстрее, чем по названию, и «Домашнее блюдо №41»
 * в списке строк ничем не отличалось от соседнего.
 *
 * Потом граммовка: специалист видит, сколько выйдет ккал и БЖУ именно
 * в этой порции, и подтверждает. Раньше блюдо падало в меню с базовой
 * порцией молча — поправить её можно было только потом, в карточке.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useApp } from '../src/store';
import { api, mediaUrl, Dish, MEAL_TITLES } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Muted, Pills } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { Empty, SysSlider, SysButton } from '../src/ui/system';
import { round, dayTitle } from '../src/format';
import { haptic } from '../src/haptics';

/**
 * Насколько блюдо подходит приёму: 2 — задумано именно для него,
 * 1 — помечено ещё и другими приёмами, 0 — не для этого.
 * Блюдо «на всё» — обычно просто незаполненная карточка, и держать его
 * выше овсянки в списке завтраков неправильно.
 */
const fitRank = (d: Dish, meal: string) => {
  if (!d.meal_types) return 0;
  try {
    const a = JSON.parse(d.meal_types);
    if (!Array.isArray(a) || !a.includes(meal)) return 0;
    return a.length <= 2 ? 2 : 1;
  } catch { return 0; }
};

type Scope = 'fit' | 'mine' | 'all';
const SCOPES: [Scope, string][] = [
  ['fit', 'Для приёма'], ['mine', 'Свои'], ['all', 'Все'],
];

export default function AddDish() {
  const { p, me } = useApp();
  const { width } = useWindowDimensions();
  const { menu, day, meal, start } = useLocalSearchParams<{
    menu: string; day: string; meal: string; start?: string;
  }>();
  const [list, setList] = useState<Dish[] | null>(null);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>('fit');
  const [picked, setPicked] = useState<Dish | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ dishes: Dish[] }>('/specialist/dishes')
      .then(r => setList(r.dishes ?? []))
      .catch(e => { setErr(e.message); setList([]); });
  }, []);

  const my = me?.user?.id;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const a = (list ?? [])
      .filter(d => !s || d.name.toLowerCase().includes(s))
      .filter(d => scope === 'all'
        || (scope === 'mine' ? d.created_by === my : fitRank(d, String(meal)) > 0));
    /* Сначала подходящие приёму, дальше по алфавиту — с числами как
       числами, иначе «№100» встаёт между «№10» и «№11». */
    return a.sort((x, y) =>
      fitRank(y, String(meal)) - fitRank(x, String(meal))
      || x.name.localeCompare(y.name, 'ru', { numeric: true }));
  }, [list, q, scope, meal, my]);

  async function add(d: Dish, grams: number) {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      await api(`/specialist/menus/${menu}/items`, {
        method: 'POST',
        body: {
          dish_id: d.id,
          day_number: Number(day),
          meal_type: meal,
          portion_g: grams,
        },
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось добавить');
    } finally { setBusy(false); }
  }

  /* Два в ряд с полями и зазором — ширину считаем сами: у квадрата
     сторона задаётся числом, а не процентом. */
  const gap = S.md;
  const cardW = Math.floor((width - S.xl * 2 - gap) / 2);

  if (picked) {
    return (
      <Portion dish={picked} width={width} busy={busy} err={err}
        onBack={() => { haptic.tap(); setPicked(null); setErr(null); }}
        onAdd={g => add(picked, g)} />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.xl, paddingBottom: S.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...FONT.h2, color: p.text }}>Добавить блюдо</Text>
          <Muted style={{ marginTop: 2 }}>
            {dayTitle(start, Number(day))} · {MEAL_TITLES[String(meal)] ?? 'приём'}
          </Muted>
        </View>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: S.sm,
        backgroundColor: p.inset, borderRadius: R.md,
        marginHorizontal: S.xl, marginBottom: S.md, paddingHorizontal: S.lg,
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

      <Pills items={SCOPES} value={scope} onChange={setScope}
        style={{ marginHorizontal: S.xl, marginBottom: S.md }} />

      {err ? (
        <Text style={{ ...FONT.small, color: p.danger, paddingHorizontal: S.xl }}>{err}</Text>
      ) : null}

      {!list ? (
        <ActivityIndicator color={p.primary} style={{ marginTop: 30 }} />
      ) : shown.length === 0 ? (
        <Empty icon="fork.knife"
          title={scope === 'mine' ? 'Своих блюд пока нет' : 'Ничего не нашли'}
          note={scope === 'mine'
            ? 'Завести своё блюдо можно в «Базе блюд» — кнопкой «плюс».'
            : 'Проверьте название или посмотрите вкладку «Все».'} />
      ) : (
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.xl, paddingBottom: S.xxl,
          flexDirection: 'row', flexWrap: 'wrap', gap,
        }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {shown.map((d, i) => (
            <Animated.View key={d.id}
              entering={FadeInDown.delay(Math.min(i, 10) * 20).duration(200)}>
              <DishTile dish={d} size={cardW}
                onPress={() => { haptic.tap(); setPicked(d); }} />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** Квадрат с фотографией, названием и калорийностью базовой порции. */
function DishTile({ dish, size, onPress }: {
  dish: Dish; size: number; onPress: () => void;
}) {
  const { p } = useApp();
  const photo = mediaUrl(dish.photo_url);
  const portion = dish.base_portion_g || 250;

  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        width: size, transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <View style={{
        width: size, height: size, borderRadius: R.lg, overflow: 'hidden',
        backgroundColor: p.inset, alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Значок лежит под снимком, а не вместо него: пока фото едет
            или если оно не открылось, квадрат не остаётся пустым. */}
        <Icon name="bowl" size={28} color={p.text3} />
        {photo ? (
          <Image source={{ uri: photo }}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            contentFit="cover" transition={180} cachePolicy="memory-disk" />
        ) : null}
        {/* Калорийность поверх снимка: на глаз сравнивать удобнее, чем
            переводя взгляд на подпись под каждой карточкой. */}
        <View style={{
          position: 'absolute', left: 8, bottom: 8,
          borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 4,
          backgroundColor: 'rgba(10,14,18,0.62)',
        }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
            {round(dish.kcal_100 * portion / 100)} ккал
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 2, paddingTop: 7, paddingBottom: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: p.text }} numberOfLines={2}>
          {dish.name}
        </Text>
        <Muted style={{ marginTop: 2 }}>
          {round(portion)} г{dish.cook_minutes ? ` · ${dish.cook_minutes} мин` : ''}
        </Muted>
      </View>
    </Pressable>
  );
}

/**
 * Шаг граммовки. Считаем от значений на 100 г, которые уже пришли
 * с блюдом, — лишнего запроса ради одной цифры не делаем.
 */
function Portion({ dish, width, busy, err, onBack, onAdd }: {
  dish: Dish; width: number; busy: boolean; err: string | null;
  onBack: () => void; onAdd: (grams: number) => void;
}) {
  const { p } = useApp();
  const base = round(dish.base_portion_g ?? 0) || 250;
  const [g, setG] = useState(base);
  const lo = Math.max(10, Math.round(base * 0.25 / 5) * 5);
  const hi = Math.round(base * 2.5 / 5) * 5;
  const photo = mediaUrl(dish.photo_url);
  const per = (v: number) => round(v * g / 100);

  return (
    <Animated.View entering={FadeIn.duration(160)}
      style={{ flex: 1, backgroundColor: p.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.xl, paddingBottom: S.md }}>
        <Pressable onPress={onBack} hitSlop={12}
          style={({ pressed }) => ({ marginRight: S.md, opacity: pressed ? 0.5 : 1 })}>
          <Icon name="back" size={21} color={p.primary} width={2.2} />
        </Pressable>
        <Text style={{ ...FONT.h2, color: p.text, flex: 1 }} numberOfLines={1}>
          {dish.name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: S.xxl }}
        showsVerticalScrollIndicator={false}>
        <View style={{
          height: Math.min(200, width * 0.5), borderRadius: R.lg, overflow: 'hidden',
          backgroundColor: p.inset, alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="bowl" size={34} color={p.text3} />
          {photo ? (
            <Image source={{ uri: photo }}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
              contentFit="cover" transition={180} cachePolicy="memory-disk" />
          ) : null}
        </View>

        <View style={{ alignItems: 'center', marginTop: S.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ ...FONT.num, color: p.text }}>{g}</Text>
            <Text style={{ ...FONT.h3, color: p.text2 }}>г</Text>
          </View>
          <Muted style={{ marginTop: 2 }}>
            {g === base ? 'порция по рецепту' : `по рецепту ${base} г`}
          </Muted>
        </View>

        <View style={{ marginTop: S.md }}>
          <SysSlider value={g} min={lo} max={hi} step={5} onChange={setG} />
        </View>

        <View style={{
          flexDirection: 'row', backgroundColor: p.bg, borderRadius: R.lg,
          paddingVertical: S.lg, marginTop: S.lg,
        }}>
          {([['Ккал', per(dish.kcal_100)], ['Белки', per(dish.protein_100)],
             ['Жиры', per(dish.fat_100)], ['Углеводы', per(dish.carbs_100)]] as [string, number][])
            .map(([label, v]) => (
              <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ ...FONT.h3, color: p.text }}>{v}</Text>
                <Muted style={{ marginTop: 2 }}>{label}</Muted>
              </View>
            ))}
        </View>

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text>
        ) : null}

        <View style={{ marginTop: S.xl }}>
          <SysButton label={busy ? 'Добавляем…' : 'Добавить в меню'}
            variant="prominent" icon="plus" disabled={busy}
            onPress={() => onAdd(g)} />
        </View>
      </ScrollView>
    </Animated.View>
  );
}
