/**
 * Клиент к существующему бэкенду NutriMenu. Ни один эндпоинт не меняется —
 * приложение говорит с тем же /api/v1, что и веб-версия.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Адрес сервера. На проде — боевой домен, при разработке подменяется. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? 'https://nutrimenu.ru.swtest.ru';

let token: string | null = null;

export async function loadToken() {
  token = await AsyncStorage.getItem('nm_token');
  return token;
}
export async function setToken(t: string | null) {
  token = t;
  if (t) await AsyncStorage.setItem('nm_token', t);
  else await AsyncStorage.removeItem('nm_token');
}
export function getToken() {
  return token;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(
  path: string,
  opt: { method?: string; body?: any } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (opt.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opt.body);
  }
  if (token) headers.Authorization = 'Bearer ' + token;

  let res: Response;
  try {
    res = await fetch(API_BASE + '/api/v1' + path, {
      method: opt.method ?? 'GET',
      headers,
      body,
    });
  } catch {
    /* Обрыв связи и ошибка сервера — разные вещи: на первом показываем
       «нет сети», на втором сообщение с сервера. */
    throw new ApiError('Нет связи с сервером. Проверьте интернет.', 0);
  }

  let json: any = {};
  try {
    json = await res.json();
  } catch {
    /* пустое тело — оставляем {} */
  }
  if (!res.ok) throw new ApiError(json?.error ?? 'Ошибка сервера', res.status);
  return json as T;
}

/* ---------- Типы ответов, которые уже отдаёт бэкенд ---------- */

export interface Totals { kcal: number; protein: number; fat: number; carbs: number }
export interface MealItem {
  id: number;
  dish_id: number;
  dish_name: string;
  meal_type: string;
  portion_g: number;
  photo_url?: string | null;
  log_status?: string | null;
  nutrition: Totals;
}
export interface TodayResponse {
  menu: { id: number; title: string; target_kcal?: number } | null;
  items: MealItem[];
  totals: Totals;
  weight?: { last: number; delta: number } | null;
}
export interface Me {
  user: {
    id: number; name: string; email?: string;
    specialist_id?: number | null;
    target_kcal?: number; target_protein?: number; target_fat?: number; target_carbs?: number;
    weight_kg?: number; goal?: string; avatar_url?: string | null;
  };
  user_type: 'client' | 'specialist' | 'admin';
}

export const MEAL_TITLES: Record<string, string> = {
  breakfast: 'Завтрак', snack1: 'Перекус', lunch: 'Обед',
  snack2: 'Перекус', dinner: 'Ужин',
};
export const MEAL_ORDER = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];
export const MEAL_TIME: Record<string, string> = {
  breakfast: '08:30', snack1: '11:00', lunch: '14:00', snack2: '16:30', dinner: '19:00',
};

/* ---------- Разделы из «Ещё» ---------- */

export interface ShoppingItem {
  key: string; name: string; category: string; grams: number; checked: number;
}
export interface ShoppingResponse {
  menu: { id: number; title: string; days_count: number } | null;
  days: number;
  items: ShoppingItem[];
}

export interface WeightLog { id: number; weight_kg: number; measured_on: string }
export interface Measurement {
  id: number; measured_on: string;
  waist_cm?: number | null; hips_cm?: number | null; chest_cm?: number | null;
  note?: string | null;
}
export interface ProgressResponse {
  weights: WeightLog[];
  eaten_count: number;
  measurements: Measurement[];
  photos: { id: number; photo_url: string; measured_on: string }[];
}

export interface Service {
  id: number; title: string; description?: string | null;
  kind: string; price_kop: number; period_days?: number | null; is_active: number;
}
export interface ServicesResponse {
  specialist: { id: number; name: string; avatar_url?: string | null } | null;
  services: Service[];
  payments_enabled: boolean;
  note?: string | null;
}
