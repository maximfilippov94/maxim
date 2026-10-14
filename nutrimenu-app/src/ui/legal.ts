/**
 * Документы сервиса. Открываем во встроенном браузере: их читают редко и
 * один раз, отдельный экран под текст в приложении держать незачем, а
 * ссылки должны быть теми же, что указаны в App Store.
 */
import * as WebBrowser from 'expo-web-browser';
import { API_BASE } from '../api';

export const LEGAL = {
  terms: { url: API_BASE + '/terms', title: 'Пользовательское соглашение' },
  privacy: { url: API_BASE + '/privacy', title: 'Политика конфиденциальности' },
} as const;

export function openLegal(doc: keyof typeof LEGAL) {
  return WebBrowser.openBrowserAsync(LEGAL[doc].url).catch(() => {});
}
