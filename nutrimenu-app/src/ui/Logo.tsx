/**
 * Утверждённый логотип EQUA.
 *
 * Источник — два брендовых PNG: тёмные буквы для светлой темы и белые
 * буквы для тёмной. Никаких перерисованных SVG и самостоятельной
 * перекраски: приложение показывает ровно утверждённые файлы бренда.
 */
import React from 'react';
import { Image } from 'expo-image';
import { useApp } from '../store';
import { API_BASE } from '../api';

/** Пропорции утверждённого файла: 3044 × 700. */
export const LOGO_RATIO = 3044 / 700;

export function Logo({ width = 160 }: {
  width?: number;
  /** Оставлено для обратной совместимости со старыми вызовами. */
  color?: string;
  mark?: string;
}) {
  const { p } = useApp();
  const file = p.name === 'dark'
    ? '/app/assets/equa-logo-on-dark.png'
    : '/app/assets/equa-logo-on-light.png';

  return (
    <Image
      source={{ uri: API_BASE + file }}
      accessibilityLabel="EQUA"
      contentFit="contain"
      cachePolicy="memory-disk"
      style={{ width, height: width / LOGO_RATIO }}
    />
  );
}
