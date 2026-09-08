/**
 * Отзывы о специалисте — его собственный экран.
 *
 * Читать можно, править нельзя: отзыв, который специалист может стереть,
 * ничего не стоит. Убрать брань или чужие личные данные может только
 * владелец сервиса, и только с указанием причины.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api, Review } from '../../api';
import { plural } from '../../format';
import { S, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Loading, Fail } from '../Shopping';

interface Data { rating: number | null; count: number; reviews: Review[] }

function day(v?: string | null) {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(+d)) return String(v);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SpReviews() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setD(await api<Data>('/specialist/reviews')); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось открыть'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (err && !d) return <Fail title="Отзывы" text={err} />;
  if (!d) return <Loading title="Отзывы" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Отзывы" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
      }} showsVerticalScrollIndicator={false}>

        <Card style={{ marginTop: S.md, alignItems: 'center', paddingVertical: S.xl }}>
          {d.rating != null ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <Icon name="star" size={26} color={p.premium} width={1.9} />
                <Text style={{ ...FONT.h1, color: p.text }}>{d.rating}</Text>
              </View>
              <Muted style={{ marginTop: 4 }}>
                {d.count} {plural(d.count, ['отзыв', 'отзыва', 'отзывов'])}
              </Muted>
            </>
          ) : (
            <>
              <Text style={{ ...FONT.h3, color: p.text }}>Отзывов пока нет</Text>
              <Muted style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
                Их оставляют клиенты, которых вы ведёте. Рейтинг в каталоге
                считается только из них.
              </Muted>
            </>
          )}
        </Card>

        {d.reviews.map((r, i) => (
          <Animated.View key={r.id}
            entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(200)}>
            <Card style={{ marginTop: S.md, gap: S.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <Icon key={n} name="star" size={14}
                      color={n <= r.rating ? p.premium : p.text3} width={1.9} />
                  ))}
                </View>
                <View style={{ flex: 1 }} />
                <Muted>{day(r.created_at)}</Muted>
              </View>
              {r.body ? (
                <Text style={{ ...FONT.body, color: p.text, lineHeight: 21 }}>{r.body}</Text>
              ) : null}
              <Muted>{r.author}</Muted>
            </Card>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}
