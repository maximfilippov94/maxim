/**
 * Как начать — сразу после регистрации клиента.
 *
 * В вебе это шторка `clPostRegistrationChoice`, и она появляется до
 * того, как человек впервые увидит «Сегодня». В приложении её не было:
 * анкета сохранялась, и новый человек попадал на пустой экран дня —
 * без меню, без специалиста и без подсказки, что делать дальше.
 *
 * Два пути и «пока не сейчас». Отказ ничего не ломает: приложение
 * остаётся дневником, и об этом сказано прямо, а не умолчанием.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { api, AiState } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Icon } from '../src/ui/Icon';
import { Muted } from '../src/ui/base';
import { SysButton } from '../src/ui/system';
import { haptic } from '../src/haptics';

/** «09:58» — сколько осталось у приветственной скидки. */
function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
}

export default function Start() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [offer, setOffer] = useState<{ percent: number; left: number } | null>(null);

  /* Скидку спрашиваем у сервера, а не считаем сами: её срок идёт от
     времени регистрации, и показать «20%» там, где их уже нет, хуже,
     чем не показать вовсе. */
  useEffect(() => {
    let alive = true;
    api<AiState>('/client/ai')
      .then(r => {
        if (!alive) return;
        const w = r.welcome_offer;
        if (w?.eligible) setOffer({ percent: w.percent, left: w.seconds_left });
      })
      .catch(() => { /* без предложения экран работает так же */ });
    return () => { alive = false; };
  }, []);

  /* Отсчёт идёт на устройстве: сервер отдаёт остаток один раз, а
     каждую секунду переспрашивать его незачем. */
  useEffect(() => {
    if (!offer) return;
    const t = setInterval(() => {
      setOffer(o => (o && o.left > 1 ? { ...o, left: o.left - 1 } : null));
    }, 1000);
    return () => clearInterval(t);
  }, [offer]);

  const go = useCallback((to: string) => {
    haptic.tap();
    router.replace('/client');
    router.push(to as any);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={{
        paddingTop: insets.top + S.xxl,
        paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + S.xl,
      }}>
        <Text style={{ ...FONT.caption, color: p.text3, letterSpacing: 1.2 }}>
          ВАШ ПРОФИЛЬ ГОТОВ
        </Text>
        <Text style={{ ...FONT.h1, color: p.text, marginTop: 4 }}>Как хотите начать?</Text>
        <Muted style={{ marginTop: S.sm, lineHeight: 20 }}>
          Анкета сохранена. Выберите поддержку сейчас или продолжите самостоятельно —
          решение можно изменить позже.
        </Muted>

        <Animated.View entering={FadeInDown.duration(260)} style={{ marginTop: S.xl, gap: S.md }}>
          <Choice
            icon="users" kicker="ЛИЧНОЕ СОПРОВОЖДЕНИЕ"
            title="Выбрать специалиста"
            note="Каталог нутрициологов, тренеров и других экспертов"
            onPress={() => go('/specialist')} />

          <Choice
            icon="spark"
            kicker={offer ? `EQUA AI · СКИДКА ${offer.percent}%` : 'EQUA AI'}
            title="Получить персональный план"
            note="Питание или тренировки сразу после оформления"
            extra={offer ? `Предложение действует ${clock(offer.left)}` : null}
            onPress={() => go('/ai')} />
        </Animated.View>

        <View style={{ marginTop: S.xl }}>
          <SysButton label="Пока не сейчас"
            onPress={() => { haptic.tap(); router.replace('/client'); }} />
        </View>

        <Muted style={{ marginTop: S.md, lineHeight: 18 }}>
          Без выбранной услуги экран «Сегодня» останется дневником без назначенного плана.
        </Muted>
      </ScrollView>
    </View>
  );
}

/** Путь: крупная карточка, чтобы выбор читался с одного взгляда. */
function Choice({ icon, kicker, title, note, extra, onPress }: {
  icon: string; kicker: string; title: string; note: string;
  extra?: string | null; onPress: () => void;
}) {
  const { p } = useApp();
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: S.lg,
          backgroundColor: p.surface, borderRadius: R.lg, padding: S.xl,
          borderWidth: 1, borderColor: p.border,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        }}>
          <View style={{
            width: 46, height: 46, borderRadius: 23,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: p.primarySoft,
          }}>
            <Icon name={icon} size={21} color={p.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...FONT.caption, color: p.text3 }}>{kicker}</Text>
            <Text style={{ ...FONT.h3, color: p.text, marginTop: 1 }}>{title}</Text>
            <Muted style={{ marginTop: 2, lineHeight: 18 }}>{note}</Muted>
            {extra ? (
              <Text style={{ ...FONT.small, color: p.accent, marginTop: 4 }}>{extra}</Text>
            ) : null}
          </View>
          <Icon name="chevr" size={15} color={p.text3} width={2} />
        </View>
      )}
    </Pressable>
  );
}
