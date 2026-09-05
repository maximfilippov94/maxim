import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useSharedValue, withSpring } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, WaterResponse } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { ListGroup, ListHead, ListRow } from '../ui/List';
import { Silhouette } from '../ui/Silhouette';
import { haptic } from '../haptics';
import { Loading, Fail } from './Shopping';

/* Ходовые объёмы: стакан, кружка, бутылка. Четвёртой кнопкой отмена —
   промахнуться легко, а ждать до завтра из-за лишнего стакана глупо. */
const STEPS = [200, 300, 500];

const dmy = (s?: string | null) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}` : s;
};

const isoToday = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function Water() {
  const { p, me } = useApp();
  const today = isoToday();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<WaterResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fill = useSharedValue(0);

  useEffect(() => {
    api<WaterResponse>('/client/water')
      .then(r => { setD({ ...r, history: r.history ?? [] }); fill.value = withSpring(r.goal_ml ? r.today_ml / r.goal_ml : 0, { damping: 18 }); })
      /* 404 здесь означает не «нет данных», а «на сервере ещё нет этого
         раздела»: приложение обновляется само, сервер — руками. */
      .catch(e => setErr(e.status === 404
        ? 'Сервер ещё не знает про питьевой режим. Обновите его — раздел появится.'
        : e.message));
  }, [fill]);

  /* Уровень поднимается сразу, запрос идёт следом: ждать сеть ради
     глотка воды незачем. Не прошло — возвращаем как было. */
  const add = useCallback(async (ml: number) => {
    if (!d) return;
    const was = d.today_ml;
    const next = Math.max(0, was + ml);
    setD({ ...d, today_ml: next });
    fill.value = withSpring(d.goal_ml ? next / d.goal_ml : 0, { damping: 18 });
    ml > 0 ? haptic.select() : haptic.tap();
    try {
      const r = await api<{ today_ml: number; goal_ml: number }>('/client/water', {
        method: 'POST', body: { ml },
      });
      setD(x => x && { ...x, today_ml: r.today_ml, goal_ml: r.goal_ml });
      if (was < d.goal_ml && r.today_ml >= r.goal_ml) haptic.success();
    } catch {
      haptic.error();
      setD(x => x && { ...x, today_ml: was });
      fill.value = withSpring(d.goal_ml ? was / d.goal_ml : 0, { damping: 18 });
    }
  }, [d, fill]);

  if (err) return <Fail title="Вода" text={err} />;
  if (!d) return <Loading title="Вода" />;

  const left = Math.max(0, d.goal_ml - d.today_ml);
  const pct = d.goal_ml ? Math.round((d.today_ml / d.goal_ml) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Вода" back />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.duration(240)}
          style={{ alignItems: 'center', paddingTop: S.lg, paddingBottom: S.xl }}>
          <Silhouette fill={fill} sex={me?.user?.sex} water={p.mc} line={p.text2} size={280} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: S.lg }}>
            <Text style={{ ...FONT.num, color: p.text }}>{d.today_ml}</Text>
            <Text style={{ ...FONT.body, color: p.text3 }}>из {d.goal_ml} мл</Text>
          </View>
          <Text style={{ ...FONT.small, color: p.text3, marginTop: 2 }}>
            {left ? `осталось ${left} мл · ${pct}%` : 'норма на сегодня выполнена'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(240)}
          style={{ flexDirection: 'row', gap: S.md, paddingHorizontal: 16 }}>
          {STEPS.map(ml => (
            <Pressable key={ml} onPress={() => add(ml)}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 14, borderRadius: R.md,
                alignItems: 'center', backgroundColor: p.primary,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}>
              <Text style={{ ...FONT.h3, color: p.onPrimary }}>+{ml}</Text>
            </Pressable>
          ))}
        </Animated.View>

        <Pressable onPress={() => add(-STEPS[0])} hitSlop={10}
          style={({ pressed }) => ({ alignSelf: 'center', marginTop: S.lg, opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ ...FONT.small, color: p.text3 }}>Отменить последние {STEPS[0]} мл</Text>
        </Pressable>

        {/* Сегодняшний день в истории не показываем: он уже наверху
            крупной цифрой, а в списке отставал бы на один глоток. */}
        {d.history.filter(h => h.logged_on !== today).length ? (
          <Animated.View entering={FadeInDown.delay(120).duration(240)}>
            <ListHead>Последние дни</ListHead>
            <ListGroup>
              {d.history.filter(h => h.logged_on !== today).reverse().map((h, i) => (
                <ListRow key={h.logged_on} first={i === 0}
                  label={dmy(h.logged_on)} value={`${h.ml} мл`} />
              ))}
            </ListGroup>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}
