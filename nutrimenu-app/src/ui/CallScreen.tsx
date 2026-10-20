/**
 * Экран звонка — поверх всего приложения.
 *
 * Два состояния на одном полотне: входящий (имя, «Ответить» и
 * «Отклонить») и разговор (видео собеседника во весь экран, своё — в
 * углу, под ними микрофон, камера, переключение камеры и отбой).
 *
 * Пока соединение не поднялось, вместо чёрного прямоугольника — имя и
 * состояние словами: «Звоним…», «Соединение…». Чёрный экран человек
 * читает как поломку.
 */
import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store';
import { useCall } from '../call/store';
import { webrtc } from '../call/webrtc';
import { S, R, FONT } from '../theme';
import { Icon } from './Icon';
import { Face } from './Face';
import { haptic } from '../haptics';

/** «03:07» — длительность разговора. */
function clock(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CallScreen() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const c = useCall();

  if (c.stage === 'idle') return null;
  /* Спрашиваем нативную часть только когда звонок уже идёт: экран висит
     поверх всей навигации и рисуется на каждом экране. */
  const RTCView = webrtc()?.RTCView;
  const live = c.stage === 'active';

  return (
    <Modal visible animationType="fade" statusBarTranslucent
      onRequestClose={() => (c.stage === 'incoming' ? c.decline() : c.hangup())}>
      <View style={{ flex: 1, backgroundColor: '#0C1118' }}>
        {/* Видео собеседника во весь экран */}
        {live && c.remoteUrl && RTCView ? (
          <RTCView streamURL={c.remoteUrl} objectFit="cover" style={StyleSheet.absoluteFill} />
        ) : null}

        {/* Имя и состояние: видно и пока нет картинки, и поверх неё */}
        <View style={{
          position: 'absolute', left: 0, right: 0, top: insets.top + 32,
          alignItems: 'center', gap: S.md,
        }}>
          {!live || !c.remoteUrl ? (
            <Face url={c.peer?.avatar_url ?? null} name={c.peer?.name ?? '—'} size={96} />
          ) : null}
          <Text style={{ ...FONT.h1, color: '#fff', textAlign: 'center' }} numberOfLines={2}>
            {c.peer?.name ?? 'Собеседник'}
          </Text>
          <Text style={{ ...FONT.body, color: 'rgba(255,255,255,0.72)' }}>
            {c.stage === 'incoming' ? 'Входящий видеозвонок'
              : c.stage === 'calling' ? 'Звоним…'
              : c.connected ? clock(c.seconds) : 'Соединение…'}
          </Text>
        </View>

        {/* Своё изображение — в углу, как во всех звонилках */}
        {c.localUrl && RTCView && c.camOn && c.stage !== 'incoming' ? (
          <View style={{
            position: 'absolute', right: S.lg, top: insets.top + 12,
            width: 104, height: 150, borderRadius: R.md, overflow: 'hidden',
            backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
          }}>
            <RTCView streamURL={c.localUrl} objectFit="cover" mirror
              style={{ width: '100%', height: '100%' }} />
          </View>
        ) : null}

        {c.error ? (
          <View style={{
            position: 'absolute', left: S.lg, right: S.lg, top: insets.top + 220,
            padding: S.md, borderRadius: R.md, backgroundColor: 'rgba(0,0,0,0.55)',
          }}>
            <Text style={{ ...FONT.small, color: '#FFB4AE', textAlign: 'center' }}>{c.error}</Text>
          </View>
        ) : null}

        {/* Кнопки */}
        <View style={{
          position: 'absolute', left: 0, right: 0, bottom: insets.bottom + S.xxl,
          alignItems: 'center', gap: S.xl,
        }}>
          {c.stage !== 'incoming' ? (
            <View style={{ flexDirection: 'row', gap: S.xl }}>
              <Round on={c.micOn} icon={c.micOn ? 'mic' : 'micoff'} label="Микрофон"
                onPress={c.toggleMic} />
              <Round on={c.camOn} icon={c.camOn ? 'video' : 'videooff'} label="Камера"
                onPress={c.toggleCam} />
              <Round on icon="replace" label="Перевернуть камеру" onPress={c.flip} />
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: S.xxl }}>
            {c.stage === 'incoming' ? (
              <>
                <Big color={p.danger} icon="close" label="Отклонить"
                  onPress={() => { haptic.tap(); c.decline(); }} />
                <Big color="#2FBF71" icon="video" label="Ответить"
                  onPress={() => { haptic.tap(); c.accept(); }} />
              </>
            ) : (
              <Big color={p.danger} icon="close" label="Завершить звонок"
                onPress={() => { haptic.tap(); c.hangup(); }} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Круглая кнопка переключателя: выключенное состояние видно без подписи. */
function Round({ icon, label, on, onPress }: {
  icon: string; label: string; on: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 56, height: 56, borderRadius: 28,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: on ? 'rgba(255,255,255,0.18)' : '#fff',
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}>
      <Icon name={icon} size={23} color={on ? '#fff' : '#0C1118'} />
    </Pressable>
  );
}

/** Ответить и положить трубку — крупные, их ищут не глядя. */
function Big({ icon, label, color, onPress }: {
  icon: string; label: string; color: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 72, height: 72, borderRadius: 36,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: color,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}>
      <Icon name={icon} size={28} color="#fff" width={2.4} />
    </Pressable>
  );
}
