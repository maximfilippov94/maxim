/**
 * Клиент к существующему бэкенду EQUA. Ни один эндпоинт не меняется —
 * приложение говорит с тем же /api/v1, что и веб-версия.
 */
import { readToken, writeToken } from './tokenStore';

/** Адрес сервера. На проде — боевой домен, при разработке подменяется. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? 'https://nutrimenu.ru';

let token: string | null = null;

export async function loadToken() {
  token = await readToken();
  return token;
}
export async function setToken(t: string | null) {
  token = t;
  await writeToken(t);
}
export function getToken() {
  return token;
}

/* Сессия протухла — об этом должно узнать приложение целиком, а не тот
   экран, которому не повезло спросить первым. Иначе человек видит ошибку
   на одном экране и рабочий интерфейс на соседнем. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  /* Кроме текста ошибки прикладываем весь ответ. Сервер возвращает
     вместе с отказом подробности — чем занято питание, что человек
     потеряет при замене, сколько останется в зачёт, — и без них экран
     может только показать сухую строку вместо разговора. */
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
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

/* Ответы на GET держим недолго: экран «Сегодня» открывается с трёх
   разных мест подряд, и каждый раз дёргать сервер незачем. Срок короткий —
   данные про съеденное меняются в ту же минуту. */
const GET_TTL_MS = 2500;
const getCache = new Map<string, { at: number; data: any }>();
const getInflight = new Map<string, Promise<any>>();
/* Двойной тап по кнопке не должен создавать две записи: пока одинаковая
   мутация выполняется, повторные вызовы получают тот же Promise. */
const mutationInflight = new Map<string, Promise<any>>();

/** Сбросить кэш GET — после любой записи, которая меняет видимые данные. */
export function dropGetCache(prefix?: string) {
  if (!prefix) { getCache.clear(); return; }
  for (const k of [...getCache.keys()]) if (k.startsWith(prefix)) getCache.delete(k);
}

export interface ApiOptions {
  method?: string;
  body?: any;
  retry?: boolean;
  /** Отмена снаружи: уход с экрана, новый запрос поиска, «Остановить». */
  signal?: AbortSignal;
  /** Не брать и не класть в кэш — для данных, которые нужны свежими. */
  noCache?: boolean;
  /** Разрешить одинаковые параллельные мутации (по умолчанию склеиваются). */
  dedupe?: boolean;
}

export async function api<T = any>(
  path: string,
  opt: ApiOptions = {},
): Promise<T> {
  const method0 = (opt.method ?? 'GET').toUpperCase();
  const cacheable = method0 === 'GET' && !opt.noCache && !opt.signal;
  if (cacheable) {
    const hit = getCache.get(path);
    if (hit && Date.now() - hit.at < GET_TTL_MS) return hit.data as T;
    const pending = getInflight.get(path);
    if (pending) return pending as Promise<T>;
  }
  const mutation = method0 !== 'GET' && opt.dedupe !== false;
  const mutationKey = mutation
    ? method0 + ' ' + path + ' ' + (opt.body instanceof FormData ? 'form' : JSON.stringify(opt.body ?? null))
    : '';
  if (mutation && mutationInflight.has(mutationKey)) {
    return mutationInflight.get(mutationKey) as Promise<T>;
  }

  const job = request<T>(path, opt);

  if (cacheable) {
    getInflight.set(path, job);
    job.then(
      data => { getCache.set(path, { at: Date.now(), data }); },
      () => {},
    ).finally(() => getInflight.delete(path));
  }
  if (mutation) {
    mutationInflight.set(mutationKey, job);
    job.catch(() => {}).finally(() => mutationInflight.delete(mutationKey));
    /* Любая запись могла изменить то, что лежит в кэше чтений. */
    job.then(() => dropGetCache(), () => {});
  }
  return job;
}

async function request<T = any>(
  path: string,
  opt: ApiOptions = {},
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
    /* Отмена снаружи: человек ушёл с экрана, набрал в поиске дальше или
       нажал «Остановить». Запрос обрывается сразу, а не доживает до
       таймаута, занимая соединение. */
    const outer = opt.signal;
    const relay = () => abort.abort();
    if (outer) {
      if (outer.aborted) { clearTimeout(timer); throw new ApiError('Запрос отменён', 0); }
      outer.addEventListener('abort', relay);
    }
    try {
      res = await fetch(API_BASE + '/api/v1' + path, {
        method, headers, body, signal: abort.signal,
      });
    } catch {
      if (outer?.aborted) throw new ApiError('Запрос отменён', 0);
      if (attempt < tries - 1 && timeLeft()) { await wait(BACKOFF[attempt]); continue; }
      /* Обрыв связи и ошибка сервера — разные вещи: на первом показываем
         «нет сети», на втором сообщение с сервера. */
      throw new ApiError('Нет связи с сервером. Проверьте интернет.', 0);
    } finally {
      clearTimeout(timer);
      if (outer) outer.removeEventListener('abort', relay);
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
      /* Протухшая сессия — случай для всего приложения, а не для одного
         экрана: сообщаем наверх, там решат увести на вход. */
      if (res.status === 401 && token) onUnauthorized?.();
      /* «Сервер занят» отличаем от настоящей ошибки: первое стоит
         просто повторить рукой, второе — повод разбираться. */
      const busy = RETRY_STATUS.includes(res.status)
        ? 'Сервер сейчас не отвечает. Попробуйте ещё раз через минуту.'
        : null;
      throw new ApiError(json?.error ?? busy ?? 'Ошибка сервера', res.status, json);
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
  photo_thumb_url?: string | null;
  log_status?: string | null;
  nutrition: Totals;
}
export interface TodayResponse {
  menu: { id: number; title: string; target_kcal?: number } | null;
  items: MealItem[];
  /** Съедено за день: отмеченные приёмы меню плюс дневник продуктов */
  totals: Totals;
  /** Только отмеченное по меню, без дневника */
  menu_totals?: Totals;
  /** Съеденное не по меню — записи дня и их сумма */
  food?: FoodEntry[];
  food_totals?: Totals & { fiber?: number };
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
    /* Рост, год рождения и уровень активности сервер отдаёт в `/me`
       вместе с остальным профилем — их показывает экран профиля. */
    height_cm?: number | null;
    birth_year?: number | null;
    activity_level?: string | null;
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
  /** Сколько купить в единицах магазина: «12 штук», «1,3 кг», «25 мл» */
  amount?: { value: number; unit: string; text: string };
  at_home?: number;
}
export interface ShoppingResponse {
  menu: { id: number; title: string; days_count: number } | null;
  days: number;
  items: ShoppingItem[];
  /** Продукты, которые клиент отметил как «всегда есть дома» */
  pantry: ShoppingItem[];
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
  /** off — денег нет вовсе, demo — заморозка работает на учебных суммах, live — настоящие. */
  payments_mode: 'off' | 'demo' | 'live';
  note?: string | null;
  subscription: Subscription | null;
}

/**
 * Услуга, которую клиент подключил у своего специалиста.
 *
 * Оплаты пока нет — услуга включается сразу, а paid остаётся нулём.
 * days_left считает сервер: у последнего дня подписки это 1, а не 0,
 * потому что в этот день она ещё работает.
 */
export interface Subscription {
  id: number; service_id: number | null;
  specialist_id: number; specialist_name?: string;
  title: string;
  kind: 'one_time' | 'subscription';
  price_kop: number; price: number;
  period_days: number | null;
  status: 'active' | 'expired' | 'cancelled' | 'refunded';
  paid: 0 | 1;
  started_at: string; expires_at: string | null;
  days_left: number | null; expired: boolean;
  /* Приёмка разовой услуги: специалист отметил выполнение, и пока клиент
     не подтвердил (или не промолчал до срока), деньги заморожены. */
  done_at?: string | null;
  accepted_at?: string | null;
  accepted_by?: 'client' | 'auto' | 'admin' | 'refund' | null;
  disputed_at?: string | null;
  dispute_note?: string | null;
  awaiting_accept?: boolean;
  accept_days_left?: number | null;
  payout_kop?: number | null;
  client_name?: string;
}

/* ---------- EQUA info ----------
   Рассказ о сервисе и его обновления. Одна лента на все роли: сервер
   сам отдаёт то, что относится к этой стороне. */

export interface InfoPost {
  id: number;
  kind: 'about' | 'update';
  title: string;
  body: string;
  created_at: string;
}
export interface InfoResponse {
  about: InfoPost[];
  updates: InfoPost[];
}

/* ---------- Баланс специалиста ----------
   Баланс не хранится, а считается движениями: каждая строка выписки
   объясняет, откуда взялось одно из двух чисел. */

export interface Balance {
  held_kop: number;
  available_kop: number;
  pending_kop: number;
  payout_min_kop: number;
  payments_mode: 'off' | 'demo' | 'live';
  can_payout: boolean;
  accept_days: number;
}
export interface BalanceEntry {
  id: number;
  kind: 'hold' | 'release' | 'refund' | 'payout' | 'payout_back';
  held_kop: number; avail_kop: number;
  note?: string | null;
  sub_title?: string | null;
  client_name?: string | null;
  occurred_at: string;
}
export interface PayoutDetails {
  legal_type: 'self_employed' | 'ip' | 'individual';
  full_name: string;
  inn?: string | null;
  /** Полного номера счёта сервер не отдаёт: сверить перевод хватает четырёх цифр. */
  account_tail: string;
  bank?: string | null;
  agreement_accepted_at?: string | null;
}
export interface PayoutRequest {
  id: number; amount_kop: number;
  status: 'pending' | 'paid' | 'rejected';
  note?: string | null;
  created_at: string; decided_at?: string | null;
}
export interface BalanceResponse {
  balance: Balance;
  entries: BalanceEntry[];
  details: PayoutDetails | null;
  payouts: PayoutRequest[];
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
  /** Своя оценка блюда, 1…5; её сервер отдаёт только владельцу меню */
  my_rating?: number | null;
  /** Средняя оценка по всем клиентам и число оценивших */
  dish_rating?: number | null;
  dish_rating_count?: number | null;
}
/* Подбор замен считает порцию сам — так, чтобы калории сошлись с тем
   блюдом, которое заменяют, — и возвращает уже готовые числа вместе с
   расхождением по каждому показателю. Считать из kcal_100, как раньше,
   больше нельзя: сервер их в этом ответе не отдаёт. */
export interface Replacement {
  id: number; name: string; photo_url?: string | null; photo_thumb_url?: string | null;
  portion_g: number;
  kcal: number; protein: number; fat: number; carbs: number;
  kcal_diff: number; protein_diff: number; fat_diff: number; carbs_diff: number;
}

/** Откуда список: ручной от специалиста или автоподбор. */
export type ReplacementSource = 'specialist' | 'auto';

/* ---------- Награды и баллы ---------- */

export interface GamTask { key: string; label: string; reward: number; done: boolean; progress: string }
export interface GamAchievement { key: string; icon: string; label: string; hint: string; unlocked: boolean }
/** Привилегию задаёт специалист: выдавать её будет он, значит он и
 *  решает, что предложить. Прежний зашитый список обещал скидку на
 *  подписку, которой в сервисе нет. */
export interface GamReward { id: number; label: string; note?: string | null; cost: number }
export interface GamRedemption {
  reward_key: string; title?: string | null; points_cost: number;
  code: string; status: string; created_at: string;
}

/** Личное задание от специалиста — со сроком, баллами и фотоотчётом. */
export interface ClientTask {
  id: number; title: string; note?: string | null;
  kind: 'simple' | 'photo'; points: number;
  due_on?: string | null; status: 'open' | 'done' | 'cancelled';
  photo_url?: string | null; comment?: string | null;
  done_at?: string | null; created_at: string;
}
export interface GamWeekDay { label: string; date: string; pct: number | null; logged: number }
export interface Gamification {
  balance: number; earned: number; spent: number;
  streak: number; eaten: number; perfect_days: number;
  level: number; level_title: string; level_base: number; level_next: number;
  tasks: GamTask[];
  personal_tasks: ClientTask[];
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
  /** У специалиста два источника: события клиентов и то, что о нём самом */
  source?: 'client' | 'own';
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

/* ---------- Дневник продуктов ----------
   Человек не всегда ест блюдо: бывает свёкла и греческий йогурт.
   Запись независима от меню — день, приём пищи, набор продуктов. */

export interface Food {
  id: number; name: string; category?: string | null; brand?: string | null;
  barcode?: string | null;
  kcal: number; protein: number; fat: number; carbs: number; fiber: number;
  unit?: string;
  /** Вес одной штуки — чтобы не набирать «60» для яйца руками. */
  piece_g?: number | null;
  /** Порция с упаковки. */
  per_serving_g?: number | null;
}
/* Те же пять слотов, что у меню: день один, и назначенное со съеденным
   должны попадать в одну и ту же секцию, а не в два списка. */
export type FoodMeal = 'breakfast' | 'snack1' | 'lunch' | 'snack2' | 'dinner';
export const FOOD_MEALS: [FoodMeal, string][] = [
  ['breakfast', 'Завтрак'], ['snack1', 'Перекус'], ['lunch', 'Обед'],
  ['snack2', 'Перекус'], ['dinner', 'Ужин'],
];
export interface FoodEntryItem {
  id: number; ingredient_id: number | null; name: string; grams: number;
  kcal: number; protein: number; fat: number; carbs: number; fiber: number;
}
/** День дневника для кабинета специалиста. */
export interface FoodDay {
  date: string;
  entries: FoodEntry[];
  totals: { kcal: number; protein: number; fat: number; carbs: number; fiber: number };
}
export interface FoodEntry {
  id: number; eaten_on: string; meal: FoodMeal; meal_title: string;
  note?: string | null; items: FoodEntryItem[];
  totals: { kcal: number; protein: number; fat: number; carbs: number; fiber: number };
}

/* ---------- Каталог специалистов ---------- */

export interface CatalogSpecialist {
  id: number; name: string; avatar_url?: string | null;
  profession?: string; bio?: string | null; city?: string | null;
  rating?: number | null; reviews_count?: number | null;
  price?: number | null; price_unit?: string | null;
  experience_years?: number | null;
  specializations?: string | null;
  verified?: number;
  /* Цена «от» в каталоге считается из прайса: минимальная активная
     услуга и её период. Отдельного поля цены у профиля больше нет. */
  slug?: string | null; education?: string | null;
  advantages?: string | null; active_clients?: number;
  /* До трёх услуг с ценами прямо в карточке: по ним и выбирают
     человека, а не по городу. */
  services?: CatalogService[];
  /** Сколько активных услуг всего — в карточке показываем не больше трёх. */
  services_count?: number;
  /* Паспорт сверен владельцем. Сам скан наружу не отдаётся никогда. */
  identity_verified?: boolean;
  /** Последний запрос специалиста к API: «в сети сегодня в 11:05». */
  last_seen_at?: string | null;
  /** Когда специалист завёл аккаунт — отсюда «из них N лет на EQUA». */
  joined_at?: string | null;
}

export interface CatalogService {
  id?: number; title: string; description?: string | null;
  kind: string; price_kop: number; period_days?: number | null;
  /** Длительность разовой услуги в минутах: «3000 ₽ · 60 мин.» */
  duration_min?: number | null;
}

/** Открытый профиль специалиста: то, что видит клиент до выбора. */
export interface PublicSpecialist extends CatalogSpecialist {
  documents?: { id: number; kind: string; title: string; issuer?: string | null;
    issued_on?: string | null; scan_url?: string | null }[];
  reviews?: { id: number; rating: number; body?: string | null;
    created_at: string; author: string }[];
}

/* ---------- Отзывы ----------
   Рейтинг считается из отзывов и может быть пустым: сервис, где ещё
   никто не оставил отзыв, честнее показать без звёзд, чем с пятёркой. */

export interface Review {
  id: number; rating: number; body?: string | null;
  author: string; created_at: string;
}
export interface MyReview {
  id: number; rating: number; body?: string | null;
  status: string; created_at: string; updated_at?: string | null;
}

/* ---------- Верификация специалиста ----------
   Диплом клиент проверить не может, поэтому проверку берёт на себя
   сервис: специалист прикладывает документы, владелец их сверяет. */

/* Паспорт — тоже документ верификации: клиенту важно знать, что за
   человеком стоит проверенная личность. Сам скан паспорта наружу не
   отдаётся никогда — в профиле от него остаётся только отметка. */
export type DocKind = 'passport' | 'diploma' | 'course' | 'certificate' | 'license';
export const DOC_KINDS: Record<DocKind, string> = {
  passport: 'Паспорт', diploma: 'Диплом', course: 'Курс',
  certificate: 'Сертификат', license: 'Лицензия',
};
export interface SpecDoc {
  id: number; kind: DocKind; title: string;
  issuer?: string | null; issued_on?: string | null; file_url?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  /** 1 — специалист сам открыл скан в своём публичном профиле. */
  is_public?: number;
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

/**
 * Фото блюда для списка.
 *
 * В строке и сетке плитка 46–56 точек, и грузить туда снимок на 1100
 * — это мегабайты трафика ради картинки размером с ноготь. Сервер
 * держит рядом миниатюру; крупная версия остаётся карточке (mediaUrl
 * по photo_url).
 */
export const thumbUrl = (o?: { photo_thumb_url?: string | null; photo_url?: string | null } | null) =>
  mediaUrl(o?.photo_thumb_url ?? o?.photo_url);

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
  profession?: 'nutritionist' | 'trainer' | 'endocrinologist' | 'coach';
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
  /* Считается от плана и равна null, когда ни у кого из клиентов нет
     опубликованного меню: считать не от чего. */
  avg_adherence: number | null;
  /* Записей в дневнике за неделю и сколько человек их вёл: низкая
     приверженность при живом дневнике значит «ест своё», а не «бросил». */
  own_entries_week?: number;
  own_people_week?: number;
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
  /* Приёмов в плане за 7 дней и что с ними стало. Доля съеденного среди
     отмеченных обманывает: отметивший один приём из двадцати пяти
     показывал 100 %. Считать надо от плана — это planned7 и marked_pct. */
  planned7?: number; skipped7?: number; unlogged7?: number;
  marked_pct?: number | null;
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
  /** Уменьшенная копия для списков — её и грузят сетки. */
  photo_thumb_url?: string | null;
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
  nutritionist: 'Нутрициолог', trainer: 'Тренер',
  endocrinologist: 'Эндокринолог', coach: 'Коуч',
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
  /* Сколько раз в день нужно принимать и сколько уже принято сегодня.
     Второе число обязательно: маршрут отметки перезаписывает счётчик за
     день целиком, и без текущего значения кнопка сбрасывала бы его. */
  frequency_per_day?: number;
  taken_today?: number;
}
export interface Lab {
  id: number; title: string; taken_on?: string | null;
  file_url?: string | null; note?: string | null; created_at: string;
}
export interface Recommendation {
  id: number; body: string; created_at: string;
  /** Заголовок и вид — их задаёт специалист; у старых записей их нет */
  title?: string | null;
  category?: 'general' | 'nutrition' | 'training' | 'medication' | 'document' | null;
  /** До какой даты рекомендация в силе */
  valid_until?: string | null;
  /** Что с рекомендацией решил специалист */
  status?: 'active' | 'done' | 'cancelled' | null;
  /** Что ответил клиент: не открыл, выполняет, выполнил */
  client_status?: 'new' | 'in_progress' | 'done' | null;
  author_name?: string | null;
  author_profession?: string | null;
}

/** Вид рекомендации словами — те же, что `HEALTH_REC_KINDS` в вебе. */
export const REC_KINDS: Record<string, string> = {
  general: 'Общее', nutrition: 'Питание', training: 'Тренировки',
  medication: 'Препараты', document: 'По документу',
};
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
  /** Длительность разовой услуги в минутах — мера рядом с ценой. */
  duration_min?: number | null;
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

/* Видов ровно два, и это те же два, что понимает сервер. Раньше здесь
   значились «встреча» и «пакет», которых он не знает: выбранный вид
   молча превращался в разовую услугу. */
export const SERVICE_KIND: Record<string, string> = {
  one_time: 'Разовая услуга', subscription: 'Подписка',
};

/* ---------- Поддержка ----------
   Один набор типов на клиента и специалиста: обращение у них устроено
   одинаково, различается только, кто пишет. */
export interface Ticket {
  id: number; topic: string; subject: string;
  status: 'new' | 'in_progress' | 'closed';
  created_at: string; last_reply_at: string;
  unread?: number; last_body?: string | null;
}
export interface TicketMessage {
  id: number; from_admin: number; body: string;
  read_at?: string | null; created_at: string;
}
export interface TicketFull {
  ticket: Ticket; messages: TicketMessage[]; topics: Record<string, string>;
}

/** Подписи статусов. У клиента «Ответили» понятнее, чем «В работе». */
export const TICKET_STATUS: Record<Ticket['status'], string> = {
  new: 'Ждёт ответа', in_progress: 'Ответили', closed: 'Закрыто',
};

/* ---------- Тренировки ----------
   Программа собирается тренером один раз и назначается многим, поэтому
   у клиента приходит не «моя тренировка», а пункт плана: день, шаблон
   и что с ним стало. */
/** Собеседник в списке переписок клиента — выдача `/client/chats`. */
export interface ChatPeer {
  id: number;
  name: string;
  avatar_url?: string | null;
  role: string;
  is_ai: number;
  /** Последнее сообщение, обрезанное сервером до 90 знаков */
  last?: string | null;
  last_at?: string | null;
  unread: number;
}

export interface WoPlanItem {
  date: string; dow: number;
  assignment_id: number; workout_id: number;
  title: string; description?: string | null;
  duration_min: number; level: number; items: number;
  cover?: string | null; kcal: number;
  session_id: number | null;
  status: 'planned' | 'in_progress' | 'done' | 'skipped';
  /* Кто составил программу: сервер кладёт оба поля в каждую позицию
     плана, для AI-тренера имя подставляется как «EQUA AI». */
  is_ai?: number | boolean;
  trainer_name?: string | null;
}
export interface WoWeek {
  week_start: string; week: WoPlanItem[];
  today: WoPlanItem | null; next: WoPlanItem | null;
  has_trainer: boolean;
}
export interface WoExercise {
  id: number; sort_order: number;
  sets: number | null; reps: number | null; rest_sec: number;
  duration_sec: number | null; target_weight_kg: number | null;
  name: string; slug: string; kind: 'strength' | 'cardio';
  muscle_group: string; equipment: string; level: number;
  muscles_main?: string | null; muscles_extra?: string | null;
  instructions?: string | null; tips?: string | null;
  image_start_url?: string | null; image_end_url?: string | null;
  video_url?: string | null;
}
export interface WoSet {
  id: number; workout_exercise_id: number; set_number: number;
  reps_done: number | null; weight_kg: number | null; duration_sec: number | null;
}
export interface WoSession {
  id: number; workout_id: number; assignment_id: number | null;
  planned_on: string; started_at: string | null; finished_at: string | null;
  duration_sec: number | null; kcal: number | null;
  feeling: number | null; comment: string | null;
  status: 'planned' | 'in_progress' | 'done' | 'skipped';
  workout: { title: string; duration_min: number; level: number; description?: string | null };
  exercises: WoExercise[];
  sets: WoSet[];
}
export interface WoRecovery {
  id: number; name: string; photo_url?: string | null;
  portion_g: number; kcal: number; protein: number; fat: number; carbs: number;
}
export interface WoHistoryItem {
  id: number; planned_on: string; status: 'done' | 'skipped';
  duration_sec: number | null; kcal: number | null; feeling: number | null;
  comment: string | null; title: string; duration_min: number; items: number;
}

export const WO_LEVELS: Record<number, string> = {
  1: 'Начальный', 2: 'Средний', 3: 'Продвинутый',
};
/* Оценка нагрузки: пять ступеней, как на экране завершения. */
export const WO_FEEL: [number, string, string][] = [
  [1, 'Легко', '🙂'], [2, 'Нормально', '😌'], [3, 'Средне', '😐'],
  [4, 'Тяжело', '😤'], [5, 'На пределе', '🥵'],
];

/* ---------- Продвижение карточки в каталоге ---------- */
export interface PromoTariff { days: number; price_kop: number }
export interface PromoCurrent {
  id: number; days: number; expires_at: string;
  impressions: number; clicks: number; days_left: number;
}
export interface PromoHistory {
  id: number; days: number; price_kop: number; status: string;
  impressions: number; clicks: number;
  paid_at?: string | null; started_at?: string | null; expires_at?: string | null;
}
export interface PromotionState {
  tariffs: PromoTariff[];
  current: PromoCurrent | null;
  history: PromoHistory[];
  payments_mode: 'off' | 'demo' | 'live';
}

/* ---------- Смена профессии ----------
   Профессия решает, какие разделы открыты, поэтому меняет её владелец по
   заявке, а не сам специалист. */
export type ProfessionKey = 'nutritionist' | 'trainer' | 'endocrinologist' | 'coach';
export interface ProfessionRequest {
  id: number;
  current_profession: string;
  requested_profession: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  request_note?: string | null;
  review_note?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

/* ---------- EQUA AI: наборы, анкеты, подписка ----------
   Набор продаётся один на клиента: питание, тренировки или оба вместе.
   Оба по отдельности не бывают — сервер переводит на «both», зачитывая
   остаток прежнего. Живой специалист и AI одновременно невозможны. */
export type AiPlan = 'nutrition' | 'workouts' | 'both';
export interface AiTariff { plan: AiPlan; title: string; price_kop: number }
export interface AiCurrent {
  id: number; plan: AiPlan; title: string;
  is_free: boolean;
  expires_at: string | null;
  days_left: number;
  remainder_kop: number;
}
export interface AiPlanRow {
  kind: string; target_id: number | null;
  period_from: string | null; period_to: string | null;
  note: string | null; created_at: string;
}
export interface AiState {
  tariffs: AiTariff[];
  /** off — доступ выдаётся бесплатно, live — нужна оплата, demo — без денег. */
  payments_mode: 'off' | 'demo' | 'live';
  current: AiCurrent | null;
  plans: AiPlanRow[];
  upgrade: { to: AiPlan; add: string; title: string; price_kop: number;
             full_price_kop: number; credit_kop: number } | null;
  nutrition_ready: boolean;
  fitness_ready: boolean;
  specialist_conflict: { id: number; name: string; profession?: string; role?: string }[];
  has_model: boolean;
  welcome_offer: { eligible: boolean; percent: number; seconds_left: number };
  cycle_context?: { enabled: boolean; allowed: boolean; phase?: string | null };
}
/** Что входит в набор — словами, а не названием поля. */
export const AI_PLAN_WHAT: Record<AiPlan, string[]> = {
  nutrition: ['Меню по неделям на 30 дней', 'КБЖУ, порции и замены',
              'Список покупок на каждую неделю', 'Еженедельная адаптация плана'],
  workouts: ['Программа под цель и уровень', 'Разбор по подходам и весам',
             'Учёт выполнения', 'Прогрессия по факту, а не по календарю'],
  both: ['Меню и программа как одна система', 'Покупки и замены блюд',
         'Адаптация питания и нагрузки', 'Единый чат с EQUA AI'],
};

/* ---------- Недельный отчёт по клиенту ----------
   Приверженность считается от плана: planned — блюд в плане за семь
   дней, eaten_of_plan — сколько из них отмечено съеденными, untracked —
   сколько человек не трогал вовсе. own_* — его собственные записи в
   дневнике: низкая приверженность при живом дневнике значит «ест своё»,
   а не «бросил учёт». */
export interface WeeklyReport {
  client?: { id: number; name: string };
  period: { from: string; to: string };
  eaten: number;
  logged: number;
  adherence: number | null;
  planned?: number;
  eaten_of_plan?: number;
  untracked?: number;
  own_entries?: number;
  own_days?: number;
  own_kcal?: number;
  weight_delta: number | null;
  latest_weight: number | null;
  avg_kcal: number | null;
  checkin: {
    week_start: string; ease_score: number | null;
    wellbeing_score: number | null; comment: string | null;
    difficulties?: string | null;
  } | null;
  skips: { status: string; comment: string | null; meal_type: string; dish_name: string }[];
}

/* ---------- Настройки уведомлений ----------
   Поля у клиента и специалиста разные: клиенту напоминают о еде, весе и
   тренировках, специалисту сообщают о клиентах. Общее — тихие часы. */
export interface PushPrefs {
  /* клиент */
  breakfast?: number; lunch?: number; dinner?: number;
  weight?: number; menu_updates?: number; workouts?: number;
  /* специалист */
  meal_logs?: number; client_inactive?: number;
  /* обе роли */
  messages?: number;
  quiet_start?: string | null;
  quiet_end?: string | null;
}
/** Что показывать клиенту: поле и подпись — те же слова, что в вебе. */
export const PUSH_CLIENT: [keyof PushPrefs, string, string][] = [
  ['breakfast', 'Завтрак', 'напомнить отметить утренний приём'],
  ['lunch', 'Обед', 'напомнить днём'],
  ['dinner', 'Ужин', 'напомнить вечером'],
  ['weight', 'Вес', 'напомнить встать на весы'],
  ['messages', 'Сообщения', 'от специалиста и EQUA AI'],
  ['menu_updates', 'Изменения меню', 'новое меню и правки'],
  ['workouts', 'Тренировки', 'назначенная тренировка на сегодня'],
];
/** Что показывать специалисту. */
export const PUSH_SPEC: [keyof PushPrefs, string, string][] = [
  ['messages', 'Сообщения', 'клиенты пишут вам'],
  ['meal_logs', 'Отметки питания', 'клиент отметил или пропустил блюдо'],
  ['client_inactive', 'Неактивные клиенты', 'кто пропал из приложения'],
];

/* ---------- Тренировки глазами тренера ---------- */
export interface WoClientRow {
  id: number; name: string; avatar_url?: string | null; goal?: string | null;
  today: WoPlanItem | null;
  today_status: 'planned' | 'in_progress' | 'done' | 'skipped' | 'rest';
  done30: number; missed30: number; pct30: number | null;
  last: { planned_on: string; status: string; kcal: number | null;
          duration_sec: number | null; feeling: number | null; title: string } | null;
}
export interface WoWeekBar {
  week_start: string; done: number; skipped: number; planned: number;
  kcal: number; minutes: number;
}
export interface WoProgress {
  weeks: WoWeekBar[];
  sessions: WoHistoryItem[];
  totals: { done: number; skipped: number; kcal: number; minutes: number };
}
/* --- Тренировки, которые тренер собирает ---------------------------
   Клиентские типы выше описывают готовую тренировку в работе; здесь —
   та же тренировка со стороны того, кто её составляет: со счётчиками,
   составом и назначениями. */
export interface SpWorkoutRow {
  id: number; title: string; description?: string | null;
  duration_min: number; level: number;
  is_active: number;
  /** Сколько упражнений в составе. */
  items: number;
  /** Скольким клиентам назначена сейчас. */
  assigned: number;
}
export interface SpAssignment {
  id: number; workout_id: number; client_id: number;
  client_name?: string;
  start_date: string; repeat_kind: 'once' | 'weekly';
  weekdays?: string | null;
  status: 'active' | 'ended';
  /** Приходит в списке назначений клиента, не в карточке тренировки. */
  title?: string; duration_min?: number; level?: number; items?: number;
}
export interface SpWorkoutFull extends SpWorkoutRow {
  exercises: WoExercise[];
  assignments: SpAssignment[];
}
/** Упражнение из общей библиотеки: её ведёт владелец, тренер выбирает. */
export interface ExerciseRow {
  id: number; slug: string; name: string;
  muscle_group: string; kind: 'strength' | 'cardio';
  equipment: string; level: number;
  muscles_main?: string | null; muscles_extra?: string | null;
  instructions?: string | null; tips?: string | null;
  image_start_url?: string | null; image_end_url?: string | null;
  video_url?: string | null; met?: number | null;
}
/* Словари приходят вместе с библиотекой — не держим второй список в
   приложении, чтобы он не разошёлся с сервером. */
export interface ExerciseLib {
  exercises: ExerciseRow[];
  groups: Record<string, string>;
  equipment: Record<string, string>;
  levels: Record<string, string>;
}
/** Строка состава, пока её правят: ещё без номеров из базы. */
export interface WoDraftRow {
  exercise_id: number;
  name: string;
  kind: 'strength' | 'cardio';
  sets?: number | null; reps?: number | null;
  rest_sec: number;
  duration_sec?: number | null;
  target_weight_kg?: number | null;
  note?: string;
}
/** Дни недели в том же виде, в каком их принимает сервер: 1 — понедельник. */
export const WEEKDAYS: [number, string][] = [
  [1, 'Пн'], [2, 'Вт'], [3, 'Ср'], [4, 'Чт'], [5, 'Пт'], [6, 'Сб'], [7, 'Вс'],
];
/** Дни назначения приходят то строкой «1,4», то списком — разбираем оба. */
export function assignDays(a: SpAssignment): number[] {
  const raw = String(a.weekdays ?? '').trim();
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) return j.map(Number).filter(d => d >= 1 && d <= 7);
  } catch { /* не JSON — значит перечисление через запятую */ }
  return raw.split(',').map(Number).filter(d => d >= 1 && d <= 7);
}

/* Подписи статуса дня у подопечного — те же слова, что в вебе. */
export const WO_CLIENT_STATE: Record<string, string> = {
  done: 'Завершил', in_progress: 'Выполняет тренировку',
  skipped: 'Пропустил', planned: 'Сегодня по плану', rest: 'День отдыха',
};
