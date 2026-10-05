import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { api, TodayResponse, MealItem, MEAL_ORDER } from '../api';
import { S, R, FONT } from '../theme';
import { Card, Muted, Bar, Tile } from '../ui/base';
import { Counter } from '../ui/Counter';
import { SysButton } from '../ui/system';
import { MealSection } from '../ui/MealSection';
import { HomeHead } from '../ui/HomeHead';
import { Ring } from '../ui/Ring';
import { PushNudge } from '../ui/PushNudge';
import { Announce } from '../ui/Announce';
import { round, kg, plural } from '../format';
import { haptic } from '../haptics';
import { useToast } from '../ui/Toast';
import { TodayWorkout, TodayCycle, TodayPlanSource } from '../ui/TodayBlocks';
import type { WorkoutToday, HealthResponse, AiAccess } from '../ui/TodayBlocks';

export default function Today() {
  const { p, me } = useApp();
  const hasSpec = !!me?.user?.specialist_id;
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* Тренировка и цикл живут в своих разделах, но на «Сегодня» показываются
     строкой. Грузим их рядом с планом, не блокируя его: если раздел не
     отвечает, экран всё равно открывается — просто без этой строки. */
  const [wo, setWo] = useState<WorkoutToday | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  /* Имя ведущего специалиста живёт в своём разделе: в `/me` его нет, а
     выдумывать поле нельзя. Берём первого живого — AI показывается
     отдельной строкой и сюда не попадает. */
  const [specName, setSpecName] = useState<string | null>(null);
  const toast = useToast();

  /* `fresh` — мимо кэша чтений. Нужен при возврате с других экранов:
     добавленная еда, записанный вес и выпитая вода меняются там, а
     кэш GET живёт две с половиной секунды — этого хватало, чтобы
     вернувшийся человек увидел прежние числа и решил, что запись
     не сохранилась. */
  const load = useCallback(async (fresh?: boolean) => {
    try {
      const j = await api<TodayResponse & { ai_access?: AiAccess | null }>(
        '/client/today', fresh ? { noCache: true } : undefined);
      setData(j); setErr(null);
    }
    catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, []);

  const loadSide = useCallback(async () => {
    api<WorkoutToday>('/client/workouts').then(setWo).catch(() => {});
    api<HealthResponse>('/client/health').then(setHealth).catch(() => {});
    api<{ specialists?: { name?: string; is_ai?: number | boolean }[] }>('/client/my-specialist')
      .then(j => {
        const human = (j.specialists ?? []).find(x => !x.is_ai);
        setSpecName(human?.name ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); loadSide(); }, [load, loadSide]);

  /* Вода и вес меняются на других экранах, а этот остаётся в памяти —
     без перечитывания при возврате он показывал бы вчерашнее число. */
  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const onRefresh = useCallback(async () => {
    setBusy(true); await load(true); setBusy(false);
  }, [load]);

  /* Запрос отметки без лишнего: оптимистичное обновление и откат при
     ошибке. Отдельно от уведомления, чтобы кнопка «Отменить» вызывала
     именно его, а не обработчик самого себя. */
  const postStatus = useCallback(async (item: MealItem, status: 'eaten' | 'planned') => {
    const before = item.log_status;
    haptic.select();
    setData(d => d && ({
      ...d,
      items: d.items.map(x => x.id === item.id ? { ...x, log_status: status } : x),
    }));
    try {
      await api(`/client/meals/${item.id}/log`, { method: 'POST', body: { status } });
      load();
      return true;
    } catch {
      haptic.error();
      setData(d => d && ({
        ...d,
        items: d.items.map(x => x.id === item.id ? { ...x, log_status: before } : x),
      }));
      return false;
    }
  }, [load]);

  /* Отметка «съедено» рисуется сразу, запрос уходит следом: ожидание ответа
     на каждое нажатие в списке из восьми блюд ощущается как залипание.
     Промах пальцем по соседнему блюду иначе пришлось бы искать и снимать
     руками — отмена висит рядом с начислением. */
  const toggle = useCallback(async (item: MealItem) => {
    const next = item.log_status === 'eaten' ? 'planned' : 'eaten';
    const ok = await postStatus(item, next);
    if (ok && next === 'eaten') {
      toast('+10 баллов', {
        kind: 'award',
        sub: `${item.dish_name} · отмечено`,
        actionLabel: 'Отменить',
        onAction: () => { postStatus({ ...item, log_status: 'eaten' }, 'planned'); },
      });
    }
  }, [postStatus, toast]);

  if (!data && !err) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg }}>
        <ActivityIndicator color={p.accent} />
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
  const plan = round(data?.plan_totals?.kcal);

  /* Цвета те же, что в вебе: белки сиреневые, жиры лаймовые, углеводы
     голубые (`--mp` / `--mf` / `--mc`). Нутриент узнаётся по цвету
     одинаково в обоих продуктах — иначе человек, перешедший с сайта,
     каждый раз перечитывает подписи. */
  const macros: [string, number, number, string][] = [
    ['Белки', data?.totals?.protein ?? 0, targets.protein, p.mp],
    ['Жиры', data?.totals?.fat ?? 0, targets.fat, p.mf],
    ['Углеводы', data?.totals?.carbs ?? 0, targets.carbs, p.mc],
  ];
  const pctEaten = target ? Math.round((eaten / target) * 100) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + S.lg,
        paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + 150,
      }}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={onRefresh} tintColor={p.text3} />}>

      <HomeHead name={u?.name} avatarUrl={u?.avatar_url} />

      {/* Пока уведомления не включены — напоминание здесь: этот экран
          человек открывает каждый день, остальные далеко не всегда. */}
      {/* Объявление от сервиса идёт первым: оно про то, что происходит
          прямо сейчас, а просьба включить уведомления подождёт. */}
      <Announce />
      <PushNudge />

      {err && (
        <Card style={{ marginBottom: S.md }}>
          <Text style={{ ...FONT.body, color: p.premium }}>{err}</Text>
        </Card>
      )}

      {/* Питание за сегодня — одна карточка, как `.eq-daily` в вебе:
          съеденное, кольцо доли и три нутриента под ними. Раньше это
          были две карточки подряд, и доля цели нигде не называлась. */}
      <Animated.View entering={FadeInDown.duration(280)}>
      <Card style={{ marginBottom: S.lg, borderRadius: R.xl, padding: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, color: p.text2 }}>Съедено сегодня</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8,
              marginTop: S.sm, marginBottom: 4 }}>
              <Counter value={eaten} step={1}
                style={{ fontSize: 38, fontWeight: '600', letterSpacing: -1.5, color: p.text }} />
              <Text style={{ fontSize: 14, color: p.text3 }}>/ {target} ккал</Text>
            </View>
            <Text style={{ fontSize: 12, color: p.text3 }}>
              {left >= 0 ? `Осталось ${round(left)} ккал` : `На ${round(-left)} ккал выше цели`}
            </Text>
          </View>
          <Ring pct={pctEaten} size={84} color={left >= 0 ? p.primary : p.premium} />
        </View>

        <View style={{ flexDirection: 'row', gap: 18, marginTop: 22 }}>
          {macros.map(([name, cur, tgt, color]) => (
            <View key={name} style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: p.text2 }} numberOfLines={1}>
                {name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline',
                marginTop: 6, marginBottom: 10 }}>
                <Counter value={round(cur)} step={1}
                  style={{ fontSize: 16, fontWeight: '500', color: p.text }} />
                <Text style={{ fontSize: 12, color: p.text3, marginLeft: 4 }}>
                  / {round(tgt)} г
                </Text>
              </View>
              <Bar value={tgt ? cur / tgt : 0} color={color} height={4} />
            </View>
          ))}
        </View>

        {/* План дня рядом со съеденным: видно, сколько ещё предстоит. */}
        {plan ? (
          <Text style={{ fontSize: 12, color: p.text3, marginTop: 18 }}>
            По плану на день {round(plan)} ккал
            {eaten < plan ? ` · осталось съесть ${round(plan - eaten)}` : ''}
          </Text>
        ) : null}
      </Card>
      </Animated.View>

      {/* Вес, отмеченное и вода — три плитки в ряд, как `.eq-metrics`
          в вебе: обводка вместо заливки, чтобы они читались одним
          блоком под карточкой питания, а не тремя карточками подряд.
          Вода раньше занимала отдельную строку во всю ширину. */}
      <Animated.View entering={FadeInDown.delay(100).duration(280)}
        style={{ flexDirection: 'row', gap: S.md, marginBottom: S.xl }}>

        {/* Вес записывают отсюда: плитка и показывает последний, и
            открывает запись — отдельная кнопка для этого не нужна. */}
        <Tile onPress={() => router.push('/weight')}>
          <Text style={{ fontSize: 12, color: p.text3 }}>Вес</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 5 }}>
            <Text style={{ fontSize: 20, fontWeight: '600', letterSpacing: -0.6, color: p.text }}>
              {data?.weight ? kg(data.weight.last) : '—'}
            </Text>
            {!!data?.weight && (
              <Text style={{ fontSize: 12, color: p.text3, marginLeft: 3 }}>кг</Text>
            )}
          </View>
          <Text style={{ fontSize: 11, color: p.text3, marginTop: 6 }} numberOfLines={2}>
            {data?.weight?.delta
              ? `${data.weight.delta > 0 ? '+' : '−'}${kg(Math.abs(data.weight.delta))} кг за период`
              : 'Записать вес'}
          </Text>
        </Tile>

        <Tile>
          <Text style={{ fontSize: 12, color: p.text3 }}>Отмечено</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 5 }}>
            <Text style={{ fontSize: 20, fontWeight: '600', letterSpacing: -0.6, color: p.text }}>
              {doneCount}
            </Text>
            <Text style={{ fontSize: 12, color: p.text3, marginLeft: 3 }}>/ {items.length}</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <Bar value={items.length ? doneCount / items.length : 0} height={5} color={p.mp} />
          </View>
        </Tile>

        <Tile onPress={() => router.push('/water')}>
          <Text style={{ fontSize: 12, color: p.text3 }}>Вода</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 5 }}>
            <Text style={{ fontSize: 20, fontWeight: '600', letterSpacing: -0.6, color: p.text }}>
              {((data?.water?.ml ?? 0) / 1000).toLocaleString('ru-RU')}
            </Text>
            <Text style={{ fontSize: 12, color: p.text3, marginLeft: 3 }}>л</Text>
          </View>
          <Text style={{ fontSize: 11, color: p.text3, marginTop: 6 }}>
            из {((data?.water?.goal_ml ?? 2000) / 1000).toLocaleString('ru-RU')} л
          </Text>
          <View style={{ marginTop: 10 }}>
            <Bar value={data?.water?.goal_ml ? (data.water.ml / data.water.goal_ml) : 0}
              color={p.mc} height={5} />
          </View>
        </Tile>
      </Animated.View>

      {/* Кто ведёт план, движение на сегодня и женское здоровье — три
          строки перед планом питания. Порядок тот же, что в вебе: человек
          сперва видит, с кем работает и что у него сегодня, и только потом
          разбирает еду по приёмам. */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ gap: S.sm, marginBottom: S.md }}>
        <TodayPlanSource
          specialistName={specName}
          ai={(data as any)?.ai_access ?? null}
        />
        <TodayWorkout data={wo} />
        <TodayCycle health={health} />
      </Animated.View>

      {/* Приёмы пищи. Пока специалиста нет, ждать нечего: меню составляет
          он, и первый шаг — каталог, а не ожидание. */}
      {/* День — это дневник, а не два списка. В одной секции стоит и то,
          что назначил специалист, и то, что человек съел на самом деле:
          он не обязан помнить, откуда какая строка взялась. */}
      {items.length === 0 && !hasSpec ? (
        <View style={{ marginBottom: S.md }}>
          <Muted>
            Ведите дневник питания уже сейчас. Специалист составит меню под ваши цели,
            когда вы его выберете.
          </Muted>
          <View style={{ marginTop: S.md }}>
            <SysButton label="Открыть каталог" variant="prominent" icon="person.2"
              onPress={() => { haptic.tap(); router.push('/specialist'); }} />
          </View>
        </View>
      ) : null}
      {MEAL_ORDER.map((mt, gi) => (
        <Animated.View key={mt} entering={FadeInDown.delay(150 + gi * 60).duration(300)}>
          <MealSection
            meal={mt}
            items={items.filter(x => x.meal_type === mt)}
            own={(data?.food ?? []).filter(e => e.meal === mt)}
            onToggle={toggle}
            onChanged={() => load(true)}
          />
        </Animated.View>
      ))}
      <Muted style={{ textAlign: 'center', marginTop: S.md }}>
        {items.length > 0 && `${doneCount} ${plural(doneCount, ['приём', 'приёма', 'приёмов'])} из ${items.length} отмечено`}
      </Muted>
    </ScrollView>
  );
}
