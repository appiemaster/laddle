// Draws the app icons (no dependencies): three rows of tiles turning blue one
// step at a time between two thin ladder rails, the changed tile bordered
// coral, on white.
//
//   node scripts/make-icons.mjs  -> public/*.png + public/favicon.svg

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const BG = [0xff, 0xff, 0xff];
const GREY = [0xd3, 0xd6, 0xda];
const BLUE = [0x4c, 0x6f, 0xd6];
const CORAL = [0xe2, 0x70, 0x4f];
const RAIL = [0xd3, 0xd6, 0xda];

// Rows of tiles: L = blue (matches), G = grey, * = blue and just changed (coral border).
const ROWS = ["GGLG", "*GLG", "LLLL"];

// Shapes in a 1x1 box: [x, y, w, h, radius, color].
function shapes(scale, roundBg) {
  const out = [[0, 0, 1, 1, roundBg ? 0.22 : 0, BG]];
  const tile = 0.15 * scale;
  const gap = 0.028 * scale;
  const w = 4 * tile + 3 * gap;
  const h = 3 * tile + 2 * gap;
  const x0 = (1 - w) / 2;
  const y0 = (1 - h) / 2;
  const rail = 0.018 * scale;
  out.push([x0 - gap - rail, y0 - gap, rail, h + 2 * gap, rail / 2, RAIL]);
  out.push([x0 + w + gap, y0 - gap, rail, h + 2 * gap, rail / 2, RAIL]);
  ROWS.forEach((row, r) =>
    [...row].forEach((c, i) => {
      const x = x0 + i * (tile + gap);
      const y = y0 + r * (tile + gap);
      if (c === "*") {
        const edge = tile * 0.09;
        out.push([x, y, tile, tile, tile * 0.08, CORAL]);
        out.push([x + edge, y + edge, tile - 2 * edge, tile - 2 * edge, tile * 0.04, BLUE]);
      } else {
        out.push([x, y, tile, tile, tile * 0.08, c === "G" ? GREY : BLUE]);
      }
    }),
  );
  return out;
}

function inside(px, py, [x, y, w, h, r]) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function render(size, list, transparentOutside) {
  const SS = 4;
  const data = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    data[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;
          let color = null;
          for (const s of list) if (inside(px, py, s)) color = s[5];
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += 255;
          } else if (!transparentOutside) {
            a += 0;
          }
        }
      const n = SS * SS;
      const covered = a / 255 || 1;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      data[o] = Math.round(r / covered);
      data[o + 1] = Math.round(g / covered);
      data[o + 2] = Math.round(b / covered);
      data[o + 3] = Math.round(a / n);
    }
  }
  return png(size, data);
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const tb = Buffer.concat([Buffer.from(type), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tb));
  return Buffer.concat([len, tb, crc]);
}
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
function svg(list) {
  const body = list
    .map(([x, y, w, h, r, c]) => {
      const f = (v) => +(v * 100).toFixed(2);
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${hex(c)}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>\n`;
}

const icon = shapes(1, true);
const full = shapes(1, false); // iOS rounds the corners itself
const maskable = shapes(0.8, false); // inside the maskable safe zone
writeFileSync(join(PUBLIC, "icon-192.png"), render(192, icon));
writeFileSync(join(PUBLIC, "icon-512.png"), render(512, icon));
writeFileSync(join(PUBLIC, "icon-maskable-512.png"), render(512, maskable));
writeFileSync(join(PUBLIC, "apple-touch-icon.png"), render(180, full));
writeFileSync(join(PUBLIC, "favicon.svg"), svg(icon));
console.log("icons written to", PUBLIC);
