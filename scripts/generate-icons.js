import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to generate PNG buffer adhering to Linear Design System
function createPNG(size) {
  const width = size;
  const height = size;
  const buffer = Buffer.alloc(height * (1 + width * 4));

  const radius = size * 0.22;
  const center = size / 2;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    buffer[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const dx = Math.max(Math.abs(x - center) - (center - radius), 0);
      const dy = Math.max(Math.abs(y - center) - (center - radius), 0);
      const distFromCorner = Math.sqrt(dx * dx + dy * dy);

      if (distFromCorner > radius) {
        buffer[offset++] = 0;
        buffer[offset++] = 0;
        buffer[offset++] = 0;
        buffer[offset++] = 0;
      } else {
        let alpha = 255;
        if (distFromCorner > radius - 1) {
          alpha = Math.floor(255 * (radius - distFromCorner));
        }

        // Void canvas #08090a (r: 8, g: 9, b: 10)
        let r = 8;
        let g = 9;
        let b = 10;

        // Border line around the icon edge
        if (distFromCorner > radius - 1.5 || x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          r = 35; // Graphite #23252a
          g = 37;
          b = 42;
        }

        // Center Linear Glyph / Aperture in Acid Lime #e4f222 (r: 228, g: 242, b: 34)
        const nx = (x - center) / (size * 0.48);
        const ny = (y - center) / (size * 0.48);

        const circleDist = Math.sqrt(nx * nx + ny * ny);
        const p = Math.pow(Math.abs(nx), 0.7) + Math.pow(Math.abs(ny), 0.7);

        // Acid Lime #e4f222 centerpiece
        if ((circleDist >= 0.35 && circleDist <= 0.65) || (circleDist <= 0.18)) {
          r = 228;
          g = 242;
          b = 34;
        } else if (p <= 0.55 && circleDist > 0.18 && circleDist < 0.35) {
          r = 240;
          g = 248;
          b = 100;
        }

        buffer[offset++] = r;
        buffer[offset++] = g;
        buffer[offset++] = b;
        buffer[offset++] = alpha;
      }
    }
  }

  // PNG Signature & Chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const compressedData = zlib.deflateSync(buffer);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  let crc = 0xffffffff;
  for (let i = 4; i < 8 + len; i++) {
    const byte = chunk[i];
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  chunk.writeUInt32BE(crc, 8 + len);

  return chunk;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

const outDir = path.resolve(__dirname, '../public/icons');
fs.mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const png = createPNG(size);
  const filePath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated Linear-styled icon ${filePath} (${size}x${size})`);
}
