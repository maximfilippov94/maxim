import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useApp } from '../../store';
import {
  api, SpClient, SpMenu, SpMenuItem, ProgressResponse,
  MEAL_ORDER, MEAL_TITLES,
} from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Label, Muted, Bar } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Face } from '../../ui/Face';
import { SysButton, SysChart, SysSlider, SysConfirm, Empty } from '../../ui/system';
import { round, kg, plural } from '../../format';
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

        <View style={{ flexDirection: 'row', gap: S.md, marginBottom: S.lg }}>
          <SysButton label="Написать" icon="bubble.left" height={46}
            onPress={() => { haptic.tap(); router.push(`/sp-chat/${cid}`); }} />
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

  useEffect(() => { load(); }, [load]);
  /* Блюдо добавляют на отдельном экране: вернувшись, надо увидеть его,
     а не прежний список. День при этом не сбрасываем. */
  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const setPortion = useCallback(async (id: number, g: number) => {
    try { await api(`/specialist/menu-items/${id}`, { method: 'PATCH', body: { portion_g: g } }); }
    catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не сохранилось'); }
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
  const kcal = dayItems.reduce((a, i) => a + (i.nutrition?.kcal ?? 0), 0);

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
          const d = new Date(menu.start_date + 'T00:00:00');
          d.setDate(d.getDate() + n - 1);
          const filled = items.some(i => i.day_number === n);
          return (
            <Pressable key={n} onPress={() => { haptic.select(); setDay(n); }}
              style={({ pressed }) => ({
                width: 46, paddingVertical: 9, borderRadius: R.md, alignItems: 'center',
                backgroundColor: on ? p.primary : p.surface,
                opacity: pressed && !on ? 0.7 : 1,
              })}>
              <Text style={{ ...FONT.small, color: on ? p.onPrimary : p.text3 }}>
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][(d.getDay() + 6) % 7]}
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
                    params: { menu: menu.id, day, meal: mt },
                  });
                }}
                hitSlop={10}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4,
                  opacity: pressed ? 0.5 : 1 })}>
                <Icon name="plus" size={14} color={p.primary} width={2.4} />
                <Text style={{ ...FONT.small, color: p.primary }}>блюдо</Text>
              </Pressable>
            </View>
            {group.length === 0 ? (
              <Card style={{ paddingVertical: 14 }}>
                <Muted>Пусто — добавьте блюдо</Muted>
              </Card>
            ) : group.map(i => (
              <ItemCard key={i.id} item={i}
                onPortion={g => setPortion(i.id, g)} onRemove={() => remove(i.id)} />
            ))}
          </View>
        );
      })}

      <View style={{ gap: S.md, marginTop: S.sm }}>
        {day > 1 ? (
          <SysButton label={`Скопировать день ${day - 1}`} icon="doc.on.doc"
            disabled={busy} onPress={copyPrev} />
        ) : null}
        {menu.status !== 'published' ? (
          <SysButton label="Опубликовать меню" variant="prominent"
            disabled={busy} onPress={publish} />
        ) : null}
      </View>
    </Animated.View>
  );
}

function ItemCard({ item, onPortion, onRemove }: {
  item: SpMenuItem; onPortion: (g: number) => void; onRemove: () => void;
}) {
  const { p } = useApp();
  const [g, setG] = useState(round(item.portion_g));
  const base = round(item.base_portion_g ?? 0) || round(item.portion_g) || 200;
  const lo = Math.max(10, Math.round(base * 0.25 / 5) * 5);
  const hi = Math.round(base * 2.5 / 5) * 5;
  const k = item.portion_g ? g / round(item.portion_g) : 1;

  return (
    <Card style={{ marginBottom: S.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={1}>{item.dish_name}</Text>
          <Muted style={{ marginTop: 2 }}>
            {g} г · {round((item.nutrition?.kcal ?? 0) * k)} ккал
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
      <View style={{ marginTop: S.xs }}>
        <SysSlider value={g} min={lo} max={hi} step={5} onChange={setG} onCommit={onPortion} />
      </View>
    </Card>
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
