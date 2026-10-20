/**
 * Просмотр картинки поверх экрана.
 *
 * Снимок анализа раньше уходил в системный лист «Поделиться» — человек
 * покидал приложение ради того, чтобы просто посмотреть. Картинку
 * показываем на месте; всё остальное (PDF и прочее) по-прежнему
 * отдаём системе, рисовать свой просмотрщик PDF незачем.
 */
import React from 'react';
import { Modal, View, Text, Image, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store';
import { FONT, S } from '../theme';
import { Icon } from './Icon';

export function ImageViewer({ uri, title, onClose }: {
  uri: string | null; title?: string; onClose: () => void;
}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  if (!uri) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}
      statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(8,12,16,0.94)' }} onPress={onClose}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md,
          paddingTop: insets.top + 10, paddingHorizontal: S.lg, paddingBottom: 10 }}>
          <Text numberOfLines={1}
            style={{ ...FONT.body, fontWeight: '600', color: '#fff', flex: 1 }}>
            {title ?? ''}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center',
              justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }}>
            <Icon name="close" size={18} color="#fff" width={2} />
          </Pressable>
        </View>
        <Image source={{ uri }} resizeMode="contain"
          style={{ flex: 1, width: '100%', marginBottom: insets.bottom + 16 }} />
      </Pressable>
    </Modal>
  );
}
