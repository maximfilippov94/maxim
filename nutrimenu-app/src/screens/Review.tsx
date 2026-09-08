/**
 * Отзыв клиента о своём специалисте.
 *
 * Рейтинг в каталоге считается только из таких отзывов. Отзыв виден всем,
 * поэтому говорим об этом до отправки, а не мелким шрифтом после: под ним
 * встанет имя и первая буква фамилии.
 *
 * Один клиент — один отзыв, но переписать его можно в любой момент.
 * Мнение через месяц работы честнее первого впечатления, а «оставьте
 * ещё один» превращает отзывы в голосование.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, MyReview } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton, SysConfirm } from '../ui/system';
import { haptic } from '../haptics';
import { Loading } from './Shopping';

interface Loaded {
  specialist: { id: number; name: string } | null;
  review: MyReview | null;
}

/** Что означает оценка — словами, чтобы звёзды не пришлось угадывать. */
const WORD = ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];

export default function ReviewScreen() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();

  const [d, setD] = useState<Loaded | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Loaded>('/client/review');
      setD(r);
      setRating(r.review?.rating ?? 0);
      setBody(r.review?.body ?? '');
      setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось открыть'); setD({ specialist: null, review: null }); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = useCallback(async () => {
    if (!rating) { haptic.error(); setErr('Поставьте оценку'); return; }
    setBusy(true);
    try {
      await api('/client/review', { method: 'POST', body: { rating, body: body.trim() } });
      haptic.success(); setErr(null); setSaved(true);
      load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не сохранилось'); }
    finally { setBusy(false); }
  }, [rating, body, load]);

  const remove = useCallback(async () => {
    try {
      await api('/client/review', { method: 'DELETE' });
      haptic.success(); setRating(0); setBody(''); setSaved(false); load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалилось'); }
  }, [load]);

  if (!d) return <Loading title="Отзыв" />;

  if (!d.specialist) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar title="Отзыв" back />
        <View style={{ paddingHorizontal: S.lg }}>
          <Card style={{ marginTop: S.md }}>
            <Muted style={{ lineHeight: 20 }}>
              Отзыв оставляют своему специалисту. Сейчас вы ни к кому не подключены.
            </Muted>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Отзыв" back />
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
        }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Animated.View entering={FadeInDown.duration(220)}>
            <Card style={{ marginTop: S.md, gap: S.md }}>
              <View>
                <Text style={{ ...FONT.h3, color: p.text }}>{d.specialist.name}</Text>
                <Muted style={{ marginTop: 4, lineHeight: 19 }}>
                  Отзыв виден всем в каталоге. Под ним будет ваше имя и первая
                  буква фамилии.
                </Muted>
              </View>

              <View>
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <Pressable key={n}
                      onPress={() => { haptic.select(); setRating(n); setErr(null); }}
                      hitSlop={4}
                      style={({ pressed }) => ({
                        width: 52, height: 52, borderRadius: R.md,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: n <= rating ? p.premiumSoft : p.inset,
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      })}>
                      <Icon name="star" size={24}
                        color={n <= rating ? p.premium : p.text3} width={1.9} />
                    </Pressable>
                  ))}
                </View>
                {rating ? (
                  <Text style={{ ...FONT.small, color: p.text2, marginTop: S.sm, fontWeight: '600' }}>
                    {WORD[rating]}
                  </Text>
                ) : null}
              </View>

              <TextInput value={body} onChangeText={t => { setBody(t); setSaved(false); }}
                multiline
                placeholder="Что получилось, что было тяжело, кому подойдёт"
                placeholderTextColor={p.text3}
                style={{
                  minHeight: 110, backgroundColor: p.inset, color: p.text,
                  borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 12,
                  fontSize: 15, lineHeight: 21, textAlignVertical: 'top',
                }} />

              {err ? (
                <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text>
              ) : saved ? (
                <Text style={{ ...FONT.small, color: p.accent }}>Отзыв сохранён</Text>
              ) : null}

              <SysButton label={d.review ? 'Сохранить' : 'Оставить отзыв'}
                variant="prominent" disabled={busy} onPress={save} />

              {d.review ? (
                <View style={{ alignSelf: 'flex-start' }}>
                  <SysConfirm label="Удалить отзыв" tint={p.danger}
                    title="Удалить свой отзыв?" confirmLabel="Удалить"
                    onConfirm={remove} />
                </View>
              ) : null}
            </Card>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
