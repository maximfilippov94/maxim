import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../src/store';
import { api } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Label, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton, SysDate } from '../src/ui/system';
import { haptic } from '../src/haptics';
import { plural } from '../src/format';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const LENGTHS = [3, 5, 7, 14];

/** Новое меню клиенту: название, с какого дня и на сколько дней. */
export default function NewMenu() {
  const { p } = useApp();
  const { client, name } = useLocalSearchParams<{ client: string; name?: string }>();
  const cid = Number(client);

  const [title, setTitle] = useState(name ? `Меню · ${name}` : 'Меню на неделю');
  const [start, setStart] = useState(() => {
    /* По умолчанию — с завтрашнего дня: сегодня клиент уже что-то ел,
       и подменять ему день задним числом невежливо. */
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
    return d;
  });
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) { haptic.error(); setErr('Дайте меню название'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/specialist/menus', {
        method: 'POST',
        body: { client_id: cid, title: title.trim(), start_date: ymd(start), days_count: days },
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось создать');
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.surface }}
      contentContainerStyle={{ padding: S.xl }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xl }}>
        <Text style={{ ...FONT.h2, color: p.text, flex: 1 }}>Новое меню</Text>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>

      <Label>Название</Label>
      <TextInput
        value={title}
        onChangeText={t => { setTitle(t); setErr(null); }}
        placeholder="Меню на неделю" placeholderTextColor={p.text3}
        style={{
          marginTop: S.sm, marginBottom: S.lg, backgroundColor: p.inset, color: p.text,
          borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 13, fontSize: 16,
        }}
      />

      <Label>Начало</Label>
      <View style={{ marginTop: S.sm, marginBottom: S.lg }}>
        <SysDate value={start} onChange={setStart} />
      </View>

      <Label>Сколько дней</Label>
      <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
        {LENGTHS.map(n => {
          const on = n === days;
          return (
            <Pressable key={n} onPress={() => { haptic.select(); setDays(n); }}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 11, borderRadius: R.md, alignItems: 'center',
                backgroundColor: on ? p.primary : p.inset,
                opacity: pressed && !on ? 0.7 : 1,
              })}>
              <Text style={{ fontSize: 16, fontWeight: on ? '700' : '400',
                color: on ? p.onPrimary : p.text2 }}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <Muted style={{ marginTop: S.sm }}>
        {days} {plural(days, ['день', 'дня', 'дней'])} — дни заполняются блюдами после создания.
      </Muted>

      {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}

      <View style={{ marginTop: S.xl }}>
        <SysButton label="Создать меню" variant="prominent" disabled={busy} onPress={save} />
      </View>
    </ScrollView>
  );
}
