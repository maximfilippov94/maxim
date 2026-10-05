/**
 * Назначение тренировки: кому, с какого дня, разово или каждую неделю.
 *
 * Отмечать можно сразу несколько клиентов — тренер ведёт группу и
 * назначает одно и то же пятерым; по одному это пять проходов через
 * весь экран.
 *
 * Сервер отвечает, сколько назначил и сколько уже было: повторное
 * назначение того же на тот же день он не плодит. Показываем оба числа,
 * иначе «назначено 0» читается как отказ, хотя всё на месте.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../store';
import { api, SpClient, WEEKDAYS } from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Label, Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Face } from '../../ui/Face';
import { SysButton, SysDate, Empty } from '../../ui/system';
import { useToast } from '../../ui/Toast';
import { plural } from '../../format';
import { haptic } from '../../haptics';

/** Дата для сервера: его формат — YYYY-MM-DD по местному дню, не по UTC. */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function SpWorkoutAssign() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id ?? 0) || 0;

  const [clients, setClients] = useState<SpClient[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [start, setStart] = useState(new Date());
  const [weekly, setWeekly] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ clients: SpClient[] }>('/specialist/clients')
      .then(r => setClients((r.clients ?? []).filter(c => c.status !== 'archived')))
      .catch(e => { setClients([]); setErr(e?.message ?? 'Список клиентов не открылся'); });
  }, []);

  const toggle = useCallback((cid: number) => {
    haptic.select();
    setPicked(prev => (prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid]));
    setErr(null);
  }, []);

  const toggleDay = useCallback((d: number) => {
    haptic.select();
    setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()));
    setErr(null);
  }, []);

  const assign = useCallback(async () => {
    if (!picked.length) { haptic.error(); setErr('Отметьте, кому назначить'); return; }
    if (weekly && !days.length) { haptic.error(); setErr('Отметьте дни недели'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api<{ assigned: number; already_assigned: number }>(
        `/specialist/workouts/${id}/assign`, {
          method: 'POST',
          body: {
            client_ids: picked,
            start_date: ymd(start),
            repeat_kind: weekly ? 'weekly' : 'once',
            ...(weekly ? { weekdays: days } : {}),
          },
        });
      haptic.success();
      const made = r.assigned ?? 0, was = r.already_assigned ?? 0;
      toast(made
        ? `Назначено ${made} ${plural(made, ['клиенту', 'клиентам', 'клиентам'])}`
        : 'Эта тренировка уже была назначена',
        was && made ? { sub: `${was} ${plural(was, ['уже было', 'уже были', 'уже были'])}` } : undefined);
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не назначилось');
    } finally { setBusy(false); }
  }, [picked, weekly, days, start, id, toast]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title="Назначить" />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: insets.bottom + 40,
      }} showsVerticalScrollIndicator={false}>

        <Label>Кому</Label>
        {!clients ? <ActivityIndicator color={p.accent} style={{ marginTop: 20 }} />
          : !clients.length ? (
            <Empty icon="person.2" title="Клиентов пока нет" height={200}
              note="Назначать тренировки можно тем, кто подключил вашу услугу или пришёл по вашему коду." />
          ) : (
            <View style={{ marginTop: S.sm, marginBottom: S.lg }}>
              {clients.map(c => {
                const on = picked.includes(c.id);
                return (
                  <Pressable key={c.id} onPress={() => toggle(c.id)}>
                    {({ pressed }) => (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: S.md,
                        paddingVertical: 10, paddingHorizontal: S.md, borderRadius: R.md,
                        backgroundColor: on ? p.primarySoft : pressed ? p.ov1 : 'transparent',
                      }}>
                        <Face name={c.name} url={c.avatar_url} size={34} />
                        <Text numberOfLines={1} style={{ flex: 1, ...FONT.body, color: p.text }}>
                          {c.name}
                        </Text>
                        <View style={{
                          width: 22, height: 22, borderRadius: 11,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: on ? p.primary : 'transparent',
                          borderWidth: on ? 0 : 1.5, borderColor: p.track,
                        }}>
                          {on ? <Icon name="check" size={12} color={p.onPrimary} width={2.6} /> : null}
                        </View>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

        <Label>С какого дня</Label>
        <View style={{ marginTop: S.sm, marginBottom: S.lg }}>
          <SysDate value={start} onChange={setStart} />
        </View>

        <Label>Повторять</Label>
        <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
          {[[false, 'Один раз'], [true, 'Каждую неделю']].map(([v, l]) => {
            const on = v === weekly;
            return (
              <Pressable key={String(v)}
                onPress={() => { haptic.select(); setWeekly(Boolean(v)); setErr(null); }}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 11, borderRadius: R.control, alignItems: 'center',
                  backgroundColor: on ? p.primary : 'transparent',
                  borderWidth: on ? 0 : 1, borderColor: p.btnLine,
                  opacity: pressed && !on ? 0.6 : 1,
                })}>
                <Text numberOfLines={1} style={{
                  fontSize: 14, fontWeight: on ? '600' : '400',
                  color: on ? p.onPrimary : p.text2,
                }}>{String(l)}</Text>
              </Pressable>
            );
          })}
        </View>

        {weekly ? (
          <>
            <View style={{ marginTop: S.lg }}><Label>Дни недели</Label></View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: S.sm }}>
              {WEEKDAYS.map(([n, l]) => {
                const on = days.includes(n);
                return (
                  <Pressable key={n} onPress={() => toggleDay(n)}
                    style={({ pressed }) => ({
                      flex: 1, aspectRatio: 1, borderRadius: R.sm,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: on ? p.primary : 'transparent',
                      borderWidth: on ? 0 : 1, borderColor: p.btnLine,
                      opacity: pressed && !on ? 0.6 : 1,
                    })}>
                    <Text style={{
                      fontSize: 13, fontWeight: on ? '600' : '400',
                      color: on ? p.onPrimary : p.text2,
                    }}>{l}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginTop: S.lg }}>{err}</Text>
        ) : null}
        <Muted style={{ marginTop: S.lg }}>
          Клиент получит уведомление о новой тренировке.
        </Muted>

        <View style={{ marginTop: S.xl }}>
          <SysButton label="Назначить" variant="prominent"
            disabled={busy || !clients?.length} onPress={assign} />
        </View>
      </ScrollView>
    </View>
  );
}
