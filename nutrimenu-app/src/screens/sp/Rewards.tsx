/**
 * Привилегии за баллы.
 *
 * Раньше список был зашит в код и обещал «−10% на подписку» при том,
 * что никакой подписки в сервисе нет. Выдавать привилегию будет
 * специалист, значит он и решает, что предложить.
 *
 * Клиент обменивает баллы и получает код; привилегию по коду выдаёт
 * специалист сам — сервис здесь только ведёт счёт.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api } from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Label, Muted } from '../../ui/base';
import { SysButton, SysConfirm } from '../../ui/system';
import { haptic } from '../../haptics';
import { Loading, Fail } from '../Shopping';

interface Reward {
  id: number; title: string; note?: string | null;
  cost: number; is_active: number; created_at: string;
}

export default function SpRewards() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState<Reward[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('600');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setList((await api<{ rewards: Reward[] }>('/specialist/rewards')).rewards ?? []); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось открыть'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = useCallback(async () => {
    if (!title.trim()) { haptic.error(); setErr('Что получит клиент?'); return; }
    setBusy(true);
    try {
      await api('/specialist/rewards', {
        method: 'POST',
        body: { title: title.trim(), note: note.trim(), cost: Math.max(1, parseInt(cost, 10) || 1) },
      });
      setTitle(''); setNote(''); setCost('600');
      haptic.success(); setErr(null); load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не сохранилось'); }
    finally { setBusy(false); }
  }, [title, note, cost, load]);

  /* Скрытая привилегия остаётся в списке: её могли уже обменять, и
     совсем убирать её из истории неправильно. */
  const toggle = useCallback(async (r: Reward) => {
    setList(l => l && l.map(x => x.id === r.id ? { ...x, is_active: r.is_active ? 0 : 1 } : x));
    try { await api(`/specialist/rewards/${r.id}`, { method: 'PATCH', body: { is_active: r.is_active ? 0 : 1 } }); }
    catch { haptic.error(); load(); }
  }, [load]);

  const remove = useCallback(async (id: number) => {
    setList(l => l && l.filter(x => x.id !== id));
    try { await api(`/specialist/rewards/${id}`, { method: 'DELETE' }); haptic.success(); }
    catch { haptic.error(); load(); }
  }, [load]);

  if (err && !list) return <Fail title="Привилегии" text={err} />;
  if (!list) return <Loading title="Привилегии" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Привилегии" back />
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
        }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Animated.View entering={FadeInDown.duration(220)}>
            <Card style={{ marginTop: S.md }}>
              <Muted style={{ lineHeight: 20 }}>
                Клиенты копят баллы за отмеченные приёмы, записи веса и ваши
                задания. Здесь вы решаете, на что их можно обменять. Клиент
                назовёт вам код обмена — привилегию выдаёте вы сами.
              </Muted>
            </Card>
          </Animated.View>

          {list.length === 0 ? (
            <Card style={{ marginTop: S.md }}>
              <Muted style={{ lineHeight: 19 }}>Пока ничего не назначено.</Muted>
            </Card>
          ) : list.map((r, i) => (
            <Animated.View key={r.id}
              entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(200)}>
              <Card style={{ marginTop: S.md, gap: S.sm, opacity: r.is_active ? 1 : 0.55 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ ...FONT.h3, color: p.text }}>{r.title}</Text>
                    <Muted style={{ marginTop: 2 }}>
                      {[`${r.cost} баллов`, r.note, r.is_active ? null : 'скрыта']
                        .filter(Boolean).join(' · ')}
                    </Muted>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.lg }}>
                  <Pressable onPress={() => { haptic.tap(); toggle(r); }} hitSlop={8}>
                    <Text style={{ ...FONT.small, color: p.accent, fontWeight: '600' }}>
                      {r.is_active ? 'Скрыть' : 'Вернуть'}
                    </Text>
                  </Pressable>
                  <SysConfirm label="Убрать" tint={p.text3}
                    title={`Убрать «${r.title}»?`} confirmLabel="Убрать"
                    onConfirm={() => remove(r.id)} />
                </View>
              </Card>
            </Animated.View>
          ))}

          <Card style={{ marginTop: S.lg, gap: S.sm }}>
            <Label>Новая привилегия</Label>
            <Field value={title} onChange={setTitle} placeholder="Бесплатный разбор анализов" />
            <Field value={note} onChange={setNote} placeholder="30 минут по видео" />
            <Field value={cost} onChange={setCost} placeholder="600" keyboardType="number-pad" />
            {err ? <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text> : null}
            <SysButton label="Добавить" variant="prominent" disabled={busy} onPress={add} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ value, onChange, placeholder, keyboardType }: {
  value: string; onChange: (v: string) => void;
  placeholder: string; keyboardType?: 'number-pad';
}) {
  const { p } = useApp();
  return (
    <TextInput value={value} onChangeText={onChange}
      placeholder={placeholder} placeholderTextColor={p.text3}
      keyboardType={keyboardType}
      style={{
        backgroundColor: p.inset, color: p.text, borderRadius: R.md,
        paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
      }} />
  );
}
