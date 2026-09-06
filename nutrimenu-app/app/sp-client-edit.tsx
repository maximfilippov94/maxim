import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../src/store';
import { api, SpClient } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Label, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton } from '../src/ui/system';
import { haptic } from '../src/haptics';

const GOALS = ['Снижение веса', 'Поддержание', 'Набор массы', 'Здоровье и энергия'];

/** Цели и нормы клиента: их назначает специалист, клиент только видит. */
export default function EditClient() {
  const { p } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cid = Number(id);

  const [c, setC] = useState<SpClient | null>(null);
  const [goal, setGoal] = useState('');
  const [kcal, setKcal] = useState('');
  const [prot, setProt] = useState('');
  const [fat, setFat] = useState('');
  const [carb, setCarb] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ client: SpClient }>(`/specialist/clients/${cid}`).then(r => {
      const x = r.client;
      setC(x);
      setGoal(x.goal ?? '');
      setKcal(x.target_kcal ? String(Math.round(x.target_kcal)) : '');
      setProt(x.target_protein ? String(Math.round(x.target_protein)) : '');
      setFat(x.target_fat ? String(Math.round(x.target_fat)) : '');
      setCarb(x.target_carbs ? String(Math.round(x.target_carbs)) : '');
      setNote(x.notes ?? '');
    }).catch(e => setErr(e.message));
  }, [cid]);

  async function save() {
    setBusy(true); setErr(null);
    const num = (v: string) => { const n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : null; };
    try {
      await api(`/specialist/clients/${cid}`, {
        method: 'PATCH',
        body: {
          goal: goal || null,
          target_kcal: num(kcal), target_protein: num(prot),
          target_fat: num(fat), target_carbs: num(carb),
          notes: note.trim() || null,
        },
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось сохранить');
    } finally { setBusy(false); }
  }

  const field = {
    marginTop: S.sm, backgroundColor: p.inset, color: p.text,
    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 13,
    fontSize: 17, fontWeight: '600' as const,
  };

  if (!c) {
    return (
      <View style={{ flex: 1, backgroundColor: p.surface, justifyContent: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  const macro = (label: string, v: string, set: (s: string) => void) => (
    <View style={{ flex: 1 }}>
      <Label>{label}</Label>
      <TextInput value={v} onChangeText={t => set(t.replace(/\D/g, ''))}
        keyboardType="number-pad" maxLength={4} placeholder="—"
        placeholderTextColor={p.text3} style={field} />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.surface }}
      contentContainerStyle={{ padding: S.xl }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xl }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...FONT.h2, color: p.text }}>Цели и нормы</Text>
          <Muted style={{ marginTop: 2 }}>{c.name}</Muted>
        </View>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>

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

      <View style={{ height: S.lg }} />
      <View style={{ flexDirection: 'row', gap: S.md }}>
        {macro('Белки, г', prot, setProt)}
        {macro('Жиры, г', fat, setFat)}
        {macro('Углеводы, г', carb, setCarb)}
      </View>

      <View style={{ height: S.lg }} />
      <Label>Заметка</Label>
      <TextInput value={note} onChangeText={setNote} multiline
        placeholder="что важно помнить об этом клиенте"
        placeholderTextColor={p.text3}
        style={{ ...field, fontSize: 15, fontWeight: '400', minHeight: 90,
          textAlignVertical: 'top', paddingVertical: 12 }} />
      <Muted style={{ marginTop: S.sm }}>Заметку видите только вы.</Muted>

      {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}

      <View style={{ marginTop: S.xl }}>
        <SysButton label="Сохранить" variant="prominent" disabled={busy} onPress={save} />
      </View>
    </ScrollView>
  );
}
