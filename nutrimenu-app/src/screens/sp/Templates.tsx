import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../../store';
import { api, SpTemplate, SpClient } from '../../api';
import { S, R, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { Card, Muted } from '../../ui/base';
import { Icon } from '../../ui/Icon';
import { Face } from '../../ui/Face';
import { SysConfirm, Empty } from '../../ui/system';
import { plural } from '../../format';
import { haptic } from '../../haptics';
import { Loading } from '../Shopping';

/**
 * Шаблоны меню: готовый рацион, который переносится новому клиенту одним
 * нажатием. Собирается он из уже составленного меню — в карточке клиента.
 */
export default function SpTemplates() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<SpTemplate[] | null>(null);
  const [clients, setClients] = useState<SpClient[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ templates: SpTemplate[] }>('/specialist/templates');
      setList(r.templates ?? []);
    } catch { setList([]); }
    try {
      const c = await api<{ clients: SpClient[] }>('/specialist/clients');
      setClients(c.clients ?? []);
    } catch { /* список нужен только для применения */ }
  }, []);
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const apply = useCallback(async (tid: number, cid: number, name: string) => {
    setBusy(true); setMsg(null);
    try {
      await api(`/specialist/templates/${tid}/apply`, {
        method: 'POST', body: { client_id: cid },
      });
      haptic.success();
      setPick(null);
      setMsg(`Меню создано для ${name} — оно в черновиках, опубликуйте в карточке.`);
    } catch (e: any) { haptic.error(); setMsg(e?.message ?? 'Не удалось применить'); }
    finally { setBusy(false); }
  }, []);

  const remove = useCallback(async (tid: number) => {
    setList(l => l && l.filter(t => t.id !== tid));
    try { await api(`/specialist/templates/${tid}`, { method: 'DELETE' }); }
    catch { load(); }
  }, [load]);

  if (!list) return <Loading title="Шаблоны" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Шаблоны меню" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 32,
      }} showsVerticalScrollIndicator={false}>

        {msg ? (
          <Card style={{ marginTop: S.md }}>
            <Text style={{ ...FONT.body, color: p.text }}>{msg}</Text>
          </Card>
        ) : null}

        {list.length === 0 ? (
          <Empty icon="doc.on.doc" title="Шаблонов пока нет"
            note="Соберите меню клиенту и сохраните его как шаблон — дальше он переносится одним нажатием." />
        ) : list.map((t, i) => (
          <Animated.View key={t.id} entering={FadeInDown.delay(Math.min(i, 8) * 30).duration(220)}>
            <Card style={{ marginTop: S.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...FONT.h3, color: p.text }} numberOfLines={1}>{t.name}</Text>
                  <Muted style={{ marginTop: 2 }}>
                    {[t.days_count ? `${t.days_count} ${plural(t.days_count, ['день', 'дня', 'дней'])}` : null,
                      t.items_count ? `${t.items_count} ${plural(t.items_count, ['блюдо', 'блюда', 'блюд'])}` : null,
                    ].filter(Boolean).join(' · ') || 'пустой'}
                  </Muted>
                </View>
                <SysConfirm
                  label="Удалить" tint={p.danger}
                  title={`Удалить шаблон «${t.name}»?`}
                  message="Меню, созданные из него, останутся на месте."
                  confirmLabel="Удалить шаблон"
                  onConfirm={() => remove(t.id)}
                />
              </View>

              <Pressable
                onPress={() => { haptic.tap(); setPick(pick === t.id ? null : t.id); setMsg(null); }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  marginTop: S.md, opacity: pressed ? 0.5 : 1,
                })}>
                <Icon name="plus" size={14} color={p.primary} width={2.4} />
                <Text style={{ ...FONT.small, color: p.primary }}>
                  {pick === t.id ? 'Скрыть список' : 'Применить к клиенту'}
                </Text>
              </Pressable>

              {pick === t.id ? (
                <View style={{ marginTop: S.sm }}>
                  {clients.length === 0 ? (
                    <Muted>Клиентов пока нет.</Muted>
                  ) : clients.map((c, k) => (
                    <Pressable key={c.id} disabled={busy}
                      onPress={() => apply(t.id, c.id, c.name)}>
                      {({ pressed }) => (
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: S.md,
                          paddingVertical: 10,
                          borderTopWidth: k ? 1 : 0, borderTopColor: p.borderSoft,
                          opacity: pressed ? 0.6 : 1,
                        }}>
                          <Face url={c.avatar_url} name={c.name} size={30} />
                          <Text style={{ flex: 1, fontSize: 15, color: p.text }} numberOfLines={1}>
                            {c.name}
                          </Text>
                          <Icon name="chevr" size={13} color={p.text3} width={2} />
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Card>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}
