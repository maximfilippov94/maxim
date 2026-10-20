import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../store';
import { api, SpecDoc, Verification } from '../../api';
import { openPrivateFile } from '../../openPrivateFile';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Muted, Label } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { SysButton } from '../../ui/system';
import { haptic } from '../../haptics';
import { Loading, Fail } from '../Shopping';

type Contract = {
  id: number; contract_version: string; signed_at: string;
  signature_method?: string | null; commission_own: number; commission_catalog: number;
  file_name: string; file_url?: string; file_size?: number;
};
type Overview = {
  contract_ready: boolean; legacy_agreement_at?: string | null;
  contracts: Contract[]; rates: { own: number; catalog: number; own_is_individual: boolean; catalog_is_individual: boolean };
  terms: { catalog_period_days: number; upfront_share: number; accept_days: number; abandon_days: number };
};

const percent = (n?: number) => `${(Number(n || 0) * 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;
const date = (s?: string | null) => s ? new Date(String(s).replace(' ', 'T')).toLocaleDateString('ru-RU') : '—';

export default function Documents() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [o, v] = await Promise.all([
        api<Overview>('/specialist/documents/overview', { noCache: true }),
        api<Verification>('/specialist/verification', { noCache: true }),
      ]);
      setOverview(o); setVerification(v); setErr(null);
    } catch (e: any) { setErr(e?.message ?? 'Не удалось загрузить документы'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (doc: Contract | SpecDoc) => {
    if (!doc.file_url) return;
    haptic.tap();
    try { await openPrivateFile(doc.file_url, 'Документ EQUA'); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось открыть документ'); }
  };
  if (err && !overview) return <Fail title="Документы" text={err} />;
  if (!overview || !verification) return <Loading title="Документы" />;
  const verifyStatus = verification.status === 'verified' ? 'Проверка пройдена'
    : verification.status === 'pending' ? 'Документы на проверке'
    : verification.status === 'rejected' ? 'Нужно исправить документы' : 'Не пройдена';

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Документы" back />
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + 34, gap: S.md }}>
        {err ? <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text> : null}
        <Muted>Агентский договор, документы проверки и их статусы. Комиссии подтягиваются из настроек EQUA.</Muted>
        <Card style={{ gap: S.md }}>
          <Label>АГЕНТСКИЙ ДОГОВОР</Label>
          <Text style={{ ...FONT.h2, color: p.text }}>{overview.contract_ready ? 'Договор доступен' : 'Подписание пока недоступно'}</Text>
          <Muted>Перед подписанием в договор попадут комиссии, действующие для вашего профиля. Исторические экземпляры сохраняются отдельно.</Muted>
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <Rate label="Свои клиенты" value={percent(overview.rates?.own)} />
            <Rate label="Из каталога" value={percent(overview.rates?.catalog)} />
          </View>
          <Muted>Ставки — из Control Center с учётом индивидуальных условий. Их изменение не меняет ранее подписанный экземпляр.</Muted>
          {overview.legacy_agreement_at ? <Muted>Старое подтверждение платёжных условий: {date(overview.legacy_agreement_at)}. Оно не считается подписанным экземпляром договора.</Muted> : null}
          {overview.contracts?.length ? <>
            <Text style={{ ...FONT.body, fontWeight: '700', color: p.text }}>Подписанные экземпляры</Text>
            {overview.contracts.map(c => (
              <Pressable key={c.id} onPress={() => { void open(c); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.sm }}>
                <Icon name="clip" size={18} color={p.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...FONT.body, color: p.text }}>{c.contract_version}</Text>
                  <Muted>Подписан {date(c.signed_at)} · комиссии {c.commission_own}% / {c.commission_catalog}%</Muted>
                </View>
                <Icon name="chevr" size={15} color={p.text3} />
              </Pressable>
            ))}
          </> : <Muted>Подписанных экземпляров пока нет.</Muted>}
          {!overview.contract_ready ? <Text style={{ ...FONT.small, color: p.warn }}>
            Отправка одноразового кода и электронное подписание ещё не включены на сервере. Экран не считает договор подписанным без подтверждённого сервером процесса.
          </Text> : <SysButton label="Открыть договор" onPress={() => setErr('Маршрут подписания договора отсутствует в мобильной версии.')} />}
        </Card>
        <Card style={{ gap: S.md }}>
          <Label>ВЕРИФИКАЦИЯ СПЕЦИАЛИСТА</Label>
          <Text style={{ ...FONT.h2, color: p.text }}>{verifyStatus}</Text>
          <Muted>Паспорт и документы об образовании относятся к проверке личности и квалификации, а не к агентскому договору.</Muted>
          {verification.documents.slice(0, 4).map(doc => (
            <Pressable key={doc.id} onPress={() => { void open(doc); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Icon name="clip" size={17} color={p.text3} />
              <View style={{ flex: 1 }}><Text style={{ ...FONT.body, color: p.text }}>{doc.title}</Text>
                <Muted>{doc.status === 'approved' ? 'Проверен' : doc.status === 'rejected' ? 'Нужно заменить' : 'На проверке'}</Muted></View>
              {doc.file_url ? <Icon name="chevr" size={15} color={p.text3} /> : null}
            </Pressable>
          ))}
          <SysButton label="Управлять документами проверки" onPress={() => router.push('/sp-verification')} />
        </Card>
        <Card style={{ gap: S.sm }}>
          <Label>ДАННЫЕ И СОГЛАСИЯ</Label>
          <Muted>Подтверждения обработки персональных данных и агентский договор — разные документы. Данные о здоровье клиентов хранятся в их личных профилях и не входят в ваш пакет документов.</Muted>
        </Card>
      </ScrollView>
    </View>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  const { p } = useApp();
  return <View style={{ flex: 1, backgroundColor: p.inset, borderRadius: R.md, padding: S.md }}>
    <Muted>{label}</Muted><Text style={{ ...FONT.h2, color: p.text, marginTop: 2 }}>{value}</Text>
  </View>;
}
