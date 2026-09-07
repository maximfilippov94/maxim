/**
 * Здоровье клиента: аллергии, препараты и БАДы, анализы, рекомендации.
 *
 * Экран один на две роли. Специалист ведёт записи, клиент их только
 * читает: история рекомендаций перестаёт быть историей, если её может
 * править тот, кому её дали.
 *
 * Показатели анализов по строкам мы намеренно не разбираем — храним
 * файл с датой. Ошибка в распознанной цифре опаснее, чем её отсутствие,
 * а решение по анализам принимает человек.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import {
  api, Health, Allergy, Med, Lab, Recommendation,
  ALLERGY_KINDS, MED_KINDS,
} from '../api';
import { openPrivateFile } from '../openPrivateFile';
import { uploadForm } from '../upload';
import { pickPhoto } from '../photo';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Muted, Pills } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysConfirm } from '../ui/system';
import { haptic } from '../haptics';
import { Loading, Fail } from './Shopping';

type Tab = 'allergies' | 'meds' | 'labs' | 'recommendations';
const TABS: [Tab, string][] = [
  ['allergies', 'Аллергии'], ['meds', 'Препараты'],
  ['labs', 'Анализы'], ['recommendations', 'Рекомендации'],
];

/** «1 сентября 2026» — даты здесь всегда важны, время неважно никогда. */
function day(v?: string | null) {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(+d)) return String(v);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function HealthScreen({ clientId, title }: {
  /** Есть — экран специалиста по своему клиенту; нет — клиент про себя */
  clientId?: number;
  title?: string;
}) {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const edit = clientId != null;
  const base = edit ? `/specialist/clients/${clientId}/health` : '/client/health';

  const [d, setD] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('allergies');

  const load = useCallback(async () => {
    try { setD(await api<Health>(base)); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось открыть'); }
  }, [base]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = useCallback(async (kind: string, id: number) => {
    setD(cur => cur && { ...cur, [kind]: (cur as any)[kind].filter((x: any) => x.id !== id) });
    try { await api(`/specialist/${kind}/${id}`, { method: 'DELETE' }); haptic.success(); }
    catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалилось'); load(); }
  }, [load]);

  if (err && !d) return <Fail title="Здоровье" text={err} />;
  if (!d) return <Loading title="Здоровье" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={title ?? 'Здоровье'} back />
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
        }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Pills items={TABS} value={tab} onChange={setTab} scroll
            style={{ marginTop: S.md, marginBottom: S.md,
              marginHorizontal: -S.lg, paddingHorizontal: S.lg }} />

          {err ? (
            <Card style={{ marginBottom: S.sm }}>
              <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text>
            </Card>
          ) : null}

          {tab === 'allergies' ? (
            <Allergies list={d.allergies} edit={edit} clientId={clientId}
              onAdd={load} onRemove={id => remove('allergies', id)} onError={setErr} />
          ) : null}
          {tab === 'meds' ? (
            <Meds list={d.meds} edit={edit} clientId={clientId}
              onAdd={load} onRemove={id => remove('meds', id)} onError={setErr} />
          ) : null}
          {tab === 'labs' ? (
            <Labs list={d.labs} edit={edit} clientId={clientId}
              onAdd={load} onRemove={id => remove('labs', id)} onError={setErr} />
          ) : null}
          {tab === 'recommendations' ? (
            <Recs list={d.recommendations} edit={edit} clientId={clientId}
              onAdd={load} onRemove={id => remove('recommendations', id)} onError={setErr} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ------------------------------------------------------------ аллергии */

function Allergies({ list, edit, clientId, onAdd, onRemove, onError }: {
  list: Allergy[]; edit: boolean; clientId?: number;
  onAdd: () => void; onRemove: (id: number) => void; onError: (m: string) => void;
}) {
  const { p } = useApp();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('allergy');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim()) { haptic.error(); onError('Что именно нельзя?'); return; }
    setBusy(true);
    try {
      await api(`/specialist/clients/${clientId}/allergies`, {
        method: 'POST', body: { title: title.trim(), kind },
      });
      setTitle(''); haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не добавилось'); }
    finally { setBusy(false); }
  }

  return (
    <View>
      {edit ? (
        <Card style={{ marginBottom: S.md, gap: S.sm }}>
          <Pills items={Object.entries(ALLERGY_KINDS) as [string, string][]}
            value={kind} onChange={setKind} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <TextInput value={title} onChangeText={setTitle}
              placeholder="Например, арахис" placeholderTextColor={p.text3}
              onSubmitEditing={add} returnKeyType="done"
              style={{
                flex: 1, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
                paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
              }} />
            <AddBtn busy={busy} onPress={add} />
          </View>
        </Card>
      ) : null}

      {list.length === 0 ? (
        <Blank text={edit
          ? 'Пока ничего. Аллергии и непереносимости учитываются при составлении меню.'
          : 'Специалист пока не отметил аллергий.'} />
      ) : list.map((a, i) => (
        <Animated.View key={a.id} entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(200)}>
          <Card style={{ marginBottom: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...FONT.h3, color: p.text }}>{a.title}</Text>
              <Muted style={{ marginTop: 2 }}>
                {[ALLERGY_KINDS[a.kind] ?? a.kind, a.note].filter(Boolean).join(' · ')}
              </Muted>
            </View>
            {edit ? <Del onConfirm={() => onRemove(a.id)} what={a.title} /> : null}
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

/* ------------------------------------------------- препараты и добавки */

function Meds({ list, edit, clientId, onAdd, onRemove, onError }: {
  list: Med[]; edit: boolean; clientId?: number;
  onAdd: () => void; onRemove: (id: number) => void; onError: (m: string) => void;
}) {
  const { p } = useApp();
  const [title, setTitle] = useState('');
  const [dosage, setDosage] = useState('');
  const [kind, setKind] = useState('supplement');
  const [busy, setBusy] = useState(false);

  const field = {
    backgroundColor: p.inset, color: p.text, borderRadius: R.md,
    paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
  } as const;

  async function add() {
    if (!title.trim()) { haptic.error(); onError('Укажите название'); return; }
    setBusy(true);
    try {
      await api(`/specialist/clients/${clientId}/meds`, {
        method: 'POST',
        body: {
          title: title.trim(), kind,
          dosage: dosage.trim() || null,
          started_on: new Date().toISOString().slice(0, 10),
        },
      });
      setTitle(''); setDosage(''); haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не добавилось'); }
    finally { setBusy(false); }
  }

  /* Курс не удаляем, а закрываем датой: история приёма нужна, чтобы
     помнить, что уже пробовали и чем закончилось. */
  async function finish(m: Med) {
    try {
      await api(`/specialist/meds/${m.id}`, {
        method: 'PATCH', body: { ended_on: new Date().toISOString().slice(0, 10) },
      });
      haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не сохранилось'); }
  }

  return (
    <View>
      {edit ? (
        <Card style={{ marginBottom: S.md, gap: S.sm }}>
          <Pills items={Object.entries(MED_KINDS) as [string, string][]}
            value={kind} onChange={setKind} />
          <TextInput value={title} onChangeText={setTitle}
            placeholder="Название" placeholderTextColor={p.text3} style={field} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <TextInput value={dosage} onChangeText={setDosage}
              placeholder="Дозировка, например 2000 МЕ" placeholderTextColor={p.text3}
              onSubmitEditing={add} returnKeyType="done"
              style={[field, { flex: 1 }]} />
            <AddBtn busy={busy} onPress={add} />
          </View>
        </Card>
      ) : null}

      {list.length === 0 ? (
        <Blank text={edit
          ? 'Пока пусто. Здесь удобно держать препараты, БАДы и витамины с дозировками.'
          : 'Специалист пока ничего не добавил.'} />
      ) : list.map((m, i) => {
        const active = !m.ended_on;
        return (
          <Animated.View key={m.id} entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(200)}>
            <Card style={{ marginBottom: S.sm, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...FONT.h3, color: active ? p.text : p.text2 }}>
                    {m.title}
                  </Text>
                  <Muted style={{ marginTop: 2 }}>
                    {[MED_KINDS[m.kind] ?? m.kind, m.dosage, m.schedule]
                      .filter(Boolean).join(' · ')}
                  </Muted>
                  <Muted style={{ marginTop: 2 }}>
                    {active
                      ? `принимает${m.started_on ? ` с ${day(m.started_on)}` : ''}`
                      : `закончил ${day(m.ended_on)}`}
                  </Muted>
                </View>
                {edit ? <Del onConfirm={() => onRemove(m.id)} what={m.title} /> : null}
              </View>
              {edit && active ? (
                <Pressable onPress={() => { haptic.tap(); finish(m); }} hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, alignSelf: 'flex-start' })}>
                  <Text style={{ ...FONT.small, color: p.accent, fontWeight: '600' }}>
                    Курс закончен
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          </Animated.View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------- анализы */

function Labs({ list, edit, clientId, onAdd, onRemove, onError }: {
  list: Lab[]; edit: boolean; clientId?: number;
  onAdd: () => void; onRemove: (id: number) => void; onError: (m: string) => void;
}) {
  const { p } = useApp();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  /* Файл выбирают вместе с названием: анализ без подписи через месяц
     не отличить от другого такого же. */
  async function add() {
    if (!title.trim()) { haptic.error(); onError('Как называется анализ?'); return; }
    setBusy(true);
    try {
      const file = await pickPhoto();
      if (!file) { setBusy(false); return; }
      await uploadForm(`/specialist/clients/${clientId}/labs`, file, 'file', {
        title: title.trim(),
        taken_on: new Date().toISOString().slice(0, 10),
      });
      setTitle(''); haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не загрузилось'); }
    finally { setBusy(false); }
  }

  /* Файл лежит за проверкой прав: качаем его заголовком авторизации
     и отдаём системному просмотрщику. Токен в адресе не передаём — он
     остался бы в истории браузера. */
  async function open(l: Lab) {
    if (!l.file_url) return;
    haptic.tap();
    try { await openPrivateFile(l.file_url, l.title); }
    catch (e: any) { onError(e?.message ?? 'Не удалось открыть файл'); }
  }

  return (
    <View>
      {edit ? (
        <Card style={{ marginBottom: S.md, gap: S.sm }}>
          <TextInput value={title} onChangeText={setTitle}
            placeholder="Например, общий анализ крови" placeholderTextColor={p.text3}
            style={{
              backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
            }} />
          <Pressable onPress={add} disabled={busy}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 7, height: 44, borderRadius: R.pill,
              backgroundColor: p.primary, opacity: pressed || busy ? 0.6 : 1,
            })}>
            {busy ? <ActivityIndicator color={p.onPrimary} size="small" />
              : <Icon name="clip" size={16} color={p.onPrimary} width={1.9} />}
            <Text style={{ ...FONT.small, fontWeight: '600', color: p.onPrimary }}>
              Прикрепить файл
            </Text>
          </Pressable>
          <Muted>PDF или снимок бланка, до 15 МБ.</Muted>
        </Card>
      ) : null}

      {list.length === 0 ? (
        <Blank text={edit
          ? 'Анализов пока нет. Файл хранится как есть — показатели по строкам не разбираются.'
          : 'Анализы пока не добавлены.'} />
      ) : list.map((l, i) => (
        <Animated.View key={l.id} entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(200)}>
          <Pressable onPress={() => open(l)} disabled={!l.file_url}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Card style={{ marginBottom: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <View style={{
                width: 42, height: 42, borderRadius: R.md, backgroundColor: p.inset,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="edit" size={18} color={p.text3} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={1}>{l.title}</Text>
                <Muted style={{ marginTop: 2 }}>
                  {[day(l.taken_on) || day(l.created_at), l.file_url ? 'открыть' : 'без файла']
                    .filter(Boolean).join(' · ')}
                </Muted>
              </View>
              {edit ? <Del onConfirm={() => onRemove(l.id)} what={l.title} /> : null}
            </Card>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

/* --------------------------------------------------------- рекомендации */

function Recs({ list, edit, clientId, onAdd, onRemove, onError }: {
  list: Recommendation[]; edit: boolean; clientId?: number;
  onAdd: () => void; onRemove: (id: number) => void; onError: (m: string) => void;
}) {
  const { p } = useApp();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!body.trim()) { haptic.error(); onError('Пустая рекомендация'); return; }
    setBusy(true);
    try {
      await api(`/specialist/clients/${clientId}/recommendations`, {
        method: 'POST', body: { body: body.trim() },
      });
      setBody(''); haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не сохранилось'); }
    finally { setBusy(false); }
  }

  return (
    <View>
      {edit ? (
        <Card style={{ marginBottom: S.md, gap: S.sm }}>
          <TextInput value={body} onChangeText={setBody} multiline
            placeholder="Что рекомендовали и почему" placeholderTextColor={p.text3}
            style={{
              minHeight: 76, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15, lineHeight: 21,
            }} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <AddBtn busy={busy} onPress={add} label="Записать" />
          </View>
        </Card>
      ) : null}

      {list.length === 0 ? (
        <Blank text={edit
          ? 'Здесь копится история: что советовали и когда. Клиент это видит.'
          : 'Рекомендаций пока нет.'} />
      ) : list.map((r, i) => (
        <Animated.View key={r.id} entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(200)}>
          <Card style={{ marginBottom: S.sm, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.md }}>
              <Text style={{ ...FONT.body, color: p.text, flex: 1, lineHeight: 21 }}>
                {r.body}
              </Text>
              {edit ? <Del onConfirm={() => onRemove(r.id)} what="запись" /> : null}
            </View>
            <Muted>{day(r.created_at)}</Muted>
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------- мелочи */

function AddBtn({ busy, onPress, label }: { busy: boolean; onPress: () => void; label?: string }) {
  const { p } = useApp();
  return (
    <Pressable onPress={onPress} disabled={busy}
      style={({ pressed }) => ({
        height: 44, minWidth: 44, paddingHorizontal: label ? 18 : 0, borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: p.primary, opacity: pressed || busy ? 0.6 : 1,
      })}>
      {busy ? <ActivityIndicator color={p.onPrimary} size="small" />
        : label
          ? <Text style={{ ...FONT.small, fontWeight: '600', color: p.onPrimary }}>{label}</Text>
          : <Icon name="plus" size={18} color={p.onPrimary} width={2.4} />}
    </Pressable>
  );
}

function Del({ onConfirm, what }: { onConfirm: () => void; what: string }) {
  const { p } = useApp();
  return (
    <SysConfirm label="Убрать" tint={p.text3}
      title={`Убрать «${what}»?`} confirmLabel="Убрать" onConfirm={onConfirm} />
  );
}

function Blank({ text }: { text: string }) {
  return (
    <Card style={{ paddingVertical: 18 }}>
      <Muted style={{ lineHeight: 20 }}>{text}</Muted>
    </Card>
  );
}
