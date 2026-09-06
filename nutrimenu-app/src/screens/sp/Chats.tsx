import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../../store';
import { api, SpClient } from '../../api';
import { S, FONT } from '../../theme';
import { Card, Label, Muted } from '../../ui/base';
import { Face } from '../../ui/Face';
import { Empty } from '../../ui/system';
import { plural } from '../../format';
import { haptic } from '../../haptics';

/** «14:05» сегодня, «4 сент.» раньше — как в списках переписок. */
const when = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(+d)) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return +d >= +today
    ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function SpChats() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<SpClient[] | null>(null);

  const load = useCallback(async () => {
    try { setList((await api<{ clients: SpClient[] }>('/specialist/clients')).clients ?? []); }
    catch { setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* Сверху непрочитанные, дальше по свежести переписки: список должен
     начинаться с того, на что ещё не ответили. */
  const shown = useMemo(() => (list ?? [])
    .filter(c => c.last_msg || (c.unread ?? 0) > 0)
    .sort((a, b) => (b.unread ?? 0) - (a.unread ?? 0)
      || String(b.last_msg_at ?? '').localeCompare(String(a.last_msg_at ?? ''))),
  [list]);

  const unread = shown.reduce((a, c) => a + (c.unread ?? 0), 0);

  if (!list) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + S.lg, paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}>

      <Label>
        {unread ? `${unread} ${plural(unread, ['новое', 'новых', 'новых'])}` : 'всё прочитано'}
      </Label>
      <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs, marginBottom: S.lg }}>Чат</Text>

      {shown.length === 0 ? (
        <Empty icon="bubble.left.and.bubble.right" title="Переписок пока нет"
          note="Напишите клиенту из его карточки — диалог появится здесь." />
      ) : shown.map((c, i) => (
        <Animated.View key={c.id} entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(220)}>
          <Pressable onPress={() => { haptic.tap(); router.push(`/sp-chat/${c.id}`); }}>
            {({ pressed }) => (
              <Card style={{ marginBottom: S.sm, flexDirection: 'row', alignItems: 'center',
                gap: S.md, opacity: pressed ? 0.7 : 1 }}>
                <Face url={c.avatar_url} name={c.name} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
                    <Text style={{ ...FONT.h3, color: p.text, flex: 1 }} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Muted>{when(c.last_msg_at)}</Muted>
                  </View>
                  <Text numberOfLines={1} style={{
                    ...FONT.body, marginTop: 3,
                    color: c.unread ? p.text : p.text3,
                    fontWeight: c.unread ? '600' : '400',
                  }}>
                    {c.last_msg || 'вложение'}
                  </Text>
                </View>
                {c.unread ? (
                  <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
                    backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: p.onPrimary }}>
                      {c.unread}
                    </Text>
                  </View>
                ) : null}
              </Card>
            )}
          </Pressable>
        </Animated.View>
      ))}
    </ScrollView>
  );
}
