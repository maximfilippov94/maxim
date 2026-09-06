import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { S, R, FONT } from '../src/theme';
import { AuthShell, Field, AuthButton, Note, ON_PHOTO } from '../src/ui/AuthShell';
import { SocialAuth } from '../src/ui/SocialAuth';
import { LegalNote } from '../src/ui/LegalNote';
import { Icon } from '../src/ui/Icon';
import { haptic } from '../src/haptics';

export default function Login() {
  const { signIn } = useApp();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setErr(null); setBusy(true);
    try {
      const me = await signIn(email, pass);
      haptic.success();
      router.replace(me.user_type === 'specialist' ? '/sp' : '/client');
    } catch (e: any) {
      haptic.error();
      setErr(e?.message ?? 'Не удалось войти');
    } finally { setBusy(false); }
  }

  return (
    <AuthShell back>
      <Text style={{ ...FONT.h1, fontSize: 28, color: ON_PHOTO.text }}>Вход в аккаунт</Text>
      <Note style={{ marginTop: S.sm, marginBottom: S.xl }}>
        Рады видеть вас снова!{'\n'}Продолжайте путь к своим целям.
      </Note>

      <Field icon="mail" value={email} onChangeText={setEmail}
        placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" autoComplete="email" />

      <Field icon="lock" value={pass} onChangeText={setPass}
        placeholder="Пароль" secureTextEntry={!show} autoComplete="current-password"
        onSubmitEditing={submit} returnKeyType="go"
        right={
          <Pressable onPress={() => setShow(v => !v)} hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Icon name={show ? 'eye' : 'eyeoff'} size={19} color={ON_PHOTO.text3} width={1.7} />
          </Pressable>
        } />

      {err ? (
        <View style={{ backgroundColor: 'rgba(226,86,77,0.18)', borderRadius: R.md,
          padding: S.lg, marginBottom: S.md }}>
          <Text style={{ ...FONT.small, color: '#FFB8B3' }}>{err}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: S.sm }}>
        <AuthButton title={busy ? 'Входим…' : 'Войти'} onPress={submit} loading={busy} />
      </View>

      <SocialAuth onError={setErr} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: S.xl }}>
        <Note>Ещё нет аккаунта?</Note>
        <Pressable onPress={() => { haptic.tap(); router.replace('/register'); }} hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ ...FONT.small, color: ON_PHOTO.accent, fontWeight: '600' }}>
            Зарегистрироваться
          </Text>
        </Pressable>
      </View>

      <LegalNote color={ON_PHOTO.text3} link={ON_PHOTO.text2} />

      <Note style={{ marginTop: S.lg, textAlign: 'center', color: ON_PHOTO.text3 }}>
        Панель владельца работает в браузере.
      </Note>
    </AuthShell>
  );
}
