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
  ALLERGY_KINDS, MED_KINDS, REC_KINDS,
} from '../api';
import { openPrivateFile, fetchPrivateFile, looksLikeImage } from '../openPrivateFile';
import { ImageViewer } from '../ui/ImageViewer';
import { uploadForm } from '../upload';
import { pickPhoto } from '../photo';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Muted, Pills } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysConfirm } from '../ui/system';
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
            <Overview d={d} updated={updated} spec={spec}
              onGo={(t: Tab, k?: string) => { setTab(t); if (k) setFocus(k); }} />
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
            <Labs list={d.labs} edit={edit} postTo={write.labs}
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
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim()) { haptic.error(); onError('Что именно нельзя?'); return; }
    setBusy(true);
    try {
      await api(postTo, {
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

function Labs({ list, edit, postTo, onAdd, onRemove, onError }: {
  list: Lab[]; edit: boolean; postTo: string;
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
      await uploadForm(postTo, file, 'file', {
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
  const [viewer, setViewer] = useState<{ uri: string; title: string } | null>(null);

  async function open(l: Lab) {
    if (!l.file_url) return;
    haptic.tap();
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
        <Animated.View key={r.id} entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(200)}>
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
