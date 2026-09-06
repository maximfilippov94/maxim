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
