/**
 * 生成 PWA 图标与 favicon
 *
 * 不依赖任何第三方库：直接用 Node 内置的 zlib 手写 PNG 编码，
 * 图形由代码绘制（渐变圆角底 + 白色水滴），保证离线也能重建图标。
 *
 * 用法：node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/* ---------------------------- PNG 编码 ---------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------------------------- 图形绘制 ---------------------------- */

const START = [244, 143, 177]; // #F48FB1
const END = [140, 107, 214]; // #8C6BD6

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function insideRoundedRect(x, y, size, radius) {
  const left = radius;
  const right = size - radius;
  const top = radius;
  const bottom = size - radius;
  if (x >= left && x <= right) return y >= 0 && y <= size;
  if (y >= top && y <= bottom) return x >= 0 && x <= size;
  const cx = x < left ? left : right;
  const cy = y < top ? top : bottom;
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function insideDroplet(x, y, size, scale) {
  const cx = size / 2;
  const centerY = size * 0.63;
  const radius = size * 0.185 * scale;
  const apexY = centerY - radius * 1.95;

  const inCircle = (x - cx) ** 2 + (y - centerY) ** 2 <= radius ** 2;
  if (inCircle) return true;
  if (y >= apexY && y <= centerY) {
    const halfWidth = radius * ((y - apexY) / (centerY - apexY));
    return Math.abs(x - cx) <= halfWidth;
  }
  return false;
}

function renderIcon(size, { maskable = false } = {}) {
  const buffer = Buffer.alloc(size * size * 4);
  const radius = maskable ? size * 0.5 : size * 0.235;
  const glyphScale = maskable ? 0.72 : 1;
  const samples = 3;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let bgCoverage = 0;
      let glyphCoverage = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          const insideBg =
            maskable && radius >= size / 2
              ? (px - size / 2) ** 2 + (py - size / 2) ** 2 <= (size / 2) ** 2
              : insideRoundedRect(px, py, size, radius);
          if (insideBg) bgCoverage += 1;
          if (insideDroplet(px, py, size, glyphScale)) glyphCoverage += 1;
        }
      }

      const total = samples * samples;
      const bgA = bgCoverage / total;
      const glyphA = glyphCoverage / total;

      const t = Math.min(1, (x / size) * 0.55 + (y / size) * 0.45);
      let [r, g, b] = mix(START, END, t);

      // 左上角柔和高光
      const dist = Math.hypot(x - size * 0.28, y - size * 0.22) / (size * 0.75);
      const highlight = Math.max(0, 1 - dist) * 0.22;
      r = r + (255 - r) * highlight;
      g = g + (255 - g) * highlight;
      b = b + (255 - b) * highlight;

      // 水滴（白色）覆盖在底色之上
      r = r + (255 - r) * glyphA;
      g = g + (255 - g) * glyphA;
      b = b + (255 - b) * glyphA;

      const index = (y * size + x) * 4;
      buffer[index] = Math.round(r);
      buffer[index + 1] = Math.round(g);
      buffer[index + 2] = Math.round(b);
      buffer[index + 3] = Math.round(bgA * 255);
    }
  }

  return encodePng(size, size, buffer);
}

function buildIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

const targets = [
  { path: "public/icons/icon-192.png", data: renderIcon(192) },
  { path: "public/icons/icon-512.png", data: renderIcon(512) },
  { path: "public/icons/icon-maskable-512.png", data: renderIcon(512, { maskable: true }) },
  { path: "public/icons/apple-icon-180.png", data: renderIcon(180) },
  { path: "src/app/favicon.ico", data: buildIco(renderIcon(32), 32) },
  { path: "public/icon.png", data: renderIcon(96) },
];

for (const target of targets) {
  const full = resolve(ROOT, target.path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, target.data);
  console.log(`written ${target.path} (${target.data.length} bytes)`);
}
