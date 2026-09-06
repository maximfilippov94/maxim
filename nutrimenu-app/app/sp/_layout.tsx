import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { router, usePathname } from 'expo-router';
import { useApp } from '../../src/store';
import { hasExpoUI } from '../../src/native';
import { haptic } from '../../src/haptics';

/**
 * Вкладки кабинета специалиста — те же системные, что у клиента:
 * панель рисует UIKit, поэтому стекло, размытие и линза настоящие.
 */
function QuickAdd() {
  const { p } = useApp();
  if (!hasExpoUI) return null;
  const { Host, Menu, Button } = require('@expo/ui/swift-ui');
  return (
    <Host style={{ height: 52 }} colorScheme={p.name === 'light' ? 'light' : 'dark'}
      seedColor={p.primary}>
      <Menu label="Открыть" systemImage="plus.circle.fill">
        <Button label="Клиенты" systemImage="person.2"
          onPress={() => { haptic.tap(); router.push('/sp/clients'); }} />
        <Button label="База блюд" systemImage="fork.knife"
          onPress={() => { haptic.tap(); router.push('/sp-dishes'); }} />
      </Menu>
    </Host>
  );
}

export default function SpTabs() {
  const { p } = useApp();
  /* Полка нужна на рабочих вкладках; в чате она мешает строке ввода */
  const path = usePathname();
  const quick = path === '/sp' || path === '/sp/clients';
  return (
    <NativeTabs
      tintColor={p.primary}
      blurEffect={p.name === 'light' ? 'systemChromeMaterialLight' : 'systemChromeMaterialDark'}
      iconColor={{ default: p.text2, selected: p.primary }}
      labelStyle={{ default: { color: p.text2 }, selected: { color: p.accent } }}>
      {quick ? (
        <NativeTabs.BottomAccessory><QuickAdd /></NativeTabs.BottomAccessory>
      ) : null}
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
