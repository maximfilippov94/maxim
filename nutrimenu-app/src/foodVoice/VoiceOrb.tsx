import React, { useEffect, useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const Fluid = Animated.createAnimatedComponent(Path);

/** Layered translucent liquid, not an image: paths move on the UI thread. */
export function VoiceOrb({ level, processing }: { level: number; processing: boolean }) {
  const id = useId().replace(/:/g, ''), reduced = useReducedMotion();
  const volume = useSharedValue(0), phase = useSharedValue(0);
  useEffect(() => { volume.value = withTiming(Math.max(0, Math.min(1, level)), { duration: 160 }); }, [level, volume]);
  useEffect(() => {
    cancelAnimation(phase);
    if (!reduced) phase.value = withRepeat(withTiming(phase.value + Math.PI * 2, { duration: processing ? 6200 : 14000, easing: Easing.linear }), -1);
    else phase.value = 0;
    return () => cancelAnimation(phase);
  }, [processing, reduced, phase]);
  const shape = useAnimatedStyle(() => ({ transform: [{ scale: reduced ? 1 : 1 + volume.value * .045 }] }));
  const lower = useAnimatedProps(() => {
    const t = reduced ? 0 : phase.value, a = reduced ? 0 : volume.value * 12;
    return { d: `M-12 109 C${28 + Math.sin(t) * 13} ${38 - a},49 ${146 + Math.cos(t) * 14},105 ${126 + Math.sin(t) * 16} C154 ${104 - a},154 ${39 + Math.cos(t) * 18},211 78 L214 220 L-12 220Z` };
  });
  const upper = useAnimatedProps(() => {
    const t = reduced ? 0 : phase.value, a = reduced ? 0 : volume.value * 10;
    return { d: `M-15 18 C54 -12,174 14,170 ${51 + Math.sin(t) * 14} C166 ${94 + a},${106 + Math.cos(t) * 18} ${30 + a},87 85 C65 130,20 ${53 + Math.sin(t) * 18},-15 111Z` };
  });
  const fold = useAnimatedProps(() => {
    const t = reduced ? 0 : phase.value;
    return { d: `M-9 128 C25 ${60 + Math.cos(t) * 12},63 ${157 + Math.sin(t) * 12},105 135 C148 ${115 + Math.cos(t) * 10},182 122,210 99 C170 172,136 ${124 + Math.sin(t) * 12},99 154 C55 184,26 117,-9 159Z` };
  });
  const lens = useAnimatedProps(() => {
    const t = reduced ? 0 : phase.value, y = Math.sin(t) * 6;
    return { d: `M27 ${96+y} C13 ${84+y},15 139,39 156 C68 178,96 ${153-y},86 ${123-y} C79 104,50 ${115+y},27 ${96+y}Z` };
  });
  return <View accessible={false} style={{ height: 230, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={[{ width: 166, height: 166 }, shape]}>
      <Svg width="166" height="166" viewBox="0 0 200 200">
        <Defs>
          <ClipPath id={`${id}clip`}><Circle cx="100" cy="100" r="98" /></ClipPath>
          <RadialGradient id={`${id}base`} cx="34%" cy="24%" rx="86%" ry="86%">
            <Stop offset="0" stopColor="#FFFFF5" /><Stop offset=".42" stopColor="#E8EEC2" />
            <Stop offset=".77" stopColor="#C3D36D" /><Stop offset="1" stopColor="#86944B" />
          </RadialGradient>
          <RadialGradient id={`${id}pool`} cx="32%" cy="42%" rx="66%" ry="73%">
            <Stop offset="0" stopColor="#758747" stopOpacity=".86" /><Stop offset=".44" stopColor="#B8CE61" stopOpacity=".86" />
            <Stop offset=".76" stopColor="#E7F89B" stopOpacity=".72" /><Stop offset="1" stopColor="#FBFFE3" stopOpacity=".12" />
          </RadialGradient>
          <RadialGradient id={`${id}light`} cx="34%" cy="28%" rx="72%" ry="74%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" /><Stop offset=".52" stopColor="#FAFFE5" stopOpacity=".8" />
            <Stop offset=".84" stopColor="#F0F7CC" stopOpacity=".16" /><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}fold`} cx="60%" cy="55%" rx="65%" ry="60%">
            <Stop offset="0" stopColor="#F9FFE8" stopOpacity=".84" /><Stop offset=".48" stopColor="#E5F4AB" stopOpacity=".36" />
            <Stop offset="1" stopColor="#DFFF3A" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}lens`} cx="31%" cy="38%" rx="76%" ry="72%">
            <Stop offset="0" stopColor="#839258" stopOpacity=".7" /><Stop offset=".42" stopColor="#BECF7C" stopOpacity=".65" />
            <Stop offset=".73" stopColor="#FBFFE5" stopOpacity=".78" /><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}shine`} cx="30%" cy="21%" rx="65%" ry="65%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity=".6" /><Stop offset=".24" stopColor="#FFFFFF" stopOpacity=".16" />
            <Stop offset=".66" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <G clipPath={`url(#${id}clip)`}>
          <Circle cx="100" cy="100" r="98" fill={`url(#${id}base)`} />
          <Fluid animatedProps={lower} fill={`url(#${id}pool)`} />
          <Fluid animatedProps={upper} fill={`url(#${id}light)`} />
          <Fluid animatedProps={fold} fill={`url(#${id}fold)`} />
          <Fluid animatedProps={lens} fill={`url(#${id}lens)`} />
          <Circle cx="100" cy="100" r="98" fill={`url(#${id}shine)`} />
        </G>
      </Svg>
    </Animated.View>
  </View>;
}
