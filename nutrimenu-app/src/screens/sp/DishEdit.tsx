/**
 * Редактор блюда.
 *
 * Считать КБЖУ вручную специалист не должен: он набирает состав, а
 * калорийность и макросы пересчитываются на лету из пищевой базы — по
 * той же формуле, что и на сервере, поэтому цифра в форме совпадает
 * с тем, что окажется в карточке после сохранения.
 *
 * Общие блюда из каталога открываются только на просмотр: их видят все
 * специалисты, и правка одного меняла бы меню у чужих клиентов.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useApp } from '../../store';
import {
  api, mediaUrl, Ingredient, DishFull, DishStep, DishRecipeRow, MEAL_TITLES,
} from '../../api';
import { uploadFile } from '../../upload';
import { pickPhoto } from '../../photo';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Label, Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { SysConfirm } from '../../ui/system';
import { round } from '../../format';
import { haptic } from '../../haptics';
import { Loading, Fail } from '../Shopping';

const MEALS: [string, string][] = [
  ['breakfast', 'Завтрак'], ['lunch', 'Обед'],
  ['dinner', 'Ужин'], ['snack1', 'Перекус'],
];

/** Строка состава в форме: продукт может быть ещё не выбран. */
interface Row { key: string; ingredient_id: number; name: string; grams: string }

/* На экран могли прийти по ссылке из уведомления — тогда возвращаться
   некуда, и «назад» нужно подменить списком блюд. */
function leave() {
  if (router.canGoBack()) router.back(); else router.replace('/sp-dishes');
}

const newKey = () => Math.random().toString(36).slice(2);
const emptyRow = (): Row => ({ key: newKey(), ingredient_id: 0, name: '', grams: '100' });

/** meal_types приходит строкой JSON — разбираем мягко. */
function parseList(v?: string | null): string[] {
  if (!v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a.map(String) : []; }
  catch { return []; }
}
function parseSteps(v?: string | null): DishStep[] {
  if (!v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
/** Рецепт сплошным текстом — по шагам. Пустой текст даёт один пустой шаг. */
function stepsFromText(v?: string | null): DishStep[] {
  const t = (v ?? '').trim();
  if (!t) return [{ text: '' }];
  /* Режем по границам предложений: точка с пробелом или перевод строки.
     Сокращения вроде «5–7 мин.» в конце фразы тоже дают точку, но лишний
     разрыв там безобиднее слипшегося абзаца. */
  const parts = t.split(/\n+|(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  return parts.length ? parts.map(text => ({ text })) : [{ text: t }];
}

export default function DishEdit() {
  const { p, me } = useApp();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const dishId = Number(id) || 0;

  const [base, setBase] = useState<Ingredient[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(true);

  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('15');
  const [meals, setMeals] = useState<string[]>(['lunch']);
  const [photo, setPhoto] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [steps, setSteps] = useState<DishStep[]>([{ text: '' }]);
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [cover, setCover] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ing = (await api<{ ingredients: Ingredient[] }>('/specialist/ingredients')).ingredients ?? [];
        setBase(ing);
        if (dishId) {
          const d = (await api<{ dish: DishFull }>('/specialist/dishes/' + dishId)).dish;
          setName(d.name);
          setMinutes(String(d.cook_minutes ?? 15));
          setMeals(parseList(d.meal_types).length ? parseList(d.meal_types) : ['lunch']);
          setPhoto(d.photo_url ?? null);
          setTags(d.tags ?? '');
          /* Пошагового рецепта может не быть — у блюд каталога он лежит
             сплошным текстом в instructions. Показать пустой «Шаг 1»
             рядом с готовым рецептом значит потерять его на экране. */
          const st = parseSteps(d.steps);
          setSteps(st.length ? st : stepsFromText(d.instructions));
          setRows((d.ingredients ?? []).length
            ? d.ingredients.map((r: DishRecipeRow) => ({
                key: newKey(), ingredient_id: r.ingredient_id,
                name: r.ingredient_name, grams: String(round(r.grams)),
              }))
            : [emptyRow()]);
          /* Общее блюдо каталога сервер править не даст — не показываем
             форму, которую всё равно нельзя сохранить. */
          setMine(!!d.created_by && d.created_by === me?.user?.id);
        }
      } catch (e: any) { setErr(e?.message ?? 'Не удалось открыть блюдо'); }
      finally { setLoading(false); }
    })();
  }, [dishId, me?.user?.id]);

  /* Тот же расчёт, что у сервера в recalc_dish(): КБЖУ продуктов берётся
     на сырой вес, а выход блюда — с поправкой на уварку.

     Состав — единственный источник КБЖУ, и у блюда каталога тоже. Второго
     набора чисел в сервисе нет: сервер сам считает блюдо по составу и
     хранит результат на 100 г, чтобы каталог и меню не пересчитывали
     сумму на каждый запрос. Поэтому сложенное здесь и присланное оттуда
     сходятся, и карточка не спорит с итогом дня. */
  const total = useMemo(() => {
    let raw = 0, out = 0, k = 0, pr = 0, f = 0, c = 0;
    for (const r of rows) {
      const a = base?.find(x => x.id === r.ingredient_id);
      const g = parseFloat(r.grams.replace(',', '.')) || 0;
      if (!a || g <= 0) continue;
      raw += g;
      out += g * (a.cooked_ratio || 1);
      k += a.kcal * g / 100; pr += a.protein * g / 100;
      f += a.fat * g / 100; c += a.carbs * g / 100;
    }
    return { raw, out, k, pr, f, c };
  }, [rows, base]);

  const setRow = useCallback((key: string, patch: Partial<Row>) => {
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  async function attachCover() {
    try {
      const file = await pickPhoto();
      if (!file) return;
      setCover(true);
      setPhoto(await uploadFile('/specialist/upload', file, 'photo'));
      haptic.success();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Фото не загрузилось'); }
    finally { setCover(false); }
  }

  async function attachStep(i: number) {
    try {
      const file = await pickPhoto();
      if (!file) return;
      const url = await uploadFile('/specialist/upload', file, 'photo');
      setSteps(s => s.map((x, j) => (j === i ? { ...x, photo_url: url } : x)));
      haptic.success();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Фото не загрузилось'); }
  }

  async function save() {
    const ings = rows
      .map(r => ({ ingredient_id: r.ingredient_id, grams: parseFloat(r.grams.replace(',', '.')) || 0 }))
      .filter(x => x.ingredient_id && x.grams > 0);
    if (!name.trim()) { haptic.error(); setErr('Как называется блюдо?'); return; }
    if (!ings.length) { haptic.error(); setErr('Добавьте хотя бы один продукт'); return; }

    const clean = steps
      .map(s => ({ text: (s.text ?? '').trim(), photo_url: s.photo_url ?? null }))
      .filter(s => s.text || s.photo_url);

    setBusy(true); setErr(null);
    try {
      await api(dishId ? '/specialist/dishes/' + dishId : '/specialist/dishes', {
        method: dishId ? 'PATCH' : 'POST',
        body: {
          name: name.trim(),
          cook_minutes: parseInt(minutes, 10) || null,
          meal_types: meals.length ? meals : ['lunch'],
          photo_url: photo,
          steps: clean,
          instructions: clean.map(s => s.text).filter(Boolean).join('\n') || null,
          ingredients: ings,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        },
      });
      haptic.success();
      leave();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось сохранить'); }
    finally { setBusy(false); }
  }

  async function remove() {
    try {
      await api('/specialist/dishes/' + dishId, { method: 'DELETE' });
      haptic.success();
      leave();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось удалить'); }
  }

  if (err && loading) return <Fail title="Блюдо" text={err} />;
  if (loading) return <Loading title="Блюдо" />;

  const title = dishId ? (mine ? 'Блюдо' : 'Блюдо каталога') : 'Новое блюдо';
  const field = {
    marginTop: S.sm, backgroundColor: p.inset, color: p.text,
    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 13, fontSize: 16,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={title} back
        right={mine ? (
          <Pressable onPress={save} disabled={busy} hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed || busy ? 0.5 : 1 })}>
            {busy
              ? <ActivityIndicator color={p.primary} />
              : <Text style={{ fontSize: 17, fontWeight: '600', color: p.primary }}>Готово</Text>}
          </Pressable>
        ) : undefined} />

      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
        }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {!mine ? (
            <Card style={{ marginTop: S.md, flexDirection: 'row', gap: S.md }}>
              <Icon name="lock" size={17} color={p.text3} />
              <Muted style={{ flex: 1, lineHeight: 19 }}>
                Это блюдо из общего каталога — его видят все специалисты, поэтому
                менять его нельзя. Чтобы получить свой вариант, создайте новое блюдо.
              </Muted>
            </Card>
          ) : null}

          {/* Заглавное фото. У чужого блюда без снимка рамку не рисуем:
              нажать на неё всё равно нельзя, а пустой квадрат во всю
              ширину — это экран пролистывания ни о чём. */}
          {mine || mediaUrl(photo) ? (
          <Pressable onPress={mine ? attachCover : undefined} disabled={!mine || cover}
            style={({ pressed }) => ({
              /* Квадрат и contain: снимки блюд квадратные, так они видны
                 целиком. Прежние 170 в высоту с обрезкой съедали у боула
                 половину тарелки — по такому фото блюдо не узнать. */
              width: '100%', aspectRatio: 1, borderRadius: R.lg, overflow: 'hidden',
              marginTop: S.md, backgroundColor: p.inset,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}>
            {mediaUrl(photo) ? (
              <Image source={{ uri: mediaUrl(photo)! }} style={{ width: '100%', height: '100%' }}
                contentFit="contain" transition={200} cachePolicy="memory-disk" />
            ) : null}
            {mine ? (
              <View style={{
                position: 'absolute', bottom: 12, alignSelf: 'center',
                flexDirection: 'row', alignItems: 'center', gap: 7,
                backgroundColor: p.surface, borderRadius: R.pill,
                paddingHorizontal: 14, paddingVertical: 8,
              }}>
                {cover ? <ActivityIndicator color={p.primary} size="small" />
                  : <Icon name="clip" size={15} color={p.text2} />}
                <Text style={{ ...FONT.small, color: p.text }}>
                  {photo ? 'Заменить фото' : 'Заглавное фото'}
                </Text>
              </View>
            ) : null}
          </Pressable>
          ) : null}

          <Label>Название</Label>
          <TextInput value={name} onChangeText={setName} editable={mine}
            placeholder="Например, овсянка с ягодами" placeholderTextColor={p.text3}
            style={field} />

          <Label>Время приготовления</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <TextInput value={minutes} onChangeText={setMinutes} editable={mine}
              keyboardType="number-pad" style={[field, { flex: 1 }]} />
            <Muted>минут</Muted>
          </View>

          <Label>Для каких приёмов</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.sm }}>
            {MEALS.map(([k, l]) => {
              const on = meals.includes(k);
              return (
                <Pressable key={k} disabled={!mine}
                  onPress={() => {
                    haptic.tap();
                    setMeals(m => (m.includes(k) ? m.filter(x => x !== k) : [...m, k]));
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 15, paddingVertical: 9, borderRadius: R.pill,
                    backgroundColor: on ? p.primary : p.inset,
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <Text style={{
                    ...FONT.small, fontWeight: '600',
                    color: on ? p.onPrimary : p.text2,
                  }}>{l}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Состав */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            marginTop: S.xl, marginBottom: S.sm,
          }}>
            <Text style={{ ...FONT.h3, color: p.text, flex: 1 }}>Состав</Text>
            {mine ? (
              <Pressable onPress={() => { haptic.tap(); setRows(rs => [...rs, emptyRow()]); }}
                hitSlop={10} style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  opacity: pressed ? 0.5 : 1,
                })}>
                <Icon name="plus" size={15} color={p.primary} width={2.2} />
                <Text style={{ ...FONT.small, color: p.primary, fontWeight: '600' }}>продукт</Text>
              </Pressable>
            ) : null}
          </View>

          {rows.map(r => (
            <IngRow key={r.key} row={r} base={base ?? []} editable={mine}
              onChange={patch => setRow(r.key, patch)}
              onRemove={() => setRows(rs => (rs.length > 1 ? rs.filter(x => x.key !== r.key) : rs))} />
          ))}

          {/* Живой пересчёт */}
          <Card style={{ marginTop: S.sm }}>
            {total.out > 0 ? (
              <Animated.View entering={FadeIn.duration(160)}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ ...FONT.h1, fontSize: 26, color: p.text }}>{round(total.k)}</Text>
                  <Muted>ккал во всём блюде · выход {round(total.out)} г</Muted>
                </View>
                <Muted style={{ marginTop: 4 }}>
                  Всего: Б {round(total.pr)} · Ж {round(total.f)} · У {round(total.c)}
                </Muted>
                <Muted style={{ marginTop: 2 }}>
                  На 100 г: {round(total.k / total.out * 100)} ккал ·
                  {' '}Б {round(total.pr / total.out * 100)} ·
                  {' '}Ж {round(total.f / total.out * 100)} ·
                  {' '}У {round(total.c / total.out * 100)}
                </Muted>
              </Animated.View>
            ) : (
              <Muted style={{ lineHeight: 19 }}>
                Добавьте продукты — калорийность и КБЖУ посчитаются сами.
              </Muted>
            )}
          </Card>

          {/* Шаги */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            marginTop: S.xl, marginBottom: S.sm,
          }}>
            <Text style={{ ...FONT.h3, color: p.text, flex: 1 }}>Как готовить</Text>
            {mine ? (
              <Pressable onPress={() => { haptic.tap(); setSteps(s => [...s, { text: '' }]); }}
                hitSlop={10} style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  opacity: pressed ? 0.5 : 1,
                })}>
                <Icon name="plus" size={15} color={p.primary} width={2.2} />
                <Text style={{ ...FONT.small, color: p.primary, fontWeight: '600' }}>шаг</Text>
              </Pressable>
            ) : null}
          </View>

          {steps.map((s, i) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, marginBottom: S.sm,
            }}>
              {/* Скрепка у чужого блюда ничего не открывает: снимок шага
                  туда не приложить. Показываем её только там, где она
                  работает, а вместо пустого квадрата — номер шага. */}
              {mine || mediaUrl(s.photo_url) ? (
                <Pressable onPress={mine ? () => attachStep(i) : undefined} disabled={!mine}
                  style={({ pressed }) => ({
                    width: 60, height: 60, borderRadius: R.md, overflow: 'hidden',
                    backgroundColor: p.inset, alignItems: 'center', justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  {mediaUrl(s.photo_url) ? (
                    <Image source={{ uri: mediaUrl(s.photo_url)! }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  ) : (
                    <Icon name="clip" size={17} color={p.text3} />
                  )}
                </Pressable>
              ) : (
                <View style={{
                  width: 30, minHeight: 60, alignItems: 'center', paddingTop: 19,
                }}>
                  <Text style={{ ...FONT.h3, color: p.text3 }}>{i + 1}</Text>
                </View>
              )}
              <TextInput
                value={s.text ?? ''} editable={mine} multiline
                onChangeText={t => setSteps(v => v.map((x, j) => (j === i ? { ...x, text: t } : x)))}
                placeholder={`Шаг ${i + 1}`} placeholderTextColor={p.text3}
                style={{
                  flex: 1, minHeight: 60, backgroundColor: p.inset, color: p.text,
                  borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 12,
                  fontSize: 15, lineHeight: 20,
                }} />
              {mine ? (
                <Pressable
                  onPress={() => setSteps(v => (v.length > 1 ? v.filter((_, j) => j !== i) : v))}
                  hitSlop={10}
                  style={({ pressed }) => ({ paddingTop: 21, opacity: pressed ? 0.5 : 1 })}>
                  <Icon name="close" size={15} color={p.text3} />
                </Pressable>
              ) : null}
            </View>
          ))}

          <Label>Теги через запятую</Label>
          <TextInput value={tags} onChangeText={setTags} editable={mine}
            placeholder="быстро, бюджетно" placeholderTextColor={p.text3}
            autoCapitalize="none" style={field} />

          {err ? (
            <Card style={{ marginTop: S.md }}>
              <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text>
            </Card>
          ) : null}

          {dishId && mine ? (
            <View style={{ alignItems: 'center', marginTop: S.xl }}>
              <SysConfirm label="Удалить блюдо" title="Удалить блюдо?"
                message="Оно исчезнет из каталога. Меню, где оно уже стоит, останутся как есть."
                confirmLabel="Удалить" onConfirm={remove} tint={p.danger} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Строка состава: поиск по пищевой базе прямо в поле. Выпадающий список
 * показываем только пока в поле есть фокус и что-то напечатано — иначе
 * он закрывал бы форму на всё время правки.
 */
function IngRow({ row, base, editable, onChange, onRemove }: {
  row: Row; base: Ingredient[]; editable: boolean;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const { p } = useApp();
  const [open, setOpen] = useState(false);

  const found = useMemo(() => {
    const q = row.name.trim().toLowerCase();
    if (!q) return base.slice(0, 12);
    return base.filter(a => a.name.toLowerCase().includes(q)).slice(0, 12);
  }, [row.name, base]);

  const picked = row.ingredient_id > 0;

  return (
    <View style={{ marginBottom: S.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <View style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm,
          backgroundColor: p.inset, borderRadius: R.md, paddingHorizontal: S.lg,
        }}>
          <Icon name={picked ? 'check' : 'bowl'} size={15}
            color={picked ? p.primary : p.text3} width={2} />
          <TextInput
            value={row.name} editable={editable}
            onChangeText={t => { onChange({ name: t, ingredient_id: 0 }); setOpen(true); }}
            onFocus={() => setOpen(true)}
            /* Закрываем с задержкой: иначе список исчезает раньше,
               чем палец успевает нажать на строку. */
            onBlur={() => setTimeout(() => setOpen(false), 160)}
            placeholder="Найдите продукт" placeholderTextColor={p.text3}
            style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: p.text }} />
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: p.inset, borderRadius: R.md, paddingHorizontal: 12,
        }}>
          <TextInput value={row.grams} editable={editable}
            onChangeText={t => onChange({ grams: t.replace(/[^\d.,]/g, '') })}
            keyboardType="decimal-pad"
            style={{ width: 44, paddingVertical: 12, fontSize: 15, color: p.text, textAlign: 'right' }} />
          <Muted>г</Muted>
        </View>
        {editable ? (
          <Pressable onPress={onRemove} hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Icon name="close" size={15} color={p.text3} />
          </Pressable>
        ) : null}
      </View>

      {open && editable && !picked ? (
        <View style={{
          marginTop: 4, backgroundColor: p.surface, borderRadius: R.md,
          borderWidth: 1, borderColor: p.borderSoft, overflow: 'hidden',
        }}>
          {found.length === 0 ? (
            <View style={{ padding: S.lg }}>
              <Muted>Такого продукта в базе нет. Добавить его можно в браузере.</Muted>
            </View>
          ) : found.map((a, i) => (
            <Pressable key={a.id}
              onPress={() => {
                haptic.tap();
                onChange({ ingredient_id: a.id, name: a.name });
                setOpen(false);
              }}
              style={({ pressed }) => ({
                paddingHorizontal: S.lg, paddingVertical: 11,
                borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
                backgroundColor: pressed ? p.inset : 'transparent',
              })}>
              <Text style={{ ...FONT.body, color: p.text }} numberOfLines={1}>{a.name}</Text>
              <Muted style={{ marginTop: 2 }}>
                {round(a.kcal)} ккал на 100 г · Б {round(a.protein)} ·
                {' '}Ж {round(a.fat)} · У {round(a.carbs)}
              </Muted>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
