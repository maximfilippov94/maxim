import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api, SpLead } from '../../api';
import { S, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Empty } from '../../ui/system';
import { haptic } from '../../haptics';
import { Loading } from '../Shopping';

const when = (s: string) => {
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(+d)) return s;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

/** Заявки из каталога: люди, которые нашли вас и написали. */
export default function SpLeads() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<SpLead[] | null>(null);

  const load = useCallback(async () => {
    try { setList((await api<{ leads: SpLead[] }>('/specialist/leads')).leads ?? []); }
    catch { setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const read = useCallback(async (l: SpLead) => {
    if (l.read_at) return;
    setList(a => a && a.map(x => x.id === l.id ? { ...x, read_at: 'now' } : x));
    try { await api(`/specialist/leads/${l.id}/read`, { method: 'POST' }); }
    catch { load(); }
  }, [load]);

  if (!list) return <Loading title="Заявки" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Заявки" back />
      {list.length === 0 ? (
        <Empty icon="tray" title="Заявок нет"
          note="Здесь появятся люди, которые написали вам из каталога специалистов." />
      ) : (
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
        }} showsVerticalScrollIndicator={false}>
          {list.map((l, i) => (
            <Animated.View key={l.id} entering={FadeInDown.delay(Math.min(i, 8) * 30).duration(220)}>
              <Pressable onPress={() => read(l)}>
                <Card style={{ marginTop: S.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                    <Text style={{ ...FONT.h3, color: l.read_at ? p.text2 : p.text, flex: 1 }}>
                      {l.name}
                    </Text>
                    {!l.read_at ? (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.primary }} />
                    ) : null}
                  </View>
                  {l.message ? (
                    <Text style={{ ...FONT.body, color: p.text2, marginTop: 5, lineHeight: 19 }}>
                      {l.message}
                    </Text>
                  ) : null}
                  {l.contact ? (
                    <Pressable
                      onPress={() => {
                        haptic.tap();
                        const c = l.contact!.trim();
                        const url = c.includes('@') ? `mailto:${c}` : `tel:${c.replace(/[^+\d]/g, '')}`;
                        Linking.openURL(url).catch(() => {});
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        marginTop: S.sm, opacity: pressed ? 0.5 : 1,
                      })}>
                      <Icon name="chat" size={14} color={p.primary} />
                      <Text style={{ ...FONT.body, color: p.primary }}>{l.contact}</Text>
                    </Pressable>
                  ) : null}
                  <Muted style={{ marginTop: S.sm }}>{when(l.created_at)}</Muted>
                </Card>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
