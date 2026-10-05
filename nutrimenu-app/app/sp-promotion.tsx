/**
 * Продвижение карточки в каталоге.
 *
 * Поднятая карточка показывается выше остальных, и единственный честный
 * способ понять, стоило ли оно денег, — показы и переходы. Поэтому они
 * стоят в том же экране, что и покупка, а история прошлых подъёмов —
 * сразу под ней: по ней видно, что дал прошлый раз.
 *
 * Оплату приложение не проводит. Пока платежи выключены, подъём
 * оформляется сразу; при живом эквайере экран говорит, что оформить
 * нужно на сайте, и не ведёт на платёжную страницу.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../src/store';
import { api, PromotionState } from '../src/api';
import { S, FONT } from '../src/theme';
import { NavBar } from '../src/ui/NavBar';
import { Card, Label, Muted } from '../src/ui/base';
import { ListGroup, ListHead, ListRow } from '../src/ui/List';
import { SysButton, Empty } from '../src/ui/system';
import { useToast } from '../src/ui/Toast';
import { rub, plural } from '../src/format';
import { haptic } from '../src/haptics';

const dmy = (v?: string | null) => {
  if (!v) return '—';
  const x = String(v).slice(0, 10).split('-');
  return x.length === 3 ? `${x[2]}.${x[1]}.${x[0]}` : String(v);
};

export default function SpPromotion() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [d, setD] = useState<PromotionState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<PromotionState>('/specialist/promotion')
      .then(r => { setD(r); setErr(null); })
      .catch(e => setErr(e?.message ?? 'Не открылось'));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const buy = useCallback(async (days: number) => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ confirmation_url?: string }>('/specialist/promotion',
        { method: 'POST', body: { days } });
      if (r.confirmation_url) {
        toast('Оплату нужно пройти на сайте', { sub: 'nutrimenu.ru · продвижение', ms: 6000 });
      } else {
        haptic.success(); toast('Карточка поднята');
      }
      load();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не получилось');
    } finally { setBusy(false); }
  }, [load, toast]);

  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back title="Продвижение" />
        {err ? <Muted style={{ padding: S.lg }}>{err}</Muted>
          : <ActivityIndicator color={p.accent} style={{ marginTop: 40 }} />}
      </View>
    );
  }

  const cur = d.current;
  const free = d.payments_mode === 'off';
  const ctr = cur && cur.impressions
    ? Math.round(cur.clicks / cur.impressions * 100) : null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title="Продвижение" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, paddingHorizontal: S.lg, paddingTop: S.sm }}>
            {err}
          </Text>
        ) : null}

        <View style={{ paddingHorizontal: S.lg, paddingTop: S.md }}>
          {cur ? (
            <Animated.View entering={FadeInDown.duration(220)}>
              <Card>
                <Label>Карточка поднята</Label>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                  <Text style={{ ...FONT.num, color: p.text }}>{cur.days_left}</Text>
                  <Text style={{ ...FONT.body, color: p.text3 }}>
                    {plural(cur.days_left, ['день', 'дня', 'дней'])} до {dmy(cur.expires_at)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.lg }}>
                  <Tile label="Показов" value={String(cur.impressions)} note="в каталоге" />
                  <Tile label="Открыли" value={String(cur.clicks)}
                    note={ctr != null ? `${ctr}% из показов` : 'пока нет'} />
                </View>
              </Card>
            </Animated.View>
          ) : (
            <Card>
              <Label>Как это работает</Label>
              <Text style={{ ...FONT.body, color: p.text2, marginTop: 6, lineHeight: 20 }}>
                Поднятая карточка стоит выше остальных в каталоге. Видно будет
                по двум числам: сколько раз её показали и сколько раз открыли.
              </Text>
            </Card>
          )}
        </View>

        <ListHead>{cur ? 'Продлить' : 'Поднять карточку'}</ListHead>
        <View style={{ paddingHorizontal: S.lg, gap: S.sm }}>
          {!d.tariffs?.length ? (
            <Muted>Тарифы сейчас недоступны.</Muted>
          ) : d.tariffs.map(t => (
            <SysButton key={t.days} disabled={busy}
              label={`${t.days} ${plural(t.days, ['день', 'дня', 'дней'])} · ${free ? 'бесплатно' : rub(t.price_kop)}`}
              onPress={() => { haptic.tap(); buy(t.days); }} />
          ))}
        </View>
        {free ? (
          <View style={{ paddingHorizontal: S.lg, paddingTop: S.sm }}>
            <Muted>Платежи ещё не подключены — подъём оформляется без оплаты.</Muted>
          </View>
        ) : null}

        {d.history?.length ? (
          <>
            <ListHead>Прошлые подъёмы</ListHead>
            <ListGroup>
              {d.history.map((h, i) => (
                <ListRow key={h.id} first={i === 0}
                  label={`${dmy(h.started_at ?? h.paid_at)} · ${h.days} ${plural(h.days, ['день', 'дня', 'дней'])}`}
                  value={`${h.impressions} / ${h.clicks}`} />
              ))}
            </ListGroup>
            <View style={{ paddingHorizontal: S.lg, paddingTop: S.sm }}>
              <Muted>Справа — показы и открытия карточки.</Muted>
            </View>
          </>
        ) : null}

        {!cur && !d.tariffs?.length ? (
          <Empty icon="trend" title="Продвижение недоступно"
            note="Сначала опубликуйте карточку в каталоге — поднимать нечего." />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  const { p } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...FONT.caption, color: p.text3 }}>{label}</Text>
      <Text style={{ ...FONT.h2, color: p.text, marginTop: 2 }}>{value}</Text>
      <Text style={{ ...FONT.small, color: p.text3, marginTop: 1 }} numberOfLines={1}>{note}</Text>
    </View>
  );
}
