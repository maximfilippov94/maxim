import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { api } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Label, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton, SysDate } from '../src/ui/system';
import { haptic } from '../src/haptics';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Открывается системной шторкой: её видно поверх экрана, её можно тянуть,
 *  и она не выбивает пользователя из контекста, как полноэкранное окно. */
export default function WeightSheet() {
  const { p, me } = useApp();
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const v = parseFloat(value.replace(',', '.'));
    if (!isFinite(v) || v < 20 || v > 400) {
      haptic.error(); setErr('Введите вес от 20 до 400 кг'); return;
    }
    setBusy(true); setErr(null);
    try {
      await api('/client/weight', {
        method: 'POST', body: { weight_kg: v, measured_on: ymd(date) },
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось сохранить');
    } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.surface, padding: S.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xl }}>
        <Text style={{ ...FONT.h2, color: p.text, flex: 1 }}>Записать вес</Text>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>

      <Muted style={{ marginBottom: S.sm }}>
        Прошлый вес {me?.user?.weight_kg ? String(me.user.weight_kg).replace('.', ',') + ' кг' : 'не записан'}
      </Muted>
      <TextInput
        value={value}
        onChangeText={t => { setValue(t); setErr(null); }}
        autoFocus
        keyboardType="decimal-pad"
        placeholder="67,4"
        placeholderTextColor={p.text3}
        style={{
          backgroundColor: p.inset, color: p.text, borderRadius: R.md,
          paddingHorizontal: S.lg, paddingVertical: 16,
          fontSize: 30, fontWeight: '700', letterSpacing: -0.8,
        }}
      />

      {/* Взвешиваются утром, а записывают когда придётся — системный
          календарь позволяет отнести замер к нужному дню. */}
      <View style={{ marginTop: S.lg }}>
        <Label>Дата</Label>
        <View style={{ marginTop: S.sm }}>
          <SysDate value={date} onChange={setDate} max={new Date()} />
        </View>
      </View>

      {err && <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text>}
      <View style={{ marginTop: S.xl }}>
        <SysButton label="Сохранить" variant="prominent" disabled={busy} onPress={save} />
      </View>
    </View>
  );
}
