/**
 * Клиент к существующему бэкенду EQUA. Ни один эндпоинт не меняется —
 * приложение говорит с тем же /api/v1, что и веб-версия.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Адрес сервера. На проде — боевой домен, при разработке подменяется. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? 'https://nutrimenu.ru';

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

/** Сколько ждём ответа, прежде чем считать соединение зависшим. */
const TIMEOUT_MS = 12000;
/** Паузы перед повторами. Две попытки сверх первой — дальше только злим. */
const BACKOFF = [400, 1400];
/* Общий потолок: три зависших попытки подряд — это полминуты перед
   пустым экраном, а человек к тому времени уже решил, что сломалось.
   Лучше сказать «нет связи» раньше, чем упрямо ждать. */
const BUDGET_MS = 25000;

/* Метод можно повторять, если повтор не создаёт ничего нового.
   POST создаёт: отправленное сообщение или пост, дошедшие до сервера
   в момент обрыва, вторая попытка продублировала бы. */
const REPEATABLE = ['GET', 'HEAD', 'PUT', 'DELETE'];

/* Коды, за которыми стоит не отказ, а «сейчас не могу»: перезапуск
   PHP-FPM, перегрузка, короткая просадка канала. */
const RETRY_STATUS = [429, 502, 503, 504];

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function api<T = any>(
  path: string,
  opt: { method?: string; body?: any; retry?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: string | FormData | undefined;
  if (opt.body instanceof FormData) {
    /* Границу multipart проставляет сам fetch — свой Content-Type тут
       ломает разбор файла на сервере. */
    body = opt.body;
  } else if (opt.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opt.body);
  }
  if (token) headers.Authorization = 'Bearer ' + token;

  const method = (opt.method ?? 'GET').toUpperCase();
  /* Повторяем сами только безопасное. Вызывающий может разрешить
     повтор явно — там, где знает, что второй такой же запрос ничего
     не испортит. */
  const mayRetry = opt.retry ?? REPEATABLE.includes(method);
  const tries = mayRetry ? BACKOFF.length + 1 : 1;

  const started = Date.now();
  /* Повторять есть смысл, только если на попытку ещё осталось время. */
  const timeLeft = () => Date.now() - started < BUDGET_MS - TIMEOUT_MS;

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    /* Без таймаута зависшее соединение держит экран в загрузке до
       бесконечности: телефон в лифте не рвёт сокет, а просто молчит. */
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      res = await fetch(API_BASE + '/api/v1' + path, {
        method, headers, body, signal: abort.signal,
      });
    } catch {
      if (attempt < tries - 1 && timeLeft()) { await wait(BACKOFF[attempt]); continue; }
      /* Обрыв связи и ошибка сервера — разные вещи: на первом показываем
         «нет сети», на втором сообщение с сервера. */
      throw new ApiError('Нет связи с сервером. Проверьте интернет.', 0);
    } finally {
      clearTimeout(timer);
    }

    if (RETRY_STATUS.includes(res.status) && attempt < tries - 1 && timeLeft()) {
      await wait(BACKOFF[attempt]);
      continue;
    }

    let json: any = {};
    try {
      json = await res.json();
    } catch {
      /* пустое тело — оставляем {} */
    }
    if (!res.ok) {
      /* «Сервер занят» отличаем от настоящей ошибки: первое стоит
         просто повторить рукой, второе — повод разбираться. */
      const busy = RETRY_STATUS.includes(res.status)
        ? 'Сервер сейчас не отвечает. Попробуйте ещё раз через минуту.'
        : null;
      throw new ApiError(json?.error ?? busy ?? 'Ошибка сервера', res.status);
    }
    return json as T;
  }
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
  /** Съедено: только отмеченные приёмы */
  totals: Totals;
  /** Весь день по плану — столько будет, если съесть всё назначенное */
  plan_totals?: Totals;
  weight?: { last: number; delta: number } | null;
  water?: { ml: number; goal_ml: number } | null;
}
export interface Me {
  user: {
    id: number; name: string; email?: string;
    specialist_id?: number | null;
    target_kcal?: number; target_protein?: number; target_fat?: number; target_carbs?: number;
    weight_kg?: number; goal?: string; avatar_url?: string | null;
    sex?: string | null; water_goal_ml?: number | null;
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

/* Фильтр по приёмам. Оба перекуса — одна кнопка: для выбора блюда
   разница между «перекусом до обеда» и «после» не значит ничего, а две
   одинаковые надписи рядом сбивают с толку. */
export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_KEYS: [MealKey, string][] = [
  ['breakfast', 'Завтрак'], ['lunch', 'Обед'],
  ['dinner', 'Ужин'], ['snack', 'Перекус'],
];
/** Ключ фильтра для типа приёма из меню: snack1 и snack2 — один «Перекус». */
export const mealKeyOf = (t: string): MealKey =>
  (t === 'snack1' || t === 'snack2' ? 'snack' : t as MealKey);

/** Приёмы, для которых заведено блюдо. Поле хранится строкой JSON. */
export function dishMeals(d: Pick<Dish, 'meal_types'>): MealKey[] {
  if (!d.meal_types) return [];
  try {
    const a = JSON.parse(d.meal_types);
    if (!Array.isArray(a)) return [];
    const keys = a.map((t: string) => mealKeyOf(String(t)));
    return MEAL_KEYS.map(([k]) => k).filter(k => keys.includes(k));
  } catch { return []; }
}

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

/* ---------- Питьевой режим ---------- */

export interface WaterDay { logged_on: string; ml: number }
export interface WaterResponse {
  goal_ml: number;
  today_ml: number;
  history: WaterDay[];
}

/* ---------- Неделя и чат ---------- */

export interface WeekResponse {
  menu: { id: number; title: string; days_count: number; start_date: string } | null;
  items: (MealItem & { day_number: number })[];
  days: Record<string, Totals>;
}

export interface ChatMessage {
  id: number;
  author_type: 'client' | 'specialist';
  body: string;
  attachment_url?: string | null;
  kind?: string | null;
  created_at: string;
}
export interface ChatResponse { messages: ChatMessage[] }

/* ---------- Блюдо ---------- */

export interface DishIngredient {
  ingredient_name: string;
  grams: number;
  kcal: number; protein: number; fat: number; carbs: number;
}
export interface DishItem extends MealItem {
  instructions?: string | null;
  /** Порция блюда по умолчанию: от неё сервер считает границы своей граммовки */
  base_portion_g?: number | null;
  ingredients: DishIngredient[];
}
export interface Replacement {
  id: number; name: string; photo_url?: string | null;
  kcal_100: number; protein_100: number; fat_100: number; carbs_100: number;
  base_portion_g?: number | null;
}

/* ---------- Награды и баллы ---------- */

export interface GamTask { key: string; label: string; reward: number; done: boolean; progress: string }
export interface GamAchievement { key: string; icon: string; label: string; hint: string; unlocked: boolean }
export interface GamReward { key: string; label: string; cost: number; discount_pct: number }
export interface GamRedemption {
  reward_key: string; discount_pct: number; points_cost: number;
  code: string; status: string; created_at: string;
}
export interface GamWeekDay { label: string; date: string; pct: number | null; logged: number }
export interface Gamification {
  balance: number; earned: number; spent: number;
  streak: number; eaten: number; perfect_days: number;
  level: number; level_title: string; level_base: number; level_next: number;
  tasks: GamTask[];
  achievements: GamAchievement[];
  rewards: GamReward[];
  redemptions: GamRedemption[];
  week: GamWeekDay[];
}

/* ---------- Профиль, уведомления, специалист ---------- */

export interface Preferences {
  likes?: string; dislikes?: string; excluded?: string;
  allowed_replacements?: number; notes?: string | null;
}
export interface Notice {
  id: number; type: string; title: string;
  body?: string | null; read_at?: string | null; created_at: string;
  /** В кабинете специалиста уведомления приходят по разным клиентам */
  client_name?: string | null;
}
export interface Specialist {
  id: number; name: string; avatar_url?: string | null; profession?: string;
  /** 1 — EQUA проверила диплом и сертификаты специалиста */
  verified?: number;
}
export interface Checkin {
  week_start: string; ease_score: number; wellbeing_score?: number | null;
  difficulties?: string | null; comment?: string | null; created_at: string;
}

/** Списки предпочтений приходят строкой JSON — разбираем в одном месте. */
export const parseList = (v?: string | null): string[] => {
  if (!v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a.map(String) : []; }
  catch { return []; }
};

/* ---------- Каталог специалистов ---------- */

export interface CatalogSpecialist {
  id: number; name: string; avatar_url?: string | null;
  profession?: string; bio?: string | null; city?: string | null;
  rating?: number | null; reviews_count?: number | null;
  price?: number | null; price_unit?: string | null;
  experience_years?: number | null;
  specializations?: string | null;
  verified?: number;
}

/* ---------- Верификация специалиста ----------
   Диплом клиент проверить не может, поэтому проверку берёт на себя
   сервис: специалист прикладывает документы, владелец их сверяет. */

export type DocKind = 'diploma' | 'course' | 'certificate' | 'license';
export const DOC_KINDS: Record<DocKind, string> = {
  diploma: 'Диплом', course: 'Курс', certificate: 'Сертификат', license: 'Лицензия',
};
export interface SpecDoc {
  id: number; kind: DocKind; title: string;
  issuer?: string | null; issued_on?: string | null; file_url?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note?: string | null; reviewed_at?: string | null; created_at: string;
}
export interface Verification {
  status: 'none' | 'pending' | 'verified' | 'rejected';
  note?: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  documents: SpecDoc[];
}

/** Ссылка на файл с сервера: он отдаёт их относительным путём. */
/**
 * Полный адрес файла.
 *
 * Часть снимков сервер присылает не ссылкой, а прямо содержимым
 * (`data:image/...`) — например фото прогресса. Такому адресу база
 * не нужна: приписав её, мы получали «http://сервер data:image/…»,
 * и снимок не открывался вовсе.
 */
export const mediaUrl = (u?: string | null) =>
  !u ? null : /^(https?|data|blob|file):/i.test(u) ? u : API_BASE + u;

/** Что за вложение пришло — по расширению файла. */
export type AttachKind = 'image' | 'video' | 'audio' | 'file';
export function attachKind(url?: string | null): AttachKind | null {
  if (!url) return null;
  const e = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'avif'].includes(e)) return 'image';
  if (['mp4', 'mov', 'm4v'].includes(e)) return 'video';
  if (['m4a', 'mp3', 'aac', 'wav', 'ogg'].includes(e)) return 'audio';
  return 'file';
}

/* ---------- Регистрация ---------- */

export interface SignUpProfile {
  sex?: 'm' | 'f';
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  activity_level?: 'low' | 'light' | 'medium' | 'high' | 'athlete';
  goal?: string;
}
export interface SignUp {
  role: 'client' | 'specialist';
  name: string;
  email: string;
  password: string;
  /** Профессия специалиста */
  profession?: 'nutritionist' | 'trainer' | 'coach';
  /** Анкета клиента: по ней считается предварительная норма */
  profile?: SignUpProfile;
}

/* ---------- Кабинет специалиста ---------- */

export interface SpAttention {
  id: number; name: string; avatar_url?: string | null;
  weight_kg?: number | null; unread: number; skips: number;
  reasons: string[];
}
export interface SpDashboard {
  clients: number;
  published_menus: number;
  unread_messages: number;
  avg_adherence: number;
  avg_weight_delta: number | null;
  meals_today: number;
  meals_week: number;
  active_week: number;
  menus_ending: number;
  no_menu: number;
  attention: SpAttention[];
}
export interface SpClient {
  id: number; name: string; email?: string | null; phone?: string | null;
  avatar_url?: string | null;
  sex?: string | null; birth_year?: number | null;
  height_cm?: number | null; weight_kg?: number | null;
  goal?: string | null; notes?: string | null; status?: string;
  target_kcal?: number | null; target_protein?: number | null;
  target_fat?: number | null; target_carbs?: number | null;
  /* Считанные поля списка */
  unread?: number;
  menu_status?: string | null;
  last_activity?: string | null;
  eaten7?: number; logged7?: number;
  last_msg?: string | null; last_msg_at?: string | null;
  compliance?: number | null;
  points?: number | null; streak?: number | null;
}
export interface SpMenu {
  id: number; client_id: number; title: string;
  start_date: string; days_count: number; status: string;
  published_at?: string | null;
}
export interface SpMenuItem extends MealItem {
  day_number: number;
  base_portion_g?: number | null;
  comment?: string | null;
}
export interface Dish {
  id: number; name: string; photo_url?: string | null;
  base_portion_g?: number | null; cook_minutes?: number | null;
  kcal_100: number; protein_100: number; fat_100: number; carbs_100: number;
  meal_types?: string | null;
  /** Кто завёл блюдо: чужие и общие править нельзя */
  created_by?: number | null;
  instructions?: string | null;
  /** Шаги приготовления строкой JSON, как их отдаёт сервер */
  steps?: string | null;
  tags?: string | null;
}
/** Продукт из пищевой базы: КБЖУ всегда на 100 г сырого веса. */
export interface Ingredient {
  id: number; name: string; category?: string | null;
  kcal: number; protein: number; fat: number; carbs: number;
  fiber?: number | null; cooked_ratio?: number | null;
}
/** Состав блюда так, как его отдаёт GET /specialist/dishes/{id} */
export interface DishRecipeRow {
  ingredient_id: number; ingredient_name: string; grams: number;
  kcal: number; protein: number; fat: number; carbs: number;
  cooked_ratio?: number | null;
}
export interface DishFull extends Dish {
  ingredients: DishRecipeRow[];
}
/** Шаг приготовления: текст и, если есть, снимок */
export interface DishStep { text?: string; photo_url?: string | null }
export interface SpProfile {
  id: number; name: string; email: string; avatar_url?: string | null;
  profession?: string | null; join_code?: string | null;
  plan?: string | null; bio?: string | null; city?: string | null;
  verify_status?: Verification['status'] | null;
}

export const PROFESSION: Record<string, string> = {
  nutritionist: 'Нутрициолог', trainer: 'Тренер', coach: 'Коуч',
};

/* ---------- Здоровье клиента ---------- */

export const ALLERGY_KINDS: Record<string, string> = {
  allergy: 'Аллергия', intolerance: 'Непереносимость', avoid: 'Избегать',
};
export const MED_KINDS: Record<string, string> = {
  medicine: 'Препарат', supplement: 'БАД', vitamin: 'Витамин',
};

export interface Allergy {
  id: number; title: string; kind: string; note?: string | null; created_at: string;
}
export interface Med {
  id: number; kind: string; title: string;
  dosage?: string | null; schedule?: string | null;
  started_on?: string | null; ended_on?: string | null; note?: string | null;
}
export interface Lab {
  id: number; title: string; taken_on?: string | null;
  file_url?: string | null; note?: string | null; created_at: string;
}
export interface Recommendation {
  id: number; body: string; created_at: string;
}
export interface Health {
  allergies: Allergy[];
  meds: Med[];
  labs: Lab[];
  recommendations: Recommendation[];
}

/* ---------- Лента ---------- */

export interface Post {
  id: number;
  text?: string | null;
  photo_url?: string | null;
  created_at: string;
  author_type: 'client' | 'specialist' | 'admin';
  author_id: number;
  author_name: string;
  author_avatar?: string | null;
  likes: number;
  liked: boolean;
  /** Свой пост можно удалить */
  mine: boolean;
}

/* ---------- Остальное в кабинете специалиста ---------- */

export interface SpTemplate {
  id: number; name: string;
  source_menu_id: number; source_title?: string | null;
  days_count?: number | null; items_count?: number | null;
  created_at: string;
}
export interface SpLead {
  id: number; name: string; contact?: string | null;
  message?: string | null; read_at?: string | null; created_at: string;
}
export interface SpService {
  id: number; title: string; description?: string | null;
  kind: string; price_kop: number; period_days?: number | null;
  is_active: number; sort_order?: number;
}
export interface SpSignal {
  id: number; name: string; unread: number;
  last_meal?: string | null; skips: number; last_weight?: string | null;
}
export interface NewClient {
  name: string; email?: string | null; phone?: string | null;
  sex?: 'm' | 'f' | null; birth_year?: number | null;
  height_cm?: number | null; weight_kg?: number | null;
  goal?: string | null;
  target_kcal?: number | null; target_protein?: number | null;
  target_fat?: number | null; target_carbs?: number | null;
}
export interface NewClientResult {
  client_id: number; invite_token: string; invite_url: string;
}

export const SERVICE_KIND: Record<string, string> = {
  subscription: 'Подписка', session: 'Разовая встреча', package: 'Пакет', other: 'Другое',
};
