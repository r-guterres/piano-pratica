// Gera os ícones do PWA (public/icons/*.png): três teclas brancas e duas pretas
// sobre o azul do app. Sem dependências: rasteriza retângulos arredondados com
// superamostragem e grava PNG com o zlib do Node.
//
//   npm run gen:icons

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

type RGBA = [number, number, number, number];
interface Shape {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  color: RGBA;
}

const BLUE: RGBA = [47, 111, 179, 255];
const WHITE: RGBA = [253, 253, 251, 255];
const BLACK: RGBA = [34, 34, 34, 255];

/** Desenho em coordenadas 0–512. `rounded` = fundo com cantos arredondados (ícone comum). */
function design(rounded: boolean): Shape[] {
  const shapes: Shape[] = [{ x: 0, y: 0, w: 512, h: 512, r: rounded ? 96 : 0, color: BLUE }];
  // teclado em 112–400 × 136–376: cabe na zona segura (círculo de raio 205) do ícone maskable
  for (let i = 0; i < 3; i++)
    shapes.push({ x: 112 + 96 * i + 4, y: 136, w: 88, h: 240, r: 12, color: WHITE });
  for (const cx of [208, 304])
    shapes.push({ x: cx - 28, y: 136, w: 56, h: 140, r: 8, color: BLACK });
  return shapes;
}

function inside(s: Shape, px: number, py: number): boolean {
  if (px < s.x || px > s.x + s.w || py < s.y || py > s.y + s.h) return false;
  const dx = Math.max(s.x + s.r - px, 0, px - (s.x + s.w - s.r));
  const dy = Math.max(s.y + s.r - py, 0, py - (s.y + s.h - s.r));
  return dx * dx + dy * dy <= s.r * s.r;
}

function render(size: number, shapes: Shape[]): Buffer {
  const SS = 4; // amostras por eixo
  const scale = 512 / size;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) * scale;
          const v = (y + (sy + 0.5) / SS) * scale;
          let c: RGBA = [0, 0, 0, 0];
          for (const s of shapes) if (inside(s, u, v)) c = s.color;
          // acumula com alfa pré-multiplicado
          for (let k = 0; k < 3; k++) acc[k]! += (c[k]! * c[3]) / 255;
          acc[3]! += c[3];
        }
      const n = SS * SS;
      const a = acc[3]! / n;
      const o = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) px[o + k] = a ? Math.round((acc[k]! / n / a) * 255) : 0;
      px[o + 3] = Math.round(a);
    }
  return png(size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); // filtro 0 por linha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const OUT = 'public/icons';
mkdirSync(OUT, { recursive: true });
const files: [string, number, boolean][] = [
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  ['icon-maskable-512.png', 512, false],
  ['favicon-32.png', 32, true],
];
for (const [name, size, rounded] of files) {
  writeFileSync(`${OUT}/${name}`, render(size, design(rounded)));
  console.log(`${OUT}/${name}`);
}
