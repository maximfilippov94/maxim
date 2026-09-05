import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useApp } from '../store';
import { api, TodayResponse, MealItem, MEAL_ORDER, MEAL_TITLES, MEAL_TIME } from '../api';
import { S, R, FONT } from '../theme';
import { Card, Label, Muted, Bar } from '../ui/base';
import { Icon } from '../ui/Icon';
import { round, kg, todayLabel, plural } from '../format';
import { haptic } from '../haptics';

export default function Today() {
  const { p, me } = useApp();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api<TodayResponse>('/client/today')); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setBusy(true); await load(); setBusy(false);
  }, [load]);

  /* Отметка «съедено» рисуется сразу, запрос уходит следом: ожидание ответа
     на каждое нажатие в списке из восьми блюд ощущается как залипание. */
  const toggle = useCallback(async (item: MealItem) => {
    const eaten = item.log_status === 'eaten';
    haptic.select();
    setData(d => d && ({
      ...d,
      items: d.items.map(x => x.id === item.id
        ? { ...x, log_status: eaten ? 'planned' : 'eaten' } : x),
    }));
    try {
      await api(`/client/meals/${item.id}/log`, {
        method: 'POST', body: { status: eaten ? 'planned' : 'eaten' },
      });
      load();
    } catch {
      haptic.error();
      setData(d => d && ({
        ...d,
        items: d.items.map(x => x.id === item.id ? { ...x, log_status: item.log_status } : x),
      }));
    }
  }, [load]);

  if (!data && !err) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  const u = me?.user;
  const target = u?.target_kcal ?? data?.menu?.target_kcal ?? 1800;
  const eaten = round(data?.totals?.kcal);
  const left = target - eaten;
  const targets = {
    protein: u?.target_protein ?? 110,
    fat: u?.target_fat ?? 60,
    carbs: u?.target_carbs ?? 190,
  };
  const items = data?.items ?? [];
  const doneCount = items.filter(x => x.log_status === 'eaten').length;

  const macros: [string, number, number, string][] = [
    ['Белки', data?.totals?.protein ?? 0, targets.protein, p.mp],
    ['Жиры', data?.totals?.fat ?? 0, targets.fat, p.mf],
    ['Углеводы', data?.totals?.carbs ?? 0, targets.carbs, p.mc],
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + S.lg,
        paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + 100,
      }}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={onRefresh} tintColor={p.text3} />}>

      <Label>{todayLabel()}</Label>
      <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs, marginBottom: S.lg }}>Сегодня</Text>

      {err && (
        <Card style={{ marginBottom: S.md }}>
          <Text style={{ ...FONT.body, color: p.premium }}>{err}</Text>
        </Card>
      )}

      {/* Калории */}
      <Animated.View entering={FadeInDown.duration(280)}>
      <Card style={{ marginBottom: S.md }}>
        <Label>Калории</Label>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end',
          justifyContent: 'space-between', marginTop: S.sm }}>
          <View>
            <Text style={{ ...FONT.num, color: p.text }}>{eaten}</Text>
            <Muted style={{ marginTop: 2 }}>ккал / {target}</Muted>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 21, fontWeight: '700', letterSpacing: -0.5,
              color: left >= 0 ? p.primary : p.premium }}>
              {Math.abs(left)}
            </Text>
            <Muted style={{ marginTop: 2 }}>{left >= 0 ? 'осталось' : 'перебор'}</Muted>
          </View>
        </View>
        <View style={{ marginTop: S.lg }}>
          <Bar value={target ? eaten / target : 0} />
        </View>
      </Card>
      </Animated.View>

      {/* Макросы */}
      <Animated.View entering={FadeInDown.delay(50).duration(280)}>
      <Card style={{ marginBottom: S.md }}>
        <View style={{ flexDirection: 'row', gap: S.lg }}>
          {macros.map(([name, cur, tgt, color]) => (
            <View key={name} style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                <Text style={{ ...FONT.small, color: p.text2 }} numberOfLines={1}>{name}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 5 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: p.text }}>{round(cur)}</Text>
                <Muted style={{ marginLeft: 3 }}>г / {round(tgt)}</Muted>
              </View>
              <View style={{ marginTop: 7 }}>
                <Bar value={tgt ? cur / tgt : 0} color={color} height={3} />
              </View>
            </View>
          ))}
        </View>
      </Card>
      </Animated.View>

      {/* Вес и отмечено */}
      <Animated.View entering={FadeInDown.delay(100).duration(280)}
        style={{ flexDirection: 'row', gap: S.md, marginBottom: S.md }}>
        <Card style={{ flex: 1 }}>
          <Label>Вес</Label>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: p.text }}>
              {data?.weight ? kg(data.weight.last) : '—'}
            </Text>
            {!!data?.weight && <Muted style={{ marginLeft: 3 }}>кг</Muted>}
          </View>
          <Muted style={{ marginTop: 2 }}>
            {data?.weight?.delta
              ? `${data.weight.delta > 0 ? '+' : '−'}${kg(Math.abs(data.weight.delta))} кг за период`
              : 'Записать вес'}
          </Muted>
        </Card>
        <Card style={{ flex: 1 }}>
          <Label>Отмечено</Label>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: p.text }}>{doneCount}</Text>
            <Muted style={{ marginLeft: 3 }}>/ {items.length}</Muted>
          </View>
          <View style={{ marginTop: 9 }}>
            <Bar value={items.length ? doneCount / items.length : 0} height={4} />
          </View>
        </Card>
      </Animated.View>

      {/* Вода — коротко: сколько выпито из нормы. Подробности и силуэт
          на отдельном экране, здесь важен только сам факт. */}
      <Animated.View entering={FadeInDown.delay(140).duration(280)}>
        <Pressable onPress={() => { haptic.tap(); router.push('/water'); }}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, marginBottom: S.md })}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <View style={{ flex: 1 }}>
                <Label>Вода</Label>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: p.text }}>
                    {data?.water?.ml ?? 0}
                  </Text>
                  <Muted style={{ marginLeft: 4 }}>
                    из {data?.water?.goal_ml ?? 2000} мл
                  </Muted>
                </View>
              </View>
              <Icon name="chevr" size={15} color={p.text3} width={2} />
            </View>
            <View style={{ marginTop: 9 }}>
              <Bar
                value={data?.water?.goal_ml ? (data.water.ml / data.water.goal_ml) : 0}
                color={p.mc}
                height={4}
              />
            </View>
          </Card>
        </Pressable>
      </Animated.View>

      {/* Приёмы пищи */}
      {items.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: S.xxl }}>
          <View style={{ width: 52, height: 52, borderRadius: R.lg, backgroundColor: p.primarySoft,
            alignItems: 'center', justifyContent: 'center', marginBottom: S.lg }}>
            <Icon name="bowl" size={24} color={p.primary} />
          </View>
          <Text style={{ ...FONT.h3, color: p.text, textAlign: 'center' }}>
            На сегодня меню не назначено
          </Text>
          <Muted style={{ textAlign: 'center', marginTop: S.sm, lineHeight: 18 }}>
            Как только специалист назначит меню на этот день, блюда появятся здесь.
          </Muted>
        </Card>
      ) : MEAL_ORDER.map((mt, gi) => {
        const group = items.filter(x => x.meal_type === mt);
        if (!group.length) return null;
        const kcal = round(group.reduce((s, x) => s + (x.nutrition?.kcal ?? 0), 0));
        return (
          <Animated.View key={mt}
            entering={FadeInDown.delay(150 + gi * 60).duration(300)}
            layout={LinearTransition.duration(220)}
            style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'baseline', paddingHorizontal: 2, paddingBottom: 8 }}>
              <Text style={{ ...FONT.h3, color: p.text }}>{MEAL_TITLES[mt]}</Text>
              <Muted>{MEAL_TIME[mt]} · {kcal} ккал</Muted>
            </View>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {group.map((x, i) => {
                const done = x.log_status === 'eaten';
                return (
                  <View key={x.id} style={{
                    flexDirection: 'row', alignItems: 'center', gap: S.md,
                    paddingVertical: 9, paddingHorizontal: 12,
                    borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
                  }}>
                    {x.photo_url
                      ? <Image
                          source={{ uri: x.photo_url }}
                          style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: p.inset }}
                          contentFit="cover"
                          transition={220}
                          cachePolicy="memory-disk"
                          placeholder={{ blurhash: 'L6C~2Xxu00WB00WB~qof00WB~qof' }}
                        />
                      : <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: p.inset,
                          alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="bowl" size={18} color={p.text3} />
                        </View>}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{
                        fontSize: 15, fontWeight: '600',
                        color: done ? p.text3 : p.text,
                        textDecorationLine: done ? 'line-through' : 'none',
                      }}>{x.dish_name}</Text>
                      <Muted style={{ marginTop: 3 }}>
                        {round(x.portion_g)} г · {round(x.nutrition?.kcal)} ккал
                      </Muted>
                    </View>
                    <Pressable
                      onPress={() => toggle(x)}
                      hitSlop={10}
                      style={({ pressed }) => ({
                        width: 26, height: 26, borderRadius: 13,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: done ? p.primary : 'transparent',
                        borderWidth: done ? 0 : 1.5, borderColor: p.border,
                        transform: [{ scale: pressed ? 0.9 : 1 }],
                      })}>
                      {done && <Icon name="check" size={13} color={p.onPrimary} width={2.6} />}
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </Animated.View>
        );
      })}
      <Muted style={{ textAlign: 'center', marginTop: S.md }}>
        {items.length > 0 && `${doneCount} ${plural(doneCount, ['приём', 'приёма', 'приёмов'])} из ${items.length} отмечено`}
      </Muted>
    </ScrollView>
  );
}
