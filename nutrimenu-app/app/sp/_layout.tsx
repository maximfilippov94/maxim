import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useApp } from '../../src/store';

/**
 * Вкладки кабинета специалиста — те же системные, что у клиента:
 * панель рисует UIKit, поэтому стекло, размытие и линза настоящие.
 *
 * Значки — наши, из `src/ui/Icon.tsx`, отпечатанные в PNG скриптом
 * `tools/tab-icons.mjs`. Системного символа нашей толщины не бывает: в
 * типах `NativeTabs` лежит только имя символа, вес задать нечем, и
 * рядом с нашим тонким контуром они читались тяжело. Заодно домик в
 * панели перестал отличаться от домика в списке «Ещё» — это был разный
 * рисунок. Режим `template`: цвет кладёт система, из `iconColor`.
 */
export default function SpTabs() {
  const { p, unread } = useApp();
  const sel = p.name === 'light' ? p.text : p.primary;
  return (
    /* Выделенная вкладка: в тёмной теме лайм, в светлой — чернила.
       Те же цвета, что у клиента: панель одна и та же. */
    <NativeTabs
      tintColor={sel}
      blurEffect={p.name === 'light' ? 'systemChromeMaterialLight' : 'systemChromeMaterialDark'}
      iconColor={{ default: p.text3, selected: sel }}
      labelStyle={{ default: { color: p.text3 }, selected: { color: sel } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon renderingMode="template"
          src={require('../../assets/tabs/home.png')} />
        <NativeTabs.Trigger.Label>Главная</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="clients">
        <NativeTabs.Trigger.Icon renderingMode="template"
          src={require('../../assets/tabs/users.png')} />
        <NativeTabs.Trigger.Label>Клиенты</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Третья вкладка — то, с чем специалист работает каждый день:
          у тренера программы, у остальных база блюд. Как в вебе. */}
      <NativeTabs.Trigger name="work">
        <NativeTabs.Trigger.Icon renderingMode="template"
          src={require('../../assets/tabs/grid.png')} />
        <NativeTabs.Trigger.Label>Работа</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chats">
        <NativeTabs.Trigger.Icon renderingMode="template"
          src={require('../../assets/tabs/chat.png')} />
        <NativeTabs.Trigger.Label>Чат</NativeTabs.Trigger.Label>
        {/* Сколько сообщений ждут ответа. Число приходит вместе со списком
            клиентов — его считают «Клиенты» и «Чаты» при загрузке. */}
        {unread ? <NativeTabs.Trigger.Badge>{String(unread)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon renderingMode="template"
          src={require('../../assets/tabs/kebab.png')} />
        <NativeTabs.Trigger.Label>Ещё</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
