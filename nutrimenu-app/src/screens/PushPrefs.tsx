/**
 * Что присылать и когда молчать.
 *
 * Экрана не было: включить уведомления приложение умело, а выбрать,
 * какие именно, — нет. Это не мелочь: человек, которому приходит всё
 * подряд, выключает уведомления целиком, и вместе с напоминанием об
 * обеде теряет сообщение от специалиста.
 *
 * Один экран на обе роли: поля разные, а поведение одно — переключатели
 * и тихие часы. Две копии разошлись бы на первой же правке.
 *
 * Сохраняем сразу по переключению, без кнопки «Применить»: это
 * настройки, а не форма — здесь нечего отменять.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store';
import { api } from '../api';
import { registerPush, inExpoGo } from '../push';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Muted } from '../ui/base';
import { ListGroup, ListHead } from '../ui/List';
import { SysButton } from '../ui/system';
import { useToast } from '../ui/Toast';
import { haptic } from '../haptics';


interface PushPrefs {
  breakfast?: number; lunch?: number; dinner?: number; weight?: number;
  messages?: number; menu_updates?: number; meal_logs?: number; client_inactive?: number;
  master_enabled?: number; food?: number; workouts?: number; motivation?: number;
  progress?: number; service?: number; timezone?: string | null;
  quiet_start?: string | null; quiet_end?: string | null;
}

const PUSH_CLIENT: [keyof PushPrefs, string, string][] = [
  ['master_enabled', 'Все автоматические уведомления', 'главный переключатель напоминаний EQUA'],
  ['food', 'Напоминания о питании', 'только если приём ещё не отмечен'],
  ['workouts', 'Тренировки', 'когда тренировка есть в плане и ещё не выполнена'],
  ['motivation', 'Мотивация', 'не чаще заданного системой лимита'],
  ['progress', 'Прогресс', 'только когда есть данные для сравнения'],
  ['service', 'Рекомендации и обновления сервиса', 'редкие полезные сообщения EQUA'],
  ['messages', 'Сообщения специалиста', 'чат и важные ответы'],
  ['menu_updates', 'Изменения меню', 'когда специалист обновил план'],
];
const PUSH_SPEC: [keyof PushPrefs, string, string][] = [
  ['messages', 'Сообщения', 'новые сообщения клиентов'],
  ['meal_logs', 'Отметки питания', 'клиент отметил или пропустил приём'],
  ['client_inactive', 'Неактивные клиенты', 'если клиент надолго выпал из дневника'],
];

/** Часы тихого режима: сервер хранит строкой «22:00». */
const HOURS = ['', '20:00', '21:00', '22:00', '23:00', '00:00'];
const WAKE = ['', '06:00', '07:00', '08:00', '09:00', '10:00'];

export default function PushPrefsScreen() {
  const { p, me } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const spec = me?.user_type === 'specialist';
  const base = spec ? '/specialist' : '/client';

  const [d, setD] = useState<PushPrefs | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);

  const load = useCallback(() => {
    api<{ preferences: PushPrefs }>(`${base}/push/preferences`)
      .then(r => {
        const pref = r.preferences ?? {};
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setD({ ...pref, timezone: pref.timezone || tz });
        setErr(null);
        if (!spec && tz && pref.timezone !== tz) {
          api('/client/push/preferences', { method: 'PATCH', body: { timezone: tz } }).catch(() => {});
        }
      })
      .catch(e => setErr(e?.message ?? 'Настройки не открылись'));
  }, [base]);
  useEffect(() => { load(); }, [load]);

  /* Отправляем только изменившееся поле: сервер принимает частичную
     правку, а посылать весь набор значит переписать и то, что в этот
     момент меняют с другого устройства. */
  const put = useCallback(async (patch: Partial<PushPrefs>) => {
    setD(prev => ({ ...(prev ?? {}), ...patch }));
    try {
      await api(`${base}/push/preferences`, { method: 'PATCH', body: patch });
    } catch (e: any) {
      haptic.error();
      toast(e?.message ?? 'Не сохранилось', { kind: 'err' });
      load();
    }
  }, [base, load, toast]);

  const enable = useCallback(async () => {
    if (enabling) return;
    haptic.tap(); setEnabling(true);
    try {
      const r = await registerPush(true);
      if (r.ok) {
        haptic.success();
        toast('Уведомления включены');
      } else {
        haptic.error();
        toast(r.message, { kind: 'err' });
      }
    } finally { setEnabling(false); }
  }, [enabling, toast]);

  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar back title="Уведомления" />
        {err ? <Muted style={{ padding: S.lg }}>{err}</Muted>
          : <ActivityIndicator color={p.accent} style={{ marginTop: 40 }} />}
      </View>
    );
  }

  const rows = spec ? PUSH_SPEC : PUSH_CLIENT;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar back title="Уведомления" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>

        <ListHead>Доставка</ListHead>
        <View style={{ paddingHorizontal: S.lg, paddingBottom: S.sm }}>
          <Muted style={{ marginBottom: S.md, lineHeight: 18 }}>
            Включите уведомления, чтобы не пропускать сообщения и полезные напоминания EQUA.
          </Muted>
          <SysButton label={enabling ? 'Включаем…' : 'Включить уведомления'}
            variant="prominent" disabled={enabling || inExpoGo} onPress={enable} />
        </View>

        <ListHead>{spec ? 'Что присылать' : 'Автоматические уведомления'}</ListHead>
        <ListGroup>
          {rows.map(([key, label, note], i) => (
            <View key={String(key)} style={{
              flexDirection: 'row', alignItems: 'center', gap: S.md,
              paddingHorizontal: 16, paddingVertical: 11,
              borderTopWidth: i ? 1 : 0, borderTopColor: p.border,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: p.text }}>{label}</Text>
                <Text style={{ ...FONT.small, color: p.text3, marginTop: 1 }}>{note}</Text>
              </View>
              <Switch
                value={!!d[key]}
                onValueChange={v => { haptic.select(); put({ [key]: v ? 1 : 0 }); }}
                trackColor={{ false: p.track, true: p.primary }}
                thumbColor={p.name === 'light' ? '#fff' : undefined} />
            </View>
          ))}
        </ListGroup>


        <ListHead>Тихие часы</ListHead>
        <View style={{ paddingHorizontal: S.lg }}>
          <Muted style={{ marginBottom: S.md, lineHeight: 18 }}>
            В эти часы уведомления не приходят. Срочное — звонок и сообщение —
            приходит всё равно.
          </Muted>
        </View>
        <View style={{ flexDirection: 'row', gap: S.md, paddingHorizontal: S.lg }}>
          <Picker label="С" value={d.quiet_start ?? ''} options={HOURS}
            onPick={v => put({ quiet_start: v || null })} />
          <Picker label="До" value={d.quiet_end ?? ''} options={WAKE}
            onPick={v => put({ quiet_end: v || null })} />
        </View>
        {!d.quiet_start || !d.quiet_end ? (
          <View style={{ paddingHorizontal: S.lg, paddingTop: S.md }}>
            <Muted>Нужны оба часа — иначе тихий режим не включается.</Muted>
          </View>
        ) : null}

      </ScrollView>
    </View>
  );
}

/** Выбор часа строкой кнопок: пять значений — меньше, чем шагов в списке. */
function Picker({ label, value, options, onPick }: {
  label: string; value: string; options: string[]; onPick: (v: string) => void;
}) {
  const { p } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...FONT.caption, color: p.text3, marginBottom: 6 }}>{label}</Text>
      <View style={{ gap: 6 }}>
        {options.map(o => {
          const on = o === value;
          return (
            <Pressable key={o || 'off'} onPress={() => { haptic.select(); onPick(o); }}
              style={({ pressed }) => ({
                paddingVertical: 9, borderRadius: R.control, alignItems: 'center',
                backgroundColor: on ? p.primary : 'transparent',
                borderWidth: on ? 0 : 1, borderColor: p.btnLine,
                opacity: pressed && !on ? 0.6 : 1,
              })}>
              <Text style={{
                fontSize: 14, fontWeight: on ? '600' : '400',
                color: on ? p.onPrimary : p.text2,
              }}>{o || 'не нужны'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
