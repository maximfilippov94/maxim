import { Platform } from 'react-native';
import * as H from 'expo-haptics';

/**
 * Отклик в пальцах. Смысловые названия, а не «лёгкий/средний/сильный»:
 * так на месте вызова видно, ЧТО произошло, и одинаковые события во всём
 * приложении ощущаются одинаково.
 * На вебе и там, где мотор недоступен, тихо ничего не делаем.
 */
const off = Platform.OS === 'web';
const run = (f: () => Promise<void>) => { if (!off) f().catch(() => {}); };

export const haptic = {
  /** Нажатие на кнопку, переключение вкладки */
  tap: () => run(() => H.impactAsync(H.ImpactFeedbackStyle.Light)),
  /** Отметка сделана, элемент выбран */
  select: () => run(() => H.selectionAsync()),
  /** Действие завершилось успехом: сохранили вес, отметили всё меню */
  success: () => run(() => H.notificationAsync(H.NotificationFeedbackType.Success)),
  /** Что-то не вышло: сеть отвалилась, сервер отказал */
  error: () => run(() => H.notificationAsync(H.NotificationFeedbackType.Error)),
  /** Предупреждение: перебор по калориям, отмена */
  warn: () => run(() => H.notificationAsync(H.NotificationFeedbackType.Warning)),
  /** Что-то важное произошло: звонок принят, цель достигнута */
  heavy: () => run(() => H.impactAsync(H.ImpactFeedbackStyle.Heavy)),
};
