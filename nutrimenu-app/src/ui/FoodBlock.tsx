/**
 * Съеденное — строками внутри своего приёма пищи.
 *
 * День устроен как дневник, а не как меню плюс список «прочего» под ним:
 * человеку нужен один день, и он не обязан помнить, откуда какая строка
 * взялась. Поэтому еда, добавленная вручную, стоит в той же карточке,
 * что и назначенное блюдо, а «Добавить еду» — последней строкой секции,
 * а не общей кнопкой внизу экрана.
 */
import React, { useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../store';
import { api, FoodEntry } from '../api';
import { round, plural } from '../format';
import { S, FONT } from '../theme';
import { Icon } from './Icon';
import { haptic } from '../haptics';

export function FoodRows({ entries, onChanged, first }: {
  entries: FoodEntry[]; onChanged: () => void;
  /** Нет назначенных блюд — верхняя черта не нужна. */
  first?: boolean;
}) {
  const { p } = useApp();

  /* Запись может состоять из нескольких продуктов: если убирают один
     из многих, честно предупреждаем, что уйдут все. Правка отдельной
     строки внутри записи потребовала бы отдельного экрана ради
     редкого случая. */
  const drop = useCallback((e: FoodEntry) => {
    const n = e.items.length;
    Alert.alert(
      n > 1 ? 'Убрать запись целиком?' : 'Убрать запись?',
      n > 1 ? `В ней ${n} ${plural(n, ['продукт', 'продукта', 'продуктов'])}.` : undefined,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Убрать', style: 'destructive', onPress: async () => {
          try { await api(`/client/food-log/${e.id}`, { method: 'DELETE' }); haptic.success(); onChanged(); }
          catch { haptic.error(); }
        } },
      ]);
  }, [onChanged]);

  if (!entries.length) return null;
  let k = 0;
  return (
    <>
      {entries.map(e => e.items.map(it => {
        const top = !(first && k++ === 0);
        return (
          <View key={`${e.id}-${it.id}`} style={{
            flexDirection: 'row', alignItems: 'center', gap: S.md,
            paddingVertical: 10, paddingHorizontal: 12,
            borderTopWidth: top ? 1 : 0, borderTopColor: p.borderSoft,
          }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: p.text }}>
                {it.name}
              </Text>
              <Text style={{ ...FONT.small, color: p.text3, marginTop: 3 }}>
                {round(it.grams)} г · {round(it.kcal)} ккал
              </Text>
            </View>
            <Pressable hitSlop={10} onPress={() => { haptic.tap(); drop(e); }}>
              <Icon name="close" size={17} color={p.text3} />
            </Pressable>
          </View>
        );
      }))}
    </>
  );
}

/** «Добавить еду» — последней строкой приёма пищи. */
export function MealAdd({ meal }: { meal: string }) {
  const { p } = useApp();
  return (
    <Pressable
      onPress={() => { haptic.tap(); router.push(`/food-log?meal=${meal}`); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 8,
        minHeight: 46, paddingHorizontal: 12,
        borderTopWidth: 1, borderTopColor: p.borderSoft,
        backgroundColor: pressed ? p.ov1 : 'transparent',
      })}>
      <Icon name="plus" size={16} color={p.accent} />
      <Text style={{ ...FONT.body, fontWeight: '600', color: p.accent }}>Добавить еду</Text>
    </Pressable>
  );
}
