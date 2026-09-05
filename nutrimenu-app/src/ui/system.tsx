/**
 * Системные компоненты.
 *
 * Всё, что iOS умеет рисовать сама — кнопки, ползунки, календарь, графики,
 * подтверждения, свайпы и пустые состояния — берём у неё. Своя реализация
 * рядом с системной всегда выдаёт себя мелочами: тем, как капля стекла
 * догоняет палец, как гаснет нажатие, как список отдаёт свайп обратно.
 *
 * Каждый компонент здесь — пара: системный вариант и запасной. Запасной
 * работает в вебе и там, где нативных модулей нет; он проще, но живой,
 * а не заглушка.
 */
import React, { useState } from 'react';
import { View, Text, Platform, Pressable, Alert, LayoutChangeEvent } from 'react-native';
import { useApp } from '../store';
import { S, R, FONT } from '../theme';
import { hasExpoUI } from '../native';
import { Icon } from './Icon';
import { haptic } from '../haptics';

export const sysNative = hasExpoUI && Platform.OS === 'ios';

/* ---------------------------------------------------------------- кнопка */

export type SysVariant = 'prominent' | 'plainGlass' | 'quiet' | 'destructive';

/**
 * Кнопка в системном исполнении: стеклянная капсула, нажатие и отклик
 * от самой системы.
 */
export function SysButton({ label, onPress, variant = 'plainGlass', icon, width, height = 52, disabled }: {
  label: string;
  onPress?: () => void;
  /** prominent — заливка для главного действия, plainGlass — прозрачная */
  variant?: SysVariant;
  /** Системный символ слева от подписи */
  icon?: string;
  width?: number;
  height?: number;
  disabled?: boolean;
}) {
  const { p } = useApp();
  if (!sysNative) {
    return <SysButtonPlain label={label} onPress={onPress} variant={variant} disabled={disabled} />;
  }
  const { Host, Button } = require('@expo/ui/swift-ui');
  const m = require('@expo/ui/swift-ui/modifiers');
  const style = variant === 'prominent' ? 'glassProminent' : variant === 'quiet' ? 'plain' : 'glass';
  const mods = [m.frame({ maxWidth: 9999 }), m.buttonStyle(style), m.buttonBorderShape('capsule')];
  if (disabled) mods.push(m.disabled(true));
  return (
    <Host style={{ height, width }} colorScheme={p.name === 'light' ? 'light' : 'dark'}
      seedColor={variant === 'destructive' ? p.danger : p.primary}>
      <Button label={label} systemImage={icon as any} onPress={onPress}
        role={variant === 'destructive' ? 'destructive' : undefined}
        modifiers={mods} />
    </Host>
  );
}

function SysButtonPlain({ label, onPress, variant, disabled }: {
  label: string; onPress?: () => void; variant: SysVariant; disabled?: boolean;
}) {
  const { p } = useApp();
  const filled = variant === 'prominent';
  const tint = variant === 'destructive' ? p.danger : p.primary;
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => ({
        paddingVertical: 14, paddingHorizontal: S.xl, borderRadius: R.pill,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? p.primary : variant === 'quiet' ? 'transparent' : p.ov2,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}>
      <Text style={{ ...FONT.h3, color: filled ? p.onPrimary : tint }}>{label}</Text>
    </Pressable>
  );
}

/* --------------------------------------------------------- пустое состояние */

/**
 * Значок, заголовок и пояснение расставляет сама система — получается
 * ровно то же пустое состояние, что в «Почте» или «Заметках».
 */
export function Empty({ icon, title, note, height = 240 }: {
  /** Имя системного символа */
  icon: string;
  title: string;
  note?: string;
  height?: number;
}) {
  const { p } = useApp();
  if (sysNative) {
    const { Host, ContentUnavailableView } = require('@expo/ui/swift-ui');
    return (
      <Host style={{ minHeight: height }} matchContents
        colorScheme={p.name === 'light' ? 'light' : 'dark'} seedColor={p.primary}>
        <ContentUnavailableView title={title} systemImage={icon} description={note} />
      </Host>
    );
  }
  return (
    <View style={{ alignItems: 'center', paddingVertical: S.xxl, paddingHorizontal: S.xl }}>
      <View style={{
        width: 52, height: 52, borderRadius: R.lg, backgroundColor: p.primarySoft,
        alignItems: 'center', justifyContent: 'center', marginBottom: S.lg,
      }}>
        <Icon name="bowl" size={24} color={p.primary} />
      </View>
      <Text style={{ ...FONT.h3, color: p.text, textAlign: 'center' }}>{title}</Text>
      {note ? (
        <Text style={{ ...FONT.small, color: p.text3, textAlign: 'center', marginTop: S.sm, lineHeight: 18 }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------- ползунок */

/**
 * Ползунок граммовки. Системный знает про инерцию пальца, тонкую
 * подстройку при медленном ведении и отдаёт щелчок на шаге — руками это
 * не повторить.
 */
export function SysSlider({ value, min, max, step = 10, onChange, onCommit, tint }: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Сохранение — когда палец отпущен, а не на каждом кадре */
  onCommit?: (v: number) => void;
  tint?: string;
}) {
  const { p } = useApp();
  if (sysNative) {
    const { Host, Slider } = require('@expo/ui/swift-ui');
    return (
      <Host style={{ height: 40 }} matchContents
        colorScheme={p.name === 'light' ? 'light' : 'dark'} seedColor={tint ?? p.primary}>
        <Slider
          value={value} min={min} max={max} step={step}
          onValueChange={(v: number) => onChange(Math.round(v))}
          onEditingChanged={(editing: boolean) => { if (!editing) onCommit?.(value); }}
        />
      </Host>
    );
  }
  return <SliderPlain value={value} min={min} max={max} step={step}
    onChange={onChange} onCommit={onCommit} tint={tint} />;
}

/** Запасной ползунок: та же шкала, ведётся пальцем по дорожке. */
function SliderPlain({ value, min, max, step, onChange, onCommit, tint }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; onCommit?: (v: number) => void; tint?: string;
}) {
  const { p } = useApp();
  const [w, setW] = useState(0);
  const c = tint ?? p.primary;
  const frac = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;

  const at = (x: number) => {
    if (!w) return;
    const raw = min + Math.max(0, Math.min(1, x / w)) * (max - min);
    onChange(Math.round(raw / step) * step);
  };

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => at(e.nativeEvent.locationX)}
      onResponderMove={(e) => at(e.nativeEvent.locationX)}
      onResponderRelease={() => onCommit?.(value)}
      style={{ height: 40, justifyContent: 'center' }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: p.track }}>
        <View style={{ width: `${frac * 100}%`, height: 4, borderRadius: 2, backgroundColor: c }} />
      </View>
      <View style={{
        position: 'absolute', left: Math.max(0, frac * w - 13),
        width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff',
        shadowColor: p.shadow, shadowOpacity: 0.22, shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 }, elevation: 3,
      }} />
    </View>
  );
}

/* --------------------------------------------------------- подтверждение */

/**
 * Подтверждение действия, которое нельзя отменить. Системный диалог
 * приезжает снизу, гасит экран и сам расставляет роли кнопок: опасное
 * действие красным, «Отмена» отдельно.
 */
export function SysConfirm({ label, title, message, confirmLabel, onConfirm, tint, destructive = true }: {
  /** Подпись кнопки, которая вызывает диалог */
  label: string;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  tint?: string;
  destructive?: boolean;
}) {
  const { p } = useApp();
  const [open, setOpen] = useState(false);
  const go = () => { haptic.warn(); onConfirm(); };

  if (sysNative) {
    const { Host, ConfirmationDialog, Button, Text: SText } = require('@expo/ui/swift-ui');
    const m = require('@expo/ui/swift-ui/modifiers');
    return (
      <Host matchContents colorScheme={p.name === 'light' ? 'light' : 'dark'} seedColor={p.primary}>
        <ConfirmationDialog title={title} isPresented={open}
          onIsPresentedChange={(v: boolean) => setOpen(v)}>
          <ConfirmationDialog.Trigger>
            <Button label={label} onPress={() => setOpen(true)}
              modifiers={[m.buttonStyle('plain'), m.foregroundStyle(tint ?? p.text3),
                m.font({ size: 13 })]} />
          </ConfirmationDialog.Trigger>
          <ConfirmationDialog.Actions>
            <Button label={confirmLabel} role={destructive ? 'destructive' : 'default'}
              onPress={() => { setOpen(false); go(); }} />
            <Button label="Отмена" role="cancel" onPress={() => setOpen(false)} />
          </ConfirmationDialog.Actions>
          {message ? (
            <ConfirmationDialog.Message><SText>{message}</SText></ConfirmationDialog.Message>
          ) : null}
        </ConfirmationDialog>
      </Host>
    );
  }

  return (
    <Pressable hitSlop={10}
      onPress={() => Alert.alert(title, message, [
        { text: 'Отмена', style: 'cancel' },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: go },
      ])}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      <Text style={{ ...FONT.small, color: tint ?? p.text3 }}>{label}</Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- даты */

/**
 * Календарь. Системный `DatePicker` в компактном виде: нажатие
 * раскрывает настоящий календарь месяца, а не наш рисунок.
 */
export function SysDate({ value, onChange, max, min }: {
  value: Date;
  onChange: (d: Date) => void;
  max?: Date;
  min?: Date;
}) {
  const { p } = useApp();
  if (sysNative) {
    const { Host, DatePicker } = require('@expo/ui/swift-ui');
    const m = require('@expo/ui/swift-ui/modifiers');
    return (
      <Host style={{ height: 40 }} matchContents
        colorScheme={p.name === 'light' ? 'light' : 'dark'} seedColor={p.primary}>
        <DatePicker
          title=""
          selection={value}
          range={{ start: min, end: max }}
          displayedComponents={['date']}
          onDateChange={onChange}
          modifiers={[m.datePickerStyle('compact'), m.labelsHidden()]}
        />
      </Host>
    );
  }
  return <DatePlain value={value} onChange={onChange} min={min} max={max} />;
}

/** Запасной выбор даты: шаг на день назад и вперёд в пределах диапазона. */
function DatePlain({ value, onChange, min, max }: {
  value: Date; onChange: (d: Date) => void; min?: Date; max?: Date;
}) {
  const { p } = useApp();
  const shift = (days: number) => {
    const d = new Date(value); d.setDate(d.getDate() + days);
    if (min && d < min) return;
    if (max && d > max) return;
    haptic.select(); onChange(d);
  };
  const arrow = (dir: -1 | 1) => (
    <Pressable onPress={() => shift(dir)} hitSlop={8}
      style={({ pressed }) => ({
        width: 34, height: 34, borderRadius: 17, backgroundColor: p.inset,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
        transform: [{ rotate: dir < 0 ? '180deg' : '0deg' }],
      })}>
      <Icon name="chevr" size={14} color={p.text2} width={2} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      {arrow(-1)}
      <Text style={{ ...FONT.body, color: p.text, flex: 1, textAlign: 'center' }}>
        {value.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>
      {arrow(1)}
    </View>
  );
}

/* -------------------------------------------------------------- график */

/**
 * График веса. На iOS — Swift Charts: те же оси, та же анимация
 * перестроения и то же поведение при повороте, что в «Здоровье».
 */
export function SysChart({ points, color, height = 150 }: {
  points: { x: string; y: number }[];
  color?: string;
  height?: number;
}) {
  const { p } = useApp();
  const c = color ?? p.mp;
  if (sysNative) {
    const { Host, Chart } = require('@expo/ui/swift-ui');
    return (
      <Host style={{ height }} colorScheme={p.name === 'light' ? 'light' : 'dark'} seedColor={c}>
        <Chart
          data={points}
          type="line"
          animate
          showGrid
          lineStyle={{ color: c, width: 2, pointStyle: 'circle', pointSize: 5 }}
        />
      </Host>
    );
  }
  return <ChartPlain points={points} color={c} height={height} />;
}

/** Запасной график: линия с заливкой под ней — как в вебе. */
function ChartPlain({ points, color, height }: {
  points: { x: string; y: number }[]; color: string; height: number;
}) {
  const Svg = require('react-native-svg');
  const { default: SvgRoot, Polyline, Polygon, Circle, Defs, LinearGradient, Stop } = Svg;
  const W = 320, H = height, PX = 8, PY = 18, n = points.length;
  if (n < 2) return <View style={{ height }} />;
  const v = points.map(pt => pt.y);
  const mn = Math.min(...v), mx = Math.max(...v);
  const pad = (mx - mn) * 0.3 || 1, lo = mn - pad, hi = mx + pad;
  const X = (i: number) => PX + i * (W - 2 * PX) / (n - 1);
  const Y = (val: number) => PY + (hi - val) / (hi - lo) * (H - 2 * PY);
  const pts = v.map((val, i) => `${X(i).toFixed(1)},${Y(val).toFixed(1)}`).join(' ');
  return (
    <SvgRoot width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.16" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points={`${PX},${H} ${pts} ${W - PX},${H}`} fill="url(#wg)" />
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={X(0)} cy={Y(v[0])} r={3} fill={color} />
      <Circle cx={X(n - 1)} cy={Y(v[n - 1])} r={4.5} fill={color} />
    </SvgRoot>
  );
}
