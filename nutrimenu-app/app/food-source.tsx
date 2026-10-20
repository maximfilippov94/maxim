import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../src/store';
import { FOOD_MEALS, FoodMeal } from '../src/api';
import { S, R, FONT } from '../src/theme';
import { NavBar } from '../src/ui/NavBar';
import { Card, Muted } from '../src/ui/base';
import { Icon } from '../src/ui/Icon';
import { haptic } from '../src/haptics';

export default function FoodSource() {
  const { p } = useApp();
  const insets = useSafeAreaInsets();
  const { meal: rawMeal } = useLocalSearchParams<{ meal?: string }>();
  const meal = (FOOD_MEALS.find(([key]) => key === rawMeal)?.[0] ?? 'snack2') as FoodMeal;

  const open = (path: string) => { haptic.tap(); router.push(`${path}?meal=${meal}` as any); };
  const Choice = ({ icon, title, subtitle, onPress }: {
    icon: string; title: string; subtitle: string; onPress: () => void;
  }) => (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md,
          paddingVertical: S.lg, opacity: pressed ? 0.75 : 1 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.primarySoft,
            alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={20} color={p.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...FONT.h2, color: p.text }}>{title}</Text>
            <Muted style={{ marginTop: 3 }}>{subtitle}</Muted>
          </View>
          <Icon name="chevr" size={15} color={p.text3} />
        </Card>
      )}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavBar title="Добавить еду" back />
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + 32, gap: S.md }}>
        <Muted>Выберите, откуда добавить запись в дневник.</Muted>
        <Choice icon="bowl" title="Каталог блюд"
          subtitle="Готовые блюда и рецепты EQUA с рассчитанным КБЖУ"
          onPress={() => open('/dish-catalog')} />
        <Choice icon="search" title="Продукты и сканер"
          subtitle="Поиск продукта, сканирование штрихкода или ручное добавление"
          onPress={() => open('/food-log')} />
      </ScrollView>
    </View>
  );
}
