/**
 * Еженедельная адаптация EQUA AI.
 *
 * Раз в неделю модель смотрит на факты — отметки питания, выполнение
 * тренировок, вес, самочувствие — и предлагает изменить план. Применять
 * или нет, решает человек: сервер ничего не меняет без подтверждения.
 *
 * Питание показываем от плана, а рядом — сколько блюд человек не отмечал
 * и сколько записал сам. Прежний расчёт делил съеденное на отмеченное и
 * показывал 100% тому, кто за неделю отметил два блюда.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useApp } from '../store';
import { api } from '../api';
import { S, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { SysButton } from '../ui/system';
import { mdLite } from '../ui/mdLite';
import { useToast } from '../ui/Toast';
import { plural } from '../format';
import { haptic } from '../haptics';

interface Signals {
  meals?: { logged: number; eaten: number; skipped: number;
            planned?: number; eaten_of_plan?: number; untracked?: number;
            own_entries?: number; own_days?: number };
  workouts?: { logged: number; done: number; skipped: number; avg_feeling: number | null };
  weight_delta_kg?: number | null;
  cycle?: { phase?: string | null } | null;
}
interface Adaptation {
  id: number; recommendation: string; actions: string[];
  period_from: string; period_to: string; model_used?: boolean;
}

export default function AIReview() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [plan, setPlan] = useState<string>('both');
  const [s, setS] = useState<Signals | null>(null);
  const [a, setA] = useState<Adaptation | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ plan: string; signals: Signals; adaptation: Adaptation }>('/client/ai/adaptation')
      .then(r => { setPlan(r.plan ?? 'both'); setS(r.signals ?? {}); setA(r.adaptation); setErr(null); })
      .catch(e => setErr(e?.message ?? 'Не удалось проверить план'));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decide = useCallback(async (what: 'apply' | 'dismiss') => {
    if (!a) return;
    setBusy(true);
    try {
      await api(`/client/ai/adaptation/${a.id}/${what}`, { method: 'POST', body: {} });
      haptic.success();
      toast(what === 'apply' ? 'Адаптация применена' : 'План оставлен как есть');
      router.back();
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не получилось');
    } finally { setBusy(false); }
  }, [a, toast]);

  if (!a) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back title="Как идёт план" />
        {err ? <Muted style={{ padding: S.lg }}>{err}</Muted> : (
          <View style={{ alignItems: 'center', paddingTop: 50, gap: S.md }}>
            <ActivityIndicator color={p.accent} />
            <Muted>Анализируем последние 7 дней</Muted>
          </View>
        )}
      </View>
    );
  }

  const m: NonNullable<Signals['meals']> = s?.meals ?? { logged: 0, eaten: 0, skipped: 0 };
  const w = s?.workouts ?? { logged: 0, done: 0, skipped: 0, avg_feeling: null };
  const foodPct = m.planned ? Math.round((m.eaten_of_plan ?? 0) / m.planned * 100) : null;
  const woPct = w.logged ? Math.round(w.done / w.logged * 100) : null;

  const tiles: [string, string][] = [];
  if (plan === 'nutrition' || plan === 'both') {
    tiles.push([
      foodPct == null ? '—' : `${foodPct}%`,
      !m.planned ? 'плана на эту неделю нет'
        : m.untracked ? `${m.untracked} ${plural(m.untracked, ['блюдо', 'блюда', 'блюд'])} без отметки`
        : 'питание по плану',
    ]);
  }
  if (plan === 'workouts' || plan === 'both') {
    tiles.push([woPct == null ? '—' : `${woPct}%`, 'тренировки выполнены']);
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title="Как идёт план" />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: insets.bottom + 40,
      }} showsVerticalScrollIndicator={false}>

        <View style={{ flexDirection: 'row', gap: S.md }}>
          {tiles.map(([v, note]) => (
            <Card key={note} style={{ flex: 1 }}>
              <Text style={{ ...FONT.num, color: p.text }}>{v}</Text>
              <Text style={{ ...FONT.small, color: p.text3, marginTop: 2, lineHeight: 17 }}>
                {note}
              </Text>
            </Card>
          ))}
        </View>

        {/* Свои записи — рядом с планом: «6%» без них читается как «я не ел». */}
        {m.own_entries ? (
          <Muted style={{ marginTop: S.md, lineHeight: 18 }}>
            Плюс своё: {m.own_entries} {plural(m.own_entries, ['запись', 'записи', 'записей'])} в
            дневнике{m.own_days ? ` за ${m.own_days} ${plural(m.own_days, ['день', 'дня', 'дней'])}` : ''}.
          </Muted>
        ) : null}

        {s?.cycle?.phase ? (
          <Muted style={{ marginTop: S.sm }}>
            Учтён ваш текущий ритм: {s.cycle.phase} — только с вашего разрешения.
          </Muted>
        ) : null}

        <Card style={{ marginTop: S.lg }}>
          <Label>EQUA AI предлагает</Label>
          <View style={{ marginTop: S.sm, gap: 4 }}>
            {mdLite(a.recommendation).map((line, i) => (
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

        <Muted style={{ marginTop: S.md, lineHeight: 18 }}>
          {plan === 'nutrition' ? 'AI смотрит только питание и ничего не меняет без вашего согласия.'
            : plan === 'workouts' ? 'AI смотрит только тренировки и ничего не меняет без вашего согласия.'
            : 'Разовые пропуски сами по себе не причина перестраивать программу.'}
        </Muted>

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text>
        ) : null}

        <View style={{ marginTop: S.xl, gap: S.md }}>
          <SysButton label="Применить адаптацию" variant="prominent"
            disabled={busy} onPress={() => decide('apply')} />
          <SysButton label="Рассказать, как я себя чувствую" icon="square.and.pencil"
            disabled={busy}
            onPress={() => { haptic.tap(); router.push('/ai-checkin'); }} />
          <SysButton label="Оставить план как есть"
            disabled={busy} onPress={() => decide('dismiss')} />
        </View>
      </ScrollView>
    </View>
  );
}
