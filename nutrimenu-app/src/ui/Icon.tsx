import React from 'react';
import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { hasSymbols } from '../native';

/** Контуры для Android и веба: сетка 24×24, обводка 1.75. */
export const PATHS: Record<string, string> = {
  home: 'M4.2 10.7 11.1 4.6a1.4 1.4 0 0 1 1.8 0l6.9 6.1M6.4 9.6v8.9a1.7 1.7 0 0 0 1.7 1.7h7.8a1.7 1.7 0 0 0 1.7-1.7V9.6M9.9 20.2v-4.4a2.1 2.1 0 0 1 4.2 0v4.4',
  cal: 'M5.5 6.4h13a1.9 1.9 0 0 1 1.9 1.9v10.4a1.9 1.9 0 0 1-1.9 1.9h-13a1.9 1.9 0 0 1-1.9-1.9V8.3a1.9 1.9 0 0 1 1.9-1.9ZM3.6 11h16.8M8.2 3.6v4M15.8 3.6v4',
  chat: 'M20.4 11.6a7.9 7.9 0 0 1-11.3 7.2L3.6 20.4l1.6-5.3a7.9 7.9 0 1 1 15.2-3.5Z',
  kebab: 'M12 6.6a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 19.4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  plus: 'M12 5.2v13.6M5.2 12h13.6',
  check: 'M5.4 12.6 9.8 17l8.8-9.4',
  video: 'M4.3 7.6a2 2 0 0 1 2-2h7.2a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H6.3a2 2 0 0 1-2-2ZM15.5 10.9l3.4-2.4a.7.7 0 0 1 1.1.6v5.8a.7.7 0 0 1-1.1.6l-3.4-2.4Z',
  cart: 'M3.2 4.4h2.1l2.2 9.8a1.6 1.6 0 0 0 1.6 1.3h7.5a1.6 1.6 0 0 0 1.6-1.2l1.4-5.9H6.2M9.6 19.6a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2ZM17.2 19.6a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z',
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
  send: 'M20.4 3.6 3.6 10.4l6.6 2.9 2.9 6.6ZM10.2 13.3 20.4 3.6',
  gift: 'M4.4 11.4h15.2v8a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6ZM3.6 7.6h16.8v3.8H3.6ZM12 7.6V21M12 7.6C10.6 4.4 8.8 3 7.4 3.6c-1.6.7-1.4 3.3 4.6 4M12 7.6c1.4-3.2 3.2-4.6 4.6-4 1.6.7 1.4 3.3-4.6 4',
  bell: 'M12 3.6a5.6 5.6 0 0 1 5.6 5.6c0 4.4 1.6 5.9 1.6 5.9H4.8s1.6-1.5 1.6-5.9A5.6 5.6 0 0 1 12 3.6ZM10.2 18.6a1.9 1.9 0 0 0 3.6 0',
  star: 'M12 3.8l2.5 5.3 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8Z',
  flame: 'M12 3.6s5.4 4 5.4 8.8a5.4 5.4 0 0 1-10.8 0c0-2 1.2-3.4 1.2-3.4s.6 1.6 1.8 1.6c1.4 0 2.4-4 2.4-7Z',
  trophy: 'M7.6 4h8.8v5a4.4 4.4 0 0 1-8.8 0ZM7.6 5.6H5a1 1 0 0 0-1 1c0 2 1.4 3.6 3.6 3.8M16.4 5.6H19a1 1 0 0 1 1 1c0 2-1.4 3.6-3.6 3.8M9.6 20.4h4.8M12 13.4v7',
  trend: 'M3.8 16.6 9.2 11l3.4 3.4 7.6-7.6M20.2 6.8h-4.6M20.2 6.8v4.6',
  edit: 'M4.4 19.6h4l10-10a2 2 0 0 0-2.8-2.8l-10 10ZM14.4 5.6l4 4',
  drop: 'M12 3.4s5.8 6.2 5.8 10a5.8 5.8 0 0 1-11.6 0c0-3.8 5.8-10 5.8-10Z',
  heart: 'M12 20s-7.6-4.6-7.6-9.6a4.2 4.2 0 0 1 7.6-2.4 4.2 4.2 0 0 1 7.6 2.4c0 5-7.6 9.6-7.6 9.6Z',
  clip: 'M19 11.4 12 18.4a4.2 4.2 0 0 1-6-6l7.6-7.6a2.8 2.8 0 0 1 4 4l-7.6 7.6a1.4 1.4 0 0 1-2-2l7-7',
  mic: 'M12 3.6a2.6 2.6 0 0 1 2.6 2.6v5.2a2.6 2.6 0 0 1-5.2 0V6.2A2.6 2.6 0 0 1 12 3.6ZM6 11a6 6 0 0 0 12 0M12 17v3.4M9 20.4h6',
  play: 'M8 5.4 18.4 12 8 18.6Z',
  pause: 'M9.4 5.6v12.8M14.6 5.6v12.8',
};

/** На iOS берём системные SF Symbols: их рисовал Apple, они совпадают по
 *  весу с системным шрифтом и анимируются штатно. Везде остальное — контуры. */
/* Только контурные начертания: в системе есть и залитые, но смесь
   тяжёлых и лёгких иконок в одном ряду читается как небрежность. */
export const SF: Record<string, SymbolViewProps['name']> = {
  home: 'house',
  cal: 'calendar',
  chat: 'bubble.left',
  kebab: 'ellipsis',
  plus: 'plus',
  check: 'checkmark',
  video: 'video',
  bowl: 'fork.knife',
  cart: 'cart',
  chevr: 'chevron.right',
  moon: 'moon',
  sun: 'sun.max',
  device: 'iphone',
  weight: 'scalemass',
  close: 'xmark',
  tag: 'tag',
  back: 'chevron.left',
  user: 'person.crop.circle',
  exit: 'rectangle.portrait.and.arrow.right',
  send: 'paperplane',
  gift: 'gift',
  bell: 'bell',
  star: 'star',
  flame: 'flame',
  trophy: 'trophy',
  trend: 'chart.line.uptrend.xyaxis',
  edit: 'square.and.pencil',
  drop: 'drop',
  heart: 'heart',
  clip: 'paperclip',
  mic: 'mic',
  play: 'play.fill',
  pause: 'pause.fill',
};

export function Icon({ name, size = 22, color = '#fff', width = 1.75, animate }: {
  name: string; size?: number; color?: string; width?: number;
  /** Анимировать появление символа — только на iOS */
  animate?: boolean;
}) {
  /* Без нативного модуля SymbolView нарисует красную заглушку вместо
     иконки, поэтому спрашиваем, а не полагаемся на платформу. */
  if (Platform.OS === 'ios' && hasSymbols && SF[name]) {
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
