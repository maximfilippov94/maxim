import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, PublicSpecialist, CatalogSpecialist } from '../api';
import { rub, plural, seenPhrase, svcUnit, specRate } from '../format';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { ImageViewer } from '../ui/ImageViewer';
import { haptic } from '../haptics';
import { Face, VerifiedMark, PROF } from '../ui/SpecCard';

const DOC_KINDS: Record<string, string> = {
  passport: 'Паспорт', diploma: 'Диплом', course: 'Курс',
  certificate: 'Сертификат', license: 'Лицензия',
};

/**
 * Профиль специалиста — то, что клиент читает, прежде чем выбрать.
 *
 * Порядок блоков повторяет порядок решения: кто это и в сети ли →
 * чем подтверждён → о себе → действие → как работает → услуги и цены →
 * образование и опыт → документы → отзывы. Кнопки стоят сразу под
 * рассказом о себе, а не в конце длинной страницы.
 */
export default function SpecProfile() {
  const { p, refreshMe } = useApp();
  const insets = useSafeAreaInsets();
  const { slug, id } = useLocalSearchParams<{ slug?: string; id?: string }>();
  const [s, setS] = useState<PublicSpecialist | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [eduOpen, setEduOpen] = useState(false);
  const [scan, setScan] = useState<string | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadContact, setLeadContact] = useState('');
  const [leadMsg, setLeadMsg] = useState('');
  const [leadSent, setLeadSent] = useState(false);

  const load = useCallback(async () => {
    try {
      if (slug) {
        const r = await api<{ specialist: PublicSpecialist }>(`/public/specialists/${slug}`);
        setS(r.specialist);
      } else {
        /* Без slug профиля нет — берём карточку из каталога: в ней есть
           всё, что показывает список, просто без документов и отзывов. */
        const c = await api<{ specialists: CatalogSpecialist[] }>('/catalog');
        setS((c.specialists ?? []).find(x => x.id === Number(id)) ?? null);
      }
    } catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить'); }
  }, [slug, id]);
  useEffect(() => { load(); }, [load]);

  const connect = useCallback(async () => {
    if (!s) return;
    setBusy(true); setErr(null);
    try {
      await api('/client/connect', { method: 'POST', body: { specialist_id: s.id } });
      haptic.success();
      await refreshMe();
      router.replace('/specialist');
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось подключиться'); }
    finally { setBusy(false); }
  }, [s, refreshMe]);

  /* Заявка — для тех, кто не готов выбирать сразу: специалист увидит
     контакт у себя в «Заявках» и напишет первым. Подключения при этом
     не происходит. */
  const sendLead = useCallback(async () => {
    if (!s) return;
    if (!leadName.trim() || !leadContact.trim()) { setErr('Укажите имя и контакт'); return; }
    setBusy(true); setErr(null);
    try {
      await api(`/catalog/${s.id}/lead`, { method: 'POST',
        body: { name: leadName, contact: leadContact, message: leadMsg } });
      haptic.success(); setLeadSent(true); setLeadOpen(false);
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось отправить'); }
    finally { setBusy(false); }
  }, [s, leadName, leadContact, leadMsg]);

  if (!s) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <NavBar title="Специалист" back />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {err ? <Muted>{err}</Muted> : <ActivityIndicator color={p.accent} />}
        </View>
      </View>
    );
  }

  const revs = s.reviews_count ?? 0;
  const exp = s.experience_years ?? 0;
  const here = s.joined_at
    ? Math.max(0, new Date().getFullYear() - Number(String(s.joined_at).slice(0, 4)))
    : null;
  const edu = String(s.education ?? '').split(/\r?\n|;/).map(x => x.trim()).filter(Boolean);
  const docs = s.documents ?? [];
  const tiles: [string, string, string][] = [
    s.identity_verified ? ['shield', 'Паспорт', 'проверен']
      : ['check', 'Документы', s.verified ? 'проверены' : 'нет'],
    ['star', specRate(s.rating), 'Рейтинг'],
    ['chat', String(revs), 'Отзывы'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Специалист" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32, gap: S.lg,
      }} showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.duration(240)}
          style={{ alignItems: 'center', gap: 6, paddingTop: S.md }}>
          <Face url={s.avatar_url} name={s.name} size={88} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.sm }}>
            <Text style={{ ...FONT.h2, color: p.text }}>{s.name}</Text>
            {s.verified ? <VerifiedMark compact /> : null}
          </View>
          <Muted>{seenPhrase(s.last_seen_at) || PROF[s.profession ?? 'nutritionist'] || 'Специалист'}</Muted>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: S.sm }}>
          {tiles.map(([ic, v, t], i) => (
            <Card key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: S.md, gap: 2 }}>
              <Icon name={ic as any} size={18} color={i === 0 ? p.accent : p.text2} />
              <Text style={{ ...FONT.h3, color: p.text }}>{v}</Text>
              <Text style={{ ...FONT.small, color: p.text3 }}>{t}</Text>
            </Card>
          ))}
        </View>

        {s.bio ? (
          <View style={{ gap: 4 }}>
            <Text style={{ ...FONT.body, color: p.text2, lineHeight: 21 }}
              numberOfLines={bioOpen ? undefined : 4}>{s.bio}</Text>
            <Pressable onPress={() => { haptic.tap(); setBioOpen(v => !v); }} hitSlop={8}>
              <Text style={{ ...FONT.small, fontWeight: '700', color: p.accent }}>
                {bioOpen ? 'Свернуть' : 'Ещё'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {err ? <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text> : null}

        <View style={{ flexDirection: 'row', gap: S.md }}>
          <View style={{ flex: 1 }}>
            <SysButton label="Выбрать" variant="prominent" disabled={busy} onPress={connect} />
          </View>
          <View style={{ flex: 1 }}>
            <SysButton label={leadSent ? 'Заявка отправлена' : 'Оставить заявку'}
              disabled={busy || leadSent}
              onPress={() => { haptic.tap(); setLeadOpen(v => !v); }} />
          </View>
        </View>

        {leadOpen ? (
          <Card style={{ gap: S.sm }}>
            <Label>Оставить контакт</Label>
            <Muted>Специалист получит заявку и свяжется с вами. Подключение при этом не происходит.</Muted>
            <Field value={leadName} onChange={setLeadName} placeholder="Как к вам обращаться" />
            <Field value={leadContact} onChange={setLeadContact} placeholder="Телефон или почта" />
            <Field value={leadMsg} onChange={setLeadMsg} multiline
              placeholder="Что хотите решить" />
            <SysButton label="Отправить заявку" variant="prominent" disabled={busy} onPress={sendLead} />
          </Card>
        ) : null}

        <Card style={{ flexDirection: 'row', gap: S.md, alignItems: 'flex-start' }}>
          <Icon name="device" size={18} color={p.text2} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...FONT.body, fontWeight: '700', color: p.text }}>Работает дистанционно</Text>
            <Muted style={{ marginTop: 2 }}>
              Меню, чат и созвоны — в приложении.
              {s.city ? ` Часовой пояс — ${s.city}.` : ' Часовой пояс уточните в переписке.'}
            </Muted>
          </View>
        </Card>

        {s.services?.length ? (
          <View style={{ gap: S.sm }}>
            <Text style={{ ...FONT.h3, color: p.text }}>Услуги и цены</Text>
            <Card style={{ padding: 0 }}>
              {s.services.map((v, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'flex-start', gap: S.md,
                  padding: S.lg,
                  borderTopWidth: i ? 1 : 0, borderTopColor: p.border,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...FONT.body, fontWeight: '700', color: p.text }}>{v.title}</Text>
                    {v.description ? <Muted style={{ marginTop: 3 }}>{v.description}</Muted> : null}
                    <Text style={{ ...FONT.small, color: p.text3, marginTop: 3 }}>{svcUnit(v)}</Text>
                  </View>
                  <Text style={{ fontSize: 19, fontWeight: '800', color: p.text }}>{rub(v.price_kop)}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {edu.length ? (
          <View style={{ gap: S.sm }}>
            <Text style={{ ...FONT.h3, color: p.text }}>Образование</Text>
            <Card style={{ gap: 2 }}>
              {(eduOpen ? edu : edu.slice(0, 1)).map((x, i) => (
                <Row key={i} icon="grad" text={x} />
              ))}
              {edu.length > 1 ? (
                <Pressable onPress={() => { haptic.tap(); setEduOpen(v => !v); }} hitSlop={8}
                  style={{ marginTop: 4 }}>
                  <Text style={{ ...FONT.small, fontWeight: '700', color: p.accent }}>
                    {eduOpen ? 'Свернуть'
                      : `Ещё ${edu.length - 1} ${plural(edu.length - 1, ['запись', 'записи', 'записей'])} об образовании`}
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          </View>
        ) : null}

        {exp ? (
          <View style={{ gap: S.sm }}>
            <Text style={{ ...FONT.h3, color: p.text }}>
              {exp} {plural(exp, ['год', 'года', 'лет'])} опыта
            </Text>
            <Card style={{ gap: 2 }}>
              {here !== null ? (
                <Row icon="spark" text={here
                  ? `Из них ${here} ${plural(here, ['год', 'года', 'лет'])} на EQUA`
                  : 'Из них меньше года на EQUA'} />
              ) : null}
              {s.specializations ? <Row icon="target" text={s.specializations} /> : null}
              {s.active_clients ? (
                <Row icon="user" text={`Сейчас ведёт ${s.active_clients} ${plural(s.active_clients, ['клиента', 'клиентов', 'клиентов'])}`} />
              ) : null}
            </Card>
          </View>
        ) : null}

        {docs.length ? (
          <View style={{ gap: S.sm }}>
            <Text style={{ ...FONT.h3, color: p.text }}>Документы</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {docs.map(d => (
                <Card key={d.id} style={{ width: 116, padding: S.sm, gap: 6 }}>
                  {d.scan_url ? (
                    <Pressable onPress={() => { haptic.tap(); setScan(d.scan_url!); }}>
                      <Thumb url={d.scan_url} />
                    </Pressable>
                  ) : (
                    <View style={{
                      width: '100%', aspectRatio: 3 / 4, borderRadius: R.sm,
                      backgroundColor: p.inset, alignItems: 'center', justifyContent: 'center',
                      padding: S.sm, gap: 6,
                    }}>
                      <Icon name="grad" size={20} color={p.text3} />
                      <Text style={{ ...FONT.small, fontWeight: '700', color: p.text2, textAlign: 'center' }}
                        numberOfLines={3}>{d.title}</Text>
                    </View>
                  )}
                  <Text style={{ ...FONT.small, color: p.text3 }} numberOfLines={1}>
                    {[DOC_KINDS[d.kind] ?? 'Документ',
                      d.issued_on ? String(d.issued_on).slice(0, 4) : ''].filter(Boolean).join(' · ')}
                  </Text>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        {revs || (s.reviews ?? []).length ? (
          <View style={{ gap: S.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={{ ...FONT.h3, color: p.text }}>Рейтинг {specRate(s.rating)}</Text>
              <Muted>{revs} {plural(revs, ['отзыв', 'отзыва', 'отзывов'])}</Muted>
            </View>
            {(s.reviews ?? []).length ? (
              <Card style={{ padding: 0 }}>
                {(s.reviews ?? []).slice(0, 10).map((r, i) => (
                  <View key={r.id} style={{
                    padding: S.lg, borderTopWidth: i ? 1 : 0, borderTopColor: p.border,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: S.md }}>
                      <Text style={{ ...FONT.body, fontWeight: '700', color: p.text }}>{r.author}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="star" size={13} color={p.premium} />
                        <Text style={{ ...FONT.small, fontWeight: '700', color: p.text2 }}>
                          {specRate(r.rating)}
                        </Text>
                      </View>
                    </View>
                    {r.body ? <Muted style={{ marginTop: 5 }}>{r.body}</Muted> : null}
                  </View>
                ))}
              </Card>
            ) : (
              <Muted>Отзывы появятся, когда клиенты завершат работу.</Muted>
            )}
          </View>
        ) : null}
      </ScrollView>

      <ImageViewer uri={scan} title="Документ" onClose={() => setScan(null)} />
    </View>
  );
}

function Row({ icon, text }: { icon: string; text: string }) {
  const { p } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.md, paddingVertical: 5 }}>
      <Icon name={icon as any} size={17} color={p.text3} />
      <Text style={{ ...FONT.body, color: p.text2, flex: 1, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

function Field({ value, onChange, placeholder, multiline }: {
  value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean;
}) {
  const { p } = useApp();
  return (
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder}
      placeholderTextColor={p.text3} multiline={multiline}
      style={{
        backgroundColor: p.inset, color: p.text, borderRadius: R.md,
        paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 14,
        minHeight: multiline ? 76 : undefined, textAlignVertical: multiline ? 'top' : 'center',
      }} />
  );
}

function Thumb({ url }: { url: string }) {
  const { p } = useApp();
  return (
    <Image source={{ uri: url }}
      style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: R.sm, backgroundColor: p.inset }}
      contentFit="cover" transition={160} cachePolicy="memory-disk" />
  );
}
