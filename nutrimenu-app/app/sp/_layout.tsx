import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useApp } from '../../src/store';

/**
 * Вкладки кабинета специалиста — те же системные, что у клиента:
 * панель рисует UIKit, поэтому стекло, размытие и линза настоящие.
 */
export default function SpTabs() {
  const { p } = useApp();
  return (
    <NativeTabs
      tintColor={p.primary}
      blurEffect={p.name === 'light' ? 'systemChromeMaterialLight' : 'systemChromeMaterialDark'}
      iconColor={{ default: p.text2, selected: p.primary }}
      labelStyle={{ default: { color: p.text2 }, selected: { color: p.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house" />
        <NativeTabs.Trigger.Label>Главная</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="clients">
        <NativeTabs.Trigger.Icon sf="person.2" />
        <NativeTabs.Trigger.Label>Клиенты</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chats">
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
