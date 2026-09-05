import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import PagerView from 'react-native-pager-view';
import Animated, {
  useEvent, useHandler, useSharedValue, withTiming, Easing,
} from 'react-native-reanimated';
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
    /* При жесте позиция берётся из прокрутки, при нажатии её ведём сами:
       программная смена страницы почти не шлёт событий прокрутки, и линза
       не ехала, а переставлялась. Пока ведём — прокрутку не слушаем,
       иначе две силы тянут одно значение и картинка дёргается. */
    const driving = useSharedValue(0);

    useImperativeHandle(ref, () => ({
      setPage: (i) => {
        driving.value = 1;
        progress.value = withTiming(
          i,
          { duration: 260, easing: Easing.out(Easing.cubic) },
          (finished) => { 'worklet'; if (finished) driving.value = 0; },
        );
        pager.current?.setPage(i);
      },
    }));

    const onScroll = usePagerScrollHandler({
      onPageScroll: (e) => {
        'worklet';
        if (driving.value) return;
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
