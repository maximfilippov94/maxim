/** Форматирование чисел — одно место, чтобы «67,4» и «67.4» не разъезжались. */
export const round = (n?: number | null) => Math.round(n ?? 0);

export const kg = (v?: number | null) =>
  v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ',');

export const rub = (kop?: number | null) => {
  const v = (kop ?? 0) / 100;
  return v.toLocaleString('ru-RU', {
    minimumFractionDigits: v % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }) + ' ₽';
};

/** «14.09» — короткая дата для строк списка, где важен только день. */
export const dmy = (s?: string | null) => {
  if (!s) return '—';
  const a = String(s).slice(0, 10).split('-');
  return a.length === 3 ? `${a[2]}.${a[1]}` : s;
};

export function plural(n: number, forms: [string, string, string]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const todayLabel = () =>
  new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

/* ——— Даты меню ———
   Меню живёт с start_date подряд по дням, но человеку «день 4» ничего не
   говорит — он смотрит в календарь. Считаем дату один раз здесь, чтобы
   и клиент, и специалист называли один и тот же день одинаково. */

const WD_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WD_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда',
  'Четверг', 'Пятница', 'Суббота'];

export function menuDate(start: string | null | undefined, day: number): Date | null {
  if (!start) return null;
  const d = new Date(start + 'T00:00:00');
  if (isNaN(+d)) return null;
  d.setDate(d.getDate() + day - 1);
  return d;
}

/** «Ср, 9 сент.» или «Среда, 9 сентября». Без даты — прежнее «День 4». */
export function dayTitle(start: string | null | undefined, day: number, full = false) {
  const d = menuDate(start, day);
  if (!d) return `День ${day}`;
  const name = (full ? WD_FULL : WD_SHORT)[d.getDay()];
  const md = d.toLocaleDateString('ru-RU', { day: 'numeric', month: full ? 'long' : 'short' });
  return `${name}, ${md}`;
}

export const dowShort = (d: Date) => WD_SHORT[d.getDay()];

export function isToday(d: Date | null) {
  if (!d) return false;
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth()
    && d.getFullYear() === n.getFullYear();
}

/**
 * «5 минут назад», «вчера», «3 сентября» — как в лентах.
 * Точное время в ленте не нужно: важно, свежий пост или давний.
 */
export function ago(iso: string) {
  /* Сервер отдаёт время по Гринвичу без пометки — иначе телефон
     прочитает его как местное и всё окажется «в будущем». */
  const d = new Date(String(iso).replace(' ', 'T') + (/[Zz+]/.test(iso) ? '' : 'Z'));
  if (isNaN(+d)) return '';
  const min = Math.floor((Date.now() - +d) / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} ${plural(min, ['минуту', 'минуты', 'минут'])} назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ${plural(h, ['час', 'часа', 'часов'])} назад`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} ${plural(days, ['день', 'дня', 'дней'])} назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/* ——— Каталог специалистов ———
   Те же правила, что в вебе: строка «в сети» и мера услуги должны
   читаться одинаково на сайте и в приложении. */

/** «В сети сегодня в 11:05». Пол специалиста мы не знаем — форма безличная. */
export function seenPhrase(ts?: string | null): string {
  if (!ts) return '';
  const t = Date.parse(String(ts).replace(' ', 'T') + 'Z');
  if (isNaN(t)) return '';
  const d = new Date(t), n = new Date(), s = Math.max(0, (+n - t) / 1000);
  if (s < 300) return 'В сети только что';
  const hhmm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === n.toDateString()) return `В сети сегодня в ${hhmm}`;
  const y = new Date(n); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `В сети вчера в ${hhmm}`;
  if (s < 7 * 86400) {
    const k = Math.floor(s / 86400);
    return `В сети ${k} ${plural(k, ['день', 'дня', 'дней'])} назад`;
  }
  return 'В сети ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/** Мера услуги: у разовой — сколько длится, у подписки — за какой срок. */
export function svcUnit(s: { kind: string; period_days?: number | null; duration_min?: number | null }) {
  if (s.kind === 'subscription') {
    const d = s.period_days ?? 30;
    return d <= 7 ? 'неделя' : d >= 28 ? 'месяц' : `${d} ${plural(d, ['день', 'дня', 'дней'])}`;
  }
  return s.duration_min ? `${s.duration_min} мин.` : 'разово';
}

/** Оценка одной цифрой после запятой; без отзывов — прочерк. */
export const specRate = (r?: number | null) =>
  r ? String(Math.round(r * 10) / 10).replace('.', ',') : '—';
