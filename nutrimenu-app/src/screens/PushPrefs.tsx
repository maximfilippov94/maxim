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
import { api, PushPrefs, PUSH_CLIENT, PUSH_SPEC } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Muted } from '../ui/base';
import { ListGroup, ListHead } from '../ui/List';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { useToast } from '../ui/Toast';
import { haptic } from '../haptics';

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
  /* Итог проверки доставки: сколько подписок у этого человека и сколько
     ушло сейчас. Числа сервера, не наши догадки. */
  const [diag, setDiag] = useState<{ expo: number; sent: number } | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(() => {
    api<{ preferences: PushPrefs }>(`${base}/push/preferences`)
      .then(r => { setD(r.preferences ?? {}); setErr(null); })
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

  /* «Проверить доставку» — та же кнопка, что в вебе (`pushTest`).
     Человек включил уведомления и хочет убедиться, что они доходят;
     без неё остаётся ждать случайного повода. */
  const check = useCallback(async () => {
    if (checking) return;
    haptic.tap(); setChecking(true); setDiag(null);
    try {
      const r = await api<{ expo?: number; sent?: number }>('/push/test', { method: 'POST' });
      setDiag({ expo: r.expo ?? 0, sent: r.sent ?? 0 });
      if ((r.sent ?? 0) > 0) haptic.success();
    } catch (e: any) {
      haptic.error();
      toast(e?.message ?? 'Проверка не прошла', { kind: 'err' });
    } finally { setChecking(false); }
  }, [checking, toast]);

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

        <ListHead>Что присылать</ListHead>
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

        <ListHead>Доставка</ListHead>
        <View style={{ paddingHorizontal: S.lg }}>
          <Muted style={{ marginBottom: S.md, lineHeight: 18 }}>
            Пришлём на это устройство проверочное уведомление.
          </Muted>
          <SysButton label={checking ? 'Проверяем…' : 'Проверить доставку'}
            disabled={checking} onPress={check} />
          {diag ? (
            <View style={{ marginTop: S.md, gap: 6 }}>
              <Row ok={diag.expo > 0} label="Устройство подписано"
                value={diag.expo > 0 ? `да, устройств: ${diag.expo}` : 'нет'} />
              <Row ok={diag.sent > 0} label="Отправлено сейчас"
                value={String(diag.sent)} />
              {diag.expo === 0 ? (
                <Muted style={{ marginTop: 2 }}>
                  Разрешите уведомления в настройках телефона и войдите заново —
                  подписка создаётся при входе.
                </Muted>
              ) : null}
            </View>
          ) : null}
        </View>
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

/** Строка итога проверки: видно сразу, что не так. */
function Row({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  const { p } = useApp();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: S.sm,
      backgroundColor: p.inset, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 10,
    }}>
      <Icon name={ok ? 'check' : 'close'} size={14} width={2.2}
        color={ok ? p.good : p.danger} />
      <Text style={{ ...FONT.small, color: p.text2, flex: 1 }}>{label}</Text>
      <Text style={{ ...FONT.small, color: p.text, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
