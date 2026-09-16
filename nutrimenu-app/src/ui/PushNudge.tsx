/**
 * Полоска «включите уведомления» на «Сегодня».
 *
 * Разрешение спрашивают один раз, и человек, отказавшийся на первом
 * запуске, дальше просто не узнаёт о новом меню, сообщении и звонке —
 * молча, без единого следа в интерфейсе. Поэтому напоминание висит на
 * главном экране, пока уведомления не включены.
 *
 * Отказ уважаем: крестик прячет полоску на неделю, а не навсегда —
 * случайно закрытая в первый день, она иначе не вернулась бы никогда.
 * Если система больше не покажет запрос (человек однажды отказал),
 * зовём не «включить», а открыть настройки: кнопка там бессильна.
 *
 * В Expo Go полоски нет: удалённые уведомления там не работают начиная
 * с SDK 53, и предлагать включить то, что всё равно не придёт, — обман.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { S, R, FONT } from '../theme';
import { Icon } from './Icon';
import { registerPush, inExpoGo } from '../push';
import { haptic } from '../haptics';

const KEY = 'nm_push_nudge_until';
const WEEK = 7 * 24 * 3600 * 1000;

/** Что показывать: ничего, «включить» или «открыть настройки». */
type Mode = null | 'ask' | 'settings';

export function PushNudge() {
  const { p } = useApp();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);

  /* Проверяем при каждом возвращении на экран: человек мог включить
     уведомления в настройках телефона, и полоска обязана исчезнуть
     сама, без перезапуска приложения. */
  const check = useCallback(async () => {
    if (inExpoGo) { setMode(null); return; }
    try {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status === 'granted') { setMode(null); return; }
      const until = Number((await AsyncStorage.getItem(KEY)) ?? 0);
      if (Date.now() < until) { setMode(null); return; }
      setMode(canAskAgain ? 'ask' : 'settings');
    } catch { setMode(null); }
  }, []);

  useFocusEffect(useCallback(() => { check(); }, [check]));

  if (!mode) return null;

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    haptic.tap();
    if (mode === 'settings') {
      await Linking.openSettings().catch(() => {});
      setBusy(false);
      return;
    }
    const r = await registerPush(true);
    setBusy(false);
    if (r.ok) { haptic.success(); setMode(null); }
    else await check();          /* отказали — покажем путь в настройки */
  };

  const later = async () => {
    haptic.select();
    setMode(null);
    try { await AsyncStorage.setItem(KEY, String(Date.now() + WEEK)); } catch {}
  };

  return (
    <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOut.duration(160)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: S.md,
        backgroundColor: p.primarySoft, borderRadius: R.lg,
        paddingVertical: S.md, paddingHorizontal: S.md,
        marginBottom: S.md,
      }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18, flexShrink: 0,
        alignItems: 'center', justifyContent: 'center', backgroundColor: p.primary,
      }}>
        <Icon name="bell" size={18} color="#fff" width={2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...FONT.body, fontWeight: '700', color: p.text }}>
          Включите уведомления
        </Text>
        <Text style={{ ...FONT.small, color: p.text3, marginTop: 2 }}>
          {mode === 'settings'
            ? 'Сейчас они запрещены в настройках телефона.'
            : 'Иначе вы не узнаете о новом меню, сообщении и звонке.'}
        </Text>
      </View>

      <Pressable onPress={enable} disabled={busy} accessibilityRole="button"
        style={({ pressed }) => ({
          flexShrink: 0, minHeight: 44, justifyContent: 'center',
          paddingHorizontal: S.md, borderRadius: R.pill,
          backgroundColor: p.primary, opacity: pressed || busy ? 0.7 : 1,
        })}>
        <Text style={{ ...FONT.small, fontWeight: '700', color: '#fff' }}>
          {mode === 'settings' ? 'Настройки' : 'Включить'}
        </Text>
      </Pressable>

      <Pressable onPress={later} accessibilityLabel="Не сейчас" accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => ({
          flexShrink: 0, width: 32, height: 44,
          alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1,
        })}>
        <Icon name="close" size={15} color={p.text3} width={2} />
      </Pressable>
    </Animated.View>
  );
}
