/* Замер цвета в точках PNG: распаковываем сами, чтобы не ставить библиотек. */
import fs from 'node:fs';
import zlib from 'node:zlib';

const buf = fs.readFileSync(process.argv[2]);
let pos = 8, w = 0, h = 0, depth = 0, type = 0, idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const tag = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (tag === 'IHDR') {
    w = data.readUInt32BE(0); h = data.readUInt32BE(4);
    depth = data[8]; type = data[9];
  } else if (tag === 'IDAT') idat.push(data);
  else if (tag === 'IEND') break;
  pos += 12 + len;
}
const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
if (depth !== 8 || !ch) { console.log('не поддержано: depth', depth, 'type', type); process.exit(1); }
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = w * ch;
const out = Buffer.alloc(h * stride);
let p = 0;
for (let y = 0; y < h; y++) {
  const f = raw[p++];
  const line = raw.subarray(p, p + stride); p += stride;
  const cur = out.subarray(y * stride, (y + 1) * stride);
  const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
  for (let x = 0; x < stride; x++) {
    const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
    let v = line[x];
    if (f === 1) v += a;
    else if (f === 2) v += b;
    else if (f === 3) v += (a + b) >> 1;
    else if (f === 4) {
      const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
      v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
    }
    cur[x] = v & 255;
  }
}
const hex = (x, y) => {
  const i = y * stride + x * ch;
  return '#' + [out[i], out[i + 1], out[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('')
    + (ch === 4 ? ' a=' + out[i + 3] : '');
};
console.log(`${w}x${h}, каналов ${ch}`);
for (const [name, x, y] of [
  ['верх-лево', 40, 40], ['верх-право', w - 40, 40],
  ['низ-лево', 40, h - 40], ['низ-право', w - 40, h - 40],
  ['центр', w >> 1, h >> 1], ['буква', Math.round(w * 0.5), Math.round(h * 0.22)],
]) console.log(name.padEnd(12), hex(x, y));

/* Границы знака: где на картинке тёмные пиксели. */
let minx = w, miny = h, maxx = -1, maxy = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = y * stride + x * ch;
  const lum = (out[i] + out[i + 1] + out[i + 2]) / 3;
  if (lum < 90 && (ch < 4 || out[i + 3] > 128)) {
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
}
console.log('знак: x', minx, '…', maxx, ' y', miny, '…', maxy);
console.log('поля: слева', (minx / w * 100).toFixed(1) + '%',
  'справа', ((w - 1 - maxx) / w * 100).toFixed(1) + '%',
  'сверху', (miny / h * 100).toFixed(1) + '%',
  'снизу', ((h - 1 - maxy) / h * 100).toFixed(1) + '%');
console.log('знак занимает', ((maxx - minx + 1) / w * 100).toFixed(1) + '% ширины,',
  ((maxy - miny + 1) / h * 100).toFixed(1) + '% высоты');
