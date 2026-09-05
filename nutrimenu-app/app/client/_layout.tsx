import React from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useApp } from '../../src/store';
import { Icon } from '../../src/ui/Icon';
import { haptic } from '../../src/haptics';

/**
 * Нижняя панель — настоящая системная, та же, что у Apple в своих
 * приложениях и у Телеграма. Своя реализация повторить её не могла:
 * стеклянный бегунок там не заливка, а линза, и перетекает он средствами
 * системы, недоступными снаружи.
 *
 * Плата за это — перелистывание страниц пальцем. У системной панели его
 * нет: у Apple и в Телеграме вкладки тоже переключаются только нажатием.
 */
export default function ClientTabs() {
  const { p } = useApp();
  return (
    <NativeTabs tintColor={p.primary}>
      {/* Системная полка над панелью — место для быстрого действия.
          Раньше «+» была отдельной плавающей кнопкой рядом. */}
      <NativeTabs.BottomAccessory>
        <Pressable
          onPress={() => { haptic.tap(); router.push('/weight'); }}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, paddingVertical: 12, paddingHorizontal: 18,
            opacity: pressed ? 0.6 : 1,
          })}>
          <Icon name="plus" size={19} color={p.primary} width={2.2} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: p.primary }}>
            Записать вес
          </Text>
        </Pressable>
      </NativeTabs.BottomAccessory>

      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house" />
        <NativeTabs.Trigger.Label>Сегодня</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="week">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>Неделя</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon sf="bubble.left" />
        <NativeTabs.Trigger.Label>Чат</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon sf="ellipsis" />
        <NativeTabs.Trigger.Label>Ещё</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
