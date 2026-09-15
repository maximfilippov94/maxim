/**
 * «Съедено не по меню» на экране «Сегодня».
 *
 * Показываем раздел только когда есть что показать: пустой блок на
 * главной — шум. Кнопка «Съел своё» остаётся всегда: без неё дневник
 * никак не начать.
 */
import React, { useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, TodayResponse } from '../api';
import { round } from '../format';
import { S, R, FONT } from '../theme';
import { Card, Label, Muted } from './base';
import { Icon } from './Icon';
import { haptic } from '../haptics';

export function FoodBlock({ day, onChanged }: {
  day: TodayResponse | null; onChanged: () => void;
}) {
  const { p } = useApp();
  const rows = day?.food ?? [];
  const total = day?.food_totals?.kcal ?? 0;

  const drop = useCallback((id: number, title: string) => {
    Alert.alert('Убрать запись?', title, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Убрать', style: 'destructive', onPress: async () => {
        try { await api(`/client/food-log/${id}`, { method: 'DELETE' }); haptic.success(); onChanged(); }
        catch { haptic.error(); }
      } },
    ]);
  }, [onChanged]);

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={{ marginTop: S.md }}>
      {rows.length ? (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'baseline', paddingHorizontal: 2, paddingBottom: 8 }}>
            <Text style={{ ...FONT.h3, color: p.text }}>Съедено не по меню</Text>
            <Muted>{round(total)} ккал</Muted>
          </View>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {rows.map((e, i) => (
              <View key={e.id} style={{ padding: S.lg,
                borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <Text style={{ ...FONT.body, fontWeight: '700', color: p.text, flex: 1 }}>
                    {e.meal_title}
                  </Text>
                  <Muted>{round(e.totals.kcal)} ккал</Muted>
                  <Pressable hitSlop={10} onPress={() => drop(e.id, e.meal_title)}>
                    <Icon name="close" size={16} color={p.text3} />
                  </Pressable>
                </View>
                {/* Состав — подпись к итогу, поэтому строкой чипов,
                    а не вторым списком. */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {e.items.map(it => (
                    <View key={it.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5,
                      paddingHorizontal: 9, paddingVertical: 3,
                      borderRadius: R.pill, backgroundColor: p.inset }}>
                      <Text style={{ ...FONT.small, color: p.text2 }}>{it.name}</Text>
                      <Text style={{ ...FONT.small, color: p.text3 }}>{round(it.grams)} г</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Pressable onPress={() => { haptic.tap(); router.push('/food-log'); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          minHeight: 48, marginTop: S.md, paddingHorizontal: S.lg,
          borderRadius: R.lg, borderWidth: 1, borderColor: p.border, borderStyle: 'dashed',
          opacity: pressed ? 0.7 : 1,
        })}>
        <Icon name="plus" size={17} color={p.accent} />
        <Text style={{ ...FONT.body, fontWeight: '700', color: p.accent }}>Съел своё</Text>
      </Pressable>
    </Animated.View>
  );
}
