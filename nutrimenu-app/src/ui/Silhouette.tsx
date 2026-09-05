import React from 'react';
import Svg, { Path, Defs, ClipPath, Rect, G } from 'react-native-svg';
import Animated, {
  useAnimatedProps, useDerivedValue, withRepeat, withTiming, Easing, SharedValue,
} from 'react-native-reanimated';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/* Контуры присланы отдельными файлами, сетка 240×720. Фигура занимает
   по вертикали с 28-й по 689-ю — замерено по фактическим границам, а не
   по холсту: иначе первые глотки уходили бы под ступни, а последние
   плескались бы выше макушки. */
const W = 240, H = 720, TOP = 28, BOT = 689, BODY_H = BOT - TOP;

const BODY = {
  m: 'M120 28C91 28 78 45 78 69c0 22 9 38 22 47v23c-11 8-24 14-41 20-17 6-25 22-25 45l5 99c1 23 9 44 19 63l12 24 3 102c0 23-4 49-5 74l-2 95c0 17 8 28 21 28 12 0 18-8 18-23l3-98 12-48 12 48 3 98c0 15 6 23 18 23 13 0 21-11 21-28l-2-95c-1-25-5-51-5-74l3-102 12-24c10-19 18-40 19-63l5-99c0-23-8-39-25-45-17-6-30-12-41-20v-23c13-9 22-25 22-47 0-24-13-41-42-41z',
  f: 'M120 28c-20 0-33 14-33 32 0 6 2 11 6 16-10 6-15 15-14 26 1 11 8 18 19 23v18c-10 8-21 14-36 20-14 6-21 20-22 41l4 88c1 24 8 46 17 67l11 25 6 94c1 23-5 49-7 74l-4 109c0 17 7 28 20 28 12 0 18-8 19-23l4-103 10-47 10 47 4 103c1 15 7 23 19 23 13 0 20-11 20-28l-4-109c-2-25-8-51-7-74l6-94 11-25c9-21 16-43 17-67l4-88c-1-21-8-35-22-41-15-6-26-12-36-20v-18c11-5 18-12 19-23 1-11-4-20-14-26 4-5 6-10 6-16 0-18-13-32-33-32z',
};

/**
 * Контур человека, наполняющийся водой.
 *
 * Вода — прямоугольник, обрезанный по внутренней области контура: так
 * её граница всегда совпадает с фигурой. Контур поверх воды обводится
 * ещё раз, иначе линия тонет в заливке у краёв.
 *
 * Поверхность колышется бесконечной волной — без неё вода выглядит
 * налитым цветом, а не жидкостью.
 */
export function Silhouette({ fill, sex, water, line, size = 260 }: {
  /** Доля заполнения, 0…1. Общая величина, чтобы уровень ехал плавно. */
  fill: SharedValue<number>;
  sex?: string | null;
  /** Цвет воды */
  water: string;
  /** Цвет обводки */
  line: string;
  size?: number;
}) {
  const body = sex === 'm' ? BODY.m : BODY.f;

  /* Фаза волны: один проход слева направо, бесконечно */
  const phase = useDerivedValue(() =>
    withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false), []);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const level = useAnimatedProps(() => {
    const top = BOT - clamp(fill.value) * BODY_H;
    return { y: top, height: Math.max(0, H - top) };
  });

  /* Гребень: четыре дуги шириной в полхолста, съезжающие вбок */
  const wave = useAnimatedProps(() => {
    const top = BOT - clamp(fill.value) * BODY_H;
    const x = -W + phase.value * W;
    const a = 13, half = W / 2;
    return {
      d: `M${x} ${top} q${half / 2} ${-a} ${half} 0 t${half} 0 t${half} 0 t${half} 0 V${H} H${x} Z`,
    };
  });

  return (
    <Svg width={size * (W / H)} height={size} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <ClipPath id="body"><Path d={body} /></ClipPath>
      </Defs>
      <G clipPath="url(#body)">
        <AnimatedRect x={0} width={W} fill={water} animatedProps={level} />
        <AnimatedPath fill={water} animatedProps={wave} />
      </G>
      <Path d={body} fill="none" stroke={line} strokeWidth={5}
        strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
