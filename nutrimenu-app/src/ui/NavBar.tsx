import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useApp } from '../store';
import { Icon } from './Icon';
import { haptic } from '../haptics';

/** Компактная шапка: заголовок по центру, «назад» слева — как в системе.
 *  Крупный заголовок оставлен экранам-витринам («Сегодня»), а разделам
 *  он съедает экран, ради которого их и открывают. */
export function NavBar({ title, back }: { title: string; back?: boolean }) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: p.bg }}>
      <View style={{ height: 44, justifyContent: 'center' }}>
        <Text style={{
          fontSize: 17, fontWeight: '600', color: p.text, textAlign: 'center',
        }}>{title}</Text>
        {back ? (
          <Pressable
            onPress={() => { haptic.tap(); router.back(); }}
            hitSlop={12}
            style={({ pressed }) => ({
              position: 'absolute', left: 12, height: 44, width: 44,
              alignItems: 'flex-start', justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}>
            <Icon name="back" size={22} color={p.primary} width={2.2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
