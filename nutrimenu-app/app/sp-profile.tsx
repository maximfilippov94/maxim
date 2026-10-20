import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { api, SpProfile, PROFESSION } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Label, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { Face } from '../src/ui/Face';
import { SysButton } from '../src/ui/system';
import { pickPhoto } from '../src/photo';
import { uploadFile } from '../src/upload';
import { haptic } from '../src/haptics';

type Prof = 'nutritionist' | 'trainer' | 'endocrinologist' | 'coach';

export default function SpProfileEdit() {
  const { p, refreshMe } = useApp();
  const [pr, setPr] = useState<SpProfile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [prof, setProf] = useState<Prof>('nutritionist');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ profile: SpProfile }>('/specialist/profile').then(r => {
      const x = r.profile;
      setPr(x); setName(x.name ?? '');
      setPhone((x as any).phone ?? '');
      setProf((x.profession as any) ?? 'nutritionist');
      setAvatar(x.avatar_url ?? null);
    }).catch(e => setErr(e.message));
  }, []);

  async function changePhoto() {
    setErr(null);
    try {
      const f = await pickPhoto(true);
      if (!f) return;
      setBusy(true);
      /* Аватар уходит на сервер сразу: ссылку на файл всё равно надо
         получить до сохранения профиля. */
      const url = await uploadFile('/specialist/avatar', f, 'photo');
      setAvatar(url);
      haptic.success();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось загрузить фото'); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!name.trim()) { haptic.error(); setErr('Как вас зовут?'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/specialist/profile', {
        method: 'PATCH',
        body: { name: name.trim(), phone: phone.trim() || null, avatar_url: avatar },
      });
      haptic.success();
      await refreshMe();
      router.back();
    } catch (e: any) { haptic.error(); setErr(e?.message ?? 'Не удалось сохранить'); }
    finally { setBusy(false); }
  }

  if (!pr) {
    return (
      <View style={{ flex: 1, backgroundColor: p.surface, justifyContent: 'center' }}>
        <ActivityIndicator color={p.accent} />
      </View>
    );
  }

  const field = {
    marginTop: S.sm, backgroundColor: p.inset, color: p.text,
    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 13, fontSize: 16,
  } as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.surface }}
      contentContainerStyle={{ padding: S.xl }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xl }}>
        <Text style={{ ...FONT.h2, color: p.text, flex: 1 }}>Профиль</Text>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12}>
          <Icon name="close" size={20} color={p.text3} />
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', marginBottom: S.xl }}>
        <Face url={avatar} name={name || 'С'} size={84} />
        <Pressable onPress={changePhoto} disabled={busy} hitSlop={10}
          style={({ pressed }) => ({ marginTop: S.md, opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ ...FONT.body, color: p.accent }}>Сменить фото</Text>
        </Pressable>
      </View>

      <Label>Имя</Label>
      <TextInput value={name} onChangeText={t => { setName(t); setErr(null); }}
        placeholder="Максим Филиппов" placeholderTextColor={p.text3} style={field} />

      <View style={{ height: S.lg }} />
      <Label>Телефон</Label>
      <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad"
        placeholder="необязательно" placeholderTextColor={p.text3} style={field} />

      <View style={{ height: S.lg }} />
      <Label>Профессия</Label>
      {/* Профессию нельзя сменить этой формой: сервер её здесь не
          читает вовсе — она меняется заявкой с документами, которую
          проверяет владелец. Раньше тут стоял выбор из трёх кнопок, он
          нажимался, сохранялся «успешно» и ничего не менял. */}
      <Pressable onPress={() => { haptic.tap(); router.push('/sp-profession'); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: S.md, marginTop: S.sm,
          paddingVertical: 14, paddingHorizontal: S.lg, borderRadius: R.md,
          backgroundColor: pressed ? p.ov2 : p.inset,
        })}>
        <Text style={{ ...FONT.body, color: p.text, flex: 1 }}>{PROFESSION[prof]}</Text>
        <Text style={{ ...FONT.small, fontWeight: '600', color: p.accent }}>Сменить</Text>
        <Icon name="chevr" size={14} color={p.text3} />
      </Pressable>
      <Muted style={{ marginTop: S.sm }}>
        Смена профессии проходит проверку: нужны документы по новой специальности.
      </Muted>

      {pr.join_code ? (
        <Muted style={{ marginTop: S.lg }}>
          Код для клиентов: {pr.join_code} · {PROFESSION[prof]}
        </Muted>
      ) : null}

      {err ? <Text style={{ ...FONT.small, color: p.danger, marginTop: S.md }}>{err}</Text> : null}

      <View style={{ marginTop: S.xl }}>
        <SysButton label="Сохранить" variant="prominent" disabled={busy} onPress={save} />
      </View>
    </ScrollView>
  );
}
