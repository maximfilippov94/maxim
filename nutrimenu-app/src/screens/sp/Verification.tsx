/**
 * Верификация специалиста.
 *
 * Клиент не может сам проверить диплом — он видит только текст, который
 * специалист написал о себе. Поэтому проверку берёт на себя сервис:
 * специалист прикладывает документы, команда EQUA сверяет их и ставит
 * отметку. Автоматического подтверждения нет: галочка «Проверен» стоит
 * ровно столько, сколько стоит проверка за ней.
 *
 * Пока проверка не пройдена, карточка специалиста в каталоге не
 * показывается — по коду приглашения работать при этом можно: там
 * клиент и так знает, к кому идёт.
 *
 * Сканы дипломов — личные документы, поэтому обращаемся с ними как с
 * анализами клиента: файл отдаётся только по маршруту с проверкой прав,
 * а в каталог уходит одно название, без файла.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store';
import { api, Verification, SpecDoc, DocKind, DOC_KINDS } from '../../api';
import { openPrivateFile } from '../../openPrivateFile';
import { uploadForm } from '../../upload';
import { pickDocument } from '../../photo';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Muted, Pills } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { SysButton, SysConfirm } from '../../ui/system';
import { haptic } from '../../haptics';
import { Loading, Fail } from '../Shopping';

const KIND_TABS: [DocKind, string][] = [
  ['diploma', 'Диплом'], ['course', 'Курс'],
  ['certificate', 'Сертификат'], ['license', 'Лицензия'],
];

/** Что означает каждый статус — словами, а не цветом. */
function stateOf(s: Verification['status']) {
  switch (s) {
    case 'verified': return {
      title: 'Проверен EQUA',
      note: 'Карточка показывается в каталоге, рядом с именем стоит отметка о проверке.',
    };
    case 'pending': return {
      title: 'На проверке',
      note: 'Документы у нас. Обычно проверка занимает пару рабочих дней — '
        + 'в каталоге карточка появится после неё.',
    };
    case 'rejected': return {
      title: 'Отказано',
      note: 'Карточки в каталоге нет. Исправьте замечание и отправьте документы заново.',
    };
    default: return {
      title: 'Не подтверждён',
      note: 'Пока проверка не пройдена, ваша карточка не показывается в каталоге. '
        + 'Приложите диплом или сертификаты о курсах — мы сверим их.',
    };
  }
}

function day(v?: string | null) {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(+d)) return String(v);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function VerificationScreen() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();

  const [d, setD] = useState<Verification | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<DocKind>('diploma');
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [year, setYear] = useState('');

  const load = useCallback(async () => {
    try { setD(await api<Verification>('/specialist/verification')); setErr(null); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось открыть'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* Название спрашиваем до выбора файла: «doc_2019.pdf» через месяц не
     отличить от такого же соседнего, а проверяющему нужно понимать,
     что он вообще смотрит. */
  const add = useCallback(async () => {
    if (!title.trim()) { haptic.error(); setErr('Как называется документ?'); return; }
    setBusy(true);
    try {
      const file = await pickDocument();
      if (!file) { setBusy(false); return; }
      await uploadForm('/specialist/verification/documents', file, 'file', {
        kind, title: title.trim(), issuer: issuer.trim(), issued_on: year.trim(),
      });
      setTitle(''); setIssuer(''); setYear('');
      haptic.success(); setErr(null); load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не загрузилось'); }
    finally { setBusy(false); }
  }, [kind, title, issuer, year, load]);

  const remove = useCallback(async (id: number) => {
    setD(cur => cur && { ...cur, documents: cur.documents.filter(x => x.id !== id) });
    try { await api(`/specialist/verification/documents/${id}`, { method: 'DELETE' }); haptic.success(); }
    catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалилось'); }
    finally { load(); }
  }, [load]);

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      await api('/specialist/verification/submit', { method: 'POST' });
      haptic.success(); setErr(null); load();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не отправилось'); }
    finally { setBusy(false); }
  }, [load]);

  const open = useCallback(async (doc: SpecDoc) => {
    if (!doc.file_url) return;
    haptic.tap();
    try { await openPrivateFile(doc.file_url, doc.title); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось открыть файл'); }
  }, []);

  if (err && !d) return <Fail title="Верификация" text={err} />;
  if (!d) return <Loading title="Верификация" />;

  const st = stateOf(d.status);
  /* Отправлять нечего, если всё приложенное уже отклонено. */
  const ready = d.documents.some(x => x.status !== 'rejected');

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Верификация" back />
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView contentContainerStyle={{
          paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
        }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Animated.View entering={FadeInDown.duration(220)}>
            <Card style={{ marginTop: S.md, gap: S.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: d.status === 'verified' ? p.primarySoft : p.inset,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="shield" size={21}
                    color={d.status === 'verified' ? p.accent : p.text3} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...FONT.h3, color: p.text }}>{st.title}</Text>
                  {d.status === 'verified' && d.verified_at ? (
                    <Muted style={{ marginTop: 2 }}>с {day(d.verified_at)}</Muted>
                  ) : null}
                </View>
              </View>
              <Muted style={{ lineHeight: 20 }}>{st.note}</Muted>
              {d.status === 'rejected' && d.note ? (
                <Text style={{ ...FONT.small, color: p.danger, lineHeight: 20 }}>{d.note}</Text>
              ) : null}
            </Card>
          </Animated.View>

          {err ? (
            <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text>
          ) : null}

          <Text style={{ ...FONT.h3, color: p.text, marginTop: S.xl, marginBottom: S.sm }}>
            Документы
          </Text>

          {d.documents.length === 0 ? (
            <Card style={{ paddingVertical: 18 }}>
              <Muted style={{ lineHeight: 20 }}>
                Пока ничего не приложено. Подойдёт диплом, удостоверение о повышении
                квалификации или сертификат курса.
              </Muted>
            </Card>
          ) : d.documents.map((doc, i) => (
            <Animated.View key={doc.id}
              entering={FadeInDown.delay(Math.min(i, 8) * 25).duration(200)}>
              <DocRow doc={doc} onOpen={() => open(doc)} onRemove={() => remove(doc.id)} />
            </Animated.View>
          ))}

          <Card style={{ marginTop: S.md, gap: S.sm }}>
            <Pills items={KIND_TABS} value={kind} onChange={setKind} scroll
              style={{ marginBottom: 2 }} />
            <Field value={title} onChange={setTitle}
              placeholder="Нутрициология, РНИМУ им. Пирогова" />
            <Field value={issuer} onChange={setIssuer} placeholder="Кто выдал" />
            <Field value={year} onChange={setYear} placeholder="Год выдачи"
              keyboardType="number-pad" maxLength={10} />
            <Pressable onPress={add} disabled={busy}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 7, height: 44, borderRadius: R.pill,
                backgroundColor: p.primary, opacity: pressed || busy ? 0.6 : 1,
              })}>
              {busy ? <ActivityIndicator color={p.onPrimary} size="small" />
                : <Icon name="clip" size={16} color={p.onPrimary} width={1.9} />}
              <Text style={{ ...FONT.small, fontWeight: '600', color: p.onPrimary }}>
                Приложить документ
              </Text>
            </Pressable>
            <Muted>PDF или снимок, до 15 МБ.</Muted>
          </Card>

          {d.status !== 'pending' ? (
            <View style={{ marginTop: S.lg }}>
              <SysButton
                label={d.status === 'verified' ? 'Отправить новые документы' : 'Отправить на проверку'}
                icon="checkmark.shield" variant="prominent"
                disabled={!ready || busy} onPress={submit} />
            </View>
          ) : null}

          <Muted style={{ marginTop: S.lg, lineHeight: 19 }}>
            Сканы видит только команда EQUA. В каталоге показываются названия
            документов, но не сами файлы.
          </Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ------------------------------------------------------------------ */

function DocRow({ doc, onOpen, onRemove }: {
  doc: SpecDoc; onOpen: () => void; onRemove: () => void;
}) {
  const { p } = useApp();
  const mark = doc.status === 'approved'
    ? { text: 'Принят', color: p.accent }
    : doc.status === 'rejected'
      ? { text: 'Отклонён', color: p.danger }
      : { text: 'На проверке', color: p.text3 };

  return (
    <Pressable onPress={onOpen} disabled={!doc.file_url}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Card style={{ marginBottom: S.sm, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{
            width: 42, height: 42, borderRadius: R.md, backgroundColor: p.inset,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="grad" size={18} color={p.text3} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={2}>{doc.title}</Text>
            <Muted style={{ marginTop: 2 }} numberOfLines={1}>
              {[DOC_KINDS[doc.kind] ?? 'Документ', doc.issuer, doc.issued_on]
                .filter(Boolean).join(' · ')}
            </Muted>
          </View>
          <SysConfirm label="Убрать" tint={p.text3}
            title={`Убрать «${doc.title}»?`} confirmLabel="Убрать" onConfirm={onRemove} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <Text style={{ ...FONT.small, fontWeight: '600', color: mark.color }}>
            {mark.text}
          </Text>
          {doc.file_url ? <Muted>· нажмите, чтобы открыть</Muted> : null}
        </View>
        {doc.status === 'rejected' && doc.review_note ? (
          <Text style={{ ...FONT.small, color: p.danger, lineHeight: 19 }}>
            {doc.review_note}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

function Field({ value, onChange, placeholder, keyboardType, maxLength }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  keyboardType?: 'number-pad'; maxLength?: number;
}) {
  const { p } = useApp();
  return (
    <TextInput value={value} onChangeText={onChange}
      placeholder={placeholder} placeholderTextColor={p.text3}
      keyboardType={keyboardType} maxLength={maxLength}
      style={{
        backgroundColor: p.inset, color: p.text, borderRadius: R.md,
        paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
      }} />
  );
}
