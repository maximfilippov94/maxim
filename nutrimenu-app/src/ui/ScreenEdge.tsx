/**
 * Верхний край экрана.
 *
 * Экраны начинаются под вырезом — отступ на него уже заложен. Но при
 * прокрутке содержимое уезжает прямо под часы и значок батареи, и белая
 * карточка сталкивается с чёрными цифрами системы. iOS решает это
 * «краем прокрутки»: узкая полоса матового стекла под статус-строкой,
 * сквозь которую содержимое видно, но не спорит с ним.
 *
 * Именно стекло, а не заливка цветом фона: на экранах вроде карточки
 * блюда под статус-строку уходит фотография, и сплошная плашка легла бы
 * на неё серой полосой. Стекло матирует и фон, и снимок одинаково.
 *
 * Нажатия не перехватывает и на телефонах без выреза схлопывается в ноль.
 */
import React from 'react';
import { View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store';

export function ScreenEdge() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  if (!insets.top) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top }}>
      <BlurView
        intensity={32}
        tint={p.name === 'light' ? 'systemChromeMaterialLight' : 'systemChromeMaterialDark'}
        experimentalBlurMethod="dimezisBlurView"
        style={{ flex: 1 }}
      />
    </View>
  );
}
