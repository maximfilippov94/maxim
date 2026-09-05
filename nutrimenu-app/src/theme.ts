/**
 * Палитры приложения — те же значения, что в вебе.
 * Тёмная — глубокий синий с мятным акцентом, светлая — «Фарфор».
 * Отклонения от макета только по контрасту, они помечены.
 */
export type ThemeName = 'dark' | 'light';
export type ThemePref = ThemeName | 'auto';

export interface Palette {
  name: ThemeName;
  page: string;
  bg: string;
  surface: string;      // карточка
  inset: string;        // элемент внутри карточки
  text: string;
  text2: string;
  text3: string;
  primary: string;      // заливка кнопок и акцент
  primaryHover: string;
  primarySoft: string;
  onPrimary: string;    // текст поверх акцентной заливки
  mp: string; mf: string; mc: string;   // белки / жиры / углеводы
  premium: string;
  premiumSoft: string;
  border: string;
  borderSoft: string;
  track: string;        // подложка прогресс-баров
  ov1: string; ov2: string; ov3: string;
  danger: string;
  videoBg: string;
  shadow: string;
}

/** «Тёмно-синяя» — глубокий синий с мятным акцентом. Тема по умолчанию. */
export const NAVY: Palette = {
  name: 'dark',
  page: '#101C2C',
  bg: '#101C2C',
  surface: '#1B2636',
  inset: '#242F3F',
  text: '#F3F5F7',
  text2: '#8996AA',
  text3: '#8390A2',        // прежний #6F7D91 давал 3.64:1 на карточке
  primary: '#29D39F',
  primaryHover: '#45E3AC',
  primarySoft: 'rgba(41,211,159,0.13)',
  onPrimary: '#04120C',
  mp: '#29D39F', mf: '#F2B34D', mc: '#67A0F2',
  premium: '#F2CD6B',
  premiumSoft: 'rgba(242,205,107,0.14)',
  border: 'rgba(255,255,255,0.07)',
  borderSoft: 'rgba(255,255,255,0.05)',
  track: 'rgba(255,255,255,0.09)',
  ov1: 'rgba(255,255,255,0.04)',
  ov2: 'rgba(255,255,255,0.06)',
  ov3: 'rgba(255,255,255,0.09)',
  danger: '#E2564D',
  videoBg: '#0B131F',
  shadow: '#000000',
};

export const PORCELAIN: Palette = {
  name: 'light',
  page: '#DFE3E8',
  bg: '#F2F4F7',
  surface: '#FFFFFF',
  inset: '#E7EBF0',
  text: '#0E1116',
  text2: '#59616C',
  text3: '#676F7C',        // макет #949BA6 давал 2.54:1 — для текста непригодно
  /* Зелёный взят глубже эталонного: свежий #4CAF7D даёт с белым текстом
     2,7:1 и на кнопке нечитаем. Этот — 5,4:1 с белым и 4,9:1 на фоне,
     то есть годится и заливкой, и акцентным текстом мелких подписей. */
  primary: '#0E7A50',
  primaryHover: '#0B6543',
  primarySoft: '#E4F3EB',
  onPrimary: '#FFFFFF',
  mp: '#3E9E6E', mf: '#D9962F', mc: '#4C86E0',
  premium: '#B4600F',
  premiumSoft: '#FBEEDA',
  border: 'rgba(14,17,22,0.09)',
  borderSoft: 'rgba(14,17,22,0.055)',
  track: '#E1E5EB',
  ov1: 'rgba(14,17,22,0.04)',
  ov2: 'rgba(14,17,22,0.07)',
  ov3: 'rgba(14,17,22,0.1)',
  danger: '#D3453C',
  videoBg: '#E7EBF0',
  shadow: '#141E2D',
};

export const PALETTES: Record<ThemeName, Palette> = {
  dark: NAVY,
  light: PORCELAIN,
};

/** Шкала отступов: одно значение на всё приложение, без «на глаз». */
export const S = { xs: 4, sm: 6, md: 9, lg: 14, xl: 20, xxl: 28 } as const;
export const R = { sm: 10, md: 13, lg: 16, xl: 20, pill: 999 } as const;

export const FONT = {
  h1: { fontSize: 33, fontWeight: '700' as const, letterSpacing: -0.9 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.4 },
  h3: { fontSize: 15, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 14, fontWeight: '400' as const },
  small: { fontSize: 12.5, fontWeight: '400' as const },
  label: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 1.5 },
  num: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -1.1 },
};
