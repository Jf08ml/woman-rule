// Genera los iconos PNG de la PWA sin dependencias (zlib nativo).
// Diseño: luna creciente blanca sobre fondo rosa con degradado.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const SS = 4; // supersampling para antialiasing
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0; raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0; raw[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
// Luna creciente: círculo menos círculo desplazado. scale = tamaño relativo (zona segura maskable)
const crescent = (x, y, scale) => {
  const r = 0.30 * scale;
  return inCircle(x, y, 0.5, 0.5, r) && !inCircle(x, y, 0.5 + r * 0.55, 0.5 - r * 0.35, r * 0.85);
};
const bg = (x, y) => {
  const t = (x + y) / 2; // degradado diagonal #f06b8a -> #c93a6a
  return [Math.round(240 - 39 * t), Math.round(107 - 49 * t), Math.round(138 - 32 * t), 1];
};
const app = (scale, rounded) => (x, y) => {
  if (rounded) {
    const R = 0.22, cx = Math.min(Math.max(x, R), 1 - R), cy = Math.min(Math.max(y, R), 1 - R);
    if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) return [0, 0, 0, 0];
  }
  return crescent(x, y, scale) ? [255, 255, 255, 1] : bg(x, y);
};
const badge = (x, y) => (crescent(x, y, 1.45) ? [255, 255, 255, 1] : [0, 0, 0, 0]);

const files = {
  'icon-192.png': png(192, app(1, true)),
  'icon-512.png': png(512, app(1, true)),
  'maskable-512.png': png(512, app(0.8, false)),
  'apple-touch-icon.png': png(180, app(1, false)),
  'badge-96.png': png(96, badge),
};
for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('Icono generado:', name, buf.length, 'bytes');
}
