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
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { api, AiState, AiPlan, AI_PLAN_WHAT } from '../api';
import { S, R, FONT, CYCLE } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { ListGroup, ListHead, ListRow } from '../ui/List';
import { SysButton, Empty } from '../ui/system';
import { useToast } from '../ui/Toast';
import { rub, plural } from '../format';
import { haptic } from '../haptics';

const dmy = (s?: string | null) => {
  if (!s) return '—';
  const x = String(s).slice(0, 10).split('-');
  return x.length === 3 ? `${x[2]}.${x[1]}.${x[0]}` : String(s);
};

export default function AI() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [d, setD] = useState<AiState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* Промокод спрашиваем только при настоящей оплате: пока платежи
     выключены, набор выдаётся бесплатно, и скидка ни к чему. */
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<{ percent: number; total_kop: number;
    discount_kop: number; code: string } | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<AiState>('/client/ai')
      .then(r => { setD(r); setErr(null); })
      .catch(e => setErr(e?.message ?? 'Не открылось'));
  }, []);
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

  const connect = useCallback(async (plan: AiPlan) => {
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
    setBusy(true); setErr(null);
    try {
      const r = await api<{ pay?: { confirmation_url?: string } }>('/client/ai',
        { method: 'POST', body: { plan, ...(quote?.code ? { promo_code: quote.code } : {}) } });
      /* Живой эквайер отдаёт ссылку на оплату. В приложении её не
         открываем: платежи здесь не проводятся. */
      if (r.pay?.confirmation_url) {
        toast('Оплату нужно пройти на сайте', { sub: 'nutrimenu.ru · раздел EQUA AI', ms: 6000 });
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
    } finally { setBusy(false); }
  }, [missing, load, toast, quote]);

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
            <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
              {(cur && d.upgrade
                ? [{ plan: d.upgrade.to, title: d.upgrade.title, price_kop: d.upgrade.price_kop }]
                : d.tariffs
              ).map(t => {
                const need = missing(t.plan);
                const free = d.payments_mode === 'off' || t.price_kop === 0;
                return (
                  <Card key={t.plan}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.md }}>
                      <Text style={{ ...FONT.h3, color: p.text, flex: 1 }}>{t.title}</Text>
                      <Text style={{ ...FONT.h3, color: p.text }}>
                        {free ? 'бесплатно' : rub(t.price_kop)}
                      </Text>
                    </View>
                    {cur && d.upgrade?.credit_kop ? (
                      <Muted style={{ marginTop: 4 }}>
                        зачтён остаток прежнего набора — {rub(d.upgrade.credit_kop)}
                      </Muted>
                    ) : null}
                    <View style={{ marginTop: S.md, gap: 5 }}>
                      {(AI_PLAN_WHAT[t.plan] ?? []).map(line => (
                        <View key={line} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                          <Icon name="check" size={13} color={p.accent} width={2.2} />
                          <Text style={{ ...FONT.small, color: p.text2, flex: 1, lineHeight: 18 }}>
                            {line}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {/* Поле кода — внутри набора: скидка считается от его
                        цены, и общее поле «на весь экран» давало бы цену,
                        не относящуюся ни к одному из них. */}
                    {!free ? (
                      <View style={{ marginTop: S.md }}>
                        <View style={{ flexDirection: 'row', gap: S.sm }}>
                          <TextInput value={code}
                            onChangeText={t => { setCode(t.toUpperCase()); setCodeErr(null); setQuote(null); }}
                            placeholder="Промокод" placeholderTextColor={p.text3}
                            autoCapitalize="characters" maxLength={24}
                            style={{
                              flex: 1, backgroundColor: p.inset, color: p.text,
                              borderRadius: R.control, paddingHorizontal: S.lg,
                              paddingVertical: 10, fontSize: 15, letterSpacing: 1,
                            }} />
                          <Pressable onPress={() => check(t.plan)} disabled={!code.trim()}
                            style={({ pressed }) => ({
                              paddingHorizontal: 16, justifyContent: 'center',
                              borderRadius: R.control, borderWidth: 1, borderColor: p.btnLine,
                              opacity: !code.trim() ? 0.4 : pressed ? 0.6 : 1,
                            })}>
                            <Text style={{ ...FONT.callout, color: p.text }}>Проверить</Text>
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

                    <View style={{ marginTop: S.lg }}>
                      <SysButton
                        label={need === 'nutrition' ? 'Ответить про питание'
                          : need === 'fitness' ? 'Ответить про тренировки'
                          : free ? 'Подключить' : 'Оформить'}
                        variant="prominent"
                        disabled={busy || conflict.length > 0}
                        onPress={() => connect(t.plan)} />
                    </View>
                    {need ? (
                      <Muted style={{ marginTop: S.sm }}>
                        Перед запуском нужны ответы — несколько вопросов о вас.
                      </Muted>
                    ) : null}
                  </Card>
                );
              })}
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
    </View>
  );
}
