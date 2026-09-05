import React from 'react';
import Svg, { Path, Defs, ClipPath, Rect, G } from 'react-native-svg';
import Animated, { useAnimatedProps, useDerivedValue, withRepeat, withTiming, Easing, SharedValue } from 'react-native-reanimated';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/* Контуры в сетке 100×240. Различаются плечами, талией и бёдрами —
   этого достаточно, чтобы силуэт узнавался, и мало, чтобы он не
   превратился в карикатуру. */
const BODY = {
  m: 'M50 6c-7 0-12 5-12 12s5 13 12 13 12-6 12-13S57 6 50 6ZM50 34c-9 0-16 3-21 8l-14 15c-3 3-3 8 0 11s8 3 11 0l8-9v29l-4 60c-1 5 3 9 8 9s8-3 9-8l6-44 6 44c1 5 5 8 9 8s9-4 8-9l-4-60V59l8 9c3 3 8 3 11 0s3-8 0-11L66 42c-5-5-12-8-21-8Z',
  f: 'M50 6c-7 0-12 5-12 12s5 13 12 13 12-6 12-13S57 6 50 6ZM50 34c-8 0-15 3-19 8L18 57c-3 3-3 8 0 11s8 3 11 0l7-8 2 24-6 30c-1 4 2 8 6 8l-3 55c0 5 4 9 9 9s8-4 8-9l3-38 3 38c0 5 4 9 8 9s9-4 9-9l-3-55c4 0 7-4 6-8l-6-30 2-24 7 8c3 3 8 3 11 0s3-8 0-11L69 42c-4-5-11-8-19-8Z',
};

/**
 * Силуэт, наполняющийся водой.
 *
 * Уровень — обычный прямоугольник, обрезанный по контуру тела: так
 * граница воды всегда совпадает с фигурой, чем бы её ни рисовали.
 * Поверхность колышется бесконечной волной — без неё вода выглядит
 * налитым цветом, а не жидкостью.
 */
export function Silhouette({ fill, sex, water, dim, size = 240 }: {
  /** Доля заполнения, 0…1. Общая величина, чтобы уровень ехал плавно. */
  fill: SharedValue<number>;
  sex?: string | null;
  water: string;
  dim: string;
  size?: number;
}) {
  const H = 240, W = 100;
  const body = sex === 'm' ? BODY.m : BODY.f;

  /* Фаза волны: один проход слева направо, бесконечно */
  const phase = useDerivedValue(() =>
    withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false), []);

  const level = useAnimatedProps(() => {
    const top = H - Math.max(0, Math.min(1, fill.value)) * H;
    return { y: top + 6, height: Math.max(0, H - top) };
  });

  /* Гребень волны: две дуги, съезжающие вбок */
  const wave = useAnimatedProps(() => {
    const top = H - Math.max(0, Math.min(1, fill.value)) * H;
    const x = -W + phase.value * W;
    const a = 5;
    return {
      d: `M${x} ${top + 6}
          q${W / 4} ${-a} ${W / 2} 0 t${W / 2} 0 t${W / 2} 0 t${W / 2} 0
          V${H} H${x} Z`,
    };
  });

  return (
    <Svg width={size * (W / H)} height={size} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <ClipPath id="body"><Path d={body} /></ClipPath>
      </Defs>
      {/* Пустой силуэт — он же граница */}
      <Path d={body} fill={dim} />
      <G clipPath="url(#body)">
        <AnimatedRect x={0} width={W} fill={water} animatedProps={level} />
        <AnimatedPath fill={water} animatedProps={wave} />
      </G>
    </Svg>
  );
}
