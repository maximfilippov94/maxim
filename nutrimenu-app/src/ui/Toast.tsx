/**
 * Короткое сообщение поверх экрана: «+10 баллов» с возможностью отменить,
 * «Сохранено», «Не вышло».
 *
 * Почему свой, а не системный Alert: Alert перехватывает нажатия и требует
 * закрыть себя кнопкой, а здесь нужно уведомление, которое не мешает дальше
 * отмечать блюда. Всплывает над доком и уходит само.
 *
 * Сообщение с действием («Отменить») живёт дольше простого и принимает
 * нажатия; простое — нет, иначе невидимая полоса перехватывала бы касания
 * по списку под ней.
 *
 * Держится внутри безопасной зоны и ограничено шириной экрана: длинная
 * подпись переносится, а не уезжает за край.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store';
import { S, R, FONT, LAYOUT, MOTION } from '../theme';
import { Icon } from './Icon';
import { haptic } from '../haptics';

type Kind = 'ok' | 'err' | 'award';

export interface ToastOptions {
  kind?: Kind;
  /** Вторая строка помельче: что именно отмечено. */
  sub?: string;
  /** Подпись кнопки действия. Без неё сообщение не принимает нажатия. */
  actionLabel?: string;
  onAction?: () => void;
  /** Сколько держать на экране. По умолчанию 1.6 с, с действием — 6 с. */
  ms?: number;
}

interface Msg extends ToastOptions { text: string; id: number }

const Ctx = createContext<(text: string, opt?: ToastOptions) => void>(() => {});

/** Показать сообщение из любого места: `const toast = useToast()`. */
export function useToast() { return useContext(Ctx); }

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<Msg | null>(null);
  const seq = useRef(0);

  const show = useCallback((text: string, opt: ToastOptions = {}) => {
    seq.current += 1;
    setMsg({ ...opt, text, id: seq.current });
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg ? <ToastView key={msg.id} msg={msg} onDone={() => setMsg(null)} /> : null}
    </Ctx.Provider>
  );
}

function ToastView({ msg, onDone }: { msg: Msg; onDone: () => void }) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(24);
  const o = useSharedValue(0);
  const hasAction = !!(msg.actionLabel && msg.onAction);

  useEffect(() => {
    o.value = withTiming(1, { duration: MOTION.standard });
    y.value = withSpring(0, MOTION.spring);
    const life = msg.ms ?? (hasAction ? 6000 : 1600);
    const t = setTimeout(() => {
      o.value = withTiming(0, { duration: MOTION.standard }, done => {
        if (done) runOnJS(onDone)();
      });
      y.value = withTiming(16, { duration: MOTION.standard });
    }, life);
    return () => clearTimeout(t);
    /* Намеренно только по идентификатору сообщения: добавить сюда
       остальное — значит перезапускать таймер на каждый кадр анимации,
       и уведомление никогда не исчезнет. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg.id]);

  const anim = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }],
  }));

  const award = msg.kind === 'award';
  const bad = msg.kind === 'err';
  /* Поверх дока, но не вплотную: док, его отступ и безопасная зона. */
  const bottom = LAYOUT.dockHeight + LAYOUT.dockGap + insets.bottom + S.md;
  const fg = award ? p.onPrimary : bad ? '#FFFFFF' : p.text;

  return (
    <Animated.View
      pointerEvents={hasAction ? 'box-none' : 'none'}
      style={[styles.wrap, { bottom, left: LAYOUT.screenPad, right: LAYOUT.screenPad }, anim]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: award ? p.primary : bad ? p.danger : p.surface,
            borderColor: award || bad ? 'transparent' : p.border,
            shadowColor: p.shadow,
          },
        ]}
      >
        {award ? <Icon name="check" size={17} color={fg} /> : null}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[FONT.callout, styles.text, { color: fg }]}>
            {msg.text}
          </Text>
          {msg.sub ? (
            <Text numberOfLines={1} style={[FONT.caption, { color: fg, opacity: 0.72 }]}>
              {msg.sub}
            </Text>
          ) : null}
        </View>
        {hasAction ? (
          <Pressable
            onPress={() => { haptic.select(); msg.onAction?.(); onDone(); }}
            hitSlop={10}
            style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[FONT.callout, { color: fg, fontWeight: '700' }]}>{msg.actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    minHeight: LAYOUT.touch,
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    borderRadius: R.pill,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    width: '100%',
  },
  text: { fontWeight: '600' },
  action: { minHeight: LAYOUT.touch, justifyContent: 'center', paddingLeft: S.sm },
});
