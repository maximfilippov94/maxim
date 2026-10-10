import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, runOnJS } from 'react-native-reanimated';
import type { PagerHandle, PagerProps } from './Pager';

/* У react-native-pager-view нет веб-реализации, поэтому в браузере
   подставляем горизонтальную прокрутку с прилипанием. Ощущение не то же
   самое, но разметка и поведение линзы проверяются полностью. */
export const Pager = forwardRef<PagerHandle, PagerProps>(
  ({ progress, onIndex, children }, ref) => {
    const { width } = useWindowDimensions();
    const sv = useRef<Animated.ScrollView>(null);
    const last = useRef(0);

    useImperativeHandle(ref, () => ({
      setPage: (i) => sv.current?.scrollTo({ x: i * width, animated: true }),
    }));

    const report = (i: number) => {
      if (i !== last.current) { last.current = i; onIndex?.(i); }
    };

    const onScroll = useAnimatedScrollHandler((e) => {
      const pos = e.contentOffset.x / Math.max(1, width);
      progress.value = pos;
      runOnJS(report)(Math.round(pos));
    });

    return (
      <Animated.ScrollView
        ref={sv}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={{ flex: 1 }}>
        {React.Children.map(children, (c, i) => (
          <View key={i} style={{ width }}>{c}</View>
        ))}
      </Animated.ScrollView>
    );
  },
);
Pager.displayName = 'Pager';
