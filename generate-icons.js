/**
 * Icon Generator for Sakura Translator
 * Run: node generate-icons.js
 * 
 * This creates simple PNG icons using a Canvas-like approach.
 * Since we can't use Canvas in plain Node.js, we'll create SVG files
 * and the user can convert them, OR we use inline SVG data URIs in manifest.
 * 
 * For simplicity, we generate minimal valid PNG files.
 */

const fs = require('fs');
const path = require('path');

// Minimal PNG generator for solid-colored icons with a "侍" character look
// We'll create a simple colored square PNG as the icon

function createPNG(size) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = createIHDR(size, size);
  
  // IDAT chunk (image data)
  const idat = createIDAT(size, size);
  
  // IEND chunk
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
  data[8] = 8; // bit depth
  data[9] = 2; // color type: RGB
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  return createChunk('IHDR', data);
}

function createIDAT(width, height) {
  // Create raw pixel data with filter bytes
  const raw = [];
  
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * 0.42;
  
  for (let y = 0; y < height; y++) {
    raw.push(0); // Filter: None
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= radius) {
        // Blue circle: #2563eb
        raw.push(37, 99, 235);
      } else {
        // White background
        raw.push(255, 255, 255);
      }
    }
  }
  
  // Add "T" shape in white on the blue circle
  const rawBuf = Buffer.from(raw);
  
  // Draw a simple "T" letter
  const tLeft = Math.floor(width * 0.3);
  const tRight = Math.floor(width * 0.7);
  const tTop = Math.floor(height * 0.25);
  const tBarBottom = Math.floor(height * 0.35);
  const tStemLeft = Math.floor(width * 0.43);
  const tStemRight = Math.floor(width * 0.57);
  const tBottom = Math.floor(height * 0.75);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * (width * 3 + 1) + 1 + x * 3;
      const inTopBar = y >= tTop && y <= tBarBottom && x >= tLeft && x <= tRight;
      const inStem = y > tBarBottom && y <= tBottom && x >= tStemLeft && x <= tStemRight;
      
      if (inTopBar || inStem) {
        rawBuf[idx] = 255;     // R
        rawBuf[idx + 1] = 255; // G
        rawBuf[idx + 2] = 255; // B
      }
    }
  }
  
  // Compress with deflate (zlib)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawBuf);
  
  return createChunk('IDAT', compressed);
}

function createIEND() {
  return createChunk('IEND', Buffer.alloc(0));
}

// CRC32 implementation
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

// Generate icons
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

console.log('\nDone! Icons generated successfully.');
