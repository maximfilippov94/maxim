import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useApp } from '../store';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { haptic } from '../haptics';

/** Компактная шапка: заголовок по центру, «назад» слева — как в системе.
 *  Без заголовка остаётся только строка возврата: она нужна экранам
 *  с крупным заголовком под ней, по образцу «Сегодня».
 *  С `logo` вместо названия стоит знак: цвет берётся у темы — тёмный на
 *  светлой, белый на тёмной. */
export function NavBar({ title, back, logo, right, onBack }: {
  title?: string; back?: boolean; logo?: boolean;
  /** Действие справа: «плюс» на списках, «Сохранить» на формах */
  right?: React.ReactNode;
  /** Куда возвращаться, если не на предыдущий экран. Нужно там, где
   *  внутри одного экрана есть свои шаги: «назад» из переписки ведёт к
   *  списку обращений, а не прочь из поддержки. */
  onBack?: () => void;
}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: p.bg }}>
      <View style={{ height: 44, justifyContent: 'center', alignItems: 'center' }}>
        {logo ? (
          <Logo width={96} color={p.text} />
        ) : (
          <Text style={{
            fontSize: 17, fontWeight: '600', color: p.text, textAlign: 'center',
          }}>{title ?? ''}</Text>
        )}
        {back ? (
          <Pressable
            onPress={() => { haptic.tap(); onBack ? onBack() : router.back(); }}
            hitSlop={12}
            style={({ pressed }) => ({
              position: 'absolute', left: 12, height: 44, width: 44,
              alignItems: 'flex-start', justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}>
            <Icon name="back" size={22} color={p.primary} width={2.2} />
          </Pressable>
        ) : null}
        {right ? (
          <View style={{
            position: 'absolute', right: 12, height: 44,
            alignItems: 'flex-end', justifyContent: 'center',
          }}>
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}
