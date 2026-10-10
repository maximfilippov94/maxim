import { SharedValue } from 'react-native-reanimated';
import * as React from 'react';

export interface PagerHandle { setPage(index: number): void }
export interface PagerProps {
  /** Непрерывная позиция: 0 … n−1, дробная во время жеста. */
  progress: SharedValue<number>;
  onIndex?: (index: number) => void;
  children: React.ReactNode;
}
export const Pager: React.ForwardRefExoticComponent<
  PagerProps & React.RefAttributes<PagerHandle>
>;
