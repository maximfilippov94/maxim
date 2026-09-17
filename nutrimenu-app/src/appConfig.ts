/**
 * Что сервер говорит приложению при запуске.
 *
 * Магазин проверяет новую сборку неделю, иногда дольше. Всё, что нельзя
 * ждать неделю, приходит с сервера: объявление людям, требование
 * обновиться, если в старой версии нашлась настоящая поломка, и
 * выключатели возможностей — чтобы не выпускать сборку ради одной
 * кнопки.
 *
 * Сервер недоступен — работаем как раньше: ни одна возможность не
 * исчезает из-за плохой связи, и никого не запирает экран обновления.
 */
import Constants from 'expo-constants';
import { api } from './api';

export type Announce = { text: string; kind: 'info' | 'warn'; id: string };

export interface AppConfig {
  min_version: string;
  store_url: string;
  announce: Announce | null;
  features: Record<string, boolean>;
  update_required: boolean;
}

/** Всё включено, никого не блокируем — состояние по умолчанию. */
export const DEFAULT_CONFIG: AppConfig = {
  min_version: '', store_url: '', announce: null,
  features: {}, update_required: false,
};

export const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';

export async function fetchAppConfig(): Promise<AppConfig> {
  try {
    const r = await api<Partial<AppConfig>>(
      '/public/config?v=' + encodeURIComponent(APP_VERSION));
    return { ...DEFAULT_CONFIG, ...r, features: r.features ?? {} };
  } catch {
    return DEFAULT_CONFIG;   /* нет связи — ничего не прячем и не блокируем */
  }
}

/** Возможность выключена только если сервер прямо сказал «нет». */
export function featureOn(cfg: AppConfig, key: string): boolean {
  return cfg.features[key] !== false;
}
