/**
 * Завершение тренировки: оценка и слово тренеру.
 *
 * Оценка нагрузки — единственное, что человек говорит о занятии своими
 * словами, поэтому она стоит до кнопки, а не после. Комментарий
 * необязателен: заставлять писать после зала — верный способ не
 * получить ни одного комментария.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, WO_FEEL } from '../api';
import { S, R, FONT } from '../theme';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { haptic } from '../haptics';

export default function WorkoutFinish() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const q = useLocalSearchParams<{ id?: string }>();
  const id = Number(q.id) || 0;
  const [feel, setFeel] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const finish = async () => {
    setBusy(true);
    try {
      await api(`/client/sessions/${id}/finish`,
        { method: 'POST', body: { feeling: feel || null, comment: comment.trim() } });
      haptic.success();
      router.replace({ pathname: '/wo-done', params: { id: String(id) } });
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось завершить'); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + S.xxl, paddingHorizontal: S.lg,
        paddingBottom: insets.bottom + S.xxl,
      }}
      keyboardShouldPersistTaps="handled">
      <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center' }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32, backgroundColor: p.primarySoft,
          alignItems: 'center', justifyContent: 'center', marginBottom: S.lg,
        }}>
          <Icon name="check" size={30} color={p.accent} />
        </View>
        <Text style={{ ...FONT.h1, color: p.text }}>Тренировка окончена</Text>
      </Animated.View>

      <Text style={{ ...FONT.h3, color: p.text, marginTop: S.xxl, marginBottom: S.md }}>
        Как прошло?
      </Text>
      <View style={{ flexDirection: 'row', gap: S.xs, marginBottom: S.xl }}>
        {WO_FEEL.map(([n, label, face]) => {
          const on = feel === n;
          return (
            <Pressable key={n} onPress={() => { haptic.select(); setFeel(n); }}
              accessibilityRole="button" accessibilityLabel={`Нагрузка: ${label}`}
              accessibilityState={{ selected: on }}
              style={({ pressed }) => ({
                flex: 1, alignItems: 'center', gap: 5, minHeight: 64, paddingVertical: 10,
                borderRadius: R.md, borderWidth: 1.5,
                borderColor: on ? p.primary : 'transparent',
                backgroundColor: on ? p.primarySoft : p.surface,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}>
              <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                style={{ fontSize: 24 }}>{face}</Text>
              <Text numberOfLines={1} style={{
                fontSize: 11, fontWeight: '600', color: on ? p.accent : p.text3,
              }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ ...FONT.label, color: p.text3, textTransform: 'uppercase', marginBottom: 6 }}>
        Комментарий тренеру
      </Text>
      <TextInput value={comment} onChangeText={setComment} multiline maxLength={600}
        placeholder="Что было тяжело, где болело, что хочется поменять"
        placeholderTextColor={p.text3}
        style={{
          backgroundColor: p.surface, borderRadius: R.md, color: p.text,
          padding: S.lg, fontSize: 15, minHeight: 92, textAlignVertical: 'top',
          marginBottom: S.xl,
        }} />

      {err ? <Text style={{ ...FONT.small, color: p.danger, marginBottom: S.md }}>{err}</Text> : null}

      <SysButton label="Сохранить и завершить" variant="prominent" disabled={busy} onPress={finish} />
      <Pressable onPress={() => router.back()}
        style={({ pressed }) => ({ marginTop: S.md, alignItems: 'center', opacity: pressed ? 0.5 : 1 })}>
        <Text style={{ ...FONT.body, color: p.text3 }}>Вернуться к упражнениям</Text>
      </Pressable>
    </ScrollView>
  );
}
