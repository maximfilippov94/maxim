import React from 'react';
import Svg, { Defs, Mask, Image as SvgImage, Rect, Path, G } from 'react-native-svg';
import Animated, {
  useAnimatedProps, useDerivedValue, withRepeat, withTiming, Easing, SharedValue,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/* Рисунки присланы обводкой; внутренняя область достроена из контура.
   Пропорции у мужской и женской разные — держим отдельно. */
const FIG = {
  f: { src: require('../../assets/body-f.png'), ratio: 409 / 1283 },
  m: { src: require('../../assets/body-m.png'), ratio: 483 / 1281 },
};

/* Работаем в сетке 1000 по высоте: с целыми числами удобнее считать
   волну, а сама фигура растягивается до нужного размера. */
const H = 1000;

/**
 * Силуэт, наполняющийся водой.
 *
 * Фигура задаёт маску, и всё, что внутри, обрезается точно по её краю.
 * Благодаря этому граница воды может быть какой угодно формы — здесь
 * это бегущая волна, а не прямая полоса: прямая читается как заливка,
 * волна — как жидкость.
 */
export function Silhouette({ fill, sex, water, base, height = 340 }: {
  /** Доля заполнения, 0…1 */
  fill: SharedValue<number>;
  sex?: string | null;
  water: string;
  /** Цвет пустого тела */
  base: string;
  height?: number;
}) {
  const fig = sex === 'm' ? FIG.m : FIG.f;
  const W = Math.round(H * fig.ratio);

  /* Фаза бега волны: один проход слева направо, бесконечно */
  const phase = useDerivedValue(() =>
    withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false), []);

  const wave = useAnimatedProps(() => {
    const v = Math.max(0, Math.min(1, fill.value));
    const top = H - v * H;
    /* У краёв волне взяться неоткуда: пустое тело и полное — ровные */
    const a = v > 0.02 && v < 0.98 ? H * 0.021 : 0;
    /* Волна вдвое шире фигуры и уезжает на свою длину — стык незаметен */
    const len = W * 2;
    const x = -len + phase.value * len;
    const q = len / 4;
    return {
      d: `M${x} ${top} q${q / 2} ${-a} ${q} 0 t${q} 0 t${q} 0 t${q} 0 t${q} 0 t${q} 0`
        + ` L${x + len * 1.5} ${H} L${x} ${H} Z`,
    };
  });

  return (
    <Svg width={height * fig.ratio} height={height} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <Mask id="body" maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
          <SvgImage href={fig.src} x={0} y={0} width={W} height={H}
            preserveAspectRatio="none" />
        </Mask>
      </Defs>
      {/* Пустое тело */}
      <Rect x={0} y={0} width={W} height={H} fill={base} mask="url(#body)" />
      {/* Вода: всё, что ниже волны, обрезано по фигуре */}
      <G mask="url(#body)">
        <AnimatedPath fill={water} animatedProps={wave} />
      </G>
    </Svg>
  );
}
