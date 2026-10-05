/**
 * Женское здоровье: цикл.
 *
 * Данные те же, что у веба: `/client/health` отдаёт блок `cycle` с
 * настройками, периодами, отметками по дням и сводкой. Ничего нового не
 * придумано — экран собран из этих полей.
 *
 * Про цвет. Раздел красится тем же `#C28D7F`, что и в вебе
 * (`.cycle-day.period`, `.cycle-overview-ring`), и теми же долями
 * смешения с панелью. Раньше здесь были беж и шалфей — выбор «как
 * лучше», из-за которого один и тот же раздел на сайте и в приложении
 * выглядел из разных продуктов.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api } from '../api';
import { S, R, FONT, LAYOUT, CYCLE, mix, alpha } from '../theme';
import { Card, Muted } from '../ui/base';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { NavBar } from '../ui/NavBar';
import { SysButton, SysDate, Empty } from '../ui/system';
import { useToast } from '../ui/Toast';
import { haptic } from '../haptics';
import { plural } from '../format';

/* Те же слова, что в вебе: словарь отметок один на оба клиента. */
export const CYCLE_WORDS: Record<string, Record<string, string>> = {
  flow: { none: 'Нет', light: 'Слабая', medium: 'Обычная', heavy: 'Сильная' },
  pain: { none: 'Нет', light: 'Лёгкая', medium: 'Умеренная', strong: 'Сильная' },
  energy: { low: 'Низкая', normal: 'Обычная', high: 'Высокая' },
  appetite: { low: 'Ниже', normal: 'Обычный', high: 'Выше' },
  mood: { low: 'Снижено', steady: 'Спокойно', good: 'Хорошо' },
  sleep: { poor: 'Плохо', normal: 'Обычно', good: 'Хорошо' },
  training_feel: { hard: 'Тяжело', normal: 'Обычно', easy: 'Легко' },
};

const FIELDS: { key: string; label: string }[] = [
  { key: 'flow', label: 'Выделения' },
  { key: 'pain', label: 'Боль' },
  { key: 'energy', label: 'Энергия' },
  { key: 'mood', label: 'Настроение' },
  { key: 'sleep', label: 'Сон' },
  { key: 'appetite', label: 'Аппетит' },
];

interface CycleLog { logged_on: string; [k: string]: string | null | undefined }
interface CyclePeriod { id: number; started_on: string; ended_on?: string | null }
interface CycleInsight { title: string; text: string }
interface CycleData {
  enabled?: boolean;
  settings?: { avg_period_days?: number; avg_cycle_days?: number } | null;
  periods?: CyclePeriod[];
  logs?: CycleLog[];
  /** «Что повторяется у вас» — сервер считает по последним циклам */
  insights?: CycleInsight[];
  summary?: {
    cycle_day?: number | null;
    phase_label?: string | null;
    period_active?: boolean;
    predicted_next?: string | null;
    predicted_next_from?: string | null;
    predicted_next_to?: string | null;
    days_to_next?: number | null;
    regular?: boolean | null;
    /** Сегодня предполагаемое начало — сервер ждёт ответа */
    prediction_due?: boolean;
    /** Начало оказалось позже прогноза: ежедневные вопросы остановлены */
    prediction_paused?: boolean;
    /** Период идёт дольше обычного — сервер ждёт подтверждения окончания */
    end_due?: boolean;
  } | null;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today10 = () => ymd(new Date());
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/**
 * `embedded` — цикл показан вкладкой внутри «Здоровья», как в вебе:
 * без своей шапки и без нижнего отступа под док, их даёт тот экран.
 */
/** Шапка своего экрана цикла: заголовок, «назад» и вход в настройки. */
function CycleBar() {
  const { p } = useApp();
  return (
    <NavBar title="Цикл" back right={
      <Pressable hitSlop={10}
        onPress={() => { haptic.tap(); router.push('/cycle-settings'); }}>
        <Icon name="device" size={19} color={p.accent} width={1.8} />
      </Pressable>
    } />
  );
}

export default function Cycle({ embedded }: { embedded?: boolean } = {}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [c, setC] = useState<CycleData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await api<{ cycle?: CycleData }>('/client/health', { noCache: true });
      setC(j.cycle ?? null); setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, []);

  /* Загрузка при открытии экрана. Правило React Compiler считает вызов,
     меняющий состояние, нежелательным внутри эффекта; здесь это
     осознанно — данные приходят с сервера, и другого места для первого
     запроса нет. Переход всего приложения на иной способ загрузки вынесен
     отдельной задачей (MIGRATION.md). */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  /* Отметки и периоды кладём в словари заранее: в календаре 42 ячейки, и
     искать по спискам на каждую — лишняя работа на каждый кадр. */
  const byLog = useMemo(() => {
    const m: Record<string, CycleLog> = {};
    (c?.logs ?? []).forEach(x => { m[x.logged_on] = x; });
    return m;
  }, [c]);

  const inPeriod = useCallback((date: string) =>
    (c?.periods ?? []).some(x => date >= x.started_on && date <= (x.ended_on || today10())),
  [c]);

  const inPredicted = useCallback((date: string) => {
    const from = c?.summary?.predicted_next;
    if (!from) return false;
    const len = Number(c?.settings?.avg_period_days ?? 5);
    const a = new Date(from + 'T00:00:00');
    const b = new Date(a); b.setDate(b.getDate() + len - 1);
    return date >= from && date <= ymd(b);
  }, [c]);

  const startPeriod = useCallback(async () => {
    setBusy(true);
    try {
      await api('/client/health/cycle/period/start', { method: 'POST', body: { started_on: today10() } });
      haptic.success(); await load();
    } catch (e: any) { haptic.error(); toast(e?.message ?? 'Не сохранилось', { kind: 'err' }); }
    finally { setBusy(false); }
  }, [load, toast]);

  const endPeriod = useCallback(async () => {
    setBusy(true);
    try {
      await api('/client/health/cycle/period/end', { method: 'PATCH', body: { ended_on: today10() } });
      haptic.success(); await load();
    } catch (e: any) { haptic.error(); toast(e?.message ?? 'Не сохранилось', { kind: 'err' }); }
    finally { setBusy(false); }
  }, [load, toast]);

  /* Ответ на прогноз. «started» заводит период, «later» и
     «remind_tomorrow» только двигают сам прогноз — сервер решает это
     сам, клиент лишь передаёт ответ (`clCyclePrediction` в вебе). */
  const answerPrediction = useCallback(async (action: 'started' | 'later' | 'remind_tomorrow') => {
    setBusy(true);
    try {
      await api('/client/health/cycle/prediction-response', { method: 'POST', body: { action } });
      haptic.success(); await load();
    } catch (e: any) { haptic.error(); toast(e?.message ?? 'Не сохранилось', { kind: 'err' }); }
    finally { setBusy(false); }
  }, [load, toast]);

  /* Период не закрывается сам: сервер спрашивает, закончилась ли
     менструация, и ждёт подтверждения («ended») или «ещё идёт». */
  const answerEnd = useCallback(async (action: 'ended' | 'still') => {
    setBusy(true);
    try {
      await api('/client/health/cycle/period/end-response', { method: 'POST', body: { action } });
      haptic.success(); await load();
    } catch (e: any) { haptic.error(); toast(e?.message ?? 'Не сохранилось', { kind: 'err' }); }
    finally { setBusy(false); }
  }, [load, toast]);

  /* Правка и удаление отмеченного цикла — те же маршруты, что у веба. */
  const savePeriod = useCallback(async (id: number, started_on: string, ended_on: string | null) => {
    setBusy(true);
    try {
      await api(`/client/health/cycle/period/${id}`, { method: 'PATCH', body: { started_on, ended_on } });
      haptic.success(); await load();
    } catch (e: any) { haptic.error(); toast(e?.message ?? 'Не сохранилось', { kind: 'err' }); }
    finally { setBusy(false); }
  }, [load, toast]);

  const dropPeriod = useCallback(async (id: number) => {
    setBusy(true);
    try {
      await api(`/client/health/cycle/period/${id}`, { method: 'DELETE' });
      haptic.success(); await load();
    } catch (e: any) { haptic.error(); toast(e?.message ?? 'Не удалилось', { kind: 'err' }); }
    finally { setBusy(false); }
  }, [load, toast]);

  const saveDay = useCallback(async (date: string, key: string, value: string) => {
    /* Повторное нажатие по той же отметке снимает её: выбрать «боли нет»
       и передумать — обычное дело, а отдельной кнопки «очистить» в
       компактной строке нет места. */
    const prev = byLog[date]?.[key];
    const next = prev === value ? null : value;
    try {
      await api('/client/health/cycle/day', { method: 'POST', body: { logged_on: date, [key]: next } });
      haptic.select(); await load();
    } catch (e: any) { haptic.error(); toast(e?.message ?? 'Не сохранилось', { kind: 'err' }); }
  }, [byLog, load, toast]);

  if (!c && !err) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        {embedded ? null : <CycleBar />}
        <ActivityIndicator color={p.accent} style={{ marginTop: S.xxl }} />
      </View>
    );
  }

  /* Раздел выключен — это настройка, а не поломка: объясняем, что он даёт. */
  if (!c?.enabled) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        {embedded ? null : <CycleBar />}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Empty icon="heart" title="Календарь цикла выключен"
            note="Включите его в разделе «Здоровье» — EQUA будет учитывать фазу в питании и тренировках." />
        </View>
      </View>
    );
  }

  const s = c.summary ?? {};
  const first = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const num = i - first + 1;
    if (num < 1 || num > daysInMonth) return null;
    return ymd(new Date(month.getFullYear(), month.getMonth(), num));
  });
  const log = picked ? byLog[picked] : null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {embedded ? null : <CycleBar />}
      <ScrollView
        scrollEnabled={!embedded}
        contentContainerStyle={{
          paddingHorizontal: embedded ? 0 : LAYOUT.screenPad,
          paddingBottom: embedded ? 0 : insets.bottom + LAYOUT.dockHeight + S.xl,
        }}
        showsVerticalScrollIndicator={false}>

        {err ? <Muted>{err}</Muted> : null}

        {/* Сводка: где человек находится в цикле прямо сейчас. */}
        <Animated.View entering={FadeInDown.duration(240)}>
          <Card style={{ marginBottom: S.md }}>
            <Text style={{ ...FONT.caption, color: p.text3 }}>
              {s.phase_label || 'Женское здоровье'}
            </Text>
            <Text style={{ ...FONT.h2, color: p.text, marginTop: 2 }}>
              {s.period_active
                ? 'Идёт менструация'
                : s.cycle_day ? `${s.cycle_day}-й день цикла` : 'Календарь включён'}
            </Text>
            {/* Пояснение под заголовком — слово в слово как в вебе: у
                нерегулярного цикла там окно дат, а не одна дата. */}
            <Muted style={{ marginTop: S.xs }}>
              {s.period_active
                ? 'Отметьте окончание, когда она завершится.'
                : s.regular === false
                  ? (s.predicted_next_from
                      ? `Ориентировочное окно: ${dlong(s.predicted_next_from)} — ${dlong(s.predicted_next_to ?? s.predicted_next_from)}.`
                      : 'Для нерегулярного цикла прогноз появится после новых отметок.')
                  : typeof s.days_to_next === 'number' && s.days_to_next >= 0
                    ? `Следующее начало ориентировочно через ${s.days_to_next} ${plural(s.days_to_next, ['день', 'дня', 'дней'])}.`
                    : 'Прогноз появится после новой отметки.'}
            </Muted>
            <View style={{ marginTop: S.md }}>
              <SysButton
                label={s.period_active ? 'Менструация закончилась' : 'Началась менструация'}
                variant={s.period_active ? undefined : 'prominent'}
                disabled={busy}
                onPress={s.period_active ? endPeriod : startPeriod} />
            </View>
          </Card>
        </Animated.View>

        {/* Прогноз ждёт ответа. В вебе это первая секция под сводкой:
            сервер не отмечает начало сам, пока человек не подтвердит. */}
        {s.prediction_due ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <Card style={{ marginBottom: S.md, borderWidth: 1, borderColor: alpha(CYCLE, 40) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 17, alignItems: 'center',
                  justifyContent: 'center', backgroundColor: mix(CYCLE, 18, p.surface),
                }}>
                  <Icon name="drop" size={17} color={CYCLE} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...FONT.caption, color: p.text3 }}>Прогноз EQUA</Text>
                  <Text style={{ ...FONT.h3, color: p.text }}>Месячные уже начались?</Text>
                </View>
              </View>
              <Muted style={{ marginTop: S.sm }}>
                Сегодня — предполагаемое начало. Подтвердите дату или уточните прогноз.
              </Muted>
              <View style={{ marginTop: S.md }}>
                <SysButton label="Да, отметить начало" variant="prominent" disabled={busy}
                  onPress={() => answerPrediction('started')} />
              </View>
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                <View style={{ flex: 1 }}>
                  <SysButton label="Пока нет" disabled={busy}
                    onPress={() => answerPrediction('later')} />
                </View>
                <View style={{ flex: 1 }}>
                  <SysButton label="Напомнить завтра" disabled={busy}
                    onPress={() => answerPrediction('remind_tomorrow')} />
                </View>
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {/* Прогноз приостановлен: объясняем почему, иначе исчезнувшие
            ежедневные вопросы читаются как поломка. */}
        {s.prediction_paused ? (
          <Card style={{ marginBottom: S.md, flexDirection: 'row', gap: S.sm }}>
            <Icon name="info" size={18} color={p.text3} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...FONT.h3, color: p.text }}>Прогноз скорректирован</Text>
              <Muted style={{ marginTop: 2 }}>
                Начало оказалось позже ожидаемого, поэтому ежедневные вопросы приостановлены.
                Отметьте дату, когда месячные начнутся.
              </Muted>
            </View>
          </Card>
        ) : null}

        {/* Окончание тоже подтверждает человек: автоматически период не
            закрывается — в вебе так же. */}
        {s.end_due ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <Card style={{ marginBottom: S.md, borderWidth: 1, borderColor: alpha(CYCLE, 40) }}>
              <Text style={{ ...FONT.caption, color: p.text3 }}>Уточним календарь</Text>
              <Text style={{ ...FONT.h3, color: p.text }}>Месячные завершились?</Text>
              <Muted style={{ marginTop: S.xs }}>
                Мы не закрываем период сами — подтвердите последний день.
              </Muted>
              <View style={{ marginTop: S.md }}>
                <SysButton label="Да, сегодня" variant="prominent" disabled={busy}
                  onPress={() => answerEnd('ended')} />
              </View>
              <View style={{ marginTop: S.sm }}>
                <SysButton label="Пока продолжаются" disabled={busy}
                  onPress={() => answerEnd('still')} />
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {/* Календарь месяца. Залитый кружок — отмеченный период, контур —
            прогноз, точка снизу — есть отметка самочувствия. */}
        <Card style={{ marginBottom: S.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable hitSlop={10} onPress={() => { haptic.tap(); setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }}
              style={{ width: LAYOUT.touch, height: LAYOUT.touch, alignItems: 'center', justifyContent: 'center' }}>
              {/* Стрелка влево — тот же значок, повёрнутый обёрткой:
                  отдельного контура ради зеркального вида заводить незачем. */}
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <Icon name="chevr" size={16} color={p.text3} />
              </View>
            </Pressable>
            <Text style={{ ...FONT.h3, color: p.text }}>
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </Text>
            <Pressable hitSlop={10} onPress={() => { haptic.tap(); setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }}
              style={{ width: LAYOUT.touch, height: LAYOUT.touch, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chevr" size={16} color={p.text3} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', marginTop: S.sm }}>
            {DOW.map(d => (
              <Text key={d} style={{ ...FONT.caption, color: p.text3, flex: 1, textAlign: 'center' }}>{d}</Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: S.xs }}>
            {cells.map((date, i) => {
              if (!date) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 44 }} />;
              const isToday = date === today10();
              const period = inPeriod(date);
              const predicted = !period && inPredicted(date);
              const marked = !!byLog[date];
              const future = date > today10();
              return (
                <Pressable key={date} disabled={future}
                  onPress={() => { haptic.select(); setPicked(d => (d === date ? null : date)); }}
                  style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{
                    width: 34, height: 34, borderRadius: 17,
                    alignItems: 'center', justifyContent: 'center',
                    /* Значения из веба: день менструации — 30 % цвета
                       цикла поверх панели с рамкой в 55 %, прогноз —
                       7 % поверх панели и пунктир в 72 %. */
                    backgroundColor: period ? mix(CYCLE, 30, p.surface)
                      : predicted ? mix(CYCLE, 7, p.surface)
                      : picked === date ? p.primarySoft : 'transparent',
                    borderWidth: predicted || isToday ? 1.5 : 0,
                    borderColor: predicted ? alpha(CYCLE, 72) : p.primary,
                    borderStyle: predicted ? 'dashed' : 'solid',
                    opacity: future ? 0.35 : 1,
                  }}>
                    <Text style={{
                      ...FONT.callout,
                      color: p.text,
                      fontWeight: isToday ? '700' : '400',
                    }}>{Number(date.slice(8))}</Text>
                  </View>
                  {marked ? (
                    <View style={{
                      width: 4, height: 4, borderRadius: 2, marginTop: -5,
                      backgroundColor: p.accent,
                    }} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Отметка выбранного дня. Открывается по нажатию на число —
            постоянно висящая форма занимала бы весь экран. */}
        {picked ? (
          <Animated.View entering={FadeInDown.duration(200)}>
            <Card>
              <Text style={{ ...FONT.h3, color: p.text, marginBottom: S.sm }}>
                {/* «5 октября», а не «5 октябрь»: месяц рядом с числом
                    стоит в родительном падеже. Массив MONTHS именительный
                    — он для заголовка календаря, где это верно. В вебе
                    дата выводится через toLocaleDateString, так же и тут. */}
                {new Date(picked + 'T00:00:00').toLocaleDateString('ru-RU',
                  { day: 'numeric', month: 'long' })}
              </Text>
              {FIELDS.map(f => (
                <View key={f.key} style={{ marginBottom: S.md }}>
                  <Muted>{f.label}</Muted>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginTop: S.xs }}>
                    {Object.entries(CYCLE_WORDS[f.key]).map(([value, word]) => {
                      const on = log?.[f.key] === value;
                      return (
                        <Pressable key={value}
                          onPress={() => saveDay(picked, f.key, value)}
                          style={({ pressed }) => ({
                            minHeight: 38, paddingHorizontal: S.md, justifyContent: 'center',
                            borderRadius: R.pill,
                            backgroundColor: on ? p.primary : 'transparent',
                            borderWidth: on ? 0 : 1, borderColor: p.btnLine,
                            opacity: pressed ? 0.8 : 1,
                          })}>
                          <Text style={{
                            ...FONT.callout,
                            color: on ? p.onPrimary : p.text2,
                            fontWeight: on ? '700' : '400',
                          }}>{word}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </Card>
          </Animated.View>
        ) : (
          <Muted style={{ textAlign: 'center', marginTop: S.sm }}>
            Нажмите на день, чтобы отметить самочувствие.
          </Muted>
        )}

        {/* «Что повторяется у вас» — сервер считает закономерности по
            последним циклам и отдаёт готовыми строками. */}
        {(c.insights ?? []).length ? (
          <View style={{ marginTop: S.lg }}>
            <Text style={{ ...FONT.caption, color: p.text3 }}>Личные наблюдения</Text>
            <Text style={{ ...FONT.h3, color: p.text, marginBottom: S.sm }}>
              Что повторяется у вас
            </Text>
            {(c.insights ?? []).map(x => (
              <Card key={x.title} style={{ marginBottom: S.sm, flexDirection: 'row', gap: S.sm }}>
                <Icon name="trend" size={18} color={CYCLE} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...FONT.h3, color: p.text }}>{x.title}</Text>
                  <Muted style={{ marginTop: 2 }}>{x.text}</Muted>
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Последние записи самочувствия: нажатие открывает тот день. */}
        {(c.logs ?? []).length ? (
          <View style={{ marginTop: S.lg }}>
            <Text style={{ ...FONT.caption, color: p.text3 }}>Наблюдения</Text>
            <Text style={{ ...FONT.h3, color: p.text, marginBottom: S.sm }}>Последние записи</Text>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {(c.logs ?? []).slice(0, 5).map((x, i) => (
                <Pressable key={x.logged_on}
                  onPress={() => { haptic.select(); setPicked(x.logged_on); }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: S.sm,
                    paddingVertical: 12, paddingHorizontal: S.lg,
                    borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
                    backgroundColor: pressed ? p.ov1 : 'transparent',
                  })}>
                  <Text style={{ ...FONT.callout, color: p.text2, width: 92 }}>
                    {dlong(x.logged_on)}
                  </Text>
                  <Text numberOfLines={1} style={{ ...FONT.small, color: p.text3, flex: 1 }}>
                    {signals(x).slice(0, 3).join(' · ') || 'Есть комментарий'}
                  </Text>
                  <Icon name="chevr" size={14} color={p.text3} />
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Отмеченные циклы: даты можно поправить или убрать запись. */}
        {(c.periods ?? []).length ? (
          <View style={{ marginTop: S.lg }}>
            <Text style={{ ...FONT.caption, color: p.text3 }}>История</Text>
            <Text style={{ ...FONT.h3, color: p.text, marginBottom: S.sm }}>Отмеченные циклы</Text>
            {(c.periods ?? []).slice(0, 6).map(x => (
              <PeriodRow key={x.id} x={x} busy={busy}
                onSave={savePeriod} onDrop={dropPeriod} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** «5 октября» — дата записи в журнале и в истории. */
function dlong(v: string) {
  return new Date(v + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/** Отметки дня словами — тот же `signal` из веба: три первых заполненных. */
function signals(x: CycleLog): string[] {
  return Object.entries(CYCLE_WORDS).flatMap(([k, words]) => {
    const v = x[k];
    return v && words[v] ? [words[v]] : [];
  });
}

/**
 * Строка отмеченного цикла. Нажатие раскрывает правку дат: в вебе это
 * шторка с двумя полями, здесь — те же два поля прямо в строке, чтобы
 * не городить ещё один экран ради двух дат.
 */
function PeriodRow({ x, busy, onSave, onDrop }: {
  x: CyclePeriod; busy: boolean;
  onSave: (id: number, started: string, ended: string | null) => void;
  onDrop: (id: number) => void;
}) {
  const { p } = useApp();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => new Date(x.started_on + 'T00:00:00'));
  const [to, setTo] = useState(() =>
    x.ended_on ? new Date(x.ended_on + 'T00:00:00') : null);

  return (
    <Card style={{ marginBottom: S.sm }}>
      <Pressable onPress={() => { haptic.tap(); setOpen(v => !v); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <View style={{
          width: 10, height: 10, borderRadius: 5, backgroundColor: mix(CYCLE, 70, p.surface),
        }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...FONT.h3, color: p.text }}>{dlong(x.started_on)}</Text>
          <Muted style={{ marginTop: 2 }}>
            {x.ended_on ? `по ${dlong(x.ended_on)}` : 'идёт сейчас'} · изменить
          </Muted>
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevr" size={14} color={p.text3} />
        </View>
      </Pressable>

      {open ? (
        <View style={{ marginTop: S.md, gap: S.sm }}>
          <Muted>Начало</Muted>
          <SysDate value={from} onChange={setFrom} max={new Date()} />
          <Muted>Окончание</Muted>
          {to ? (
            <SysDate value={to} onChange={setTo} min={from} max={new Date()} />
          ) : (
            <SysButton label="Указать окончание" height={44}
              onPress={() => { haptic.tap(); setTo(new Date()); }} />
          )}
          <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.xs }}>
            <View style={{ flex: 1 }}>
              <SysButton label="Сохранить" variant="prominent" height={44} disabled={busy}
                onPress={() => { setOpen(false); onSave(x.id, ymd(from), to ? ymd(to) : null); }} />
            </View>
            <View style={{ flex: 1 }}>
              <SysButton label="Удалить" variant="destructive" height={44} disabled={busy}
                onPress={() => {
                  Alert.alert('Удалить запись?', `${dlong(x.started_on)} — запись о цикле`, [
                    { text: 'Отмена', style: 'cancel' },
                    { text: 'Удалить', style: 'destructive', onPress: () => onDrop(x.id) },
                  ]);
                }} />
            </View>
          </View>
        </View>
      ) : null}
    </Card>
  );
}
