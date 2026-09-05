import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { hasExpoUI } from '../native';
import { useApp } from '../store';
import { ThemePref, S, FONT } from '../theme';
import { NavBar } from '../ui/NavBar';
import { ListGroup, ListRow, ListHead } from '../ui/List';
import { haptic } from '../haptics';

const THEMES: { key: ThemePref; label: string }[] = [
  { key: 'dark', label: 'Тёмная' },
  { key: 'light', label: 'Светлая' },
  { key: 'auto', label: 'Как в системе' },
];

export default function More() {
  const { p, themePref, setThemePref, me, signOut } = useApp();
  const insets = useSafeAreaInsets();
  const idx = Math.max(0, THEMES.findIndex(t => t.key === themePref));

  const pick = useCallback((i: number) => {
    haptic.select();
    setThemePref(THEMES[i].key);
  }, [setThemePref]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Ещё" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}>

        {/* Разделы — во всю ширину, без полей: список, а не набор карточек */}
        <ListGroup style={{ marginTop: 8 }}>
          <ListRow first icon="weight" label="Прогресс и замеры"
            onPress={() => router.push('/progress')} />
          <ListRow icon="cart" label="Список покупок"
            onPress={() => router.push('/shopping')} />
          <ListRow icon="tag" label="Услуги и цены"
            onPress={() => router.push('/services')} />
        </ListGroup>

        <ListHead>Оформление</ListHead>
        <ListGroup>
          <View style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
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
          </View>
        </ListGroup>

        <ListHead>Аккаунт</ListHead>
        <ListGroup>
          <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14 }}>
            <Text style={{ fontSize: 16, color: p.text }}>{me?.user?.name ?? '—'}</Text>
            <Text style={{ ...FONT.small, color: p.text3, marginTop: 2 }}>
              {me?.user?.email ?? ''}
            </Text>
          </View>
          <ListRow icon="exit" label="Выйти" danger action
            onPress={() => { haptic.warn(); signOut(); }} />
        </ListGroup>
      </ScrollView>
    </View>
  );
}
