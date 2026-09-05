import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { api, ProgressResponse } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { ListGroup, ListHead, ListRow } from '../ui/List';
import { Muted } from '../ui/base';
import { SysButton, SysChart, Empty } from '../ui/system';
import { pickPhoto, photoForm } from '../photo';
import { kg, plural } from '../format';
import { haptic } from '../haptics';
import { Loading, Fail } from './Shopping';

const dmy = (s?: string | null) => {
  if (!s) return '—';
  const p = String(s).slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}` : s;
};

type Tab = 'weight' | 'measure' | 'photo';
const TABS: [Tab, string][] = [['weight', 'Вес'], ['measure', 'Замеры'], ['photo', 'Фото']];

export default function Progress() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<ProgressResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('weight');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setD(await api<ProgressResponse>('/client/progress')); setErr(null); }
    catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Вес и замеры добавляются шторками поверх экрана — вернувшись,
     нужно увидеть новую запись, а не прежний список. */
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addPhoto = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const ph = await pickPhoto();
      if (ph) {
        await api('/client/progress/photo', { method: 'POST', body: photoForm('photo', ph) });
        haptic.success();
        await load();
      }
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось загрузить фото');
    } finally { setBusy(false); }
  }, [load]);

  if (err && !d) return <Fail title="Прогресс" text={err} />;
  if (!d) return <Loading title="Прогресс" />;

  const ws = d.weights ?? [];
  const first = ws.length ? +ws[0].weight_kg : null;
  const last = ws.length ? +ws[ws.length - 1].weight_kg : null;
  const delta = first != null && last != null ? Math.round((last - first) * 10) / 10 : null;
  const ms = d.measurements ?? [];
  const photos = d.photos ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Прогресс" back />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}>

        {/* Три раздела прогресса — как в вебе: вес, замеры и фото. */}
        <View style={{
          flexDirection: 'row', gap: S.sm, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 4,
        }}>
          {TABS.map(([k, l]) => {
            const on = k === tab;
            return (
              <Pressable key={k} onPress={() => { haptic.select(); setTab(k); }}
                style={({ pressed }) => ({
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill,
                  backgroundColor: on ? p.primary : p.surface,
                  borderWidth: on ? 0 : 1, borderColor: p.border,
                  opacity: pressed && !on ? 0.7 : 1,
                })}>
                <Text style={{
                  fontSize: 14, fontWeight: on ? '600' : '400',
                  color: on ? p.onPrimary : p.text2,
                }}>{l}</Text>
              </Pressable>
            );
          })}
        </View>

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, paddingHorizontal: 18, paddingTop: 8 }}>
            {err}
          </Text>
        ) : null}

        {tab === 'weight' ? (
          <Animated.View entering={FadeInDown.duration(240)}>
            <ListGroup style={{ marginTop: 8 }}>
              <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                  <Text style={{ ...FONT.num, color: p.text }}>{kg(last)}</Text>
                  <Text style={{ ...FONT.body, color: p.text3 }}>кг</Text>
                  {/* Снижение — зелёным в обеих темах: в «Фарфоре» акцент
                      графитовый, и им знак изменения не прочитать */}
                  {delta != null && delta !== 0 ? (
                    <Text style={{ ...FONT.h3, color: delta < 0 ? p.mp : p.mf, marginLeft: 'auto' }}>
                      {delta > 0 ? '+' : '−'}{kg(Math.abs(delta))} кг
                    </Text>
                  ) : null}
                </View>
                <Text style={{ ...FONT.small, color: p.text3, marginTop: 2 }}>
                  {ws.length
                    ? `${ws.length} ${plural(ws.length, ['измерение', 'измерения', 'измерений'])} с ${dmy(ws[0].measured_on)}`
                    : 'Измерений пока нет'}
                </Text>
                {ws.length >= 2 ? (
                  <View style={{ marginTop: 10 }}>
                    {/* График системный: оси, подписи и перестроение при
                        новой записи рисует сама Swift Charts. */}
                    <SysChart color={p.mp}
                      points={ws.map(w => ({ x: dmy(w.measured_on), y: +w.weight_kg }))} />
                  </View>
                ) : (
                  <Text style={{ ...FONT.small, color: p.text3, marginVertical: 20 }}>
                    Добавьте ещё одно измерение — и здесь появится график
                  </Text>
                )}
              </View>
            </ListGroup>

            <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
              <SysButton label="Записать вес" icon="scalemass"
                onPress={() => { haptic.tap(); router.push('/weight'); }} />
            </View>

            <ListHead>Съедено по плану</ListHead>
            <ListGroup>
              <ListRow first label="Отмеченных блюд" value={String(d.eaten_count ?? 0)} />
            </ListGroup>

            {ws.length ? (
              <>
                <ListHead>История веса</ListHead>
                <ListGroup>
                  {ws.slice().reverse().map((w, i) => (
                    <ListRow key={w.id} first={i === 0}
                      label={dmy(w.measured_on)} value={`${kg(+w.weight_kg)} кг`} />
                  ))}
                </ListGroup>
              </>
            ) : null}
          </Animated.View>
        ) : null}

        {tab === 'measure' ? (
          <Animated.View entering={FadeInDown.duration(240)}>
            <View style={{ paddingHorizontal: 18, paddingTop: 14, gap: S.md }}>
              <SysButton label="Добавить замеры" icon="ruler"
                onPress={() => { haptic.tap(); router.push('/measure'); }} />
              <SysButton label="Отчёт за неделю" icon="square.and.pencil"
                onPress={() => { haptic.tap(); router.push('/checkin'); }} />
            </View>
            {ms.length === 0 ? (
              <Empty icon="ruler" title="Замеров пока нет"
                note="Талия, бёдра и грудь покажут изменения, которых не видят весы." />
            ) : (
              <>
                <ListHead>История замеров</ListHead>
                <ListGroup>
                  {ms.slice().reverse().map((m, i) => (
                    <ListRow key={m.id} first={i === 0}
                      label={dmy(m.measured_on)}
                      value={[
                        m.waist_cm ? `талия ${m.waist_cm}` : null,
                        m.hips_cm ? `бёдра ${m.hips_cm}` : null,
                        m.chest_cm ? `грудь ${m.chest_cm}` : null,
                      ].filter(Boolean).join(' · ')} />
                  ))}
                </ListGroup>
              </>
            )}
          </Animated.View>
        ) : null}

        {tab === 'photo' ? (
          <Animated.View entering={FadeInDown.duration(240)}>
            <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
              <SysButton label="Добавить фото" icon="photo.badge.plus"
                disabled={busy} onPress={addPhoto} />
            </View>
            {photos.length === 0 ? (
              <Empty icon="photo.on.rectangle" title="Фотографий нет"
                note="Снимок раз в месяц покажет прогресс нагляднее цифр." />
            ) : (
              <View style={{
                flexDirection: 'row', flexWrap: 'wrap', gap: S.sm,
                paddingHorizontal: 18, paddingTop: S.lg,
              }}>
                {photos.map((ph, i) => (
                  <View key={ph.id} style={{ width: '31.5%' }}>
                    <Image source={{ uri: ph.photo_url }}
                      style={{ width: '100%', aspectRatio: 0.75, borderRadius: R.md,
                        backgroundColor: p.inset }}
                      contentFit="cover" transition={200} cachePolicy="memory-disk" />
                    <Muted style={{ marginTop: 4 }}>{dmy(ph.measured_on)}</Muted>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}
