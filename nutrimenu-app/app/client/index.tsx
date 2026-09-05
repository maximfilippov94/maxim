import React, { useCallback, useRef, useState } from 'react';
import { View, Pressable, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useApp } from '../../src/store';
import { TabBar, TabDef } from '../../src/ui/TabBar';
import { GlassGroup } from '../../src/ui/Glass';
import { Icon } from '../../src/ui/Icon';
import { Pager, PagerHandle } from '../../src/ui/Pager';
import { haptic } from '../../src/haptics';
import Today from '../../src/screens/Today';
import More from '../../src/screens/More';
import Stub from '../../src/screens/Stub';

const TABS: TabDef[] = [
  { key: 'today', label: 'Сегодня', icon: 'home' },
  { key: 'week', label: 'Неделя', icon: 'cal' },
  { key: 'chat', label: 'Чат', icon: 'chat' },
  { key: 'more', label: 'Ещё', icon: 'kebab' },
];

export default function ClientShell() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pager = useRef<PagerHandle>(null);
  const progress = useSharedValue(0);
  const [page, setPage] = useState(0);

  const select = useCallback((i: number) => {
    if (i !== page) haptic.tap();
    pager.current?.setPage(i);
    setPage(i);
  }, [page]);

  /* Перелистывание пальцем тоже отзывается — иначе жест и нажатие
     ощущаются как разные по «весу» действия. */
  const onIndex = useCallback((i: number) => {
    setPage(prev => { if (prev !== i) haptic.select(); return i; });
  }, []);

  const fabSize = 58;
  const gap = 12;
  const barWidth = width - 14 * 2 - fabSize - gap;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Pager ref={pager} progress={progress} onIndex={onIndex}>
        <View key="today"><Today /></View>
        <View key="week">
          <Stub title="Неделя" note="Меню на семь дней с раскладкой по приёмам пищи. Экран в работе." />
        </View>
        <View key="chat">
          <Stub title="Чат" note="Переписка со специалистом и видеозвонки. Экран в работе." />
        </View>
        <View key="more"><More /></View>
      </Pager>

      <GlassGroup
        spacing={gap}
        style={{ position: 'absolute', left: 14, right: 14, bottom: insets.bottom + 12 }}>
        <TabBar tabs={TABS} progress={progress} onSelect={select} width={barWidth} />
        <Pressable
          onPress={() => { haptic.tap(); router.push('/weight'); }}
          style={({ pressed }) => ({
            width: fabSize, height: fabSize, borderRadius: fabSize / 2,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: p.primary,
            transform: [{ scale: pressed ? 0.94 : 1 }],
            shadowColor: p.shadow, shadowOpacity: 0.32, shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 }, elevation: 6,
          })}>
          <Icon name="plus" size={26} color={p.onPrimary} width={2.2} />
        </Pressable>
      </GlassGroup>
    </View>
  );
}
