/**
 * Выбор замены блюда.
 *
 * Одна шторка на два места: кнопка «заменить» в строке дня и «Заменить
 * блюдо» внутри карточки. Раньше это были разные вещи — из дня человека
 * уносило на экран блюда, а там список замен шёл текстом без снимков, и
 * расхождения по КБЖУ были набраны лаймом по светлой карточке, то есть
 * не читались вовсе.
 *
 * Снимок у замены есть всегда, когда он есть у блюда: сервер отдаёт
 * `photo_url` и `photo_thumb_url` в том же ответе — их просто не брали.
 *
 * Замена подтверждается отдельной кнопкой, как в вебе: нажатие по
 * карточке только выбирает. Меню меняется у специалиста на глазах, и
 * случайное касание не должно его переписывать.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store';
import { api, mediaUrl, Replacement, ReplacementSource } from '../api';
import { S, R, FONT, alpha } from '../theme';
import { Icon } from './Icon';
import { SysButton } from './system';
import { round } from '../format';
import { haptic } from '../haptics';

/** «+12» и «−7»: знак обязателен, иначе непонятно, больше стало или меньше. */
const signed = (n: number) => (n > 0 ? `+${round(n)}` : String(round(n)));

/**
 * Насколько замена расходится с исходным блюдом. Пороги у показателей
 * разные: 15 ккал незаметны, а 15 г белка — уже другой приём пищи.
 * В пределах порога — спокойная плашка, за порогом — предупреждающая.
 */
function Diff({ n, lim, text }: { n: number; lim: number; text: string }) {
  const { p } = useApp();
  const ok = Math.abs(n) <= lim;
  return (
    <View style={{
      paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
      backgroundColor: ok ? p.ov2 : alpha(p.warn, 16),
    }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: ok ? p.text2 : p.warn }}>
        {text}
      </Text>
    </View>
  );
}

export function ReplacePicker({ itemId, open, onClose, onDone }: {
  /** Позиция меню, которую меняем */
  itemId: number;
  open: boolean;
  onClose: () => void;
  /** Замена прошла — обновить экран, с которого позвали */
  onDone: () => void;
}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<Replacement[] | null>(null);
  const [src, setSrc] = useState<ReplacementSource>('auto');
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setList(null); setErr(null); setPick(null);
    try {
      const r = await api<{ dishes: Replacement[]; source: ReplacementSource }>(
        `/client/menu-items/${itemId}/replacements`);
      setSrc(r.source ?? 'auto');
      setList(r.dishes ?? []);
      /* Первая строка выбрана заранее — как в вебе: обычно берут её, и
         лишнее нажатие ни к чему. */
      if (r.dishes?.length) setPick(r.dishes[0].id);
    } catch (e: any) {
      setList([]); setErr(e?.message ?? 'Замены недоступны');
    }
  }, [itemId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const apply = useCallback(async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await api(`/client/menu-items/${itemId}/replace`, { method: 'POST', body: { dish_id: pick } });
      haptic.success(); onClose(); onDone();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Эта замена недоступна');
    } finally { setBusy(false); }
  }, [pick, itemId, onClose, onDone]);

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(9,16,18,0.6)' }} />
      <Animated.View entering={SlideInDown.duration(280)} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%',
        backgroundColor: p.surface,
        borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
        paddingBottom: insets.bottom + S.lg,
      }}>
        <View style={{
          width: 38, height: 4, borderRadius: 999, backgroundColor: p.border,
          alignSelf: 'center', marginTop: 10, marginBottom: S.sm,
        }} />

        <View style={{
          flexDirection: 'row', alignItems: 'flex-start', gap: S.md,
          paddingHorizontal: S.lg, paddingBottom: S.md,
        }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...FONT.caption, color: p.text3 }}>Замена без пересборки дня</Text>
            <Text style={{ ...FONT.h2, color: p.text, marginTop: 2 }}>Чем заменить</Text>
            <Text style={{ ...FONT.small, color: p.text3, marginTop: 4, lineHeight: 18 }}>
              {src === 'specialist'
                ? 'Варианты, которые разрешил специалист'
                : 'Подобрали блюда с близкими КБЖУ'}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}
            accessibilityRole="button" accessibilityLabel="Закрыть"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingTop: 4 })}>
            <Icon name="close" size={18} color={p.text3} />
          </Pressable>
        </View>

        {list === null ? (
          <ActivityIndicator color={p.accent} style={{ marginVertical: S.xxl }} />
        ) : list.length === 0 ? (
          <View style={{ paddingHorizontal: S.lg, paddingBottom: S.lg }}>
            <Text style={{ ...FONT.body, color: p.text2 }}>
              {err ?? 'Подходящих блюд для этого приёма не нашлось.'}
            </Text>
          </View>
        ) : (
          <>
            <ScrollView style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingHorizontal: S.lg, gap: S.sm }}
              showsVerticalScrollIndicator={false}>
              {list.map(d => {
                const on = pick === d.id;
                const photo = mediaUrl(d.photo_thumb_url || d.photo_url || null);
                return (
                  <Pressable key={d.id} onPress={() => { haptic.select(); setPick(d.id); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'stretch', gap: S.md,
                      borderRadius: R.md, overflow: 'hidden',
                      borderWidth: 1.5, borderColor: on ? p.primary : p.border,
                      backgroundColor: pressed ? p.ov1 : on ? p.primarySofter : 'transparent',
                    })}>
                    {photo ? (
                      <Image source={{ uri: photo }} style={{ width: 86, backgroundColor: p.inset }}
                        contentFit="cover" transition={200} cachePolicy="memory-disk" />
                    ) : (
                      <View style={{ width: 86, backgroundColor: p.inset,
                        alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="bowl" size={20} color={p.text3} />
                      </View>
                    )}

                    <View style={{ flex: 1, minWidth: 0, paddingVertical: 11, paddingRight: 11 }}>
                      <Text numberOfLines={2} style={{
                        fontSize: 15, fontWeight: '600', lineHeight: 19, color: p.text,
                      }}>{d.name}</Text>
                      <Text style={{ ...FONT.small, color: p.text2, marginTop: 4 }}>
                        {round(d.portion_g)} г · {round(d.kcal)} ккал
                      </Text>
                      <Text style={{ fontSize: 11, color: p.text3, marginTop: 3 }}>
                        Б {round(d.protein)} г   Ж {round(d.fat)} г   У {round(d.carbs)} г
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                        <Diff n={d.kcal_diff} lim={15}
                          text={Math.abs(d.kcal_diff) <= 15
                            ? 'калории те же' : `${signed(d.kcal_diff)} ккал`} />
                        <Diff n={d.protein_diff} lim={9} text={`Б ${signed(d.protein_diff)}`} />
                        <Diff n={d.fat_diff} lim={9} text={`Ж ${signed(d.fat_diff)}`} />
                        <Diff n={d.carbs_diff} lim={14} text={`У ${signed(d.carbs_diff)}`} />
                      </View>
                    </View>

                    {on ? (
                      <View style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 22, height: 22, borderRadius: 11,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: p.primary,
                      }}>
                        <Icon name="check" size={13} color={p.onPrimary} width={2.6} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={{ paddingHorizontal: S.lg, paddingTop: S.md, gap: S.sm }}>
              {err ? (
                <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text>
              ) : (
                <Text style={{ ...FONT.small, color: p.text3, lineHeight: 18 }}>
                  Калорийность приёма сохраняется максимально близко.
                  Меню изменится только после подтверждения.
                </Text>
              )}
              <SysButton label="Подтвердить замену" variant="prominent"
                disabled={busy || !pick} onPress={apply} />
            </View>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}
