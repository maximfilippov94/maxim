import React, { useEffect, useState } from 'react';
import { Text, TextStyle } from 'react-native';
import {
  useSharedValue, useDerivedValue, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';

/**
 * Число, которое набегает до нового значения, а не подменяется разом.
 *
 * Скачок читается как «подставили другое число», плавный счёт — как
 * «стало больше»; разница в ощущении, а не в данных.
 *
 * Округляем до десятков: показывать каждый миллилитр незачем, а редкие
 * обновления сами по себе сокращают перерисовки — на одинаковом
 * значении React ничего не делает.
 */
export function Counter({ value, style, duration = 420 }: {
  value: number;
  style?: TextStyle;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const v = useSharedValue(value);

  useEffect(() => {
    v.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value, duration, v]);

  useDerivedValue(() => {
    runOnJS(setShown)(Math.round(v.value / 10) * 10);
  });

  return <Text style={style}>{shown}</Text>;
}
