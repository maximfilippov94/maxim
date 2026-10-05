/**
 * Список переписок клиента — то же, что `clChats` в вебе.
 *
 * Раньше вкладка «Чат» сразу открывала переписку и звала
 * `/client/messages` без собеседника: сервер в таком случае отдаёт весь
 * тред клиента целиком. У кого подключены нутрициолог и тренер, второй
 * собеседник не показывался вовсе, а сообщения обоих шли вперемешку.
 *
 * Разметка строки повторяет `clChatRow`: лицо, имя и время, превью
 * последнего сообщения, счётчик непрочитанных. У EQUA AI фотографии нет
 * и быть не может — вместо пустого кружка с буквами знак искры.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { api, ChatPeer } from '../api';
import { S, FONT } from '../theme';
import { Card, Label, Muted } from '../ui/base';
import { Face } from '../ui/Face';
import { Icon } from '../ui/Icon';
import { Empty, SysButton } from '../ui/system';
import { plural } from '../format';
import { haptic } from '../haptics';

/** «14:05» сегодня, «Вчера», дальше «04.09» — как `timeShort` в вебе. */
function when(s?: string | null): string {
  if (!s) return '';
  const d = new Date(/[TZ]/.test(s) ? s : s.replace(' ', 'T') + 'Z');
  if (isNaN(+d)) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (Math.floor((+now - +d) / 86400000) === 1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/** Чем занят собеседник — подставляется, пока переписки ещё нет. */
function peerSub(c: ChatPeer): string {
  if (c.is_ai) return 'Отвечает сразу';
  if (c.role === 'trainer') return 'Тренер';
  if (c.role === 'coach') return 'Коуч';
  return 'Нутрициолог';
}

export default function ChatList() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<ChatPeer[] | null>(null);

  const load = useCallback(async () => {
    try { setList((await api<{ chats: ChatPeer[] }>('/client/chats')).chats ?? []); }
    catch { setList([]); }
  }, []);
  /* Грузим только по фокусу: он срабатывает и при первом показе, и
     при возврате из переписки — счётчик непрочитанных должен гаснуть
     сам, без перезапуска приложения. */
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!list) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  const unread = list.reduce((n, c) => n + (c.unread || 0), 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + S.lg, paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + 150,
      }}
      showsVerticalScrollIndicator={false}>

      <Label>
        {unread
          ? `${unread} ${plural(unread, ['новое сообщение', 'новых сообщения', 'новых сообщений'])}`
          : 'Выберите, с кем говорить'}
      </Label>
      <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs, marginBottom: S.lg }}>Чат</Text>

      {list.length === 0 ? (
        <View>
          <Empty icon="bubble.left.and.bubble.right" title="Здесь будет ваша переписка"
            note="После подключения специалиста можно обсудить план и задать вопросы." />
          <SysButton label="Мои специалисты" variant="prominent"
            onPress={() => { haptic.tap(); router.push('/specialist' as any); }} />
        </View>
      ) : list.map((c, i) => (
        <Animated.View key={c.id} entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(220)}>
          <Pressable onPress={() => {
            haptic.tap();
            /* У EQUA AI свой экран: там ждут ответа здесь и сейчас и
               оценивают его, а у человека этого нет. */
            router.push((c.is_ai ? '/ai-chat' : `/chat/${c.id}`) as any);
          }}>
            {({ pressed }) => (
              <Card style={{ marginBottom: S.sm, flexDirection: 'row', alignItems: 'center',
                gap: S.md, opacity: pressed ? 0.7 : 1 }}>
                {c.is_ai ? (
                  <View style={{
                    width: 44, height: 44, borderRadius: 22, alignItems: 'center',
                    justifyContent: 'center', backgroundColor: p.primarySoft,
                  }}>
                    <Icon name="spark" size={21} color={p.accent} width={1.8} />
                  </View>
                ) : (
                  <Face url={c.avatar_url} name={c.name} size={44} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
                    <Text style={{ ...FONT.h3, color: p.text, flex: 1 }} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Muted>{when(c.last_at)}</Muted>
                  </View>
                  <Text numberOfLines={1} style={{
                    ...FONT.body, marginTop: 3,
                    color: c.unread ? p.text : p.text3,
                    fontWeight: c.unread ? '600' : '400',
                    fontStyle: c.last ? 'normal' : 'italic',
                  }}>
                    {c.last || peerSub(c)}
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
