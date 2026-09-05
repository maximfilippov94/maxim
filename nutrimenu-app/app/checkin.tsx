import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { api } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Label, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton } from '../src/ui/system';
import { haptic } from '../src/haptics';

const EASE = [
  { v: 1, l: 'Очень сложно' },
  { v: 2, l: 'Сложно' },
  { v: 3, l: 'Нормально' },
  { v: 4, l: 'Легко' },
  { v: 5, l: 'Очень легко' },
];

/** Понедельник текущей недели — сервер группирует отчёты по нему. */
function weekStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CheckinSheet() {
  const { p } = useApp();
  const [ease, setEase] = useState(3);
  const [well, setWell] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const w = parseInt(well, 10);
    if (well && (!isFinite(w) || w < 1 || w > 10)) {
      haptic.error(); setErr('Самочувствие — число от 1 до 10'); return;
    }
    setBusy(true); setErr(null);
    try {
      await api('/client/checkin', {
        method: 'POST',
        body: {
          week_start: weekStart(),
          ease_score: ease,
          wellbeing_score: well ? w : null,
          difficulties: text.trim() ? [text.trim()] : [],
          comment: text.trim() || null,
        },
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось отправить');
    } finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.surface }}
      contentContainerStyle={{ padding: S.xl }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xl }}>
        <Text style={{ ...FONT.h2, color: p.text, flex: 1 }}>Как прошла неделя?</Text>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>

      <Label>Легко ли соблюдать меню</Label>
      <View style={{ marginTop: S.sm, marginBottom: S.lg, gap: 1 }}>
        {EASE.map(o => {
          const on = o.v === ease;
          return (
            <Pressable key={o.v} onPress={() => { haptic.select(); setEase(o.v); }}>
              {({ pressed }) => (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: S.md,
                  paddingVertical: 12, paddingHorizontal: S.lg,
                  borderRadius: R.md,
                  backgroundColor: on ? p.primarySoft : pressed ? p.ov1 : 'transparent',
                }}>
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: on ? p.primary : 'transparent',
                    borderWidth: on ? 0 : 1.5, borderColor: p.track,
                  }}>
                    {on ? <Icon name="check" size={11} color={p.onPrimary} width={2.6} /> : null}
                  </View>
                  <Text style={{ fontSize: 15, color: on ? p.text : p.text2 }}>{o.l}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Label>Самочувствие, 1–10</Label>
      <TextInput
        value={well}
        onChangeText={t => { setWell(t.replace(/[^0-9]/g, '')); setErr(null); }}
        keyboardType="number-pad"
        placeholder="7"
        placeholderTextColor={p.text3}
        maxLength={2}
        style={{
          marginTop: S.sm, marginBottom: S.lg, backgroundColor: p.inset, color: p.text,
          borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 13,
          fontSize: 18, fontWeight: '600',
        }}
      />

      <Label>Что было сложным</Label>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Например: не хватало времени готовить"
        placeholderTextColor={p.text3}
        multiline
        style={{
          marginTop: S.sm, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
          paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
          minHeight: 90, textAlignVertical: 'top',
        }}
      />

      {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}
      <Muted style={{ marginTop: S.md }}>Отчёт увидит ваш специалист.</Muted>

      <View style={{ marginTop: S.xl }}>
        <SysButton label="Отправить специалисту" variant="prominent" disabled={busy} onPress={save} />
      </View>
    </ScrollView>
  );
}
