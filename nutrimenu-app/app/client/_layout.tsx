import React from 'react';

import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useApp } from '../../src/store';

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
    /* Материал и цвета задаём явно. Панель системная, а переключатель
       темы наш: UIKit о нём не знает и берёт оформление у телефона —
       оттого на светлой теме панель выходила серой, если система была
       в тёмном режиме. */
    <NativeTabs
      tintColor={p.primary}
      blurEffect={p.name === 'light' ? 'systemChromeMaterialLight' : 'systemChromeMaterialDark'}
      iconColor={{ default: p.text2, selected: p.primary }}
      labelStyle={{
        default: { color: p.text2 },
        selected: { color: p.accent },
      }}>

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
