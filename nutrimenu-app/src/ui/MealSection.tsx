/**
 * Приём пищи на экране «Сегодня» — перенос секции `.meal-sec` из веба
 * (`clMealSection` в `app.js`, оформление в `screens.css`).
 *
 * Что здесь от веба, а не придумано заново:
 *  • шапка — кнопка: точка приёма, название, число позиций, слева направо;
 *    справа «План N», «Съедено N», «ккал» и значок сворачивания;
 *  • состояние «свёрнуто» живёт между запусками, ключ тот же, что в вебе —
 *    `equa_meal_fold_<тип>`;
 *  • у незанятого блюда под галочкой стоят «Заменить блюдо» и «Скрыть»
 *    (`.mr-swap` и `.mr-hide`), у скрытого — строка с «Вернуть»;
 *  • цвет точки у каждого приёма свой: значения из `.meal-sec-*`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Animated, { LinearTransition } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useApp } from '../store';
import { api, thumbUrl, MealItem, FoodEntry, MEAL_TITLES } from '../api';
import { S, R, FONT, alpha, mix } from '../theme';
import { Icon } from './Icon';
import { FoodRows, MealAdd } from './FoodBlock';
import { round, plural } from '../format';
import { haptic } from '../haptics';

/** Цвет точки приёма — значения `--meal-dot` из `screens.css`. */
const DOT: Record<string, string> = {
  breakfast: '#74820B',
  snack1: '#8261B3',
  lunch: '#2D8797',
  snack2: '#D18A41',
  dinner: '#74820B',
};

const foldKey = (mt: string) => `equa_meal_fold_${mt}`;

export function MealSection({ meal, items, own, onToggle, onChanged }: {
  meal: string;
  /** Блюда этого приёма, вместе со скрытыми: их показываем отдельной строкой */
  items: MealItem[];
  own: FoodEntry[];
  onToggle: (x: MealItem) => void;
  onChanged: () => void;
}) {
  const { p } = useApp();
  const [folded, setFolded] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  /* Свёрнутое состояние читаем один раз при появлении секции. Пока ответа
     нет, секция развёрнута: мигание «открыто → закрыто» заметнее, чем
     задержка в несколько миллисекунд. */
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(foldKey(meal))
      .then(v => { if (alive && v === '1') setFolded(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, [meal]);

  const toggleFold = useCallback(() => {
    haptic.select();
    setFolded(prev => {
      const next = !prev;
      AsyncStorage.setItem(foldKey(meal), next ? '1' : '0').catch(() => {});
      return next;
    });
  }, [meal]);

  /* Скрыть блюдо и вернуть его — один маршрут с разным флагом, как в вебе
     (`clMealVisibility`). Список перечитываем после ответа: скрытое блюдо
     уходит из плана дня, и итог по калориям меняется вместе с ним. */
  const visibility = useCallback(async (x: MealItem, hidden: boolean) => {
    setBusy(x.id);
    haptic.tap();
    try {
      await api(`/client/meals/${x.id}/visibility`, { method: 'POST', body: { hidden } });
      onChanged();
    } catch { haptic.error(); } finally { setBusy(null); }
  }, [onChanged]);

  const visible = items.filter(x => !x.hidden);
  const hidden = items.filter(x => x.hidden);
  const planK = round(items.reduce((s, x) => s + (x.nutrition?.kcal ?? 0), 0));
  const doneK = round(
    items.filter(x => x.log_status === 'eaten').reduce((s, x) => s + (x.nutrition?.kcal ?? 0), 0)
    + own.reduce((s, e) => s + e.totals.kcal, 0));
  const count = visible.length + own.reduce((n, e) => n + e.items.length, 0);
  const dot = DOT[meal] ?? p.primary;

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={{ marginBottom: S.md }}>
      <Pressable
        onPress={toggleFold}
        accessibilityRole="button"
        accessibilityLabel={`${folded ? 'Развернуть' : 'Свернуть'} приём пищи: ${MEAL_TITLES[meal]}`}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: S.sm,
          paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
          borderRadius: 16, borderWidth: 1, borderColor: p.border,
          backgroundColor: pressed ? p.inset : p.surface,
        })}>
        <View style={{
          width: 9, height: 9, borderRadius: 5, backgroundColor: dot,
          borderWidth: 4, borderColor: alpha(dot, 14),
        }} />
        <Text style={{ fontSize: 17, fontWeight: '600', color: p.text }} numberOfLines={1}>
          {MEAL_TITLES[meal]}
        </Text>
        <Text style={{ ...FONT.caption, color: p.text3, flexShrink: 1 }} numberOfLines={1}>
          {count ? `${count} ${plural(count, ['позиция', 'позиции', 'позиций'])}` : 'пусто'}
        </Text>
        <View style={{ flex: 1 }} />
        {planK || doneK ? (
          <Text style={{ fontSize: 11, color: p.text3, textAlign: 'right' }} numberOfLines={2}>
            {planK ? `План ${planK}` : ''}{planK && doneK ? '  ' : ''}
            {doneK ? <Text style={{ color: p.text, fontWeight: '600' }}>{`Съедено ${doneK}`}</Text> : null}
            {' ккал'}
          </Text>
        ) : null}
        <View style={{
          width: 26, height: 26, borderRadius: 9, backgroundColor: p.inset,
          alignItems: 'center', justifyContent: 'center',
          transform: [{ rotate: folded ? '0deg' : '90deg' }],
        }}>
          <Icon name="chevr" size={15} color={p.text2} />
        </View>
      </Pressable>

      {folded ? null : (
        <View style={{
          backgroundColor: p.surface, borderRadius: R.lg, overflow: 'hidden',
          borderWidth: 1, borderColor: p.border,
        }}>
          {visible.map((x, i) => (
            <MealRow key={x.id} x={x} first={i === 0} busy={busy === x.id}
              onToggle={onToggle}
              onReplace={() => { haptic.tap(); router.push(`/dish/${x.id}?repl=1`); }}
              onHide={() => visibility(x, true)} />
          ))}
          {hidden.map(x => (
            <View key={x.id} style={{
              flexDirection: 'row', alignItems: 'center', gap: S.sm,
              paddingVertical: 10, paddingHorizontal: 12,
              borderTopWidth: 1, borderTopColor: p.borderSoft,
            }}>
              <Icon name="eyeoff" size={16} color={p.text3} />
              <Text style={{ ...FONT.caption, color: p.text3, flex: 1 }} numberOfLines={1}>
                Скрыто: {x.dish_name}
              </Text>
              <Pressable onPress={() => visibility(x, false)} hitSlop={8}
                style={({ pressed }) => ({
                  paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10,
                  backgroundColor: pressed ? p.ov3 : p.inset,
                })}>
                <Text style={{ ...FONT.caption, fontWeight: '600', color: p.text }}>Вернуть</Text>
              </Pressable>
            </View>
          ))}
          <FoodRows entries={own} onChanged={onChanged} first={visible.length === 0 && hidden.length === 0} />
          <MealAdd meal={meal} />
        </View>
      )}
    </Animated.View>
  );
}

/**
 * Строка блюда. Раскладка веба: снимок во всю высоту слева, название,
 * калорийность, состояние и КБЖУ — в середине, действия столбиком справа.
 */
function MealRow({ x, first, busy, onToggle, onReplace, onHide }: {
  x: MealItem; first: boolean; busy: boolean;
  onToggle: (x: MealItem) => void; onReplace: () => void; onHide: () => void;
}) {
  const { p } = useApp();
  const done = x.log_status === 'eaten';
  const skip = x.log_status === 'skipped';
  const n = x.nutrition ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  const thumb = thumbUrl(x);

  return (
    <Pressable
      onPress={() => { haptic.tap(); router.push(`/dish/${x.id}`); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'stretch', gap: S.md,
        paddingRight: 10, minHeight: 104,
        borderTopWidth: first ? 0 : 1, borderTopColor: p.borderSoft,
        backgroundColor: pressed ? p.ov1 : 'transparent',
        opacity: skip ? 0.55 : 1,
      })}>
      {thumb
        ? <Image source={{ uri: thumb }} style={{ width: 94, backgroundColor: p.inset }}
            contentFit="cover" transition={220} cachePolicy="memory-disk"
            placeholder={{ blurhash: 'L6C~2Xxu00WB00WB~qof00WB~qof' }} />
        : <View style={{ width: 94, backgroundColor: p.inset, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bowl" size={20} color={p.text3} />
          </View>}

      <View style={{ flex: 1, minWidth: 0, paddingVertical: 12 }}>
        <Text numberOfLines={2} style={{
          fontSize: 15, fontWeight: '600', lineHeight: 20, letterSpacing: -0.3, color: p.text,
        }}>{x.dish_name}</Text>
        <Text style={{ ...FONT.small, color: p.text2, marginTop: 6 }}>
          {round(x.portion_g)} г · {round(n.kcal)} ккал
        </Text>
        {/* Состояние — плашка, как в вебе (`.mr-state`): зелёная у
            съеденного, бледная у остальных. */}
        <View style={{
          alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3,
          borderRadius: 8, backgroundColor: done ? mix(p.good, 20, p.surface) : p.inset,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: done ? p.good : p.text3 }}>
            {done ? 'Съедено' : skip ? 'Пропущено' : 'В плане'}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: p.text3, marginTop: 5 }} numberOfLines={1}>
          Б {round(n.protein)} г   Ж {round(n.fat)} г   У {round(n.carbs)} г
        </Text>
      </View>

      {/* Действия столбиком: отметка, под ней — замена и «скрыть», как в
          вебе. У съеденного и пропущенного блюда менять нечего: там
          остаётся одна галочка. */}
      <View style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 }}>
        <Pressable onPress={() => onToggle(x)} hitSlop={8}
          accessibilityLabel={done ? 'Отменить отметку' : 'Отметить съеденным'}
          style={({ pressed }) => ({
            width: 27, height: 27, borderRadius: 14,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: done ? p.primary : 'transparent',
            borderWidth: done ? 0 : 1, borderColor: p.text3,
            transform: [{ scale: pressed ? 0.9 : 1 }],
          })}>
          {done ? <Icon name="check" size={16} color={p.onPrimary} width={2.6} /> : null}
        </Pressable>
        {done || skip ? null : busy ? (
          <ActivityIndicator size="small" color={p.text3} />
        ) : (
          <>
            <Pressable onPress={onReplace} hitSlop={8} accessibilityLabel="Заменить блюдо"
              style={({ pressed }) => ({
                width: 27, height: 27, alignItems: 'center', justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}>
              <Icon name="replace" size={18} color={p.text3} />
            </Pressable>
            <Pressable onPress={onHide} hitSlop={8} accessibilityLabel="Скрыть блюдо из плана"
              style={({ pressed }) => ({
                width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                backgroundColor: pressed ? p.ov3 : p.inset,
              })}>
              <Icon name="close" size={15} color={p.text3} />
            </Pressable>
          </>
        )}
      </View>
    </Pressable>
  );
}
