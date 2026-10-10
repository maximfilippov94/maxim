/**
 * Шапка главного экрана клиента — та же, что в вебе (`clTodayHead`,
 * `.eq-topbar` и `.eq-welcome`).
 *
 * Логотип слева, колокольчик и аватар справа; ниже дата подписью,
 * приветствие по времени суток с именем в две строки и строка «Твой
 * план. Твой ритм.». Раньше здесь стояло сухое «Сегодня» — экран, с
 * которого начинается день, узнавался хуже, чем тот же экран в вебе.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { api, Notice } from '../api';
import { S, FONT } from '../theme';
import { Label } from './base';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { Face } from './Face';
import { haptic } from '../haptics';

/** «Доброе утро» до полудня, «Доброй ночи» до пяти — как в вебе. */
function greeting(h: number): string {
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function HomeHead({ name, avatarUrl }: {
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const { p } = useApp();
  const [unread, setUnread] = useState(0);

  useFocusEffect(useCallback(() => {
    let alive = true;
    api<{ notifications: Notice[] }>('/client/notifications')
      .then(r => { if (alive) setUnread((r.notifications ?? []).filter(n => !n.read_at).length); })
      .catch(() => {});
    return () => { alive = false; };
  }, []));

  /* Обращаемся по имени, без фамилии: так говорят с человеком, а не
     с записью в базе. Нет имени — «друг», как в вебе. */
  const first = (name ?? '').trim().split(/\s+/)[0] || 'друг';
  const date = new Date().toLocaleDateString('ru-RU',
    { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={{ marginBottom: S.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xl }}>
        <Logo width={118} color={p.text} mark={p.primary} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => { haptic.tap(); router.push('/notifications' as any); }} hitSlop={8}
          style={({ pressed }) => ({
            width: 44, height: 44, borderRadius: 22,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: p.border,
            opacity: pressed ? 0.6 : 1,
          })}>
          <Icon name="bell" size={19} color={p.text2} width={1.8} />
          {unread > 0 && (
            <View style={{
              position: 'absolute', top: 7, right: 6, minWidth: 17, height: 17,
              borderRadius: 9, paddingHorizontal: 4,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: p.primary,
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: p.onPrimary }}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => { haptic.tap(); router.push('/profile' as any); }} hitSlop={8}
          style={({ pressed }) => ({ marginLeft: S.sm, opacity: pressed ? 0.6 : 1 })}>
          <Face url={avatarUrl ?? undefined} name={name ?? ''} size={44} />
        </Pressable>
      </View>

      <Label>{date}</Label>
      <Text style={{ ...FONT.large, color: p.text, marginTop: S.md }}>
        {greeting(new Date().getHours())},{'\n'}{first}.
      </Text>
      <Text style={{ ...FONT.callout, color: p.text3, marginTop: S.sm }}>
        Твой план. Твой ритм.
      </Text>
    </View>
  );
}
