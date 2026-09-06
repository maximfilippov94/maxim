/**
 * Заставка перед входом — разворот из брендбука: кадр с листьями во весь
 * экран, логотип по центру, слоган под ним и две кнопки внизу.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { S, R, FONT } from '../src/theme';
import { Logo } from '../src/ui/Logo';
import { haptic } from '../src/haptics';

const GREEN = '#2E7D63';

export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#121820' }}>
      <Image source={require('../assets/leaves.jpg')} style={StyleSheet.absoluteFill}
        contentFit="cover" transition={400} cachePolicy="memory-disk" />
      {/* Кадр показываем почти как есть: затемняем только низ, чтобы
          кнопки не спорили с бликами на листьях. */}
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={['rgba(18,24,32,0.25)', 'rgba(18,24,32,0.10)', 'rgba(18,24,32,0.86)']}
        locations={[0, 0.42, 1]}
      />

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center' }}>
          <Logo width={230} color="#FFFFFF" />
          <Text style={{
            marginTop: S.xl, textAlign: 'center', color: 'rgba(255,255,255,0.86)',
            fontSize: 13, fontWeight: '600', letterSpacing: 4.5, lineHeight: 24,
          }}>
            ПИТАНИЕ{'\n'}ДВИЖЕНИЕ{'\n'}РЕЗУЛЬТАТ
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(120).duration(420)}
        style={{ paddingHorizontal: S.xl, paddingBottom: insets.bottom + S.xl, gap: S.md }}>
        <BigButton title="Войти" filled onPress={() => { haptic.tap(); router.push('/login'); }} />
        <BigButton title="Зарегистрироваться"
          onPress={() => { haptic.tap(); router.push('/register'); }} />
      </Animated.View>
    </View>
  );
}

function BigButton({ title, filled, onPress }: {
  title: string; filled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        height: 54, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? GREEN : 'rgba(18,24,32,0.72)',
        borderWidth: filled ? 0 : 1, borderColor: 'rgba(255,255,255,0.18)',
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}>
      <Text style={{ ...FONT.h3, fontSize: 16, color: '#FFFFFF' }}>{title}</Text>
    </Pressable>
  );
}
