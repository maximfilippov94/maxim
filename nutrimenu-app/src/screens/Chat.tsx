import React, { useEffect, useState } from 'react';
import { api, Specialist } from '../api';
import { ChatView } from '../ui/ChatView';

/** Переписка клиента со своим специалистом. */
export default function Chat() {
  const [spec, setSpec] = useState<Specialist | null>(null);

  useEffect(() => {
    api<{ specialist: Specialist | null }>('/client/my-specialist')
      .then(r => setSpec(r.specialist)).catch(() => {});
  }, []);

  return (
    <ChatView
      endpoint="/client/messages"
      attachEndpoint="/client/attachment"
      mineType="client"
      title={spec?.name ?? 'Специалист'}
      subtitle={spec ? 'ваш специалист' : 'специалист не назначен'}
      avatarUrl={spec?.avatar_url}
      emptyNote="Напишите специалисту — он ответит здесь."
    />
  );
}
