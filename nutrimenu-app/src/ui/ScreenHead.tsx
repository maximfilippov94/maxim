/**
 * Шапка главных экранов: подпись, крупный заголовок и колокольчик справа.
 *
 * Уведомления раньше лежали только в «Ещё» — за двумя нажатиями и без
 * намёка, что там что-то новое. Здесь они на виду, а счётчик показывает
 * непрочитанное, не заставляя туда заходить ради проверки.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { api, Notice } from '../api';
import { S, FONT } from '../theme';
import { Label } from './base';
import { Icon } from './Icon';
import { haptic } from '../haptics';

export function ScreenHead({ eyebrow, title, role }: {
  eyebrow: string;
  title: string;
  role: 'client' | 'specialist';
}) {
  const { p } = useApp();
  const [unread, setUnread] = useState(0);
  const base = role === 'specialist' ? '/specialist' : '/client';
  const to = role === 'specialist' ? '/sp-notifications' : '/notifications';

  /* Считаем при каждом возвращении на экран: прочитали уведомления —
     счётчик должен погаснуть сам, без перезапуска приложения. */
  useFocusEffect(useCallback(() => {
    let alive = true;
    api<{ notifications: Notice[] }>(base + '/notifications')
      .then(r => { if (alive) setUnread((r.notifications ?? []).filter(n => !n.read_at).length); })
      .catch(() => {});
    return () => { alive = false; };
  }, [base]));

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start',
      marginBottom: S.lg,
    }}>
      <View style={{ flex: 1 }}>
        <Label>{eyebrow}</Label>
        <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs }}>{title}</Text>
      </View>

      <Pressable onPress={() => { haptic.tap(); router.push(to as any); }} hitSlop={10}
        style={({ pressed }) => ({
          width: 44, height: 44, borderRadius: 22, marginTop: 2,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: p.surface,
          opacity: pressed ? 0.6 : 1,
        })}>
        <Icon name="bell" size={20} color={p.text2} width={1.8} />
        {unread > 0 ? (
          <View style={{
            position: 'absolute', top: 6, right: 5, minWidth: 18, height: 18,
            borderRadius: 9, paddingHorizontal: 4,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: p.danger,
            /* Кольцо цветом фона отделяет счётчик от колокольчика:
               иначе на тёмной теме цифра сливается с иконкой. */
            borderWidth: 2, borderColor: p.bg,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
              {unread > 99 ? '99+' : unread}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
