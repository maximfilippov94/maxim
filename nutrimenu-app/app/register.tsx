import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { SignUpProfile } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { Icon } from '../src/ui/Icon';
import { AuthShell, ON_PHOTO, photoField, Note, AuthButton } from '../src/ui/AuthShell';
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
  const { signUp } = useApp();

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

  const label = (t: string, top: number = S.lg) => (
    <Text style={{ ...FONT.small, color: ON_PHOTO.text3, marginTop: top, marginBottom: S.sm }}>
      {t}
    </Text>
  );

  /* Шаг первый: кто вы. От этого зависит и анкета, и куда пустят после. */
  if (!role) {
    return (
      <AuthShell back>
        <Text style={{ ...FONT.h1, fontSize: 28, color: ON_PHOTO.text }}>Регистрация</Text>
        <Note style={{ marginTop: S.sm, marginBottom: S.xl }}>
          Кем вы будете пользоваться EQUA?
        </Note>

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

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: S.xxl }}>
          <Note>Уже есть аккаунт?</Note>
          <Pressable onPress={() => { haptic.tap(); router.replace('/login'); }} hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ ...FONT.small, color: ON_PHOTO.accent, fontWeight: '600' }}>Войти</Text>
          </Pressable>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Pressable onPress={() => { haptic.tap(); setRole(null); setErr(null); }} hitSlop={12}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4,
          marginBottom: S.lg, opacity: pressed ? 0.5 : 1 })}>
        <Icon name="back" size={18} color={ON_PHOTO.text} width={2.2} />
        <Text style={{ ...FONT.body, color: ON_PHOTO.text }}>Другая роль</Text>
      </Pressable>

      <Text style={{ ...FONT.h1, fontSize: 26, color: ON_PHOTO.text }}>
        {role === 'client' ? 'Анкета клиента' : 'Анкета специалиста'}
      </Text>
      <Note style={{ marginTop: S.sm }}>
        {role === 'client'
          ? 'По ней посчитаем предварительную норму — специалист потом уточнит.'
          : 'Кабинет специалиста откроется в браузере, вход тот же.'}
      </Note>

      {label('Имя', S.xl)}
      <TextInput value={name} onChangeText={setName} style={photoField}
        placeholder={role === 'client' ? 'Анна Петрова' : 'Максим Филиппов'}
        placeholderTextColor={ON_PHOTO.text3} autoComplete="name" />

      {label('Email')}
      <TextInput value={email} onChangeText={setEmail} style={photoField}
        autoCapitalize="none" keyboardType="email-address" autoComplete="email"
        placeholder="you@example.com" placeholderTextColor={ON_PHOTO.text3} />

      {label('Пароль')}
      <TextInput value={pass} onChangeText={setPass} style={photoField}
        secureTextEntry autoComplete="new-password"
        placeholder="от 8 символов с цифрой" placeholderTextColor={ON_PHOTO.text3} />

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
                style={photoField} keyboardType="number-pad" maxLength={2}
                placeholder="34" placeholderTextColor={ON_PHOTO.text3} />
            </View>
            <View style={{ flex: 1 }}>
              {label('Рост, см')}
              <TextInput value={height} onChangeText={t => setHeight(t.replace(/\D/g, ''))}
                style={photoField} keyboardType="number-pad" maxLength={3}
                placeholder="168" placeholderTextColor={ON_PHOTO.text3} />
            </View>
            <View style={{ flex: 1 }}>
              {label('Вес, кг')}
              <TextInput value={weight} onChangeText={setWeight}
                style={photoField} keyboardType="decimal-pad" maxLength={5}
                placeholder="67,4" placeholderTextColor={ON_PHOTO.text3} />
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
                      backgroundColor: on ? ON_PHOTO.card
                        : pressed ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}>
                      <View style={{
                        width: 20, height: 20, borderRadius: 10,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: on ? ON_PHOTO.primary : 'transparent',
                        borderWidth: on ? 0 : 1.5, borderColor: ON_PHOTO.fieldBorder,
                      }}>
                        {on ? <Icon name="check" size={11} color="#FFFFFF" width={2.6} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15,
                          color: on ? ON_PHOTO.text : ON_PHOTO.text2 }}>{l}</Text>
                        <Note style={{ marginTop: 1 }}>{hint}</Note>
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
        <View style={{ backgroundColor: 'rgba(226,86,77,0.22)', borderRadius: R.md,
          padding: S.lg, marginTop: S.lg }}>
          <Text style={{ ...FONT.small, color: '#FFD9D6' }}>{err}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: S.xl }}>
        <AuthButton title={busy ? 'Создаём…' : 'Создать аккаунт'} loading={busy} onPress={submit} />
      </View>
    </AuthShell>
  );
}

/** Карточка выбора роли: крупная, чтобы решение читалось с одного взгляда. */
function RoleCard({ icon, title, note, onPress }: {
  icon: string; title: string; note: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: S.lg,
          backgroundColor: ON_PHOTO.card, borderRadius: R.lg, padding: S.xl,
          borderWidth: 1, borderColor: ON_PHOTO.fieldBorder,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        }}>
          <View style={{
            width: 46, height: 46, borderRadius: 23, backgroundColor: ON_PHOTO.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={icon} size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...FONT.h2, color: ON_PHOTO.text }}>{title}</Text>
            <Note style={{ marginTop: 3 }}>{note}</Note>
          </View>
          <Icon name="chevr" size={15} color={ON_PHOTO.text3} width={2} />
        </View>
      )}
    </Pressable>
  );
}

/** Ряд переключателей: выбор одного из немногих. */
function Chips({ items, value, onChange }: {
  items: [string, string][]; value: string | null; onChange: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
      {items.map(([k, l]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => { haptic.select(); onChange(k); }}
            style={({ pressed }) => ({
              paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill,
              backgroundColor: on ? ON_PHOTO.primary : ON_PHOTO.field,
              borderWidth: 1, borderColor: on ? ON_PHOTO.primary : ON_PHOTO.fieldBorder,
              opacity: pressed && !on ? 0.7 : 1,
            })}>
            <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
              color: on ? '#FFFFFF' : ON_PHOTO.text2 }}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
