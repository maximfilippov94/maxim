import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, ServicesResponse } from '../api';
import { FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { ListGroup, ListHead } from '../ui/List';
import { rub, plural } from '../format';
import { Loading, Fail } from './Shopping';

const period = (kind: string, days?: number | null) => {
  if (kind === 'subscription' && days) return `за ${days} ${plural(days, ['день', 'дня', 'дней'])}`;
  if (kind === 'consultation') return 'разовая консультация';
  return '';
};

export default function Services() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<ServicesResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<ServicesResponse>('/client/services').then(setD).catch(e => setErr(e.message));
  }, []);

  if (err) return <Fail title="Услуги и цены" text={err} />;
  if (!d) return <Loading title="Услуги и цены" />;

  const list = (d.services ?? []).filter(s => s.is_active);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Услуги и цены" back />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}>

        {d.specialist ? <ListHead>{d.specialist.name}</ListHead> : null}

        {list.length ? (
          <ListGroup>
            {list.map((s, i) => (
              <Animated.View key={s.id} entering={FadeInDown.delay(i * 40).duration(240)}>
                {i ? <View style={{ height: 0.5, backgroundColor: p.border }} /> : null}
                <View style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                    <Text style={{ fontSize: 16, color: p.text, flex: 1 }}>{s.title}</Text>
                    <Text style={{ ...FONT.h3, color: p.text }}>{rub(s.price_kop)}</Text>
                  </View>
                  {s.description ? (
                    <Text style={{ ...FONT.small, color: p.text3, marginTop: 3 }}>{s.description}</Text>
                  ) : null}
                  {period(s.kind, s.period_days) ? (
                    <Text style={{ ...FONT.small, color: p.text3, marginTop: 3 }}>
                      {period(s.kind, s.period_days)}
                    </Text>
                  ) : null}
                </View>
              </Animated.View>
            ))}
          </ListGroup>
        ) : (
          <Text style={{ ...FONT.body, color: p.text3, textAlign: 'center', marginTop: 40 }}>
            Специалист пока не опубликовал цены
          </Text>
        )}

        {/* Оплата внутри приложения не подключена — говорим об этом прямо,
            вместо кнопки, которая никуда не ведёт. */}
        {d.note ? (
          <Text style={{ ...FONT.small, color: p.text3, paddingHorizontal: 18, marginTop: 16, lineHeight: 18 }}>
            {d.note}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
