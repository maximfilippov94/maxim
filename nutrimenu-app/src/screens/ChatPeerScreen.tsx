/**
 * Переписка клиента с одним собеседником. Номер обязателен: без него
 * сервер отдаёт весь тред клиента целиком, и сообщения нутрициолога
 * с сообщениями тренера идут вперемешку.
 */
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { api, ChatPeer } from '../api';
import { ChatView } from '../ui/ChatView';
import { NavBar } from '../ui/NavBar';

const SUB: Record<string, string> = {
  trainer: 'тренер', coach: 'коуч', endocrinologist: 'врач',
};

export default function ChatPeerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const peerId = Number(id) || 0;
  const [peer, setPeer] = useState<ChatPeer | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ chats: ChatPeer[] }>('/client/chats')
      .then(r => {
        if (!alive) return;
        setPeer((r.chats ?? []).find(x => x.id === peerId) ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [peerId]);

  return (
    <ChatView
      endpoint={`/client/messages?specialist_id=${peerId}`}
      attachEndpoint="/client/attachment"
      extra={{ specialist_id: peerId }}
      mineType="client"
      title={peer?.name ?? 'Специалист'}
      subtitle={peer ? (SUB[peer.role] ?? 'нутрициолог') : ''}
      avatarUrl={peer?.avatar_url}
      emptyNote="Напишите специалисту — он ответит здесь."
      typingEndpoint="/client/chat-typing"
      back={<NavBar title={peer?.name ?? 'Чат'} back />}
    />
  );
}
