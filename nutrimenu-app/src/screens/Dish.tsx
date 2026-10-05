import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, mediaUrl, DishItem, MEAL_TITLES } from '../api';
import { S, R, FONT, STAR, alpha } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton, Empty } from '../ui/system';
import { ReplacePicker } from '../ui/ReplacePicker';
import { round, plural } from '../format';
import { haptic } from '../haptics';

const REASONS = ['Не было времени', 'Не было продуктов', 'Не хотелось', 'Ел(а) другое', 'Другое'];

/* Подложка выбранной звезды — те же 13 %, что в вебе. Сам цвет один
   на всё приложение и лежит в theme. */
const STAR_SOFT = alpha(STAR, 13);

export default function Dish() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const { id, repl: replParam } = useLocalSearchParams<{ id: string; repl?: string }>();
  const iid = Number(id);

  const [x, setX] = useState<DishItem | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [gram, setGram] = useState(0);
  const [busy, setBusy] = useState(false);
  /* Своя оценка живёт отдельно от блюда: сервер возвращает новую
     среднюю сразу, и перечитывать весь экран ради одной звезды незачем. */
  const [myRating, setMyRating] = useState<number | null>(null);
  const [avg, setAvg] = useState<number | null>(null);
  const [avgCount, setAvgCount] = useState(0);
  const [rateBusy, setRateBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ item: DishItem }>(`/client/menu-items/${iid}`);
      setX(r.item); setGram(round(r.item.portion_g)); setErr(null);
      setMyRating(r.item.my_rating ?? null);
      setAvg(r.item.dish_rating ?? null);
      setAvgCount(Number(r.item.dish_rating_count ?? 0));
    } catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, [iid]);

  useEffect(() => { load(); }, [load]);


  const nut = x?.nutrition ?? null;

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

  /* Подбор замены показывает общая шторка: та же, что открывается из
     строки дня. Раньше список рисовался прямо на экране — текстом, без
     снимков, и расхождения по КБЖУ набирались лаймом по светлой
     карточке, то есть не читались. */
  const [replOpen, setReplOpen] = useState(false);
  const openRepl = useCallback(() => { haptic.tap(); setReplOpen(true); }, []);

  /* Пришли по кнопке «Заменить блюдо» из списка дня — открываем подбор
     сразу. Один раз за вход: закрытую шторку не открываем снова. */
  const replAsked = useRef(false);
  useEffect(() => {
    if (replParam !== '1' || !x || replAsked.current) return;
    replAsked.current = true;
    setReplOpen(true);
  }, [replParam, x]);

  /* Оценка уходит сразу по нажатию и рисуется до ответа: ждать сервер,
     глядя на неподсвеченную звезду, человек читает как «не нажалось».
     Не сохранилось — возвращаем прежнюю. */
  const rate = useCallback(async (value: number) => {
    if (rateBusy || !x) return;
    const before = myRating;
    haptic.select();
    setMyRating(value);
    setRateBusy(true);
    try {
      const r = await api<{ rating?: number; rating_count?: number }>(
        `/client/dishes/${x.dish_id}/rating`, { method: 'POST', body: { rating: value } });
      if (r.rating != null) setAvg(r.rating);
      if (r.rating_count != null) setAvgCount(r.rating_count);
    } catch (e: any) {
      haptic.error();
      setMyRating(before);
      setErr(e?.message ?? 'Оценка не сохранилась');
    } finally { setRateBusy(false); }
  }, [rateBusy, x, myRating]);

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
        <ActivityIndicator color={p.accent} style={{ marginTop: 40 }} />
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

        {mediaUrl(x.photo_url) ? (
          <Animated.View entering={FadeInDown.duration(240)}>
            {/* Квадрат, а не низкая полоса: снимки блюд квадратные, и от
                тарелки в полосе оставалась только середина. */}
            <Image source={{ uri: mediaUrl(x.photo_url)! }}
              style={{ width: '100%', aspectRatio: 1, borderRadius: R.lg,
                backgroundColor: p.inset, marginBottom: S.md }}
              contentFit="cover" transition={220} cachePolicy="memory-disk" />
          </Animated.View>
        ) : null}

        {/* Порцию назначает специалист — клиент её видит, но не меняет:
            иначе план и отчёт по нему перестают сходиться. */}
        <Animated.View entering={FadeInDown.delay(40).duration(240)}>
          <Card style={{ marginBottom: S.md }}>
            <Label>Порция</Label>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
              <Text style={{ ...FONT.num, color: p.text }}>{gram}</Text>
              <Muted style={{ marginLeft: 6 }}>г</Muted>
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

        {/* Оценка блюда — пятью звёздами, как в вебе: клавиши 52×52 с
            подложкой, выбранные янтарные (#f5ae32 — значение из
            `.dish-rate-stars`, не акцент продукта).

            Звёзды показываем только после отметки «съедено»: сервер
            отклоняет оценку неотмеченного блюда, и нажатие кончалось бы
            отказом. Средняя оценка видна всегда — как `dishRatingLine`. */}
        {(done || avg) ? (
          <Animated.View entering={FadeInDown.delay(60).duration(240)}>
            <Card style={{ marginBottom: S.md }}>
              {done ? (
                <>
                  <Label>Ваше мнение</Label>
                  <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md }}>
                    {[1, 2, 3, 4, 5].map(n => {
                      const on = n <= (myRating ?? 0);
                      return (
                        <Pressable key={n} disabled={rateBusy} onPress={() => rate(n)}
                          style={({ pressed }) => ({
                            width: 52, height: 52, borderRadius: 17,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: on ? STAR_SOFT : p.inset,
                            opacity: pressed || rateBusy ? 0.6 : 1,
                          })}>
                          <Icon name="star" size={28} color={on ? STAR : p.text3} width={1.8} />
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                alignSelf: 'flex-start', marginTop: done ? S.md : 0,
                paddingVertical: 7, paddingHorizontal: 10,
                borderRadius: 12, backgroundColor: p.inset }}>
                <Icon name="star" size={15} color={STAR} width={1.8} />
                <Text style={{ fontSize: 12, color: p.text2 }}>
                  {avg
                    ? `${avg} из 5 · ${avgCount} ${plural(avgCount, ['оценка', 'оценки', 'оценок'])}`
                    : 'Оценок пока нет — ваша будет первой'}
                </Text>
              </View>
            </Card>
          </Animated.View>
        ) : null}

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
                  <Muted>{round(ing.grams)} г</Muted>
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

        <ReplacePicker itemId={iid} open={replOpen}
          onClose={() => setReplOpen(false)} onDone={load} />

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

