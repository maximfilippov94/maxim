import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { hasExpoUI } from '../../native';
import { useApp } from '../../store';
import { api, SpProfile, PROFESSION } from '../../api';
import { ThemePref, S, FONT } from '../../theme';
import { NavBar } from '../../ui/NavBar';
import { ListGroup, ListRow, ListHead } from '../../ui/List';
import { Face } from '../../ui/Face';
import { haptic } from '../../haptics';
import { openLegal } from '../../ui/legal';
import { confirmDeleteAccount } from '../../ui/deleteAccount';

const VERIFY_LABEL: Record<string, string> = {
  none: 'не пройдена', pending: 'на проверке',
  verified: 'пройдена', rejected: 'отказано',
};

const THEMES: { key: ThemePref; label: string }[] = [
  { key: 'dark', label: 'Тёмная' },
  { key: 'light', label: 'Светлая' },
  { key: 'auto', label: 'Как в системе' },
];

export default function SpMore() {
  const { p, themePref, setThemePref, me, signOut } = useApp();
  const insets = useSafeAreaInsets();
  const [pr, setPr] = useState<SpProfile | null>(null);
  const idx = Math.max(0, THEMES.findIndex(t => t.key === themePref));

  useEffect(() => {
    api<{ profile: SpProfile }>('/specialist/profile')
      .then(r => setPr(r.profile)).catch(() => {});
  }, []);

  const pick = useCallback((i: number) => {
    haptic.select(); setThemePref(THEMES[i].key);
  }, [setThemePref]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar logo />
      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
        showsVerticalScrollIndicator={false}>

        <ListGroup style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
            paddingHorizontal: 18, paddingVertical: 14 }}>
            <Face url={pr?.avatar_url ?? me?.user?.avatar_url} name={pr?.name ?? me?.user?.name ?? 'С'} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: p.text }}>
                {pr?.name ?? me?.user?.name ?? '—'}
              </Text>
              <Text style={{ ...FONT.small, color: p.text3, marginTop: 2 }}>
                {PROFESSION[pr?.profession ?? 'nutritionist'] ?? 'Специалист'}
                {pr?.email ? ` · ${pr.email}` : ''}
              </Text>
            </View>
          </View>
        </ListGroup>

        {/* Код приглашения — то, чем специалист заводит клиента: он вводит
            его в своём приложении и попадает под ведение. */}
        {pr?.join_code ? (
          <>
            <ListHead>Приглашение</ListHead>
            <ListGroup>
              <ListRow first icon="tag" label="Код для клиента" value={pr.join_code} action />
              <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
                <Text style={{ ...FONT.small, color: p.text3, lineHeight: 17 }}>
                  Клиент вводит его при регистрации или в разделе «Мой специалист».
                </Text>
              </View>
            </ListGroup>
          </>
        ) : null}

        {/* Клиент не может сам проверить диплом — проверку берёт на себя
            сервис. Отметку видно в каталоге, поэтому строка стоит рядом
            с профилем, а не в глубине настроек. */}
        <ListHead>Доверие</ListHead>
        <ListGroup>
          <ListRow first icon="shield" label="Верификация"
            value={VERIFY_LABEL[pr?.verify_status ?? 'none']}
            onPress={() => router.push('/sp-verification')} />
          <ListRow icon="star" label="Отзывы"
            onPress={() => router.push('/sp-reviews')} />
        </ListGroup>

        <ListHead>Работа</ListHead>
        <ListGroup>
          <ListRow first icon="bowl" label="База блюд"
            onPress={() => router.push('/sp-dishes')} />
          <ListRow icon="edit" label="Шаблоны меню"
            onPress={() => router.push('/sp-templates')} />
          <ListRow icon="trend" label="Аналитика"
            onPress={() => router.push('/sp-analytics')} />
          <ListRow icon="tag" label="Услуги и цены"
            onPress={() => router.push('/sp-services')} />
          <ListRow icon="gift" label="Привилегии за баллы"
            onPress={() => router.push('/sp-rewards')} />
        </ListGroup>

        <ListHead>Входящее</ListHead>
        <ListGroup>
          <ListRow first icon="gift" label="Заявки из каталога"
            onPress={() => router.push('/sp-leads')} />
          <ListRow icon="heart" label="Лента"
            onPress={() => router.push('/feed')} />
          <ListRow icon="bell" label="Уведомления"
            onPress={() => router.push('/sp-notifications')} />
          <ListRow icon="chat" label="Поддержка"
            onPress={() => router.push('/support')} />
        </ListGroup>

        <ListHead>Оформление</ListHead>
        <ListGroup>
          <View style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
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
              <View style={{ flexDirection: 'row', height: 40, borderRadius: 10,
                backgroundColor: p.inset, padding: 3 }}>
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
          </View>
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
          <ListRow first icon="user" label="Профиль и фото"
            onPress={() => router.push('/sp-profile')} />
          <ListRow icon="exit" label="Выйти" danger action
            onPress={() => { haptic.warn(); signOut(); }} />
          {/* Удаление аккаунта — здесь же, а не письмом в поддержку:
              человек должен уйти сам, без чужого посредничества. */}
          <ListRow icon="close" label="Удалить аккаунт" danger action
            onPress={() => {
              haptic.warn();
              confirmDeleteAccount('specialist',
                () => signOut(),
                m => Alert.alert('Не получилось', m));
            }} />
        </ListGroup>

        <Text style={{ ...FONT.small, color: p.text3, paddingHorizontal: 18,
          paddingTop: 16, lineHeight: 17 }}>
          Редактирование карточек блюд и лента постов пока остаются в браузере.
        </Text>
      </ScrollView>
    </View>
  );
}
