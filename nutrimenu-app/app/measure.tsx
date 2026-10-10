import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { api } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Label, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton, SysDate } from '../src/ui/system';
import { haptic } from '../src/haptics';

/** «2026-09-05» — сервер ждёт дату, а не время. */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function MeasureSheet() {
  const { p } = useApp();
  const [date, setDate] = useState(new Date());
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [chest, setChest] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const num = (v: string) => {
    const n = parseFloat(v.replace(',', '.'));
    return isFinite(n) && n > 0 ? n : null;
  };

  async function save() {
    const w = num(waist), h = num(hips), c = num(chest);
    if (w == null && h == null && c == null) {
      haptic.error(); setErr('Заполните хотя бы один замер'); return;
    }
    setBusy(true); setErr(null);
    try {
      await api('/client/measurements', {
        method: 'POST',
        body: { measured_on: ymd(date), waist_cm: w, hips_cm: h, chest_cm: c },
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось сохранить');
    } finally { setBusy(false); }
  }

  const field = (label: string, value: string, onChange: (v: string) => void) => (
    <View style={{ flex: 1 }}>
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={t => { onChange(t); setErr(null); }}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={p.text3}
        style={{
          marginTop: S.sm, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
          paddingHorizontal: S.lg, paddingVertical: 13, fontSize: 18, fontWeight: '600',
        }}
      />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.surface }}
      contentContainerStyle={{ padding: S.xl }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xl }}>
        <Text style={{ ...FONT.h2, color: p.text, flex: 1 }}>Замеры</Text>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>

      {/* Дату задаём системным календарём: замер часто вносят на день
          позже, чем сняли, и подставлять «сегодня» молча — неправда. */}
      <Label>Дата</Label>
      <View style={{ marginTop: S.sm, marginBottom: S.lg }}>
        <SysDate value={date} onChange={setDate} max={new Date()} />
      </View>

      <View style={{ flexDirection: 'row', gap: S.md }}>
        {field('Талия, см', waist, setWaist)}
        {field('Бёдра, см', hips, setHips)}
      </View>
      <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.md }}>
        {field('Грудь, см', chest, setChest)}
        <View style={{ flex: 1 }} />
      </View>

      {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}
      <Muted style={{ marginTop: S.md }}>
        Замер за одну дату перезаписывается, а не дублируется.
      </Muted>

      <View style={{ marginTop: S.xl }}>
        <SysButton label="Сохранить" variant="prominent" disabled={busy} onPress={save} />
      </View>
    </ScrollView>
  );
}
