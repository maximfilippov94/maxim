import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useApp } from '../store';
import { Icon } from './Icon';
import { haptic } from '../haptics';

/**
 * Список разделов во всю ширину — как в системных «Настройках» и у
 * профильных приложений. Замеры сняты с эталона (iPhone, 3x):
 * высота строки 48, иконка 20 с отступом 18, подпись на 56, шеврон
 * справа с отступом 16, между строками волосок. Полотно списка на
 * тон светлее страницы — так он читается как отдельный слой,
 * не теряя края экрана.
 */
export const ROW_H = 48;
const ICON_LEFT = 18;
const LABEL_LEFT = 56;

export function ListGroup({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { p } = useApp();
  return <View style={[{ backgroundColor: p.surface }, style]}>{children}</View>;
}

export function ListHead({ children }: { children: React.ReactNode }) {
  const { p } = useApp();
  return (
    <Text style={{
      fontSize: 12, fontWeight: '600', letterSpacing: 0.6,
      color: p.text3, textTransform: 'uppercase',
      paddingHorizontal: ICON_LEFT, paddingTop: 22, paddingBottom: 8,
    }}>{children}</Text>
  );
}

export function ListRow({ icon, label, value, onPress, first, danger, tint, action }: {
  icon?: string;
  label: string;
  /** Правая подпись вместо шеврона — для строк без перехода */
  value?: string;
  onPress?: () => void;
  first?: boolean;
  danger?: boolean;
  /** Цвет иконки, если он несёт смысл */
  tint?: string;
  /** Строка что-то делает здесь же, а не открывает экран — шеврон не нужен */
  action?: boolean;
}) {
  const { p } = useApp();
  const color = danger ? p.danger : p.text;
  const body = (pressed: boolean) => (
    <View style={{
      height: ROW_H, flexDirection: 'row', alignItems: 'center',
      paddingLeft: ICON_LEFT, paddingRight: 16,
      backgroundColor: pressed ? p.ov1 : 'transparent',
    }}>
      {icon
        ? <View style={{ width: LABEL_LEFT - ICON_LEFT, marginLeft: -0 }}>
            <Icon name={icon} size={20} color={tint ?? (danger ? p.danger : p.text2)} width={1.6} />
          </View>
        : null}
      <Text numberOfLines={1} style={{
        flex: 1, fontSize: 16, color,
        marginLeft: icon ? 0 : 0,
      }}>{label}</Text>
      {value ? <Text style={{ fontSize: 15, color: p.text3, marginRight: onPress && !action ? 8 : 0 }}>{value}</Text> : null}
      {onPress && !action ? <Icon name="chevr" size={14} color={p.text3} width={2} /> : null}
    </View>
  );

  return (
    <View>
      {first ? null : (
        <View style={{
          height: StyleSheet.hairlineWidth, backgroundColor: p.border,
        }} />
      )}
      {onPress
        ? <Pressable onPress={() => { haptic.tap(); onPress(); }}>
            {({ pressed }) => body(pressed)}
          </Pressable>
        : body(false)}
    </View>
  );
}
