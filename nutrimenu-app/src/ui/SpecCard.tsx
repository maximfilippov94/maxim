/**
 * Карточка специалиста в каталоге.
 *
 * Отвечает на четыре вопроса, по которым человека и выбирают: кто это
 * (фото, имя, проверен ли), когда был в сети, что о нём говорят
 * (рейтинг, отзывы, «очень хвалят») и что он делает и почём — услуги
 * с ценой и мерой прямо в карточке. Кнопка «Выбрать» стоит в самой
 * карточке: если человек уже решил, лезть в профиль незачем. Нажатие
 * на остальную часть открывает профиль.
 */
import React from 'react';
import { View, Text, Pressable, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useApp } from '../store';
import { CatalogSpecialist } from '../api';
import { rub, plural, seenPhrase, svcUnit, specRate } from '../format';
import { S, R, FONT } from '../theme';
import { Icon } from './Icon';
import { Muted } from './base';
import { haptic } from '../haptics';

export const PROF: Record<string, string> = {
  nutritionist: 'Нутрициолог', trainer: 'Тренер',
  endocrinologist: 'Эндокринолог', coach: 'Коуч',
};

export function SpecCard({ s, fav, onFav, onOpen, onPick, busy }: {
  s: CatalogSpecialist;
  fav: boolean;
  onFav: () => void;
  onOpen: () => void;
  onPick: () => void;
  busy?: boolean;
}) {
  const { p } = useApp();
  const revs = s.reviews_count ?? 0;
  const rate = s.rating ?? 0;
  /* «Рекомендуют» — не украшение, а порог: пятёрка при единственном
     отзыве ничего не значит, поэтому нужны и оценка, и число отзывов. */
  const praised = rate >= 4.8 && revs >= 3;
  const svcs = s.services ?? [];
  const more = Math.max(0, (s.services_count ?? svcs.length) - svcs.length);

  return (
    <View style={{
      backgroundColor: p.surface, borderRadius: R.lg, overflow: 'hidden', marginBottom: S.md,
    }}>
      <Pressable onPress={() => { haptic.tap(); onOpen(); }}
        style={({ pressed }) => ({ padding: S.lg, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ flexDirection: 'row', gap: S.md, paddingRight: 34 }}>
          <Face url={s.avatar_url} name={s.name} size={54} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ ...FONT.h3, fontSize: 16, color: p.text, flexShrink: 1 }}
                numberOfLines={1}>{s.name}</Text>
              {s.verified ? <VerifiedMark compact /> : null}
            </View>
            <Text style={{ ...FONT.small, color: p.text3, marginTop: 2 }}>
              {seenPhrase(s.last_seen_at) || PROF[s.profession ?? 'nutritionist'] || 'Специалист'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: S.sm }}>
              <Pill icon="star" iconColor={p.premium} text={specRate(s.rating)} />
              <Pill text={`${revs} ${plural(revs, ['отзыв', 'отзыва', 'отзывов'])}`} />
              {s.identity_verified
                ? <Pill icon="shield" iconColor={p.accent} text="Паспорт" color={p.accent} />
                : null}
            </View>
            {praised ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 }}>
                <Icon name="star" size={13} color={p.premium} />
                <Text style={{ ...FONT.small, fontWeight: '700', color: p.premium }}>
                  Рекомендуют
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {svcs.length ? (
          <View style={{
            marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: p.border,
          }}>
            {svcs.map((v, k) => (
              <View key={k} style={{
                flexDirection: 'row', alignItems: 'baseline',
                justifyContent: 'space-between', gap: S.md, paddingVertical: 3,
              }}>
                <Text style={{ ...FONT.small, color: p.text2, flex: 1 }} numberOfLines={1}>
                  {v.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
                  <Text style={{ ...FONT.small, fontWeight: '700', color: p.text }}>
                    {rub(v.price_kop)}
                  </Text>
                  <Text style={{ ...FONT.small, color: p.text3 }}>{svcUnit(v)}</Text>
                </View>
              </View>
            ))}
            {more ? (
              <Text style={{ ...FONT.small, fontWeight: '700', color: p.accent, marginTop: 5 }}>
                Ещё {more} {plural(more, ['услуга', 'услуги', 'услуг'])}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          gap: S.md, marginTop: S.md,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <Icon name="device" size={15} color={p.text3} />
            <Muted numberOfLines={1}>Работает дистанционно</Muted>
          </View>
          {s.city ? <Muted numberOfLines={1}>{s.city}</Muted> : null}
        </View>
      </Pressable>

      {/* Закладка лежит поверх нажимаемой середины, но своей кнопкой:
          вложенные Pressable перехватывают нажатие сами. */}
      <Pressable onPress={() => { haptic.tap(); onFav(); }} hitSlop={8}
        style={{
          position: 'absolute', top: 8, right: 8, width: 34, height: 34,
          alignItems: 'center', justifyContent: 'center',
        }}>
        <Icon name="heart" size={19} color={fav ? p.danger : p.text3} width={fav ? 2.4 : 1.8} />
      </Pressable>

      <Pressable disabled={busy} onPress={() => { haptic.tap(); onPick(); }}
        style={({ pressed }) => ({
          paddingVertical: 13, alignItems: 'center',
          borderTopWidth: 1, borderTopColor: p.border,
          backgroundColor: pressed ? p.primarySoft : p.inset,
        })}>
        <Text style={{ ...FONT.body, fontWeight: '700', color: p.accent }}>
          Выбрать специалиста
        </Text>
      </Pressable>
    </View>
  );
}

function Pill({ icon, iconColor, text, color }: {
  icon?: string; iconColor?: string; text: string; color?: string;
}) {
  const { p } = useApp();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: p.inset, borderRadius: R.pill,
      paddingHorizontal: 9, paddingVertical: 3,
    }}>
      {icon ? <Icon name={icon as any} size={13} color={iconColor ?? p.text2} /> : null}
      <Text style={{ ...FONT.small, fontWeight: '600', color: color ?? p.text2 }}>{text}</Text>
    </View>
  );
}

/**
 * Отметка о проверке.
 *
 * Ставится только тогда, когда команда EQUA сверила диплом или
 * сертификаты. Это обещание клиенту, поэтому выглядит одинаково здесь,
 * в каталоге на сайте и на публичной странице специалиста.
 */
export function VerifiedMark({ style, compact }: { style?: ViewStyle; compact?: boolean }) {
  const { p } = useApp();
  if (compact) {
    return (
      <View style={[{
        width: 17, height: 17, borderRadius: 9, backgroundColor: p.accent,
        alignItems: 'center', justifyContent: 'center',
      }, style]}>
        <Icon name="check" size={11} color="#fff" width={3} />
      </View>
    );
  }
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: p.primarySoft, borderRadius: R.pill,
      paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
    }, style]}>
      <Icon name="shield" size={13} color={p.accent} width={2} />
      <Text style={{ ...FONT.small, fontWeight: '600', color: p.accent }}>Проверен</Text>
    </View>
  );
}

/** Фото специалиста, а если его нет — первая буква имени на подложке. */
export function Face({ url, name, size }: { url?: string | null; name: string; size: number }) {
  const { p } = useApp();
  if (url) {
    return (
      <Image source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.inset }}
        contentFit="cover" transition={200} cachePolicy="memory-disk" />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: p.primarySoft,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: p.accent }}>
        {(name || '·').trim()[0]?.toUpperCase() ?? '·'}
      </Text>
    </View>
  );
}
