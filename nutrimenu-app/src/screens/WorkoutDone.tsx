/**
 * Итог тренировки: сколько заняло, сколько сожгли, что сказал человек и
 * чем восстановиться.
 *
 * Цифры набегают за 700 мс — это редкий момент, ему можно чуть больше
 * движения, чем рабочим экранам: счётчик подаёт результат как
 * результат, а не как надпись. При включённом «уменьшении движения»
 * они просто появляются готовыми.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { AccessibilityInfo } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, mediaUrl, WoSession, WoRecovery, WO_FEEL } from '../api';
import { S, R, FONT } from '../theme';
import { Card, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { plural } from '../format';

function Count({ to, size = 26 }: { to: number; size?: number }) {
  const { p } = useApp();
  const [v, setV] = useState(0);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (!live) return;
      if (reduce) { setV(to); return; }
      const t0 = Date.now(), dur = 700;
      const tick = () => {
        if (!live) return;
        const k = Math.min(1, (Date.now() - t0) / dur);
        setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return () => { live = false; };
  }, [to]);
  return (
    <Text style={{ fontSize: size, fontWeight: '700', color: p.text, letterSpacing: -0.8 }}>
      {v}
    </Text>
  );
}

export default function WorkoutDone() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const q = useLocalSearchParams<{ id?: string }>();
  const id = Number(q.id) || 0;
  const [s, setS] = useState<WoSession | null>(null);
  const [rec, setRec] = useState<WoRecovery | null>(null);

  useEffect(() => {
    api<{ session: WoSession; recovery?: WoRecovery }>(`/client/sessions/${id}`)
      .then(r => { setS(r.session); if (r.recovery) setRec(r.recovery); })
      .catch(() => {});
  }, [id]);

  if (!s) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  const secs = s.duration_sec ?? 0;
  const feel = s.feeling ? WO_FEEL[s.feeling - 1] : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + S.xxl, paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + S.xxl,
      }}>
      <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', marginBottom: S.xl }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32, backgroundColor: p.primarySoft,
          alignItems: 'center', justifyContent: 'center', marginBottom: S.lg,
        }}>
          <Icon name="check" size={30} color={p.accent} />
        </View>
        <Text style={{ ...FONT.h1, color: p.text }}>Готово</Text>
        <Muted style={{ marginTop: 4 }}>{s.workout?.title ?? ''}</Muted>
      </Animated.View>

      <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
        {[[secs < 60 ? secs : Math.round(secs / 60), secs < 60 ? 'секунд' : 'минут'],
          [s.kcal ?? 0, 'ккал'],
          [s.sets?.length ?? 0, plural(s.sets?.length ?? 0, ['подход', 'подхода', 'подходов'])]]
          .map(([v, l]) => (
            <Card key={String(l)} style={{ flex: 1, alignItems: 'center', paddingVertical: S.lg }}>
              <Count to={Number(v)} />
              <Text numberOfLines={1} style={{ fontSize: 11.5, color: p.text3 }}>{String(l)}</Text>
            </Card>
          ))}
      </View>

      {feel ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg }}>
          <Text style={{ fontSize: 26 }}>{feel[2]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: p.text }}>{feel[1]}</Text>
            {s.comment ? <Muted>«{s.comment}»</Muted> : null}
          </View>
        </Card>
      ) : null}

      {rec ? (
        <>
          <Text style={{ ...FONT.h3, color: p.text, marginBottom: S.sm }}>
            Рекомендуем восстановление
          </Text>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md }}>
            <View style={{
              width: 56, height: 56, borderRadius: R.md, overflow: 'hidden',
              backgroundColor: p.inset, alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="bowl" size={22} color={p.text3} />
              {mediaUrl(rec.photo_url) ? (
                <Image source={{ uri: mediaUrl(rec.photo_url)! }}
                  style={{ position: 'absolute', width: '100%', height: '100%' }}
                  contentFit="cover" transition={200} />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: p.text }}>{rec.name}</Text>
              <Muted numberOfLines={2}>
                {rec.kcal} ккал · белок {rec.protein} г · порция {rec.portion_g} г
              </Muted>
            </View>
          </Card>
          <Muted style={{ marginTop: S.md, marginBottom: S.xl }}>
            Белок после нагрузки — то, из чего мышца восстанавливается. Блюдо есть в базе:
            попросите специалиста поставить его в меню.
          </Muted>
        </>
      ) : <View style={{ height: S.xl }} />}

      <SysButton label="К тренировкам" variant="prominent"
        onPress={() => router.replace('/client/workouts')} />
    </ScrollView>
  );
}
