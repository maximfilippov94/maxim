/**
 * Регистрация.
 *
 * Клиент идёт пошаговым мастером — ровно как в вебе (`registerClient()`
 * → `wizRender()`): шесть шагов, по одному вопросу на экран, полоса
 * пройденного сверху. Одна длинная анкета, которая была здесь раньше,
 * расходилась с сайтом и отпугивала: человек видел сразу десять полей
 * и закрывал экран.
 *
 * Варианты ответов взяты из веба дословно. Своих формулировок тут быть
 * не должно: один и тот же человек заполняет анкету в приложении, а
 * правит её на сайте, и «Здоровье и энергия» против «Здоровье и ЖКТ»
 * читается как потеря ответа.
 *
 * Выбранный пункт не заливается лаймом сплошь: в вебе это рамка
 * акцентом и бледная подложка (`.wiz-opt.on` → `--accent-050`). Сплошная
 * заливка требует тёмной надписи поверх, а на фоне фотографии тёмная
 * надпись теряется.
 *
 * Специалист остаётся на одной странице: у него три поля и профессия,
 * мастер там не нужен.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useApp } from '../src/store';
import { SignUpProfile, api } from '../src/api';
import { S, R, FONT, alpha } from '../src/theme';
import { Icon } from '../src/ui/Icon';
import { AuthShell, ON_PHOTO, photoField, Note, AuthButton } from '../src/ui/AuthShell';
import { LegalNote } from '../src/ui/LegalNote';
import { haptic } from '../src/haptics';

type Role = 'client' | 'specialist';

type Prof = 'nutritionist' | 'trainer' | 'endocrinologist' | 'coach';
const PROFESSIONS: [Prof, string][] = [
  ['nutritionist', 'Нутрициолог'],
  ['trainer', 'Тренер'],
  ['endocrinologist', 'Эндокринолог'],
  ['coach', 'Коуч'],
];

/* Три уровня и те же пояснения, что в вебе (`wizOptions('activity', …)`).
   Пяти ступеней в вебе нет, и сервер считает норму по трём: расширенный
   список давал человеку выбор, который нигде не учитывался. */
const ACTIVITY: [NonNullable<SignUpProfile['activity_level']>, string, string][] = [
  ['low', 'Низкая', 'Сидячий образ жизни, мало движения'],
  ['medium', 'Средняя', 'Тренировки 2–3 раза в неделю'],
  ['high', 'Высокая', 'Спорт почти каждый день'],
];

/* Ключ — то, что уходит на сервер и лежит в базе; подпись — то, что
   читает человек. В вебе пара ровно такая же. */
const GOALS: [string, string][] = [
  ['Снижение веса', 'Похудеть'],
  ['Поддержание', 'Поддерживать вес'],
  ['Набор массы', 'Набрать вес'],
  ['Набор мышечной массы', 'Набрать мышечную массу'],
  ['Здоровье ЖКТ', 'Здоровье и ЖКТ'],
];

const DISLIKES = ['Рыба', 'Мясо', 'Молочное', 'Глютен', 'Орехи',
  'Грибы', 'Яйца', 'Мёд', 'Свинина', 'Лактоза'];

const STEPS = 6;

export default function Register() {
  const { signUp } = useApp();

  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [prof, setProf] = useState<Prof>('nutritionist');
  const [sex, setSex] = useState<'m' | 'f' | null>(null);
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [act, setAct] = useState<SignUpProfile['activity_level'] | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const profile = useCallback((): SignUpProfile => ({
    ...(sex ? { sex } : {}),
    ...(age ? { age: parseInt(age, 10) } : {}),
    ...(height ? { height_cm: parseInt(height, 10) } : {}),
    ...(weight ? { weight_kg: parseFloat(weight.replace(',', '.')) } : {}),
    ...(act ? { activity_level: act } : {}),
    ...(goal ? { goal } : {}),
  }), [sex, age, height, weight, act, goal]);

  const create = useCallback(async () => {
    setErr(null);
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
          : { profile: profile() }),
      });
      /* Что человек не ест, `/auth/register` в карточку не переносит —
         только в ответы анкеты. Досылаем анкету отдельно: этот маршрут
         кладёт `dislikes` в `excluded_ingredients`, и меню начинает их
         учитывать. Без этого шаг «что вы не едите» был бы украшением. */
      if (role === 'client' && dislikes.length) {
        try {
          await api('/client/onboarding', {
            method: 'POST',
            body: { answers: { ...profile(), dislikes } },
          });
        } catch { /* учётка уже создана — анкету можно поправить в профиле */ }
      }
      haptic.success();
      /* Клиента ведём на выбор пути, как в вебе: без него новый человек
         попадал на пустое «Сегодня» и не знал, что делать дальше.
         Специалисту выбирать нечего — у него сразу кабинет. */
      router.replace(role === 'specialist' ? '/sp' : '/start');
    } catch (e: any) {
      haptic.error(); setErr(e?.message ?? 'Не удалось зарегистрироваться');
    } finally { setBusy(false); }
  }, [role, name, email, pass, prof, dislikes, profile, signUp]);

  /* Проверка своя на каждом шаге: дальше пускаем только с ответом, но
     спрашиваем по одному — человеку не приходится искать, где он
     ошибся, среди десяти полей. */
  const next = useCallback(() => {
    setErr(null);
    if (step === 1 && !name.trim()) { haptic.error(); setErr('Введите имя'); return; }
    if (step === 2 && !goal) { haptic.error(); setErr('Выберите цель'); return; }
    if (step === 3) {
      if (!sex) { haptic.error(); setErr('Укажите пол'); return; }
      if (!(+age > 0) || !(+height > 0) || !(+weight.replace(',', '.') > 0)) {
        haptic.error(); setErr('Заполните возраст, рост и вес'); return;
      }
    }
    if (step === 4 && !act) { haptic.error(); setErr('Выберите уровень активности'); return; }
    if (step < STEPS) { haptic.tap(); setStep(step + 1); return; }
    create();
  }, [step, name, goal, sex, age, height, weight, act, create]);

  const back = useCallback(() => {
    setErr(null);
    haptic.tap();
    if (step > 1) setStep(step - 1); else { setRole(null); setStep(1); }
  }, [step]);

  const label = (t: string, top: number = S.lg) => (
    <Text style={{ ...FONT.small, color: ON_PHOTO.text3, marginTop: top, marginBottom: S.sm }}>
      {t}
    </Text>
  );

  /* Шаг нулевой: кто вы. От этого зависит и анкета, и куда пустят после. */
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
          onPress={() => { haptic.tap(); setRole('client'); setStep(1); }}
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

  const problem = err ? (
    <View style={{ backgroundColor: 'rgba(255,147,147,0.16)', borderRadius: R.md,
      padding: S.lg, marginTop: S.lg }}>
      <Text style={{ ...FONT.small, color: '#FFD9D6' }}>{err}</Text>
    </View>
  ) : null;

  /* Специалист: полей мало, шаги только мешали бы. */
  if (role === 'specialist') {
    return (
      <AuthShell>
        <Head eyebrow="Специалист" onBack={back} />

        <Text style={{ ...FONT.h1, fontSize: 26, color: ON_PHOTO.text, marginTop: S.lg }}>
          Анкета специалиста
        </Text>
        <Note style={{ marginTop: S.sm }}>
          Кабинет специалиста откроется в браузере, вход тот же.
        </Note>

        {label('Имя', S.xl)}
        <TextInput value={name} onChangeText={setName} style={photoField}
          placeholder="Максим Филиппов" placeholderTextColor={ON_PHOTO.text3}
          autoComplete="name" />

        {label('Email')}
        <TextInput value={email} onChangeText={setEmail} style={photoField}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          placeholder="you@example.com" placeholderTextColor={ON_PHOTO.text3} />

        {label('Пароль')}
        <TextInput value={pass} onChangeText={setPass} style={photoField}
          secureTextEntry autoComplete="new-password"
          placeholder="от 8 символов с цифрой" placeholderTextColor={ON_PHOTO.text3} />

        {label('Профессия')}
        <Chips items={PROFESSIONS.map(([k, l]) => [k, l])}
          value={prof} onChange={v => setProf(v as Prof)} />

        {problem}

        <View style={{ marginTop: S.xl }}>
          <AuthButton title={busy ? 'Создаём…' : 'Создать аккаунт'}
            loading={busy} onPress={create} />
          <LegalNote color={ON_PHOTO.text3} link={ON_PHOTO.text2} />
        </View>
      </AuthShell>
    );
  }

  /* Клиент: шесть шагов. Заголовок, подпись и содержимое — по вебу. */
  const [eyebrow, title, sub] = ([
    ['Знакомство', 'Как к вам обращаться?', 'Имя будем показывать в приложении.'],
    ['Цель', 'С какой целью вы здесь?', ''],
    ['О вас', 'Немного о вас', 'Нужно для точного расчёта нормы.'],
    ['Активность', 'Насколько вы активны?', 'В среднем за неделю.'],
    ['Предпочтения', 'Что вы не едите?', 'Необязательно — можно пропустить.'],
    ['Аккаунт', 'Создайте аккаунт',
      'После регистрации выберете, как начать: со специалистом, EQUA AI или самостоятельно.'],
  ] as const)[step - 1];

  return (
    <AuthShell>
      <Head eyebrow={eyebrow} onBack={back} />
      <Progress step={step} />

      <Animated.View key={step}
        entering={FadeInRight.duration(220)} exiting={FadeOutLeft.duration(140)}>
        <Text style={{ ...FONT.h1, fontSize: 26, color: ON_PHOTO.text, marginTop: S.lg }}>
          {title}
        </Text>
        {sub ? <Note style={{ marginTop: S.sm }}>{sub}</Note> : null}

        <View style={{ marginTop: S.xl }}>
          {step === 1 ? (
            <TextInput value={name} onChangeText={setName} style={photoField}
              placeholder="Ваше имя" placeholderTextColor={ON_PHOTO.text3}
              autoComplete="name" autoFocus />
          ) : null}

          {step === 2 ? (
            <Options items={GOALS.map(([k, l]) => [k, l, ''])}
              value={goal} onChange={setGoal} />
          ) : null}

          {step === 3 ? (
            <>
              <Segment items={[['f', 'Женский'], ['m', 'Мужской']]}
                value={sex} onChange={v => setSex(v as 'm' | 'f')} />
              <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.lg }}>
                <View style={{ flex: 1 }}>
                  {label('Возраст', 0)}
                  <TextInput value={age} onChangeText={t => setAge(t.replace(/\D/g, ''))}
                    style={photoField} keyboardType="number-pad" maxLength={2}
                    placeholder="34" placeholderTextColor={ON_PHOTO.text3} />
                </View>
                <View style={{ flex: 1 }}>
                  {label('Рост, см', 0)}
                  <TextInput value={height} onChangeText={t => setHeight(t.replace(/\D/g, ''))}
                    style={photoField} keyboardType="number-pad" maxLength={3}
                    placeholder="168" placeholderTextColor={ON_PHOTO.text3} />
                </View>
                <View style={{ flex: 1 }}>
                  {label('Вес, кг', 0)}
                  <TextInput value={weight} onChangeText={setWeight}
                    style={photoField} keyboardType="decimal-pad" maxLength={5}
                    placeholder="67,4" placeholderTextColor={ON_PHOTO.text3} />
                </View>
              </View>
            </>
          ) : null}

          {step === 4 ? (
            <Options items={ACTIVITY.map(([k, l, hint]) => [k, l, hint])}
              value={act ?? null} onChange={v => setAct(v as SignUpProfile['activity_level'])} />
          ) : null}

          {step === 5 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {DISLIKES.map(x => {
                const on = dislikes.includes(x);
                return (
                  <Pressable key={x} onPress={() => {
                    haptic.select();
                    setDislikes(d => on ? d.filter(v => v !== x) : [...d, x]);
                  }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill,
                      backgroundColor: on ? alpha(ON_PHOTO.primary, 14) : 'transparent',
                      borderWidth: 1,
                      borderColor: on ? ON_PHOTO.primary : ON_PHOTO.fieldBorder,
                      opacity: pressed ? 0.7 : 1,
                    })}>
                    <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
                      color: on ? ON_PHOTO.accent : ON_PHOTO.text2 }}>{x}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {step === 6 ? (
            <>
              <TextInput value={email} onChangeText={setEmail} style={photoField}
                autoCapitalize="none" keyboardType="email-address" autoComplete="email"
                placeholder="Email" placeholderTextColor={ON_PHOTO.text3} />
              <View style={{ height: S.md }} />
              <TextInput value={pass} onChangeText={setPass} style={photoField}
                secureTextEntry autoComplete="new-password"
                placeholder="Пароль — от 8 символов, буква и цифра"
                placeholderTextColor={ON_PHOTO.text3} />
            </>
          ) : null}
        </View>

        {problem}
      </Animated.View>

      <View style={{ marginTop: S.xl }}>
        <AuthButton
          title={busy ? 'Создаём…' : step < STEPS ? 'Далее' : 'Создать аккаунт'}
          loading={busy} onPress={next} />
        {step === STEPS ? <LegalNote color={ON_PHOTO.text3} link={ON_PHOTO.text2} /> : null}
      </View>
    </AuthShell>
  );
}

/** Шапка мастера: назад, где мы сейчас, выход ко входу. */
function Head({ eyebrow, onBack }: { eyebrow: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      <Pressable onPress={onBack} hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        accessibilityRole="button" accessibilityLabel="Назад">
        <Icon name="back" size={20} color={ON_PHOTO.text} width={2.2} />
      </Pressable>
      <Text style={{ ...FONT.small, color: ON_PHOTO.text3, flex: 1, textAlign: 'center' }}>
        {eyebrow}
      </Text>
      <Pressable onPress={() => { haptic.tap(); router.replace('/login'); }} hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        accessibilityRole="button" accessibilityLabel="Закрыть">
        <Icon name="close" size={19} color={ON_PHOTO.text3} width={2} />
      </Pressable>
    </View>
  );
}

/** Полоса пройденного: шесть отрезков, как в вебе (`.wiz-prog`). */
function Progress({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginTop: S.lg }}>
      {Array.from({ length: STEPS }, (_, i) => (
        <View key={i} style={{
          flex: 1, height: 3, borderRadius: 2,
          backgroundColor: i < step ? ON_PHOTO.primary : ON_PHOTO.fieldBorder,
        }} />
      ))}
    </View>
  );
}

/** Список вариантов: один ответ на шаг, с пояснением под подписью. */
function Options({ items, value, onChange }: {
  items: [string, string, string][];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: S.sm }}>
      {items.map(([k, l, hint]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => { haptic.select(); onChange(k); }}>
            {({ pressed }) => (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: S.md,
                paddingVertical: 14, paddingHorizontal: S.lg, borderRadius: R.md,
                /* Подложка акцента вместо сплошной заливки — как
                   `.wiz-opt.on` в вебе: на фотографии так читается и
                   подпись, и то, что выбрано. */
                backgroundColor: on ? alpha(ON_PHOTO.primary, 14)
                  : pressed ? 'rgba(255,255,255,0.06)' : 'transparent',
                borderWidth: 1,
                borderColor: on ? ON_PHOTO.primary : ON_PHOTO.fieldBorder,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: on ? '700' : '500',
                    color: on ? ON_PHOTO.accent : ON_PHOTO.text }}>{l}</Text>
                  {hint ? <Note style={{ marginTop: 2 }}>{hint}</Note> : null}
                </View>
                <View style={{
                  width: 20, height: 20, borderRadius: 10,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? ON_PHOTO.primary : 'transparent',
                  borderWidth: on ? 0 : 1.5, borderColor: ON_PHOTO.fieldBorder,
                }}>
                  {on ? <Icon name="check" size={11} color={ON_PHOTO.onPrimary} width={2.6} /> : null}
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Переключатель из двух: пол. */
function Segment({ items, value, onChange }: {
  items: [string, string][]; value: string | null; onChange: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: S.sm }}>
      {items.map(([k, l]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => { haptic.select(); onChange(k); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 13, borderRadius: R.md, alignItems: 'center',
              backgroundColor: on ? alpha(ON_PHOTO.primary, 14) : 'transparent',
              borderWidth: 1, borderColor: on ? ON_PHOTO.primary : ON_PHOTO.fieldBorder,
              opacity: pressed ? 0.7 : 1,
            })}>
            <Text style={{ fontSize: 15, fontWeight: on ? '700' : '400',
              color: on ? ON_PHOTO.accent : ON_PHOTO.text2 }}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
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
            <Icon name={icon} size={22} color={ON_PHOTO.onPrimary} />
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
              backgroundColor: on ? alpha(ON_PHOTO.primary, 14) : 'transparent',
              borderWidth: 1, borderColor: on ? ON_PHOTO.primary : ON_PHOTO.fieldBorder,
              opacity: pressed && !on ? 0.7 : 1,
            })}>
            <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400',
              color: on ? ON_PHOTO.accent : ON_PHOTO.text2 }}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
