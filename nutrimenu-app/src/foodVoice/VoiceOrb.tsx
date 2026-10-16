import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation, useReducedMotion } from 'react-native-reanimated';
import { useApp } from '../store';

export function VoiceOrb({ level, processing }: { level: number; processing: boolean }) {
  const { p } = useApp();
  const reduced = useReducedMotion();
  const sound = useSharedValue(0), turn = useSharedValue(0);
  useEffect(() => { sound.value = withTiming(level, { duration: 100 }); }, [level, sound]);
  useEffect(() => {
    cancelAnimation(turn); turn.value = 0;
    if (!reduced) turn.value = withRepeat(withTiming(1, { duration: processing ? 2200 : 6000, easing: Easing.linear }), -1);
    return () => cancelAnimation(turn);
  }, [processing, reduced, turn]);
  const shape = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 + sound.value * .12 }, { rotate: `${turn.value * 360}deg` }],
  }));
  const ribbon = useAnimatedStyle(() => ({ opacity: .25 + sound.value * .6,
    transform: [{ rotate: '28deg' }, { scaleX: reduced ? 1 : .6 + sound.value * .6 }] }));
  return <View accessible={false} style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={[{ width: 106, height: 106, borderRadius: 53, backgroundColor: p.inset,
      borderWidth: 1, borderColor: p.border, overflow: 'hidden' }, shape]}>
      <View style={{ position: 'absolute', top: 9, left: 10, width: 85, height: 85, borderRadius: 44, backgroundColor: p.primarySoft }} />
      <Animated.View style={[{ position: 'absolute', top: -4, left: 24, width: 60, height: 115, borderRadius: 50,
        borderWidth: 13, borderColor: p.primary }, ribbon]} />
      <View style={{ position: 'absolute', top: 5, left: 22, width: 62, height: 97, borderRadius: 48,
        borderWidth: 1, borderColor: p.text3, opacity: .4, transform: [{ rotate: '-27deg' }] }} />
    </Animated.View>
  </View>;
}
