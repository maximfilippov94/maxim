import React, { useId } from 'react';
import { Platform } from 'react-native';
import { useApp } from '../store';
import { hasExpoUI } from '../native';
import { SF } from './Icon';
import type { TabDef } from './TabBar';

/**
 * Панель из системных компонентов SwiftUI.
 *
 * Собственная реализация не давала того же: стекло на стекле система
 * не рисует, а один слой поверх обычного фона выходил плоским пятном
 * без преломления. У Apple бегунок — это не полупрозрачная заливка,
 * а линза, и делает её сама система по модификатору glassEffect.
 *
 * Namespace вместе с glassEffectId дают то, что видно в Телеграме:
 * стекло не появляется заново на новом месте, а перетекает к нему.
 *
 * Эффект есть с iOS 26. Ниже и на других платформах остаётся прежняя
 * реализация на React Native.
 */
export const canNativeTabs =
  Platform.OS === 'ios'
  && hasExpoUI
  && (parseInt(String(Platform.Version), 10) || 0) >= 26;

export function TabBarNative({ tabs, active, onSelect, width, height }: {
  tabs: TabDef[];
  active: number;
  onSelect: (i: number) => void;
  width: number;
  height: number;
}) {
  const { p } = useApp();
  const ns = useId();

  const { Host, Namespace, GlassEffectContainer, HStack, VStack, Image, Text } =
    require('@expo/ui/swift-ui');
  const { frame, glassEffect, glassEffectId, onTapGesture, foregroundStyle, font } =
    require('@expo/ui/swift-ui/modifiers');

  const item = width / tabs.length;

  return (
    <Host style={{ width, height }}>
      <Namespace id={ns}>
        <GlassEffectContainer spacing={10}>
          <HStack spacing={0} modifiers={[frame({ width, height })]}>
            {tabs.map((t, i) => {
              const on = i === active;
              const color = on ? p.primary : p.text;
              /* Порядок важен: сначала размер, потом стекло по этому
                 размеру, и только затем нажатие. */
              const mods: any[] = [frame({ width: item, height: height - 12 })];
              if (on) {
                mods.push(glassEffect({
                  glass: { variant: 'regular', interactive: true },
                  shape: 'capsule',
                }));
                mods.push(glassEffectId(t.key, ns));
              }
              mods.push(onTapGesture(() => onSelect(i)));

              return (
                <VStack key={t.key} spacing={3} modifiers={mods}>
                  <Image systemName={SF[t.icon] ?? 'circle'} size={20} color={color} />
                  <Text modifiers={[font({ size: 10.5, weight: 'semibold' }), foregroundStyle(color)]}>
                    {t.label}
                  </Text>
                </VStack>
              );
            })}
          </HStack>
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
}
