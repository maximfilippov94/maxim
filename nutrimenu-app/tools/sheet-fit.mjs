/**
 * Поместится ли шторка замены на каждом телефоне.
 *
 * Высота шторки задана долей экрана, а шапка и кнопка снизу —
 * постоянные: что останется списку, зависит от размера экрана и от
 * системного размера шрифта. На большом экране это четыре карточки, на
 * маленьком может не остаться ни одной — и узнать об этом хочется
 * здесь, а не от человека с iPhone SE.
 *
 * Это расчёт, а не рендер: высоты текста берутся из `theme.ts` по
 * размеру шрифта и межстрочью, без переносов и без подгонки шрифта
 * системой. Поэтому числа ниже — оценка, и расходиться с устройством
 * они будут на единицы точек, а не на десятки.
 *
 * Запуск из папки nutrimenu-app:
 *   node tools/sheet-fit.mjs
 *
 * Выход 1, если где-то списку остаётся меньше одной карточки.
 */

/* Телефоны, на которых приложение открывают. Высота в точках и нижняя
   безопасная зона: у старых её нет, у всех с чёлкой и островом — 34. */
const PHONES = [
  { name: 'iPhone SE (3-е пок.)', h: 667, bottom: 0 },
  { name: 'Android 5"',           h: 640, bottom: 0 },
  { name: 'iPhone 13 mini',       h: 812, bottom: 34 },
  { name: 'iPhone 12 / 13 / 14',  h: 844, bottom: 34 },
  { name: 'iPhone 14 Pro / 15 / 16', h: 852, bottom: 34 },
  { name: 'iPhone 15 Plus',       h: 926, bottom: 34 },
  { name: 'iPhone 16 Pro Max',    h: 956, bottom: 34 },
];

/* Во сколько раз крупнее системный шрифт. 1 — обычный, 1.35 — из тех
   размеров, что люди реально ставят, когда плохо видят. */
const SCALES = [1, 1.35];

const SHEET = 0.92;   // доля экрана — то же число, что в ReplacePicker

/* Постоянные части шторки. Собраны из стилей: ручка, шапка, подвал. */
const line = (fontSize, lineHeight) => lineHeight ?? Math.round(fontSize * 1.3);

function fixed(scale, bottom) {
  const grip = 10 + 4 + 8;                       // marginTop + высота + marginBottom
  const head = line(12 * scale)                  // «Замена без пересборки дня»
    + 2 + line(22 * scale)                       // «Чем заменить»
    + 4 + line(14 * scale, 18 * scale)           // пояснение, одна строка
    + 12;                                        // paddingBottom S.md
  /* Подпись про калорийность уехала в конец прокрутки — снизу
     закреплена одна кнопка (и строка ошибки, когда она есть). */
  const foot = 12                                // paddingTop S.md
    + Math.max(52, 52 * scale);                  // кнопка
  const safe = bottom + 16;                      // paddingBottom insets + S.lg
  return { grip, head, foot, safe, all: grip + head + foot + safe };
}

/* Карточка замены: фото 84 и текст рядом — берём, что выше. Текст
   меняется от числа строк в названии и рядов плашек КБЖУ. */
function card(scale, big) {
  const text = 11 * 2                            // paddingVertical
    + (big ? 2 : 1) * line(15 * scale, 19 * scale)
    + 4 + line(14 * scale, 18 * scale)
    + 3 + line(11 * scale)
    + 7 + (big ? 2 : 1) * line(11 * scale, 20 * scale) + (big ? 5 : 0);
  return Math.max(84, text) + 10 * 2 + 3;        // padding + рамка 1.5×2
}

let bad = 0;
for (const scale of SCALES) {
  console.log(`\n── Шрифт ×${scale}`);
  console.log('устройство                 шторка  списку  карточек');
  for (const p of PHONES) {
    const sheet = Math.round(p.h * SHEET);
    const f = fixed(scale, p.bottom);
    const rest = sheet - f.all;
    const big = card(scale, true), small = card(scale, false);
    const nBig = Math.floor((rest + 8) / (big + 8));
    const nSmall = Math.floor((rest + 8) / (small + 8));
    const flag = nSmall < 1 ? '  ← не влезает ни одной' : '';
    if (nSmall < 1) bad++;
    console.log(
      `${p.name.padEnd(26)} ${String(sheet).padStart(4)}  ${String(rest).padStart(5)}`
      + `   ${nBig}–${nSmall}${flag}`);
  }
}

console.log(`\nКарточка: ${card(1, false)} точек обычная, ${card(1, true)} крупная`
  + ` (название в две строки, плашки в два ряда).`);
console.log('Кнопка «Подтвердить замену» лежит вне прокрутки — видна всегда.');

if (bad) {
  console.log(`\nГде-то списку не остаётся ни одной карточки: ${bad}.`);
  process.exit(1);
}
console.log('\nВезде помещается хотя бы одна карточка целиком.');
