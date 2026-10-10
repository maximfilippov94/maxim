/**
 * EQUA AI: что подключено и что можно подключить.
 *
 * В приложении этого экрана не было: чат с моделью работал, а оформить
 * набор, заполнить анкеты и посмотреть, что собрано, можно было только
 * в браузере.
 *
 * Порядок на экране повторяет порядок действий, а не состав данных:
 * сначала то, что уже есть, потом чего не хватает для запуска, и только
 * потом цены. Человеку, у которого не заполнена анкета, цена ни о чём
 * не говорит — ему нужно знать следующий шаг.
 *
 * Оплату приложение не проводит. Когда сервер работает с живым эквайером,
 * экран прямо говорит, что оформить нужно на сайте: прятать это за
 * кнопкой, которая ничего не делает, хуже, чем сказать.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, Alert, Switch, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useApp } from '../store';
import { api, AiState, AiPlan } from '../api';
import { S, R, FONT, CYCLE } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { ListGroup, ListHead, ListRow } from '../ui/List';
import { SysButton, Empty } from '../ui/system';
import { useToast } from '../ui/Toast';
import { rub, plural } from '../format';
import { haptic } from '../haptics';

/**
 * Наборы EQUA AI — тексты из веба (`META` в `clAI` и `pack` в
 * `clAICheckout`), слово в слово.
 *
 * Короткая часть (kicker/title/desc) стоит в списке выбора, длинная
 * (lead и что входит) — в шторке оформления. Раньше в приложении всё
 * лежало на одном экране, и список возможностей был виден до того, как
 * человек вообще выбрал набор: экран читался как «заполните анкету»,
 * а не как «выберите, что подключить».
 */
const AI_PACK: Record<AiPlan, {
  icon: string; kicker: string; title: string; desc: string;
  eyebrow: string; head: string; lead: string; items: string[];
}> = {
  nutrition: {
    icon: 'bowl', kicker: 'Питание',
    title: 'Питание под ваш ритм',
    desc: 'Меню, КБЖУ, покупки и замены',
    eyebrow: 'AI · Питание',
    head: '30 дней питания, которое подстраивается под вашу жизнь',
    lead: 'Не просто меню. EQUA AI знает вашу цель, режим и предпочтения, следит за фактом и помогает не начинать заново после сложной недели.',
    items: ['Персональное меню по неделям в течение 30 дней',
      'КБЖУ, порции и понятные замены', 'Список покупок на каждую неделю',
      'Еженедельный отчёт и адаптация плана', 'Чат с EQUA AI по вашему плану'],
  },
  workouts: {
    icon: 'dumbbell', kicker: 'Тренировки',
    title: 'Тренировки под ваш темп',
    desc: 'Программа, нагрузка и прогрессия',
    eyebrow: 'AI · Тренировки',
    head: '30 дней тренировок с прогрессией под ваш реальный темп',
    lead: 'Программа учитывает ваш уровень, график и оборудование, а затем смотрит на выполненные подходы, повторения, рабочие веса и самочувствие.',
    items: ['Программа тренировок на 30 дней',
      'Подходы, повторы, отдых и рабочая нагрузка', 'Учёт фактического выполнения',
      'Прогрессия или разгрузка по данным недели', 'Чат с EQUA AI по вашей программе'],
  },
  both: {
    icon: 'spark', kicker: 'Полный план',
    title: 'Питание + тренировки',
    desc: 'Единая система питания и движения',
    eyebrow: 'EQUA AI · Полный план',
    head: 'Питание и тренировки как одна персональная система на 30 дней',
    lead: 'EQUA AI связывает рацион, движение и прогресс в одном сценарии и каждую неделю предлагает изменения по вашим фактическим данным.',
    items: ['Питание по неделям в течение 30 дней', 'Персональная программа тренировок',
      'Списки покупок и замены блюд', 'Еженедельная адаптация питания и нагрузки',
      'Единый чат с EQUA AI по всему плану'],
  },
};

/** Цена со скидкой нового клиента — как `aiOfferPrice` в вебе. */
const offerPrice = (kop: number, percent: number) =>
  percent ? Math.round(kop * (100 - percent) / 100) : kop;

const dmy = (s?: string | null) => {
  if (!s) return '—';
  const x = String(s).slice(0, 10).split('-');
  return x.length === 3 ? `${x[2]}.${x[1]}.${x[0]}` : String(s);
};

export default function AI() {
  const { p } = useApp();
  const params = useLocalSearchParams<{ plan?: string; preview?: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [d, setD] = useState<AiState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* Промокод спрашиваем только при настоящей оплате: пока платежи
     выключены, набор выдаётся бесплатно, и скидка ни к чему. */
  const [code, setCode] = useState('');
  /* Какой набор разбираем перед оплатой. */
  const [checkout, setCheckout] = useState<AiPlan | null>(null);
  /* Предварительный ориентир после подтверждения анкеты — шаг веба
     (`clAIPreview`) между разбором ответов и оформлением. Без него
     человек подтверждал анкету и возвращался к списку наборов, так и
     не увидев, что из его ответов получилось. */
  const [preview, setPreview] = useState<AiPlan | null>(null);
  const [quote, setQuote] = useState<{ percent: number; total_kop: number;
    discount_kop: number; code: string } | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<AiState>('/client/ai')
      .then(r => {
        setD(r); setErr(null);
        /* Пришли с подтверждения анкеты — показываем ориентир сразу,
           как только есть данные. Открываем здесь, а не отдельным
           эффектом: лишний проход отрисовки ради одного флага не нужен. */
        if (params.preview === '1') {
          setPreview((params.plan as AiPlan) || 'both');
          router.setParams({ preview: undefined });
        }
      })
      .catch(e => setErr(e?.message ?? 'Не открылось'));
  }, [params.preview, params.plan]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* Чего не хватает для этого набора: сначала анкеты, потом сверка того,
     как AI их понял. Решает всё равно сервер — экран лишь не ведёт
     человека в отказ. */
  const missing = useCallback((plan: AiPlan): 'nutrition' | 'fitness' | null => {
    if (!d) return null;
    if ((plan === 'nutrition' || plan === 'both') && !d.nutrition_ready) return 'nutrition';
    if ((plan === 'workouts' || plan === 'both') && !d.fitness_ready) return 'fitness';
    return null;
  }, [d]);

  /* Проверяем до покупки: сервер считает цену сам и возвращает её — так
     человек видит, что код сработал, прежде чем платить. */
  const check = useCallback(async (plan: AiPlan) => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setCodeErr(null);
    try {
      const r = await api<{ percent: number; total_kop: number;
        discount_kop: number; code: string }>('/client/ai/promo',
        { method: 'POST', body: { plan, code: c } });
      haptic.success(); setQuote(r);
    } catch (e: any) {
      haptic.error(); setQuote(null);
      setCodeErr(e?.message ?? 'Код не подошёл');
    }
  }, [code]);

  /* Выбор набора: сначала недостающая анкета, потом разбор условий, и
     только после него оплата — тот же порядок, что `clAIBuy` в вебе.
     Раньше нажатие сразу оформляло набор, а экран до этого показывал
     анкету как первое действие. */
  const connect = useCallback((plan: AiPlan) => {
    const need = missing(plan);
    if (need === 'nutrition') {
      haptic.tap();
      router.push({ pathname: '/ai-nutrition', params: { plan } });
      return;
    }
    if (need === 'fitness') {
      haptic.tap();
      router.push({ pathname: '/ai-fitness', params: { plan } });
      return;
    }
    haptic.tap();
    setCode(''); setQuote(null); setCodeErr(null);
    setCheckout(plan);
  }, [missing]);

  /* Оформление: подтверждение из шторки. */
  const buy = useCallback(async (plan: AiPlan) => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ pay?: { confirmation_url?: string } }>('/client/ai',
        { method: 'POST', body: { plan, ...(quote?.code ? { promo_code: quote.code } : {}) } });
      /* Живой эквайер отдаёт веб-ссылку. Открываем её системной
         браузерной шторкой: на iOS это Safari View Controller, поэтому
         оплата остаётся веб-сценарием, а пользователь не теряет
         контекст приложения. После закрытия шторки перечитываем
         состояние с сервера — webhook эквайера мог уже активировать
         подписку. */
      if (r.pay?.confirmation_url) {
        setCheckout(null);
        haptic.tap();
        await WebBrowser.openBrowserAsync(r.pay.confirmation_url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          enableBarCollapsing: true,
        });
        await load();
      } else {
        haptic.success();
        toast('EQUA AI подключён', { sub: 'собираем ваш план' });
      }
      load();
    } catch (e: any) {
      haptic.error();
      /* Сервер различает, чего не хватает, — ведём туда, а не показываем
         отказ как ошибку. */
      const m = String(e?.message ?? '');
      if (/вопросы о питании/i.test(m)) router.push({ pathname: '/ai-nutrition', params: { plan } });
      else if (/вопросы о тренировк/i.test(m)) router.push({ pathname: '/ai-fitness', params: { plan } });
      else if (/подтвердите/i.test(m)) router.push({ pathname: '/ai-intake', params: { plan } });
      else setErr(m || 'Не получилось подключить');
    } finally { setBusy(false); setCheckout(null); }
  }, [load, toast, quote]);

  /* Разрешение учитывать цикл. Хранится в настройках цикла — тем же
     полем, что правит веб. */
  const setCycleAccess = useCallback(async (on: boolean) => {
    haptic.select();
    try {
      await api('/client/health/cycle/settings', {
        method: 'PATCH', body: { ai_cycle_access: on },
      });
      await load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось изменить доступ'); }
  }, [load]);

  const openWebPaymentTest = useCallback(async () => {
    haptic.tap();
    setErr(null);
    try {
      const bridge = await api<{ url: string }>('/auth/web-session', {
        method: 'POST',
        body: { target: 'billing' },
      });
      await WebBrowser.openBrowserAsync(bridge.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        enableBarCollapsing: true,
      });
      await load();
    } catch (e: any) {
      haptic.error();
      setErr(e?.message ?? 'Не удалось открыть веб-кабинет');
    }
  }, [load]);

  const cancel = useCallback(() => {
    Alert.alert('Отключить EQUA AI?',
      'Доступ останется до конца оплаченного срока, продления не будет.', [
      { text: 'Оставить', style: 'cancel' },
      {
        text: 'Отключить', style: 'destructive',
        onPress: async () => {
          try {
            await api('/client/ai/cancel', { method: 'POST', body: {} });
            haptic.success(); toast('Продление отключено'); load();
          } catch (e: any) {
            haptic.error(); setErr(e?.message ?? 'Не получилось');
          }
        },
      },
    ]);
  }, [load, toast]);

  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back title="EQUA AI" />
        {err ? <Muted style={{ padding: S.lg }}>{err}</Muted>
          : <ActivityIndicator color={p.accent} style={{ marginTop: 40 }} />}
      </View>
    );
  }

  const conflict = d.specialist_conflict ?? [];
  const cur = d.current;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title="EQUA AI" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, paddingHorizontal: S.lg, paddingTop: S.sm }}>
            {err}
          </Text>
        ) : null}

        {/* ---------------------------------------------- уже подключено */}
        {cur ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ paddingHorizontal: S.lg, paddingTop: S.md }}>
            <Card>
              <Label>Подключено</Label>
              <Text style={{ ...FONT.h2, color: p.text, marginTop: 2 }}>{cur.title}</Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: S.md,
                paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: p.ov2,
              }}>
                <Icon name="clock" size={16}
                  color={cur.days_left <= 3 ? p.danger : cur.days_left <= 7 ? p.warn : p.accent}
                  width={1.8} />
                <Text style={{ ...FONT.body, fontWeight: '600', color: p.text }}>
                  {cur.days_left} {plural(cur.days_left, ['день', 'дня', 'дней'])} до {dmy(cur.expires_at)}
                </Text>
              </View>
              {cur.is_free ? (
                <Muted style={{ marginTop: S.md }}>
                  Доступ выдан без оплаты — платежи ещё не подключены.
                </Muted>
              ) : null}
            </Card>

            <View style={{ gap: S.md, marginTop: S.md }}>
              <SysButton label="Открыть чат с EQUA AI" icon="sparkles" variant="prominent"
                onPress={() => { haptic.tap(); router.push('/ai-chat'); }} />
              <SysButton label="Проверить, как идёт план" icon="chart.line.uptrend.xyaxis"
                onPress={() => { haptic.tap(); router.push('/ai-review'); }} />
              <SysButton label="Управление подпиской" icon="coin"
                onPress={openWebPaymentTest} />
              {/* Отсюда — сразу в то, что модель собрала. В вебе эти две
                  кнопки стоят рядом с проверкой плана: человек пришёл
                  посмотреть на результат, а не на описание набора. */}
              {(d.plans ?? []).some(x => x.kind === 'menu') ? (
                <SysButton label="Меню на сегодня" icon="fork.knife"
                  onPress={() => { haptic.tap(); router.push('/client'); }} />
              ) : null}
              {(d.plans ?? []).some(x => x.kind !== 'menu') ? (
                <SysButton label="Мои тренировки" icon="figure.strengthtraining.traditional"
                  onPress={() => { haptic.tap(); router.push('/client/workouts'); }} />
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {/* ------------------------------------------- что собрано моделью */}
        {cur && d.plans?.length ? (
          <>
            <ListHead>Что собрано</ListHead>
            <ListGroup>
              {d.plans.map((x, i) => (
                <ListRow key={`${x.kind}-${i}`} first={i === 0}
                  label={x.kind === 'menu' ? 'Меню' : 'Программа тренировок'}
                  value={x.period_from ? `${dmy(x.period_from)} — ${dmy(x.period_to)}` : dmy(x.created_at)} />
              ))}
            </ListGroup>
          </>
        ) : null}

        {/* Чем модель руководствовалась. Сервер отдаёт это в `note`
            каждого плана, и в вебе объяснение стоит прямо под составом —
            в приложении его не было, и план выглядел взявшимся ниоткуда. */}
        {cur && (d.plans ?? []).some(x => x.note) ? (
          <View style={{ paddingHorizontal: S.lg, paddingTop: S.md, gap: S.sm }}>
            {(d.plans ?? []).filter(x => x.note).map((x, i) => (
              <Card key={`note-${i}`}>
                <Label>
                  {x.kind === 'menu' ? 'Почему такое меню' : 'Почему такая программа'}
                </Label>
                <Text style={{ ...FONT.body, color: p.text2, marginTop: 6, lineHeight: 20 }}>
                  {x.kind === 'menu'
                    ? String(x.note).replace(/^Меню на месяц/u, 'Текущее меню')
                    : x.note}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Учитывать ли цикл в адаптации — решает клиент. Это его данные,
            и доступ он открывает отдельно; в приложении спросить было
            негде, хотя сервер поле принимает. */}
        {cur && d.cycle_context?.enabled ? (
          <View style={{ paddingHorizontal: S.lg, paddingTop: S.md }}>
            <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.md }}>
              <Icon name="cal" size={19} width={1.8}
                color={d.cycle_context.allowed ? CYCLE : p.text3} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Label>Цикл и самочувствие</Label>
                <Text style={{ ...FONT.h3, color: p.text, marginTop: 2 }}>
                  {d.cycle_context.allowed
                    ? 'EQUA AI учитывает ваш ритм'
                    : 'Разрешить учитывать в адаптации'}
                </Text>
                <Muted style={{ marginTop: 4, lineHeight: 18 }}>
                  {d.cycle_context.allowed
                    ? `${d.cycle_context.phase || 'Текущий этап'} — модель смотрит на фазу, когда правит нагрузку и меню.`
                    : 'Модель сможет смягчать нагрузку и менять меню по фазе. Данные остаются у вас.'}
                </Muted>
              </View>
              <Switch value={!!d.cycle_context.allowed} onValueChange={setCycleAccess}
                trackColor={{ true: p.primary, false: p.inset }}
                thumbColor={p.name === 'light' ? '#FFFFFF' : undefined} />
            </Card>
          </View>
        ) : null}

        {/* ------------------------------------------------- что мешает */}
        {conflict.length ? (
          <View style={{ paddingHorizontal: S.lg, paddingTop: S.lg }}>
            <Card style={{ borderColor: p.warn, borderWidth: 1 }}>
              <Label>Сначала завершите работу со специалистом</Label>
              <Text style={{ ...FONT.body, color: p.text2, marginTop: 6, lineHeight: 20 }}>
                EQUA AI — замена личному сопровождению, а не дополнение к нему.
                У вас работает {conflict.map(c => c.name).join(', ')}.
              </Text>
              <View style={{ marginTop: S.md }}>
                <SysButton label="К моим специалистам"
                  onPress={() => { haptic.tap(); router.push('/specialist'); }} />
              </View>
            </Card>
          </View>
        ) : null}

        {/* ------------------------------------------------------ наборы */}
        {!cur || d.upgrade ? (
          <>
            <ListHead>{cur ? 'Добрать второй набор' : 'Наборы'}</ListHead>
            {d.welcome_offer?.eligible ? (
              <View style={{ paddingHorizontal: S.lg, paddingBottom: S.sm }}>
                <Muted>
                  Скидка {d.welcome_offer.percent}% действует первые сутки после регистрации.
                </Muted>
              </View>
            ) : null}
            <View style={{ paddingHorizontal: S.lg, gap: S.sm }}>
              {(cur && d.upgrade
                ? [{ plan: d.upgrade.to, title: d.upgrade.title, price_kop: d.upgrade.price_kop }]
                : d.tariffs
              ).map(t => {
                const m = AI_PACK[t.plan] ?? AI_PACK.both;
                const free = d.payments_mode === 'off' || t.price_kop === 0;
                const off = d.welcome_offer?.eligible ? d.welcome_offer.percent : 0;
                return (
                  <Pressable key={t.plan}
                    disabled={busy || conflict.length > 0}
                    onPress={() => connect(t.plan)}>
                    {({ pressed }) => (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: S.md,
                        backgroundColor: p.surface, borderRadius: R.lg, padding: S.lg,
                        borderWidth: t.plan === 'both' ? 2 : 1,
                        borderColor: t.plan === 'both' ? p.primary : p.border,
                        opacity: conflict.length > 0 ? 0.5 : pressed ? 0.85 : 1,
                      }}>
                        <View style={{
                          width: 42, height: 42, borderRadius: 21,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: p.primarySoft,
                        }}>
                          <Icon name={m.icon} size={19} color={p.accent} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ ...FONT.caption, color: p.text3 }}>{m.kicker}</Text>
                            {t.plan === 'both' ? (
                              <Text style={{ ...FONT.caption, color: p.accent, fontWeight: '700' }}>
                                Рекомендуем
                              </Text>
                            ) : null}
                          </View>
                          <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={2}>
                            {cur && d.upgrade ? t.title : m.title}
                          </Text>
                          <Text style={{ ...FONT.small, color: p.text2, marginTop: 1 }}
                            numberOfLines={2}>{m.desc}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ ...FONT.h3, color: p.text }}>
                            {free ? 'Бесплатно' : rub(offerPrice(t.price_kop, off))}
                          </Text>
                          <Text style={{ ...FONT.caption, color: p.text3 }}>
                            {off && !free ? `−${off}%` : '30 дней'}
                          </Text>
                        </View>
                        <Icon name="chevr" size={14} color={p.text3} width={2} />
                      </View>
                    )}
                  </Pressable>
                );
              })}

              {/* Что это стоит — одной строкой под списком, как в вебе. */}
              <Muted style={{ marginTop: S.sm }}>
                {d.payments_mode === 'off'
                  ? 'Сейчас EQUA AI доступен бесплатно. После подключения платёжного шлюза здесь появится стоимость.'
                  : 'Оплата разовая на 30 дней. Автопродления нет.'}
              </Muted>
              {__DEV__ ? (
                <View style={{ marginTop: S.md }}>
                  <SysButton
                    label="Проверить веб-оплату"
                    icon="device"
                    onPress={openWebPaymentTest}
                  />
                  <Muted style={{ marginTop: 6 }}>
                    Тестовый режим: откроется страница управления подпиской EQUA AI.
                  </Muted>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {/* --------------------------------------------------- анкеты */}
        <ListHead>Ваши ответы</ListHead>
        <ListGroup>
          <ListRow first icon="bowl" label="Про питание"
            value={d.nutrition_ready ? 'заполнено' : 'нет ответов'}
            onPress={() => { haptic.tap(); router.push('/ai-nutrition'); }} />
          <ListRow icon="dumbbell" label="Про тренировки"
            value={d.fitness_ready ? 'заполнено' : 'нет ответов'}
            onPress={() => { haptic.tap(); router.push('/ai-fitness'); }} />
        </ListGroup>

        {!d.has_model ? (
          <View style={{ paddingHorizontal: S.lg, paddingTop: S.lg }}>
            <Muted>
              Модель сейчас недоступна — план собирается по правилам сервиса,
              без неё. Это временно.
            </Muted>
          </View>
        ) : null}

        {cur ? (
          <View style={{ paddingHorizontal: S.lg, paddingTop: S.xl }}>
            <SysButton label="Отключить продление" variant="destructive" onPress={cancel} />
          </View>
        ) : null}

        {!cur && !d.tariffs?.length ? (
          <Empty icon="sparkles" title="Наборы недоступны"
            note="Сейчас EQUA AI нельзя подключить. Попробуйте позже." />
        ) : null}
      </ScrollView>

      {/* Разбор набора перед оплатой — шторка `clAICheckout` веба: что
          входит, срок доступа, цена, промокод и оговорки. До этого
          человек нажимал «Подключить» и попадал прямо на оплату, не
          увидев условий. */}
      <AiPreview
        plan={preview} state={d}
        onClose={() => setPreview(null)}
        onNext={pl => { setPreview(null); setCode(''); setQuote(null); setCodeErr(null); setCheckout(pl); }} />

      <AiCheckout
        plan={checkout} state={d} busy={busy}
        code={code} quote={quote} codeErr={codeErr}
        onCode={t => { setCode(t.toUpperCase()); setCodeErr(null); setQuote(null); }}
        onCheck={check}
        onClose={() => setCheckout(null)}
        onBuy={buy} />
    </View>
  );
}


/** Шторка оформления набора: условия до оплаты, а не после. */
function AiCheckout({ plan, state, busy, code, quote, codeErr, onCode, onCheck, onClose, onBuy }: {
  plan: AiPlan | null;
  state: AiState | null;
  busy: boolean;
  code: string;
  quote: { percent: number; total_kop: number; discount_kop: number; code: string } | null;
  codeErr: string | null;
  onCode: (t: string) => void;
  onCheck: (plan: AiPlan) => void;
  onClose: () => void;
  onBuy: (plan: AiPlan) => void;
}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  if (!plan || !state) return null;

  const m = AI_PACK[plan] ?? AI_PACK.both;
  const t = state.tariffs.find(x => x.plan === plan);
  const kop = t?.price_kop ?? 0;
  const free = state.payments_mode === 'off' || kop === 0;
  const percent = state.welcome_offer?.eligible ? state.welcome_offer.percent : 0;
  const now = quote ? quote.total_kop : offerPrice(kop, percent);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(9,16,18,0.6)' }} />
      <Animated.View entering={SlideInDown.duration(280)} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%',
        backgroundColor: p.surface,
        borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
        paddingBottom: insets.bottom + S.lg,
      }}>
        <View style={{
          width: 38, height: 4, borderRadius: 999, backgroundColor: p.border,
          alignSelf: 'center', marginTop: 10, marginBottom: S.sm,
        }} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: S.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.md }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...FONT.caption, color: p.text3 }}>{m.eyebrow}</Text>
              <Text style={{ ...FONT.h2, color: p.text, marginTop: 2 }}>{m.head}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}
              accessibilityRole="button" accessibilityLabel="Закрыть"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingTop: 4 })}>
              <Icon name="close" size={18} color={p.text3} />
            </Pressable>
          </View>

          <Text style={{ ...FONT.body, color: p.text2, marginTop: S.md, lineHeight: 22 }}>
            {m.lead}
          </Text>

          <View style={{ marginTop: S.xl }}>
            <Label>Что входит в план</Label>
          </View>
          <View style={{ gap: 7, marginTop: S.sm }}>
            {m.items.map(x => (
              <View key={x} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
                <Icon name="check" size={14} color={p.accent} width={2.2} />
                <Text style={{ ...FONT.small, color: p.text2, flex: 1, lineHeight: 19 }}>{x}</Text>
              </View>
            ))}
          </View>

          <View style={{
            flexDirection: 'row', alignItems: 'center', marginTop: S.xl,
            backgroundColor: p.inset, borderRadius: R.lg, padding: S.lg,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...FONT.caption, color: p.text3 }}>Ваш доступ</Text>
              <Text style={{ ...FONT.h3, color: p.text }}>30 дней</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {!free && (percent || quote) ? (
                <Text style={{ ...FONT.small, color: p.text3,
                  textDecorationLine: 'line-through' }}>{rub(kop)}</Text>
              ) : null}
              <Text style={{ ...FONT.h2, color: p.text }}>
                {free ? 'Бесплатно' : rub(now)}
              </Text>
            </View>
          </View>

          {!free && percent ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: S.md,
              backgroundColor: p.primarySoft, borderRadius: R.md, padding: S.md,
            }}>
              <Icon name="clock" size={15} color={p.accent} />
              <Text style={{ ...FONT.small, color: p.text, flex: 1 }}>
                Скидка {percent}% для нового клиента уже применена
              </Text>
            </View>
          ) : null}

          {!free ? (
            <View style={{ marginTop: S.lg }}>
              <Label>Промокод, если есть</Label>
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                <TextInput value={code} onChangeText={onCode}
                  placeholder="Например, START20" placeholderTextColor={p.text3}
                  autoCapitalize="characters" maxLength={24}
                  style={{
                    flex: 1, backgroundColor: p.inset, color: p.text,
                    borderRadius: R.control, paddingHorizontal: S.lg,
                    paddingVertical: 11, fontSize: 15, letterSpacing: 1,
                  }} />
                <Pressable onPress={() => onCheck(plan)} disabled={!code.trim()}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16, justifyContent: 'center',
                    borderRadius: R.control, borderWidth: 1, borderColor: p.btnLine,
                    opacity: !code.trim() ? 0.4 : pressed ? 0.6 : 1,
                  })}>
                  <Text style={{ ...FONT.callout, color: p.text }}>Применить</Text>
                </Pressable>
              </View>
              {quote ? (
                <Text style={{ ...FONT.small, color: p.accent, marginTop: 6 }}>
                  Код принят: −{quote.percent}%, к оплате {rub(quote.total_kop)}
                </Text>
              ) : null}
              {codeErr ? (
                <Text style={{ ...FONT.small, color: p.danger, marginTop: 6 }}>{codeErr}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: S.lg }}>
            <Icon name="check" size={14} color={p.text3} width={2} />
            <Text style={{ ...FONT.small, color: p.text3, flex: 1, lineHeight: 19 }}>
              Без автопродления. Все изменения плана сначала показываются вам.
              EQUA AI и сопровождение живого специалиста одновременно не подключаются.
            </Text>
          </View>

          <View style={{ marginTop: S.xl, gap: S.sm }}>
            <SysButton label={free ? 'Создать мой план' : 'Перейти к оплате'}
              variant="prominent" disabled={busy} onPress={() => onBuy(plan)} />
            <SysButton label="Вернуться к вариантам" onPress={onClose} />
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/** Предварительный ориентир: что получилось из ответов, до оплаты. */
function AiPreview({ plan, state, onClose, onNext }: {
  plan: AiPlan | null;
  state: AiState | null;
  onClose: () => void;
  onNext: (plan: AiPlan) => void;
}) {
  const { p, me } = useApp();
  const insets = useSafeAreaInsets();
  if (!plan || !state) return null;

  const u = me?.user;
  const hasFood = plan !== 'workouts';
  const hasGym = plan !== 'nutrition';
  const f = state.fitness ?? {};
  const title = plan === 'both' ? 'Ваша система готова к созданию'
    : plan === 'nutrition' ? 'Основа вашего питания готова'
    : 'Основа программы готова';

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(9,16,18,0.6)' }} />
      <Animated.View entering={SlideInDown.duration(280)} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%',
        backgroundColor: p.surface,
        borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
        paddingBottom: insets.bottom + S.lg,
      }}>
        <View style={{
          width: 38, height: 4, borderRadius: 999, backgroundColor: p.border,
          alignSelf: 'center', marginTop: 10, marginBottom: S.sm,
        }} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: S.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.md }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...FONT.caption, color: p.text3 }}>ПРЕДВАРИТЕЛЬНЫЙ РЕЗУЛЬТАТ</Text>
              <Text style={{ ...FONT.h2, color: p.text, marginTop: 2 }}>{title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}
              accessibilityRole="button" accessibilityLabel="Закрыть"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingTop: 4 })}>
              <Icon name="close" size={18} color={p.text3} />
            </Pressable>
          </View>

          <Text style={{ ...FONT.body, color: p.text2, marginTop: S.md, lineHeight: 22 }}>
            EQUA уже учла вашу цель, режим и ограничения. После оформления доступа AI
            соберёт конкретные блюда{hasGym ? ' и тренировки' : ''} и покажет их до начала работы.
          </Text>

          {hasFood ? (
            <View style={{
              marginTop: S.lg, backgroundColor: p.inset,
              borderRadius: R.lg, padding: S.lg,
            }}>
              <Text style={{ ...FONT.caption, color: p.text3 }}>Ориентир на день</Text>
              <Text style={{ ...FONT.num, color: p.text, marginTop: 2 }}>
                {u?.target_kcal ?? 1800} ккал
              </Text>
              <View style={{ flexDirection: 'row', gap: S.lg, marginTop: S.md }}>
                {([['Белки', u?.target_protein ?? 110, p.mp],
                   ['Жиры', u?.target_fat ?? 60, p.mf],
                   ['Углеводы', u?.target_carbs ?? 190, p.mc]] as const).map(([k, v, c]) => (
                  <View key={k}>
                    <Text style={{ ...FONT.caption, color: p.text3 }}>{k}</Text>
                    <Text style={{ ...FONT.h3, color: c }}>{v} г</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {hasGym ? (
            <View style={{
              marginTop: S.md, backgroundColor: p.inset,
              borderRadius: R.lg, padding: S.lg,
            }}>
              <Text style={{ ...FONT.caption, color: p.text3 }}>Объём тренировок</Text>
              <Text style={{ ...FONT.h3, color: p.text, marginTop: 2 }}>
                {f.days_per_week ?? 3} {plural(Number(f.days_per_week ?? 3), ['день', 'дня', 'дней'])} в неделю
              </Text>
              <Muted style={{ marginTop: 2 }}>
                по {f.session_minutes ?? 45} минут · {f.goal || u?.goal || 'под вашу цель'}
              </Muted>
            </View>
          ) : null}

          <View style={{ marginTop: S.lg }}>
            <Label>Что произойдёт дальше</Label>
            <View style={{ gap: 7, marginTop: S.sm }}>
              {['Составим план из базы EQUA',
                'Покажем порции, нагрузку и объяснение',
                'Будем предлагать адаптацию по результатам'].map(x => (
                <View key={x} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
                  <Icon name="check" size={14} color={p.accent} width={2.2} />
                  <Text style={{ ...FONT.small, color: p.text2, flex: 1, lineHeight: 19 }}>{x}</Text>
                </View>
              ))}
            </View>
          </View>

          <Muted style={{ marginTop: S.lg, lineHeight: 18 }}>
            Это предварительные ориентиры. Итоговый план не заменяет медицинскую
            консультацию и меняется только с вашего согласия.
          </Muted>

          <View style={{ marginTop: S.xl, gap: S.sm }}>
            <SysButton label="Продолжить" variant="prominent" onPress={() => onNext(plan)} />
            <SysButton label="Поправить ответы"
              onPress={() => {
                onClose();
                router.push({
                  pathname: plan === 'workouts' ? '/ai-fitness' : '/ai-nutrition',
                  params: { plan },
                });
              }} />
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}