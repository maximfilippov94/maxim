/* Обрезка PNG до нужного размера: окно браузера отдаёт на 87 строк
   больше запрошенного, и значок иначе выходит не квадратным. */
import fs from 'node:fs';
import zlib from 'node:zlib';

function readPng(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, w = 0, h = 0, depth = 0, type = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const tag = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (tag === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; }
    else if (tag === 'IDAT') idat.push(data);
    else if (tag === 'IEND') break;
    pos += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (depth !== 8 || !ch) throw new Error('не поддержано: depth ' + depth + ' type ' + type);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++], line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, px: out };
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(tag, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(tag, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePng(file, { w, h, ch, px }) {
  const type = ch === 4 ? 6 : ch === 3 ? 2 : ch === 2 ? 4 : 0;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = type;
  const stride = w * ch, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

const [, , src, dst, sizeArg, flatten] = process.argv;
const img = readPng(src);
const size = +sizeArg;
const stride = img.w * img.ch, out = Buffer.alloc(size * size * img.ch);
for (let y = 0; y < size; y++)
  img.px.copy(out, y * size * img.ch, y * stride, y * stride + size * img.ch);
let res = { w: size, h: size, ch: img.ch, px: out };
/* Значок App Store не терпит прозрачности: подкладываем цвет. */
if (flatten && img.ch === 4) {
  const bg = [flatten.slice(1, 3), flatten.slice(3, 5), flatten.slice(5, 7)].map(x => parseInt(x, 16));
  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0, j = 0; i < out.length; i += 4, j += 3) {
    const a = out[i + 3] / 255;
    for (let k = 0; k < 3; k++) rgb[j + k] = Math.round(out[i + k] * a + bg[k] * (1 - a));
  }
  res = { w: size, h: size, ch: 3, px: rgb };
}
writePng(dst, res);
console.log(dst.split('/').pop(), size + 'x' + size, res.ch === 3 ? 'без прозрачности' : 'с прозрачностью');
