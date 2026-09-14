import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useApp } from '../store';
import { api, Specialist, CatalogSpecialist } from '../api';
import { rub, plural } from '../format';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton, Empty } from '../ui/system';
import { haptic } from '../haptics';
import { Loading } from './Shopping';

const PROF: Record<string, string> = {
  nutritionist: 'Нутрициолог', trainer: 'Тренер', coach: 'Коуч',
};

export default function MySpecialist() {
  const { p, refreshMe } = useApp();
  const insets = useSafeAreaInsets();
  const [spec, setSpec] = useState<Specialist | null | undefined>(undefined);
  const [list, setList] = useState<CatalogSpecialist[]>([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ specialist: Specialist | null }>('/client/my-specialist');
      setSpec(r.specialist);
      if (!r.specialist) {
        const c = await api<{ specialists: CatalogSpecialist[] }>('/catalog');
        setList(c.specialists ?? []);
      }
    } catch (e: any) { setErr(e.message); setSpec(null); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Выбрали специалиста — показываем его услуги: это следующий шаг в
     разговоре, а не отдельная тема, за которой надо идти в «Ещё».
     Услуг нет — оставляем человека здесь, пустой прайс никому не нужен. */
  const toServices = useCallback(async () => {
    try {
      const r = await api<{ services?: unknown[] }>('/client/services');
      if ((r.services ?? []).length) { router.push('/services'); return true; }
    } catch { /* не дошло — не беда, экран уже показывает специалиста */ }
    return false;
  }, []);

  const connect = useCallback(async (body: object) => {
    setBusy(true); setErr(null);
    try {
      await api('/client/connect', { method: 'POST', body });
      haptic.success();
      await refreshMe();
      await load();
      await toServices();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось подключиться'); }
    finally { setBusy(false); }
  }, [refreshMe, load, toServices]);

  const byCode = useCallback(async () => {
    const c = code.trim().toUpperCase();
    if (!c) { setErr('Введите код специалиста'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/client/connect-code', { method: 'POST', body: { code: c } });
      haptic.success();
      await refreshMe();
      await load();
      await toServices();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Код не подошёл'); }
    finally { setBusy(false); }
  }, [code, refreshMe, load, toServices]);

  if (spec === undefined) return <Loading title="Мой специалист" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Мой специалист" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
      }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text>
        ) : null}

        {spec ? (
          <Animated.View entering={FadeInDown.duration(240)}>
            <Card style={{ marginTop: S.md, alignItems: 'center', paddingVertical: S.xl }}>
              <Face url={spec.avatar_url} name={spec.name} size={80} />
              <Text style={{ ...FONT.h2, color: p.text, marginTop: S.md }}>{spec.name}</Text>
              <Muted style={{ marginTop: 2 }}>
                {PROF[spec.profession ?? 'nutritionist'] ?? 'Специалист'}
              </Muted>
              {spec.verified ? <VerifiedMark style={{ marginTop: S.sm, alignSelf: 'center' }} /> : null}
            </Card>
            <View style={{ gap: S.md, marginTop: S.lg }}>
              <SysButton label="Написать" icon="bubble.left" variant="prominent"
                onPress={() => { haptic.tap(); router.push('/client/chat'); }} />
              <SysButton label="Услуги и цены" icon="tag"
                onPress={() => { haptic.tap(); router.push('/services'); }} />
            </View>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(240)}>
              <Card style={{ marginTop: S.md, marginBottom: S.md }}>
                <Label>У меня есть код</Label>
                <Muted style={{ marginTop: S.sm }}>
                  Специалист может дать код или ссылку-приглашение.
                </Muted>
                <TextInput
                  value={code}
                  onChangeText={t => { setCode(t.toUpperCase()); setErr(null); }}
                  placeholder="240A14"
                  placeholderTextColor={p.text3}
                  autoCapitalize="characters"
                  maxLength={12}
                  style={{
                    marginTop: S.md, backgroundColor: p.inset, color: p.text,
                    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 13,
                    fontSize: 19, fontWeight: '700', letterSpacing: 2,
                  }}
                />
                <View style={{ marginTop: S.md }}>
                  <SysButton label="Подключиться" variant="prominent"
                    disabled={busy} onPress={byCode} />
                </View>
              </Card>
            </Animated.View>

            <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>
              Или выберите из каталога
            </Text>
            {list.length === 0 ? (
              <Empty icon="person.crop.circle.badge.questionmark"
                title="Каталог пуст"
                note="Попросите у специалиста код приглашения." />
            ) : list.map((s, i) => (
              <Animated.View key={s.id} entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(220)}>
                <Card style={{ marginBottom: S.md }}>
                  <View style={{ flexDirection: 'row', gap: S.md }}>
                    <Face url={s.avatar_url} name={s.name} size={54} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center',
                        gap: S.sm, flexWrap: 'wrap' }}>
                        <Text style={{ ...FONT.h3, color: p.text }}>{s.name}</Text>
                        {s.verified ? <VerifiedMark /> : null}
                      </View>
                      <Muted style={{ marginTop: 2 }}>
                        {[PROF[s.profession ?? 'nutritionist'], s.city].filter(Boolean).join(' · ')}
                      </Muted>
                      {/* Нет отзывов — нет и звёзд: пятёрка из воздуха
                          обесценивает те оценки, что настоящие. */}
                      {s.rating ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                          <Icon name="star" size={13} color={p.premium} />
                          <Muted>
                            {s.rating} · {s.reviews_count ?? 0} {plural(s.reviews_count ?? 0, ['отзыв', 'отзыва', 'отзывов'])}
                          </Muted>
                        </View>
                      ) : (
                        <Muted style={{ marginTop: 4 }}>Отзывов пока нет</Muted>
                      )}
                    </View>
                  </View>
                  {s.bio ? (
                    <Text style={{ ...FONT.body, color: p.text2, marginTop: S.md, lineHeight: 19 }}
                      numberOfLines={3}>{s.bio}</Text>
                  ) : null}

                  {/* Услуги с ценами прямо в карточке: человек выбирает
                      по тому, что ему сделают и почём. Раньше стояла
                      одна цена «от», и по ней было не понять, за что. */}
                  {s.services?.length ? (
                    <View style={{ marginTop: S.md, paddingTop: S.md,
                      borderTopWidth: 1, borderTopColor: p.border }}>
                      {s.services.map((v, k) => (
                        <View key={k} style={{ flexDirection: 'row', alignItems: 'baseline',
                          justifyContent: 'space-between', gap: S.md, paddingVertical: 3 }}>
                          <Text style={{ ...FONT.small, color: p.text2, flex: 1 }}
                            numberOfLines={1}>{v.title}</Text>
                          <Text style={{ ...FONT.small, fontWeight: '700', color: p.text, flexShrink: 0 }}>
                            {rub(v.price_kop)}{v.kind === 'subscription'
                              ? ` / ${v.period_days === 7 ? 'неделя' : v.period_days && v.period_days !== 30
                                  ? `${v.period_days} дн.` : 'месяц'}`
                              : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.md, gap: S.md }}>
                    {s.identity_verified ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Icon name="shield" size={14} color={p.accent} width={1.9} />
                        <Muted>паспорт сверен</Muted>
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }} />
                    <SysButton label="Выбрать" width={128} height={44}
                      disabled={busy} onPress={() => connect({ specialist_id: s.id })} />
                  </View>
                </Card>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
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
function VerifiedMark({ style }: { style?: ViewStyle }) {
  const { p } = useApp();
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
function Face({ url, name, size }: { url?: string | null; name: string; size: number }) {
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
