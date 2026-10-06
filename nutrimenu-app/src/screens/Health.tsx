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
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Share,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useApp } from '../store';
import {
  api, Health, Allergy, Med, Lab, Recommendation,
  ALLERGY_KINDS, MED_KINDS, REC_KINDS, HEALTH_DOC_KINDS,
} from '../api';
import { openPrivateFile, fetchPrivateFile, looksLikeImage } from '../openPrivateFile';
import { ImageViewer } from '../ui/ImageViewer';
import { uploadForm } from '../upload';
import { pickDocument } from '../photo';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Muted, Pills } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysConfirm, SysDate, SysButton } from '../ui/system';
import { haptic } from '../haptics';
import { Loading, Fail } from './Shopping';
import Cycle from './Cycle';

/* Разделы те же, что в вебе: обзор, цикл, данные, документы. Четыре
   прежние вкладки — аллергии, препараты, анализы, рекомендации — были
   своим делением: на сайте это секции внутри «Данных», а первым экраном
   человек видит сводку, а не список аллергий. */
type Tab = 'overview' | 'cycle' | 'data' | 'docs';

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
  const { p, me } = useApp();
  const insets = useSafeAreaInsets();
  const spec = clientId != null;
  const base = spec ? `/specialist/clients/${clientId}/health` : '/client/health';
  /* Клиент ведёт своё здоровье сам: сервер принимает от него те же
     записи, что от специалиста, — своими маршрутами. Раньше формы были
     только у специалиста, и человек мог лишь смотреть на свои аллергии,
     не добавив ни одной. */
  const write = {
    allergies: spec ? `/specialist/clients/${clientId}/allergies` : '/client/health/allergies',
    meds: spec ? `/specialist/clients/${clientId}/meds` : '/client/health/meds',
    labs: spec ? `/specialist/clients/${clientId}/labs` : '/client/health/labs',
  };
  /* Формы показываем в обеих ролях: клиент ведёт своё здоровье сам, и
     сервер это принимает. Удаление адресуется по самой записи — в
     remove ниже. */
  const edit = true;

  const [d, setD] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  /* Какую секцию «Данных» открыть, если пришли с плитки обзора. */
  const [focus, setFocus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setD(await api<Health>(base)); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось открыть'); }
  }, [base]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = useCallback(async (kind: string, id: number) => {
    setD(cur => cur && { ...cur, [kind]: (cur as any)[kind].filter((x: any) => x.id !== id) });
    const url = spec ? `/specialist/${kind}/${id}` : `/client/health/${kind}/${id}`;
    try { await api(url, { method: 'DELETE' }); haptic.success(); }
    catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалилось'); load(); }
  }, [load, spec]);

  if (err && !d) return <Fail title="Здоровье" text={err} />;
  if (!d) return <Loading title="Здоровье" />;

  /* Цикл показываем женщинам и всем, у кого раздел уже включён — то же
     правило, что в вебе (`showCycle`). Специалисту вкладка не нужна:
     цикл он смотрит в карточке клиента, если клиент открыл доступ. */
  const showCycle = !spec && (!me?.user?.sex
    || String(me.user.sex).toLowerCase().startsWith('f')
    || !!d.cycle?.enabled);

  const tabs: [Tab, string][] = [
    ['overview', 'Обзор'],
    ...(showCycle ? [['cycle', 'Цикл'] as [Tab, string]] : []),
    ['data', 'Данные'],
    ['docs', 'Документы'],
  ];

  /* «Обновлено» — самая свежая из всех записей раздела. */
  const updated = [...d.allergies, ...d.meds, ...d.labs, ...d.recommendations]
    .map((x: any) => x.taken_on || x.created_at)
    .filter(Boolean).sort().reverse()[0] ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title={title ?? 'Здоровье'} back />
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
        }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Pills items={tabs} value={tab} onChange={setTab} scroll
            style={{ marginTop: S.md, marginBottom: S.md,
              marginHorizontal: -S.lg, paddingHorizontal: S.lg }} />

          {err ? (
            <Card style={{ marginBottom: S.sm }}>
              <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text>
            </Card>
          ) : null}

          {/* Обзор: сколько чего записано и когда обновляли. На сайте с
              него начинается раздел — и это правильно: человек заходит
              посмотреть, а не сразу вводить. */}
          {tab === 'overview' ? (
            <>
              <Overview d={d} updated={updated} spec={spec}
                onGo={(t: Tab, k?: string) => { setTab(t); if (k) setFocus(k); }} />
              {!spec ? (
                <>
                  <ShareOut d={d} name={me?.user?.name ?? 'Клиент EQUA'} />
                  {/* Вопрос по анализам задают не себе: из раздела
                      здоровья в вебе есть прямой переход в переписку. */}
                  <View style={{ marginTop: S.md }}>
                    <SysButton label="Обсудить со специалистом" icon="bubble.left"
                      onPress={() => { haptic.tap(); router.push('/client/chat'); }} />
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'cycle' ? <Cycle embedded /> : null}

          {tab === 'data' ? (
            <>
              <Vitals d={d} />
              <Section key={`a-${focus}`} title="Аллергии и ограничения" open={focus === 'allergies'}>
                <Allergies list={d.allergies} edit={edit} postTo={write.allergies}
                  onAdd={load} onRemove={id => remove('allergies', id)} onError={setErr} />
              </Section>
              <Section key={`m-${focus}`} title="Препараты и БАДы" open={focus === 'meds'}>
                <Meds list={d.meds} edit={edit} postTo={write.meds} spec={spec}
                  finishTo={(id: number) => spec ? `/specialist/meds/${id}` : `/client/health/meds/${id}/finish`}
                  onAdd={load} onRemove={id => remove('meds', id)} onError={setErr} />
              </Section>
              <Section key={`r-${focus}`} title="Рекомендации" open={focus === 'recs'}>
                <Recs list={d.recommendations} edit={spec} clientId={clientId} spec={spec}
                  onAdd={load} onRemove={id => remove('recommendations', id)} onError={setErr} />
              </Section>
              {/* Кто и что менял в разделе — отдельной секцией, как в вебе. */}
              {(d.history ?? []).length ? (
                <Section title="Журнал изменений">
                  <Card style={{ padding: 0 }}>
                    {(d.history ?? []).slice(0, 20).map((x: any, i: number) => (
                      <View key={x.id ?? i} style={{
                        paddingVertical: 10, paddingHorizontal: S.lg,
                        borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
                      }}>
                        <Text style={{ fontSize: 14, color: p.text }}>
                          {x.summary ?? x.action ?? '—'}
                        </Text>
                        <Muted style={{ marginTop: 2 }}>{day(x.created_at)}</Muted>
                      </View>
                    ))}
                  </Card>
                </Section>
              ) : null}
            </>
          ) : null}

          {tab === 'docs' ? (
            <Labs list={d.labs} edit={edit} postTo={write.labs} spec={spec}
              onAdd={load} onRemove={id => remove('labs', id)} onError={setErr} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ------------------------------------------------------------ аллергии */

function Allergies({ list, edit, postTo, onAdd, onRemove, onError }: {
  list: Allergy[]; edit: boolean; postTo: string;
  onAdd: () => void; onRemove: (id: number) => void; onError: (m: string) => void;
}) {
  const { p } = useApp();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('allergy');
  /* Комментарий — как в форме веба: «как проявляется или что учесть». */
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim()) { haptic.error(); onError('Что именно нельзя?'); return; }
    setBusy(true);
    try {
      await api(postTo, {
        method: 'POST', body: { title: title.trim(), kind, note: note.trim() },
      });
      setTitle(''); setNote(''); haptic.success(); onAdd();
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
          <TextInput value={note} onChangeText={setNote}
            placeholder="Как проявляется — необязательно" placeholderTextColor={p.text3}
            style={{
              backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
            }} />
        </Card>
      ) : null}

      {list.length === 0 ? (
        <Blank text={edit
          ? 'Пока ничего. Аллергии и непереносимости учитываются при составлении меню.'
          : 'Специалист пока не отметил аллергий.'} />
      ) : list.map((a, i) => (
        <Animated.View key={a.id} entering={FadeIn.duration(200)}>
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

function Meds({ list, edit, postTo, spec, finishTo, onAdd, onRemove, onError }: {
  list: Med[]; edit: boolean; postTo: string; spec: boolean;
  finishTo: (id: number) => string;
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
      await api(postTo, {
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
      /* У специалиста курс закрывается датой окончания, у клиента для
         этого свой маршрут — поле ended_on он менять не может. */
      await api(finishTo(m.id), spec
        ? { method: 'PATCH', body: { ended_on: new Date().toISOString().slice(0, 10) } }
        : { method: 'PATCH', body: {} });
      haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не сохранилось'); }
  }

  /* Отметка приёма. Маршрут перезаписывает счётчик за день целиком,
     поэтому считаем от того, что уже отмечено: сервер отдаёт taken_today
     вместе с препаратом. Отмечает только сам человек — специалист не
     может знать, выпил он таблетку или нет. */
  async function intake(m: Med) {
    const target = Math.max(1, m.frequency_per_day ?? 1);
    const next = Math.min(target, (m.taken_today ?? 0) + 1);
    try {
      await api(`/client/health/meds/${m.id}/intake`, {
        method: 'POST', body: { taken_count: next },
      });
      haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не отметилось'); }
  }

  /* Напоминание об окончании курса. Только у клиента: маршрут меняет
     его собственную настройку уведомления, у специалиста такого нет. */
  const [remind, setRemind] = useState<number | null>(null);
  const [remindDay, setRemindDay] = useState(() => new Date());
  /* Второе напоминание — ежедневное, о самом приёме, со временем:
     сервер держит его отдельным маршрутом (`intake-reminder`). */
  const [atTime, setAtTime] = useState('09:00');
  async function saveReminder(m: Med, enabled: boolean) {
    try {
      await api(`/client/health/meds/${m.id}/reminder`, {
        method: 'PATCH', body: { enabled, reminder_on: enabled ? ymd(remindDay) : '' },
      });
      setRemind(null); haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не сохранилось'); }
  }
  async function saveIntakeReminder(m: Med, enabled: boolean) {
    if (enabled && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(atTime)) {
      haptic.error(); onError('Время в виде 09:00'); return;
    }
    try {
      await api(`/client/health/meds/${m.id}/intake-reminder`, {
        method: 'PATCH', body: { enabled, time: enabled ? atTime : '' },
      });
      setRemind(null); haptic.success(); onAdd();
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
          <Animated.View key={m.id} entering={FadeIn.duration(200)}>
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
              {active ? (
                <View style={{ flexDirection: 'row', gap: S.lg, alignItems: 'center', flexWrap: 'wrap' }}>
                  {!spec ? (() => {
                    const target = Math.max(1, m.frequency_per_day ?? 1);
                    const taken = Math.min(target, m.taken_today ?? 0);
                    const left = target - taken;
                    return left ? (
                      <Pressable onPress={() => { haptic.tap(); intake(m); }} hitSlop={8}
                        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                        <Text style={{ ...FONT.small, color: p.accent, fontWeight: '600' }}>
                          Принял{target > 1 ? ` · ${taken} из ${target}` : ''}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={{ ...FONT.small, color: p.text3 }}>
                        сегодня принято{target > 1 ? ` ${taken} из ${target}` : ''}
                      </Text>
                    );
                  })() : null}
                  <Pressable onPress={() => { haptic.tap(); finish(m); }} hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                    <Text style={{ ...FONT.small, color: p.accent, fontWeight: '600' }}>
                      Курс закончен
                    </Text>
                  </Pressable>
                  {!spec ? (
                    <Pressable hitSlop={8}
                      onPress={() => {
                        haptic.tap();
                        setRemindDay(m.reminder_on ? new Date(m.reminder_on + 'T00:00:00') : new Date());
                        setAtTime(m.intake_reminder_time || '09:00');
                        setRemind(v => (v === m.id ? null : m.id));
                      }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                      <Text style={{ ...FONT.small, color: p.accent, fontWeight: '600' }}>
                        {m.intake_reminder_enabled
                          ? `Напомнит каждый день в ${m.intake_reminder_time}`
                          : m.reminder_enabled ? `Напомнит ${day(m.reminder_on)}` : 'Напоминания'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {/* Дата напоминания — тем же системным календарём, что и
                  везде. В вебе это отдельная шторка, здесь строка
                  раскрывается прямо в карточке курса. */}
              {remind === m.id ? (
                <View style={{ gap: S.sm, marginTop: S.xs }}>
                  <Muted>Напомнить об окончании курса</Muted>
                  <SysDate value={remindDay} onChange={setRemindDay} min={new Date()} />
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    <View style={{ flex: 1 }}>
                      <SysButton label="Сохранить" variant="prominent" height={44}
                        onPress={() => saveReminder(m, true)} />
                    </View>
                    {m.reminder_enabled ? (
                      <View style={{ flex: 1 }}>
                        <SysButton label="Отключить" height={44}
                          onPress={() => saveReminder(m, false)} />
                      </View>
                    ) : null}
                  </View>

                  <Muted style={{ marginTop: S.sm }}>Напоминать принимать каждый день</Muted>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                    <TextInput value={atTime} onChangeText={setAtTime}
                      placeholder="09:00" placeholderTextColor={p.text3}
                      keyboardType="numbers-and-punctuation" maxLength={5}
                      accessibilityLabel="Время напоминания"
                      style={{
                        width: 92, backgroundColor: p.inset, color: p.text, borderRadius: R.md,
                        paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
                      }} />
                    <View style={{ flex: 1 }}>
                      <SysButton label="Включить" height={44}
                        onPress={() => saveIntakeReminder(m, true)} />
                    </View>
                    {m.intake_reminder_enabled ? (
                      <View style={{ flex: 1 }}>
                        <SysButton label="Выключить" height={44}
                          onPress={() => saveIntakeReminder(m, false)} />
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </Card>
          </Animated.View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------- анализы */

function Labs({ list, edit, postTo, spec, onAdd, onRemove, onError }: {
  list: Lab[]; edit: boolean; postTo: string; spec: boolean;
  onAdd: () => void; onRemove: (id: number) => void; onError: (m: string) => void;
}) {
  const { p } = useApp();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('analysis');
  const [taken, setTaken] = useState(() => new Date());
  const [lab, setLab] = useState('');
  const [note, setNote] = useState('');
  /* Кому документ виден. По умолчанию обоим — как в вебе; EQUA AI
     документы не получает ни при каких настройках. */
  const [toNut, setToNut] = useState(true);
  const [toEnd, setToEnd] = useState(true);
  const [busy, setBusy] = useState(false);

  /* Поля те же, что в форме веба: вид, название, дата исследования,
     лаборатория, комментарий и доступ ролям. Файл берём системным
     выбором, а не галереей: PDF из почты в галерее не лежит. */
  async function add() {
    if (!title.trim()) { haptic.error(); onError('Как называется документ?'); return; }
    setBusy(true);
    try {
      const file = await pickDocument();
      if (!file) { setBusy(false); return; }
      await uploadForm(postTo, file, 'file', {
        title: title.trim(),
        doc_type: kind,
        taken_on: ymd(taken),
        lab_name: lab.trim(),
        note: note.trim(),
        share_nutritionist: toNut ? '1' : '0',
        share_endocrinologist: toEnd ? '1' : '0',
      });
      setTitle(''); setLab(''); setNote(''); haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не загрузилось'); }
    finally { setBusy(false); }
  }

  /* Файл лежит за проверкой прав: качаем его заголовком авторизации
     и отдаём системному просмотрщику. Токен в адресе не передаём — он
     остался бы в истории браузера. */
  const [viewer, setViewer] = useState<{ uri: string; title: string } | null>(null);

  /* Правка карточки документа: те же поля, что в форме, — в вебе это
     шторка «Настройки и доступ». Файл не меняется, меняется описание. */
  const [editing, setEditing] = useState<number | null>(null);
  async function saveComment(l: Lab, comment: string) {
    try {
      await api(`/specialist/labs/${l.id}/comment`, { method: 'PATCH', body: { comment } });
      setEditing(null); haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не отправилось'); }
  }

  async function saveEdit(l: Lab, patch: Record<string, unknown>) {
    try {
      await api(`/client/health/labs/${l.id}`, { method: 'PATCH', body: patch });
      setEditing(null); haptic.success(); onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не сохранилось'); }
  }

  async function open(l: Lab) {
    if (!l.file_url) return;
    haptic.tap();
    /* Отмечаем, кто документ открыл. У клиента — что он увидел
       комментарий специалиста, у специалиста — что документ просмотрен
       (в вебе это `hReviewLab`). Ответа не ждём: открытие файла не
       должно ждать статистику. */
    if (spec) api(`/specialist/labs/${l.id}/review`, { method: 'PATCH' }).catch(() => {});
    else api(`/client/health/labs/${l.id}/seen`, { method: 'POST', body: {} }).catch(() => {});
    try {
      /* Снимок анализа показываем тут же: уходить в системный
         просмотрщик и возвращаться кнопкой «назад» ради одной картинки
         незачем. PDF и прочее по-прежнему отдаём системе. */
      if (looksLikeImage(l.file_url)) {
        setViewer({ uri: await fetchPrivateFile(l.file_url, l.title), title: l.title });
        return;
      }
      await openPrivateFile(l.file_url, l.title);
    } catch (e: any) { onError(e?.message ?? 'Не удалось открыть файл'); }
  }

  return (
    <View>
      <ImageViewer uri={viewer?.uri ?? null} title={viewer?.title}
        onClose={() => setViewer(null)} />
      {edit ? (
        <Card style={{ marginBottom: S.md, gap: S.sm }}>
          <Pills items={Object.entries(HEALTH_DOC_KINDS) as [string, string][]}
            value={kind} onChange={setKind} />
          <TextInput value={title} onChangeText={setTitle}
            placeholder="Например, общий анализ крови" placeholderTextColor={p.text3}
            style={{
              backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
            }} />
          <Muted>Дата исследования</Muted>
          <SysDate value={taken} onChange={setTaken} max={new Date()} />
          <TextInput value={lab} onChangeText={setLab}
            placeholder="Лаборатория — необязательно" placeholderTextColor={p.text3}
            style={{
              backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
            }} />
          <TextInput value={note} onChangeText={setNote} multiline
            placeholder="Что важно запомнить" placeholderTextColor={p.text3}
            style={{
              backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15, minHeight: 64,
              textAlignVertical: 'top',
            }} />
          <Muted>Кому открыть документ</Muted>
          <Share_ label="Нутрициологу" on={toNut} onToggle={() => setToNut(v => !v)} />
          <Share_ label="Эндокринологу" on={toEnd} onToggle={() => setToEnd(v => !v)} />
          <Muted>EQUA AI этот документ не получает.</Muted>
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
        <Animated.View key={l.id} entering={FadeIn.duration(200)}>
          <Card style={{ marginBottom: S.sm }}>
            <Pressable onPress={() => open(l)} disabled={!l.file_url}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: S.md,
                opacity: pressed ? 0.7 : 1,
              })}>
              <View style={{
                width: 42, height: 42, borderRadius: R.md, backgroundColor: p.inset,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="edit" size={18} color={p.text3} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={1}>{l.title}</Text>
                <Muted style={{ marginTop: 2 }}>
                  {[HEALTH_DOC_KINDS[l.doc_type ?? ''] ?? null,
                    day(l.taken_on) || day(l.created_at),
                    l.lab_name || null,
                    l.file_url ? 'открыть' : 'без файла']
                    .filter(Boolean).join(' · ')}
                </Muted>
                {l.note ? <Muted style={{ marginTop: 2 }} numberOfLines={2}>{l.note}</Muted> : null}
                {l.specialist_comment ? (
                  <Muted style={{ marginTop: 4 }}>
                    Комментарий специалиста: {l.specialist_comment}
                  </Muted>
                ) : null}
              </View>
              {edit ? <Del onConfirm={() => onRemove(l.id)} what={l.title} /> : null}
            </Pressable>

            {/* «Настройки и доступ» — вид, название, дата, лаборатория,
                комментарий и кому документ открыт. Файл не меняется. */}
            {edit && !spec ? (
              <Pressable onPress={() => { haptic.tap(); setEditing(v => (v === l.id ? null : l.id)); }}
                style={({ pressed }) => ({ marginTop: S.sm, opacity: pressed ? 0.5 : 1 })}>
                <Text style={{ ...FONT.small, fontWeight: '600', color: p.accent }}>
                  {editing === l.id ? 'Свернуть' : 'Настройки и доступ'}
                </Text>
              </Pressable>
            ) : null}
            {editing === l.id && !spec ? <LabEdit l={l} onSave={patch => saveEdit(l, patch)} /> : null}

            {/* Специалист документ не правит — он его комментирует.
                Комментарий видит клиент в своей карточке документа. */}
            {spec ? (
              <Pressable onPress={() => { haptic.tap(); setEditing(v => (v === l.id ? null : l.id)); }}
                style={({ pressed }) => ({ marginTop: S.sm, opacity: pressed ? 0.5 : 1 })}>
                <Text style={{ ...FONT.small, fontWeight: '600', color: p.accent }}>
                  {editing === l.id ? 'Свернуть' : l.specialist_comment ? 'Изменить комментарий' : 'Комментарий клиенту'}
                </Text>
              </Pressable>
            ) : null}
            {spec && editing === l.id ? (
              <LabComment l={l} onSave={text => saveComment(l, text)} />
            ) : null}
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

/* --------------------------------------------------------- рекомендации */

function Recs({ list, edit, clientId, spec, onAdd, onRemove, onError }: {
  list: Recommendation[]; edit: boolean; clientId?: number; spec: boolean;
  onAdd: () => void; onRemove: (id: number) => void; onError: (m: string) => void;
}) {
  const { p } = useApp();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  /* Свой ответ на рекомендацию. Перечитываем раздел целиком: статус
     видят обе стороны, и подменять его на месте значило бы показывать
     клиенту то, чего специалист ещё не получил. */
  async function setClientStatus(id: number, status: 'in_progress' | 'done') {
    haptic.select();
    try {
      await api(`/client/health/recommendations/${id}/status`, {
        method: 'PATCH', body: { status },
      });
      onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не сохранилось'); }
  }

  /* Закрыть рекомендацию может только её автор — так проверяет сервер. */
  async function setSpecStatus(id: number, status: 'done' | 'cancelled') {
    haptic.select();
    try {
      await api(`/specialist/recommendations/${id}`, { method: 'PATCH', body: { status } });
      onAdd();
    } catch (e: any) { haptic.error(); onError(e?.message ?? 'Не сохранилось'); }
  }

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
      ) : list.map((r, i) => {
        const open = (r.status ?? 'active') === 'active';
        /* Подпись под текстом собирается из того, что есть: у старых
           записей нет ни заголовка, ни срока, ни автора. */
        const foot = [
          r.author_name,
          day(r.created_at),
          r.valid_until ? `до ${day(r.valid_until)}` : null,
        ].filter(Boolean).join(' · ');
        return (
        <Animated.View key={r.id} entering={FadeIn.duration(200)}>
          <Card style={{ marginBottom: S.sm, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.md }}>
              <View style={{ flex: 1 }}>
                {(r.title || r.category) ? (
                  <Text style={{ ...FONT.h3, color: p.text, marginBottom: 4 }}>
                    {r.title || REC_KINDS[r.category ?? 'general'] || 'Рекомендация'}
                  </Text>
                ) : null}
                <Text style={{ ...FONT.body, color: p.text, lineHeight: 21 }}>{r.body}</Text>
              </View>
              {/* Чем кончилась рекомендация — меткой справа: у списка из
                  десятка записей иначе не видно, что ещё в силе. */}
              <RecMark status={r.status ?? 'active'} clientStatus={r.client_status ?? 'new'} spec={spec} />
              {edit ? <Del onConfirm={() => onRemove(r.id)} what="запись" /> : null}
            </View>
            {foot ? <Muted>{foot}</Muted> : null}

            {/* Клиент отвечает на рекомендацию, специалист закрывает её.
                Ни того ни другого в приложении не было: на сайте клиент
                отмечает «выполняю» и «выполнено», и специалист это видит. */}
            {open && !spec ? (
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: 4 }}>
                <RecBtn label="Выполняю" on={r.client_status === 'in_progress'}
                  onPress={() => setClientStatus(r.id, 'in_progress')} />
                <RecBtn label="Выполнено" on={r.client_status === 'done'}
                  onPress={() => setClientStatus(r.id, 'done')} />
              </View>
            ) : null}
            {open && spec ? (
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: 4 }}>
                <RecBtn label="Выполнена" onPress={() => setSpecStatus(r.id, 'done')} />
                <RecBtn label="Отменить" onPress={() => setSpecStatus(r.id, 'cancelled')} />
              </View>
            ) : null}
          </Card>
        </Animated.View>
        );
      })}
    </View>
  );
}

/* --------------------------------------------------------------- обзор */

/**
 * Первый экран раздела — как `health-hero` в вебе: когда обновляли,
 * метка приватности и четыре плитки с числами. Нажатие на плитку
 * открывает нужную секцию, а не просто меняет вкладку.
 */
function Overview({ d, updated, spec, onGo }: {
  d: Health; updated: string | null; spec: boolean;
  onGo: (tab: Tab, focus?: string) => void;
}) {
  const { p } = useApp();
  const active = d.meds.filter(m => !m.ended_on).length;
  /* Те же три источника и тот же порядок, что в вебе. */
  const timeline = [
    ...d.labs.map((x: any) => ({ at: x.taken_on || x.created_at, ic: 'doc',
      title: x.title as string, sub: 'Документ' })),
    ...d.recommendations.map((x: any) => ({ at: x.created_at, ic: 'heart',
      title: 'Рекомендация специалиста', sub: x.body as string })),
    ...d.meds.map((x: any) => ({ at: x.started_on || x.created_at, ic: 'plus',
      title: x.title as string, sub: x.ended_on ? 'Курс завершён' : 'Начало приёма' })),
  ].filter(x => x.at)
   .sort((a, b) => String(b.at).localeCompare(String(a.at)))
   .slice(0, 6);

  const tiles: [string, number, string, Tab, string][] = [
    ['warn', d.allergies.length, 'аллергии', 'data', 'allergies'],
    ['plus', active, 'принимаю', 'data', 'meds'],
    ['doc', d.labs.length, 'документы', 'docs', ''],
    ['heart', d.recommendations.length, 'рекомендации', 'data', 'recs'],
  ];
  return (
    <View>
      <Card style={{ marginBottom: S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{
            width: 42, height: 42, borderRadius: 21, alignItems: 'center',
            justifyContent: 'center', backgroundColor: p.primarySoft,
          }}>
            <Icon name="heart" size={20} color={p.accent} width={1.8} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...FONT.h3, color: p.text }}>Профиль здоровья</Text>
            <Muted style={{ marginTop: 2 }}>
              Обновлено · {updated ? day(updated) : 'ещё нет записей'}
            </Muted>
          </View>
          {/* Записи видит только тот, кому клиент открыл раздел — об этом
              стоит сказать прямо, иначе их просто не заводят. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="lock" size={13} color={p.text3} width={1.8} />
            <Text style={{ fontSize: 11, color: p.text3 }}>Приватно</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.lg }}>
          {tiles.map(([ic, n, label, tab, key]) => (
            <Pressable key={label} onPress={() => { haptic.tap(); onGo(tab, key || undefined); }}
              style={({ pressed }) => ({
                flexBasis: '47%', flexGrow: 1,
                paddingVertical: 12, paddingHorizontal: 12, borderRadius: R.md,
                backgroundColor: p.inset, opacity: pressed ? 0.7 : 1,
              })}>
              <Icon name={ic} size={16} color={p.text3} width={1.8} />
              <Text style={{ fontSize: 22, fontWeight: '700', color: p.text, marginTop: 6 }}>{n}</Text>
              <Text style={{ fontSize: 12, color: p.text3 }} numberOfLines={1}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* История здоровья — шесть последних событий из документов,
          рекомендаций и препаратов, как `timeline` в вебе. Журнал
          изменений (кто и что правил) живёт на вкладке «Данные». */}
      {timeline.length ? (
        <>
          <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.sm }}>
            История здоровья
          </Text>
          <Card style={{ padding: 0, marginBottom: S.md }}>
            {timeline.map((x, i) => (
              <View key={`${x.at}-${i}`} style={{
                flexDirection: 'row', alignItems: 'flex-start', gap: S.md,
                paddingVertical: 11, paddingHorizontal: S.lg,
                borderTopWidth: i ? 1 : 0, borderTopColor: p.borderSoft,
              }}>
                <Icon name={x.ic} size={16} color={p.text3} width={1.8} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, color: p.text }} numberOfLines={2}>{x.title}</Text>
                  <Muted numberOfLines={1}>{x.sub} · {day(x.at)}</Muted>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : spec ? null : (
        <Blank text="Записи появятся здесь, как только вы что-нибудь добавите." />
      )}
    </View>
  );
}

/** Показатели тела — вес и замеры, как секция «Показатели тела» в вебе. */
function Vitals({ d }: { d: Health }) {
  const { p } = useApp();
  const w = d.metrics?.weights ?? [];
  const last = w[0] ?? null;
  const prev = w[1] ?? null;
  const delta = last && prev ? Number(last.weight_kg) - Number(prev.weight_kg) : null;
  const waist = d.metrics?.measurement?.waist_cm ?? null;
  if (!last && !waist) return null;
  return (
    <Card style={{ marginBottom: S.md }}>
      <Text style={{ ...FONT.h3, color: p.text, marginBottom: S.md }}>Показатели тела</Text>
      <View style={{ flexDirection: 'row', gap: S.md }}>
        <View style={{ flex: 1 }}>
          <Muted>Вес</Muted>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
            <Text style={{ fontSize: 21, fontWeight: '700', color: p.text }}>
              {last ? last.weight_kg : '—'}
            </Text>
            {last ? <Muted style={{ marginLeft: 3 }}>кг</Muted> : null}
          </View>
          {delta !== null && Math.abs(delta) >= 0.05 ? (
            <Text style={{ fontSize: 12, marginTop: 2,
              color: delta > 0 ? p.warn : p.good }}>
              {delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)} кг
            </Text>
          ) : <Muted style={{ marginTop: 2 }}>{last ? day(last.measured_on) : 'нет данных'}</Muted>}
        </View>
        {waist != null ? (
          <View style={{ flex: 1 }}>
            <Muted>Талия</Muted>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: p.text }}>{waist}</Text>
              <Muted style={{ marginLeft: 3 }}>см</Muted>
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Сворачиваемая секция «Данных» — как `health-fold` в вебе: на одном
 * экране четыре списка, и без сворачивания до рекомендаций надо
 * прокручивать весь список препаратов.
 */
function Section({ title, open, children }: {
  title: string; open?: boolean; children: React.ReactNode;
}) {
  const { p } = useApp();
  /* Пришли с плитки обзора — секция открывается сама. Состояние задаётся
     начальным значением, а родитель меняет `key` при смене выбранной
     секции: так она пересоздаётся открытой, без правки состояния из
     эффекта. */
  const [on, setOn] = useState(!!open);
  return (
    <View style={{ marginBottom: S.md }}>
      <Pressable onPress={() => { haptic.tap(); setOn(v => !v); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: S.sm,
          paddingVertical: 10, opacity: pressed ? 0.7 : 1,
        })}>
        <Text style={{ ...FONT.h3, color: p.text, flex: 1 }}>{title}</Text>
        <View style={{ transform: [{ rotate: on ? '90deg' : '0deg' }] }}>
          <Icon name="chevr" size={15} color={p.text3} width={2} />
        </View>
      </Pressable>
      {on ? children : null}
    </View>
  );
}

/* ------------------------------------------------------------- мелочи */

/** Метка состояния рекомендации: для клиента — свой ответ, для
    специалиста — что он с ней решил. Слова те же, что в вебе. */
function RecMark({ status, clientStatus, spec }: {
  status: string; clientStatus: string; spec: boolean;
}) {
  const { p } = useApp();
  const text = spec
    ? (status === 'done' ? 'Выполнена' : status === 'cancelled' ? 'Отменена' : 'Актуальна')
    : (clientStatus === 'done' ? 'Выполнено'
      : clientStatus === 'in_progress' ? 'Выполняю' : 'Новая');
  const done = spec ? status === 'done' : clientStatus === 'done';
  const off = spec ? status === 'cancelled' : false;
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
      backgroundColor: done ? p.primarySoft : p.inset }}>
      <Text style={{ fontSize: 11, fontWeight: '600',
        color: done ? p.accent : off ? p.text3 : p.text2 }}>
        {text}
      </Text>
    </View>
  );
}

/** Невысокая кнопка под рекомендацией; выбранная подсвечена. */
function RecBtn({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  const { p } = useApp();
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
        backgroundColor: on ? p.primarySoft : p.inset,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: on ? p.accent : p.text2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

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

/** Переключатель доступа роли к документу — та же строка, что в вебе. */
function Share_({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  const { p } = useApp();
  return (
    <Pressable onPress={() => { haptic.select(); onToggle(); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: S.sm,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{
        width: 22, height: 22, borderRadius: 7,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: on ? p.primary : 'transparent',
        borderWidth: on ? 0 : 1.5, borderColor: p.btnLine,
      }}>
        {on ? <Icon name="check" size={13} color={p.onPrimary} width={2.6} /> : null}
      </View>
      <Text style={{ ...FONT.callout, color: p.text }}>{label}</Text>
    </Pressable>
  );
}

/** Дата в виде, который принимает сервер. */
function ymd(d: Date) {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/**
 * Выгрузка профиля и сводка перед консультацией.
 *
 * В вебе обе собирают печатную страницу и зовут `window.print()`
 * (`clHealthExport` и `clHealthConsult`). На телефоне печатать нечего —
 * отдаём тот же текст системному «Поделиться»: оттуда он уходит в
 * заметки, почту или на печать, если принтер есть.
 */
function ShareOut({ d, name }: { d: Health; name: string }) {
  const { p } = useApp();
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState('');
  const [picked, setPicked] = useState<number[]>([]);

  const stamp = 'Документ сформирован в EQUA. Он хранит внесённые данные и не является '
    + 'медицинским заключением или заменой консультации врача.';

  const block = (title: string, rows: string[]) =>
    rows.length ? `\n${title}\n${rows.map(x => `• ${x}`).join('\n')}\n` : '';

  async function exportAll() {
    haptic.tap();
    const text = `Профиль здоровья\n${name} · ${new Date().toLocaleDateString('ru-RU')}\n`
      + block('Аллергии и ограничения', (d.allergies ?? []).map(x =>
          [x.title, ALLERGY_KINDS[x.kind] ?? x.kind, x.note].filter(Boolean).join(' — ')))
      + block('Препараты и БАДы', (d.meds ?? []).map(x =>
          [x.title, MED_KINDS[x.kind] ?? x.kind, x.dosage, x.schedule,
            x.ended_on ? `курс завершён ${day(x.ended_on)}` : 'принимает сейчас']
            .filter(Boolean).join(' — ')))
      + block('Документы', (d.labs ?? []).map(x =>
          [x.title, HEALTH_DOC_KINDS[x.doc_type ?? ''] ?? 'Документ',
            day(x.taken_on) || day(x.created_at)].filter(Boolean).join(' — ')))
      + block('Рекомендации', (d.recommendations ?? []).map(x =>
          `${x.status === 'done' ? 'Выполнено' : x.status === 'cancelled' ? 'Отменено' : 'Актуально'}: ${x.body}`))
      + `\n${stamp}`;
    try { await Share.share({ message: text }); } catch { /* закрыли лист — это не ошибка */ }
  }

  async function consult() {
    haptic.tap();
    const docs = (d.labs ?? []).filter(x => picked.includes(x.id));
    const meds = (d.meds ?? []).filter(x => !x.ended_on);
    const recs = (d.recommendations ?? []).filter(x => x.status !== 'done' && x.status !== 'cancelled');
    const text = `Подготовка к консультации\n${name} · ${new Date().toLocaleDateString('ru-RU')}\n`
      + block('Активные курсы', meds.map(x =>
          [x.title, x.dosage, x.schedule].filter(Boolean).join(', ')))
      + block('Актуальные рекомендации', recs.map(x => x.title || x.body))
      + block('Выбранные документы', docs.map(x =>
          `${x.title} — ${day(x.taken_on) || day(x.created_at)}`))
      + (questions.trim() ? `\nВопросы\n${questions.trim()}\n` : '')
      + `\n${stamp}`;
    try { await Share.share({ message: text }); } catch { /* закрыли лист */ }
  }

  return (
    <Card style={{ marginTop: S.md, gap: S.sm }}>
      <Text style={{ ...FONT.h3, color: p.text }}>Собрать для врача</Text>
      <Muted>
        Ничего никуда не отправляется само: текст уходит туда, куда вы его отправите.
      </Muted>
      <SysButton label="Выгрузить профиль" height={44} onPress={exportAll} />
      <SysButton label={open ? 'Свернуть сводку' : 'Сводка перед консультацией'} height={44}
        onPress={() => { haptic.tap(); setOpen(v => !v); }} />

      {open ? (
        <View style={{ gap: S.sm }}>
          <Muted>Приложить к списку</Muted>
          {(d.labs ?? []).length === 0 ? <Muted>Документов пока нет.</Muted> : null}
          {(d.labs ?? []).slice(0, 12).map(x => (
            <Share_
              key={x.id}
              label={`${x.title} · ${day(x.taken_on) || day(x.created_at)}`}
              on={picked.includes(x.id)}
              onToggle={() => setPicked(v =>
                v.includes(x.id) ? v.filter(i => i !== x.id) : [...v, x.id])} />
          ))}
          <TextInput value={questions} onChangeText={setQuestions} multiline
            placeholder="Что хотите обсудить" placeholderTextColor={p.text3}
            style={{
              backgroundColor: p.inset, color: p.text, borderRadius: R.md,
              paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
              minHeight: 96, textAlignVertical: 'top',
            }} />
          <SysButton label="Поделиться сводкой" variant="prominent" height={44} onPress={consult} />
        </View>
      ) : null}
    </Card>
  );
}

/** Правка карточки документа — поля те же, что в форме загрузки. */
function LabEdit({ l, onSave }: { l: Lab; onSave: (patch: Record<string, unknown>) => void }) {
  const { p } = useApp();
  const [kind, setKind] = useState(l.doc_type ?? 'analysis');
  const [title, setTitle] = useState(l.title);
  const [taken, setTaken] = useState(() =>
    l.taken_on ? new Date(l.taken_on + 'T00:00:00') : new Date());
  const [lab, setLab] = useState(l.lab_name ?? '');
  const [note, setNote] = useState(l.note ?? '');
  const [toNut, setToNut] = useState(!!l.share_nutritionist);
  const [toEnd, setToEnd] = useState(!!l.share_endocrinologist);
  const field = {
    backgroundColor: p.inset, color: p.text, borderRadius: R.md,
    paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
  } as const;

  return (
    <View style={{ marginTop: S.sm, gap: S.sm }}>
      <Pills items={Object.entries(HEALTH_DOC_KINDS) as [string, string][]}
        value={kind} onChange={setKind} />
      <TextInput value={title} onChangeText={setTitle} style={field}
        placeholder="Название" placeholderTextColor={p.text3} />
      <Muted>Дата исследования</Muted>
      <SysDate value={taken} onChange={setTaken} max={new Date()} />
      <TextInput value={lab} onChangeText={setLab} style={field}
        placeholder="Лаборатория" placeholderTextColor={p.text3} />
      <TextInput value={note} onChangeText={setNote} multiline
        placeholder="Комментарий" placeholderTextColor={p.text3}
        style={{ ...field, minHeight: 64, textAlignVertical: 'top' }} />
      <Muted>Кому открыт документ</Muted>
      <Share_ label="Нутрициологу" on={toNut} onToggle={() => setToNut(v => !v)} />
      <Share_ label="Эндокринологу" on={toEnd} onToggle={() => setToEnd(v => !v)} />
      <Muted>EQUA AI не получает файл и его содержание.</Muted>
      <SysButton label="Сохранить" variant="prominent" height={44}
        onPress={() => onSave({
          doc_type: kind, title: title.trim(), taken_on: ymd(taken),
          lab_name: lab.trim(), note: note.trim(),
          share_nutritionist: toNut, share_endocrinologist: toEnd,
        })} />
    </View>
  );
}

/** Комментарий специалиста к документу клиента. */
function LabComment({ l, onSave }: { l: Lab; onSave: (text: string) => void }) {
  const { p } = useApp();
  const [text, setText] = useState(l.specialist_comment ?? '');
  return (
    <View style={{ marginTop: S.sm, gap: S.sm }}>
      <TextInput value={text} onChangeText={setText} multiline
        placeholder="Что важно учесть" placeholderTextColor={p.text3}
        style={{
          backgroundColor: p.inset, color: p.text, borderRadius: R.md,
          paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
          minHeight: 96, textAlignVertical: 'top',
        }} />
      <SysButton label="Отправить клиенту" variant="prominent" height={44}
        disabled={!text.trim()} onPress={() => onSave(text.trim())} />
    </View>
  );
}
