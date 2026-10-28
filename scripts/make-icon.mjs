// Genera icono.ico (sombrero de paja sobre fondo marino), 64x64, PNG dentro de ICO. Sin dependencias.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const N = 64;
const px = new Uint8Array(N * N * 4);
const set = (x, y, [r, g, b, a = 255]) => { const i = (y * N + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };
const NAVY = [16, 42, 84], STRAW = [240, 196, 76], STRAW_D = [205, 150, 40], RED = [200, 40, 40];
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = x - 31.5, dy = y - 31.5;
  if (dx * dx + dy * dy > 31 * 31) { set(x, y, [0, 0, 0, 0]); continue; }
  let c = NAVY;
  const brim = (dx / 27) ** 2 + ((y - 38) / 7) ** 2 <= 1;            // ala
  const dome = (dx / 14) ** 2 + ((y - 33) / 17) ** 2 <= 1 && y <= 38; // copa
  if (brim) c = STRAW_D;
  if (dome) c = STRAW;
  if (y >= 31 && y <= 35 && dome) c = RED;                           // cinta roja
  if (brim && y < 38 && !dome) c = STRAW;
  set(x, y, c);
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]); };
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; Buffer.from(px.buffer, y * N * 4, N * 4).copy(raw, y * (N * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const head = Buffer.alloc(22); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); head[6] = N; head[7] = N; head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
writeFileSync('icono.ico', Buffer.concat([head, png]));
console.log('icono.ico', png.length + 22, 'bytes');
