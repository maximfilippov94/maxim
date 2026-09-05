import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, ShoppingResponse, ShoppingItem } from '../api';
import { S, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { ListGroup, ListHead } from '../ui/List';
import { Icon } from '../ui/Icon';
import { Bar } from '../ui/base';
import { plural } from '../format';
import { haptic } from '../haptics';

export default function Shopping() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<ShoppingResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api<ShoppingResponse>('/client/shopping')); }
    catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Отметка ставится сразу, а запрос идёт следом: если сервер откажет —
     возвращаем как было. Ждать сеть ради галочки незачем. */
  const toggle = useCallback(async (it: ShoppingItem) => {
    const next = it.checked ? 0 : 1;
    setData(d => d && { ...d, items: d.items.map(x => x.key === it.key ? { ...x, checked: next } : x) });
    haptic.select();
    try {
      await api('/client/shopping/check', {
        method: 'POST', body: { name: it.key, checked: !!next },
      });
    } catch {
      haptic.error();
      setData(d => d && { ...d, items: d.items.map(x => x.key === it.key ? { ...x, checked: it.checked } : x) });
    }
  }, []);

  const clear = useCallback(async () => {
    const before = data?.items ?? [];
    setData(d => d && { ...d, items: d.items.map(x => ({ ...x, checked: 0 })) });
    haptic.warn();
    try { await api('/client/shopping/clear', { method: 'POST' }); }
    catch { setData(d => d && { ...d, items: before }); }
  }, [data]);

  if (err) return <Fail title="Список покупок" text={err} />;
  if (!data) return <Loading title="Список покупок" />;

  const done = data.items.filter(i => i.checked).length;
  const total = data.items.length;

  /* Группируем по категории — так список читается по отделам магазина */
  const cats: Record<string, ShoppingItem[]> = {};
  for (const it of data.items) (cats[it.category || 'Прочее'] ??= []).push(it);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Список покупок" back />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.duration(240)}>
          <ListGroup style={{ marginTop: 8 }}>
            <View style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, color: p.text }}>
                  {done} из {total} куплено
                </Text>
                <Pressable onPress={clear} hitSlop={10}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                  <Text style={{ ...FONT.small, color: p.text3 }}>Сбросить</Text>
                </Pressable>
              </View>
              <View style={{ marginTop: 10 }}>
                <Bar value={total ? done / total : 0} />
              </View>
              <Text style={{ ...FONT.small, color: p.text3, marginTop: 8 }}>
                {data.days} {plural(data.days, ['день', 'дня', 'дней'])} меню
              </Text>
            </View>
          </ListGroup>
        </Animated.View>

        {Object.entries(cats).map(([cat, items], gi) => (
          <Animated.View key={cat} entering={FadeInDown.delay(40 + gi * 40).duration(240)}
            layout={LinearTransition.duration(220)}>
            <ListHead>{cat}</ListHead>
            <ListGroup>
              {items.map((it, i) => (
                <Pressable key={it.key} onPress={() => toggle(it)}>
                  {({ pressed }) => (
                    <View>
                      {i ? <View style={{ height: 0.5, backgroundColor: p.border, marginLeft: 18 }} /> : null}
                      <View style={{
                        height: 48, flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 18, gap: 14,
                        backgroundColor: pressed ? p.ov1 : 'transparent',
                      }}>
                        <View style={{
                          width: 22, height: 22, borderRadius: 11,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: it.checked ? p.primary : 'transparent',
                          borderWidth: it.checked ? 0 : 1.5, borderColor: p.track,
                        }}>
                          {it.checked ? <Icon name="check" size={13} color={p.onPrimary} width={2.6} /> : null}
                        </View>
                        <Text numberOfLines={1} style={{
                          flex: 1, fontSize: 16,
                          color: it.checked ? p.text3 : p.text,
                          textDecorationLine: it.checked ? 'line-through' : 'none',
                        }}>{it.name}</Text>
                        <Text style={{ ...FONT.small, color: p.text3 }}>{it.grams} г</Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              ))}
            </ListGroup>
          </Animated.View>
        ))}

        {!total ? (
          <Text style={{ ...FONT.body, color: p.text3, textAlign: 'center', marginTop: 40 }}>
            Список появится, когда специалист опубликует меню
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

export function Loading({ title }: { title: string }) {
  const { p } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={title} back />
      <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />
    </View>
  );
}

export function Fail({ title, text }: { title: string; text: string }) {
  const { p } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={title} back />
      <Text style={{ ...FONT.body, color: p.text3, textAlign: 'center', marginTop: 40, paddingHorizontal: S.xl }}>
        {text}
      </Text>
    </View>
  );
}
