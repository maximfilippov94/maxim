import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Switch, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useApp } from '../store';
import { api, mediaUrl, Preferences, parseList, readSex } from '../api';
import { S, R, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { Card, Label, Muted } from '../ui/base';
import { Icon } from '../ui/Icon';
import { SysButton } from '../ui/system';
import { kg } from '../format';
import { targets } from '../targets';
import { haptic } from '../haptics';
import { pickPhoto } from '../photo';
import { uploadForm } from '../upload';
import { Loading } from './Shopping';

/** Уровень активности словами — как на сайте. */
const ACTIVITY: Record<string, string> = {
  low: 'низкий', light: 'лёгкий', medium: 'средний',
  high: 'высокий', athlete: 'спортсмен',
};

/* Варианты — те же, что в анкете при регистрации: человек заполнял их
   там, правит здесь, и разные наборы читались бы как потерянный ответ.
   Ключ уходит на сервер, он же показывается — так и в вебе. */
const GOALS = ['Снижение веса', 'Поддержание', 'Набор массы',
  'Набор мышечной массы', 'Здоровье ЖКТ'];
const ACTS = ['low', 'medium', 'high'];

/** Список через запятую — так его вводят и в вебе. */
const join = (a: string[]) => a.join(', ');
const split = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);

export default function Profile() {
  const { p, me, refreshMe } = useApp();
  const insets = useSafeAreaInsets();
  const u = me?.user;

  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [excluded, setExcluded] = useState('');
  const [swaps, setSwaps] = useState(true);
  const [notes, setNotes] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  /* Данные профиля правятся здесь же. Храним не копию полей, а только
     правки поверх них: что человек тронул, то и живёт в черновике,
     остальное читается прямо из профиля. Копия потребовала бы заливки
     при загрузке, а заливка — сторожа, чтобы ответ сервера не затирал
     набранное на полуслове. */
  const [draft, setDraft] = useState<{
    goal?: string; weight?: string; height?: string;
    years?: string; act?: string; sex?: 'm' | 'f';
  }>({});
  const edit = useCallback(<K extends 'goal' | 'weight' | 'height' | 'years' | 'act' | 'sex'>(
    k: K, v: NonNullable<typeof draft[K]>,
  ) => {
    setDraft(d => ({ ...d, [k]: v }));
    setMsg(null);
  }, []);

  const goal = draft.goal ?? u?.goal ?? '';
  const weight = draft.weight ?? (u?.weight_kg != null ? kg(u.weight_kg) : '');
  const height = draft.height ?? (u?.height_cm != null ? String(u.height_cm) : '');
  const years = draft.years
    ?? (u?.birth_year ? String(new Date().getFullYear() - u.birth_year) : '');
  const act = draft.act ?? u?.activity_level ?? '';
  const sex = draft.sex ?? readSex(u?.sex);

  /* Снимок профиля меняется отсюда: в вебе он кликабелен, в приложении
     его можно было только посмотреть. Сервер сам ужимает картинку до
     1100 точек, поэтому отправляем как есть. */
  const changePhoto = useCallback(async () => {
    const file = await pickPhoto(true);
    if (!file) return;
    setPhotoBusy(true); setMsg(null);
    try {
      await uploadForm('/client/avatar', file, 'photo');
      haptic.success();
      await refreshMe();
    } catch (e: any) {
      haptic.error(); setMsg(e?.message ?? 'Снимок не загрузился');
    } finally { setPhotoBusy(false); }
  }, [refreshMe]);

  const dropPhoto = useCallback(async () => {
    setPhotoBusy(true); setMsg(null);
    try {
      await api('/client/avatar', { method: 'DELETE' });
      haptic.success();
      await refreshMe();
    } catch (e: any) {
      haptic.error(); setMsg(e?.message ?? 'Не удалось убрать фото');
    } finally { setPhotoBusy(false); }
  }, [refreshMe]);

  useEffect(() => {
    api<{ preferences: Preferences }>('/client/preferences').then(r => {
      const pr = r.preferences ?? {};
      setLikes(join(parseList(pr.likes)));
      setDislikes(join(parseList(pr.dislikes)));
      setExcluded(join(parseList(pr.excluded)));
      setSwaps((pr.allowed_replacements ?? 1) === 1);
      setNotes(pr.notes ?? '');
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  /* Число из поля: запятая и пробелы допускаются, пустое — это «не
     указано», а не ноль. Границы широкие нарочно: отсекаем опечатку в
     разряде, а не спорим с человеком о его теле. */
  const num = (v: string, lo: number, hi: number, name: string) => {
    const t = v.replace(',', '.').trim();
    if (!t) return { ok: true as const, value: null };
    const n = Number(t);
    if (!Number.isFinite(n) || n < lo || n > hi) {
      return { ok: false as const, why: `${name}: ожидается от ${lo} до ${hi}` };
    }
    return { ok: true as const, value: n };
  };

  const save = useCallback(async () => {
    const w = num(weight, 30, 400, 'Вес');
    const h = num(height, 100, 250, 'Рост');
    const y = num(years, 10, 110, 'Возраст');
    const bad = [w, h, y].find(r => !r.ok);
    if (bad && !bad.ok) { haptic.error(); setMsg(bad.why); return; }

    setBusy(true); setMsg(null);
    try {
      /* Данные профиля идут тем же маршрутом, что и анкета: он пишет их
         прямо в карточку клиента. Прежние ответы дочитываем и шлём
         вместе — сервер кладёт присланное на место старых целиком. */
      const was = await api<{ answers?: Record<string, unknown> }>('/client/onboarding')
        .catch(() => null);
      const answers: Record<string, unknown> = { ...(was?.answers ?? {}) };
      if (goal) answers.goal = goal;
      if (act) answers.activity_level = act;
      if (sex) answers.sex = sex;
      if (w.ok && w.value != null) answers.weight_kg = w.value;
      if (h.ok && h.value != null) answers.height_cm = h.value;
      if (y.ok && y.value != null) answers.age = y.value;

      /* Нормы КБЖУ считает приложение: маршрут анкеты записывает ровно
         присланное и ничего не пересчитывает. Без этого правка роста
         или цели не меняла бы норму вовсе — считалось бы по прежним
         данным, ради которых сюда и пришли. Пересчитываем, только когда
         известно всё: по неполным данным формула соврёт сильнее, чем
         устаревшая, но честно посчитанная норма. */
      const nw = w.ok ? w.value : null;
      const nh = h.ok ? h.value : null;
      const ny = y.ok ? y.value : null;
      if (sex && goal && act && nw != null && nh != null && ny != null) {
        Object.assign(answers, targets(sex, ny, nh, nw, act, goal));
      }

      await api('/client/onboarding', { method: 'POST', body: { answers } });

      await api('/client/preferences', {
        method: 'PATCH',
        body: {
          likes: split(likes), dislikes: split(dislikes), excluded: split(excluded),
          allowed_replacements: swaps ? 1 : 0, notes: notes.trim() || null,
        },
      });
      haptic.success();
      setMsg('Сохранено');
      setDraft({});
      await refreshMe();
    } catch (e: any) {
      haptic.error(); setMsg(e?.message ?? 'Не удалось сохранить');
    } finally { setBusy(false); }
  }, [goal, act, sex, weight, height, years,
      likes, dislikes, excluded, swaps, notes, refreshMe]);

  if (!loaded) return <Loading title="Профиль" />;

  const field = (label: string, value: string, onChange: (v: string) => void, hint?: string) => (
    <View style={{ marginBottom: S.md }}>
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={t => { onChange(t); setMsg(null); }}
        placeholder={hint}
        placeholderTextColor={p.text3}
        style={{
          marginTop: S.sm, backgroundColor: p.inset, color: p.text,
          borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 12, fontSize: 15,
        }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Профиль" back />
      <ScrollView contentContainerStyle={{
        paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40,
      }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Animated.View entering={FadeIn.duration(240)}>
          <Card style={{ marginTop: S.md, marginBottom: S.md, alignItems: 'center', paddingVertical: S.xl }}>
            <Pressable onPress={changePhoto} disabled={photoBusy} hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed || photoBusy ? 0.6 : 1 })}>
              {u?.avatar_url ? (
                <Image source={{ uri: mediaUrl(u.avatar_url)! }}
                  style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: p.inset }}
                  contentFit="cover" transition={200} cachePolicy="memory-disk" />
              ) : (
                <View style={{
                  width: 76, height: 76, borderRadius: 38, backgroundColor: p.primarySoft,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="user" size={34} color={p.accent} />
                </View>
              )}
              {/* Значок камеры на краю: без него снимок не выглядит
                  нажимаемым, и смену фото никто не находит. */}
              <View style={{
                position: 'absolute', right: -2, bottom: -2,
                width: 28, height: 28, borderRadius: 14,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.primary, borderWidth: 2, borderColor: p.surface,
              }}>
                {photoBusy
                  ? <ActivityIndicator size="small" color={p.onPrimary} />
                  : <Icon name="camera" size={14} color={p.onPrimary} width={2} />}
              </View>
            </Pressable>
            <Text style={{ ...FONT.h2, color: p.text, marginTop: S.md }}>{u?.name ?? '—'}</Text>
            {u?.email ? <Muted style={{ marginTop: 2 }}>{u.email}</Muted> : null}
            {/* Снять фото тоже можно — в вебе кнопка стоит под аватаром.
                Без неё неудачный снимок остаётся навсегда. */}
            {u?.avatar_url ? (
              <Pressable onPress={dropPhoto} disabled={photoBusy} hitSlop={8}
                style={({ pressed }) => ({ marginTop: S.sm, opacity: pressed ? 0.5 : 1 })}>
                <Text style={{ ...FONT.small, color: p.danger }}>Удалить фото</Text>
              </Pressable>
            ) : (
              <Muted style={{ marginTop: S.sm }}>Добавьте фото профиля</Muted>
            )}
          </Card>
        </Animated.View>

        {/* «Мои данные» — те же пять полей, что в вебе, но их можно
            поправить. Раньше они были только для чтения: ошибся в росте
            при регистрации — и норма калорий считалась по нему до конца
            времён, потому что менять его умеет лишь специалист в карточке
            клиента. Маршрут анкеты принимает ровно эти поля, серверной
            работы не потребовалось. */}
        <Card style={{ padding: 0, marginBottom: S.md }}>
          <View style={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.md }}>
            <Text style={{ fontSize: 15, color: p.text2, marginBottom: S.sm }}>Цель</Text>
            <GoalGrid value={goal} onChange={v => edit('goal', v)} />
          </View>

          <Row label="Пол">
            <Chips items={[['f', 'Женский'], ['m', 'Мужской']]}
              value={sex} onChange={v => edit('sex', v as 'm' | 'f')} />
          </Row>
          {!sex ? (
            <View style={{ paddingHorizontal: S.lg, paddingBottom: 12 }}>
              <Muted>
                Пока пол не указан, приложение показывает женский силуэт воды и
                раздел цикла.
              </Muted>
            </View>
          ) : null}

          {/* Три числа в ряд: порознь каждое занимало бы целую строку, а
              вместе читаются как одна мерка. */}
          <View style={{
            flexDirection: 'row', gap: S.sm,
            paddingHorizontal: S.lg, paddingVertical: 12,
            borderTopWidth: 1, borderTopColor: p.borderSoft,
          }}>
            <Num label="Вес, кг" value={weight} onChange={v => edit('weight', v)} />
            <Num label="Рост, см" value={height} onChange={v => edit('height', v)} />
            <Num label="Возраст" value={years} onChange={v => edit('years', v)} />
          </View>

          {/* Если в карточке лежит значение из старой анкеты («лёгкий»,
              «спортсмен»), показываем и его: иначе выбранного варианта
              не видно вовсе, и человек решит, что поле пустое. */}
          <Row label="Активность">
            <Chips
              items={[...new Set([...ACTS, ...(act ? [act] : [])])]
                .map(k => [k, ACTIVITY[k] ?? k] as [string, string])}
              value={act} onChange={v => edit('act', v)} />
          </Row>
        </Card>

        <Text style={{ ...FONT.h3, color: p.text, marginTop: S.sm, marginBottom: S.md }}>
          Предпочтения
        </Text>
        <Card style={{ marginBottom: S.md }}>
          {field('Люблю', likes, setLikes, 'рыба, авокадо')}
          {field('Не люблю', dislikes, setDislikes, 'грибы')}
          {field('Исключить', excluded, setExcluded, 'лактоза, орехи')}
          {field('Заметка специалисту', notes, setNotes, 'что важно знать')}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: S.md }}>
              <Text style={{ fontSize: 15, color: p.text }}>Разрешать замены блюд</Text>
              <Muted style={{ marginTop: 2 }}>
                Можно поменять блюдо на равное по калорийности.
              </Muted>
            </View>
            <Switch
              value={swaps}
              onValueChange={v => { haptic.select(); setSwaps(v); setMsg(null); }}
              trackColor={{ true: p.primary, false: p.track }}
            />
          </View>
        </Card>

        {msg ? (
          <Text style={{ ...FONT.small, color: p.text2, marginBottom: S.md }}>{msg}</Text>
        ) : null}

        <SysButton label="Сохранить" variant="prominent" disabled={busy} onPress={save} />
      </ScrollView>
    </View>
  );
}


function GoalGrid({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const { p } = useApp();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
      {GOALS.map(label => {
        const on = value === label;
        return (
          <Pressable key={label} onPress={() => { haptic.select(); onChange(label); }}
            accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              width: '48%', minHeight: 54, borderRadius: R.md,
              paddingHorizontal: 12, paddingVertical: 10,
              justifyContent: 'center',
              backgroundColor: on ? p.primarySoft : p.inset,
              borderWidth: 1, borderColor: on ? p.primary : p.border,
              opacity: pressed ? 0.75 : 1,
            })}>
            <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: on ? '700' : '500',
              color: on ? p.accent : p.text2 }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Строка данных: слева название, справа — то, чем его меняют. */
function Row({ label, children, first }: {
  label: string; children: React.ReactNode; first?: boolean;
}) {
  const { p } = useApp();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: S.md,
      paddingVertical: 10, paddingHorizontal: S.lg,
      borderTopWidth: first ? 0 : 1, borderTopColor: p.borderSoft,
    }}>
      <Text style={{ fontSize: 15, color: p.text2 }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

/**
 * Набор вариантов. Переносится на следующую строку, а не прокручивается
 * вбок: «Набор мышечной массы» в ряд с остальными не встаёт ни на одном
 * телефоне, а спрятанный за краем вариант всё равно что отсутствует.
 */
function Chips({ items, value, onChange }: {
  items: [string, string][];
  value: string | null;
  onChange: (v: string) => void;
}) {
  const { p } = useApp();
  return (
    <View style={{
      flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end',
    }}>
      {items.map(([k, l]) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => { haptic.select(); onChange(k); }}
            accessibilityRole="button" accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              paddingHorizontal: 13, paddingVertical: 7, borderRadius: R.pill,
              backgroundColor: on ? p.primarySoft : 'transparent',
              borderWidth: 1, borderColor: on ? p.primary : p.btnLine,
              opacity: pressed && !on ? 0.6 : 1,
            })}>
            <Text style={{
              fontSize: 14, fontWeight: on ? '600' : '400',
              color: on ? p.accent : p.text2,
            }}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Число с подписью — вес, рост, возраст. */
function Num({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const { p } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...FONT.caption, color: p.text3, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={t => onChange(t.replace(/[^\d.,]/g, ''))}
        keyboardType="decimal-pad"
        maxLength={5}
        placeholder="—"
        placeholderTextColor={p.text3}
        style={{
          backgroundColor: p.inset, color: p.text, borderRadius: R.control,
          paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlign: 'center',
        }}
      />
    </View>
  );
}