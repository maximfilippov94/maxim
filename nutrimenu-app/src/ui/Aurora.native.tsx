import React from 'react';
import { MeshGradientView } from 'expo-mesh-gradient';
import { useApp } from '../store';

/* Сетчатый градиент: девять узлов, цвета взяты из палитры и уведены от
   фона всего на пару шагов — свечение должно читаться как глубина,
   а не как цветное пятно поверх интерфейса. */
export const Aurora = ({ style }: { style?: any }) => {
  const { p } = useApp();
  const dark = p.name !== 'light';
  return (
    <MeshGradientView
      style={style}
      columns={3}
      rows={3}
      colors={dark
        ? ['#101C2C', '#122436', '#101C2C',
           '#122E32', '#16283A', '#101C2C',
           '#101C2C', '#122436', '#101C2C']
        : ['#F2F4F7', '#E9EEF6', '#F2F4F7',
           '#EAF3EF', '#FFFFFF', '#EEF1F6',
           '#F2F4F7', '#E9EEF6', '#F2F4F7']}
      points={[
        [0, 0], [0.5, 0], [1, 0],
        [0, 0.5], [0.5, 0.5], [1, 0.5],
        [0, 1], [0.5, 1], [1, 1],
      ]}
    />
  );
};
