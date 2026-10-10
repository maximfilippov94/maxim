import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api, SpService, SpServiceType, SERVICE_KIND } from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Label, Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { SysButton, SysConfirm, Empty } from '../../ui/system';
import { rub } from '../../format';
import { haptic } from '../../haptics';
import { Loading } from '../Shopping';

/* Видов ровно два — те же, что понимает сервер. «Встреча» и «пакет»
   здесь были, но на сервере их нет: выбор молча превращался в разовую. */
const KINDS: [string, string][] = [
  ['one_time', 'Разовая'], ['subscription', 'Подписка'],
];

/** Услуги и цены: то, что клиент видит в разделе «Услуги». */
export default function SpServices() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<SpService[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [kind, setKind] = useState('one_time');
  const [period, setPeriod] = useState('30');
  const [dur, setDur] = useState('');
  const [busy, setBusy] = useState(false);

  /* Какие типы услуг эта роль вправе продавать — сервер отдаёт списком
     вместе с услугами. Без выбора он угадывал тип по виду оплаты, а по
     этому полю решается, кто ведёт клиента. */
  const [types, setTypes] = useState<SpServiceType[]>([]);
  const [type, setType] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api<{ services: SpService[]; service_types?: SpServiceType[] }>(
        '/specialist/services');
      setList(r.services ?? []);
      setTypes(r.service_types ?? []);
      setType(t => t || (r.service_types?.[0]?.type ?? ''));
    }
    catch (e: any) { setErr(e.message); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = useCallback(async () => {
    if (!title.trim()) { haptic.error(); setErr('Как называется услуга?'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/specialist/services', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: desc.trim() || null,
          kind,
          ...(type ? { service_type: type } : {}),
          price: price.replace(',', '.'),
          ...(kind === 'subscription'
            ? { period_days: Number(period) || 30 }
            : { duration_min: dur.trim() }),
        },
      });
      haptic.success();
      setTitle(''); setDesc(''); setPrice(''); setDur(''); setOpen(false);
      await load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось добавить'); }
    finally { setBusy(false); }
  }, [title, desc, price, kind, type, period, dur, load]);

  const toggle = useCallback(async (s: SpService) => {
    const next = s.is_active ? 0 : 1;
    setList(l => l && l.map(x => x.id === s.id ? { ...x, is_active: next } : x));
    haptic.select();
    try { await api(`/specialist/services/${s.id}`, { method: 'PATCH', body: { is_active: next } }); }
    catch { load(); }
  }, [load]);

  const remove = useCallback(async (id: number) => {
    setList(l => l && l.filter(x => x.id !== id));
    try { await api(`/specialist/services/${id}`, { method: 'DELETE' }); }
    catch { load(); }
  }, [load]);

  if (!list) return <Loading title="Услуги" />;

  const field = {
    marginTop: S.sm, backgroundColor: p.inset, color: p.text,
    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Услуги и цены" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
      }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text>
        ) : null}

        <View style={{ marginTop: S.md }}>
          <SysButton
            label={open ? 'Свернуть' : 'Новая услуга'}
            icon={open ? 'chevron.up' : 'plus'}
            onPress={() => { haptic.tap(); setOpen(o => !o); setErr(null); }}
          />
        </View>

        {open ? (
          <Animated.View entering={FadeIn.duration(220)}>
            <Card style={{ marginTop: S.md }}>
              <Label>Название</Label>
              <TextInput value={title} onChangeText={t => { setTitle(t); setErr(null); }}
                placeholder="Ведение · месяц" placeholderTextColor={p.text3} style={field} />

              <View style={{ height: S.md }} />
              <Label>Что входит</Label>
              <TextInput value={desc} onChangeText={setDesc} multiline
                placeholder="меню, корректировки, чат" placeholderTextColor={p.text3}
                style={{ ...field, minHeight: 70, textAlignVertical: 'top' }} />

              <View style={{ height: S.md }} />
              <Label>Цена, ₽</Label>
              <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad"
                placeholder="4500" placeholderTextColor={p.text3} style={field} />

              {/* Что именно продаётся. Список приходит с сервера и зависит
                  от роли: тренер не может продавать ведение питания. Без
                  выбора сервер угадывал тип по виду оплаты. */}
              {types.length > 1 ? (
                <>
                  <View style={{ height: S.md }} />
                  <Label>Что это за услуга</Label>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.sm }}>
                    {types.map(t => {
                      const on = t.type === type;
                      return (
                        <Pressable key={t.type} onPress={() => { haptic.select(); setType(t.type); }}
                          style={({ pressed }) => ({
                            paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.md,
                            backgroundColor: on ? p.primary : p.inset,
                            opacity: pressed && !on ? 0.7 : 1,
                          })}>
                          <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
                            color: on ? p.onPrimary : p.text2 }}>{t.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <View style={{ height: S.md }} />
              <Label>Оплата</Label>
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                {KINDS.map(([k, l]) => {
                  const on = k === kind;
                  return (
                    <Pressable key={k} onPress={() => { haptic.select(); setKind(k); }}
                      style={({ pressed }) => ({
                        flex: 1, paddingVertical: 9, borderRadius: R.md, alignItems: 'center',
                        backgroundColor: on ? p.primary : p.inset,
                        opacity: pressed && !on ? 0.7 : 1,
                      })}>
                      <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
                        color: on ? p.onPrimary : p.text2 }}>{l}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Период спрашиваем только у подписки: у разовой услуги
                  его нет, и пустое поле сбивало бы с толку. */}
              {/* У разовой услуги мера — длительность: по одной цене
                  без неё двух специалистов не сравнить. */}
              {kind !== 'subscription' ? (
                <View style={{ marginTop: S.md }}>
                  <Label>Длительность, минут</Label>
                  <TextInput value={dur} onChangeText={setDur} keyboardType="number-pad"
                    placeholder="60" placeholderTextColor={p.text3}
                    style={{ ...FONT.body, color: p.text, backgroundColor: p.inset,
                      borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, marginTop: 6 }} />
                  <Muted style={{ marginTop: 6, lineHeight: 18 }}>
                    Клиент увидит её рядом с ценой: «3000 ₽ · 60 мин.». Можно не заполнять.
                  </Muted>
                </View>
              ) : null}
              {kind === 'subscription' ? (
                <View style={{ marginTop: S.md }}>
                  <Label>Период, дней</Label>
                  <TextInput value={period} onChangeText={setPeriod} keyboardType="number-pad"
                    placeholder="30" placeholderTextColor={p.text3}
                    style={{ ...FONT.body, color: p.text, backgroundColor: p.inset,
                      borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, marginTop: 6 }} />
                  <Muted style={{ marginTop: 6, lineHeight: 18 }}>
                    От 7 до 31 дня. Дольше месяца нельзя: столько деньги у платёжного сервиса не держатся.
                  </Muted>
                </View>
              ) : null}

              <View style={{ marginTop: S.lg }}>
                <SysButton label="Добавить" variant="prominent" disabled={busy} onPress={add} />
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {list.length === 0 ? (
          <Empty icon="tag" title="Услуг пока нет"
            note="Добавьте хотя бы одну — клиент увидит её в разделе «Услуги»." />
        ) : list.map((s, i) => (
          <Animated.View key={s.id} entering={FadeIn.duration(220)}>
            <Card style={{ marginTop: S.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...FONT.h3, color: s.is_active ? p.text : p.text3 }}>
                    {s.title}
                  </Text>
                  {s.description ? (
                    <Muted style={{ marginTop: 3, lineHeight: 18 }}>{s.description}</Muted>
                  ) : null}
                  <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm }}>
                    {rub(s.price_kop)}
                    <Text style={{ ...FONT.small, color: p.text3 }}>
                      {'  '}{SERVICE_KIND[s.kind] ?? s.kind}
                      {s.period_days ? ` · ${s.period_days} дней` : ''}
                      {s.duration_min ? ` · ${s.duration_min} мин.` : ''}
                    </Text>
                  </Text>
                </View>
                <Switch value={!!s.is_active} onValueChange={() => toggle(s)}
                  trackColor={{ true: p.primary, false: p.track }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: S.sm }}>
                <SysConfirm
                  label="Удалить" tint={p.danger}
                  title={`Удалить «${s.title}»?`}
                  message="Клиенты перестанут видеть эту услугу."
                  confirmLabel="Удалить услугу"
                  onConfirm={() => remove(s.id)}
                />
              </View>
            </Card>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}
