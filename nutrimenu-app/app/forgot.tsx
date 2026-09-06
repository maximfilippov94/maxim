/**
 * Забыли пароль. Письмо со ссылкой открывается в браузере — там же
 * задаётся новый пароль, и человек возвращается сюда войти. Держать
 * форму смены в приложении незачем: ссылка одноразовая и живёт час.
 */
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { api } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { AuthShell, Field, AuthButton, Note, ON_PHOTO } from '../src/ui/AuthShell';
import { haptic } from '../src/haptics';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setErr(null); setBusy(true);
    try {
      const j = await api<{ message?: string }>('/auth/forgot', {
        method: 'POST', body: { email: email.trim() },
      });
      haptic.success();
      setSent(j.message ?? 'Если такой адрес у нас есть, письмо со ссылкой уже в пути.');
    } catch (e: any) {
      haptic.error();
      setErr(e?.message ?? 'Не получилось отправить письмо');
    } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <AuthShell back>
        <Text style={{ ...FONT.h1, fontSize: 28, color: ON_PHOTO.text }}>Проверьте почту</Text>
        <Note style={{ marginTop: S.sm, marginBottom: S.xl }}>{sent}</Note>
        <AuthButton title="Вернуться ко входу" onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell back>
      <Text style={{ ...FONT.h1, fontSize: 28, color: ON_PHOTO.text }}>Забыли пароль?</Text>
      <Note style={{ marginTop: S.sm, marginBottom: S.xl }}>
        Введите почту, с которой заходили.{'\n'}Пришлём ссылку — по ней зададите новый пароль.
      </Note>

      <Field icon="mail" value={email} onChangeText={setEmail}
        placeholder="Email" autoCapitalize="none" autoFocus
        keyboardType="email-address" autoComplete="email"
        onSubmitEditing={submit} returnKeyType="send" />

      {err ? (
        <View style={{ backgroundColor: 'rgba(226,86,77,0.18)', borderRadius: R.md,
          padding: S.lg, marginBottom: S.md }}>
          <Text style={{ ...FONT.small, color: '#FFB8B3' }}>{err}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: S.sm }}>
        <AuthButton title={busy ? 'Отправляем…' : 'Прислать ссылку'}
          onPress={submit} loading={busy} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: S.xl }}>
        <Note>Вспомнили пароль?</Note>
        <Pressable onPress={() => { haptic.tap(); router.replace('/login'); }} hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ ...FONT.small, color: ON_PHOTO.accent, fontWeight: '600' }}>Войти</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
