import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useApp } from '../../store';
import {
  api, mediaUrl, SpClient, SpMenu, SpMenuItem, ProgressResponse, Totals,
  MEAL_ORDER, MEAL_TITLES,
} from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Label, Muted, Bar } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Face } from '../../ui/Face';
import { SysButton, SysChart, SysSlider, SysConfirm, Empty } from '../../ui/system';
import { round, kg, plural, menuDate, dayTitle, dowShort, isToday } from '../../format';
import { haptic } from '../../haptics';
import { Loading, Fail } from '../Shopping';

type Tab = 'overview' | 'menu' | 'progress';
const TABS: [Tab, string][] = [
  ['overview', 'Обзор'], ['menu', 'Меню'], ['progress', 'Прогресс'],
];

const dmy = (s?: string | null) => {
  if (!s) return '—';
  const a = String(s).slice(0, 10).split('-');
  return a.length === 3 ? `${a[2]}.${a[1]}` : s;
};

/**
 * КБЖУ блюда при другой граммовке.
 *
 * Сервер присылает значения для сохранённой порции, а ползунок меняет
 * её на лету. Пересчитываем пропорцией от той же порции — так цифра
 * под блюдом и «калорийность дня» считаются одинаково и не расходятся.
 */
function scaleN(item: SpMenuItem, grams: number): Totals {
  const n = item.nutrition;
  const from = round(item.portion_g);
  if (!n || !from) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  const k = grams / from;
  return {
    kcal: n.kcal * k, protein: n.protein * k,
    fat: n.fat * k, carbs: n.carbs * k,
  };
}

export default function SpClientScreen() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cid = Number(id);

  const [c, setC] = useState<SpClient | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setC((await api<{ client: SpClient }>(`/specialist/clients/${cid}`)).client); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, [cid]);
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (err && !c) return <Fail title="Клиент" text={err} />;
  if (!c) return <Loading title="Клиент" />;

  const age = c.birth_year ? new Date().getFullYear() - c.birth_year : null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
      }} showsVerticalScrollIndicator={false}>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.lg, marginBottom: S.lg }}>
          <Face url={c.avatar_url} name={c.name} size={58} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...FONT.h2, color: p.text }}>{c.name}</Text>
            <Muted style={{ marginTop: 2 }}>
              {[c.goal, age ? `${age} ${plural(age, ['год', 'года', 'лет'])}` : null,
                c.height_cm ? `${c.height_cm} см` : null].filter(Boolean).join(' · ') || '—'}
            </Muted>
          </View>
        </View>

        {/* Три действия в один ряд: во всю ширину они занимали треть
            экрана и отодвигали меню вниз, а нажимают их по значку. */}
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
          <Action icon="chat" label="Написать"
            onPress={() => { haptic.tap(); router.push(`/sp-chat/${cid}`); }} />
          <Action icon="target" label="Цели"
            onPress={() => {
              haptic.tap();
              router.push({ pathname: '/sp-client-edit', params: { id: cid } });
            }} />
          <Action icon="heart" label="Здоровье"
            onPress={() => {
              haptic.tap();
              router.push({ pathname: '/sp-health', params: { id: cid, name: c.name } });
            }} />
        </View>

        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
          {TABS.map(([k, l]) => {
            const on = k === tab;
            return (
              <Pressable key={k} onPress={() => { haptic.select(); setTab(k); }}
                style={({ pressed }) => ({
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill,
                  backgroundColor: on ? p.primary : p.surface,
                  borderWidth: on ? 0 : 1, borderColor: p.border,
                  opacity: pressed && !on ? 0.7 : 1,
                })}>
                <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
                  color: on ? p.onPrimary : p.text2 }}>{l}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'overview' ? <Overview c={c} /> : null}
        {tab === 'menu' ? <MenuTab cid={cid} name={c.name} /> : null}
        {tab === 'progress' ? <ProgressTab cid={cid} /> : null}
      </ScrollView>
    </View>
  );
}

function Overview({ c }: { c: SpClient }) {
  const { p } = useApp();
  const rows: [string, string][] = [
    ['Норма калорий', c.target_kcal ? `${c.target_kcal} ккал` : '—'],
    ['Белки', c.target_protein ? `${round(c.target_protein)} г` : '—'],
    ['Жиры', c.target_fat ? `${round(c.target_fat)} г` : '—'],
    ['Углеводы', c.target_carbs ? `${round(c.target_carbs)} г` : '—'],
    ['Вес', c.weight_kg ? `${kg(c.weight_kg)} кг` : '—'],
    ['Почта', c.email ?? '—'],
    ['Телефон', c.phone ?? '—'],
  ];
  return (
    <Animated.View entering={FadeInDown.duration(220)}>
      <Card style={{ padding: 0, marginBottom: S.md }}>
        {rows.map(([l, v], i) => (
          <View key={l} style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingVertical: 12, paddingHorizontal: S.lg,
            borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
          }}>
            <Text style={{ fontSize: 15, color: p.text2 }}>{l}</Text>
            <Text style={{ fontSize: 15, color: p.text }} numberOfLines={1}>{v}</Text>
          </View>
        ))}
      </Card>
      {c.notes ? (
        <Card>
          <Label>Заметка</Label>
          <Text style={{ ...FONT.body, color: p.text2, marginTop: S.sm, lineHeight: 19 }}>
            {c.notes}
          </Text>
        </Card>
      ) : null}
    </Animated.View>
  );
}

/**
 * Меню клиента по дням: то же, что видит он сам, только с правками.
 * Порция меняется системным ползунком, удаление спрашивает подтверждение —
 * блюдо из чужого плана нельзя убрать «случайно».
 */
function MenuTab({ cid, name }: { cid: number; name: string }) {
  const { p } = useApp();
  const [menu, setMenu] = useState<SpMenu | null | undefined>(undefined);
  const [items, setItems] = useState<SpMenuItem[]>([]);
  const [day, setDay] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (keepDay = false) => {
    try {
      const r = await api<{ menus: SpMenu[] }>(`/specialist/menus?client_id=${cid}`);
      const m = r.menus?.[0] ?? null;
      setMenu(m);
      if (m) {
        const full = await api<{ menu: SpMenu; items: SpMenuItem[] }>(`/specialist/menus/${m.id}`);
        setItems(full.items ?? []);
        if (!keepDay) {
          const start = new Date(m.start_date + 'T00:00:00');
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const n = Math.floor((+today - +start) / 86400000) + 1;
          setDay(Math.max(1, Math.min(m.days_count, n)));
        }
      } else setItems([]);
      setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); setMenu(null); }
  }, [cid]);

  /* Одна загрузка, а не две.
     Раньше здесь стояли useEffect и useFocusEffect сразу: первый
     пересчитывал день на сегодняшний, второй сохранял выбранный, и
     побеждал тот, чей ответ приходил позже. Из-за этого при открытии
     вкладки день прыгал прямо на глазах.
     Теперь загрузка одна: в первый раз она встаёт на сегодняшний день,
     дальше оставляет выбранный — чтобы возвращение с экрана блюда не
     сбрасывало день. */
  const opened = useRef(false);
  useFocusEffect(useCallback(() => {
    load(opened.current);
    opened.current = true;
  }, [load]));

  /* Ползунок двигают — итог дня обязан ехать за ним. Держим граммовку
     здесь, а не внутри карточки: иначе «калорийность дня» считалась бы
     по сохранённой порции и расходилась с тем, что видно под блюдом. */
  const [draft, setDraft] = useState<Record<number, number>>({});
  const dragPortion = useCallback((id: number, g: number) => {
    setDraft(d => (d[id] === g ? d : { ...d, [id]: g }));
  }, []);

  const setPortion = useCallback(async (id: number, g: number) => {
    try {
      await api(`/specialist/menu-items/${id}`, { method: 'PATCH', body: { portion_g: g } });
      /* Сохранилось — переносим граммовку в сам список, чтобы
         черновик не расходился с данными после перерисовки. */
      setItems(a => a.map(x => x.id === id
        ? { ...x, portion_g: g, nutrition: scaleN(x, g) } : x));
      setDraft(d => { const { [id]: _, ...rest } = d; return rest; });
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не сохранилось'); }
  }, []);

  const remove = useCallback(async (id: number) => {
    setItems(a => a.filter(x => x.id !== id));
    try { await api(`/specialist/menu-items/${id}`, { method: 'DELETE' }); await load(true); }
    catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось убрать'); load(true); }
  }, [load]);

  const publish = useCallback(async () => {
    if (!menu) return;
    setBusy(true);
    try {
      await api(`/specialist/menus/${menu.id}/publish`, { method: 'POST' });
      haptic.success(); await load(true);
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось опубликовать'); }
    finally { setBusy(false); }
  }, [menu, load]);

  /* Готовое меню — заготовка для следующего клиента: собирать такой же
     рацион заново незачем. */
  const saveTemplate = useCallback(async () => {
    if (!menu) return;
    setBusy(true);
    try {
      await api('/specialist/templates', {
        method: 'POST', body: { source_menu_id: menu.id, name: menu.title },
      });
      haptic.success(); setErr('Сохранено в шаблоны — они в разделе «Ещё».');
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось сохранить'); }
    finally { setBusy(false); }
  }, [menu]);

  /* Скопировать вчерашний день — как в вебе: рацион редко меняют каждый
     день целиком, чаще правят одно-два блюда. */
  const copyPrev = useCallback(async () => {
    if (!menu || day < 2) return;
    setBusy(true);
    try {
      await api(`/specialist/menus/${menu.id}/copy-day`, {
        method: 'POST', body: { from_day: day - 1, to_day: day },
      });
      haptic.success(); await load(true);
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось скопировать'); }
    finally { setBusy(false); }
  }, [menu, day, load]);

  if (menu === undefined) return <ActivityIndicator color={p.primary} style={{ marginTop: 30 }} />;

  if (!menu) {
    return (
      <Animated.View entering={FadeInDown.duration(220)}>
        <Empty icon="calendar.badge.plus" title="Меню ещё нет"
          note="Создайте план на несколько дней и заполните его блюдами." />
        <SysButton label="Создать меню" variant="prominent" icon="plus"
          onPress={() => {
            haptic.tap();
            router.push({ pathname: '/sp-menu-new', params: { client: cid, name } });
          }} />
      </Animated.View>
    );
  }

  const dayItems = items.filter(i => i.day_number === day);
  /* Пока палец на ползунке, берём черновую граммовку — цифра сверху
     меняется вместе с блюдом, а не после сохранения. */
  const kcal = dayItems.reduce(
    (a, i) => a + scaleN(i, draft[i.id] ?? i.portion_g).kcal, 0);

  return (
    <Animated.View entering={FadeInDown.duration(220)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: S.sm }}>
        <Text style={{ ...FONT.h3, color: p.text, flex: 1 }} numberOfLines={1}>{menu.title}</Text>
        <Muted>{menu.status === 'published' ? 'опубликовано' : 'черновик'}</Muted>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: S.sm, paddingBottom: S.md }}>
        {Array.from({ length: menu.days_count }, (_, i) => i + 1).map(n => {
          const on = n === day;
          const d = menuDate(menu.start_date, n)!;
          const now = isToday(d);
          const filled = items.some(i => i.day_number === n);
          return (
            <Pressable key={n} onPress={() => { haptic.select(); setDay(n); }}
              style={({ pressed }) => ({
                width: 46, paddingVertical: 9, borderRadius: R.md, alignItems: 'center',
                backgroundColor: on ? p.primary : p.surface,
                /* Сегодня обведено — видно, какой день клиент ест прямо сейчас */
                borderWidth: now && !on ? 1.5 : 0,
                borderColor: p.primary,
                opacity: pressed && !on ? 0.7 : 1,
              })}>
              <Text style={{ ...FONT.small,
                color: on ? p.onPrimary : now ? p.primary : p.text3 }}>
                {dowShort(d)}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '700', marginTop: 1,
                color: on ? p.onPrimary : p.text }}>{d.getDate()}</Text>
              {/* Точка под числом — день уже заполнен: видно, где дыра */}
              <View style={{
                width: 4, height: 4, borderRadius: 2, marginTop: 3,
                backgroundColor: filled ? (on ? p.onPrimary : p.primary) : 'transparent',
              }} />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm,
        marginBottom: S.md }}>
        <Text style={{ ...FONT.h3, color: p.text }}>
          {dayTitle(menu.start_date, day, true)}
        </Text>
        {isToday(menuDate(menu.start_date, day)) ? <Muted>сегодня</Muted> : null}
      </View>

      <Card style={{ marginBottom: S.md }}>
        <Label>Калорийность дня</Label>
        <Text style={{ ...FONT.num, color: p.text, marginTop: 3 }}>{round(kcal)}</Text>
        <View style={{ marginTop: S.sm }}><Bar value={kcal / 2500} /></View>
      </Card>

      {err ? <Text style={{ ...FONT.small, color: p.danger, marginBottom: S.sm }}>{err}</Text> : null}

      {MEAL_ORDER.map(mt => {
        const group = dayItems.filter(i => i.meal_type === mt);
        return (
          <View key={mt} style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: S.sm }}>
              <Text style={{ ...FONT.h3, color: p.text }}>{MEAL_TITLES[mt]}</Text>
              <Pressable
                onPress={() => {
                  haptic.tap();
                  router.push({
                    pathname: '/sp-add-dish',
                    params: { menu: menu.id, day, meal: mt, start: menu.start_date },
                  });
                }}
                hitSlop={10}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4,
                  opacity: pressed ? 0.5 : 1 })}>
                <Icon name="plus" size={14} color={p.primary} width={2.4} />
                <Text style={{ ...FONT.small, color: p.accent }}>блюдо</Text>
              </Pressable>
            </View>
            {group.length === 0 ? (
              <Card style={{ paddingVertical: 14 }}>
                <Muted>Пусто — добавьте блюдо</Muted>
              </Card>
            ) : group.map(i => (
              <ItemCard key={i.id} item={i} grams={draft[i.id] ?? round(i.portion_g)}
                onRemove={() => remove(i.id)} />
            ))}
          </View>
        );
      })}

      <View style={{ gap: S.md, marginTop: S.sm }}>
        {day > 1 ? (
          <SysButton label={`Скопировать ${dayTitle(menu.start_date, day - 1)}`}
            icon="doc.on.doc"
            disabled={busy} onPress={copyPrev} />
        ) : null}
        <SysButton label="Сохранить как шаблон" icon="doc.badge.plus"
          disabled={busy} onPress={saveTemplate} />
        {menu.status !== 'published' ? (
          <SysButton label="Опубликовать меню" variant="prominent"
            disabled={busy} onPress={publish} />
        ) : null}
      </View>
    </Animated.View>
  );
}

/**
 * Действие в карточке клиента: значок над подписью, треть ширины.
 * Три таких помещаются в строку и не съедают экран, как это делали
 * кнопки во всю ширину.
 */
function Action({ icon, label, onPress }: {
  icon: string; label: string; onPress: () => void;
}) {
  const { p } = useApp();
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, height: 64, borderRadius: R.md,
        alignItems: 'center', justifyContent: 'center', gap: 5,
        backgroundColor: p.surface,
        borderWidth: p.name === 'light' ? StyleSheet.hairlineWidth : 0,
        borderColor: p.borderSoft,
        opacity: pressed ? 0.6 : 1,
      })}>
      <Icon name={icon} size={19} color={p.primary} width={1.9} />
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: p.text2 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Блюдо в меню.
 *
 * Фотография, название и порция — день читается взглядом. По нажатию
 * открывается карточка блюда целиком: состав под эту порцию, рецепт
 * и та же граммовка. Разворачивать ползунок прямо в строке оказалось
 * мало: состав и рецепт всё равно приходилось искать отдельно.
 */
function ItemCard({ item, grams, onRemove }: {
  item: SpMenuItem;
  /** Граммовка живёт в экране целиком — здесь её только показывают */
  grams: number;
  onRemove: () => void;
}) {
  const { p } = useApp();
  const photo = mediaUrl(item.photo_url);

  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push({
          pathname: '/sp-menu-item',
          params: {
            item: item.id, dish: item.dish_id, meal: item.meal_type,
            portion: round(grams), base: round(item.base_portion_g ?? 0),
          },
        });
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <Card style={{ marginBottom: S.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{
            width: 52, height: 52, borderRadius: R.md, backgroundColor: p.inset,
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {/* Значок под снимком: пока фото едет или если его нет,
                квадрат не остаётся пустым. */}
            <Icon name="bowl" size={19} color={p.text3} />
            {photo ? (
              <Image source={{ uri: photo }}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                contentFit="cover" transition={200} cachePolicy="memory-disk" />
            ) : null}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={1}>{item.dish_name}</Text>
            <Muted style={{ marginTop: 2 }}>
              {grams} г · {round(scaleN(item, grams).kcal)} ккал
            </Muted>
          </View>

          <SysConfirm
            label="Убрать" tint={p.danger}
            title={`Убрать «${item.dish_name}»?`}
            message="Блюдо исчезнет из меню клиента."
            confirmLabel="Убрать из меню"
            onConfirm={onRemove}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function ProgressTab({ cid }: { cid: number }) {
  const { p } = useApp();
  const [d, setD] = useState<ProgressResponse | null | undefined>(undefined);

  useEffect(() => {
    api<ProgressResponse>(`/specialist/clients/${cid}/progress`)
      .then(setD).catch(() => setD(null));
  }, [cid]);

  if (d === undefined) return <ActivityIndicator color={p.primary} style={{ marginTop: 30 }} />;
  const ws = d?.weights ?? [];
  if (!ws.length) {
    return <Empty icon="scalemass" title="Замеров нет"
      note="Клиент ещё не записывал вес." />;
  }
  const first = +ws[0].weight_kg, last = +ws[ws.length - 1].weight_kg;
  const delta = Math.round((last - first) * 10) / 10;

  return (
    <Animated.View entering={FadeInDown.duration(220)}>
      <Card style={{ marginBottom: S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ ...FONT.num, color: p.text }}>{kg(last)}</Text>
          <Text style={{ ...FONT.body, color: p.text3 }}>кг</Text>
          {delta !== 0 ? (
            <Text style={{ ...FONT.h3, marginLeft: 'auto', color: delta < 0 ? p.mp : p.mf }}>
              {delta > 0 ? '+' : '−'}{kg(Math.abs(delta))} кг
            </Text>
          ) : null}
        </View>
        {ws.length >= 2 ? (
          <View style={{ marginTop: S.md }}>
            <SysChart color={p.mp} points={ws.map(w => ({ x: dmy(w.measured_on), y: +w.weight_kg }))} />
          </View>
        ) : null}
      </Card>

      {d?.measurements?.length ? (
        <>
          <Text style={{ ...FONT.h3, color: p.text, marginBottom: S.sm }}>Замеры</Text>
          <Card style={{ padding: 0 }}>
            {d.measurements.slice().reverse().map((m, i) => (
              <View key={m.id} style={{
                flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: 11, paddingHorizontal: S.lg,
                borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
              }}>
                <Text style={{ fontSize: 15, color: p.text2 }}>{dmy(m.measured_on)}</Text>
                <Text style={{ fontSize: 15, color: p.text }}>
                  {[m.waist_cm ? `талия ${m.waist_cm}` : null,
                    m.hips_cm ? `бёдра ${m.hips_cm}` : null,
                    m.chest_cm ? `грудь ${m.chest_cm}` : null].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Animated.View>
  );
}
