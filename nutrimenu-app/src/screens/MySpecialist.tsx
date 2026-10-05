import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
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

  const rows = useMemo(() => list.filter(s => {
    if (prof && (s.profession ?? 'nutritionist') !== prof) return false;
    if (onlyFav && !fav.includes(s.id)) return false;
    if (q.trim()) {
      const hay = [s.name, s.city, s.bio, s.specializations]
        .concat((s.services ?? []).map(v => v.title)).join(' ').toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [list, prof, onlyFav, fav, q]);

  if (spec === undefined) return <Loading title="Мои специалисты" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={spec ? 'Мои специалисты' : 'Каталог'} back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
      }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text>
        ) : null}

        {spec ? (
          <Animated.View entering={FadeInDown.duration(240)} style={{ marginTop: S.md }}>
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
            <Text style={{ ...FONT.small, fontWeight: '600', color: p.text3, marginTop: S.md }}>
              {rows.length} {plural(rows.length, NOUNS[prof])}
            </Text>
            <Text style={{ ...FONT.h1, fontSize: 28, color: p.text, marginTop: 2, marginBottom: S.md }}>
              {TITLES[prof]}
            </Text>

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

            <Pressable onPress={() => { haptic.select(); setOnlyFav(v => !v); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill,
                transform: [{ scale: pressed ? 0.95 : 1 }],
                backgroundColor: onlyFav ? p.primary : p.surface,
                borderWidth: onlyFav ? 0 : 1, borderColor: p.border, marginBottom: S.md,
              })}>
              <Icon name="heart" size={14} color={onlyFav ? p.onPrimary : p.text2} />
              <Text style={{ fontSize: 14, fontWeight: onlyFav ? '600' : '400',
                color: onlyFav ? p.onPrimary : p.text2 }}>Избранные</Text>
            </Pressable>

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
              <Empty icon="person.crop.circle.badge.questionmark"
                title={list.length ? 'Никого не нашлось' : 'Каталог пуст'}
                note={list.length
                  ? 'Смягчите отбор — например, снимите «Избранные».'
                  : 'Попросите у специалиста код приглашения.'} />
            ) : rows.map((s, i) => (
              <Animated.View key={s.id} entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(220)}>
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
