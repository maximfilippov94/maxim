import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useApp } from '../store';
import { S, R, FONT } from '../theme';

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

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { p } = useApp();
  return <Text style={[{ ...FONT.small, color: p.text3 }, style]}>{children}</Text>;
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
export function Bar({ value, color, height = 5 }: { value: number; color?: string; height?: number }) {
  const { p } = useApp();
  const w = Math.max(0, Math.min(1, isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: p.track, overflow: 'hidden' }}>
      <View style={{ width: `${w * 100}%`, height: '100%', borderRadius: height / 2,
        backgroundColor: color ?? p.primary }} />
    </View>
  );
}
