/**
 * EQUA AI — отдельный экран переписки с моделью.
 *
 * Лента та же, что у чата со специалистом: сообщения идут через
 * `/client/messages`, только собеседник — AI-специалист, и его номер
 * передаётся в `specialist_id`. Дублировать ленту ради этого незачем,
 * поэтому экран настраивает общий `ChatView`.
 *
 * Отличия в поведении, а не в разметке: ответ ждут здесь и сейчас
 * (пузырь «печатает…» с возможностью прервать), приходит он разметкой
 * модели, и его можно оценить — сердцем или перечёркнутым сердцем.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useApp } from '../store';
import { api } from '../api';
import { ChatView } from '../ui/ChatView';
import { Empty } from '../ui/system';
import { NavBar } from '../ui/NavBar';
import { useToast } from '../ui/Toast';

interface SpecRow {
  id: number;
  name?: string;
  avatar_url?: string | null;
  is_ai?: number | boolean;
}

export default function AIChat() {
  const { p } = useApp();
  const toast = useToast();
  const [ai, setAi] = useState<SpecRow | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ specialists?: SpecRow[] }>('/client/my-specialist')
      .then(j => {
        if (!alive) return;
        setAi((j.specialists ?? []).find(x => !!x.is_ai) ?? null);
      })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  /* Оценка ответа уходит в свой маршрут и ничего не меняет в ленте:
     подтверждение — короткое сообщение, а не перерисовка переписки. */
  const react = useCallback((messageId: number, rating: 1 | 0) => {
    api('/client/ai/chat-feedback', { method: 'POST', body: { message_id: messageId, rating } })
      .catch(() => toast('Оценка не сохранилась', { kind: 'err' }));
  }, [toast]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.accent} />
      </View>
    );
  }

  /* Подписки нет — показываем, что это платная часть, а не поломка. */
  if (!ai) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar title="EQUA AI" back />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Empty
            icon="sparkles"
            title="EQUA AI не подключён"
            note="Подключите EQUA AI в разделе «Специалисты», и он соберёт план питания и тренировок." />
        </View>
      </View>
    );
  }

  return (
    <ChatView
      endpoint={`/client/messages?specialist_id=${ai.id}`}
      attachEndpoint="/client/attachment"
      extra={{ specialist_id: ai.id }}
      mineType="client"
      title={ai.name || 'EQUA AI'}
      subtitle="питание, движение, план"
      avatarUrl={ai.avatar_url}
      emptyNote="Спросите про питание, тренировки или самочувствие — EQUA AI ответит с учётом вашего плана."
      typingLabel="EQUA AI печатает"
      markdown
      onReact={react}
      back={<NavBar title={ai.name || 'EQUA AI'} back />}
    />
  );
}
