import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle, useDerivedValue, withRepeat, withTiming, Easing, SharedValue,
} from 'react-native-reanimated';

/* Рисунки присланы обводкой; внутренняя область достроена из контура,
   чтобы фигуру можно было заливать. Пропорции у мужской и женской
   разные — держим их отдельно, иначе слои не совпадут по краю. */
const FIG = {
  f: { src: require('../../assets/body-f.png'), ratio: 409 / 1283 },
  m: { src: require('../../assets/body-m.png'), ratio: 483 / 1281 },
};

/**
 * Силуэт, наполняющийся водой.
 *
 * Два одинаковых рисунка друг на друге: нижний окрашен приглушённо —
 * это пустое тело, верхний цветом воды и обрезан по уровню. Обрезка
 * идёт контейнером, прижатым к низу, поэтому граница воды всегда
 * горизонтальна, а края — точно по фигуре.
 *
 * Уровень слегка покачивается сам по себе: неподвижная вода выглядит
 * залитым цветом, а лёгкое движение читается как жидкость.
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
  const width = height * fig.ratio;

  /* Бесконечное покачивание: −1…1, период около трёх секунд */
  const bob = useDerivedValue(() =>
    withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true), []);

  const level = useAnimatedStyle(() => {
    const v = Math.max(0, Math.min(1, fill.value));
    /* Покачивание не трогает пустое и полное: там колыхаться нечему */
    const sway = v > 0.02 && v < 0.98 ? (bob.value * 2 - 1) * 3 : 0;
    return { height: Math.max(0, v * height + sway) };
  });

  return (
    <View style={{ width, height }}>
      <Image source={fig.src} tintColor={base} contentFit="fill"
        style={{ width, height, position: 'absolute', bottom: 0 }} />
      <Animated.View style={[{
        position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden',
      }, level]}>
        <Image source={fig.src} tintColor={water} contentFit="fill"
          style={{ width, height, position: 'absolute', bottom: 0 }} />
      </Animated.View>
    </View>
  );
}
