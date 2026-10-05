/**
 * Код приглашения специалиста.
 *
 * Второй способ привести клиента: не заводить его руками, а дать код —
 * человек регистрируется сам и сразу оказывается у вас. В приложении
 * этого не было вовсе: код жил только в браузере, и специалист,
 * работающий с телефона, не мог никого позвать.
 *
 * Кроме копирования есть системное «Поделиться»: код почти всегда
 * отправляют в мессенджер, и переход в него через буфер обмена — два
 * лишних действия там, где у телефона есть своё.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { api } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Card, Label, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton } from '../src/ui/system';
import { haptic } from '../src/haptics';

interface Invite { code?: string; url?: string }

export default function SpInvite() {
  const { p } = useApp();
  const [d, setD] = useState<Invite | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);

  /* Код создаётся на сервере при первом запросе — отдельной кнопки
     «создать» не нужно, человек просто открывает экран и видит свой. */
  const load = useCallback(() => {
    api<Invite>('/specialist/invite-code')
      .then(r => { setD(r); setErr(null); })
      .catch(e => setErr(e?.message ?? 'Код не получен'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const copy = useCallback(async (what: 'code' | 'url', value: string) => {
    await Clipboard.setStringAsync(value);
    haptic.success(); setCopied(what);
  }, []);

  const share = useCallback(async () => {
    if (!d?.url) return;
    haptic.tap();
    try {
      await Share.share({
        message: `Присоединяйтесь ко мне в EQUA: ${d.url}\nКод: ${d.code ?? ''}`,
        url: d.url,
      });
    } catch { /* человек закрыл окно — это не ошибка */ }
  }, [d]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.surface }}
      contentContainerStyle={{ padding: S.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>
        <Text style={{ ...FONT.h2, color: p.text, flex: 1 }}>Код для клиентов</Text>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>

      <Muted style={{ marginBottom: S.lg, lineHeight: 19 }}>
        Дайте клиенту код или ссылку — он подключится к вам сразу после
        регистрации, заводить его вручную не нужно.
      </Muted>

      {err ? <Text style={{ ...FONT.small, color: p.danger }}>{err}</Text> : null}
      {!d && !err ? <ActivityIndicator color={p.primary} style={{ marginTop: 30 }} /> : null}

      {d?.code ? (
        <>
          {/* Код набирают с чужого экрана голосом или на слух, поэтому он
              крупный, разрядкой и моноширинный: O и 0 иначе не отличить. */}
          <Pressable onPress={() => copy('code', d.code!)}>
            {({ pressed }) => (
              <View style={{
                alignItems: 'center', paddingVertical: S.xl, borderRadius: R.lg,
                borderWidth: 1, borderColor: p.border,
                backgroundColor: pressed ? p.ov1 : p.inset,
              }}>
                <Text style={{
                  fontSize: 34, fontWeight: '700', letterSpacing: 6,
                  color: p.text, fontVariant: ['tabular-nums'],
                }}>{d.code}</Text>
                <Muted style={{ marginTop: 6 }}>
                  {copied === 'code' ? 'код скопирован' : 'нажмите, чтобы скопировать код'}
                </Muted>
              </View>
            )}
          </Pressable>

          {d.url ? (
            <Card style={{ marginTop: S.lg }}>
              <Label>Ссылка-приглашение</Label>
              <Text selectable style={{ ...FONT.body, color: p.text, marginTop: S.sm, lineHeight: 19 }}>
                {d.url}
              </Text>
            </Card>
          ) : null}

          <View style={{ gap: S.md, marginTop: S.lg }}>
            <SysButton label="Поделиться ссылкой" icon="square.and.arrow.up"
              variant="prominent" onPress={share} />
            <SysButton label={copied === 'url' ? 'Скопировано' : 'Скопировать ссылку'}
              icon={copied === 'url' ? 'checkmark' : 'doc.on.doc'}
              onPress={() => d.url && copy('url', d.url)} />
          </View>

          <Muted style={{ marginTop: S.lg, lineHeight: 18 }}>
            Код постоянный: его можно давать сколько угодно раз, он не
            перестаёт работать после первого клиента.
          </Muted>
        </>
      ) : null}
    </ScrollView>
  );
}
