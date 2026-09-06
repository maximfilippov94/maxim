/**
 * Строка ввода переписки.
 *
 * Собрана по образцу мессенджеров: скрепка слева, прозрачное поле в
 * середине, справа — микрофон, который превращается в отправку, как
 * только появился текст. Поле стеклянное: под ним видно последние
 * сообщения, и панель не отрезает их плотной полосой.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets,
  setAudioModeAsync, requestRecordingPermissionsAsync,
} from 'expo-audio';
import { useApp } from '../store';
import { S, R, FONT } from '../theme';
import { Glass } from './Glass';
import { Icon } from './Icon';
import { haptic } from '../haptics';
import { sysNative } from './system';

export type AttachSource = 'library' | 'camera';

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function ChatBar({ value, onChange, onSend, onAttach, onVoice, busy, onError }: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach: (from: AttachSource) => void;
  /** Готовая запись: путь к файлу на устройстве */
  onVoice: (uri: string) => void;
  busy?: boolean;
  onError: (message: string) => void;
}) {
  const { p } = useApp();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [rec, setRec] = useState(false);
  const has = value.trim().length > 0;

  const start = useCallback(async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { onError('Нужен доступ к микрофону'); return; }
      /* Пока пишем — переключаем звук на запись, иначе iOS держит
         маршрут воспроизведения и файл выходит пустым. */
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic.heavy();
      setRec(true);
    } catch (e: any) {
      onError(e?.message ?? 'Не удалось начать запись');
    }
  }, [recorder, onError]);

  const finish = useCallback(async (send: boolean) => {
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      setRec(false);
      if (send && uri) { haptic.success(); onVoice(uri); }
      else haptic.warn();
    } catch (e: any) {
      setRec(false);
      onError(e?.message ?? 'Запись не сохранилась');
    }
  }, [recorder, onVoice, onError]);

  if (rec) {
    return (
      <Glass radius={R.pill} style={{
        flexDirection: 'row', alignItems: 'center', gap: S.md,
        paddingLeft: S.lg, paddingRight: 5, height: 50,
      }}>
        <Dot />
        <Text style={{ ...FONT.h3, color: p.text, minWidth: 46 }}>
          {mmss(state.durationMillis ?? 0)}
        </Text>
        <Pressable onPress={() => finish(false)} hitSlop={10} style={{ flex: 1 }}>
          <Text style={{ ...FONT.body, color: p.text3 }}>Отменить</Text>
        </Pressable>
        <Round icon="send" filled onPress={() => finish(true)} />
      </Glass>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.sm }}>
      <Attach onPick={onAttach} />

      <Glass radius={R.pill} style={{
        flex: 1, flexDirection: 'row', alignItems: 'flex-end',
        paddingLeft: S.lg, paddingRight: 5, paddingVertical: 5, minHeight: 50,
      }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Сообщение"
          placeholderTextColor={p.text3}
          multiline
          style={{
            flex: 1, maxHeight: 120, paddingTop: 11, paddingBottom: 11,
            color: p.text, fontSize: 16,
          }}
        />
        {busy ? (
          <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={p.primary} />
          </View>
        ) : has ? (
          <Round icon="send" filled onPress={onSend} />
        ) : (
          <Round icon="mic" onPress={start} />
        )}
      </Glass>
    </View>
  );
}

/** Красная точка, которая дышит: запись идёт, а не зависла. */
function Dot() {
  const { p } = useApp();
  const a = useSharedValue(1);
  React.useEffect(() => {
    a.value = withRepeat(withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [a]);
  const st = useAnimatedStyle(() => ({ opacity: a.value }));
  return (
    <Animated.View style={[{
      width: 10, height: 10, borderRadius: 5, backgroundColor: p.danger,
    }, st]} />
  );
}

/**
 * Скрепка. На iOS открывает системное меню: «Фото или видео» и «Камера»
 * приезжают тем же списком, что во всех приложениях, — со своим
 * затемнением, размерами и отменой по нажатию мимо.
 */
function Attach({ onPick }: { onPick: (from: AttachSource) => void }) {
  const { p } = useApp();
  const [open, setOpen] = useState(false);

  if (sysNative) {
    const { Host, Menu, Button, Image: SImage } = require('@expo/ui/swift-ui');
    const m = require('@expo/ui/swift-ui/modifiers');
    /* Подпись передаём картинкой, а не через systemImage: без текстовой
       подписи система рисует меню пустым кружком. */
    return (
      <Host style={{ width: 50, height: 50 }}
        colorScheme={p.name === 'light' ? 'light' : 'dark'} seedColor={p.primary}>
        <Menu
          label={<SImage systemName="paperclip" size={21} />}
          modifiers={[m.buttonStyle('glass'), m.buttonBorderShape('circle'),
            m.frame({ width: 50, height: 50 })]}>
          <Button label="Фото или видео" systemImage="photo.on.rectangle"
            onPress={() => { haptic.tap(); onPick('library'); }} />
          <Button label="Камера" systemImage="camera"
            onPress={() => { haptic.tap(); onPick('camera'); }} />
        </Menu>
      </Host>
    );
  }

  return (
    <View>
      {open ? (
        <View style={{
          position: 'absolute', bottom: 56, left: 0, width: 190,
          backgroundColor: p.surface, borderRadius: R.md, overflow: 'hidden',
          borderWidth: 1, borderColor: p.border,
        }}>
          {([['library', 'Фото или видео'], ['camera', 'Камера']] as [AttachSource, string][])
            .map(([k, l], i) => (
              <Pressable key={k}
                onPress={() => { setOpen(false); onPick(k); }}
                style={({ pressed }) => ({
                  paddingVertical: 12, paddingHorizontal: S.lg,
                  borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
                  backgroundColor: pressed ? p.ov1 : 'transparent',
                })}>
                <Text style={{ fontSize: 15, color: p.text }}>{l}</Text>
              </Pressable>
            ))}
        </View>
      ) : null}
      <Glass radius={25} style={{ width: 50, height: 50 }}>
        <Pressable onPress={() => setOpen(o => !o)}
          style={({ pressed }) => ({
            flex: 1, alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}>
          <Icon name="clip" size={21} color={p.text2} width={1.9} />
        </Pressable>
      </Glass>
    </View>
  );
}

/** Круглая кнопка в торце строки: отправка или микрофон. */
function Round({ icon, onPress, filled }: {
  icon: string; onPress: () => void; filled?: boolean;
}) {
  const { p } = useApp();
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? p.primary : 'transparent',
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}>
      <Icon name={icon} size={filled ? 18 : 21}
        color={filled ? p.onPrimary : p.text2} width={2} />
    </Pressable>
  );
}
