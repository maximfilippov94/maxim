import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/store';

function Root() {
  const { p, ready } = useApp();
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
        <Stack.Screen name="login" />
        <Stack.Screen name="client" />
        <Stack.Screen name="sp" />
        <Stack.Screen name="sp-client/[id]" />
        <Stack.Screen name="sp-chat/[id]" />
        <Stack.Screen name="sp-dishes" />
        <Stack.Screen name="sp-notifications" />
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
