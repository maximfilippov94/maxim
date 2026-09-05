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
/**
 * Быстрые действия — системное меню, а не своя всплывашка: раскрытие,
 * стекло и отклик на нажатие делает сама система. Состав повторяет
 * быстрые действия из веба, ничего нового здесь не заводится.
 */
function QuickAdd() {
  const { p } = useApp();
  const { Host, Menu, Button } = require('@expo/ui/swift-ui');
  const go = (to: '/weight' | '/water') => { haptic.tap(); router.push(to); };
  return (
    <Host style={{ height: 52 }} colorScheme={p.name === 'light' ? 'light' : 'dark'}>
      {/* Подпись самой кнопки задаётся свойством label, дети — это пункты
          меню. Если отдать подпись первым ребёнком, кнопка остаётся
          безымянной и выглядит пустой капсулой. */}
      <Menu label="Записать" systemImage="plus.circle.fill">
        <Button label="Вес" systemImage="scalemass" onPress={() => go('/weight')} />
        <Button label="Воду" systemImage="drop.fill" onPress={() => go('/water')} />
      </Menu>
    </Host>
  );
}

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
        selected: { color: p.primary },
      }}>
      {/* Системная полка над панелью — место для быстрого действия.
          Раньше «+» была отдельной плавающей кнопкой рядом. */}
      <NativeTabs.BottomAccessory>
        <QuickAdd />
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
