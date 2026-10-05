/**
 * Съеденное — строками внутри своего приёма пищи.
 *
 * День устроен как дневник, а не как меню плюс список «прочего» под ним:
 * человеку нужен один день, и он не обязан помнить, откуда какая строка
 * взялась. Поэтому еда, добавленная вручную, стоит в той же карточке,
 * что и назначенное блюдо, а «Добавить еду» — последней строкой секции,
 * а не общей кнопкой внизу экрана.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../store';
import { api, FoodEntry, FoodEntryItem } from '../api';
import { round } from '../format';
import { S, R, FONT } from '../theme';
import { Icon } from './Icon';
import { haptic } from '../haptics';
import { SysButton } from './system';

export function FoodRows({ entries, onChanged, first }: {
  entries: FoodEntry[]; onChanged: () => void;
  /** Нет назначенных блюд — верхняя черта не нужна. */
  first?: boolean;
}) {
  const { p } = useApp();

  /* Убираем один продукт, а не всю запись: в одной записи их бывает
     несколько, и крестик у строки должен убирать именно её — сервер
     это умеет (`/client/food-log/:id/items/:id`), приложение раньше
     сносило запись целиком вместе с соседними продуктами. */
  const drop = useCallback((e: FoodEntry, it: FoodEntryItem) => {
    Alert.alert('Убрать продукт?', it.name, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Убрать', style: 'destructive', onPress: async () => {
        try {
          await api(`/client/food-log/${e.id}/items/${it.id}`, { method: 'DELETE' });
          haptic.success(); onChanged();
        } catch { haptic.error(); }
      } },
    ]);
  }, [onChanged]);

  /* Правка порции. В вебе это шторка «Размер порции» с пересчётом КБЖУ;
     здесь строка раскрывается на месте — КБЖУ всё равно пересчитает
     сервер, а второй экран ради одного числа не нужен. */
  const [edit, setEdit] = useState<number | null>(null);
  const [grams, setGrams] = useState('');
  const saveGrams = useCallback(async (e: FoodEntry, it: FoodEntryItem) => {
    const g = Math.round(Number(grams.replace(',', '.')));
    if (!(g > 0 && g <= 5000)) { haptic.error(); return; }
    try {
      await api(`/client/food-log/${e.id}/items/${it.id}`, { method: 'PATCH', body: { grams: g } });
      setEdit(null); haptic.success(); onChanged();
    } catch { haptic.error(); }
  }, [grams, onChanged]);

  if (!entries.length) return null;
  let k = 0;
  return (
    <>
      {entries.map(e => e.items.map(it => {
        const top = !(first && k++ === 0);
        return (
          <View key={`${e.id}-${it.id}`} style={{
            paddingVertical: 10, paddingHorizontal: 12,
            borderTopWidth: top ? 1 : 0, borderTopColor: p.borderSoft,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <Pressable style={{ flex: 1, minWidth: 0 }}
                onPress={() => {
                  haptic.tap();
                  setGrams(String(round(it.grams)));
                  setEdit(v => (v === it.id ? null : it.id));
                }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: p.text }}>
                  {it.name}
                </Text>
                <Text style={{ ...FONT.small, color: p.text3, marginTop: 3 }}>
                  {round(it.grams)} г · {round(it.kcal)} ккал
                </Text>
              </Pressable>
              <Pressable hitSlop={10} onPress={() => { haptic.tap(); drop(e, it); }}>
                <Icon name="close" size={17} color={p.text3} />
              </Pressable>
            </View>

            {edit === it.id ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.sm }}>
                <TextInput value={grams} onChangeText={setGrams} keyboardType="number-pad"
                  autoFocus selectTextOnFocus
                  accessibilityLabel="Количество в граммах"
                  style={{
                    width: 92, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
                    paddingHorizontal: 12, paddingVertical: 9, fontSize: 15,
                  }} />
                <Text style={{ ...FONT.small, color: p.text3 }}>г</Text>
                <View style={{ flex: 1 }} />
                <SysButton label="Сохранить" variant="prominent" height={40}
                  onPress={() => saveGrams(e, it)} />
              </View>
            ) : null}
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
      {/* Знак — лаймовая капля с тёмным плюсом, как у кнопок: цветом
          подписи лайм на светлой карточке не читается, а зелёная
          надпись в продукте и не нужна. */}
      <View style={{
        width: 24, height: 24, borderRadius: 12, backgroundColor: p.primary,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="plus" size={14} color={p.onPrimary} width={2.4} />
      </View>
      <Text style={{ ...FONT.body, fontWeight: '600', color: p.text }}>Добавить еду</Text>
    </Pressable>
  );
}
