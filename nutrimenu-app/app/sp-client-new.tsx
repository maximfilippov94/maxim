import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { api, mediaUrl, NewClientResult } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Card, Label, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton } from '../src/ui/system';
import { haptic } from '../src/haptics';

const GOALS = ['Снижение веса', 'Поддержание', 'Набор массы', 'Здоровье и энергия'];

/**
 * Новый клиент заводится специалистом, а входит по ссылке-приглашению:
 * пароль он придумает сам, и никто его за него не знает.
 */
export default function NewClient() {
  const { p } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [goal, setGoal] = useState(GOALS[0]);
  const [kcal, setKcal] = useState('1800');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<NewClientResult | null>(null);
  const [copied, setCopied] = useState(false);

  /* Сервер отдаёт ссылку уже со своим адресом; относительный путь
     достраиваем тем же способом, что и ссылки на файлы. */
  const link = done ? (mediaUrl(done.invite_url) ?? '') : '';

  async function save() {
    if (!name.trim()) { haptic.error(); setErr('Как зовут клиента?'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api<NewClientResult>('/specialist/clients', {
        method: 'POST',
        body: {
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          goal,
          target_kcal: parseInt(kcal, 10) || 1800,
        },
      });
      haptic.success();
      setDone(r);
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось создать');
    } finally { setBusy(false); }
  }

  const field = {
    marginTop: S.sm, backgroundColor: p.inset, color: p.text,
    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 13, fontSize: 16,
  } as const;

  if (done) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: p.surface }}
        contentContainerStyle={{ padding: S.xl }}>
        <Text style={{ ...FONT.h2, color: p.text, marginBottom: S.sm }}>Клиент добавлен</Text>
        <Muted style={{ marginBottom: S.lg, lineHeight: 19 }}>
          Отправьте ему ссылку — по ней он задаст пароль и войдёт в приложение.
        </Muted>
        <Card>
          <Label>Ссылка-приглашение</Label>
          <Text selectable style={{ ...FONT.body, color: p.text, marginTop: S.sm, lineHeight: 19 }}>
            {link}
          </Text>
        </Card>
        <View style={{ gap: S.md, marginTop: S.lg }}>
          <SysButton label={copied ? 'Скопировано' : 'Скопировать ссылку'}
            icon={copied ? 'checkmark' : 'doc.on.doc'} variant="prominent"
            onPress={async () => {
              await Clipboard.setStringAsync(link);
              haptic.success(); setCopied(true);
            }} />
          <SysButton label="Готово" onPress={() => router.back()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.surface }}
      contentContainerStyle={{ padding: S.xl }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xl }}>
        <Text style={{ ...FONT.h2, color: p.text, flex: 1 }}>Новый клиент</Text>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>

      <Label>Имя</Label>
      <TextInput value={name} onChangeText={t => { setName(t); setErr(null); }}
        placeholder="Анна Петрова" placeholderTextColor={p.text3} style={field} />

      <View style={{ height: S.lg }} />
      <Label>Email</Label>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none"
        keyboardType="email-address" placeholder="необязательно"
        placeholderTextColor={p.text3} style={field} />

      <View style={{ height: S.lg }} />
      <Label>Телефон</Label>
      <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad"
        placeholder="необязательно" placeholderTextColor={p.text3} style={field} />

      <View style={{ height: S.lg }} />
      <Label>Цель</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.sm }}>
        {GOALS.map(g => {
          const on = g === goal;
          return (
            <Pressable key={g} onPress={() => { haptic.select(); setGoal(g); }}
              style={({ pressed }) => ({
                paddingHorizontal: 13, paddingVertical: 8, borderRadius: R.pill,
                backgroundColor: on ? p.primary : p.inset,
                opacity: pressed && !on ? 0.7 : 1,
              })}>
              <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
                color: on ? p.onPrimary : p.text2 }}>{g}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: S.lg }} />
      <Label>Норма калорий</Label>
      <TextInput value={kcal} onChangeText={t => setKcal(t.replace(/\D/g, ''))}
        keyboardType="number-pad" maxLength={4} style={field} />
      <Muted style={{ marginTop: S.sm }}>Нормы БЖУ можно уточнить в карточке клиента.</Muted>

      {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}

      <View style={{ marginTop: S.xl }}>
        <SysButton label="Добавить клиента" variant="prominent" disabled={busy} onPress={save} />
      </View>
    </ScrollView>
  );
}
