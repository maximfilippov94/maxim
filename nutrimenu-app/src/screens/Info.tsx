/**
 * EQUA info — о сервисе и о том, что в нём нового.
 *
 * Не лента и не рассылка: лента про клиентов и их успехи, рассылка
 * уходит разово. Здесь то, что лежит на месте и читается когда угодно.
 * Текст длинный, поэтому строка короче обычного, а между абзацами
 * воздух — это читают, а не проглядывают.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, InfoResponse, InfoPost } from '../api';
import { S, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Empty } from '../ui/system';
import { dmy } from '../format';
import { Loading, Fail } from './Shopping';

function Post({ item, dated }: { item: InfoPost; dated: boolean }) {
  const { p } = useApp();
  return (
    <Card style={{ marginBottom: S.sm }}>
      <Text style={{ ...FONT.h3, color: p.text, marginBottom: 6 }}>{item.title}</Text>
      {item.body.split(/\n{2,}/).map((para, i) => (
        <Text key={i} style={{ ...FONT.body, color: p.text2, lineHeight: 21,
          marginTop: i ? 10 : 0 }}>{para}</Text>
      ))}
      {dated ? <Muted style={{ marginTop: 8 }}>{dmy(String(item.created_at).slice(0, 10))}</Muted> : null}
    </Card>
  );
}

export default function Info() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<InfoResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setD(await api<InfoResponse>('/info')); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (err && !d) return <Fail title="EQUA info" text={err} />;
  if (!d) return <Loading title="EQUA info" />;

  const empty = !d.about.length && !d.updates.length;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="EQUA info" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}>
        {empty ? (
          <Empty icon="sparkles" title="Пока пусто"
            note="Здесь будет рассказ о сервисе и о том, что в нём нового." />
        ) : null}

        {d.about.length ? (
          <>
            <Label>О сервисе</Label>
            <View style={{ marginTop: S.sm }}>
              {d.about.map((x, i) => (
                <Animated.View key={x.id} entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(220)}>
                  <Post item={x} dated={false} />
                </Animated.View>
              ))}
            </View>
          </>
        ) : null}

        {d.updates.length ? (
          <View style={{ marginTop: d.about.length ? S.lg : 0 }}>
            <Label>Что нового</Label>
            <View style={{ marginTop: S.sm }}>
              {d.updates.map((x, i) => (
                <Animated.View key={x.id} entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(220)}>
                  <Post item={x} dated />
                </Animated.View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
