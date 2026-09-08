import React, { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AppProvider, useApp } from '../src/store';
import { setupNotificationHandler } from '../src/push';

/* Пока приложение открыто, уведомление всё равно показываем баннером:
   иначе новое сообщение теряется, если человек смотрит другой экран. */
setupNotificationHandler();

/** Экраны, куда пускают без сессии. Всё остальное её требует. */
const OPEN = ['welcome', 'login', 'register', 'forgot'];

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

  /* Нажали на уведомление — открываем тот экран, о котором оно.
     Сервер кладёт адрес в data.screen; без сессии никуда не ведём:
     охранник выше всё равно вернёт на вход. */
  useEffect(() => {
    if (!ready || !me) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const screen = (r?.notification?.request?.content?.data as any)?.screen;
      if (typeof screen === 'string' && screen.startsWith('/')) router.push(screen as any);
    };
    /* Приложение было закрыто и его подняли нажатием на уведомление */
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [ready, me]);

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
        <Stack.Screen name="sp-dish-edit" />
        <Stack.Screen name="sp-menu-item" />
        <Stack.Screen name="sp-notifications" />
        <Stack.Screen name="sp-templates" />
        <Stack.Screen name="sp-analytics" />
        <Stack.Screen name="sp-services" />
        <Stack.Screen name="sp-leads" />
        <Stack.Screen name="sp-verification" />
        <Stack.Screen name="sp-reviews" />
        <Stack.Screen name="sp-rewards" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="shopping" />
        <Stack.Screen name="services" />
        <Stack.Screen name="water" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="rewards" />
        <Stack.Screen name="feed" />
        <Stack.Screen name="health" />
        <Stack.Screen name="review" />
        <Stack.Screen name="sp-health" />
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
