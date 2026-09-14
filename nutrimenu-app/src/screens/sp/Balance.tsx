/**
 * Баланс специалиста: заморожено и доступно.
 *
 * Денег на счету платформы нет — они остаются у платёжного сервиса, а
 * здесь их учёт. Поэтому экран ничего не кэширует: каждый заход
 * пересчитывает баланс движениями, и два числа наверху — это сумма
 * выписки под ними, а не отдельно хранимое состояние.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api, BalanceResponse, BalanceEntry, Subscription, PayoutDetails } from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Label, Muted, Pills } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { SysButton, Empty } from '../../ui/system';
import { rub, plural, ago, dmy } from '../../format';
import { haptic } from '../../haptics';
import { Loading, Fail } from '../Shopping';

/* Как называется движение и каким значком помечено — те же пары, что в
   вебе: один и тот же баланс не должен выглядеть на двух платформах
   как два разных. */
const KIND: Record<BalanceEntry['kind'], [string, string]> = {
  hold:        ['lock',  'Заморожено'],
  release:     ['check', 'Разморожено'],
  refund:      ['back',  'Возврат клиенту'],
  payout:      ['coin',  'Заявка на вывод'],
  payout_back: ['coin',  'Заявка отклонена'],
};
/* У движения два столбца со знаком, но меняется всегда один. */
const sumOf = (e: BalanceEntry) => e.avail_kop || e.held_kop;

const LEGAL: Record<string, string> = {
  self_employed: 'Самозанятый', ip: 'ИП', individual: 'Физлицо',
};

export default function SpBalance() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<BalanceResponse | null>(null);
  const [sales, setSales] = useState<Subscription[] | null>(null);
  const [tab, setTab] = useState<'moves' | 'sales'>('moves');
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<'none' | 'details' | 'payout'>('none');

  const load = useCallback(async () => {
    try { setD(await api<BalanceResponse>('/specialist/balance')); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Продажи грузим только когда на них смотрят: на экране баланса они
     нужны не всем и не всегда. */
  useEffect(() => {
    if (tab !== 'sales' || sales) return;
    api<{ sales: Subscription[] }>('/specialist/sales')
      .then(r => setSales(r.sales ?? []))
      .catch(() => setSales([]));
  }, [tab, sales]);

  const markDone = useCallback((s: Subscription) => {
    const days = d?.balance?.accept_days ?? 7;
    Alert.alert(`Отметить «${s.title}» выполненной?`,
      `Клиент подтвердит или напишет, что не так. Если промолчит ${days} ${plural(days, ['день', 'дня', 'дней'])} — деньги разморозятся сами.`,
      [{ text: 'Отмена', style: 'cancel' },
       { text: 'Выполнено', onPress: async () => {
          try {
            await api(`/specialist/sales/${s.id}/done`, { method: 'POST', body: {} });
            haptic.success(); setSales(null); await load();
          } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось отметить'); }
        } }]);
  }, [d, load]);

  if (err && !d) return <Fail title="Баланс" text={err} />;
  if (!d) return <Loading title="Баланс" />;

  const b = d.balance;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Баланс" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}>

        <ModeNote mode={b.payments_mode} />

        {/* Два числа рядом — это одно сравнение, а не два показателя */}
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
          <Card style={{ flex: 1 }}>
            <Label>Доступно</Label>
            <Text style={{ ...FONT.h1, color: p.accent, marginTop: 2 }}>{rub(b.available_kop)}</Text>
            <Muted style={{ marginTop: 2 }}>{b.can_payout ? 'можно вывести' : 'к выводу'}</Muted>
          </Card>
          <Card style={{ flex: 1, backgroundColor: p.inset }}>
            <Label>Заморожено</Label>
            <Text style={{ ...FONT.h1, color: p.text2, marginTop: 2 }}>{rub(b.held_kop)}</Text>
            <Muted style={{ marginTop: 2 }}>до выполнения работы</Muted>
          </Card>
        </View>

        {b.pending_kop ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: S.md }}>
            <Icon name="clock" size={16} color={p.text3} width={1.8} />
            <Muted>В заявке на вывод — {rub(b.pending_kop)}</Muted>
          </View>
        ) : null}

        <SysButton label="Вывести деньги" variant="prominent" icon="coin" disabled={!b.can_payout}
          onPress={() => { haptic.tap(); setForm(d.details ? 'payout' : 'details'); }} />

        {form === 'details' ? (
          <DetailsForm current={d.details} onDone={() => { setForm('none'); load(); }}
            onCancel={() => setForm('none')} />
        ) : null}
        {form === 'payout' && d.details ? (
          <PayoutForm details={d.details} balance={b}
            onDone={() => { setForm('none'); load(); }} onCancel={() => setForm('none')}
            onEdit={() => setForm('details')} />
        ) : null}

        {d.payouts.length ? (
          <View style={{ marginTop: S.lg }}>
            <Label>Заявки</Label>
            {d.payouts.map(x => (
              <Card key={x.id} style={{ marginTop: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...FONT.h3, color: p.text }}>{rub(x.amount_kop)}</Text>
                  <Muted style={{ marginTop: 2 }}>
                    {dmy(String(x.created_at).slice(0, 10))} · {
                      x.status === 'paid' ? 'отправлено' : x.status === 'rejected' ? 'отказ' : 'в работе'}
                  </Muted>
                  {x.note ? <Muted style={{ marginTop: 2 }}>{x.note}</Muted> : null}
                </View>
                <Icon name={x.status === 'paid' ? 'check' : x.status === 'rejected' ? 'close' : 'clock'}
                  size={18} width={1.8}
                  color={x.status === 'paid' ? p.accent : x.status === 'rejected' ? p.warn : p.text3} />
              </Card>
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: S.lg, marginBottom: S.md }}>
          {/* Pills сам даёт отклик на нажатие — своего haptic здесь не нужно */}
          <Pills<'moves' | 'sales'>
            items={[['moves', 'Движения'], ['sales', 'Продажи']]}
            value={tab} onChange={setTab} />
        </View>

        {tab === 'moves' ? (
          d.entries.length ? d.entries.map((e, i) => (
            <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(i, 8) * 30).duration(220)}>
              <EntryRow e={e} />
            </Animated.View>
          )) : (
            <Empty icon="rublesign.circle" title="Движений пока нет"
              note="Первая запись появится, когда клиент оплатит вашу услугу." />
          )
        ) : sales === null ? (
          <Muted style={{ textAlign: 'center', paddingVertical: S.xl }}>Загружаем…</Muted>
        ) : sales.length ? (
          sales.map(s => <SaleRow key={s.id} s={s} onDone={() => markDone(s)} />)
        ) : (
          <Empty icon="gift" title="Покупок пока нет"
            note="Здесь будут оплаченные услуги и то, что по ним нужно сделать." />
        )}

        <Muted style={{ marginTop: S.lg, lineHeight: 18 }}>
          Суммы указаны за вычетом комиссии платформы. Деньги клиентов лежат у платёжного
          сервиса, а не у нас: здесь их учёт. Разовая услуга размораживается после вашей
          отметки и подтверждения клиента, подписка — по дням, пока идёт период.
        </Muted>

        {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}
      </ScrollView>
    </View>
  );
}

/** Плашка режима. В рабочем режиме её нет — тогда и говорить не о чем. */
function ModeNote({ mode }: { mode: 'off' | 'demo' | 'live' }) {
  const { p } = useApp();
  if (mode === 'live') return null;
  const warn = mode === 'demo';
  return (
    <View style={{ flexDirection: 'row', gap: S.md, alignItems: 'flex-start', padding: S.md,
      borderRadius: R.lg, backgroundColor: p.inset, marginBottom: S.md }}>
      <Icon name={warn ? 'shield' : 'tag'} size={20} color={warn ? p.warn : p.text3} width={1.8} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...FONT.body, fontWeight: '600', color: p.text }}>
          {warn ? 'Проверочный режим' : 'Приём платежей ещё не подключён'}
        </Text>
        <Muted style={{ marginTop: 2, lineHeight: 18 }}>
          {warn
            ? 'Суммы учебные: они показывают, как работает заморозка, но вывести их нельзя.'
            : 'Здесь будут деньги за ваши услуги: заморожены, пока работа не выполнена, потом доступны к выводу.'}
        </Muted>
      </View>
    </View>
  );
}

/** Строка выписки: сверху за что деньги, снизу что с ними произошло. */
function EntryRow({ e }: { e: BalanceEntry }) {
  const { p } = useApp();
  const [ic, label] = KIND[e.kind] ?? ['coin', 'Движение'];
  const v = sumOf(e);
  /* Зелёным — только то, что прибавилось к доступным деньгам. Заморозка
     тоже приход, но распоряжаться им ещё нельзя. */
  const grew = e.avail_kop > 0;
  return (
    <Card style={{ marginBottom: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
        backgroundColor: grew ? p.primarySoft : p.inset }}>
        <Icon name={ic} size={17} color={grew ? p.accent : p.text2} width={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...FONT.body, fontWeight: '600', color: p.text }} numberOfLines={2}>
          {e.sub_title || e.note || label}
        </Text>
        <Muted style={{ marginTop: 2 }} numberOfLines={2}>
          {(e.sub_title ? (e.note || label) : label)
            + (e.client_name ? ` · ${e.client_name}` : '')
            + ` · ${ago(e.occurred_at)}`}
        </Muted>
      </View>
      <Text style={{ ...FONT.h3, color: grew ? p.accent : p.text3, fontVariant: ['tabular-nums'] }}>
        {v > 0 ? '+' : '−'}{rub(Math.abs(v))}
      </Text>
    </Card>
  );
}

/** Строка продажи: что дальше — зависит от того, где она сейчас. */
function SaleRow({ s, onDone }: { s: Subscription; onDone: () => void }) {
  const { p } = useApp();
  let state = '';
  let act = false;
  if (s.status === 'refunded') state = 'деньги вернулись клиенту';
  else if (s.disputed_at) state = 'клиент не принял работу';
  else if (s.kind === 'subscription') {
    state = s.days_left != null
      ? (s.days_left <= 0 ? 'заканчивается сегодня'
        : `осталось ${s.days_left} ${plural(s.days_left, ['день', 'дня', 'дней'])}`)
      : 'подписка';
  } else if (!s.done_at) { state = 'ждёт вашей отметки о выполнении'; act = true; }
  else if (!s.accepted_at) {
    state = s.accept_days_left != null
      ? `ждём клиента · ${s.accept_days_left} ${plural(s.accept_days_left, ['день', 'дня', 'дней'])}`
      : 'ждём подтверждения клиента';
  } else state = s.accepted_by === 'auto' ? 'принято без возражений' : 'принято клиентом';

  return (
    <Card style={{ marginBottom: S.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.md }}>
        <Text style={{ ...FONT.h3, color: p.text, flex: 1 }} numberOfLines={2}>{s.title}</Text>
        <Text style={{ ...FONT.h3, color: p.text }}>{rub(s.payout_kop ?? s.price_kop)}</Text>
      </View>
      <Muted style={{ marginTop: 3 }}>
        {(s.client_name ? `${s.client_name} · ` : '') + state}
      </Muted>
      {s.dispute_note ? (
        <Text style={{ ...FONT.small, color: p.warn, marginTop: 4 }}>{s.dispute_note}</Text>
      ) : null}
      {act ? (
        <View style={{ marginTop: S.md }}>
          <SysButton label="Выполнено" variant="prominent" icon="check" height={44} onPress={onDone} />
        </View>
      ) : null}
    </Card>
  );
}

/** Реквизиты и согласие с договором. Спрашиваем один раз. */
function DetailsForm({ current, onDone, onCancel }: {
  current: PayoutDetails | null; onDone: () => void; onCancel: () => void;
}) {
  const { p } = useApp();
  const [legal, setLegal] = useState<string>(current?.legal_type ?? 'self_employed');
  const [name, setName] = useState(current?.full_name ?? '');
  const [inn, setInn] = useState(current?.inn ?? '');
  const [acc, setAcc] = useState('');
  const [bank, setBank] = useState(current?.bank ?? '');
  const [agree, setAgree] = useState(!!current?.agreement_accepted_at);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const field = {
    ...FONT.body, color: p.text, backgroundColor: p.inset,
    borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, marginTop: 6,
  };

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api('/specialist/payout-details', { method: 'POST', body: {
        legal_type: legal, full_name: name.trim(), inn: inn.trim(),
        account: acc.replace(/\s+/g, ''), bank: bank.trim(), agreement: agree ? 1 : 0,
      } });
      haptic.success(); onDone();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось сохранить'); }
    finally { setBusy(false); }
  };

  return (
    <Animated.View entering={FadeInDown.duration(220)}>
      <Card style={{ marginTop: S.md }}>
        <Text style={{ ...FONT.h3, color: p.text, marginBottom: S.md }}>Реквизиты для вывода</Text>

        <Label>Кто получает</Label>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          {Object.entries(LEGAL).map(([k, l]) => {
            const on = k === legal;
            return (
              <Pressable key={k} onPress={() => { haptic.select(); setLegal(k); }}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 9, borderRadius: R.md, alignItems: 'center',
                  backgroundColor: on ? p.primary : p.inset, opacity: pressed && !on ? 0.7 : 1,
                })}>
                <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
                  color: on ? p.onPrimary : p.text2 }}>{l}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: S.md }}>
          <Label>Фамилия, имя и отчество</Label>
          <TextInput value={name} onChangeText={setName} placeholder="Иванова Мария Сергеевна"
            placeholderTextColor={p.text3} style={field} />
        </View>

        {/* Физлицу ИНН не нужен, и просить его незачем */}
        {legal !== 'individual' ? (
          <View style={{ marginTop: S.md }}>
            <Label>ИНН</Label>
            <TextInput value={inn ?? ''} onChangeText={setInn} keyboardType="number-pad"
              maxLength={12} placeholder="123456789012" placeholderTextColor={p.text3} style={field} />
          </View>
        ) : null}

        <View style={{ marginTop: S.md }}>
          <Label>Номер карты или счёта</Label>
          <TextInput value={acc} onChangeText={setAcc} keyboardType="number-pad"
            placeholder="2202 2002 0000 0000" placeholderTextColor={p.text3} style={field} />
        </View>

        <View style={{ marginTop: S.md }}>
          <Label>Банк</Label>
          <TextInput value={bank ?? ''} onChangeText={setBank} placeholder="не обязательно"
            placeholderTextColor={p.text3} style={field} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginTop: S.lg }}>
          <Switch value={agree} onValueChange={setAgree}
            trackColor={{ true: p.primary, false: p.track }} />
          <Text style={{ ...FONT.body, color: p.text, flex: 1 }}>Согласен с агентским договором</Text>
        </View>
        <Muted style={{ marginTop: S.sm, lineHeight: 18 }}>
          Платформа принимает оплату от клиентов как ваш агент и перечисляет вам деньги за
          вычетом комиссии. Налоги со своего дохода вы платите сами.
        </Muted>

        {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}

        <View style={{ marginTop: S.lg, gap: S.sm }}>
          <SysButton label="Сохранить" variant="prominent" disabled={busy} onPress={save} />
          <SysButton label="Отмена" variant="quiet" onPress={onCancel} />
        </View>
      </Card>
    </Animated.View>
  );
}

/** Сумма вывода. Реквизиты уже есть — показываем, куда уйдут деньги. */
function PayoutForm({ details, balance, onDone, onCancel, onEdit }: {
  details: PayoutDetails;
  balance: { available_kop: number; payout_min_kop: number };
  onDone: () => void; onCancel: () => void; onEdit: () => void;
}) {
  const { p } = useApp();
  const [amount, setAmount] = useState(String(Math.round(balance.available_kop / 100)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setBusy(true); setErr(null);
    try {
      await api('/specialist/payout', { method: 'POST', body: { amount: amount.replace(',', '.') } });
      haptic.success(); onDone();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось отправить'); }
    finally { setBusy(false); }
  };

  return (
    <Animated.View entering={FadeInDown.duration(220)}>
      <Card style={{ marginTop: S.md }}>
        <Text style={{ ...FONT.h3, color: p.text }}>Вывод денег</Text>
        <Muted style={{ marginTop: 4 }}>
          Доступно {rub(balance.available_kop)}. Минимальная сумма — {Math.round(balance.payout_min_kop / 100)} ₽.
        </Muted>

        <View style={{ marginTop: S.md }}>
          <Label>Сумма, ₽</Label>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad"
            style={{ ...FONT.body, color: p.text, backgroundColor: p.inset, borderRadius: R.md,
              paddingHorizontal: 14, paddingVertical: 12, marginTop: 6 }} />
        </View>

        <Pressable onPress={onEdit}
          style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginTop: S.md,
            padding: S.md, borderRadius: R.md, backgroundColor: p.inset }}>
          <Icon name="shield" size={20} color={p.text3} width={1.8} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...FONT.body, fontWeight: '600', color: p.text }}>{details.full_name}</Text>
            <Muted style={{ marginTop: 2 }}>
              {LEGAL[details.legal_type] ?? details.legal_type} · счёт ···{details.account_tail}
            </Muted>
          </View>
          <Icon name="chevr" size={16} color={p.text3} width={1.8} />
        </Pressable>

        {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}

        <View style={{ marginTop: S.lg, gap: S.sm }}>
          <SysButton label="Отправить заявку" variant="prominent" icon="coin" disabled={busy} onPress={send} />
          <SysButton label="Отмена" variant="quiet" onPress={onCancel} />
        </View>
        <Muted style={{ marginTop: S.md, lineHeight: 18 }}>
          Перевод идёт в рамках агентского договора. Обычно занимает до трёх рабочих дней.
        </Muted>
      </Card>
    </Animated.View>
  );
}
