import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../store';
import { hasMeshGradient } from '../native';

/* Мягкое свечение на фоне. Сетчатый градиент рисует переходы между
   несколькими точками, а не по одной оси, — свет выглядит естественнее.
   Где его нет (Expo Go), берём линейный: композиция та же, тоньше эффект. */
export const Aurora = ({ style }: { style?: any }) => {
  const { p } = useApp();
  const dark = p.name !== 'light';
  const colors: [string, string, string] = dark
    ? ['#122E32', '#101C2C', '#122436']
    : ['#EAF3EF', '#F2F4F7', '#E9EEF6'];

  if (!hasMeshGradient) {
    return (
      <LinearGradient style={style} colors={colors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    );
  }

  const { MeshGradientView } = require('expo-mesh-gradient');
  return (
    <MeshGradientView
      style={style}
      columns={3}
      rows={3}
      colors={[
        colors[0], colors[1], colors[2],
        colors[1], colors[2], colors[0],
        colors[2], colors[0], colors[1],
      ]}
      points={[
        [0, 0], [0.5, 0], [1, 0],
        [0, 0.5], [0.5, 0.5], [1, 0.5],
        [0, 1], [0.5, 1], [1, 1],
      ]}
    />
  );
};
