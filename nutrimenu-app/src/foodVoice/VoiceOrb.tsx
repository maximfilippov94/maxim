import React, { useEffect, useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, FeGaussianBlur, Filter, G, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const FluidPath = Animated.createAnimatedComponent(Path);

/** A filled, softly shaded sphere, animated on the UI thread. */
export function VoiceOrb({ level, processing }: { level: number; processing: boolean }) {
  const id = useId().replace(/:/g, ''), reduced = useReducedMotion();
  const volume = useSharedValue(0), phase = useSharedValue(0);
  useEffect(() => { volume.value = withTiming(level, { duration: 140 }); }, [level, volume]);
  useEffect(() => {
    cancelAnimation(phase);
    if (!reduced) phase.value = withRepeat(withTiming(phase.value + Math.PI * 2, { duration: processing ? 4800 : 10500, easing: Easing.linear }), -1);
    else phase.value = 0;
    return () => cancelAnimation(phase);
  }, [processing, reduced, phase]);
  const shape = useAnimatedStyle(() => ({ transform: [{ scale: reduced ? 1 : 1 + volume.value * .075 }] }));
  const lower = useAnimatedProps(() => {
    const t = reduced ? 0 : phase.value, a = reduced ? 0 : volume.value * 14;
    return { d: `M-20 144 C16 ${78 + Math.sin(t) * 20 - a},74 ${167 + Math.cos(t) * 24},119 ${110 + Math.sin(t + 1) * 24} S190 ${36 + Math.cos(t) * 22},220 75 L220 220 L-20 220Z` };
  });
  const upper = useAnimatedProps(() => {
    const t = reduced ? 0 : phase.value, a = reduced ? 0 : volume.value * 12;
    return { d: `M-20 19 C37 ${125 + Math.sin(t + 2) * 18 + a},89 ${13 + Math.cos(t) * 23},144 ${72 + Math.sin(t) * 16} S199 160,220 148 L220 -20 L-20 -20Z` };
  });
  return <View accessible={false} style={{ height: 184, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={[{ width: 122, height: 122 }, shape]}>
      <Svg width="122" height="122" viewBox="0 0 200 200">
        <Defs>
          <Filter id={`${id}soft`} x="-30%" y="-30%" width="160%" height="160%"><FeGaussianBlur stdDeviation="9" /></Filter>
          <ClipPath id={`${id}clip`}><Circle cx="100" cy="100" r="98" /></ClipPath>
          <RadialGradient id={`${id}base`} cx="32%" cy="24%" rx="88%" ry="88%">
            <Stop offset="0" stopColor="#FAFCEB" /><Stop offset=".42" stopColor="#E9F0CA" />
            <Stop offset=".78" stopColor="#C7D39A" /><Stop offset="1" stopColor="#82935C" />
          </RadialGradient>
          <RadialGradient id={`${id}lime`} cx="70%" cy="72%" rx="76%" ry="76%">
            <Stop offset="0" stopColor="#DFFF3A" stopOpacity=".86" /><Stop offset=".57" stopColor="#B7CC6C" stopOpacity=".58" />
            <Stop offset="1" stopColor="#B7CC6C" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}light`} cx="27%" cy="25%" rx="85%" ry="85%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity=".92" /><Stop offset=".55" stopColor="#F5F8E7" stopOpacity=".5" />
            <Stop offset="1" stopColor="#F5F8E7" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <G clipPath={`url(#${id}clip)`}>
          <Circle cx="100" cy="100" r="98" fill={`url(#${id}base)`} />
          <G filter={`url(#${id}soft)`}>
            <FluidPath animatedProps={lower} fill={`url(#${id}lime)`} />
            <FluidPath animatedProps={upper} fill={`url(#${id}light)`} />
          </G>
        </G>
      </Svg>
    </Animated.View>
  </View>;
}
