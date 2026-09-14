/**
 * Услуги специалиста и подключение.
 *
 * Оплаты пока нет: услуга включается сразу, а специалист видит выбор.
 * Главное на экране — срок подключённой услуги: за ним сюда и заходят,
 * поэтому он стоит отдельной строкой со значком, а не прячется в подпись.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
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

  const load = useCallback(async () => {
    try { setD(await api<ServicesResponse>('/client/services')); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const activate = useCallback((id: number, title: string) => {
    /* Спрашиваем, хотя денег не берём: выбор видит специалист, и
       случайное нажатие будет выглядеть странно для обоих. */
    Alert.alert('Подключить услугу?', `«${title}»\n\nОплата пока не подключена — услуга включится сразу, а специалист увидит ваш выбор.`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Подключить', onPress: async () => {
        setBusy(true);
        try {
          await api(`/client/services/${id}/activate`, { method: 'POST', body: {} });
          haptic.success(); await load();
        } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось подключить'); }
        finally { setBusy(false); }
      } },
    ]);
  }, [load]);

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

        {sub ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <Card style={{ marginBottom: S.md }}>
              {/* Название и цена — в одной строке. Пока цена стояла рядом с
                  колонкой «надзаголовок + название», она выравнивалась по
                  верху блока и висела выше названия, к которому относится. */}
              <Label>Подключено</Label>
              <View style={{ flexDirection: 'row', alignItems: 'baseline',
                justifyContent: 'space-between', gap: S.md, marginTop: 2 }}>
                <Text style={{ ...FONT.h3, color: p.text, flex: 1 }}>{sub.title}</Text>
                <Text style={{ ...FONT.h3, color: p.text }}>{rub(sub.price_kop)}</Text>
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
              <Muted style={{ marginTop: S.sm, lineHeight: 18 }}>
                Оплата пока не подключена: услуга включена по договорённости со специалистом.
              </Muted>
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
                  <Text style={{ ...FONT.h3, color: p.text }}>{rub(s.price_kop)}</Text>
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
                    <Pressable onPress={() => activate(s.id, s.title)} disabled={busy}>
                      {({ pressed }) => (
                        <View style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
                          backgroundColor: p.primary, opacity: pressed ? 0.85 : 1 }}>
                          <Text style={{ ...FONT.small, fontWeight: '600', color: p.onPrimary }}>Подключить</Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                </View>
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
