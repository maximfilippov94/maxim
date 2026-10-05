/**
 * Настройки цикла.
 *
 * Раздел добровольный, и почти всё здесь — про то, кто увидит эти данные.
 * Поэтому согласия стоят отдельными переключателями и по умолчанию
 * выключены: доступ к циклу не включается «заодно» с разделом.
 *
 * Средние длины нужны прогнозу: без них он считает по 28 и 5 дням, и у
 * человека с другим ритмом каждый прогноз мимо.
 *
 * Доступ EQUA AI сервер даёт только при активной подписке и отвечает
 * отказом иначе — показываем это словами, а не молчащим переключателем.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { api } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { NavBar } from '../src/ui/NavBar';
import { Muted } from '../src/ui/base';
import { ListGroup, ListHead } from '../src/ui/List';
import { SysButton } from '../src/ui/system';
import { useToast } from '../src/ui/Toast';
import { haptic } from '../src/haptics';

interface Settings {
  enabled?: number | boolean;
  avg_cycle_days?: number;
  avg_period_days?: number;
  cycle_regular?: number | boolean;
  share_nutritionist?: number | boolean;
  share_trainer?: number | boolean;
  share_endocrinologist?: number | boolean;
  reminders?: number | boolean;
  ai_cycle_access?: number | boolean;
}

/* Переключатели: поле, подпись, пояснение. Порядок — от своего к чужому:
   сначала как считать, потом кому показывать. */
const FLAGS: [keyof Settings, string, string][] = [
  ['cycle_regular', 'Цикл регулярный', 'при нерегулярном прогноз осторожнее'],
  ['reminders', 'Напоминания', 'о скором начале и об отметках'],
  ['share_nutritionist', 'Показывать нутрициологу', 'он учтёт фазу в питании'],
  ['share_trainer', 'Показывать тренеру', 'нагрузка подстроится под самочувствие'],
  ['share_endocrinologist', 'Показывать эндокринологу', 'для его назначений'],
  ['ai_cycle_access', 'Учитывать в EQUA AI', 'нужна активная подписка'],
];

const CYCLE_DAYS = [21, 24, 26, 28, 30, 32, 35];
const PERIOD_DAYS = [3, 4, 5, 6, 7];

export default function CycleSettings() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ cycle?: { settings?: Settings | null; enabled?: boolean } }>('/client/health',
      { noCache: true })
      .then(r => setS({ ...(r.cycle?.settings ?? {}), enabled: r.cycle?.enabled ? 1 : 0 }))
      .catch(e => setErr(e?.message ?? 'Настройки не открылись'));
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Отправляем одно поле: сервер принимает частичную правку и сам
     достаёт остальное из текущих настроек. Отказ по доступу AI
     возвращаем как есть — он объясняет, чего не хватает. */
  const put = useCallback(async (patch: Partial<Settings>) => {
    const was = s;
    setS(prev => ({ ...(prev ?? {}), ...patch }));
    setErr(null); setBusy(true);
    try {
      await api('/client/health/cycle/settings', { method: 'PATCH', body: patch });
      haptic.success();
    } catch (e: any) {
      haptic.error();
      setS(was);
      setErr(e?.message ?? 'Не сохранилось');
    } finally { setBusy(false); }
  }, [s]);

  const off = useCallback(() => {
    /* Выключение раздела данные не удаляет: сервер держит их и вернёт,
       если человек включит цикл снова. Удаление — отдельное действие. */
    put({ enabled: 0 });
    toast('Раздел выключен', { sub: 'отметки сохранены' });
  }, [put, toast]);

  if (!s) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back title="Настройки цикла" />
        {err ? <Muted style={{ padding: S.lg }}>{err}</Muted>
          : <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />}
      </View>
    );
  }

  const on = (k: keyof Settings) => !!s[k];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title="Настройки цикла" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>

        {err ? (
          <Text style={{ ...FONT.small, color: p.danger, paddingHorizontal: S.lg, paddingTop: S.sm }}>
            {err}
          </Text>
        ) : null}

        <ListHead>Средняя длина цикла</ListHead>
        <Row values={CYCLE_DAYS} value={s.avg_cycle_days ?? 28} unit="дн."
          disabled={busy} onPick={v => put({ avg_cycle_days: v })} />
        <View style={{ paddingHorizontal: S.lg, paddingTop: S.sm }}>
          <Muted>От первого дня менструации до первого дня следующей.</Muted>
        </View>

        <ListHead>Сколько длится менструация</ListHead>
        <Row values={PERIOD_DAYS} value={s.avg_period_days ?? 5} unit="дн."
          disabled={busy} onPick={v => put({ avg_period_days: v })} />

        <ListHead>Что учитывать и кому показывать</ListHead>
        <ListGroup>
          {FLAGS.map(([key, label, note], i) => (
            <View key={String(key)} style={{
              flexDirection: 'row', alignItems: 'center', gap: S.md,
              paddingHorizontal: 16, paddingVertical: 11,
              borderTopWidth: i ? 1 : 0, borderTopColor: p.border,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: p.text }}>{label}</Text>
                <Text style={{ ...FONT.small, color: p.text3, marginTop: 1 }}>{note}</Text>
              </View>
              <Switch value={on(key)} disabled={busy}
                onValueChange={v => { haptic.select(); put({ [key]: v ? 1 : 0 }); }}
                trackColor={{ false: p.track, true: p.primary }}
                thumbColor={p.name === 'light' ? '#fff' : undefined} />
            </View>
          ))}
        </ListGroup>

        <View style={{ paddingHorizontal: S.lg, paddingTop: S.lg }}>
          <Muted style={{ lineHeight: 18 }}>
            Специалист видит только то, что вы разрешили, и только на чтение.
            Прогноз ориентировочный: он считает календарные интервалы и сам
            ничего не меняет ни в питании, ни в тренировках.
          </Muted>
        </View>

        <View style={{ paddingHorizontal: S.lg, paddingTop: S.xl, gap: S.md }}>
          <SysButton label="Готово" variant="prominent"
            onPress={() => { haptic.tap(); router.back(); }} />
          {s.enabled ? (
            <SysButton label="Выключить раздел" variant="destructive" onPress={off} />
          ) : (
            <SysButton label="Включить раздел" onPress={() => put({ enabled: 1 })} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Ряд значений: выбор из нескольких чисел вместо ввода с клавиатуры. */
function Row({ values, value, unit, disabled, onPick }: {
  values: number[]; value: number; unit: string;
  disabled?: boolean; onPick: (v: number) => void;
}) {
  const { p } = useApp();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: S.lg, gap: S.sm }}>
      {values.map(v => {
        const on = v === value;
        return (
          <Pressable key={v} onPress={() => onPick(v)} disabled={disabled}
            style={({ pressed }) => ({
              paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill,
              backgroundColor: on ? p.primary : 'transparent',
              borderWidth: on ? 0 : 1, borderColor: p.btnLine,
              opacity: pressed && !on ? 0.6 : 1,
            })}>
            <Text style={{
              fontSize: 14, fontWeight: on ? '600' : '400',
              color: on ? p.onPrimary : p.text2,
            }}>{v} {unit}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
