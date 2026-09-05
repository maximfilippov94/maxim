import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { S, R, FONT } from '../src/theme';
import { Btn, Muted } from '../src/ui/base';
import { haptic } from '../src/haptics';
import { Aurora } from '../src/ui/Aurora';

export default function Login() {
  const { p, signIn } = useApp();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null); setBusy(true);
    try {
      await signIn(email, pass);
      haptic.success();
      router.replace('/client');
    } catch (e: any) {
      haptic.error();
      setErr(e?.message ?? 'Не удалось войти');
    } finally { setBusy(false); }
  }

  const field = {
    backgroundColor: p.surface, color: p.text,
    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 14,
    fontSize: 16, borderWidth: 1, borderColor: p.borderSoft,
  } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Aurora style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{
        flexGrow: 1, justifyContent: 'center',
        padding: S.xl, paddingTop: insets.top + S.xl, paddingBottom: insets.bottom + S.xl,
      }} keyboardShouldPersistTaps="handled">
        <Text style={{ ...FONT.h1, color: p.text }}>NutriMenu</Text>
        <Muted style={{ marginTop: S.sm, marginBottom: S.xxl }}>
          Войдите, чтобы открыть своё меню
        </Muted>

        <Text style={{ ...FONT.small, color: p.text3, marginBottom: S.sm }}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} style={field}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          placeholder="you@example.com" placeholderTextColor={p.text3} />

        <Text style={{ ...FONT.small, color: p.text3, marginTop: S.lg, marginBottom: S.sm }}>Пароль</Text>
        <TextInput value={pass} onChangeText={setPass} style={field}
          secureTextEntry autoComplete="current-password"
          placeholder="••••••••" placeholderTextColor={p.text3}
          onSubmitEditing={submit} returnKeyType="go" />

        {err && (
          <View style={{ backgroundColor: p.premiumSoft, borderRadius: R.md,
            padding: S.lg, marginTop: S.lg }}>
            <Text style={{ ...FONT.small, color: p.premium }}>{err}</Text>
          </View>
        )}

        <Btn title="Войти" onPress={submit} loading={busy} style={{ marginTop: S.xl }} />

        <Muted style={{ marginTop: S.xl, textAlign: 'center', lineHeight: 18 }}>
          Кабинет специалиста и панель владельца пока работают в браузере — приложение
          сейчас делается для клиентов.
        </Muted>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
