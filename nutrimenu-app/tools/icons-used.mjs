/**
 * Значки, которых нет.
 *
 * `Icon` получает имя строкой. Нет такого имени в `PATHS` — компонент
 * молча рисует домик (`PATHS[name] ?? PATHS.home`), и «Мои специалисты»
 * оказываются с домиком вместо людей. Опечатку в имени не поймает ни
 * tsc, ни линтер: строка есть строка.
 *
 * Здесь собираются все имена из кода и сверяются с двумя списками в
 * `src/ui/Icon.tsx`: своим рисунком (`PATHS`) и системным символом (`SF`).
 *
 * Запуск из папки nutrimenu-app:
 *   node tools/icons-used.mjs
 *
 * Выход 1, если нашлось хоть одно имя без рисунка.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const src = readFileSync('src/ui/Icon.tsx', 'utf8');

/** Ключи верхнего уровня нужного объекта. */
function keys(objName) {
  const at = src.indexOf(objName);
  if (at < 0) return new Set();
  const open = src.indexOf('{', at);
  let d = 0, end = open;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) { end = i; break; } }
  }
  const body = src.slice(open + 1, end);
  return new Set([...body.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*:/gm)].map(m => m[1]));
}

const paths = keys('const PATHS');
const sf = keys('export const SF');

const files = execSync("find src app -name '*.tsx'", { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);

/** Имя значка берём там, где его точно подставляют в `Icon`. */
const used = new Map();
for (const f of files) {
  const t = readFileSync(f, 'utf8');
  /* Считаем всё, кроме тех, кто ждёт имя системного символа:
     `SysButton`, `Empty` и `SfIcon` зовут UIKit напрямую, и «scalemass»
     у них — верное имя, а не пропавший рисунок. Перечислены именно они,
     а не наоборот: список своих потребителей значка растёт, и замер,
     знающий только их, молча перестанет смотреть на новые. */
  const SYSTEM = new Set(['SysButton', 'Empty', 'SfIcon', 'SymbolView', 'ContentUnavailableView']);
  const res = [
    /<Icon\s+name=["']([a-zA-Z0-9_]+)["']/g,
    /<([A-Z][\w]*)\b[^>]*?\sicon=["']([a-zA-Z0-9_]+)["']/gs,
    /\bfallbackIcon=["']([a-zA-Z0-9_]+)["']/g,
  ];
  for (const re of res) {
    for (const m of t.matchAll(re)) {
      /* У второй выборки первая скобка — имя тега, у остальных — значка. */
      const tag = m[2] ? m[1] : null;
      const name = m[2] ?? m[1];
      if (tag && SYSTEM.has(tag)) continue;
      const line = t.slice(0, m.index).split('\n').length;
      if (!used.has(name)) used.set(name, []);
      used.get(name).push(`${f}:${line}`);
    }
  }
}

const missing = [...used.keys()].filter(n => !paths.has(n)).sort();
const sfOnly = [...used.keys()].filter(n => paths.has(n) && !sf.has(n)).sort();

if (sfOnly.length) {
  console.log(`Есть рисунок, нет системного символа — ${sfOnly.length}:`);
  console.log('  ' + sfOnly.join(', '));
  console.log('  (не поломка: на iOS возьмётся свой рисунок)\n');
}

if (!missing.length) {
  console.log(`Все ${used.size} имён значков нарисованы.`);
  process.exit(0);
}
console.log(`Имён без рисунка — ${missing.length} (покажется домик):\n`);
for (const n of missing) {
  console.log(`  ${n}`);
  for (const w of used.get(n).slice(0, 6)) console.log(`     ${w}`);
  if (used.get(n).length > 6) console.log(`     … ещё ${used.get(n).length - 6}`);
}
process.exit(1);
