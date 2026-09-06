/**
 * Палитры приложения — фирменные цвета EQUA, те же значения, что в вебе:
 * #2E7D63 «здоровье и рост», #121820 «уверенность», #9AA3AD «баланс»,
 * фон #F5F6F7, разделители #E5E7EB.
 * Отклонения от брендбука только по контрасту, они помечены.
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
  primary: string;      // заливка кнопок: фирменный зелёный
  /* Тот же зелёный, но пригодный для текста и мелких значков: на своём
     фоне #2E7D63 даёт 3,5:1 — заливке хватает, надписи нет. */
  accent: string;
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

/** Тёмная тема: фирменный #121820 и зелёный акцент. Тема по умолчанию. */
export const NAVY: Palette = {
  name: 'dark',
  page: '#121820',
  bg: '#121820',
  surface: '#1B222C',
  inset: '#242C38',
  text: '#F5F6F7',
  text2: '#9AA3AD',        // фирменный «дополнительный», 6,9:1 на фоне
  text3: '#8B95A1',
  primary: '#2E7D63',
  accent: '#4CA585',       // 5,9:1 на фоне; сам #2E7D63 даёт 3,5:1
  primaryHover: '#37946F',
  primarySoft: 'rgba(46,125,99,0.20)',
  onPrimary: '#FFFFFF',
  mp: '#4CA585', mf: '#E0A44A', mc: '#6FA3EE',
  premium: '#E8C46A',
  premiumSoft: 'rgba(232,196,106,0.14)',
  border: 'rgba(255,255,255,0.07)',
  borderSoft: 'rgba(255,255,255,0.05)',
  track: 'rgba(255,255,255,0.09)',
  ov1: 'rgba(255,255,255,0.04)',
  ov2: 'rgba(255,255,255,0.06)',
  ov3: 'rgba(255,255,255,0.09)',
  danger: '#E2564D',
  videoBg: '#0C1118',
  shadow: '#000000',
};

export const PORCELAIN: Palette = {
  name: 'light',
  page: '#E8EAED',
  bg: '#F5F6F7',           // фирменный фон
  surface: '#FFFFFF',
  inset: '#ECEEF1',
  text: '#121820',         // фирменный тёмный
  text2: '#5B6572',
  /* Фирменный #9AA3AD на светлом фоне даёт 2,3:1 — годится разделителям
     и неактивным элементам, но не подписям. Для текста берём глубже. */
  text3: '#6B7480',
  primary: '#2E7D63',      // с белым текстом 5,0:1
  accent: '#216A52',       // 6,0:1 на фоне — для ссылок и мелких подписей
  primaryHover: '#276B55',
  primarySoft: '#E6F1EC',
  onPrimary: '#FFFFFF',
  mp: '#2E7D63', mf: '#C98620', mc: '#3F79D6',
  premium: '#B4600F',
  premiumSoft: '#FBEEDA',
  border: '#E5E7EB',       // фирменный разделитель
  borderSoft: 'rgba(18,24,32,0.055)',
  track: '#E5E7EB',
  ov1: 'rgba(18,24,32,0.04)',
  ov2: 'rgba(18,24,32,0.07)',
  ov3: 'rgba(18,24,32,0.1)',
  danger: '#D3453C',
  videoBg: '#ECEEF1',
  shadow: '#121820',
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
