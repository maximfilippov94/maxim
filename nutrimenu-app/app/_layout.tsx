import React, { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/store';

/** Экраны, куда пускают без сессии. Всё остальное её требует. */
const OPEN = ['welcome', 'login', 'register'];

function Root() {
  const { p, ready, me } = useApp();
  const segments = useSegments();

  /* Сессии не стало — возвращаем на вход. Одно место на всё приложение:
     выход из «Ещё», просроченный токен и удалённый аккаунт приводят
     к одному и тому же, и каждый экран не должен помнить об этом сам. */
  useEffect(() => {
    if (!ready || me) return;
    const first = segments[0] ?? '';
    if (!OPEN.includes(first)) router.replace('/welcome');
  }, [ready, me, segments]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }
  return (
    <>
      <StatusBar style={p.name === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="client" />
        <Stack.Screen name="sp" />
        <Stack.Screen name="sp-client/[id]" />
        <Stack.Screen name="sp-chat/[id]" />
        <Stack.Screen name="sp-dishes" />
        <Stack.Screen name="sp-notifications" />
        <Stack.Screen name="sp-templates" />
        <Stack.Screen name="sp-analytics" />
        <Stack.Screen name="sp-services" />
        <Stack.Screen name="sp-leads" />
        <Stack.Screen name="register" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="shopping" />
        <Stack.Screen name="services" />
        <Stack.Screen name="water" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="rewards" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="specialist" />
        <Stack.Screen name="dish/[id]" />
        {/* Системная шторка iOS с фиксаторами высоты: тянется пальцем,
            фон остаётся видимым — привычное поведение, а не своё окно. */}
        <Stack.Screen
          name="weight"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.55, 0.9],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="measure"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="checkin"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="sp-menu-new"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="sp-client-new"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="sp-client-edit"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.8, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="sp-profile"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="sp-add-dish"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            gestureEnabled: true,
          }}
        />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppProvider><Root /></AppProvider>
    </SafeAreaProvider>
  );
}
