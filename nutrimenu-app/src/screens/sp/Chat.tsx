import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { api, SpClient } from '../../api';
import { NavBar } from '../../ui/NavBar';
import { ChatView } from '../../ui/ChatView';
import { kg } from '../../format';

/** Переписка специалиста с одним клиентом. */
export default function SpChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cid = Number(id);
  const [c, setC] = useState<SpClient | null>(null);

  useEffect(() => {
    api<{ client: SpClient }>(`/specialist/clients/${cid}`)
      .then(r => setC(r.client)).catch(() => {});
  }, [cid]);

  return (
    <ChatView
      endpoint={`/specialist/messages?client_id=${cid}`}
      attachEndpoint="/specialist/attachment"
      extra={{ client_id: cid }}
      mineType="specialist"
      title={c?.name ?? 'Клиент'}
      subtitle={c?.weight_kg ? `${kg(c.weight_kg)} кг · ${c.goal ?? ''}`.trim() : undefined}
      avatarUrl={c?.avatar_url}
      back={<NavBar title={c?.name ?? 'Клиент'} back />}
      bottomInset={12}
      emptyNote="Напишите клиенту — он увидит сообщение в приложении."
    />
  );
}
