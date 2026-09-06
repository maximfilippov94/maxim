import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../src/store';
import { api, Dish, MEAL_TITLES } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { Empty } from '../src/ui/system';
import { round } from '../src/format';
import { haptic } from '../src/haptics';

/**
 * Насколько блюдо подходит приёму: 2 — задумано именно для него,
 * 1 — помечено ещё и другими приёмами, 0 — не для этого.
 * Блюдо «на всё» — обычно просто незаполненная карточка, и держать его
 * выше овсянки в списке завтраков неправильно.
 */
const fitRank = (d: Dish, meal: string) => {
  if (!d.meal_types) return 0;
  try {
    const a = JSON.parse(d.meal_types);
    if (!Array.isArray(a) || !a.includes(meal)) return 0;
    return a.length <= 2 ? 2 : 1;
  } catch { return 0; }
};
const fits = (d: Dish, meal: string) => fitRank(d, meal) > 0;

export default function AddDish() {
  const { p } = useApp();
  const { menu, day, meal } = useLocalSearchParams<{ menu: string; day: string; meal: string }>();
  const [list, setList] = useState<Dish[] | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ dishes: Dish[] }>('/specialist/dishes')
      .then(r => setList(r.dishes ?? []))
      .catch(e => { setErr(e.message); setList([]); });
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const a = (list ?? []).filter(d => !s || d.name.toLowerCase().includes(s));
    /* Сначала подходящие приёму, дальше по алфавиту: иначе наверх
       всплывает то, что просто раньше завели в каталог. */
    return a.sort((x, y) =>
      fitRank(y, String(meal)) - fitRank(x, String(meal))
      || x.name.localeCompare(y.name, 'ru'));
  }, [list, q, meal]);

  async function add(d: Dish) {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      await api(`/specialist/menus/${menu}/items`, {
        method: 'POST',
        body: {
          dish_id: d.id,
          day_number: Number(day),
          meal_type: meal,
          portion_g: d.base_portion_g || 250,
        },
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось добавить');
    } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.xl, paddingBottom: S.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...FONT.h2, color: p.text }}>Добавить блюдо</Text>
          <Muted style={{ marginTop: 2 }}>
            День {day} · {MEAL_TITLES[String(meal)] ?? 'приём'}
          </Muted>
        </View>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: S.sm,
        backgroundColor: p.inset, borderRadius: R.md,
        marginHorizontal: S.xl, marginBottom: S.md, paddingHorizontal: S.lg,
      }}>
        <Icon name="bowl" size={17} color={p.text3} />
        <TextInput value={q} onChangeText={setQ}
          placeholder="Название блюда" placeholderTextColor={p.text3}
          style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: p.text }} />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={10}>
            <Icon name="close" size={15} color={p.text3} />
          </Pressable>
        ) : null}
      </View>

      {err ? (
        <Text style={{ ...FONT.small, color: p.danger, paddingHorizontal: S.xl }}>{err}</Text>
      ) : null}

      {!list ? (
        <ActivityIndicator color={p.primary} style={{ marginTop: 30 }} />
      ) : shown.length === 0 ? (
        <Empty icon="fork.knife" title="Ничего не нашли"
          note="Проверьте название или добавьте блюдо в браузере." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: S.xxl }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {shown.map((d, i) => {
            const portion = d.base_portion_g || 250;
            const good = fits(d, String(meal));
            return (
              <Pressable key={d.id} onPress={() => add(d)} disabled={busy}>
                {({ pressed }) => (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: S.md,
                    paddingVertical: 12, paddingHorizontal: S.xl,
                    borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
                    backgroundColor: pressed ? p.ov1 : 'transparent',
                  }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 16, color: p.text }} numberOfLines={1}>{d.name}</Text>
                      <Muted style={{ marginTop: 2 }}>
                        {round(portion)} г · {round(d.kcal_100 * portion / 100)} ккал
                      </Muted>
                    </View>
                    {good ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.sm,
                        backgroundColor: p.primarySoft }}>
                        <Text style={{ ...FONT.small, color: p.primary }}>подходит</Text>
                      </View>
                    ) : null}
                    <Icon name="plus" size={16} color={p.primary} width={2.2} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
