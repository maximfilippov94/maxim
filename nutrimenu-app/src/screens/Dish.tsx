import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, DishItem, Replacement, MEAL_TITLES } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { Counter } from '../ui/Counter';
import { SysButton, SysSlider, SysConfirm, Empty } from '../ui/system';
import { round } from '../format';
import { haptic } from '../haptics';

const REASONS = ['Не было времени', 'Не было продуктов', 'Не хотелось', 'Ел(а) другое', 'Другое'];

export default function Dish() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const iid = Number(id);

  const [x, setX] = useState<DishItem | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /* Граммовку ведём отдельно от загруженного блюда: ползунок должен
     двигаться на каждый кадр, а запрос уходит один — на отпускание. */
  const [gram, setGram] = useState(0);
  const [repl, setRepl] = useState<Replacement[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ item: DishItem }>(`/client/menu-items/${iid}`);
      setX(r.item); setGram(round(r.item.portion_g)); setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, [iid]);

  useEffect(() => { load(); }, [load]);

  /* КБЖУ пересчитываем на месте по той же пропорции, что и сервер:
     ждать ответа, чтобы увидеть новую калорийность, — лишняя пауза. */
  const k = x && x.portion_g ? gram / round(x.portion_g) : 1;
  const nut = x ? {
    kcal: x.nutrition.kcal * k, protein: x.nutrition.protein * k,
    fat: x.nutrition.fat * k, carbs: x.nutrition.carbs * k,
  } : null;

  const savePortion = useCallback(async (v: number) => {
    if (!x || v === round(x.portion_g)) return;
    haptic.select();
    try {
      await api(`/client/menu-items/${iid}/portion`, {
        method: 'PATCH', body: { portion_g: v },
      });
      await load();
    } catch (e: any) {
      haptic.error();
      setGram(round(x.portion_g));
      setErr(e?.message ?? 'Не удалось сохранить вес порции');
    }
  }, [x, iid, load]);

  const log = useCallback(async (status: 'eaten' | 'planned' | 'skipped', reason?: string) => {
    setBusy(true);
    try {
      await api(`/client/meals/${iid}/log`, { method: 'POST', body: { status, reason } });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось отметить');
    } finally { setBusy(false); }
  }, [iid]);

  const openRepl = useCallback(async () => {
    haptic.tap();
    try {
      const r = await api<{ dishes: Replacement[] }>(`/client/menu-items/${iid}/replacements`);
      setRepl(r.dishes ?? []);
    } catch (e: any) { setErr(e?.message ?? 'Замены недоступны'); }
  }, [iid]);

  const doRepl = useCallback(async (dishId: number) => {
    setBusy(true);
    try {
      await api(`/client/menu-items/${iid}/replace`, { method: 'POST', body: { dish_id: dishId } });
      haptic.success(); setRepl(null); await load();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Эта замена недоступна');
    } finally { setBusy(false); }
  }, [iid, load]);

  if (err && !x) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back />
        <Empty icon="exclamationmark.triangle" title="Блюдо не открылось" note={err} />
      </View>
    );
  }
  if (!x || !nut) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back />
        <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const done = x.log_status === 'eaten';
  /* Границы считаем от базовой порции блюда — от неё же их считает
     сервер. От текущей они бы уезжали с каждым сохранением. */
  const base = round(x.base_portion_g ?? 0) || round(x.portion_g) || 200;
  /* Границы те же, что проверяет сервер: показывать ползунком то,
     что он потом отклонит, — обман. */
  /* Границы кратны шагу: иначе текущая порция не попадает на деление
     и ползунок при открытии сам сдвигает её на пару граммов. */
  const lo = Math.max(10, Math.round(base * 0.25 / 5) * 5);
  const hi = Math.round(base * 2.5 / 5) * 5;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>

        <Label>{MEAL_TITLES[x.meal_type] ?? 'Блюдо'}</Label>
        <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs, marginBottom: S.lg }}>
          {x.dish_name}
        </Text>

        {x.photo_url ? (
          <Animated.View entering={FadeInDown.duration(240)}>
            <Image source={{ uri: x.photo_url }}
              style={{ width: '100%', height: 200, borderRadius: R.lg, backgroundColor: p.inset,
                marginBottom: S.md }}
              contentFit="cover" transition={220} cachePolicy="memory-disk" />
          </Animated.View>
        ) : null}

        {/* Граммовка: системный ползунок. Цифры набегают, а не
            перескакивают — так видно, насколько сдвинулась порция. */}
        <Animated.View entering={FadeInDown.delay(40).duration(240)}>
          <Card style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Label>Порция</Label>
              <Muted>{lo}–{hi} г</Muted>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
              <Counter value={gram} style={{ ...FONT.num, color: p.text }} step={1} />
              <Muted style={{ marginLeft: 6 }}>г</Muted>
            </View>
            <View style={{ marginTop: S.sm }}>
              <SysSlider value={gram} min={lo} max={hi} step={5}
                onChange={setGram} onCommit={savePortion} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: S.sm }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: p.text }}>
                {round(nut.kcal)}
              </Text>
              <Muted style={{ marginLeft: 5 }}>
                ккал · Б {round(nut.protein)} · Ж {round(nut.fat)} · У {round(nut.carbs)} г
              </Muted>
            </View>
          </Card>
        </Animated.View>

        {x.ingredients?.length ? (
          <Animated.View entering={FadeInDown.delay(80).duration(240)}>
            <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>Состав</Text>
            <Card style={{ padding: 0, marginBottom: S.md }}>
              {x.ingredients.map((ing, i) => (
                <View key={ing.ingredient_name + i} style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingVertical: 11, paddingHorizontal: S.lg,
                  borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
                }}>
                  <Text style={{ fontSize: 15, color: p.text, flex: 1 }} numberOfLines={1}>
                    {ing.ingredient_name}
                  </Text>
                  <Muted>{round(ing.grams * k)} г</Muted>
                </View>
              ))}
            </Card>
          </Animated.View>
        ) : null}

        {x.instructions ? (
          <Animated.View entering={FadeInDown.delay(120).duration(240)}>
            <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>Рецепт</Text>
            <Card style={{ marginBottom: S.md }}>
              <Text style={{ fontSize: 15, lineHeight: 22, color: p.text2 }}>{x.instructions}</Text>
            </Card>
          </Animated.View>
        ) : null}

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginBottom: S.md }}>{err}</Text>
        ) : null}

        {/* Замены приходят списком — показываем их здесь же, а не в
            отдельном окне: выбор блюда рядом с составом понятнее. */}
        {repl ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              marginTop: S.sm, marginBottom: S.sm }}>
              <Text style={{ ...FONT.h3, color: p.text }}>Чем заменить</Text>
              <Pressable onPress={() => setRepl(null)} hitSlop={10}>
                <Icon name="close" size={17} color={p.text3} />
              </Pressable>
            </View>
            {repl.length === 0 ? (
              <Empty icon="rectangle.on.rectangle.slash" height={160}
                title="Замен нет"
                note="Специалист не задал для этого блюда разрешённых замен." />
            ) : (
              <Card style={{ padding: 0, marginBottom: S.md }}>
                {repl.map((d, i) => {
                  const portion = d.base_portion_g || 250;
                  return (
                    <Pressable key={d.id} onPress={() => doRepl(d.id)} disabled={busy}>
                      {({ pressed }) => (
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: S.md,
                          paddingVertical: 11, paddingHorizontal: S.lg,
                          borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
                          backgroundColor: pressed ? p.ov1 : 'transparent',
                        }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: p.text }}>{d.name}</Text>
                            <Muted style={{ marginTop: 2 }}>
                              {round(d.kcal_100 * portion / 100)} ккал · {portion} г
                            </Muted>
                          </View>
                          <Icon name="chevr" size={14} color={p.text3} width={2} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </Card>
            )}
          </Animated.View>
        ) : null}

        {/* Все действия — системными кнопками: главное залито, остальные
            стеклянные, опасное спрашивает подтверждение. */}
        <View style={{ gap: S.md, marginTop: S.md }}>
          <SysButton
            label={done ? 'Отмечено' : 'Я съел(а)'}
            variant={done ? 'plainGlass' : 'prominent'}
            icon={done ? 'checkmark.circle.fill' : 'checkmark'}
            disabled={busy}
            onPress={() => log(done ? 'planned' : 'eaten')}
          />
          <SysButton label="Заменить блюдо" icon="arrow.triangle.2.circlepath"
            disabled={busy} onPress={openRepl} />
          <SkipRow onPick={r => log('skipped', r)} disabled={busy} />
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Пропуск спрашивает причину: она уходит специалисту и объясняет разрыв
 * в отчёте. Список причин — тот же, что в вебе.
 */
function SkipRow({ onPick, disabled }: { onPick: (reason: string) => void; disabled?: boolean }) {
  const { p } = useApp();
  const [open, setOpen] = useState(false);
  if (!open) {
    return <SysButton label="Пропустить" variant="quiet" disabled={disabled}
      onPress={() => { haptic.tap(); setOpen(true); }} />;
  }
  return (
    <Card style={{ padding: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: S.lg, paddingTop: 12, paddingBottom: 4 }}>
        <Label>Почему пропуск</Label>
        <Pressable onPress={() => setOpen(false)} hitSlop={10}>
          <Icon name="close" size={16} color={p.text3} />
        </Pressable>
      </View>
      {REASONS.map((r, i) => (
        <Pressable key={r} onPress={() => onPick(r)} disabled={disabled}>
          {({ pressed }) => (
            <View style={{
              paddingVertical: 12, paddingHorizontal: S.lg,
              borderTopWidth: 1, borderTopColor: p.borderSoft,
              backgroundColor: pressed ? p.ov1 : 'transparent',
            }}>
              <Text style={{ fontSize: 15, color: p.text }}>{r}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </Card>
  );
}
