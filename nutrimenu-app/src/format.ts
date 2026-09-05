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
