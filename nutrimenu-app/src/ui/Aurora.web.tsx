import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../store';

/* Сетчатого градиента в вебе нет — подставляем линейный по диагонали.
   Для превью этого достаточно: проверяется композиция, а не сам эффект. */
export const Aurora = ({ style }: { style?: any }) => {
  const { p } = useApp();
  const dark = p.name !== 'light';
  return (
    <LinearGradient
      style={style}
      colors={dark ? ['#122E32', '#101C2C', '#122436'] : ['#EAF3EF', '#F2F4F7', '#E9EEF6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    />
  );
};
