import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Switch } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, Preferences, parseList, Specialist } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { kg } from '../format';
import { haptic } from '../haptics';
import { Loading } from './Shopping';

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
  const [spec, setSpec] = useState<Specialist | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
    api<{ specialist: Specialist | null }>('/client/my-specialist')
      .then(r => setSpec(r.specialist)).catch(() => {});
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

        <Animated.View entering={FadeInDown.duration(240)}>
          <Card style={{ marginTop: S.md, marginBottom: S.md, alignItems: 'center', paddingVertical: S.xl }}>
            {u?.avatar_url ? (
              <Image source={{ uri: u.avatar_url }}
                style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: p.inset }}
                contentFit="cover" transition={200} cachePolicy="memory-disk" />
            ) : (
              <View style={{
                width: 76, height: 76, borderRadius: 38, backgroundColor: p.primarySoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="user" size={34} color={p.primary} />
              </View>
            )}
            <Text style={{ ...FONT.h2, color: p.text, marginTop: S.md }}>{u?.name ?? '—'}</Text>
            {u?.email ? <Muted style={{ marginTop: 2 }}>{u.email}</Muted> : null}
          </Card>
        </Animated.View>

        <Card style={{ padding: 0, marginBottom: S.md }}>
          {([
            ['Цель', u?.goal || '—'],
            ['Норма калорий', u?.target_kcal ? `${u.target_kcal} ккал` : '—'],
            ['Вес', u?.weight_kg ? `${kg(u.weight_kg)} кг` : '—'],
            ['Специалист', spec?.name ?? 'не назначен'],
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
