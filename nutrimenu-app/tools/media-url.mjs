/**
 * Картинки с адресом «как пришёл с сервера».
 *
 * Сервер отдаёт пути относительные — «/api/v1/avatar/abc.jpg». В вебе
 * такой адрес браузер достраивает сам, а `Image` в приложении его
 * просто не грузит: остаётся серый прямоугольник подложки, и выглядит
 * он как «фотографии нет», а не как «адрес неправильный». Так пропало
 * фото профиля в шапке главного экрана — и вместе с ним, молча, все
 * аватары в чатах, списках клиентов и на звонке.
 *
 * Достраивает адрес `mediaUrl` (и обёртки `thumbUrl`, `fetchPrivateFile`).
 * Здесь ищутся места, где её забыли.
 *
 * Запуск из папки nutrimenu-app:
 *   node tools/media-url.mjs
 *
 * Выход 1, если нашлось хоть одно место.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const SAFE = /mediaUrl|thumbUrl|fetchPrivateFile|require\(/;
/* Снимок с камеры и выбранный файл уже лежат на устройстве: у них
   адрес вида file://…, достраивать нечего. */
const LOCAL = /\bfile\b|\bpicked\b|\bshot\b|\blocal\b|\buriLocal\b/i;

const files = execSync(
  "find src app -name '*.tsx' -o -name '*.ts'", { encoding: 'utf8' },
).trim().split('\n').filter(Boolean);

/** Что подставили в `uri:` — одно выражение, со счётом скобок. */
function expr(s, from) {
  let d = 0, out = '';
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) { if (d === 0) break; d--; }
    else if (c === ',' && d === 0) break;
    out += c;
  }
  return out.trim();
}

const bad = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const re = /source=\{\{\s*uri:\s*/g;
  let m;
  while ((m = re.exec(src))) {
    const e = expr(src, m.index + m[0].length);
    if (!e || e.startsWith("'") || e.startsWith('"') || e.startsWith('`')) continue;
    if (SAFE.test(e) || LOCAL.test(e)) continue;

    const ln = src.slice(0, m.index).split('\n').length;

    /* Переменную проверяем по её объявлению: `const photo = mediaUrl(…)`
       выше по файлу — это уже достроенный адрес. */
    const name = e.match(/^([A-Za-z_$][\w$]*)/)?.[1];
    if (name) {
      const decl = new RegExp(
        `(const|let|var)\\s+${name}\\b[^\\n]*|${name}\\s*=\\s*[^\\n]*`, 'g');
      const found = src.match(decl) ?? [];
      if (found.some(d => SAFE.test(d) || LOCAL.test(d))) continue;
      /* Свойство объекта с адресом устройства: `photo.uri`, `f.uri`. */
      if (/\.uri\b/.test(e)) continue;
    }
    bad.push({ f, ln, e, line: (lines[ln - 1] ?? '').trim() });
  }
}

if (!bad.length) {
  console.log('Картинок с недостроенным адресом нет.');
  process.exit(0);
}
console.log(`Адрес не прогнан через mediaUrl — ${bad.length}:\n`);
for (const b of bad) console.log(`  ${b.f}:${b.ln}  uri: ${b.e}\n    ${b.line}`);
console.log('\nЕсли адрес уже абсолютный, mediaUrl вернёт его как есть —');
console.log('обернуть безопасно в любом случае.');
process.exit(1);
