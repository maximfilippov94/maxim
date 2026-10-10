/**
 * Кнопка видеозвонка в шапке переписки.
 *
 * У специалиста звонок адресный — он передаёт клиента; у клиента
 * адресата нет: сервер сам находит его специалиста. Поэтому аргумент
 * необязательный, как и в вебе (`callStart(clientId)`).
 *
 * В Expo Go нативной части звонков нет, и кнопку там не показываем:
 * кнопка, которая всегда отвечает «так нельзя», хуже её отсутствия.
 */
import React from 'react';
import { Pressable } from 'react-native';
import { useApp } from '../store';
import { useCall } from '../call/store';
import { callsAvailable } from '../call/webrtc';
import { Icon } from './Icon';
import { haptic } from '../haptics';

export function CallButton({ clientId }: { clientId?: number }) {
  const { p } = useApp();
  const call = useCall();
  if (!callsAvailable()) return null;

  return (
    <Pressable
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Позвонить по видео"
      onPress={() => { haptic.tap(); call.start(clientId); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      <Icon name="video" size={21} color={p.accent} width={1.9} />
    </Pressable>
  );
}
