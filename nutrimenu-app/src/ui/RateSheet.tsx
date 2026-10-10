/**
 * «Оцените блюдо» — то же предложение, что в вебе (`clRateDishMaybe`
 * и `clRateDish`): после того как блюдо отмечено съеденным и окно
 * отмены закрылось, один раз на блюдо спрашиваем оценку.
 *
 * Один раз — это буквально: ключ запоминается на устройстве, как
 * `equa_dish_rate_prompt_<id>` в localStorage веба. Повторно просить
 * оценить то же блюдо нельзя: дневник ведут каждый день, и предложение
 * превратилось бы в ежедневную помеху.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../store';
import { api } from '../api';
import { S, R, FONT, STAR, alpha } from '../theme';
import { Icon } from './Icon';
import { SysButton } from './system';
import { haptic } from '../haptics';

const key = (dishId: number) => `equa_dish_rate_prompt_${dishId}`;

/** Спрашивали ли уже про это блюдо. Сбой чтения не мешает: просто не спросим. */
export async function shouldAskRating(dishId: number): Promise<boolean> {
  try {
    if (await AsyncStorage.getItem(key(dishId))) return false;
    await AsyncStorage.setItem(key(dishId), '1');
    return true;
  } catch { return false; }
}

export function RateSheet({ dish, onClose }: {
  dish: { id: number; name: string } | null;
  onClose: () => void;
}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function save(rating: number) {
    if (!dish || busy) return;
    setBusy(true);
    haptic.select();
    try {
      await api(`/client/dishes/${dish.id}/rating`, { method: 'POST', body: { rating } });
      haptic.success();
    } catch { haptic.error(); }
    finally { setBusy(false); onClose(); }
  }

  return (
    <Modal transparent visible={!!dish} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(9,16,18,0.55)' }} />
      <Animated.View entering={SlideInDown.duration(260)} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: p.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
        padding: S.xl, paddingBottom: insets.bottom + S.xl,
      }}>
        <Text style={{ ...FONT.caption, color: p.text3 }}>Ваше мнение</Text>
        <Text style={{ ...FONT.h2, color: p.text, marginTop: 2 }} numberOfLines={2}>
          {dish?.name ?? 'Оценить блюдо'}
        </Text>
        <Text style={{ ...FONT.small, color: p.text3, marginTop: S.sm, lineHeight: 19 }}>
          Оценка помогает другим клиентам и специалистам выбирать блюда,
          которые действительно нравятся.
        </Text>

        <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg, marginBottom: S.lg }}>
          {[1, 2, 3, 4, 5].map(n => (
            <Pressable key={n} onPress={() => save(n)} disabled={busy}
              accessibilityRole="button" accessibilityLabel={`${n} из 5`}
              style={({ pressed }) => ({
                width: 52, height: 52, borderRadius: R.control,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: alpha(STAR, 13),
                transform: [{ scale: pressed ? 0.92 : 1 }],
              })}>
              <Icon name="star" size={24} color={STAR} />
            </Pressable>
          ))}
        </View>

        <SysButton label="Не сейчас" variant="quiet" onPress={onClose} />
      </Animated.View>
    </Modal>
  );
}
