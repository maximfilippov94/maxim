import React from 'react';
import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SymbolView, SymbolViewProps } from 'expo-symbols';

/** Контуры для Android и веба: сетка 24×24, обводка 1.75. */
export const PATHS: Record<string, string> = {
  home: 'M4.2 10.7 11.1 4.6a1.4 1.4 0 0 1 1.8 0l6.9 6.1M6.4 9.6v8.9a1.7 1.7 0 0 0 1.7 1.7h7.8a1.7 1.7 0 0 0 1.7-1.7V9.6M9.9 20.2v-4.4a2.1 2.1 0 0 1 4.2 0v4.4',
  cal: 'M5.5 6.4h13a1.9 1.9 0 0 1 1.9 1.9v10.4a1.9 1.9 0 0 1-1.9 1.9h-13a1.9 1.9 0 0 1-1.9-1.9V8.3a1.9 1.9 0 0 1 1.9-1.9ZM3.6 11h16.8M8.2 3.6v4M15.8 3.6v4',
  chat: 'M20.4 11.6a7.9 7.9 0 0 1-11.3 7.2L3.6 20.4l1.6-5.3a7.9 7.9 0 1 1 15.2-3.5Z',
  kebab: 'M12 6.6a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 19.4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  plus: 'M12 5.2v13.6M5.2 12h13.6',
  check: 'M5.4 12.6 9.8 17l8.8-9.4',
  video: 'M4.3 7.6a2 2 0 0 1 2-2h7.2a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H6.3a2 2 0 0 1-2-2ZM15.5 10.9l3.4-2.4a.7.7 0 0 1 1.1.6v5.8a.7.7 0 0 1-1.1.6l-3.4-2.4Z',
  bowl: 'M3.8 10.6h16.4a8.2 8.2 0 0 1-8.2 8.2 8.2 8.2 0 0 1-8.2-8.2ZM8.4 7.4c0-1 .8-1.6.8-2.6M12 7.4c0-1 .8-1.6.8-2.6M15.6 7.4c0-1 .8-1.6.8-2.6',
  chevr: 'M9.5 5.8 15.7 12l-6.2 6.2',
  moon: 'M20.4 14.8A8.7 8.7 0 0 1 9.2 3.6a8.7 8.7 0 1 0 11.2 11.2Z',
  sun: 'M12 16.4a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8ZM12 2.5v2.1M12 19.4v2.1M4.3 4.3l1.5 1.5M18.2 18.2l1.5 1.5M2.5 12h2.1M19.4 12h2.1M4.3 19.7l1.5-1.5M18.2 5.8l1.5-1.5',
  device: 'M7.6 3.5h8.8a1.9 1.9 0 0 1 1.9 1.9v13.2a1.9 1.9 0 0 1-1.9 1.9H7.6a1.9 1.9 0 0 1-1.9-1.9V5.4a1.9 1.9 0 0 1 1.9-1.9ZM10.7 17.7h2.6',
  weight: 'M6.2 8.4h11.6l1.6 11.2H4.6ZM12 4.4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
  close: 'M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8',
  back: 'M14.5 5.8 8.3 12l6.2 6.2',
  user: 'M12 11.6a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4ZM4.8 20.2a7.2 7.2 0 0 1 14.4 0',
  exit: 'M14.6 8.2V5.9a1.9 1.9 0 0 0-1.9-1.9H6.3a1.9 1.9 0 0 0-1.9 1.9v12.2a1.9 1.9 0 0 0 1.9 1.9h6.4a1.9 1.9 0 0 0 1.9-1.9v-2.3M9.8 12h9.8M16.6 8.8 19.8 12l-3.2 3.2',
  tag: 'M11.2 3.6H19a1.4 1.4 0 0 1 1.4 1.4v7.8a1.4 1.4 0 0 1-.4 1l-7.8 7.8a1.4 1.4 0 0 1-2 0l-7-7a1.4 1.4 0 0 1 0-2l7.8-7.8a1.4 1.4 0 0 1 1-.4ZM16.1 8.8a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z',
};

/** На iOS берём системные SF Symbols: их рисовал Apple, они совпадают по
 *  весу с системным шрифтом и анимируются штатно. Везде остальное — контуры. */
const SF: Record<string, SymbolViewProps['name']> = {
  home: 'house.fill',
  cal: 'calendar',
  chat: 'bubble.left.fill',
  kebab: 'ellipsis',
  plus: 'plus',
  check: 'checkmark',
  video: 'video.fill',
  bowl: 'fork.knife',
  chevr: 'chevron.right',
  moon: 'moon.fill',
  sun: 'sun.max.fill',
  device: 'iphone',
  weight: 'scalemass.fill',
  close: 'xmark',
  tag: 'tag.fill',
  back: 'chevron.left',
  user: 'person.crop.circle',
  exit: 'rectangle.portrait.and.arrow.right',
};

export function Icon({ name, size = 22, color = '#fff', width = 1.75, animate }: {
  name: string; size?: number; color?: string; width?: number;
  /** Анимировать появление символа — только на iOS */
  animate?: boolean;
}) {
  if (Platform.OS === 'ios' && SF[name]) {
    return (
      <SymbolView
        name={SF[name]}
        size={size}
        tintColor={color}
        type="monochrome"
        weight={width >= 2.2 ? 'semibold' : 'medium'}
        animationSpec={animate ? { effect: { type: 'bounce' } } : undefined}
        fallback={<Outline name={name} size={size} color={color} width={width} />}
      />
    );
  }
  return <Outline name={name} size={size} color={color} width={width} />;
}

function Outline({ name, size, color, width }:
  { name: string; size: number; color: string; width: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={PATHS[name] ?? PATHS.home} stroke={color} strokeWidth={width}
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
