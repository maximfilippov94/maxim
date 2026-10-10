import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Expo Go — это готовое приложение из App Store, и в него вшит не весь
 * SDK. Отсутствующий нативный модуль не бросает исключение: React Native
 * рисует на его месте красную заглушку «Unimplemented component», то есть
 * ломается экран целиком. Поэтому спрашиваем заранее и подставляем запасной
 * вариант. В собственной сборке все модули на месте и работают штатно.
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const has = (moduleName: string) => {
  if (Platform.OS === 'web') return false;
  try {
    return requireOptionalNativeModule(moduleName) != null;
  } catch {
    return false;
  }
};

/** SF Symbols. Без них рисуем свои контуры. */
export const hasSymbols = has('SymbolModule');

/**
 * Нативные системные компоненты @expo/ui. В вебе у пакета есть
 * собственная реализация, а нативного модуля нет — опрос дал бы там
 * ложное «нет», поэтому веб отвечаем отдельно.
 */
export const hasExpoUI = Platform.OS === 'web' ? true : has('ExpoUI');

/**
 * Сетчатый градиент. Отдельного модуля у него нет — спросить нечего,
 * а в Expo Go он проверенно отсутствует, поэтому судим по окружению.
 */
export const hasMeshGradient = Platform.OS !== 'web' && !isExpoGo;
