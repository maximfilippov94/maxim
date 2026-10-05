/**
 * Контекст для EQUA AI: как прошла неделя.
 *
 * Цифры говорят, что человек делал, но не говорят, каково ему было.
 * Четыре шкалы и заметка — то, чего нет ни в одной отметке, и именно по
 * ним модель отличает «план тяжёлый» от «неделя была тяжёлая».
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { api } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Label, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton } from '../src/ui/system';
import { haptic } from '../src/haptics';

/* Шкалы те же, что в вебе: 1 — низко, 5 — отлично. */
const SCALES: [string, string][] = [
  ['energy', 'Энергия'],
  ['hunger', 'Голод'],
  ['recovery', 'Восстановление'],
  ['satisfaction', 'Насколько план вам подходит'],
];

export default function AICheckin() {
  const { p } = useApp();
  const [v, setV] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = useCallback(async () => {
    const missing = SCALES.find(([k]) => !v[k]);
    if (missing) { haptic.error(); setErr(`Оцените: ${missing[1].toLowerCase()}`); return; }
    setBusy(true); setErr(null);
    try {
      await api('/client/ai/checkin', {
        method: 'POST',
        body: { ...v, note: note.trim() },
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не сохранилось');
    } finally { setBusy(false); }
  }, [v, note]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.surface }}
      contentContainerStyle={{ padding: S.xl }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>
        <Text style={{ ...FONT.h2, color: p.text, flex: 1 }}>Как прошла неделя?</Text>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>
      <Muted style={{ marginBottom: S.lg, lineHeight: 19 }}>
        Это пойдёт в следующую адаптацию плана. Пять — отлично, один — плохо.
      </Muted>

      {SCALES.map(([key, label]) => (
        <View key={key} style={{ marginBottom: S.lg }}>
          <Label>{label}</Label>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: S.sm }}>
            {[1, 2, 3, 4, 5].map(n => {
              const on = v[key] === n;
              return (
                <Pressable key={n}
                  onPress={() => { haptic.select(); setV(x => ({ ...x, [key]: n })); setErr(null); }}
                  style={({ pressed }) => ({
                    flex: 1, paddingVertical: 12, borderRadius: R.control, alignItems: 'center',
                    backgroundColor: on ? p.primary : 'transparent',
                    borderWidth: on ? 0 : 1, borderColor: p.btnLine,
                    opacity: pressed && !on ? 0.6 : 1,
                  })}>
                  <Text style={{
                    fontSize: 16, fontWeight: on ? '700' : '400',
                    color: on ? p.onPrimary : p.text2,
                  }}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Label>Что ещё важно учесть</Label>
      <TextInput value={note} onChangeText={setNote} multiline maxLength={600}
        placeholder="Например: на этой неделе поздно возвращаюсь домой"
        placeholderTextColor={p.text3}
        style={{
          marginTop: S.sm, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
          paddingHorizontal: S.lg, paddingTop: 12, paddingBottom: 12,
          fontSize: 15, minHeight: 90, textAlignVertical: 'top',
        }} />

      {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}

      <View style={{ marginTop: S.xl }}>
        <SysButton label="Сохранить и пересчитать" variant="prominent"
          disabled={busy} onPress={save} />
      </View>
    </ScrollView>
  );
}
