import React, { useEffect } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, ScrollView,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import { useApp } from '../store';
import { S, R, FONT } from '../theme';
import { haptic } from '../haptics';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { p } = useApp();
  return (
    <View style={[{
      backgroundColor: p.surface, borderRadius: R.lg, padding: S.lg,
      /* На светлой теме белая карточка на светлом фоне без границы
         не читается как отдельный уровень — добавляем волосок. */
      borderWidth: p.name === 'light' ? StyleSheet.hairlineWidth : 0,
      borderColor: p.borderSoft,
    }, style]}>{children}</View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const { p } = useApp();
  return <Text style={{ ...FONT.label, color: p.text3, textTransform: 'uppercase' }}>{children}</Text>;
}

export function Muted({ children, style, numberOfLines }: {
  children: React.ReactNode; style?: TextStyle; numberOfLines?: number;
}) {
  const { p } = useApp();
  return (
    <Text numberOfLines={numberOfLines} style={[{ ...FONT.small, color: p.text3 }, style]}>
      {children}
    </Text>
  );
}

export function Btn({ title, onPress, variant = 'primary', loading, icon, style }: {
  title: string; onPress?: () => void;
  variant?: 'primary' | 'ghost'; loading?: boolean;
  icon?: React.ReactNode; style?: ViewStyle;
}) {
  const { p } = useApp();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.md,
        backgroundColor: primary ? p.primary : p.ov1,
        borderRadius: R.md, paddingVertical: 14, paddingHorizontal: S.xl,
        opacity: loading ? 0.6 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      }, style]}>
      {loading
        ? <ActivityIndicator color={primary ? p.onPrimary : p.text} />
        : <>{icon}<Text style={{ ...FONT.h3, color: primary ? p.onPrimary : p.text }}>{title}</Text></>}
    </Pressable>
  );
}

/** Полоса прогресса. Значение зажимается: перебор рисуется полной шкалой,
 *  а не вылезает за карточку. */
/**
 * Ряд «таблеток» — выбор одного из нескольких. Тот же вид, что у вкладок
 * в карточке клиента: раз уж он там прижился, второй такой же в другом
 * оформлении читался бы как другой элемент.
 */
/** Высота одной «таблетки»: 7 + 7 отступов, строка 18, рамка. */
const PILL_H = 34;

export function Pills<T extends string>({ items, value, onChange, style, scroll }: {
  items: [T, string][];
  value: T;
  onChange: (v: T) => void;
  style?: ViewStyle;
  /** Длинный ряд не переносим, а листаем вбок: три строки кнопок
      съедают экран раньше, чем начинается сам список. */
  scroll?: boolean;
}) {
  const { p } = useApp();
  const row = items.map(([k, l]) => {
    const on = k === value;
    return (
      <Pressable key={k} onPress={() => { haptic.select(); onChange(k); }}
        style={({ pressed }) => ({
          paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill,
          backgroundColor: on ? p.primary : p.surface,
          borderWidth: on ? 0 : 1, borderColor: p.border,
          opacity: pressed && !on ? 0.7 : 1,
        })}>
        <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
          color: on ? p.onPrimary : p.text2 }}>{l}</Text>
      </Pressable>
    );
  });

  if (scroll) {
    /* Высоту задаём снаружи явно: горизонтальный список внутри колонки
       меряет себя сам и в шторке успевает встать не на своё место —
       кнопки наезжали на заголовок. С фиксированной высотой мерить
       нечего, и ряд всегда стоит там, где стоит. */
    return (
      <View style={[{ height: PILL_H }, style]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          {row}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={[{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }, style]}>
      {row}
    </View>
  );
}

export function Bar({ value, color, height = 5 }: { value: number; color?: string; height?: number }) {
  const { p } = useApp();
  const w = Math.max(0, Math.min(1, isFinite(value) ? value : 0));
  /* Полоса дорастает до нового значения вместе со счётчиком рядом:
     отметил приём — видно, как показатель прибавился, а не подменился. */
  const grow = useSharedValue(w);
  useEffect(() => {
    grow.value = withTiming(w, { duration: 460, easing: Easing.out(Easing.cubic) });
  }, [w, grow]);
  const fill = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: p.track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: height / 2,
        backgroundColor: color ?? p.primary }, fill]} />
    </View>
  );
}
