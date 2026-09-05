import React from 'react';
import { View, Platform, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useApp } from '../store';
import { hasExpoUI } from '../native';

/* На iOS 26 доступен системный Liquid Glass — настоящее преломление того,
   что под панелью. Ниже 26-й и на Android его нет, поэтому подставляем
   размытие, а совсем без него — плотную заливку. Модуль подключаем
   осторожно: на платформах без него импорт может отсутствовать. */
let GlassView: any = null;
let GlassContainerRaw: any = null;
let liquidGlassAvailable = false;
try {
  const m = require('expo-glass-effect');
  GlassView = m.GlassView ?? null;
  GlassContainerRaw = m.GlassContainer ?? null;
  liquidGlassAvailable =
    typeof m.isLiquidGlassAvailable === 'function' ? m.isLiquidGlassAvailable() : false;
} catch {
  /* пакета нет — работаем на размытии */
}

export const hasLiquidGlass = liquidGlassAvailable && Platform.OS === 'ios';

/**
 * Второй заход за настоящим стеклом. Материал даёт не только
 * expo-glass-effect: тот же системный эффект есть в SwiftUI-компонентах
 * @expo/ui, а они доступны там, где первого пакета нет — в Expo Go.
 * Кладём SwiftUI-хост подложкой, содержимое остаётся обычным React Native.
 * Эффект появился в iOS 26, ниже его просто нет.
 */
const iosMajor = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) || 0 : 0;
export const hasHostedGlass = !hasLiquidGlass && hasExpoUI && iosMajor >= 26;

export function Glass({
  children, style, radius = 28, tint, edge,
}: {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  tint?: string;
  /** Цвет кромки. По умолчанию светлая — «блик на стекле»; тёмным
   *  элементам поверх светлого стекла она не подходит. */
  edge?: string;
}) {
  const { p } = useApp();
  const shape: ViewStyle = { borderRadius: radius, overflow: 'hidden' };

  if (hasLiquidGlass && GlassView) {
    return (
      <GlassView style={[shape, style]} glassEffectStyle="regular" tintColor={tint}>
        {children}
      </GlassView>
    );
  }

  if (hasHostedGlass) {
    const { Host, HStack, Spacer } = require('@expo/ui/swift-ui');
    const { frame, glassEffect } = require('@expo/ui/swift-ui/modifiers');
    return (
      <View style={[shape, style]}>
        {/* Хост не перехватывает нажатия — они уходят детям ниже. Рамку
            задаём с запасом: SwiftUI прижмёт её к предложенному размеру,
            а лишнее всё равно обрежет overflow родителя. */}
        <Host style={StyleSheet.absoluteFill} pointerEvents="none">
          <HStack
            modifiers={[
              frame({ maxWidth: 9999, maxHeight: 9999 }),
              glassEffect({
                glass: { variant: 'regular', tint },
                shape: 'roundedRectangle',
                cornerRadius: radius,
              }),
            ]}>
            <Spacer />
          </HStack>
        </Host>
        {children}
      </View>
    );
  }

  /* Размытие + тонкая светлая кромка: без неё панель на тёмном фоне
     теряет края и выглядит грязным пятном, а не стеклом. */
  return (
    <View style={[shape, style]}>
      <BlurView
        intensity={Platform.OS === 'android' ? 40 : 60}
        tint={p.name === 'light' ? 'light' : 'dark'}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, {
        borderRadius: radius,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: edge ?? (p.name === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.16)'),
        backgroundColor: tint ?? (p.name === 'light'
          ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.05)'),
      }]} />
      {children}
    </View>
  );
}

/**
 * Оболочка для соседних стеклянных элементов: при сближении они сливаются,
 * как капли, и расходятся обратно. Это системный эффект iOS 26 — руками его
 * не воспроизвести, поэтому везде, где его нет, просто раскладываем детей в ряд.
 */
export function GlassGroup({
  children, spacing = 12, style,
}: { children: React.ReactNode; spacing?: number; style?: ViewStyle }) {
  /* Раскладку задаём одинаково для обеих веток: у GlassContainer свои
     правила расстановки детей, и без этого кнопка уезжала под панель. */
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: spacing };
  if (hasLiquidGlass && GlassContainerRaw) {
    return (
      <GlassContainerRaw spacing={spacing} style={[row, style]}>
        {children}
      </GlassContainerRaw>
    );
  }
  return <View style={[row, style]}>{children}</View>;
}
