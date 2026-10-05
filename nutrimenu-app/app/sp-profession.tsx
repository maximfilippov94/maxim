/**
 * Заявка на смену профессии.
 *
 * Профессия решает, какие разделы открыты: тренеру не нужна база блюд,
 * нутрициологу закрыты тренировки. Поэтому её меняет владелец по заявке,
 * а не сам специалист — иначе доступ к разделам стал бы переключателем.
 *
 * Экран показывает и сами заявки: отказ приходит с запиской проверяющего,
 * и без неё человек не понимает, почему ему отказали.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../src/store';
import { api, ProfessionRequest, ProfessionKey, PROFESSION } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { NavBar } from '../src/ui/NavBar';
import { Card, Label, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton } from '../src/ui/system';
import { useToast } from '../src/ui/Toast';
import { haptic } from '../src/haptics';

const dmy = (v?: string | null) => {
  if (!v) return '—';
  const x = String(v).slice(0, 10).split('-');
  return x.length === 3 ? `${x[2]}.${x[1]}.${x[0]}` : String(v);
};
const STATUS: Record<string, string> = {
  pending: 'на рассмотрении', approved: 'одобрено', rejected: 'отказано',
};

export default function SpProfession() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [list, setList] = useState<ProfessionRequest[] | null>(null);
  const [pick, setPick] = useState<ProfessionKey | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ requests: ProfessionRequest[] }>('/specialist/profession-requests')
      .then(r => { setList(r.requests ?? []); setErr(null); })
      .catch(e => { setList([]); setErr(e?.message ?? 'Не открылось'); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = useCallback(async () => {
    if (!pick) { haptic.error(); setErr('Выберите профессию'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/specialist/profession-requests', {
        method: 'POST', body: { profession: pick, request_note: note.trim() },
      });
      haptic.success();
      toast('Заявка отправлена', { sub: 'владелец её рассмотрит' });
      setPick(''); setNote(''); load();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не отправилось');
    } finally { setBusy(false); }
  }, [pick, note, load, toast]);

  const pending = (list ?? []).find(r => r.status === 'pending');

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title="Профессия" />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: insets.bottom + 40,
      }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {!list ? <ActivityIndicator color={p.primary} style={{ marginTop: 30 }} /> : null}

        <Muted style={{ marginBottom: S.lg, lineHeight: 19 }}>
          От профессии зависит, какие разделы вам открыты. Поменять её может
          только владелец — по вашей заявке.
        </Muted>

        {pending ? (
          <Card>
            <Label>Заявка на рассмотрении</Label>
            <Text style={{ ...FONT.body, color: p.text, marginTop: 4 }}>
              {PROFESSION[pending.current_profession as ProfessionKey] ?? pending.current_profession}
              {' → '}
              {PROFESSION[pending.requested_profession as ProfessionKey] ?? pending.requested_profession}
            </Text>
            <Muted style={{ marginTop: 4 }}>отправлена {dmy(pending.created_at)}</Muted>
          </Card>
        ) : (
          <>
            <Label>На какую профессию перейти</Label>
            <View style={{ marginTop: S.sm, marginBottom: S.lg }}>
              {(Object.entries(PROFESSION) as [ProfessionKey, string][]).map(([k, label]) => {
                const on = pick === k;
                return (
                  <Pressable key={k} onPress={() => { haptic.select(); setPick(k); setErr(null); }}>
                    {({ pressed }) => (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: S.md,
                        paddingVertical: 13, paddingHorizontal: S.lg, marginBottom: S.sm,
                        borderRadius: R.md, borderWidth: 1,
                        borderColor: on ? p.primary : p.border,
                        backgroundColor: on ? p.primarySoft : pressed ? p.ov1 : 'transparent',
                      }}>
                        <Text style={{
                          flex: 1, fontSize: 16, color: p.text, fontWeight: on ? '600' : '400',
                        }}>{label}</Text>
                        {on ? <Icon name="check" size={16} color={p.primary} width={2.4} /> : null}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Label>Почему — коротко</Label>
            <TextInput value={note} onChangeText={setNote} multiline maxLength={500}
              placeholder="Например: прошёл обучение по спортивной нутрициологии, есть диплом"
              placeholderTextColor={p.text3}
              style={{
                marginTop: S.sm, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
                paddingHorizontal: S.lg, paddingTop: 12, paddingBottom: 12,
                fontSize: 15, minHeight: 90, textAlignVertical: 'top',
              }} />
            <Muted style={{ marginTop: S.sm }}>
              Записка помогает решить быстрее: без неё заявку будут уточнять.
            </Muted>

            {err ? (
              <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text>
            ) : null}

            <View style={{ marginTop: S.lg }}>
              <SysButton label="Отправить заявку" variant="prominent"
                disabled={busy} onPress={send} />
            </View>
          </>
        )}

        {/* Прошлые решения: отказ приходит с запиской, и она здесь
            единственное объяснение. */}
        {(list ?? []).filter(r => r.status !== 'pending').length ? (
          <>
            <Text style={{ ...FONT.h3, color: p.text, marginTop: S.xl, marginBottom: S.sm }}>
              Прошлые заявки
            </Text>
            {(list ?? []).filter(r => r.status !== 'pending').map(r => (
              <Card key={r.id} style={{ marginBottom: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.md }}>
                  <Text style={{ ...FONT.body, color: p.text, flex: 1 }}>
                    {PROFESSION[r.requested_profession as ProfessionKey] ?? r.requested_profession}
                  </Text>
                  <Text style={{
                    ...FONT.small, fontWeight: '600',
                    color: r.status === 'approved' ? p.primary : p.danger,
                  }}>{STATUS[r.status] ?? r.status}</Text>
                </View>
                <Muted style={{ marginTop: 2 }}>
                  {dmy(r.created_at)}{r.reviewed_at ? ` · решено ${dmy(r.reviewed_at)}` : ''}
                </Muted>
                {r.review_note ? (
                  <Text style={{ ...FONT.small, color: p.text2, marginTop: 6, lineHeight: 18 }}>
                    {r.review_note}
                  </Text>
                ) : null}
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
