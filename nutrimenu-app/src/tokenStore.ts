/**
 * Хранилище токена сессии.
 *
 * На устройстве токен лежит в SecureStore — это Keychain на iOS и
 * EncryptedSharedPreferences на Android. В вебе такого хранилища нет, там
 * остаётся AsyncStorage: прятать там нечего, браузерная вкладка и так
 * доступна только своему происхождению.
 *
 * Токены прежних сборок лежали в AsyncStorage на всех платформах. Чтобы
 * человек не оказался разлогинен после обновления, при первом чтении
 * старое значение переносится в SecureStore и стирается из открытого
 * хранилища.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'nm_token';
const secure = Platform.OS !== 'web';

export async function readToken(): Promise<string | null> {
  if (!secure) return AsyncStorage.getItem(KEY);
  try {
    const v = await SecureStore.getItemAsync(KEY);
    if (v) return v;
  } catch {
    /* Keychain может быть недоступен до разблокировки устройства. */
  }
  /* Перенос со старой сборки: забираем из открытого хранилища и прячем. */
  const legacy = await AsyncStorage.getItem(KEY);
  if (legacy) {
    try {
      await SecureStore.setItemAsync(KEY, legacy);
      await AsyncStorage.removeItem(KEY);
    } catch {
      /* Не вышло перенести — работаем с тем, что есть. */
    }
  }
  return legacy;
}

export async function writeToken(v: string | null): Promise<void> {
  if (!secure) {
    if (v) await AsyncStorage.setItem(KEY, v);
    else await AsyncStorage.removeItem(KEY);
    return;
  }
  try {
    if (v) await SecureStore.setItemAsync(KEY, v);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* Если Keychain недоступен, не теряем сессию совсем. */
    if (v) await AsyncStorage.setItem(KEY, v);
    else await AsyncStorage.removeItem(KEY);
  }
}
