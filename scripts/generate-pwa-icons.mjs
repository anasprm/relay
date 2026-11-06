/**
 * Generates the Relay PWA icon set.
 *
 * The previous icons in `public/pwa` were 1x1 placeholder PNGs, which makes
 * Chrome/Safari refuse to install the app. This script renders a real branded
 * icon (WhatsApp-green gradient + white speech bubble with a relay bolt) at
 * every size the manifest lists, plus maskable variants with a safe zone.
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "pwa");

/* ---------------------------------- PNG ---------------------------------- */

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

function encodePng(width, height, rgb) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // no filter
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* -------------------------------- Drawing -------------------------------- */

const GREEN_LIGHT = [37, 211, 102]; // #25D366
const GREEN_DARK = [18, 140, 126]; // #128C7E
const WHITE = [255, 255, 255];

const lerp = (a, b, t) => a + (b - a) * t;

function inRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * @param {number} size output pixels
 * @param {number} contentScale 1 = edge-to-edge artwork, <1 = maskable safe zone
 */
function renderIcon(size, contentScale) {
  const ss = size <= 256 ? 4 : 3; // supersampling factor
  const width = size * ss;
  const pixels = Buffer.alloc(size * size * 3);

  // Artwork is laid out in a unit square, then scaled into the safe zone.
  const unit = width * contentScale;
  const offset = (width - unit) / 2;

  // Unit-space geometry.
  const bubbleW = unit * 0.58;
  const bubbleH = unit * 0.44;
  const bubbleR = unit * 0.14;
  const bubbleX = offset + (unit - bubbleW) / 2;
  const bubbleY = offset + (unit - bubbleH) / 2 - unit * 0.03;
  const dotR = unit * 0.045;
  const dotY = bubbleY + bubbleH / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x * ss + sx + 0.5;
          const py = y * ss + sy + 0.5;

          // Diagonal gradient background.
          const t = (px / width + py / width) / 2;
          let cr = lerp(GREEN_LIGHT[0], GREEN_DARK[0], t);
          let cg = lerp(GREEN_LIGHT[1], GREEN_DARK[1], t);
          let cb = lerp(GREEN_LIGHT[2], GREEN_DARK[2], t);

          const inBubble = inRoundedRect(px, py, bubbleX, bubbleY, bubbleW, bubbleH, bubbleR);
          const inTail = inTriangle(
            px,
            py,
            bubbleX + bubbleW * 0.16,
            bubbleY + bubbleH * 0.94,
            bubbleX + bubbleW * 0.42,
            bubbleY + bubbleH * 0.94,
            bubbleX + bubbleW * 0.12,
            bubbleY + bubbleH * 1.22,
          );

          const dot1 = (px - (bubbleX + bubbleW * 0.26)) ** 2 + (py - dotY) ** 2 <= dotR ** 2;
          const dot2 = (px - (bubbleX + bubbleW * 0.5)) ** 2 + (py - dotY) ** 2 <= dotR ** 2;
          const dot3 = (px - (bubbleX + bubbleW * 0.74)) ** 2 + (py - dotY) ** 2 <= dotR ** 2;

          if (inBubble || inTail) {
            cr = WHITE[0];
            cg = WHITE[1];
            cb = WHITE[2];
            if (dot1 || dot2 || dot3) {
              cr = GREEN_DARK[0];
              cg = GREEN_DARK[1];
              cb = GREEN_DARK[2];
            }
          }

          r += cr;
          g += cg;
          b += cb;
        }
      }

      const samples = ss * ss;
      const i = (y * size + x) * 3;
      pixels[i] = Math.round(r / samples);
      pixels[i + 1] = Math.round(g / samples);
      pixels[i + 2] = Math.round(b / samples);
    }
  }

  return encodePng(size, size, pixels);
}

/* --------------------------------- Output -------------------------------- */

mkdirSync(outDir, { recursive: true });

const anySizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
for (const size of anySizes) {
  const file = join(outDir, `icon-${size}x${size}.png`);
  writeFileSync(file, renderIcon(size, 1));
  console.log(`icon-${size}x${size}.png`);
}

for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}x${size}-maskable.png`);
  writeFileSync(file, renderIcon(size, 0.78));
  console.log(`icon-${size}x${size}-maskable.png`);
}
