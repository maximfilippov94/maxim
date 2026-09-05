import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import PagerView from 'react-native-pager-view';
import Animated, { useEvent, useHandler } from 'react-native-reanimated';
import type { PagerHandle, PagerProps } from './Pager';

const AnimatedPager = Animated.createAnimatedComponent(PagerView);

/* Прокрутка приходит на UI-поток: линза считается там же и едет за пальцем
   кадр в кадр, а не догоняет его через мост. */
function usePagerScrollHandler(handlers: { onPageScroll: (e: any) => void }) {
  const { doDependenciesDiffer } = useHandler(handlers as any, []);
  return useEvent<any>((event) => {
    'worklet';
    if (event.eventName.endsWith('onPageScroll')) handlers.onPageScroll(event);
  }, ['onPageScroll'], doDependenciesDiffer);
}

export const Pager = forwardRef<PagerHandle, PagerProps>(
  ({ progress, onIndex, children }, ref) => {
    const pager = useRef<PagerView>(null);
    useImperativeHandle(ref, () => ({ setPage: (i) => pager.current?.setPage(i) }));

    const onScroll = usePagerScrollHandler({
      onPageScroll: (e) => {
        'worklet';
        progress.value = e.position + e.offset;
      },
    });

    return (
      <AnimatedPager
        ref={pager}
        style={{ flex: 1 }}
        initialPage={0}
        onPageScroll={onScroll}
        onPageSelected={(e: any) => onIndex?.(e.nativeEvent.position)}
        overdrag>
        {children}
      </AnimatedPager>
    );
  },
);
Pager.displayName = 'Pager';
