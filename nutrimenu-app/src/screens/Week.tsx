import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, WeekResponse, MEAL_ORDER, MEAL_TITLES } from '../api';
import { S, R, FONT } from '../theme';
import { Card, Label, Muted, Bar } from '../ui/base';
import { Icon } from '../ui/Icon';
import { Empty } from '../ui/system';
import { round, plural, menuDate, dayTitle, dowShort, isToday } from '../format';
import { haptic } from '../haptics';
import { router } from 'expo-router';
import { Loading, Fail } from './Shopping';

export default function Week() {
  const { p, me } = useApp();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<WeekResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState(1);

  useEffect(() => {
    api<WeekResponse>('/client/week').then(r => {
      setD(r);
      if (r.menu) {
        /* Открываем на сегодняшнем дне меню, а не на первом: чаще всего
           смотрят именно его, а листать назад можно и руками. */
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const start = new Date(r.menu.start_date + 'T00:00:00');
        const n = Math.floor((+today - +start) / 86400000) + 1;
        setDay(Math.max(1, Math.min(r.menu.days_count, n)));
      }
    }).catch(e => setErr(e.message));
  }, []);

  const pick = useCallback((n: number) => { haptic.select(); setDay(n); }, []);

  if (err) return <Fail title="Неделя" text={err} />;
  if (!d) return <Loading title="Неделя" />;

  const menu = d.menu;
  const items = (d.items ?? []).filter(i => i.day_number === day);
  const tot = d.days?.[String(day)];
  const target = me?.user?.target_kcal ?? 1800;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + S.lg, paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + 150,
      }}
      showsVerticalScrollIndicator={false}>

      <Label>{menu ? menu.title : 'Меню'}</Label>
      <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs, marginBottom: S.lg }}>Неделя</Text>

      {!menu ? (
        <Empty icon="calendar" title="Меню ещё не назначено"
          note="Как только специалист опубликует меню, дни появятся здесь." />
      ) : (
        <>
          {/* Полоса дней: день недели сверху, число снизу */}
          <Animated.View entering={FadeInDown.duration(240)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: S.sm, paddingBottom: S.md }}>
              {Array.from({ length: menu.days_count }, (_, i) => i + 1).map(n => {
                const dt = menuDate(menu.start_date, n)!;
                const on = n === day;
                const now = isToday(dt);
                return (
                  <Pressable key={n} onPress={() => pick(n)}
                    style={({ pressed }) => ({
                      width: 46, paddingVertical: 9, borderRadius: R.md,
                      alignItems: 'center',
                      backgroundColor: on ? p.primary : p.surface,
                      /* Сегодня обведено: в полосе из семи чисел иначе
                         непонятно, где ты находишься. */
                      borderWidth: now && !on ? 1.5 : 0,
                      borderColor: p.primary,
                      opacity: pressed && !on ? 0.7 : 1,
                    })}>
                    <Text style={{ ...FONT.small,
                      color: on ? p.onPrimary : now ? p.primary : p.text3 }}>
                      {dowShort(dt)}
                    </Text>
                    <Text style={{ fontSize: 17, fontWeight: '700', marginTop: 1,
                      color: on ? p.onPrimary : p.text }}>
                      {dt.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm,
            marginTop: S.xs, marginBottom: S.md }}>
            <Text style={{ ...FONT.h3, color: p.text }}>
              {dayTitle(menu.start_date, day, true)}
            </Text>
            {isToday(menuDate(menu.start_date, day)) ? <Muted>сегодня</Muted> : null}
          </View>

          {tot ? (
            <Animated.View entering={FadeInDown.delay(40).duration(240)}>
              <Card style={{ marginBottom: S.md }}>
                <Label>Калории</Label>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
                  <Text style={{ ...FONT.num, color: p.text }}>{round(tot.kcal)}</Text>
                  {/* Шкала считается от личной нормы: полоса «на весь день»
                      без числа, к которому её сравнить, ничего не значит. */}
                  <Muted style={{ marginLeft: 6 }}>ккал / {target}</Muted>
                </View>
                <View style={{ marginTop: 10 }}><Bar value={target ? tot.kcal / target : 0} /></View>
                <Muted style={{ marginTop: S.md }}>
                  Б {round(tot.protein)} · Ж {round(tot.fat)} · У {round(tot.carbs)} г
                </Muted>
              </Card>
            </Animated.View>
          ) : null}

          {items.length === 0 ? (
            <Empty icon="fork.knife" title="На этот день блюд нет"
              note="Специалист ещё не заполнил день." />
          ) : (
            MEAL_ORDER.map(type => {
              const group = items.filter(i => i.meal_type === type);
              if (!group.length) return null;
              const kcal = group.reduce((a, i) => a + (i.nutrition?.kcal ?? 0), 0);
              return (
                <Animated.View key={type} layout={LinearTransition.duration(220)}
                  entering={FadeInDown.duration(220)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between',
                    alignItems: 'baseline', marginTop: S.md, marginBottom: S.sm }}>
                    <Text style={{ ...FONT.h3, color: p.text }}>{MEAL_TITLES[type]}</Text>
                    <Muted>{round(kcal)} ккал</Muted>
                  </View>
                  <Card style={{ padding: 0 }}>
                    {/* Блюдо открывается тем же экраном, что и с «Сегодня»:
                        состав и граммовка нужны и при планировании недели. */}
                    {group.map((i, k) => (
                      <Pressable key={i.id}
                        onPress={() => { haptic.tap(); router.push(`/dish/${i.id}`); }}
                        style={({ pressed }) => ({
                          flexDirection: 'row', alignItems: 'center', gap: S.md,
                          paddingVertical: 12, paddingHorizontal: S.lg,
                          borderTopWidth: k ? 1 : 0, borderTopColor: p.borderSoft,
                          backgroundColor: pressed ? p.ov1 : 'transparent',
                        })}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...FONT.body, color: p.text }}>{i.dish_name}</Text>
                          <Muted style={{ marginTop: 2 }}>
                            {round(i.portion_g)} г · {round(i.nutrition?.kcal)} ккал
                          </Muted>
                        </View>
                        <Icon name="chevr" size={13} color={p.text3} width={2} />
                      </Pressable>
                    ))}
                  </Card>
                </Animated.View>
              );
            })
          )}

          <Muted style={{ marginTop: S.lg, textAlign: 'center' }}>
            {menu.days_count} {plural(menu.days_count, ['день', 'дня', 'дней'])} в меню
          </Muted>
        </>
      )}
    </ScrollView>
  );
}
