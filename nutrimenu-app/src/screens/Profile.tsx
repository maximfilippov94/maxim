import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Switch, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, mediaUrl, Preferences, parseList } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { kg } from '../format';
import { haptic } from '../haptics';
import { pickPhoto } from '../photo';
import { uploadForm } from '../upload';
import { Loading } from './Shopping';

/** Уровень активности словами — как на сайте. */
const ACTIVITY: Record<string, string> = {
  low: 'низкий', light: 'лёгкий', medium: 'средний',
  high: 'высокий', athlete: 'спортсмен',
};

/** Список через запятую — так его вводят и в вебе. */
const join = (a: string[]) => a.join(', ');
const split = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);

export default function Profile() {
  const { p, me, refreshMe } = useApp();
  const insets = useSafeAreaInsets();
  const u = me?.user;

  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [excluded, setExcluded] = useState('');
  const [swaps, setSwaps] = useState(true);
  const [notes, setNotes] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const age = u?.birth_year ? new Date().getFullYear() - u.birth_year : null;

  /* Снимок профиля меняется отсюда: в вебе он кликабелен, в приложении
     его можно было только посмотреть. Сервер сам ужимает картинку до
     1100 точек, поэтому отправляем как есть. */
  const changePhoto = useCallback(async () => {
    const file = await pickPhoto(true);
    if (!file) return;
    setPhotoBusy(true); setMsg(null);
    try {
      await uploadForm('/client/avatar', file, 'photo');
      haptic.success();
      await refreshMe();
    } catch (e: any) {
      haptic.error(); setMsg(e?.message ?? 'Снимок не загрузился');
    } finally { setPhotoBusy(false); }
  }, [refreshMe]);

  const dropPhoto = useCallback(async () => {
    setPhotoBusy(true); setMsg(null);
    try {
      await api('/client/avatar', { method: 'DELETE' });
      haptic.success();
      await refreshMe();
    } catch (e: any) {
      haptic.error(); setMsg(e?.message ?? 'Не удалось убрать фото');
    } finally { setPhotoBusy(false); }
  }, [refreshMe]);

  useEffect(() => {
    api<{ preferences: Preferences }>('/client/preferences').then(r => {
      const pr = r.preferences ?? {};
      setLikes(join(parseList(pr.likes)));
      setDislikes(join(parseList(pr.dislikes)));
      setExcluded(join(parseList(pr.excluded)));
      setSwaps((pr.allowed_replacements ?? 1) === 1);
      setNotes(pr.notes ?? '');
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = useCallback(async () => {
    setBusy(true); setMsg(null);
    try {
      await api('/client/preferences', {
        method: 'PATCH',
        body: {
          likes: split(likes), dislikes: split(dislikes), excluded: split(excluded),
          allowed_replacements: swaps ? 1 : 0, notes: notes.trim() || null,
        },
      });
      haptic.success();
      setMsg('Сохранено');
      await refreshMe();
    } catch (e: any) {
      haptic.error(); setMsg(e?.message ?? 'Не удалось сохранить');
    } finally { setBusy(false); }
  }, [likes, dislikes, excluded, swaps, notes, refreshMe]);

  if (!loaded) return <Loading title="Профиль" />;

  const field = (label: string, value: string, onChange: (v: string) => void, hint?: string) => (
    <View style={{ marginBottom: S.md }}>
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={t => { onChange(t); setMsg(null); }}
        placeholder={hint}
        placeholderTextColor={p.text3}
        style={{
          marginTop: S.sm, backgroundColor: p.inset, color: p.text,
          borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
        }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Профиль" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
      }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Animated.View entering={FadeIn.duration(240)}>
          <Card style={{ marginTop: S.md, marginBottom: S.md, alignItems: 'center', paddingVertical: S.xl }}>
            <Pressable onPress={changePhoto} disabled={photoBusy} hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed || photoBusy ? 0.6 : 1 })}>
              {u?.avatar_url ? (
                <Image source={{ uri: mediaUrl(u.avatar_url)! }}
                  style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: p.inset }}
                  contentFit="cover" transition={200} cachePolicy="memory-disk" />
              ) : (
                <View style={{
                  width: 76, height: 76, borderRadius: 38, backgroundColor: p.primarySoft,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="user" size={34} color={p.accent} />
                </View>
              )}
              {/* Значок камеры на краю: без него снимок не выглядит
                  нажимаемым, и смену фото никто не находит. */}
              <View style={{
                position: 'absolute', right: -2, bottom: -2,
                width: 28, height: 28, borderRadius: 14,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.primary, borderWidth: 2, borderColor: p.surface,
              }}>
                {photoBusy
                  ? <ActivityIndicator size="small" color={p.onPrimary} />
                  : <Icon name="camera" size={14} color={p.onPrimary} width={2} />}
              </View>
            </Pressable>
            <Text style={{ ...FONT.h2, color: p.text, marginTop: S.md }}>{u?.name ?? '—'}</Text>
            {u?.email ? <Muted style={{ marginTop: 2 }}>{u.email}</Muted> : null}
            {/* Снять фото тоже можно — в вебе кнопка стоит под аватаром.
                Без неё неудачный снимок остаётся навсегда. */}
            {u?.avatar_url ? (
              <Pressable onPress={dropPhoto} disabled={photoBusy} hitSlop={8}
                style={({ pressed }) => ({ marginTop: S.sm, opacity: pressed ? 0.5 : 1 })}>
                <Text style={{ ...FONT.small, color: p.danger }}>Удалить фото</Text>
              </Pressable>
            ) : (
              <Muted style={{ marginTop: S.sm }}>Добавьте фото профиля</Muted>
            )}
          </Card>
        </Animated.View>

        {/* Те же пять строк, что в вебе («Мои данные»): цель, вес, рост,
            возраст, активность. Норма калорий и специалист отсюда ушли —
            первая стоит на «Сегодня», второй в «Моих специалистах». */}
        <Card style={{ padding: 0, marginBottom: S.md }}>
          {([
            ['Цель', u?.goal || '—'],
            ['Текущий вес', u?.weight_kg ? `${kg(u.weight_kg)} кг` : '—'],
            ['Рост', u?.height_cm ? `${u.height_cm} см` : '—'],
            ['Возраст', age ? String(age) : '—'],
            ['Уровень активности', ACTIVITY[u?.activity_level ?? ''] ?? (u?.activity_level || '—')],
          ] as [string, string][]).map(([l, v], i) => (
            <View key={l} style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingVertical: 12, paddingHorizontal: S.lg,
              borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
            }}>
              <Text style={{ fontSize: 15, color: p.text2 }}>{l}</Text>
              <Text style={{ fontSize: 15, color: p.text }} numberOfLines={1}>{v}</Text>
            </View>
          ))}
        </Card>

        <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.md }}>
          Предпочтения
        </Text>
        <Card style={{ marginBottom: S.md }}>
          {field('Люблю', likes, setLikes, 'рыба, авокадо')}
          {field('Не люблю', dislikes, setDislikes, 'грибы')}
          {field('Исключить', excluded, setExcluded, 'лактоза, орехи')}
          {field('Заметка специалисту', notes, setNotes, 'что важно знать')}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: S.md }}>
              <Text style={{ fontSize: 15, color: p.text }}>Разрешать замены блюд</Text>
              <Muted style={{ marginTop: 2 }}>
                Можно поменять блюдо на равное по калорийности.
              </Muted>
            </View>
            <Switch
              value={swaps}
              onValueChange={v => { haptic.select(); setSwaps(v); setMsg(null); }}
              trackColor={{ true: p.primary, false: p.track }}
            />
          </View>
        </Card>

        {msg ? (
          <Text style={{ ...FONT.small, color: p.text2, marginBottom: S.md }}>{msg}</Text>
        ) : null}

        <SysButton label="Сохранить" variant="prominent" disabled={busy} onPress={save} />
      </ScrollView>
    </View>
  );
}
