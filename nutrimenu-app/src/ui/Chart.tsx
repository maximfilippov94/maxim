/**
 * График по точкам — один на все экраны, где показывают динамику.
 *
 * Отдельный модуль, а не функция внутри `system.tsx`, по двум причинам.
 * Во-первых, график — не «системный компонент»: на iOS его рисует Swift
 * Charts, а в вебе и на Android свой чертёж, и обе ветки нужно держать
 * рядом, чтобы вторая не отставала от первой. Во-вторых, кривых со
 * временем в приложении будет больше одной: вес, замеры, вода, выручка
 * специалиста — и каждая следующая должна получать оси и подписи
 * готовыми, а не заводить их заново.
 *
 * Запасной чертёж повторяет веб (`weightChart` в app.js): заливка под
 * линией, четыре подписи по вертикали, даты первой и последней точки и
 * значение у последней. Без них линия — просто узор: по ней не сказать,
 * семьдесят это килограммов или девяносто.
 */
import React, { useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Polygon, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useApp } from '../store';
import { FONT } from '../theme';

/** Точка кривой: `x` — подпись (дата), `y` — значение. */
export interface ChartPoint { x: string; y: number }

export interface ChartProps {
  points: ChartPoint[];
  color?: string;
  height?: number;
  /** Подписывать ли оси и крайние точки. Выключают там, где график
      идёт строкой внутри плитки и места под подписи нет. */
  labels?: boolean;
  /** Как показывать значение в подписях. По умолчанию — целое. */
  fmt?: (v: number) => string;
}

/**
 * Чертёж по точкам. Ширину берёт по факту измерения, а не из
 * фиксированного `viewBox`: при постоянном viewBox и заданной высоте
 * график не растягивается на ширину экрана, а остаётся узкой полосой
 * по центру.
 */
export function LineChart({ points, color, height = 150, labels = true, fmt }: ChartProps) {
  const { p } = useApp();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next && next !== w) setW(next);
  };

  const c = color ?? p.mp;
  const n = points.length;
  const num = (v: number) => (fmt ? fmt(v) : String(Math.round(v)));

  /* До первого измерения рисовать нечего — отдаём место нужной высоты,
     чтобы при появлении кривой ничего не подпрыгнуло. */
  if (!w || n < 2) return <View onLayout={onLayout} style={{ height }} />;

  const v = points.map(pt => pt.y);
  const mn = Math.min(...v), mx = Math.max(...v);
  /* Коридор шире разброса: иначе кривая прижимается к краям, а при
     одинаковых значениях делится на ноль. */
  const pad = (mx - mn) * 0.3 || 1;
  const lo = mn - pad, hi = mx + pad;

  const PL = labels ? 34 : 8;          // слева — подписи значений
  const PR = 10;
  const PT = labels ? 24 : 14;         // сверху — значение последней точки
  const PB = labels ? 22 : 14;         // снизу — даты

  const X = (i: number) => PL + i * (w - PL - PR) / (n - 1);
  const Y = (val: number) => PT + (hi - val) / (hi - lo) * (height - PT - PB);
  const pts = v.map((val, i) => `${X(i).toFixed(1)},${Y(val).toFixed(1)}`).join(' ');
  const base = height - PB + 8;

  const step = (hi - lo) / 3;

  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id="eqline" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c} stopOpacity="0.16" />
            <Stop offset="1" stopColor={c} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Polygon points={`${PL},${base} ${pts} ${w - PR},${base}`} fill="url(#eqline)" />

        {labels ? [0, 1, 2, 3].map(i => {
          const val = lo + step * i;
          return (
            <SvgText key={i} x={2} y={Y(val) + 3} fill={p.text3}
              fontSize={FONT.label.fontSize} textAnchor="start">{num(val)}</SvgText>
          );
        }) : null}

        <Polyline points={pts} fill="none" stroke={c} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Точки только по краям: с кружком на каждой записи кривая из
            двадцати измерений превращается в пунктир. */}
        <Circle cx={X(0)} cy={Y(v[0])} r={3} fill={c} />
        <Circle cx={X(n - 1)} cy={Y(v[n - 1])} r={4.5} fill={c} />

        {labels ? (
          <>
            <SvgText x={X(n - 1)} y={Y(v[n - 1]) - 11} fill={p.text}
              fontSize={FONT.caption.fontSize} fontWeight="600" textAnchor="end">
              {num(v[n - 1])}
            </SvgText>
            <SvgText x={X(0)} y={height - 6} fill={p.text3}
              fontSize={FONT.label.fontSize} textAnchor="start">{points[0].x}</SvgText>
            <SvgText x={X(n - 1)} y={height - 6} fill={p.text3}
              fontSize={FONT.label.fontSize} textAnchor="end">{points[n - 1].x}</SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}
