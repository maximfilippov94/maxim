/**
 * «Правильно ли я вас понял» — сверка анкеты перед запуском.
 *
 * Сервер не подключает набор, пока человек не подтвердит разбор своих
 * ответов, и подтверждение считается свежим только сутки. Шаг не
 * формальность: модель пересказывает анкету своими словами, и именно
 * здесь видно, что «без молочного» она прочла как «без молока, но сыр
 * можно».
 *
 * Если у модели остались вопросы, она задаёт их здесь же. Ответы уходят
 * обратно в разбор, и пересказ переписывается — поэтому «Всё верно»
 * появляется только после того, как разбор перестал меняться.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../store';
import { api } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { SysButton } from '../ui/system';
import { mdLite } from '../ui/mdLite';
import { useToast } from '../ui/Toast';
import { haptic } from '../haptics';

interface Followup { id: string; text: string }
interface Intake { questions: Followup[]; summary: string; model_used?: boolean }

export default function AIIntake() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ plan?: string }>();
  const plan = params.plan ?? 'nutrition';

  const [d, setD] = useState<Intake | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ask = useCallback(async (withAnswers: Record<string, string>) => {
    setBusy(true); setErr(null);
    try {
      const r = await api<Intake>('/client/ai/intake', {
        method: 'POST',
        body: { plan, answers: withAnswers },
      });
      setD(r);
    } catch (e: any) {
      setErr(e?.message ?? 'Разбор не получен');
    } finally { setBusy(false); }
  }, [plan]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    ask({});
  }, [ask]);

  const confirm = useCallback(async () => {
    if (!d?.summary) return;
    setBusy(true); setErr(null);
    try {
      await api('/client/ai/intake/confirm', {
        method: 'POST', body: { plan, summary: d.summary },
      });
      haptic.success();
      toast('Разбор подтверждён');
      /* `preview` просит экран AI сразу показать предварительный
         ориентир — шаг веба между подтверждением и оформлением.
         Возвращать человека к списку наборов значит потерять его на
         полпути: он подтвердил ответы и ждёт, что из них вышло. */
      router.replace({ pathname: '/ai', params: { plan, preview: '1' } });
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не подтвердилось');
    } finally { setBusy(false); }
  }, [d, plan, toast]);

  const unanswered = (d?.questions ?? []).filter(q => !(answers[q.id] ?? '').trim());

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title="Проверьте разбор" />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: insets.bottom + 40,
      }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {!d && busy ? (
          <View style={{ alignItems: 'center', paddingTop: 50, gap: S.md }}>
            <ActivityIndicator color={p.accent} />
            <Muted>Читаем ваши ответы</Muted>
          </View>
        ) : null}

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginBottom: S.md }}>{err}</Text>
        ) : null}

        {d ? (
          <>
            <Card>
              <Label>Как мы вас поняли</Label>
              <View style={{ marginTop: S.sm, gap: 4 }}>
                {/* Разбор приходит разметкой модели — тем же разбором,
                    что и ответы в чате. */}
                {mdLite(d.summary).map((line, i) => (
                  <Text key={i} style={{ ...FONT.body, color: p.text, lineHeight: 21 }}>
                    {line.map((span, j) => (
                      <Text key={j} style={span.bold ? { fontWeight: '700' } : undefined}>
                        {span.text}
                      </Text>
                    ))}
                  </Text>
                ))}
              </View>
            </Card>

            {d.questions?.length ? (
              <>
                <Text style={{ ...FONT.h3, color: p.text, marginTop: S.xl, marginBottom: 4 }}>
                  Остались вопросы
                </Text>
                <Muted style={{ marginBottom: S.md }}>
                  Ответьте, и разбор перепишется — так план будет точнее.
                </Muted>
                {d.questions.map(q => (
                  <View key={q.id} style={{ marginBottom: S.md }}>
                    <Text style={{ ...FONT.body, color: p.text2, marginBottom: 6, lineHeight: 20 }}>
                      {q.text}
                    </Text>
                    <TextInput
                      value={answers[q.id] ?? ''}
                      onChangeText={t => setAnswers(a => ({ ...a, [q.id]: t }))}
                      multiline maxLength={400}
                      placeholder="Ваш ответ"
                      placeholderTextColor={p.text3}
                      style={{
                        backgroundColor: p.inset, color: p.text, borderRadius: R.md,
                        paddingHorizontal: S.lg, paddingTop: 11, paddingBottom: 11,
                        fontSize: 16, minHeight: 72, textAlignVertical: 'top',
                      }} />
                  </View>
                ))}
                <SysButton label="Уточнить разбор" disabled={busy}
                  onPress={() => { haptic.tap(); ask(answers); }} />
                {unanswered.length ? (
                  <Muted style={{ marginTop: S.sm }}>
                    Без ответов тоже можно — тогда план соберётся по тому, что уже есть.
                  </Muted>
                ) : null}
              </>
            ) : null}

            <View style={{ marginTop: S.xl, gap: S.md }}>
              <SysButton label="Всё верно, продолжить" variant="prominent"
                disabled={busy} onPress={confirm} />
              <SysButton label="Поправить анкету"
                onPress={() => {
                  haptic.tap();
                  router.replace({
                    pathname: plan === 'workouts' ? '/ai-fitness' : '/ai-nutrition',
                    params: { plan },
                  });
                }} />
            </View>

            {d.model_used === false ? (
              <Muted style={{ marginTop: S.lg, lineHeight: 18 }}>
                Разбор составлен по правилам сервиса — модель сейчас недоступна.
                План это не отменяет.
              </Muted>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
