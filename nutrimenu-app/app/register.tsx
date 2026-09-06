import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../src/store';
import { SignUpProfile } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { SysButton } from '../src/ui/system';
import { Aurora } from '../src/ui/Aurora';
import { haptic } from '../src/haptics';

type Role = 'client' | 'specialist';

const PROFESSIONS: ['nutritionist' | 'trainer' | 'coach', string][] = [
  ['nutritionist', 'Нутрициолог'],
  ['trainer', 'Тренер'],
  ['coach', 'Коуч'],
];

const ACTIVITY: [NonNullable<SignUpProfile['activity_level']>, string, string][] = [
  ['low', 'Сидячий образ', 'работа за столом, без тренировок'],
  ['light', 'Немного движения', '1–2 тренировки в неделю'],
  ['medium', 'Умеренно', '3–4 тренировки в неделю'],
  ['high', 'Много движения', '5–6 тренировок в неделю'],
  ['athlete', 'Спорт каждый день', 'две тренировки в день или тяжёлый труд'],
];

const GOALS = ['Снижение веса', 'Поддержание', 'Набор массы', 'Здоровье и энергия'];

export default function Register() {
  const { p, signUp } = useApp();
  const insets = useSafeAreaInsets();

  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [prof, setProf] = useState<'nutritionist' | 'trainer' | 'coach'>('nutritionist');
  const [sex, setSex] = useState<'m' | 'f' | null>(null);
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [act, setAct] = useState<SignUpProfile['activity_level']>('medium');
  const [goal, setGoal] = useState(GOALS[0]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    setErr(null);
    if (!name.trim()) { haptic.error(); setErr('Как вас зовут?'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      haptic.error(); setErr('Проверьте адрес почты'); return;
    }
    if (pass.length < 8 || !/\d/.test(pass) || !/[a-zA-Zа-яА-Я]/.test(pass)) {
      haptic.error(); setErr('Пароль — от 8 символов, с буквой и цифрой'); return;
    }
    setBusy(true);
    try {
      await signUp({
        role: role!,
        name: name.trim(),
        email: email.trim(),
        password: pass,
        ...(role === 'specialist'
          ? { profession: prof }
          : {
            profile: {
              ...(sex ? { sex } : {}),
              ...(age ? { age: parseInt(age, 10) } : {}),
              ...(height ? { height_cm: parseInt(height, 10) } : {}),
              ...(weight ? { weight_kg: parseFloat(weight.replace(',', '.')) } : {}),
              activity_level: act,
              goal,
            },
          }),
      });
      haptic.success();
      router.replace(role === 'specialist' ? '/sp' : '/client');
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось зарегистрироваться');
    } finally { setBusy(false); }
  }, [role, name, email, pass, prof, sex, age, height, weight, act, goal, signUp]);

  const field = {
    backgroundColor: p.surface, color: p.text,
    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 14,
    fontSize: 16, borderWidth: 1, borderColor: p.borderSoft,
  } as const;

  const label = (t: string, top: number = S.lg) => (
    <Text style={{ ...FONT.small, color: p.text3, marginTop: top, marginBottom: S.sm }}>{t}</Text>
  );

  /* Шаг первый: кто вы. От этого зависит и анкета, и куда пустят после. */
  if (!role) {
    return (
      <Shell insets={insets}>
        <Text style={{ ...FONT.h1, color: p.text }}>Регистрация</Text>
        <Muted style={{ marginTop: S.sm, marginBottom: S.xxl }}>
          Кем вы будете пользоваться NutriMenu?
        </Muted>

        <RoleCard
          icon="user" title="Я клиент"
          note="Своё меню, вода, прогресс и переписка со специалистом."
          onPress={() => { haptic.tap(); setRole('client'); }}
        />
        <View style={{ height: S.md }} />
        <RoleCard
          icon="chat" title="Я специалист"
          note="Клиенты, меню, отчёты. Нутрициолог, тренер или коуч."
          onPress={() => { haptic.tap(); setRole('specialist'); }}
        />

        <Pressable onPress={() => router.back()} hitSlop={10}
          style={({ pressed }) => ({ marginTop: S.xxl, opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ ...FONT.body, color: p.primary, textAlign: 'center' }}>
            У меня уже есть аккаунт
          </Text>
        </Pressable>
      </Shell>
    );
  }

  return (
    <Shell insets={insets}>
      <Pressable onPress={() => { haptic.tap(); setRole(null); setErr(null); }} hitSlop={12}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4,
          marginBottom: S.lg, opacity: pressed ? 0.5 : 1 })}>
        <Icon name="back" size={18} color={p.primary} width={2.2} />
        <Text style={{ ...FONT.body, color: p.primary }}>Другая роль</Text>
      </Pressable>

      <Text style={{ ...FONT.h1, color: p.text }}>
        {role === 'client' ? 'Анкета клиента' : 'Анкета специалиста'}
      </Text>
      <Muted style={{ marginTop: S.sm }}>
        {role === 'client'
          ? 'По ней посчитаем предварительную норму — специалист потом уточнит.'
          : 'Кабинет специалиста откроется в браузере, вход тот же.'}
      </Muted>

      {label('Имя', S.xxl)}
      <TextInput value={name} onChangeText={setName} style={field}
        placeholder={role === 'client' ? 'Анна Петрова' : 'Максим Филиппов'}
        placeholderTextColor={p.text3} autoComplete="name" />

      {label('Email')}
      <TextInput value={email} onChangeText={setEmail} style={field}
        autoCapitalize="none" keyboardType="email-address" autoComplete="email"
        placeholder="you@example.com" placeholderTextColor={p.text3} />

      {label('Пароль')}
      <TextInput value={pass} onChangeText={setPass} style={field}
        secureTextEntry autoComplete="new-password"
        placeholder="от 8 символов с цифрой" placeholderTextColor={p.text3} />

      {role === 'specialist' ? (
        <>
          {label('Профессия')}
          <Chips items={PROFESSIONS.map(([k, l]) => [k, l])}
            value={prof} onChange={v => setProf(v as any)} />
        </>
      ) : (
        <>
          {label('Пол')}
          <Chips items={[['f', 'Женский'], ['m', 'Мужской']]}
            value={sex} onChange={v => setSex(v as 'm' | 'f')} />

          <View style={{ flexDirection: 'row', gap: S.md }}>
            <View style={{ flex: 1 }}>
              {label('Возраст')}
              <TextInput value={age} onChangeText={t => setAge(t.replace(/\D/g, ''))}
                style={field} keyboardType="number-pad" maxLength={2}
                placeholder="34" placeholderTextColor={p.text3} />
            </View>
            <View style={{ flex: 1 }}>
              {label('Рост, см')}
              <TextInput value={height} onChangeText={t => setHeight(t.replace(/\D/g, ''))}
                style={field} keyboardType="number-pad" maxLength={3}
                placeholder="168" placeholderTextColor={p.text3} />
            </View>
            <View style={{ flex: 1 }}>
              {label('Вес, кг')}
              <TextInput value={weight} onChangeText={setWeight}
                style={field} keyboardType="decimal-pad" maxLength={5}
                placeholder="67,4" placeholderTextColor={p.text3} />
            </View>
          </View>

          {label('Цель')}
          <Chips items={GOALS.map(g => [g, g])} value={goal} onChange={setGoal} />

          {label('Сколько двигаетесь')}
          <View style={{ gap: 1 }}>
            {ACTIVITY.map(([k, l, hint]) => {
              const on = k === act;
              return (
                <Pressable key={k} onPress={() => { haptic.select(); setAct(k); }}>
                  {({ pressed }) => (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: S.md,
                      paddingVertical: 11, paddingHorizontal: S.lg, borderRadius: R.md,
                      backgroundColor: on ? p.primarySoft : pressed ? p.ov1 : 'transparent',
                    }}>
                      <View style={{
                        width: 20, height: 20, borderRadius: 10,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: on ? p.primary : 'transparent',
                        borderWidth: on ? 0 : 1.5, borderColor: p.track,
                      }}>
                        {on ? <Icon name="check" size={11} color={p.onPrimary} width={2.6} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, color: on ? p.text : p.text2 }}>{l}</Text>
                        <Muted style={{ marginTop: 1 }}>{hint}</Muted>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {err ? (
        <View style={{ backgroundColor: p.premiumSoft, borderRadius: R.md,
          padding: S.lg, marginTop: S.lg }}>
          <Text style={{ ...FONT.small, color: p.premium }}>{err}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: S.xl }}>
        <SysButton label="Создать аккаунт" variant="prominent" disabled={busy} onPress={submit} />
      </View>
    </Shell>
  );
}

function Shell({ children, insets }: {
  children: React.ReactNode; insets: { top: number; bottom: number };
}) {
  const { p } = useApp();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Aurora style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1, justifyContent: 'center', padding: S.xl,
          paddingTop: insets.top + S.xl, paddingBottom: insets.bottom + S.xxl,
        }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(260)}>{children}</Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Карточка выбора роли: крупная, чтобы решение читалось с одного взгляда. */
function RoleCard({ icon, title, note, onPress }: {
  icon: string; title: string; note: string; onPress: () => void;
}) {
  const { p } = useApp();
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: S.lg,
          backgroundColor: p.surface, borderRadius: R.lg, padding: S.xl,
          borderWidth: 1, borderColor: p.borderSoft,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        }}>
          <View style={{
            width: 46, height: 46, borderRadius: 23, backgroundColor: p.primarySoft,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={icon} size={22} color={p.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...FONT.h2, color: p.text }}>{title}</Text>
            <Muted style={{ marginTop: 3, lineHeight: 18 }}>{note}</Muted>
          </View>
          <Icon name="chevr" size={15} color={p.text3} width={2} />
        </View>
      )}
    </Pressable>
  );
}

/** Ряд переключателей: выбор одного из немногих. */
function Chips({ items, value, onChange }: {
  items: [string, string][]; value: string | null; onChange: (v: string) => void;
}) {
  const { p } = useApp();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
      {items.map(([k, l]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => { haptic.select(); onChange(k); }}
            style={({ pressed }) => ({
              paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill,
              backgroundColor: on ? p.primary : p.surface,
              borderWidth: on ? 0 : 1, borderColor: p.borderSoft,
              opacity: pressed && !on ? 0.7 : 1,
            })}>
            <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
              color: on ? p.onPrimary : p.text2 }}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
