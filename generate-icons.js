/**
 * Icon Generator for Sakura Translator
 * Run: node generate-icons.js
 *
 * Generates Open Design-inspired Sakura Translator icons:
 * - warm paper surface from DESIGN.md
 * - restrained ink/gold accents
 * - central cherry blossom motif
 *
 * Pure Node.js — no external dependencies.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── Open Design-inspired palette ───
const PAPER_TOP = [255, 250, 242];       // #fffaf2
const PAPER_BOTTOM = [246, 239, 227];    // #f6efe3
const BORDER = [232, 221, 204];          // #e8ddcc
const INK = [23, 23, 23];                // #171717
const MUTED = [98, 89, 76];              // #62594c
const GOLD = [212, 175, 55];             // #d4af37
const GOLD_DARK = [138, 82, 15];         // #8a520f
const PETAL_INNER = [252, 220, 225];     // restrained sakura blush
const PETAL_OUTER = [214, 132, 146];     // muted petal edge
const PETAL_SHADOW = [120, 72, 78];

// ─── Math helpers ───
const PI = Math.PI;
const cos = Math.cos;
const sin = Math.sin;
const sqrt = Math.sqrt;

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
function lerp(a, b, t) { return a + (b - a) * t; }
function mixColor(a, b, t) {
  return [
    clamp(lerp(a[0], b[0], t)),
    clamp(lerp(a[1], b[1], t)),
    clamp(lerp(a[2], b[2], t)),
  ];
}

function alphaBlend(base, over, alpha) {
  return [
    clamp(lerp(base[0], over[0], alpha)),
    clamp(lerp(base[1], over[1], alpha)),
    clamp(lerp(base[2], over[2], alpha)),
  ];
}

/**
 * Signed distance to a rounded rectangle centred at (cx, cy).
 * Returns negative inside, positive outside.
 */
function sdRoundedRect(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - halfW + radius;
  const dy = Math.abs(py - cy) - halfH + radius;
  const outsideDist = sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - radius;
  const insideDist = Math.min(Math.max(dx, dy), 0) - radius;
  return outsideDist > 0 ? outsideDist : insideDist;
}

/**
 * Check if (px, py) falls inside a petal.
 * Returns normalized distance squared (0 at petal centre, 1 at edge), or > 1 if outside.
 */
function petalDist(px, py, cx, cy, angle, petalLen, petalWidth) {
  const dx = px - cx;
  const dy = py - cy;

  // Petal-local axis points along angle.
  const axial = dx * cos(angle) + dy * sin(angle);
  const perpendicular = -dx * sin(angle) + dy * cos(angle);

  const petalCenter = petalLen * 0.42;
  const ry = petalLen * 0.52;
  const rx = petalWidth;

  const nx = perpendicular / rx;
  const ny = (axial - petalCenter) / ry;
  return (nx * nx + ny * ny);
}

/**
 * Check if point is in the subtle heart-shaped cleft at a petal tip.
 */
function inNotch(px, py, cx, cy, angle, petalLen, scale) {
  const tipDist = petalLen * 0.88;
  const tipX = cx + cos(angle) * tipDist;
  const tipY = cy + sin(angle) * tipDist;
  const notchR = 5.4 * scale;
  const ndx = px - tipX;
  const ndy = py - tipY;
  return (ndx * ndx + ndy * ndy) <= (notchR * notchR);
}

function backgroundColor(x, y, size) {
  const vertical = y / Math.max(1, size - 1);
  let color = mixColor(PAPER_TOP, PAPER_BOTTOM, vertical);

  // Restrained warm light source, matching the app UI's soft-warm surface.
  const dx = x - size * 0.18;
  const dy = y - size * 0.08;
  const light = Math.max(0, 1 - sqrt(dx * dx + dy * dy) / (size * 0.72));
  color = alphaBlend(color, [255, 245, 216], light * 0.18);

  return color;
}

/**
 * Determine pixel colour for the icon at (x, y) on a canvas of `size` px.
 * Returns [r, g, b, a].
 */
function iconPixel(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 128;

  // ─── Rounded paper tile ───
  const margin = 4 * scale;
  const halfSize = size / 2 - margin;
  const cornerR = 24 * scale;
  const bgDist = sdRoundedRect(x, y, cx, cy, halfSize, halfSize, cornerR);

  if (bgDist > 1.0) {
    return [0, 0, 0, 0];
  }

  let bgAlpha = 255;
  if (bgDist > -1.0) {
    bgAlpha = clamp(255 * (1.0 - (bgDist + 1.0) / 2.0));
  }

  let color = backgroundColor(x, y, size);

  // Paper tile border.
  if (bgDist > -2.2 * scale) {
    const borderT = 1 - Math.min(Math.abs(bgDist) / (2.2 * scale), 1);
    color = alphaBlend(color, BORDER, borderT * 0.82);
  }

  // Subtle bottom-right depth, kept restrained for Open Design consistency.
  const depth = Math.max(0, (x + y - size * 1.15) / (size * 0.85));
  color = alphaBlend(color, [214, 200, 174], Math.min(depth, 1) * 0.12);

  // ─── Minimal ink branch behind the blossom ───
  const branchY = cy + 20 * scale + (x - cx) * 0.18;
  const branchWidth = 2.0 * scale;
  const onBranch = x > cx - 39 * scale && x < cx + 32 * scale && Math.abs(y - branchY) <= branchWidth;
  if (onBranch) {
    const edge = Math.abs(y - branchY) / branchWidth;
    color = alphaBlend(color, MUTED, (1 - edge) * 0.46);
  }

  // ─── Sakura flower ───
  const flowerCx = cx;
  const flowerCy = cy - 3 * scale;
  const petalLen = 43 * scale;
  const petalWidth = 19 * scale;
  const numPetals = 5;
  const centerRadius = 10.5 * scale;

  const dx = x - flowerCx;
  const dy = y - flowerCy;
  const dist = sqrt(dx * dx + dy * dy);

  // Petal shadow first.
  let shadowAlpha = 0;
  for (let i = 0; i < numPetals; i++) {
    const angle = (2 * PI * i) / numPetals - PI / 2;
    const d = petalDist(x + 1.4 * scale, y + 2.0 * scale, flowerCx, flowerCy, angle, petalLen, petalWidth);
    if (d <= 1.06) {
      shadowAlpha = Math.max(shadowAlpha, (1.06 - d) / 1.06 * 0.16);
    }
  }
  if (shadowAlpha > 0) {
    color = alphaBlend(color, PETAL_SHADOW, shadowAlpha);
  }

  // Check petals.
  let bestDist = 999;
  for (let i = 0; i < numPetals; i++) {
    const angle = (2 * PI * i) / numPetals - PI / 2;
    const d = petalDist(x, y, flowerCx, flowerCy, angle, petalLen, petalWidth);
    if (d <= 1.0 && d < bestDist && !inNotch(x, y, flowerCx, flowerCy, angle, petalLen, scale)) {
      bestDist = d;
    }
  }

  if (bestDist <= 1.0) {
    const radial = Math.min(dist / (petalLen * 0.82), 1.0);
    const petalColor = mixColor(PETAL_INNER, PETAL_OUTER, radial);
    let petalAlpha = 0.98;
    if (bestDist > 0.88) {
      petalAlpha *= Math.max(0, 1.0 - (bestDist - 0.88) / 0.12);
    }
    color = alphaBlend(color, petalColor, petalAlpha);

    // Fine ink edge only near the petal boundary, visible on 48/128 but subtle on 16.
    if (bestDist > 0.93) {
      color = alphaBlend(color, INK, (bestDist - 0.93) / 0.07 * 0.08);
    }
  }

  // Centre dot, using the same gold accent as the app UI.
  if (dist <= centerRadius) {
    const t = dist / centerRadius;
    const centerColor = mixColor(GOLD, GOLD_DARK, t * 0.55);
    let alpha = 1.0;
    if (t > 0.84) {
      alpha = Math.max(0, 1.0 - (t - 0.84) / 0.16);
    }
    color = alphaBlend(color, centerColor, alpha);
  }

  return [color[0], color[1], color[2], bgAlpha];
}

// ─── PNG generation ───

function createPNG(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = createIHDR(size, size);
  const idat = createIDAT(size);
  const iend = createIEND();
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type);
  const combined = Buffer.concat([typeBuffer, data]);
  const crc = crc32(combined);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0);
  return Buffer.concat([length, combined, crcBuffer]);
}

function createIHDR(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;  // bit depth
  data[9] = 6;  // color type: RGBA
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  return createChunk('IHDR', data);
}

function createIDAT(size) {
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0); // filter byte: None
    for (let x = 0; x < size; x++) {
      const pixel = iconPixel(x, y, size);
      raw.push(pixel[0], pixel[1], pixel[2], pixel[3]);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(raw));
  return createChunk('IDAT', compressed);
}

function createIEND() {
  return createChunk('IEND', Buffer.alloc(0));
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc >>>= 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── Generate ───
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const png = createPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`✓ Generated ${filePath} (${png.length} bytes)`);
});

console.log('\nSakura icons generated successfully.');
