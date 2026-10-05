/**
 * Услуги специалиста и подключение.
 *
 * Оплаты пока нет: услуга включается сразу, а специалист видит выбор.
 * Главное на экране — срок подключённой услуги: за ним сюда и заходят,
 * поэтому он стоит отдельной строкой со значком, а не прячется в подпись.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, ServicesResponse, Subscription } from '../api';
import { S, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { Face } from '../ui/Face';
import { SysButton, Empty } from '../ui/system';
import { rub, plural, dmy } from '../format';
import { haptic } from '../haptics';
import { Loading, Fail } from './Shopping';

const period = (kind: string, days?: number | null) => {
  if (kind !== 'subscription') return 'разово';
  const d = days || 30;
  return d === 30 ? 'в месяц' : d === 7 ? 'в неделю'
    : `за ${d} ${plural(d, ['день', 'дня', 'дней'])}`;
};

/* «Осталось 0 дней» у работающей услуги читается как поломка, поэтому
   последний день называем последним. */
const left = (s: Subscription) => {
  if (s.kind !== 'subscription' || s.days_left == null) return 'разовая услуга';
  const d = s.days_left;
  if (d <= 0) return 'заканчивается сегодня';
  if (d === 1) return 'остался 1 день';
  return `осталось ${d} ${plural(d, ['день', 'дня', 'дней'])}`;
};

export default function Services() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<ServicesResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState('');
  /* Выбранная услуга, промокод и ответ проверки — лист подключения. */
  const [pick, setPick] = useState<{ id: number; title: string } | null>(null);
  const [promo, setPromo] = useState('');
  const [promoRes, setPromoRes] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try { setD(await api<ServicesResponse>('/client/services')); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Отправка подключения: промокод и, если пришёл запрос подтверждения,
     второй заход с `confirm`. Вынесено отдельно — вызывается дважды. */
  const send = useCallback(async (id: number, promo: string, confirm: boolean) =>
    api<{ confirmation_url?: string | null }>(`/client/services/${id}/activate`, {
      method: 'POST',
      body: { ...(promo ? { promo } : {}), ...(confirm ? { confirm: true } : {}) },
    }), []);

  const finish = useCallback(async (r: { confirmation_url?: string | null }) => {
    /* Когда приём платежей подключён, сервер отдаёт ссылку на оплату:
       услуга включится не сейчас, а когда придёт подтверждение от
       платёжного сервиса. */
    if (r?.confirmation_url) { await Linking.openURL(r.confirmation_url); return; }
    haptic.success(); setPick(null); setPromo(''); setPromoRes(null); await load();
  }, [load]);

  const activate = useCallback(async (id: number) => {
    setBusy(true); setErr(null);
    const code = promo.trim();
    try {
      await finish(await send(id, code, false));
    } catch (e: any) {
      /* У клиента действует EQUA AI: сервер не отказывает, а спрашивает —
         AI завершится, остаток пойдёт в зачёт новой услуги. Без этой
         ветки человек видел отказ и не узнавал ни про зачёт, ни про то,
         что подключение вообще возможно. */
      const sw = e?.data?.need_confirm ? (e.data.ai_switch ?? {}) : null;
      if (!sw) {
        haptic.error(); setErr(e?.message ?? 'Не удалось подключить'); setBusy(false); return;
      }
      const days = sw.days_left != null
        ? ` — ещё ${sw.days_left} ${plural(Number(sw.days_left), ['день', 'дня', 'дней'])}`
        : '';
      Alert.alert('Сейчас действует EQUA AI',
        `«${sw.title || sw.plan || ''}»${days}.\n\n`
        + `После успешной оплаты AI завершится, а остаток ${rub(Number(sw.credit_kop) || 0)} `
        + 'пойдёт в зачёт новой услуги. Продолжить?',
        [
          { text: 'Отмена', style: 'cancel', onPress: () => setBusy(false) },
          { text: 'Продолжить', onPress: async () => {
            try { await finish(await send(id, code, true)); }
            catch (e2: any) { haptic.error(); setErr(e2?.message ?? 'Не удалось подключить'); }
            finally { setBusy(false); }
          } },
        ]);
      return;
    }
    setBusy(false);
  }, [promo, send, finish]);

  /* Скидку проверяем до оплаты: узнать, что код не подошёл, в момент
     списания денег — худший момент для такой новости. */
  const checkPromo = useCallback(async (serviceId: number) => {
    const code = promo.trim();
    if (!code) { setPromoRes(null); return; }
    haptic.tap();
    try {
      const r = await api<{ percent: number; price_kop: number; total_kop: number }>(
        '/client/promo/check', { method: 'POST', body: { code, service_id: serviceId } });
      setPromoRes({ ok: true,
        text: `Скидка ${r.percent} % — к оплате ${rub(r.total_kop)} вместо ${rub(r.price_kop)}` });
    } catch (e: any) {
      setPromoRes({ ok: false, text: e?.message ?? 'Код не подошёл' });
    }
  }, [promo]);

  /* Кнопка «подтвердить» без второй кнопки ничего не значит: рядом
     всегда есть возражение, и пока идёт спор, деньги заморожены. */
  const accept = useCallback((sub: Subscription) => {
    Alert.alert('Подтвердить выполнение?',
      `«${sub.title}»\n\nПосле подтверждения деньги перейдут специалисту.`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Подтвердить', onPress: async () => {
        setBusy(true);
        try {
          await api(`/client/subscriptions/${sub.id}/accept`, { method: 'POST', body: {} });
          haptic.success(); await load();
        } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось подтвердить'); }
        finally { setBusy(false); }
      } },
    ]);
  }, [load]);

  /* Возражение пишем в поле на экране, а не в системном окне ввода:
     Alert.prompt есть только на iOS, а на Android молча ничего бы не
     показал. */
  const sendDispute = useCallback(async (sub: Subscription) => {
    if (note.trim().length < 10) { haptic.error(); setErr('Опишите хотя бы парой фраз'); return; }
    setBusy(true);
    try {
      await api(`/client/subscriptions/${sub.id}/dispute`, { method: 'POST', body: { note: note.trim() } });
      haptic.success(); setNote(''); setDisputing(false); await load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось отправить'); }
    finally { setBusy(false); }
  }, [note, load]);

  if (err && !d) return <Fail title="Услуги и цены" text={err} />;
  if (!d) return <Loading title="Услуги и цены" />;

  /* Без специалиста показывать нечего и подключать не у кого — ведём в
     каталог, а не в пустой экран с ценами. */
  if (!d.specialist) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar title="Услуги и цены" back />
        <View style={{ paddingHorizontal: S.lg }}>
          <Empty icon="person.2" title="Сначала выберите специалиста"
            note="Услуги и цены у каждого свои — они появятся здесь, когда вы выберете, с кем работать." />
          <SysButton label="Открыть каталог" variant="prominent" icon="person.2"
            onPress={() => { haptic.tap(); router.push('/specialist'); }} />
        </View>
      </View>
    );
  }

  const list = (d.services ?? []).filter(s => s.is_active);
  const sub = d.subscription;
  const tone = !sub || sub.kind !== 'subscription' || sub.days_left == null ? p.primary
    : sub.days_left <= 3 ? p.danger : sub.days_left <= 7 ? p.warn : p.primary;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Услуги и цены" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.md }}>
          <Face url={d.specialist.avatar_url} name={d.specialist.name} size={44} />
          <View style={{ flex: 1 }}>
            <Label>Ваш специалист</Label>
            <Text style={{ ...FONT.h3, color: p.text, marginTop: 2 }}>{d.specialist.name}</Text>
          </View>
        </Card>

        {sub?.awaiting_accept ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <Card style={{ marginBottom: S.md, borderWidth: 1.5, borderColor: p.primary }}>
              <Label>Требуется подтверждение</Label>
              {/* Цена не сжимается и не переносится, название занимает остальное:
                  без flexShrink длинное название отжимало цену за край карточки. */}
              <View style={{ flexDirection: 'row', alignItems: 'baseline',
                justifyContent: 'space-between', gap: S.md, marginTop: 2 }}>
                <Text style={{ ...FONT.h3, color: p.text, flex: 1 }}>{sub.title}</Text>
                <Text style={{ ...FONT.h3, color: p.text, flexShrink: 0 }} numberOfLines={1}>{rub(sub.price_kop)}</Text>
              </View>
              <Muted style={{ marginTop: 6, lineHeight: 18 }}>
                Специалист отметил услугу выполненной. Подтвердите — и деньги перейдут ему.
                {sub.accept_days_left != null
                  ? ` Если промолчать, подтвердится само через ${sub.accept_days_left} ${plural(sub.accept_days_left, ['день', 'дня', 'дней'])}.`
                  : ''}
              </Muted>
              {disputing ? (
                <View style={{ marginTop: S.md }}>
                  <Label>Что произошло</Label>
                  <TextInput value={note} onChangeText={setNote} multiline
                    placeholder="Например: консультация не состоялась, перенести не удалось"
                    placeholderTextColor={p.text3}
                    style={{ ...FONT.body, color: p.text, backgroundColor: p.inset, borderRadius: 12,
                      paddingHorizontal: 14, paddingVertical: 12, marginTop: 6, minHeight: 88,
                      textAlignVertical: 'top' }} />
                  <View style={{ marginTop: S.md, gap: S.sm }}>
                    <SysButton label="Отправить" variant="prominent" icon="send"
                      disabled={busy} onPress={() => sendDispute(sub)} />
                    <SysButton label="Отмена" variant="quiet"
                      onPress={() => { setDisputing(false); setNote(''); }} />
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: S.md, gap: S.sm }}>
                  <SysButton label="Подтвердить" variant="prominent" icon="check"
                    disabled={busy} onPress={() => accept(sub)} />
                  <SysButton label="Что-то не так" variant="quiet"
                    disabled={busy} onPress={() => { haptic.tap(); setDisputing(true); }} />
                </View>
              )}
            </Card>
          </Animated.View>
        ) : null}

        {sub && !sub.awaiting_accept ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <Card style={{ marginBottom: S.md }}>
              {/* Название и цена — в одной строке. Пока цена стояла рядом с
                  колонкой «надзаголовок + название», она выравнивалась по
                  верху блока и висела выше названия, к которому относится. */}
              <Label>Подключено</Label>
              <View style={{ flexDirection: 'row', alignItems: 'baseline',
                justifyContent: 'space-between', gap: S.md, marginTop: 2 }}>
                <Text style={{ ...FONT.h3, color: p.text, flex: 1 }}>{sub.title}</Text>
                <Text style={{ ...FONT.h3, color: p.text, flexShrink: 0 }} numberOfLines={1}>{rub(sub.price_kop)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: S.md,
                paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: p.ov2 }}>
                <Icon name="clock" size={16} color={tone} width={1.8} />
                <Text style={{ ...FONT.body, fontWeight: '600', color: tone }}>{left(sub)}</Text>
                {sub.expires_at ? (
                  <Text style={{ ...FONT.small, color: p.text3, marginLeft: 'auto' }}>
                    до {dmy(sub.expires_at.slice(0, 10))}
                  </Text>
                ) : null}
              </View>
              {d.note ? (
                <Muted style={{ marginTop: S.sm, lineHeight: 18 }}>{d.note}</Muted>
              ) : null}
            </Card>
          </Animated.View>
        ) : null}

        {list.length ? list.map((s, i) => {
          const on = sub && Number(sub.service_id) === Number(s.id);
          return (
            <Animated.View key={s.id} entering={FadeInDown.delay(i * 40).duration(240)}>
              <Card style={{ marginBottom: S.sm,
                ...(on ? { borderWidth: 1.5, borderColor: p.primary } : null) }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.md }}>
                  <Text style={{ ...FONT.h3, color: p.text, flex: 1 }}>{s.title}</Text>
                  <Text style={{ ...FONT.h3, color: p.text, flexShrink: 0 }} numberOfLines={1}>{rub(s.price_kop)}</Text>
                </View>
                {s.description ? <Muted style={{ marginTop: 3 }}>{s.description}</Muted> : null}
                {/* Ряд действий одной высоты: с кнопкой и без неё карточки
                    не должны отличаться на два десятка точек. */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  gap: S.md, marginTop: S.md, minHeight: 44 }}>
                  <Text style={{ ...FONT.small, color: p.text2 }}>{period(s.kind, s.period_days)}</Text>
                  {on ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="check" size={14} color={p.primary} width={2.2} />
                      <Text style={{ ...FONT.small, fontWeight: '600', color: p.primary }}>подключена</Text>
                    </View>
                  ) : (
                    <Pressable disabled={busy}
                      onPress={() => {
                        haptic.tap();
                        setPromo(''); setPromoRes(null); setErr(null);
                        setPick(pick?.id === s.id ? null : { id: s.id, title: s.title });
                      }}>
                      {({ pressed }) => (
                        <View style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
                          backgroundColor: p.primary, opacity: pressed ? 0.85 : 1 }}>
                          <Text style={{ ...FONT.small, fontWeight: '600', color: p.onPrimary }}>
                            {pick?.id === s.id ? 'Свернуть' : 'Подключить'}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                </View>

                {/* Промокод спрашиваем до оплаты, как в вебе: узнать, что
                    код не подошёл, в момент списания денег — худший момент
                    для такой новости. Поля не было вовсе, и скидку в
                    приложении применить было нельзя. */}
                {pick?.id === s.id ? (
                  <Animated.View entering={FadeInDown.duration(200)} style={{ marginTop: S.md }}>
                    <Label>Промокод, если есть</Label>
                    <View style={{ flexDirection: 'row', gap: S.sm, marginTop: 6 }}>
                      <TextInput value={promo} onChangeText={setPromo}
                        placeholder="Например, START20" placeholderTextColor={p.text3}
                        autoCapitalize="characters" maxLength={24}
                        style={{ ...FONT.body, flex: 1, color: p.text, backgroundColor: p.inset,
                          borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 }} />
                      <Pressable onPress={() => checkPromo(s.id)} disabled={!promo.trim()}
                        style={({ pressed }) => ({
                          paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12,
                          backgroundColor: p.inset,
                          opacity: !promo.trim() ? 0.5 : pressed ? 0.7 : 1,
                        })}>
                        <Text style={{ ...FONT.small, fontWeight: '600', color: p.text }}>Проверить</Text>
                      </Pressable>
                    </View>

                    {promoRes ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: S.sm }}>
                        <Icon name={promoRes.ok ? 'check' : 'info'} size={15} width={2}
                          color={promoRes.ok ? p.good : p.danger} />
                        <Text style={{ ...FONT.small, flex: 1,
                          color: promoRes.ok ? p.good : p.danger }}>
                          {promoRes.text}
                        </Text>
                      </View>
                    ) : null}

                    <View style={{ marginTop: S.md }}>
                      <SysButton label="Подключить" variant="prominent"
                        disabled={busy} onPress={() => activate(s.id)} />
                    </View>
                    <Muted style={{ marginTop: S.sm, lineHeight: 18 }}>
                      Специалист увидит ваш выбор. Если приём оплаты подключён,
                      дальше откроется страница оплаты.
                    </Muted>
                  </Animated.View>
                ) : null}
              </Card>
            </Animated.View>
          );
        }) : (
          <Empty icon="tag" title="Цены не указаны"
            note="Специалист пока не заполнил список услуг. Спросите в чате." />
        )}

        {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}
      </ScrollView>
    </View>
  );
}
