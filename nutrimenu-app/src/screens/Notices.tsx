import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, Notice } from '../api';
import { S, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { Empty, SysButton } from '../ui/system';
import { Loading, Fail } from './Shopping';
import { haptic } from '../haptics';

const KIND: Record<string, string> = {
  call: 'video', menu: 'cal', replacement: 'bowl', checkin: 'edit',
  message: 'chat', weight: 'weight', payment: 'tag',
};

/** «4 сентября, 14:10» — дата и время одной строкой. */
const when = (s: string) => {
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(+d)) return s;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export default function Notices() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<Notice[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setList((await api<{ notifications: Notice[] }>('/client/notifications')).notifications ?? []); }
    catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const readAll = useCallback(async () => {
    haptic.tap();
    setList(l => l && l.map(n => ({ ...n, read_at: n.read_at ?? 'now' })));
    try { await api('/client/notifications/read', { method: 'POST' }); }
    catch { load(); }
  }, [load]);

  if (err) return <Fail title="Уведомления" text={err} />;
  if (!list) return <Loading title="Уведомления" />;

  const unread = list.filter(n => !n.read_at).length;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Уведомления" back />
      {list.length === 0 ? (
        <Empty icon="bell" title="Уведомлений нет"
          note="Здесь появятся напоминания, новости меню и звонки специалиста." />
      ) : (
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
        }} showsVerticalScrollIndicator={false}>
          {unread ? (
            <View style={{ marginTop: S.md, marginBottom: S.md }}>
              <SysButton label={`Отметить прочитанными (${unread})`} onPress={readAll} height={46} />
            </View>
          ) : <View style={{ height: S.md }} />}

          {list.map((n, i) => (
            <Animated.View key={n.id} entering={FadeInDown.delay(Math.min(i, 8) * 30).duration(220)}>
              <Card style={{ marginBottom: S.sm, flexDirection: 'row', gap: S.md }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 17, marginTop: 1,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: n.read_at ? p.inset : p.primarySoft,
                }}>
                  <Icon name={KIND[n.type] ?? 'bell'} size={16}
                    color={n.read_at ? p.text3 : p.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...FONT.h3, color: n.read_at ? p.text2 : p.text }}>
                    {n.title}
                  </Text>
                  {n.body ? (
                    <Text style={{ ...FONT.body, color: p.text2, marginTop: 3, lineHeight: 19 }}>
                      {n.body}
                    </Text>
                  ) : null}
                  <Muted style={{ marginTop: 4 }}>{when(n.created_at)}</Muted>
                </View>
              </Card>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
