/* تولید آیکون‌های PNG پی‌نما — بدون وابستگی (zlib داخلی Node)
 * اجرا:  node tools/gen-icons.js
 * خروجی: icons/icon-192.png, icon-512.png, icon-maskable-512.png, favicon-64.png
 */
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ─── CRC32 برای چانک‌های PNG ─── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ─── نقاشی π روی پس‌زمینه بنفش (گرادیان عمودی) ─── */
const PURPLE_TOP = [125, 70, 229];   // #7d46e5
const PURPLE_BOTTOM = [91, 47, 179]; // #5b2fb3
const GOLD = [247, 201, 72];         // #f7c948

function inPiGlyph(nx, ny, scale) {
  // مختصات نرمال 0..1 نسبت به مرکز
  const x = (nx - 0.5) / scale + 0.5;
  const y = (ny - 0.5) / scale + 0.5;
  // خط افقی بالایی
  if (y >= 0.24 && y <= 0.315 && x >= 0.22 && x <= 0.78) return true;
  // پای چپ
  if (x >= 0.315 && x <= 0.385 && y >= 0.24 && y <= 0.76) return true;
  // پای راست
  if (x >= 0.615 && x <= 0.685 && y >= 0.24 && y <= 0.76) return true;
  return false;
}

function roundedOutside(nx, ny, r) {
  const x = Math.abs(nx - 0.5), y = Math.abs(ny - 0.5);
  const dx = x - (0.5 - r), dy = y - (0.5 - r);
  return dx > 0 && dy > 0 && Math.sqrt(dx * dx + dy * dy) > r;
}

function render(size, opts) {
  const SS = 4; // supersampling برای لبه‌های نرم
  const W = size * SS;
  const rgba = Buffer.alloc(size * size * 4);
  const r = opts.maskable ? 0 : 0.22;         // گوشه گرد فقط برای معمولی
  const glyphScale = opts.maskable ? 0.68 : 1; // ناحیه امن maskable

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let covBg = 0, covGlyph = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (px * SS + sx + 0.5) / W;
          const ny = (py * SS + sy + 0.5) / W;
          const inside = r === 0 ? true : !roundedOutside(nx, ny, r);
          if (inside) {
            covBg++;
            if (inPiGlyph(nx, ny, glyphScale)) covGlyph++;
          }
        }
      }
      const total = SS * SS;
      const bgA = covBg / total;
      const gA = covGlyph / total;
      const t = py / size;
      let cr = PURPLE_TOP[0] + (PURPLE_BOTTOM[0] - PURPLE_TOP[0]) * t;
      let cg = PURPLE_TOP[1] + (PURPLE_BOTTOM[1] - PURPLE_TOP[1]) * t;
      let cb = PURPLE_TOP[2] + (PURPLE_BOTTOM[2] - PURPLE_TOP[2]) * t;
      if (gA > 0) {
        cr = cr * (1 - gA) + GOLD[0] * gA;
        cg = cg * (1 - gA) + GOLD[1] * gA;
        cb = cb * (1 - gA) + GOLD[2] * gA;
      }
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(cr);
      rgba[i + 1] = Math.round(cg);
      rgba[i + 2] = Math.round(cb);
      rgba[i + 3] = Math.round(bgA * 255);
    }
  }
  return encodePng(rgba, size, size);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const jobs = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['favicon-64.png', 64, { maskable: false }]
];

for (const [name, size, opts] of jobs) {
  const buf = render(size, opts);
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(name, size + 'x' + size, (buf.length / 1024).toFixed(1) + ' KB');
}
console.log('✓ آیکون‌ها ساخته شدند');
