import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, SharedValue } from 'react-native-reanimated';
import { useApp } from '../store';
import { Glass, hasLiquidGlass } from './Glass';
import { Icon } from './Icon';

export interface TabDef { key: string; label: string; icon: string }

/**
 * Линза активной вкладки едет за пальцем: её позиция берётся не из индекса,
 * а из непрерывного смещения пейджера. Иначе она прыгает после отпускания,
 * и жест перестаёт ощущаться связанным с интерфейсом.
 */
export function TabBar({
  tabs, progress, active, onSelect, width, height = 62, gap = 6,
}: {
  tabs: TabDef[];
  progress: SharedValue<number>;
  /** Активная вкладка. Отдельно от progress: цвет меняется по факту
   *  смены страницы, а не по ходу жеста — иначе он мигает при возврате. */
  active: number;
  onSelect: (i: number) => void;
  width: number;
  height?: number;
  gap?: number;
}) {
  const { p } = useApp();
  const inner = width - gap * 2;
  const item = inner / tabs.length;

  const lens = useAnimatedStyle(() => ({
    transform: [{
      translateX: interpolate(
        progress.value,
        tabs.map((_, i) => i),
        tabs.map((_, i) => gap + i * item),
      ),
    }],
  }));

  return (
    /* Дорожка — обычный материал, не стекло: иначе бегунку нечего
       преломлять. Ровно как у системного переключателя. */
    <Glass plain radius={height / 2} style={{ width, height }}
      tint={p.name === 'light' ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.05)'}>
      {/* Линза под подписями: она подсвечивает активный пункт, а не закрывает его */}
      {/* Линза повторяет приём системного переключателя: выбранный пункт
          светлее дорожки, а не темнее. На белом фоне белое пятно само по
          себе не читается, поэтому его отделяет тень — так же, как система
          отделяет свой сегмент. */}
      <Animated.View style={[{
        position: 'absolute', top: gap, left: 0,
        width: item, height: height - gap * 2,
        shadowColor: p.shadow,
        shadowOpacity: p.name === 'light' ? 0.16 : 0.3,
        shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3,
      }, lens]}>
        {/* Живое стекло: заливку почти не задаём — плотный цвет глушит
            преломление, ради которого всё и затевалось. */}
        <Glass
          interactive
          radius={(height - gap * 2) / 2}
          style={{ flex: 1 }}
          tint={hasLiquidGlass
            ? (p.name === 'light' ? undefined : 'rgba(255,255,255,0.06)')
            : (p.name === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.18)')}
          edge={hasLiquidGlass ? undefined
            : (p.name === 'light' ? 'rgba(14,17,22,0.06)' : undefined)}
        />
      </Animated.View>

      <View style={{ flexDirection: 'row', flex: 1 }}>
        {tabs.map((t, i) => (
          <TabItem key={t.key} tab={t} index={i} progress={progress}
            on={i === active} onPress={() => onSelect(i)} />
        ))}
      </View>
    </Glass>
  );
}

function TabItem({ tab, index, progress, on, onPress }: {
  tab: TabDef; index: number; progress: SharedValue<number>;
  on: boolean; onPress: () => void;
}) {
  const { p } = useApp();
  /* Подпись и иконка проявляются плавно вместе с линзой, а не переключаются
     скачком в момент смены индекса. */
  const style = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    const near = Math.max(0, 1 - d);
    return { opacity: 0.55 + near * 0.45, transform: [{ scale: 0.96 + near * 0.04 }] };
  });
  /* Активная вкладка ещё и окрашивается: одной прозрачности мало, чтобы
     с ходу увидеть, где находишься. */
  const c = on ? p.primary : p.text;
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }} hitSlop={6}>
      <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }, style]}>
        <Icon name={tab.icon} size={21} color={c} width={1.9} />
        <Text style={{ fontSize: 10.5, fontWeight: '600', color: c }} numberOfLines={1}>
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
