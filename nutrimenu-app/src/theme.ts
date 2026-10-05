/**
 * Тема EQUA для мобильного клиента.
 *
 * Значения взяты из текущего веба (`app/css/tokens.css`, релиз v211) и из
 * UI-контракта `IOS_DESIGN_SYSTEM.md` (v208/v209). Это не вольный пересказ:
 * палитра, радиусы, высоты и тайминги совпадают с вебом числом в число,
 * иначе мобильное приложение и PWA разъедутся на первой же правке.
 *
 * Акцент продукта — лаймовый #DFFF3A. Он лежит в заливке кнопок и выделений,
 * а текст поверх него тёмный: лайм на белом даёт мало контраста, поэтому для
 * надписей и мелких значков берётся `accent` (в светлой теме это глубокий
 * оливковый #536300), а не сама заливка.
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
  primary: string;      // заливка кнопок и выделений: фирменный лайм
  /** Акцент, пригодный для текста и мелких значков на фоне страницы. */
  accent: string;
  primaryHover: string;
  primaryPress: string;
  primarySoft: string;
  primarySofter: string;
  onPrimary: string;    // текст поверх акцентной заливки
  mp: string; mf: string; mc: string;   // белки / жиры / углеводы
  premium: string;
  premiumSoft: string;
  border: string;
  borderSoft: string;
  /** Обводка кнопки без заливки: штатный `border` для неё слишком бледный. */
  btnLine: string;
  track: string;        // подложка прогресс-баров
  ov1: string; ov2: string; ov3: string;
  good: string;
  danger: string;
  warn: string;
  water: string;
  /** Материал плавающих панелей: док, тулбар, шапка листа. */
  material: string;
  materialStrong: string;
  separator: string;
  videoBg: string;
  shadow: string;
}

/** Тёмная тема — основная для EQUA. */
export const NAVY: Palette = {
  name: 'dark',
  page: '#121820',
  bg: '#121820',
  surface: '#1A222B',
  inset: '#222C36',
  text: '#F7F7F4',
  text2: '#ACB6C1',
  text3: '#9AA3AD',
  primary: '#DFFF3A',
  accent: '#DFFF3A',
  primaryHover: '#E8FF79',
  primaryPress: '#C9EB24',
  primarySoft: 'rgba(223,255,58,0.14)',
  primarySofter: 'rgba(223,255,58,0.08)',
  onPrimary: '#121820',
  mp: '#BBA1F4', mf: '#DFFF3A', mc: '#80CEE4',
  premium: '#F4BD71',
  premiumSoft: 'rgba(244,189,113,0.14)',
  border: 'rgba(255,255,255,0.07)',
  borderSoft: 'rgba(255,255,255,0.04)',
  btnLine: 'rgba(255,255,255,0.38)',
  track: 'rgba(255,255,255,0.07)',
  ov1: 'rgba(255,255,255,0.04)',
  ov2: 'rgba(255,255,255,0.06)',
  ov3: 'rgba(255,255,255,0.09)',
  good: '#A5DB80',
  danger: '#FF9393',
  warn: '#F4BD71',
  water: '#3EA5C8',
  material: 'rgba(26,34,43,0.84)',
  materialStrong: 'rgba(26,34,43,0.96)',
  separator: 'rgba(247,247,244,0.11)',
  videoBg: '#0C1118',
  shadow: '#000000',
};

/** Светлая тема: ivory-фон, белые карточки, тот же лайм в действии. */
export const PORCELAIN: Palette = {
  name: 'light',
  page: '#F7F7F4',
  bg: '#F7F7F4',
  surface: '#FFFFFF',
  inset: '#ECEDE8',
  text: '#121820',
  text2: '#52606C',
  text3: '#64707A',
  primary: '#DFFF3A',
  /* Сам лайм на светлом фоне нечитаем как текст — для надписей оливковый. */
  accent: '#536300',
  primaryHover: '#E8FF79',
  primaryPress: '#C9EB24',
  primarySoft: 'rgba(223,255,58,0.27)',
  primarySofter: 'rgba(223,255,58,0.13)',
  onPrimary: '#121820',
  mp: '#8062B4', mf: '#6B7D0B', mc: '#287B92',
  premium: '#996110',
  premiumSoft: 'rgba(153,97,16,0.12)',
  border: 'rgba(18,24,32,0.08)',
  borderSoft: 'rgba(18,24,32,0.04)',
  btnLine: 'rgba(18,24,32,0.50)',
  track: 'rgba(18,24,32,0.08)',
  ov1: 'rgba(18,24,32,0.04)',
  ov2: 'rgba(18,24,32,0.07)',
  ov3: 'rgba(18,24,32,0.10)',
  good: '#47792B',
  danger: '#B72B3B',
  warn: '#996110',
  water: '#3EA5C8',
  material: 'rgba(255,255,255,0.84)',
  materialStrong: 'rgba(255,255,255,0.96)',
  separator: 'rgba(18,24,32,0.11)',
  videoBg: '#ECEDE8',
  shadow: '#121820',
};

export const PALETTES: Record<ThemeName, Palette> = {
  dark: NAVY,
  light: PORCELAIN,
};

/** Отступы по сетке в 4 px — как требует UI-контракт. */
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** Радиусы: control 14, карточка 22, лист 28 — значения веба. */
export const R = { sm: 10, control: 14, md: 18, lg: 22, xl: 28, pill: 999 } as const;

/**
 * Геометрия экрана. Боковое поле 20 — единственное на всё приложение;
 * высота дока нужна, чтобы содержимое прокручивалось мимо него, а не под ним.
 */
export const LAYOUT = {
  screenPad: 20,
  dockHeight: 72,
  dockGap: 12,
  /** Минимальная цель нажатия. Меньше — промах пальцем. */
  touch: 44,
  controlHeight: 50,
  controlCompact: 42,
  rowMin: 60,
  rowMax: 72,
  toolbar: 44,
} as const;

/**
 * Типографика по контракту: 34 — крупный заголовок, 28 — обычный заголовок
 * экрана, 22 — раздел, 16 — текст, 15 — выноска, 14 — подзаголовок,
 * 12 — подпись. Ключи оставлены прежними, чтобы не переписывать все экраны.
 */
export const FONT = {
  large: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -1.0 },
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.7 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  h3: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '400' as const },
  callout: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.2 },
  num: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -1.1 },
};

/**
 * Движение. Коротко и спокойно: нажатие почти незаметно сжимает элемент,
 * переходы в пятую долю секунды, лист выезжает за треть. Подпрыгивающий
 * интерфейс контракт запрещает прямо.
 */
export const MOTION = {
  press: 140,
  pressScale: 0.985,
  standard: 220,
  sheet: 320,
  /** Пружина для выбора и листов: без заметного перелёта. */
  spring: { damping: 22, stiffness: 240, mass: 1 },
  springSheet: { damping: 26, stiffness: 220, mass: 1 },
} as const;

/**
 * Цвет полосы нутриента: сиреневый в норме, оранжевый при переборе
 * больше чем на 5 %. Правило взято из веба (`macroCol` в `app.js`) —
 * там же и порог, менять его нужно в обоих местах сразу.
 *
 * На «Сегодня» цвета другие: там у каждого нутриента свой (`mp`/`mf`/`mc`),
 * потому что рядом нет плана, с которым можно сравнить.
 */
export function macroColor(p: Palette, cur: number, target: number): string {
  return target && cur / target > 1.05 ? p.warn : p.mp;
}

/**
 * Цвет раздела цикла — тот же, что в вебе: `#C28D7F` в `screens.css`
 * (`.cycle-day.period`, `.cycle-overview-ring`, `.health-cycle-card`).
 * Раньше приложение красило цикл в шалфей — это было решение «как лучше»,
 * а не перенос, и разделы выглядели из разных продуктов.
 */
export const CYCLE = '#C28D7F';

/**
 * Звезда оценки — янтарная, значение из веба (`.dish-rate-stars button.on`,
 * `.dish-community-rating .ic`). Один цвет на оценку блюда и отзыв о
 * специалисте: раньше они были разными оттенками.
 */
export const STAR = '#F5AE32';

/**
 * Смешение цвета с подложкой — то же, что `color-mix(in srgb, a p%, b)`
 * в CSS веба: доля цвета поверх фона панели, в sRGB, без гаммы.
 */
export function mix(color: string, pct: number, over: string): string {
  const rgb = (h: string): [number, number, number] => {
    const s = h.replace('#', '');
    const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = rgb(color);
  const [r2, g2, b2] = rgb(over);
  const k = Math.max(0, Math.min(1, pct / 100));
  const to = (a: number, b: number) => Math.round(a * k + b * (1 - k));
  return `#${[to(r1, r2), to(g1, g2), to(b1, b2)]
    .map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Тот же цвет с прозрачностью — как `color-mix(… , transparent)`. */
export function alpha(color: string, pct: number): string {
  const s = color.replace('#', '');
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, pct / 100))})`;
}
