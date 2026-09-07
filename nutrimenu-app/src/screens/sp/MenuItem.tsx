/**
 * Блюдо из меню клиента глазами специалиста.
 *
 * Раньше нажатие на строку разворачивало один ползунок — состав и
 * рецепт приходилось искать в базе блюд отдельно. Здесь карточка
 * целиком: снимок, порция, КБЖУ, состав с граммовкой под эту порцию
 * и рецепт.
 *
 * Состав пересчитываем от порции: в базе он записан на порцию по
 * рецепту, и показывать её, когда клиенту назначено вдвое меньше,
 * значит вводить в заблуждение.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api, mediaUrl, DishFull, MEAL_TITLES } from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Label, Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { SysSlider, SysConfirm, Empty } from '../../ui/system';
import { round } from '../../format';
import { haptic } from '../../haptics';

export default function SpMenuItem() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const q = useLocalSearchParams<{
    item?: string; dish?: string; meal?: string; portion?: string; base?: string;
  }>();
  const itemId = Number(q.item) || 0;
  const dishId = Number(q.dish) || 0;

  const [d, setD] = useState<DishFull | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [g, setG] = useState(Number(q.portion) || 0);

  useEffect(() => {
    api<{ dish: DishFull }>(`/specialist/dishes/${dishId}`)
      .then(r => setD(r.dish))
      .catch(e => { setErr(e?.message ?? 'Блюдо не открылось'); setD(null); });
  }, [dishId]);

  const save = useCallback(async (v: number) => {
    try { await api(`/specialist/menu-items/${itemId}`, { method: 'PATCH', body: { portion_g: v } }); }
    catch (e: any) { haptic.error(); setErr(e?.message ?? 'Порция не сохранилась'); }
  }, [itemId]);

  const remove = useCallback(async () => {
    try {
      await api(`/specialist/menu-items/${itemId}`, { method: 'DELETE' });
      haptic.success();
      if (router.canGoBack()) router.back(); else router.replace('/sp/clients');
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось убрать'); }
  }, [itemId]);

  if (d === null) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back />
        <Empty icon="exclamationmark.triangle" title="Блюдо не открылось" note={err ?? ''} />
      </View>
    );
  }
  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back />
        <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  /* Границы те же, что у ползунка в меню и что проверяет сервер. */
  const base = round(Number(q.base) || d.base_portion_g || 0) || round(Number(q.portion)) || 200;
  const lo = Math.max(10, Math.round(base * 0.25 / 5) * 5);
  const hi = Math.round(base * 2.5 / 5) * 5;
  const per = (v?: number | null) => round((v ?? 0) * g / 100);
  const photo = mediaUrl(d.photo_url);
  /* Во сколько раз порция отличается от рецептурной — на столько же
     меняется каждый ингредиент. */
  const k = d.base_portion_g ? g / d.base_portion_g : 1;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>

        <Label>{MEAL_TITLES[String(q.meal)] ?? 'Блюдо'}</Label>
        <Text style={{ ...FONT.h1, color: p.text, marginTop: S.xs, marginBottom: S.lg }}>
          {d.name}
        </Text>

        <Animated.View entering={FadeInDown.duration(240)}>
          <View style={{
            width: '100%', aspectRatio: 1, borderRadius: R.lg, overflow: 'hidden',
            backgroundColor: p.inset, marginBottom: S.md,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="bowl" size={34} color={p.text3} />
            {photo ? (
              <Image source={{ uri: photo }}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
                contentFit="cover" transition={220} cachePolicy="memory-disk" />
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(40).duration(240)}>
          <Card style={{ marginBottom: S.md }}>
            <Label>Порция</Label>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
              <Text style={{ ...FONT.num, color: p.text }}>{g}</Text>
              <Muted style={{ marginLeft: 6 }}>
                г{g === round(base) ? ' · по рецепту' : ` · по рецепту ${round(base)} г`}
              </Muted>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: S.sm }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: p.text }}>
                {per(d.kcal_100)}
              </Text>
              <Muted style={{ marginLeft: 5 }}>
                ккал · Б {per(d.protein_100)} · Ж {per(d.fat_100)} · У {per(d.carbs_100)} г
              </Muted>
            </View>
            <View style={{ marginTop: S.sm }}>
              <SysSlider value={g} min={lo} max={hi} step={5} onChange={setG} onCommit={save} />
            </View>
          </Card>
        </Animated.View>

        {d.ingredients?.length ? (
          <Animated.View entering={FadeInDown.delay(80).duration(240)}>
            <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>
              Состав
            </Text>
            <Card style={{ padding: 0, marginBottom: S.md }}>
              {d.ingredients.map((ing, i) => (
                <View key={ing.ingredient_id + '-' + i} style={{
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

        {d.instructions ? (
          <Animated.View entering={FadeInDown.delay(120).duration(240)}>
            <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>
              Рецепт
            </Text>
            <Card style={{ marginBottom: S.md }}>
              <Text style={{ fontSize: 15, lineHeight: 22, color: p.text2 }}>{d.instructions}</Text>
            </Card>
          </Animated.View>
        ) : null}

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginBottom: S.md }}>{err}</Text>
        ) : null}

        <View style={{ alignItems: 'center', marginTop: S.md }}>
          <SysConfirm label="Убрать из меню" tint={p.danger}
            title={`Убрать «${d.name}»?`}
            message="Блюдо исчезнет из меню клиента."
            confirmLabel="Убрать из меню" onConfirm={remove} />
        </View>
      </ScrollView>
    </View>
  );
}
