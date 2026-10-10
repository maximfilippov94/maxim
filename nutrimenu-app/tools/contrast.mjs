/* Замер контраста текста на заливке в исходниках приложения.
   Ищем пары «backgroundColor: X» и ближайший ниже «color: Y» в том же
   куске разметки, разворачиваем тернарники в варианты, считаем контраст
   WCAG по обеим палитрам. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const SRC = fs.readFileSync(path.join(ROOT, 'src/theme.ts'), 'utf8');

/* --- палитры из theme.ts --- */
function palette(name) {
  const m = SRC.match(new RegExp('export const ' + name + ': Palette = \\{([\\s\\S]*?)\\n\\};'));
  const out = {};
  for (const line of m[1].split('\n')) {
    const re = /(\w+):\s*'([^']+)'/g; let k;
    while ((k = re.exec(line))) out[k[1]] = k[2];
  }
  return out;
}
const DARK = palette('NAVY'), LIGHT = palette('PORCELAIN');
const AUTH = {};
{
  const m = fs.readFileSync(path.join(ROOT, 'src/ui/AuthShell.tsx'), 'utf8')
    .match(/export const ON_PHOTO = \{([\s\S]*?)\};/);
  const re = /(\w+):\s*'([^']+)'/g; let k;
  while ((k = re.exec(m[1]))) AUTH[k[1]] = k[2];
}

/* --- цвет --- */
function rgb(c) {
  if (!c) return null;
  c = c.trim();
  let m = c.match(/^#([0-9a-fA-F]{6})$/);
  if (m) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 1]; }
  m = c.match(/^#([0-9a-fA-F]{3})$/);
  if (m) { const h = m[1]; return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16), 1]; }
  m = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  return null;
}
const over = (fg, bg) => fg[3] >= 1 ? fg
  : [0,1,2].map(i => fg[i]*fg[3] + bg[i]*(1-fg[3])).concat(1);
function lum([r,g,b]) {
  const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055) ** 2.4; };
  return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x,y) => y-x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/* --- разрешение выражения цвета в набор возможных значений ---
   Тернарник даёт две ветки, и условие запоминаем: если фон и текст
   зависят от одного и того же условия, нельзя брать фон включённой
   кнопки с текстом выключенной — такого сочетания на экране не бывает,
   и именно эти пары давали ложную тревогу. */
function split(expr) {
  const q = expr.indexOf('?');
  if (q < 0) return { cond: null, parts: [expr.trim()] };
  const cond = expr.slice(0, q).trim();
  const rest = expr.slice(q + 1);
  const c = rest.lastIndexOf(':');
  if (c < 0) return { cond: null, parts: [expr.trim()] };
  return { cond, parts: [rest.slice(0, c).trim(), rest.slice(c + 1).trim()] };
}
function resolve(expr, pal, page) {
  const out = [];
  const { cond, parts } = split(expr);
  out.cond = cond;
  for (let bi = 0; bi < parts.length; bi++) {
    const raw = parts[bi];
    const tok = n => rgb(pal[n]);
    let c = rgb(raw.replace(/^['"]|['"]$/g, ''));
    /* Порядок важен: сначала обёртки alpha/mix и hex-хвост, и только
       потом голый токен. Иначе внутри «alpha(p.warn, 12)» находится
       p.warn, и за фон принимается сам warn вместо его подложки. */
    if (!c) {
      let m = raw.match(/alpha\(\s*(?:p|ON_PHOTO|pal)\.(\w+)\s*,\s*([\d.]+)\s*\)/);
      if (m && tok(m[1])) { const b = tok(m[1]); c = [b[0], b[1], b[2], (+m[2]) / 100]; }
    }
    if (!c) {
      let m = raw.match(/mix\(\s*(?:p|ON_PHOTO|pal)\.(\w+)\s*,\s*([\d.]+)\s*,\s*(?:(?:p|ON_PHOTO|pal)\.(\w+)|['"]([^'"]+)['"])\s*\)/);
      if (m && tok(m[1])) {
        const a = tok(m[1]), o = m[3] ? tok(m[3]) : rgb(m[4]);
        if (o) { const k = (+m[2]) / 100; c = [0,1,2].map(i => Math.round(a[i]*k + o[i]*(1-k))).concat(1); }
      }
    }
    if (!c) {
      let m = raw.match(/(?:p|ON_PHOTO|pal)\.(\w+)\s*\+\s*['"]([0-9a-fA-F]{2})['"]/);
      if (m && tok(m[1])) { const b = tok(m[1]); c = [b[0], b[1], b[2], parseInt(m[2], 16) / 255]; }
    }
    if (!c) {
      const m = raw.match(/\b(?:p|pal|palette|ON_PHOTO|th)\.(\w+)\b/);
      if (m) c = tok(m[1]);
    }
    if (c) out.push({ src: raw, c, branch: parts.length > 1 ? bi : null });
  }
  return out;
}

/* --- обход файлов --- */
function files(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/* Пять строк вниз и отступ не меньше: текст, лежащий на этой заливке,
   либо стоит в том же объекте стиля, либо вложен в этот элемент. Текст
   следующего блока в разметке всегда левее или дальше. */
/* Выражение цвета кончается на запятой или скобке ВЕРХНЕГО уровня:
   «alpha(p.warn, 12)» — одно выражение, а не «alpha(p.warn». На этой
   обрезке замер выдавал ложную тревогу: за фон принимался сам warn. */
function expr(line, from) {
  let d = 0;
  for (let k = from; k < line.length; k++) {
    const ch = line[k];
    if (ch === '(' || ch === '[' || ch === '{') d++;
    else if (ch === ')' || ch === ']' || ch === '}') { if (d === 0) return line.slice(from, k); d--; }
    else if (ch === ',' && d === 0) return line.slice(from, k);
  }
  return line.slice(from);
}

const WINDOW = 6;
const problems = [];

for (const f of [...files(path.join(ROOT, 'src')), ...files(path.join(ROOT, 'app'))]) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const auth = /AuthShell|ON_PHOTO/.test(lines.join('\n'));
  for (let i = 0; i < lines.length; i++) {
    const bgi = lines[i].search(/backgroundColor:\s*/);
    if (bgi < 0) continue;
    const bgm = [null, expr(lines[i], lines[i].indexOf(':', bgi) + 1).trim()];
    for (let j = i; j < Math.min(lines.length, i + WINDOW); j++) {
      const fgr = /(?:^|[^a-zA-Z])color[:=]\s*\{?/.exec(lines[j]);
      if (!fgr) continue;
      const fgm = [null, expr(lines[j], fgr.index + fgr[0].length).trim()];
      fgm.index = fgr.index;
      if (/backgroundColor|borderColor|shadowColor|tintColor|placeholderTextColor|iconColor/.test(lines[j].slice(0, fgm.index + 1))) continue;
      const ind = t => t.length - t.replace(/^\s*/, '').length;
      if (j > i && ind(lines[j]) < ind(lines[i])) continue;
      for (const [palName, pal] of auth ? [['on-photo', AUTH]] : [['тёмная', DARK], ['светлая', LIGHT]]) {
        const page = rgb(pal.page ?? pal.sheet ?? '#121820');
        const bgs = resolve(bgm[1], pal, page);
        const fgs = resolve(fgm[1], pal, page);
        const sameCond = bgs.cond && fgs.cond && bgs.cond === fgs.cond;
        for (const b of bgs) for (const g of fgs) {
          if (sameCond && b.branch !== null && g.branch !== null && b.branch !== g.branch) continue;
          const bc = over(b.c, page), gc = over(g.c, bc);
          const r = ratio(gc, bc);
          if (r < 4.5) problems.push({
            file: path.relative(ROOT, f), line: j + 1, pal: palName,
            bg: b.src, fg: g.src, r: r.toFixed(2),
          });
        }
      }
      /* не прерываемся: на одной заливке бывают и значок, и подпись */
    }
  }
}

problems.sort((a, b) => a.r - b.r);
console.log('пар с контрастом ниже 4.5: ' + problems.length + '\n');
for (const p of problems) {
  console.log(`${p.r}  ${p.file}:${p.line}  [${p.pal}]  фон ${p.bg}  текст ${p.fg}`);
}

/* ── seedColor: цвет, которым SwiftUI красит свои подписи и значки ──
   `Host` из @expo/ui отдаёт его системным компонентам, и те красят им
   надпись стеклянной кнопки, значок пустого состояния, дорожку
   ползунка, галочки списка. Лайм (`primary`) на светлом полотне даёт
   контраст 1.04 — кнопки «+100» на экране воды не было видно вовсе,
   и нашлось это глазами владельца, а не здесь.
   `accent` для того и заведён: в тёмной теме тот же лайм, в светлой —
   чернила. Исключение — `danger` и цвета графиков: они свои. */
{
  const bad = [];
  for (const f of [...files(path.join(ROOT, 'src')), ...files(path.join(ROOT, 'app'))]) {
    const src = fs.readFileSync(f, 'utf8');
    src.split('\n').forEach((ln, i) => {
      const m = ln.match(/seedColor=\{([^}]+)\}/);
      if (!m) return;
      const v = m[1];
      if (/p\.primary/.test(v)) {
        bad.push(`${path.relative(ROOT, f)}:${i + 1}  seedColor={${v}}`);
      }
    });
  }
  if (bad.length) {
    console.log('\nseedColor лаймом — в светлой теме не видно (' + bad.length + '):');
    for (const b of bad) console.log('  ' + b);
  } else {
    console.log('\nseedColor: лайма нет ни в одном месте.');
  }
}
