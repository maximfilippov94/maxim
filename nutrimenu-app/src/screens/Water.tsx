import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, WaterResponse } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { ListGroup, ListHead, ListRow } from '../ui/List';
import { Label } from '../ui/base';
import { haptic } from '../haptics';
import { hasExpoUI } from '../native';
import { Loading, Fail } from './Shopping';

/* Те же объёмы, что в вебе: 100, 250, 500. Были 200/300/500 — свой
   набор, из-за которого одно и то же действие на сайте и в приложении
   добавляло разное. Отмена убирает 250 мл, тоже как там. */
const STEPS = [100, 250, 500];
const UNDO = 250;
/* Нормы на выбор. Сервер принимает от 500 до 6000 мл, но шкала из шести
   кнопок на телефоне не читается: четыре частых значения закрывают почти
   всех, а точную цифру человек всё равно не знает. */
const GOALS = [1500, 2000, 2500, 3000];

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

/**
 * Кнопки объёмов — системные, в том же исполнении, что «Записать» на
 * панели: стеклянная капсула, нажатие и отклик от самой системы. Своя
 * заливка рядом с ней выглядит нарисованной.
 */
function Steps({ onAdd }: { onAdd: (ml: number) => void }) {
  const { p } = useApp();
  if (!hasExpoUI || Platform.OS !== 'ios') {
    return (
      <View>
        <StepsPlain onAdd={onAdd} />
        <CancelPlain onAdd={onAdd} />
      </View>
    );
  }
  const { Host, VStack, HStack, Button } = require('@expo/ui/swift-ui');
  const { buttonStyle, buttonBorderShape, frame } = require('@expo/ui/swift-ui/modifiers');
  return (
    <Host style={{ height: 108 }} colorScheme={p.name === 'light' ? 'light' : 'dark'}
      /* Акцент приложения передаём внутрь: иначе система красит кнопки
         своим синим. Именно `accent`, а не лайм: стеклянная кнопка
         красит им надпись, и лайм на светлом фоне даёт контраст 1.04 —
         надписи «+100» попросту не видно. В тёмной теме accent — тот же
         лайм, в светлой — чернила. */
      seedColor={p.accent}>
      <VStack spacing={10} modifiers={[frame({ maxWidth: 9999 })]}>
        <HStack spacing={10}>
          {STEPS.map(ml => (
            <Button key={ml} label={`+${ml}`} onPress={() => onAdd(ml)}
              /* Прозрачное стекло, как у «Записать»: заливка (glassProminent)
                 спорит с фигурой и тянет внимание на себя. */
              modifiers={[buttonStyle('glass'), buttonBorderShape('capsule')]} />
          ))}
        </HStack>
        {/* Промахнуться легко, а ждать до завтра из-за лишнего стакана глупо */}
        <Button label={`Убрать ${UNDO} мл`} onPress={() => onAdd(-UNDO)}
          modifiers={[buttonStyle('plain')]} />
      </VStack>
    </Host>
  );
}


function WaterGauge({ current, goal, pct }: { current: number; goal: number; pct: number }) {
  const { p } = useApp();
  const level = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <View style={{
        width: 150, height: 280, borderRadius: 52, overflow: 'hidden',
        borderWidth: 1, borderColor: p.border,
        backgroundColor: p.surface, justifyContent: 'flex-end',
      }}>
        <View style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: `${level}%` as `${number}%`,
          backgroundColor: p.mc,
          opacity: 0.9,
        }} />
        <View style={{
          position: 'absolute', left: 18, right: 18, top: 18, height: 1,
          backgroundColor: p.borderSoft,
        }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 38, fontWeight: '700', color: level > 48 ? p.onPrimary : p.text }}>
            {Math.round(level)}%
          </Text>
          <Text style={{ ...FONT.small, color: level > 48 ? p.onPrimary : p.text3, marginTop: 2 }}>
            сегодня
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: S.lg }}>
        <Text style={{ ...FONT.num, color: p.text }}>{current}</Text>
        <Text style={{ ...FONT.body, color: p.text3 }}>из {goal} мл</Text>
      </View>
    </View>
  );
}

/** Запасной вид там, где системных компонентов нет */
function StepsPlain({ onAdd }: { onAdd: (ml: number) => void }) {
  const { p } = useApp();
  return (
    <View style={{ flexDirection: 'row', gap: S.md, paddingHorizontal: 16 }}>
      {STEPS.map(ml => (
        <Pressable key={ml} onPress={() => onAdd(ml)}
          style={({ pressed }) => ({
            flex: 1, paddingVertical: 14, borderRadius: R.pill,
            alignItems: 'center', backgroundColor: p.primary,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}>
          <Text style={{ ...FONT.h3, color: p.onPrimary }}>+{ml}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function CancelPlain({ onAdd }: { onAdd: (ml: number) => void }) {
  const { p } = useApp();
  return (
    <Pressable onPress={() => onAdd(-UNDO)} hitSlop={10}
      style={({ pressed }) => ({ alignSelf: 'center', marginTop: S.lg, opacity: pressed ? 0.5 : 1 })}>
      <Text style={{ ...FONT.small, color: p.text3 }}>Убрать {UNDO} мл</Text>
    </Pressable>
  );
}

export default function Water() {
  const { p } = useApp();
  const today = isoToday();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<WaterResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<WaterResponse>('/client/water')
      .then(r => { setD({ ...r, history: r.history ?? [] }); })
      /* 404 здесь означает не «нет данных», а «на сервере ещё нет этого
         раздела»: приложение обновляется само, сервер — руками. */
      .catch(e => setErr(e.status === 404
        ? 'Сервер ещё не знает про питьевой режим. Обновите его — раздел появится.'
        : e.message));
  }, []);

  const [goalBusy, setGoalBusy] = useState(false);
  /* Норму меняем на сервере сразу: это не форма, отменять тут нечего.
     Уровень фигуры пересчитываем здесь же — иначе при поднятой планке
     силуэт остаётся полным, и человек читает это как «не сработало».
     Правило React Compiler на запись в это значение ворчит (оно уже
     использовано в эффекте загрузки), но силуэт принимает именно
     SharedValue, и так же сделана отметка глотка рядом. */
  const setGoal = useCallback(async (goal_ml: number) => {
    haptic.select(); setGoalBusy(true);
    try {
      const r = await api<{ goal_ml: number }>('/client/water/goal',
        { method: 'PATCH', body: { goal_ml } });
      setD(x => x ? { ...x, goal_ml: r.goal_ml } : x);
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Норма не сохранилась');
    } finally { setGoalBusy(false); }
  }, []);

  /* Уровень поднимается сразу, запрос идёт следом: ждать сеть ради
     глотка воды незачем. Не прошло — возвращаем как было. */
  const add = useCallback(async (ml: number) => {
    if (!d) return;
    const was = d.today_ml;
    const next = Math.max(0, was + ml);
    setD({ ...d, today_ml: next });
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
    }
  }, [d]);

  if (err) return <Fail title="Вода" text={err} />;
  if (!d) return <Loading title="Вода" />;

  const left = Math.max(0, d.goal_ml - d.today_ml);
  const pct = d.goal_ml ? Math.round((d.today_ml / d.goal_ml) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {/* Возврат отдельной строкой, а заголовок крупный и слева — так же,
          как на «Сегодня» и остальных экранах кабинета. */}
      <NavBar back />
      <ScrollView
        /* Растягиваем содержимое на всю высоту: иначе при короткой
           истории фигура жмётся кверху, а внизу остаётся пустота. */
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>

        <View style={{ paddingHorizontal: S.lg }}>
          <Label>Питьевой режим</Label>
          <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs }}>Вода</Text>
        </View>

        <Animated.View entering={FadeIn.duration(240)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center',
            paddingTop: S.xl, paddingBottom: S.lg }}>
          <WaterGauge current={d.today_ml} goal={d.goal_ml} pct={pct} />
          <Text style={{ ...FONT.small, color: p.text3, marginTop: 4 }}>
            {left ? `осталось ${left} мл` : 'норма на сегодня выполнена'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(240)}>
          <Steps onAdd={add} />
        </Animated.View>

        {/* Норма по умолчанию 2000 мл, а она зависит от веса и жары.
            Маршрут правки был на сервере с самого начала, но его не звал
            ни браузер, ни приложение — поменять норму было негде. */}
        <Animated.View entering={FadeIn.duration(240)}>
          <ListHead>Норма на день</ListHead>
          <View style={{ flexDirection: 'row', gap: S.sm, paddingHorizontal: S.lg }}>
            {GOALS.map(g => {
              const on = d.goal_ml === g;
              return (
                <Pressable key={g} onPress={() => setGoal(g)} disabled={goalBusy}
                  style={({ pressed }) => ({
                    flex: 1, paddingVertical: 10, borderRadius: R.control, alignItems: 'center',
                    backgroundColor: on ? p.mc : 'transparent',
                    borderWidth: on ? 0 : 1, borderColor: p.btnLine,
                    opacity: pressed && !on ? 0.6 : 1,
                  })}>
                  <Text style={{
                    fontSize: 14, fontWeight: on ? '600' : '400',
                    color: on ? p.onPrimary : p.text2,
                  }}>{(g / 1000).toLocaleString('ru-RU')} л</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Сегодняшний день в истории не показываем: он уже наверху
            крупной цифрой, а в списке отставал бы на один глоток. */}
        {d.history.filter(h => h.logged_on !== today).length ? (
          <Animated.View entering={FadeIn.duration(240)}>
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