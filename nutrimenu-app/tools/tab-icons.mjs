/**
 * Значки нижней панели из наших же рисунков.
 *
 * Системная панель берёт либо имя SF-символа, либо картинку: веса у
 * символа ей не передать (в типах `NativeTabs` лежит только имя), а наш
 * SVG-компонент она не примет — в её коде прямо сказано, что React-ом
 * можно отдать только `VectorIcon`. Остаётся картинка.
 *
 * Поэтому берём пути из `src/ui/Icon.tsx` — те самые, которыми нарисовано
 * всё приложение, — и печатаем их в PNG нужной толщины. До этого в панели
 * стояли системные символы: домик там и домик в списке «Ещё» были разные
 * домики.
 *
 * Рисуем белым: панель получает картинку в режиме `template`, то есть
 * красит её сама — в наш лайм на выбранной вкладке и в серый на прочих.
 * Значение имеет только прозрачность.
 *
 * Запуск из папки nutrimenu-app (после правки любого из этих значков):
 *   node tools/tab-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

/* Что нужно двум панелям: клиенту — свои пять, специалисту — свои. */
const NEED = ['home', 'cal', 'chat', 'dumbbell', 'kebab', 'users', 'grid'];

/* 25 точек — размер значка в панели iOS; три плотности, как у любой
   картинки в приложении. Толщина 1.5 на сетке 24 — то, ради чего всё
   и затевалось: системные символы рисуются заметно жирнее. */
const PT = 25;
const STROKE = 1.5;
const SCALES = [1, 2, 3];

const src = readFileSync('src/ui/Icon.tsx', 'utf8');
const at = src.indexOf('const PATHS');
const open = src.indexOf('{', at);
let d = 0, end = open;
for (let i = open; i < src.length; i++) {
  if (src[i] === '{') d++;
  else if (src[i] === '}') { d--; if (!d) { end = i; break; } }
}
const body = src.slice(open + 1, end);

const PATHS = {};
for (const m of body.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*:\s*'([^']+)'/gm)) {
  PATHS[m[1]] = m[2];
}

const missing = NEED.filter(n => !PATHS[n]);
if (missing.length) {
  console.error('Нет рисунка: ' + missing.join(', '));
  process.exit(1);
}

for (const name of NEED) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">`
    + `<path d="${PATHS[name]}" stroke="#ffffff" stroke-width="${STROKE}"`
    + ` stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  for (const k of SCALES) {
    const px = PT * k;
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: px } }).render().asPng();
    const suffix = k === 1 ? '' : `@${k}x`;
    writeFileSync(`assets/tabs/${name}${suffix}.png`, png);
  }
  console.log(`${name}: ${PT}×${PT} ×1 ×2 ×3`);
}
console.log(`\nГотово: ${NEED.length} значков, толщина ${STROKE}.`);
