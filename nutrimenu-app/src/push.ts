/**
 * Push-уведомления приложения.
 *
 * Браузерная версия ходит по протоколу Web Push с ключами VAPID, а
 * приложение — через службу Expo: она выдаёт токен устройства, сервер
 * шлёт уведомления по нему. Обе подписки сервер держит в одной таблице.
 *
 * Важно: удалённые уведомления не работают в Expo Go — Expo убрал их
 * оттуда начиная с SDK 53. Всё это оживает в собранном приложении
 * (development build или TestFlight), где есть свои ключи. Поэтому
 * функции ниже не падают, а честно возвращают причину отказа.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { api } from './api';

export type PushState =
  | { ok: true; token: string }
  | { ok: false; reason: 'expo-go' | 'simulator' | 'denied' | 'no-project' | 'error'; message: string };

/** Живём ли мы внутри Expo Go: там удалённых уведомлений нет. */
export const inExpoGo = isRunningInExpoGo();

/** Идентификатор проекта EAS — без него служба не выдаст токен. */
const projectId =
  (Constants.expoConfig?.extra as any)?.eas?.projectId ??
  (Constants as any).easConfig?.projectId;

/**
 * Уведомление, пришедшее при открытом приложении, показываем так же,
 * как когда оно свёрнуто: иначе оповещение о новом сообщении молча
 * теряется, если человек в этот момент смотрит другой экран.
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Android рисует уведомления по каналу: без него они беззвучные. */
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Напоминания',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#2E7D63',
  });
}

/**
 * Спрашивает разрешение, получает токен и отдаёт его серверу.
 * Вызывать после входа: до него сервер не знает, чей это телефон.
 */
export async function registerPush(ask = true): Promise<PushState> {
  if (inExpoGo) return {
    ok: false, reason: 'expo-go',
    message: 'В Expo Go уведомления не приходят — они заработают в собранном приложении.',
  };
  if (!Device.isDevice) return {
    ok: false, reason: 'simulator',
    message: 'Симулятор уведомления не получает — нужен настоящий телефон.',
  };
  if (!projectId) return {
    ok: false, reason: 'no-project',
    message: 'Не задан projectId проекта EAS — без него служба уведомлений не выдаёт токен.',
  };
  try {
    await ensureChannel();
    const { status: had } = await Notifications.getPermissionsAsync();
    /* Экран состояния спрашивать разрешение не должен: системный запрос
       показывают один раз, и потратить его на открытие списка жалко. */
    const status = had === 'granted'
      ? had
      : ask ? (await Notifications.requestPermissionsAsync()).status : had;
    if (status !== 'granted') return {
      ok: false, reason: 'denied',
      message: 'Уведомления выключены. Включить их можно в настройках телефона.',
    };

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/push/expo', {
      method: 'POST',
      body: { token, device: Platform.OS === 'ios' ? 'iPhone' : 'Android' },
    });
    return { ok: true, token };
  } catch (e: any) {
    return { ok: false, reason: 'error', message: e?.message ?? 'Не удалось включить уведомления' };
  }
}

/** Отписка перед выходом: чужие напоминания на этот телефон приходить не должны. */
export async function unregisterPush() {
  if (inExpoGo || !projectId) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/push/expo', { method: 'DELETE', body: { token } });
  } catch { /* не вышло — сервер сам выбросит токен по DeviceNotRegistered */ }
}
