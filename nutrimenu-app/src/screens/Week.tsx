import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, thumbUrl, WeekResponse, MEAL_ORDER, MEAL_TITLES } from '../api';
import { Image } from 'expo-image';
import { S, R, FONT, LAYOUT, macroColor } from '../theme';
import { Card, Label, Muted, Bar, Tile } from '../ui/base';
import { Ring } from '../ui/Ring';
import { Icon } from '../ui/Icon';
import { ReplacePicker } from '../ui/ReplacePicker';
import { PlanAlert } from '../ui/PlanAlert';
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
  /* Та же шторка подбора, что на «Сегодня» и в карточке блюда. */
  const [replace, setReplace] = useState<number | null>(null);

  const load = useCallback((keepDay?: boolean) => {
    api<WeekResponse>('/client/week', { noCache: true }).then(r => {
      setD(r);
      if (r.menu && !keepDay) {
        /* Открываем на сегодняшнем дне меню, а не на первом: чаще всего
           смотрят именно его, а листать назад можно и руками. */
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const start = new Date(r.menu.start_date + 'T00:00:00');
        const n = Math.floor((+today - +start) / 86400000) + 1;
        setDay(Math.max(1, Math.min(r.menu.days_count, n)));
      }
    }).catch(e => setErr(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const pick = useCallback((n: number) => { haptic.select(); setDay(n); }, []);

  if (err) return <Fail title="Неделя" text={err} />;
  if (!d) return <Loading title="Неделя" />;

  const menu = d.menu;
  const items = (d.items ?? []).filter(i => i.day_number === day);
  const tot = d.days?.[String(day)];
  const target = me?.user?.target_kcal ?? 1800;
  const macroCol = (cur: number, tg: number) => macroColor(p, cur, tg);

  return (
    <>
    <ReplacePicker itemId={replace ?? 0} open={replace != null}
      onClose={() => setReplace(null)} onDone={() => load(true)} />
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + S.lg, paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + 150,
      }}
      showsVerticalScrollIndicator={false}>

      <Label>{menu ? menu.title : 'Меню'}</Label>
      <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs, marginBottom: S.lg }}>Неделя</Text>

      {/* Та же полоса, что на «Сегодня»: сервер отдаёт состояние плана и
          здесь, а неделю смотрят как раз когда меню выглядит странно. */}
      <PlanAlert plan={d.ai_plan} stale={d.menu_stale}
        startDate={menu?.start_date} canRetry={false}
        onRetry={() => load(true)} />

      {!menu ? (
        <Empty icon="calendar" title="Меню ещё не назначено"
          note="Как только специалист опубликует меню, дни появятся здесь." />
      ) : (
        <>
          {/* Полоса дней: день недели сверху, число снизу */}
          <Animated.View entering={FadeIn.duration(240)}>
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
                    {now ? (
                      <View style={{
                        width: 4, height: 4, borderRadius: 2, marginTop: 4,
                        backgroundColor: on ? p.onPrimary : p.primary,
                      }} />
                    ) : <View style={{ height: 8 }} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          <View style={{ flexDirection: 'row', alignItems: 'center',
            marginTop: S.sm, marginBottom: S.md }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 13, color: p.text3 }}>План на день</Text>
              <Text style={{ ...FONT.h2, color: p.text, marginTop: 2 }}>
                {dayTitle(menu.start_date, day, true)}
              </Text>
            </View>

          </View>

          {tot ? (
            <Animated.View entering={FadeIn.duration(240)}
              style={{ marginBottom: S.xl, gap: S.md }}>
              {/* Доля плана от личной нормы — кольцом, как в вебе: строка
                  «1790 / 1770» одна ничего не говорит о том, много это
                  или в меру. */}
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.lg,
                borderRadius: R.xl, padding: 18 }}>
                <Ring pct={target ? (tot.kcal / target) * 100 : 0} size={96}
                  color={macroCol(tot.kcal, target)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13, color: p.text3 }}>Калории в плане</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 5 }}>
                    <Text style={{ fontSize: 26, fontWeight: '600', letterSpacing: -0.9,
                      color: p.text }}>
                      {round(tot.kcal)}
                    </Text>
                    <Text style={{ fontSize: 13, color: p.text3, marginLeft: 6 }}>
                      / цель {target}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: p.text3, marginTop: 6 }}>
                    {items.length} {plural(items.length, ['блюдо', 'блюда', 'блюд'])} запланировано
                  </Text>
                </View>
              </Card>

              {/* Нутриенты плитками: перебор виден цветом полосы, а не
                  только числом в строке «Б · Ж · У». */}
              <View style={{ flexDirection: 'row', gap: S.md }}>
                {([
                  ['Белки', tot.protein, me?.user?.target_protein ?? 110],
                  ['Жиры', tot.fat, me?.user?.target_fat ?? 60],
                  ['Углеводы', tot.carbs, me?.user?.target_carbs ?? 190],
                ] as [string, number, number][]).map(([name, cur, tgt]) => (
                  <Tile key={name}>
                    <Text style={{ fontSize: 12, color: p.text3 }} numberOfLines={1}>{name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 5 }}>
                      <Text style={{ fontSize: 20, fontWeight: '600', letterSpacing: -0.6,
                        color: p.text }}>
                        {round(cur)}
                      </Text>
                      <Text style={{ fontSize: 12, color: p.text3, marginLeft: 3 }}>
                        / {round(tgt) || '—'} г
                      </Text>
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <Bar value={tgt ? Math.min(1, cur / tgt) : 0} color={macroCol(cur, tgt)} height={5} />
                    </View>
                    {tgt && cur > tgt ? (
                      <Text style={{ fontSize: 10, color: p.warn, marginTop: 6 }}>
                        +{round(cur - tgt)} г выше цели
                      </Text>
                    ) : null}
                  </Tile>
                ))}
              </View>
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
                  entering={FadeIn.duration(220)}>
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
                        {/* Снимок блюда: по названию «боул» и «салат» неделя
                            читается как список слов, по фото — как еда. */}
                        {thumbUrl(i)
                          ? <Image
                              source={{ uri: thumbUrl(i)! }}
                              style={{ width: 46, height: 46, borderRadius: R.control, backgroundColor: p.inset }}
                              contentFit="cover" transition={200} cachePolicy="memory-disk"
                            />
                          : <View style={{ width: 46, height: 46, borderRadius: R.control, backgroundColor: p.inset,
                              alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="bowl" size={18} color={p.text3} />
                            </View>}
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...FONT.body, color: p.text }} numberOfLines={2}>{i.dish_name}</Text>
                          <Muted style={{ marginTop: 2 }}>
                            {round(i.portion_g)} г · {round(i.nutrition?.kcal)} ккал
                          </Muted>
                        </View>
                        {/* Замена доступна и на неделе — как в вебе: план
                            правят, глядя на всю неделю, а не только на
                            сегодняшний день. */}
                        <Pressable hitSlop={8} accessibilityLabel="Заменить блюдо"
                          onPress={() => { haptic.tap(); setReplace(i.id); }}
                          style={({ pressed }) => ({
                            width: 30, height: 30, borderRadius: 10,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: pressed ? p.ov3 : p.inset,
                          })}>
                          <Icon name="replace" size={16} color={p.text2} />
                        </Pressable>
                        <Icon name="chevr" size={13} color={p.text3} width={2} />
                      </Pressable>
                    ))}
                  </Card>
                </Animated.View>
              );
            })
          )}

          {/* Из недели человек чаще всего идёт за покупками: меню на руках,
              осталось понять, что купить. В вебе эта кнопка стоит там же. */}
          <Pressable
            onPress={() => { haptic.tap(); router.push('/shopping'); }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: S.md,
              minHeight: LAYOUT.rowMin, marginTop: S.lg,
              paddingHorizontal: S.lg, paddingVertical: S.md,
              borderRadius: R.lg, backgroundColor: p.surface,
              borderWidth: 1, borderColor: p.border,
              opacity: pressed ? 0.9 : 1,
            })}>
            <View style={{ width: 42, height: 42, borderRadius: R.control,
              backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="cart" size={19} color={p.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...FONT.h3, color: p.text }}>Список покупок</Text>
              <Muted>Продукты на ближайшую неделю</Muted>
            </View>
            <Icon name="chevr" size={16} color={p.text3} />
          </Pressable>

          <Muted style={{ marginTop: S.lg, textAlign: 'center' }}>
            {menu.days_count} {plural(menu.days_count, ['день', 'дня', 'дней'])} в меню
          </Muted>
        </>
      )}
    </ScrollView>
    </>
  );
}