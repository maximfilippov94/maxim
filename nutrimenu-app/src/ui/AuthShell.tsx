/**
 * Оболочка входа и регистрации по развороту брендбука: сверху кадр с
 * листьями и белый логотип, ниже — тёмный лист с формой. Экран одинаков
 * в обеих темах: снимок тёмный, и тёмная надпись на нём не читалась бы.
 */
import React from 'react';
import {
  View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform,
  TextInput, TextInputProps, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { S, R, FONT } from '../theme';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { haptic } from '../haptics';

/** Цвета листа с формой: обычная палитра здесь не работает. */
export const ON_PHOTO = {
  sheet: '#1A222C',
  text: '#FFFFFF',
  text2: 'rgba(255,255,255,0.72)',
  text3: 'rgba(255,255,255,0.52)',
  field: 'rgba(255,255,255,0.06)',
  fieldBorder: 'rgba(255,255,255,0.14)',
  card: 'rgba(255,255,255,0.08)',
  primary: '#2E7D63',
  accent: '#4CA585',
  onPrimary: '#FFFFFF',
};

export function AuthShell({ children, back }: {
  children: React.ReactNode;
  /** Стрелка назад поверх кадра */
  back?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const photo = Math.round(height * 0.34);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: ON_PHOTO.sheet }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        bounces={false}>

        <View style={{ height: photo }}>
          <Image source={require('../../assets/leaves.jpg')}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover" transition={300} cachePolicy="memory-disk" />
          {/* Низ кадра уводим в цвет листа, чтобы стык не читался полосой */}
          <LinearGradient
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
            colors={['rgba(18,24,32,0.34)', 'rgba(18,24,32,0.20)', 'rgba(26,34,44,0.92)']}
            locations={[0, 0.5, 1]}
          />
          <View style={{
            position: 'absolute', left: 0, right: 0, bottom: 44, alignItems: 'center',
          }}>
            <Logo width={186} color="#FFFFFF" />
            <Text style={{
              marginTop: 10, color: 'rgba(255,255,255,0.80)',
              fontSize: 10.5, fontWeight: '600', letterSpacing: 3,
            }}>
              ПИТАНИЕ · ДВИЖЕНИЕ · РЕЗУЛЬТАТ
            </Text>
          </View>
          {back ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                /* На экран могли прийти по ссылке — тогда возвращаться некуда */
                if (router.canGoBack()) router.back(); else router.replace('/welcome');
              }}
              hitSlop={14}
              style={({ pressed }) => ({
                position: 'absolute', top: insets.top + 6, left: S.xl, opacity: pressed ? 0.5 : 1,
              })}>
              <Icon name="back" size={24} color="#FFFFFF" width={2.2} />
            </Pressable>
          ) : null}
        </View>

        <Animated.View entering={FadeInDown.duration(260)}
          style={{
            flex: 1, backgroundColor: ON_PHOTO.sheet,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            marginTop: -26, paddingHorizontal: S.xl, paddingTop: S.xxl,
            paddingBottom: insets.bottom + S.xxl,
          }}>
          {children}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Поле ввода с иконкой слева и необязательной кнопкой справа. */
export function Field({ icon, right, style, ...input }: TextInputProps & {
  icon: string; right?: React.ReactNode;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: S.md,
      backgroundColor: ON_PHOTO.field, borderRadius: R.md,
      borderWidth: 1, borderColor: ON_PHOTO.fieldBorder,
      paddingHorizontal: S.lg, marginBottom: S.md,
    }}>
      <Icon name={icon} size={19} color={ON_PHOTO.text3} width={1.7} />
      <TextInput
        placeholderTextColor={ON_PHOTO.text3}
        {...input}
        style={[{ flex: 1, paddingVertical: 15, fontSize: 16, color: ON_PHOTO.text }, style]}
      />
      {right}
    </View>
  );
}

/** Крупная кнопка листа: заливка — фирменный зелёный. */
export function AuthButton({ title, onPress, loading, ghost }: {
  title: string; onPress: () => void; loading?: boolean; ghost?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={loading}
      style={({ pressed }) => ({
        height: 52, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center',
        backgroundColor: ghost ? ON_PHOTO.card : ON_PHOTO.primary,
        borderWidth: ghost ? 1 : 0, borderColor: ON_PHOTO.fieldBorder,
        opacity: loading ? 0.6 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}>
      <Text style={{ ...FONT.h3, fontSize: 16, color: '#FFFFFF' }}>{title}</Text>
    </Pressable>
  );
}

/** Подпись поверх листа. */
export const Note = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <Text style={[{ ...FONT.small, color: ON_PHOTO.text2, lineHeight: 19 }, style]}>{children}</Text>
);

/** Поле ввода без иконки — для анкеты, где полей много. */
export const photoField = {
  backgroundColor: ON_PHOTO.field,
  color: ON_PHOTO.text,
  borderRadius: R.md,
  paddingHorizontal: S.lg,
  paddingVertical: 14,
  fontSize: 16,
  borderWidth: 1,
  borderColor: ON_PHOTO.fieldBorder,
} as const;
