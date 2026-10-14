import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useApp } from '../store';
import { api, Specialist, CatalogSpecialist, SPEC_ROLES } from '../api';
import { plural, rub } from '../format';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted, Pills } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton, SysConfirm, Empty } from '../ui/system';
import { haptic } from '../haptics';
import { useToast } from '../ui/Toast';
import { Loading } from './Shopping';
import { SpecCard, Face, VerifiedMark } from '../ui/SpecCard';

type Prof = '' | 'nutritionist' | 'trainer' | 'endocrinologist' | 'coach';
const FAV_KEY = 'nm_fav_sp';

const TITLES: Record<Prof, string> = {
  '': 'Специалисты', nutritionist: 'Нутрициологи', trainer: 'Тренеры',
  endocrinologist: 'Эндокринологи', coach: 'Коучи',
};
const NOUNS: Record<Prof, [string, string, string]> = {
  '': ['специалист', 'специалиста', 'специалистов'],
  nutritionist: ['нутрициолог', 'нутрициолога', 'нутрициологов'],
  endocrinologist: ['эндокринолог', 'эндокринолога', 'эндокринологов'],
  trainer: ['тренер', 'тренера', 'тренеров'],
  coach: ['коуч', 'коуча', 'коучей'],
};

export default function MySpecialist() {
  const { p, refreshMe } = useApp();
  const insets = useSafeAreaInsets();
  const [spec, setSpec] = useState<Specialist | null | undefined>(undefined);
  const [list, setList] = useState<CatalogSpecialist[]>([]);
  const [code, setCode] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* Фильтры каталога. Каталог приходит одним запросом, поэтому
     отбираем на месте: ходить на сервер на каждое нажатие незачем. */
  const [prof, setProf] = useState<Prof>('');
  const [q, setQ] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  /* Фильтры каталога из веба: город, рейтинг не ниже, проверенный паспорт. */
  const [city, setCity] = useState('');
  const [minRate, setMinRate] = useState(0);
  const [passport, setPassport] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /* Скидка новым клиентам и сколько её осталось. */
  const [offer, setOffer] = useState<{ percent: number; left: number } | null>(null);
  useEffect(() => {
    if (!offer || offer.left <= 0) return;
    const t = setInterval(() => {
      setOffer(o => (o && o.left > 1 ? { ...o, left: o.left - 1 } : null));
    }, 1000);
    return () => clearInterval(t);
  }, [offer]);
  /* Избранное живёт в телефоне, а не на сервере: это закладка
     «вернуться и подумать», и специалисту незачем знать, кто его
     рассматривал. */
  const [fav, setFav] = useState<number[]>([]);
  const toast = useToast();
  const [mine, setMine] = useState<Specialist[]>([]);
  const [credit, setCredit] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await api<{ specialist: Specialist | null; specialists?: Specialist[];
        credit_kop?: number }>('/client/my-specialist');
      /* Специалистов может быть несколько — нутрициолог, тренер,
         эндокринолог. Поле `specialist` сервер оставил для старых
         сборок, список лежит рядом. AI сюда не попадает: у него своя
         строка в «Ещё». */
      setMine((r.specialists ?? []).filter(x => !x.is_ai));
      setCredit(Number(r.credit_kop ?? 0));
      setSpec(r.specialist);
      if (!r.specialist) {
        const c = await api<{ specialists: CatalogSpecialist[] }>('/catalog');
        setList(c.specialists ?? []);
        /* Предложение новым клиентам — то же, что в вебе над каталогом
           (`clMaybeWelcomeOffer`). Там это всплывающее окно; здесь —
           строка над списком: окно поверх каталога сразу после загрузки
           на телефоне читается как реклама, а не как предложение, и
           закрывается не глядя. Таймер тот же. */
        api<{ welcome_offer?: { eligible?: boolean; percent?: number; seconds_left?: number } }>('/client/ai')
          .then(a => {
            const o = a.welcome_offer;
            if (o?.eligible) setOffer({ percent: Number(o.percent) || 20, left: Number(o.seconds_left) || 0 });
          })
          .catch(() => {});
      }
    } catch (e: any) { setErr(e.message); setSpec(null); }
  }, []);
  /* Завершить работу: доступ закрывается, роль освобождается, остаток
     уходит в зачёт следующей оплаты. В приложении этого не было вовсе —
     уйти от специалиста можно было только с сайта. */
  const endWork = useCallback(async (id: number) => {
    try {
      const r = await api<{ refund_kop?: number }>(`/client/specialists/${id}/end`,
        { method: 'POST' });
      haptic.success();
      toast(Number(r.refund_kop) > 0
        ? `${rub(Number(r.refund_kop))} в зачёт`
        : 'Работа завершена');
      await load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не получилось'); }
  }, [load, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY)
      .then(v => { try { const a = JSON.parse(v ?? '[]'); if (Array.isArray(a)) setFav(a.map(Number)); } catch { /* пусто */ } })
      .catch(() => { /* нет доступа к хранилищу — живём без закладок */ });
  }, []);
  const toggleFav = useCallback((id: number) => {
    setFav(cur => {
      const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
      AsyncStorage.setItem(FAV_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /* Выбрали специалиста — показываем его услуги: это следующий шаг в
     разговоре, а не отдельная тема, за которой надо идти в «Ещё».
     Услуг нет — оставляем человека здесь, пустой прайс никому не нужен. */
  const toServices = useCallback(async () => {
    try {
      const r = await api<{ services?: unknown[] }>('/client/services');
      if ((r.services ?? []).length) { router.push('/services'); return true; }
    } catch { /* не дошло — не беда, экран уже показывает специалиста */ }
    return false;
  }, []);

  const connect = useCallback(async (body: object) => {
    setBusy(true); setErr(null);
    try {
      await api('/client/connect', { method: 'POST', body });
      haptic.success();
      await refreshMe();
      await load();
      await toServices();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось подключиться'); }
    finally { setBusy(false); }
  }, [refreshMe, load, toServices]);

  const byCode = useCallback(async () => {
    const c = code.trim().toUpperCase();
    if (!c) { setErr('Введите код специалиста'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/client/connect-code', { method: 'POST', body: { code: c } });
      haptic.success();
      await refreshMe();
      await load();
      await toServices();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Код не подошёл'); }
    finally { setBusy(false); }
  }, [code, refreshMe, load, toServices]);

  /* Отбор тот же, что в вебе (`clCatalogPaint`): роль, избранные, поиск,
     плюс город, нижняя граница рейтинга и проверенный паспорт. */
  const rows = useMemo(() => list.filter(s => {
    if (prof && (s.profession ?? 'nutritionist') !== prof) return false;
    if (onlyFav && !fav.includes(s.id)) return false;
    if (passport && !s.identity_verified) return false;
    if (minRate && (Number(s.rating) || 0) < minRate) return false;
    if (city && (s.city ?? '') !== city) return false;
    if (q.trim()) {
      const hay = [s.name, s.city, s.bio, s.specializations]
        .concat((s.services ?? []).map(v => v.title)).join(' ').toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [list, prof, onlyFav, fav, q, passport, minRate, city]);

  /* Сколько фильтров включено — число на кнопке, чтобы спрятанный
     отбор не был незаметным. */
  const picks = (city ? 1 : 0) + (minRate ? 1 : 0) + (passport ? 1 : 0);

  /* Города берём из самого каталога: справочника городов нет, и
     показывать пустые варианты незачем — в вебе так же (`catCities`). */
  const cities = useMemo(() => {
    const set = new Set<string>();
    list.forEach(s => { if (s.city) set.add(s.city); });
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [list]);

  if (spec === undefined) return <Loading title="Мои специалисты" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={spec ? 'Мои специалисты' : TITLES[prof]} back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
      }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text>
        ) : null}

        {spec ? (
          <Animated.View entering={FadeIn.duration(240)} style={{ marginTop: S.md }}>
            {/* Остаток за незавершённые услуги: он спишется сам, но знать
                о нём человек должен заранее — как в вебе. */}
            {credit > 0 ? (
              <Card style={{ marginBottom: S.md, flexDirection: 'row',
                alignItems: 'flex-start', gap: S.md }}>
                <Icon name="coin" size={19} color={p.accent} width={1.8} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...FONT.h3, color: p.text }}>{rub(credit)} в зачёт</Text>
                  <Muted style={{ marginTop: 2, lineHeight: 18 }}>
                    Остаток за незавершённые услуги. Спишется со следующей оплаты —
                    ничего делать не нужно.
                  </Muted>
                </View>
              </Card>
            ) : null}

            {/* Три роли подряд: занятая — карточкой со специалистом,
                свободная — приглашением найти. В приложении был виден
                только один человек, и о том, что ролей три, узнать было
                неоткуда. */}
            {SPEC_ROLES.map(([role, label, note, ic]) => {
              const s = mine.find(x => (x.role ?? 'nutritionist') === role);
              if (s) {
                return (
                  <Card key={role} style={{ marginBottom: S.sm, flexDirection: 'row',
                    alignItems: 'center', gap: S.md }}>
                    <Face url={s.avatar_url} name={s.name} size={46} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={1}>
                          {s.name}
                        </Text>
                        {s.verified ? <VerifiedMark compact /> : null}
                      </View>
                      <Muted numberOfLines={1}>
                        {label}{s.has_nutrition ? ' · ведёт питание' : ''}
                      </Muted>
                    </View>
                    <Pressable hitSlop={8}
                      onPress={() => { haptic.tap(); router.push(`/chat/${s.id}` as any); }}
                      style={({ pressed }) => ({
                        width: 38, height: 38, borderRadius: 19, alignItems: 'center',
                        justifyContent: 'center', backgroundColor: p.inset,
                        opacity: pressed ? 0.7 : 1,
                      })}>
                      <Icon name="chat" size={17} color={p.text2} width={1.8} />
                    </Pressable>
                    {/* Завершить работу можно было только на сайте. */}
                    <SysConfirm
                      label="Завершить"
                      title={`Завершить работу с «${s.name}»?`}
                      message={s.refund_kop
                        ? `Доступ закроется, роль освободится. ${rub(s.refund_kop)} вернётся в зачёт следующей оплаты.`
                        : 'Доступ закроется, роль освободится — можно будет выбрать другого.'}
                      confirmLabel="Завершить"
                      destructive
                      onConfirm={() => endWork(s.id)} />
                  </Card>
                );
              }
              return (
                <Pressable key={role}
                  onPress={() => { haptic.tap(); setProf(role as Prof); setSpec(null); }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, marginBottom: S.sm })}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                    <View style={{
                      width: 46, height: 46, borderRadius: 23, alignItems: 'center',
                      justifyContent: 'center', backgroundColor: p.inset,
                    }}>
                      <Icon name={ic} size={20} color={p.text3} width={1.8} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ ...FONT.h3, color: p.text }}>{label}</Text>
                      <Muted numberOfLines={1}>{note}</Muted>
                    </View>
                    <Icon name="plus" size={18} color={p.text3} width={2} />
                  </Card>
                </Pressable>
              );
            })}

            <View style={{ gap: S.md, marginTop: S.md }}>
              <SysButton label="Услуги и цены" icon="tag"
                onPress={() => { haptic.tap(); router.push('/services'); }} />
            </View>
          </Animated.View>
        ) : (
          <>
            {/* Счётчик над заголовком, как в каталоге на сайте: сначала
                сколько нашлось, потом кого именно показываем. */}
            <Text style={{ ...FONT.small, fontWeight: '600', color: p.text3,
              marginTop: S.md, marginBottom: S.md }}>
              {rows.length} {plural(rows.length, NOUNS[prof])}
            </Text>

            {/* Скидка новым клиентам: заметная строка с обратным отсчётом,
                по нажатию — EQUA AI. */}
            {offer ? (
              <Pressable onPress={() => { haptic.tap(); router.push('/ai'); }}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginBottom: S.md })}>
                <Card style={{ borderWidth: 1.5, borderColor: p.primary, gap: 4 }}>
                  <Text style={{ ...FONT.caption, color: p.text3 }}>
                    Предложение для новых клиентов
                  </Text>
                  <Text style={{ ...FONT.h3, color: p.text }}>
                    EQUA AI со скидкой {offer.percent} %
                  </Text>
                  <Muted>
                    Меню или план тренировок сразу, без ожидания ответа специалиста.
                  </Muted>
                  <Text style={{ ...FONT.small, fontWeight: '700', color: p.accent, marginTop: 2 }}>
                    Действует ещё {clock(offer.left)}
                  </Text>
                </Card>
              </Pressable>
            ) : null}

            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: S.sm,
              backgroundColor: p.surface, borderRadius: R.pill,
              paddingHorizontal: S.lg, marginBottom: S.md,
            }}>
              <Icon name="search" size={16} color={p.text3} />
              <TextInput value={q} onChangeText={setQ}
                placeholder="Имя, город или специализация"
                placeholderTextColor={p.text3}
                style={{ flex: 1, color: p.text, paddingVertical: 11, fontSize: 14 }} />
              {q ? (
                <Pressable onPress={() => setQ('')} hitSlop={10}
                  accessibilityRole="button" accessibilityLabel="Очистить поиск"
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                  <Icon name="close" size={16} color={p.text3} />
                </Pressable>
              ) : null}
            </View>

            <Pills scroll value={prof} onChange={setProf} style={{ marginBottom: S.sm }}
              items={[['', 'Все'], ['nutritionist', 'Нутрициологи'], ['trainer', 'Тренеры'],
                ['endocrinologist', 'Эндокринологи'], ['coach', 'Коучи']] as [Prof, string][]} />

            <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
              <Pressable onPress={() => { haptic.select(); setOnlyFav(v => !v); }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                  backgroundColor: onlyFav ? p.primary : p.surface,
                  borderWidth: onlyFav ? 0 : 1, borderColor: p.border,
                })}>
                <Icon name="heart" size={14} color={onlyFav ? p.onPrimary : p.text2} />
                <Text style={{ fontSize: 14, fontWeight: onlyFav ? '600' : '400',
                  color: onlyFav ? p.onPrimary : p.text2 }}>Избранные</Text>
              </Pressable>

              {/* Остальные фильтры прячем за одной кнопкой, как в вебе:
                  город, рейтинг и паспорт нужны не каждому входу. */}
              <Pressable onPress={() => { haptic.tap(); setFiltersOpen(v => !v); }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                  backgroundColor: picks ? p.primary : p.surface,
                  borderWidth: picks ? 0 : 1, borderColor: p.border,
                })}>
                <Icon name="search" size={14} color={picks ? p.onPrimary : p.text2} />
                <Text style={{ fontSize: 14, fontWeight: picks ? '600' : '400',
                  color: picks ? p.onPrimary : p.text2 }}>
                  {picks ? `Фильтры · ${picks}` : 'Фильтры'}
                </Text>
              </Pressable>
            </View>

            {filtersOpen ? (
              <Card style={{ marginBottom: S.md, gap: S.sm }}>
                {cities.length ? (
                  <>
                    <Muted>Где нужна</Muted>
                    <Muted style={{ marginTop: -2 }}>
                      Все работают дистанционно. Город — если хотите земляка и один часовой пояс.
                    </Muted>
                    <Pills scroll value={city} onChange={setCity}
                      items={[['', 'Любой город'] as [string, string],
                        ...cities.map(c => [c, c] as [string, string])]} />
                  </>
                ) : null}

                <Muted>Рейтинг не ниже</Muted>
                <Pills value={String(minRate)} onChange={v => setMinRate(Number(v))}
                  items={[['0', 'Любой'], ['4', '4,0'], ['4.5', '4,5'], ['4.8', '4,8']]} />

                <Pressable onPress={() => { haptic.select(); setPassport(v => !v); }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: S.sm,
                    opacity: pressed ? 0.7 : 1, marginTop: S.xs,
                  })}>
                  <View style={{
                    width: 22, height: 22, borderRadius: 7,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: passport ? p.primary : 'transparent',
                    borderWidth: passport ? 0 : 1.5, borderColor: p.btnLine,
                  }}>
                    {passport ? <Icon name="check" size={13} color={p.onPrimary} width={2.6} /> : null}
                  </View>
                  <Text style={{ ...FONT.callout, color: p.text }}>
                    Только с проверенным паспортом
                  </Text>
                </Pressable>

                {picks ? (
                  <Pressable onPress={() => {
                    haptic.tap(); setCity(''); setMinRate(0); setPassport(false);
                  }} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginTop: S.xs })}>
                    <Text style={{ ...FONT.small, fontWeight: '600', color: p.accent }}>
                      Сбросить фильтры
                    </Text>
                  </Pressable>
                ) : null}
              </Card>
            ) : null}

            {/* Ввод кода — строка сразу под фильтрами. Раньше она стояла
                в самом низу: человек с кодом пролистывал ради неё весь
                каталог. Раскрывается по нажатию, чтобы не занимать
                верх экрана полем ввода. */}
            <Pressable onPress={() => { haptic.tap(); setCodeOpen(v => !v); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: S.sm,
                minHeight: 44, paddingHorizontal: S.lg, marginBottom: S.md,
                transform: [{ scale: pressed ? 0.99 : 1 }],
                borderWidth: 1, borderColor: p.border, borderStyle: 'dashed',
                borderRadius: R.lg,
              })}>
              <Icon name="tag" size={16} color={p.accent} />
              <Text style={{ ...FONT.small, fontWeight: '600', color: p.text2, flex: 1 }}>
                У меня есть код от специалиста
              </Text>
              <Icon name="chevr" size={15} color={p.text3} />
            </Pressable>
            {codeOpen ? (
              <Card style={{ marginBottom: S.md }}>
                <Label>Код приглашения</Label>
                <Muted style={{ marginTop: S.sm }}>
                  Специалист может дать код или ссылку-приглашение.
                </Muted>
                <TextInput
                  value={code}
                  onChangeText={t => { setCode(t.toUpperCase()); setErr(null); }}
                  placeholder="240A14"
                  placeholderTextColor={p.text3}
                  autoCapitalize="characters"
                  maxLength={12}
                  style={{
                    marginTop: S.md, backgroundColor: p.inset, color: p.text,
                    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 13,
                    fontSize: 19, fontWeight: '700', letterSpacing: 2,
                  }}
                />
                <View style={{ marginTop: S.md }}>
                  <SysButton label="Подключиться" variant="prominent"
                    disabled={busy} onPress={byCode} />
                </View>
              </Card>
            ) : null}

            {rows.length === 0 ? (
              <View style={{ marginTop: S.lg, alignItems: 'center' }}>
                <Empty icon="person.crop.circle.badge.questionmark"
                  title={list.length ? 'По этим параметрам никого нет' : 'Специалисты скоро появятся'}
                  note={list.length
                    ? 'Измените фильтры или сбросьте часть условий.'
                    : 'Если у вас уже есть специалист, подключитесь по его коду приглашения.'} />
                <View style={{ width: '100%', marginTop: S.md }}>
                  <SysButton label="Ввести код специалиста" icon="tag"
                    onPress={() => { haptic.tap(); setCodeOpen(true); }} />
                </View>
              </View>
            ) : rows.map((s, i) => (
              <Animated.View key={s.id} entering={FadeIn.duration(220)}>
                <SpecCard s={s} busy={busy} fav={fav.includes(s.id)}
                  onFav={() => toggleFav(s.id)}
                  onOpen={() => router.push(s.slug
                    ? `/spec/${s.id}?slug=${encodeURIComponent(s.slug)}`
                    : `/spec/${s.id}`)}
                  onPick={() => connect({ specialist_id: s.id })} />
              </Animated.View>
            ))}

          </>
        )}
      </ScrollView>
    </View>
  );
}

/** «02:14:09» — сколько осталось у предложения, формат веба (`aiOfferClock`). */
function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map(x => String(x).padStart(2, '0')).join(':');
}