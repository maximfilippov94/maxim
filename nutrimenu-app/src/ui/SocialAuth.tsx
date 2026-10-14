/**
 * Вход через Apple, Google и VK.
 *
 * Обмен кодом делает сервер: приложение только открывает системное окно
 * входа и получает готовый токен сессии обратно по ссылке. Так секрет
 * провайдера не уезжает на устройство, а путь одинаков для всех трёх.
 *
 * Кнопки показываются только для провайдеров, которые сервер объявил
 * настроенными: кнопка, которая ничего не делает, хуже её отсутствия.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useApp } from '../store';
import { api, API_BASE } from '../api';
import { S, R, FONT } from '../theme';
import { ON_PHOTO } from './AuthShell';
import { haptic } from '../haptics';

type Provider = 'apple' | 'google' | 'vk';

const TITLE: Record<Provider, string> = {
  apple: 'Продолжить с Apple',
  google: 'Продолжить с Google',
  vk: 'Продолжить с VK',
};

export function SocialAuth({ onError }: { onError: (m: string) => void }) {
  const { signInWithToken } = useApp();
  const [list, setList] = useState<Provider[] | null>(null);
  const [busy, setBusy] = useState<Provider | null>(null);

  useEffect(() => {
    api<{ providers: Provider[] }>('/auth/providers')
      .then(r => setList(r.providers ?? []))
      .catch(() => setList([]));
  }, []);

  async function start(p: Provider) {
    if (busy) return;
    setBusy(p); haptic.tap();
    try {
      /* В Expo Go адрес возврата свой на каждой машине, поэтому он же
         уходит серверу — тот сверяет его со своим списком разрешённых. */
      const back = Linking.createURL('auth');
      const url = `${API_BASE}/api/v1/auth/oauth/${p}/start?target=${encodeURIComponent(back)}`;
      const res = await WebBrowser.openAuthSessionAsync(url, back);
      if (res.type !== 'success' || !res.url) { setBusy(null); return; }
      const q = Linking.parse(res.url).queryParams ?? {};
      const err = typeof q.auth_error === 'string' ? q.auth_error : null;
      if (err) { haptic.error(); onError(err); setBusy(null); return; }
      const token = typeof q.token === 'string' ? q.token : null;
      if (!token) { haptic.error(); onError('Сервер не вернул сессию'); setBusy(null); return; }
      const me = await signInWithToken(token);
      haptic.success();
      router.replace(me.user_type === 'specialist' ? '/sp' : '/client');
    } catch (e: any) {
      haptic.error(); onError(e?.message ?? 'Не удалось войти');
    } finally { setBusy(null); }
  }

  if (list === null || list.length === 0) return null;

  return (
    <View style={{ marginTop: S.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg }}>
        <View style={{ flex: 1, height: 1, backgroundColor: ON_PHOTO.fieldBorder }} />
        <Text style={{ ...FONT.small, color: ON_PHOTO.text3 }}>или</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: ON_PHOTO.fieldBorder }} />
      </View>

      <View style={{ gap: S.md }}>
        {list.map(p => (
          <Pressable key={p} onPress={() => start(p)} disabled={!!busy}
            style={({ pressed }) => ({
              height: 52, borderRadius: R.pill, flexDirection: 'row',
              alignItems: 'center', justifyContent: 'center', gap: S.md,
              backgroundColor: ON_PHOTO.card,
              borderWidth: 1, borderColor: ON_PHOTO.fieldBorder,
              opacity: busy && busy !== p ? 0.5 : pressed ? 0.85 : 1,
            })}>
            {busy === p
              ? <ActivityIndicator color={ON_PHOTO.text} />
              : <><Mark p={p} /><Text style={{ fontSize: 15.5, color: ON_PHOTO.text }}>
                {TITLE[p]}</Text></>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Знаки провайдеров: рисуем сами — сторонних наборов иконок в проекте нет. */
function Mark({ p }: { p: Provider }) {
  if (p === 'apple') {
    return (
      <Svg width={19} height={19} viewBox="0 0 24 24">
        <Path fill="#FFFFFF" d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.5-.2-2.8.8-3.6.8-.7 0-1.9-.8-3.1-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.2.9-1.3 1.3-2.6 1.3-2.6s-2.4-.9-2.3-3.8ZM14 5.9c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3Z" />
      </Svg>
    );
  }
  if (p === 'google') {
    return (
      <Svg width={18} height={18} viewBox="0 0 48 48">
        <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.8 6.1C12.3 14 17.6 9.5 24 9.5Z" />
        <Path fill="#4285F4" d="M46.6 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.2-10.1 7.2-17.5Z" />
        <Path fill="#FBBC05" d="M10.4 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.7l7.8-6.1Z" />
        <Path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.2-7.9 2.2-6.4 0-11.7-4.5-13.6-10.3l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5Z" />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill="#FFFFFF" d="M12.9 17.3c-5.4 0-8.7-3.8-8.8-10h2.7c.1 4.6 2.2 6.5 3.8 6.9V7.3h2.6v3.9c1.6-.2 3.3-2 3.9-3.9h2.5c-.4 2.3-2.1 4.1-3.3 4.8 1.2.6 3.1 2.2 3.9 5.2h-2.8c-.6-1.9-2.1-3.4-4.2-3.6v3.6h-.3Z" />
    </Svg>
  );
}
