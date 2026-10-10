/**
 * Кольцевой индикатор доли — тот же, что в вебе (`ring()` в `app.js`,
 * `.ring2` в `components.css`).
 *
 * В вебе кольцо рисует `conic-gradient`, здесь — дуга на SVG: результат
 * совпадает по размеру, толщине и цветам. Толщина берётся из веба: 9 для
 * колец от 64 px и 7 для меньших.
 *
 * Дуга идёт от двенадцати часов по часовой стрелке и обрезается сотней
 * процентов: перебор показывается цветом, а не вторым витком — иначе
 * 140 % и 40 % выглядят одинаково.
 */
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useApp } from '../store';

export function Ring({ pct, size = 84, label, color, track }: {
  /** Доля в процентах; за пределы 0…100 не выходит */
  pct: number;
  size?: number;
  /** Надпись в центре; по умолчанию — те же проценты */
  label?: string;
  color?: string;
  track?: string;
}) {
  const { p } = useApp();
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  const th = size >= 64 ? 9 : 7;
  const r = size / 2 - th / 2;
  const c = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} strokeWidth={th}
          stroke={track ?? p.track} fill="none" />
        {v > 0 && (
          <Circle cx={size / 2} cy={size / 2} r={r} strokeWidth={th}
            stroke={color ?? p.primary} fill="none" strokeLinecap="round"
            strokeDasharray={`${(c * v) / 100} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )}
      </Svg>
      <Text style={{
        fontSize: size >= 84 ? 21 : 18, fontWeight: '600',
        letterSpacing: -0.5, color: p.text,
      }}>
        {label ?? `${v}%`}
      </Text>
    </View>
  );
}
