import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { hasExpoUI, hasSymbols, hasMeshGradient, isExpoGo } from '../native';
import { hasLiquidGlass } from '../ui/Glass';
import { useApp } from '../store';
import { api, readSex } from '../api';
import { AiAccess } from '../ui/TodayBlocks';
import { plural, kg } from '../format';
import { ThemePref, S, R, FONT, LAYOUT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { ListGroup, ListRow, ListHead } from '../ui/List';
import { Face } from '../ui/Face';
import { Icon } from '../ui/Icon';
import { haptic } from '../haptics';
import { openLegal } from '../ui/legal';
import { confirmDeleteAccount } from '../ui/deleteAccount';

const THEMES: { key: ThemePref; label: string }[] = [
  { key: 'dark', label: 'Тёмная' },
  { key: 'light', label: 'Светлая' },
  { key: 'auto', label: 'Как в системе' },
];

export default function More() {
  const { p, themePref, setThemePref, me, signOut, feature } = useApp();
  const hasSpec = !!me?.user?.specialist_id;
  const insets = useSafeAreaInsets();
  const idx = Math.max(0, THEMES.findIndex(t => t.key === themePref));

  /* Срок доступа к EQUA AI — тот же, что на «Сегодня»: приходит в
     `ai_access` ответа `/client/today`. Нет доступа — подписи нет. */
  const [aiLeft, setAiLeft] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ ai_access?: AiAccess | null }>('/client/today')
      .then(r => {
        if (!alive) return;
        const a = r.ai_access;
        if (!a?.has_access) { setAiLeft(null); return; }
        const d = a.days_left ?? 0;
        setAiLeft(d > 0 ? `${d} ${plural(d, ['день', 'дня', 'дней'])}` : 'истекает');
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const pick = useCallback((i: number) => {
    haptic.select();
    setThemePref(THEMES[i].key);
  }, [setThemePref]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar logo />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
        showsVerticalScrollIndicator={false}>

        {/* Разделы — во всю ширину, без полей: список, а не набор карточек.
            Порядок и названия те же, что в вебе: человек, перешедший с
            сайта, ищет пункт глазами там же и теми же словами. */}
        <ProfileCard />

        {/* Строки «Профиль» здесь больше нет: карточка выше ведёт туда же,
            и два входа в одно место подряд — лишний выбор на ровном
            месте. Это расхождение с вебом сделано намеренно: там карточка
            и строка сосуществуют. */}
        <ListGroup style={{ marginTop: 8 }}>
          <ListRow first icon="weight" label="Прогресс и замеры"
            onPress={() => router.push('/progress')} />
          <ListRow icon="heart" label="Моё здоровье"
            onPress={() => router.push('/health')} />
          <ListRow icon="drop" label="Вода"
            onPress={() => router.push('/water')} />
          <ListRow icon="cart" label="Список покупок"
            onPress={() => router.push('/shopping')} />
        </ListGroup>

        {/* Пока специалист не выбран, половина пунктов ведёт в пустоту:
            отзыв не о ком, услуги не у кого. Вместо них — вход в каталог:
            это и есть следующий шаг, а не ещё один пункт среди прочих. */}
        <ListHead>Специалист</ListHead>
        <ListGroup>
          {hasSpec ? (
            <>
              <ListRow first icon="users" label="Мои специалисты"
                onPress={() => router.push('/specialist')} />
              {/* EQUA AI стоит здесь же, вторым — это такой же, кто ведёт
                  план, а не «мотивация». Справа — сколько осталось дней,
                  как в вебе: иначе о сроке узнают, когда он кончится. */}
              <ListRow icon="spark" label="EQUA AI"
                right={aiLeft ? (
                  <Text style={{ ...FONT.small, color: p.text3 }}>{aiLeft}</Text>
                ) : undefined}
                onPress={() => router.push('/ai')} />
              {/* Покупка услуг выключается с сервера: если приём оплаты
                  встал, пункт не должен вести на форму, которая всё
                  равно откажет. */}
              {feature('payments') && (
                <ListRow icon="tag" label="Услуги и цены"
                  onPress={() => router.push('/services')} />
              )}
              <ListRow icon="star" label="Отзыв о специалисте"
                onPress={() => router.push('/review')} />
            </>
          ) : (
            <>
              <ListRow first icon="users"
                label={feature('catalog') ? 'Найти специалиста' : 'Мои специалисты'}
                onPress={() => router.push('/specialist')} />
              <ListRow icon="spark" label="EQUA AI"
                right={aiLeft ? (
                  <Text style={{ ...FONT.small, color: p.text3 }}>{aiLeft}</Text>
                ) : undefined}
                onPress={() => router.push('/ai')} />
            </>
          )}
        </ListGroup>

        <ListHead>Мотивация</ListHead>
        <ListGroup>
          <ListRow first icon="gift" label="Награды и баллы"
            onPress={() => router.push('/rewards')} />
          {feature('feed') && (
            <ListRow icon="heart" label="Лента"
              onPress={() => router.push('/feed')} />
          )}
          <ListRow icon="edit" label="Отчёт за неделю"
            onPress={() => router.push('/checkin')} />
        </ListGroup>

        <ListHead>Настройки</ListHead>
        <ListGroup>
          <ListRow first icon="bell" label="История уведомлений"
            onPress={() => router.push('/notifications')} />
          <ListRow icon="device" label="Уведомления и тихие часы"
            onPress={() => router.push('/push-prefs')} />
          <View style={{
            paddingHorizontal: 18, paddingVertical: 14,
            borderTopWidth: 1, borderTopColor: p.borderSoft,
          }}>
            <Text style={{ ...FONT.small, fontWeight: '600', color: p.text2, marginBottom: 10 }}>
              Оформление
            </Text>
            {/* Системный сегментированный переключатель: на iOS это настоящий
                UISegmentedControl, на Android — Material. Своя реализация
                всегда выдаёт себя мелочами анимации, поэтому она только
                запасная — там, где нативных компонентов нет (Expo Go). */}
            {hasExpoUI ? (
              <SegmentedControl
                values={THEMES.map(t => t.label)}
                selectedIndex={idx}
                onValueChange={(v) => pick(THEMES.findIndex(t => t.label === v))}
                tintColor={p.primary}
                appearance={p.name === 'light' ? 'light' : 'dark'}
                style={{ height: 40 }}
              />
            ) : (
              <View style={{
                flexDirection: 'row', height: 40, borderRadius: 10,
                backgroundColor: p.inset, padding: 3,
              }}>
                {THEMES.map((t, i) => (
                  <Pressable key={t.key} onPress={() => pick(i)}
                    style={({ pressed }) => ({
                      flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: i === idx ? p.primary : 'transparent',
                      opacity: pressed && i !== idx ? 0.6 : 1,
                    })}>
                    <Text numberOfLines={1} style={{
                      fontSize: 13, fontWeight: i === idx ? '600' : '400',
                      color: i === idx ? p.onPrimary : p.text2,
                    }}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={{ ...FONT.small, color: p.text3, marginTop: 12 }}>
              Настройка запоминается на этом устройстве.
            </Text>
            {/* Expo Go содержит не весь SDK, и какой эффект подменён запасным
                вариантом, со стороны не видно. Строка нужна на время тестов
                и показывается только в Expo Go — в своей сборке её нет. */}
            {isExpoGo ? (
              <Text style={{ ...FONT.small, color: p.text3, marginTop: 6 }}>
                Expo Go · стекло {hasLiquidGlass ? 'системное' : 'размытие'}
                {' · '}символы {hasSymbols ? 'системные' : 'свои'}
                {' · '}градиент {hasMeshGradient ? 'сетчатый' : 'линейный'}
                {' · '}компоненты {hasExpoUI ? 'системные' : 'свои'}
              </Text>
            ) : null}
          </View>
        </ListGroup>

        <ListHead>Поддержка</ListHead>
        <ListGroup>
          {/* Про сервис — сюда, про питание — специалисту в чат.
              Разные разговоры и разные читатели. */}
          <ListRow first icon="spark" label="EQUA info"
            onPress={() => router.push('/info')} />
          <ListRow icon="chat" label="Написать в поддержку"
            onPress={() => router.push('/support')} />
        </ListGroup>

        <ListHead>Документы</ListHead>
        <ListGroup>
          <ListRow icon="tag" label="Пользовательское соглашение"
            onPress={() => { haptic.tap(); openLegal('terms'); }} />
          <ListRow icon="tag" label="Политика конфиденциальности"
            onPress={() => { haptic.tap(); openLegal('privacy'); }} />
        </ListGroup>

        <ListHead>Аккаунт</ListHead>
        <ListGroup>
          <ListRow first icon="exit" label="Выйти" danger action
            onPress={() => { haptic.warn(); signOut(); }} />
          {/* Удаление аккаунта — здесь же, а не письмом в поддержку:
              человек должен уйти сам, без чужого посредничества. */}
          <ListRow icon="close" label="Удалить аккаунт" danger action
            onPress={() => {
              haptic.warn();
              confirmDeleteAccount('client',
                () => signOut(),
                m => Alert.alert('Не получилось', m));
            }} />
        </ListGroup>
      </ScrollView>
    </View>
  );
}


/**
 * Карточка владельца профиля над списком разделов.
 *
 * В вебе она есть (`more-profile-card`), в приложении список начинался
 * сразу со строки «Профиль» — экран «Ещё» открывался безымянным.
 *
 * Подпись от веба отличается осознанно: там под именем стоит «Клиент»,
 * потому что тот же код обслуживает и специалиста, а полей тарифа
 * сервер не отдаёт вовсе. Сообщать человеку в его собственном
 * приложении, что он клиент, незачем — показываем то, от чего зависят
 * расчёты: возраст, рост и вес. Все три приходят тем же ответом `/me`,
 * что имя и фото, поэтому с цифрами на «Сегодня» они не разойдутся.
 *
 * Пол в строку не ставим: рядом с цифрами он ничего не добавляет. Зато
 * когда он не указан, об этом сказано прямо — от него зависят силуэт на
 * «Воде» и раздел цикла, а поправить можно тут же, в профиле.
 */
function ProfileCard() {
  const { p, me } = useApp();
  const u = me?.user;
  if (!u) return null;

  const years = u.birth_year ? new Date().getFullYear() - u.birth_year : null;
  const facts = [
    years ? `${years} ${plural(years, ['год', 'года', 'лет'])}` : null,
    u.height_cm ? `${u.height_cm} см` : null,
    u.weight_kg ? `${kg(u.weight_kg)} кг` : null,
  ].filter(Boolean).join(' · ');

  const noSex = !readSex(u.sex);
  /* Нечего показать — зовём заполнить, а не оставляем пустое место. */
  const sub = facts || 'Заполнить профиль';

  return (
    /* В отличие от разделов ниже карточка — не строка списка, а предмет:
       скруглённое полотно в общем боковом поле (20 — единственное на всё
       приложение). Подсветку нажатия кладём внутрь, поверх полотна: если
       красить фон целиком, сквозь полупрозрачную подсветку проступает
       цвет страницы, и карточка моргает. */
    <View style={{
      marginTop: 12, marginBottom: 8,
      marginHorizontal: LAYOUT.screenPad,
      backgroundColor: p.surface, borderRadius: R.lg, overflow: 'hidden',
    }}>
      <Pressable onPress={() => { haptic.tap(); router.push('/profile'); }}>
      {({ pressed }) => (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 14,
          paddingHorizontal: 16, paddingVertical: 16,
          backgroundColor: pressed ? p.ov1 : 'transparent',
        }}>
          <Face url={u.avatar_url} name={u.name} size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '600', color: p.text }}>
              {u.name || 'Профиль'}
            </Text>
            <Text numberOfLines={1} style={{ ...FONT.small, color: p.text3, marginTop: 3 }}>
              {sub}
            </Text>
            {noSex ? (
              <Text numberOfLines={1} style={{ ...FONT.small, color: p.warn, marginTop: 2 }}>
                Пол не указан
              </Text>
            ) : null}
          </View>
          <Icon name="chevr" size={15} color={p.text3} width={2} />
        </View>
      )}
      </Pressable>
    </View>
  );
}