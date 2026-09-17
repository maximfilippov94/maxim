/**
 * Полоска объявления от сервиса на экране «Сегодня».
 *
 * Нужна для того, что нельзя ждать неделю проверки в магазине: «в
 * субботу ночью техработы», «оплата временно не проходит». Закрывается
 * человеком и больше не возвращается — но только пока текст тот же:
 * новое объявление приходит с новым признаком и показывается снова,
 * иначе однажды закрытая полоска похоронила бы все следующие.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { S, R, FONT } from '../theme';
import { Icon } from './Icon';
import { haptic } from '../haptics';

const KEY = 'nm_announce_seen';

export function Announce() {
  const { p, cfg } = useApp();
  const [hidden, setHidden] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then(v => { if (alive) setHidden(v ?? ''); })
      .catch(() => { if (alive) setHidden(''); });
    return () => { alive = false; };
  }, []));

  const a = cfg.announce;
  /* Пока не прочитали хранилище, полоски нет: мелькнуть и исчезнуть
     хуже, чем появиться на кадр позже. */
  if (!a || hidden === null || hidden === a.id) return null;

  const warn = a.kind === 'warn';
  const close = () => {
    haptic.select();
    setHidden(a.id);
    AsyncStorage.setItem(KEY, a.id).catch(() => {});
  };

  return (
    <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOut.duration(160)}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: S.md,
        backgroundColor: warn ? p.warn + '22' : p.primarySoft,
        borderRadius: R.lg, paddingVertical: S.md, paddingHorizontal: S.md,
        marginBottom: S.md,
      }}>
      <View style={{ paddingTop: 1 }}>
        <Icon name={warn ? 'warn' : 'info'} size={18}
          color={warn ? p.warn : p.primary} width={2} />
      </View>

      <Text style={{ ...FONT.small, color: p.text, flex: 1, minWidth: 0, lineHeight: 19 }}>
        {a.text}
      </Text>

      <Pressable onPress={close} accessibilityLabel="Закрыть объявление"
        accessibilityRole="button" hitSlop={10}
        style={({ pressed }) => ({
          width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
          opacity: pressed ? 0.5 : 1,
        })}>
        <Icon name="close" size={15} color={p.text3} width={2} />
      </Pressable>
    </Animated.View>
  );
}
