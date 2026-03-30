/**
 * Icon Generator for Sakura Translator
 * Run: node generate-icons.js
 *
 * Generates a minimalist sakura (cherry blossom) icon on a rounded-corner
 * background for better recognizability at all sizes.
 * Pure Node.js — no external dependencies.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── Colour palette ───
const BG_R = 44, BG_G = 42, BG_B = 56;                 // #2c2a38 – dark slate background
const PETAL_R = 237, PETAL_G = 100, PETAL_B = 140;      // #ed648c – deeper petal edge
const PETAL2_R = 252, PETAL2_G = 185, PETAL2_B = 210;   // #fcb9d2 – soft petal inner (lighter)
const CENTER_R = 255, CENTER_G = 210, CENTER_B = 100;   // #ffd264 – warm golden centre
const CENTER2_R = 255, CENTER2_G = 180, CENTER2_B = 60; // #ffb43c – darker centre edge

// ─── Math helpers ───
const PI = Math.PI;
const cos = Math.cos;
const sin = Math.sin;
const sqrt = Math.sqrt;

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * Signed distance to a rounded rectangle centred at (cx, cy).
 * Returns negative inside, positive outside.
 */
function sdRoundedRect(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - halfW + radius;
  const dy = Math.abs(py - cy) - halfH + radius;
  const outsideDist = sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - radius;
  const insideDist = Math.min(Math.max(dx, dy), 0) - radius;
  // insideDist is negative when inside, outsideDist used when outside
  return outsideDist > 0 ? outsideDist : insideDist;
}

/**
 * Check if (px, py) falls inside a petal.
 * Returns normalised distance squared (0 at centre, 1 at edge), or > 1 if outside.
 */
function petalDist(px, py, cx, cy, angle, petalLen, petalWidth) {
  const dx = px - cx;
  const dy = py - cy;
  // Rotate into petal-local coordinates
  const lx = dx * cos(-angle) - dy * sin(-angle);
  const ly = dx * sin(-angle) + dy * cos(-angle);

  // Petal is an ellipse centred along the petal axis
  const ey = petalLen * 0.46;
  const ry = petalLen * 0.56;
  const rx = petalWidth;

  const nx = lx / rx;
  const ny = (ly - ey) / ry;
  return (nx * nx + ny * ny);
}

/**
 * Check if point is in the "notch" (heart-shaped cleft at petal tip).
 */
function inNotch(px, py, cx, cy, angle, petalLen, scale) {
  const tipDist = petalLen * 0.90;
  const tipX = cx + cos(angle) * tipDist;
  const tipY = cy + sin(angle) * tipDist;
  const notchR = 6.0 * scale;
  const ndx = px - tipX;
  const ndy = py - tipY;
  return (ndx * ndx + ndy * ndy) <= (notchR * notchR);
}

/**
 * Determine pixel colour for the sakura icon at (x, y) on a canvas of `size` px.
 * Returns [r, g, b, a].
 */
function sakuraPixel(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 128;

  // ─── Rounded-corner background ───
  const margin = 4 * scale;
  const halfSize = size / 2 - margin;
  const cornerR = 22 * scale;  // generous rounded corners
  const bgDist = sdRoundedRect(x, y, cx, cy, halfSize, halfSize, cornerR);

  if (bgDist > 1.0) {
    return [0, 0, 0, 0]; // outside rounded rect — transparent
  }

  // Anti-alias the rounded rect edge
  let bgAlpha = 255;
  if (bgDist > -1.0) {
    bgAlpha = clamp(255 * (1.0 - (bgDist + 1.0) / 2.0));
  }

  // ─── Sakura flower ───
  const petalLen = 46 * scale;
  const petalWidth = 21 * scale;
  const numPetals = 5;
  const centerRadius = 11 * scale;

  const dx = x - cx;
  const dy = y - cy;
  const dist = sqrt(dx * dx + dy * dy);

  // Check petals
  let bestPetal = -1;
  let bestDist = 999;
  for (let i = 0; i < numPetals; i++) {
    const angle = (2 * PI * i) / numPetals - PI / 2;
    const d = petalDist(x, y, cx, cy, angle, petalLen, petalWidth);
    if (d <= 1.0 && d < bestDist) {
      if (!inNotch(x, y, cx, cy, angle, petalLen, scale)) {
        bestPetal = i;
        bestDist = d;
      }
    }
  }

  if (bestPetal >= 0) {
    // Radial gradient: lighter near centre, deeper pink at tips
    const t = Math.min(dist / (petalLen * 0.85), 1.0);
    const r = clamp(lerp(PETAL2_R, PETAL_R, t));
    const g = clamp(lerp(PETAL2_G, PETAL_G, t));
    const b = clamp(lerp(PETAL2_B, PETAL_B, t));

    // Soft anti-alias at petal edge
    let petalAlpha = 255;
    if (bestDist > 0.90) {
      petalAlpha = clamp(255 * (1.0 - (bestDist - 0.90) / 0.10));
    }

    // Composite petal on background
    const a = clamp(petalAlpha);
    const fR = lerp(BG_R, r, a / 255);
    const fG = lerp(BG_G, g, a / 255);
    const fB = lerp(BG_B, b, a / 255);
    return [clamp(fR), clamp(fG), clamp(fB), bgAlpha];
  }

  // ─── Centre dot ───
  if (dist <= centerRadius) {
    const t = dist / centerRadius;
    const r = clamp(lerp(CENTER_R, CENTER2_R, t));
    const g = clamp(lerp(CENTER_G, CENTER2_G, t));
    const b = clamp(lerp(CENTER_B, CENTER2_B, t));
    // Soft edge
    let alpha = 255;
    if (t > 0.82) {
      alpha = clamp(255 * (1.0 - (t - 0.82) / 0.18));
    }
    const fR = lerp(BG_R, r, alpha / 255);
    const fG = lerp(BG_G, g, alpha / 255);
    const fB = lerp(BG_B, b, alpha / 255);
    return [clamp(fR), clamp(fG), clamp(fB), bgAlpha];
  }

  // ─── Background fill ───
  return [BG_R, BG_G, BG_B, bgAlpha];
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
      const pixel = sakuraPixel(x, y, size);
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

console.log('\n🌸 Sakura icons generated successfully.');
