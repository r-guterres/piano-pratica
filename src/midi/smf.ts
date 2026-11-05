// Arquivo MIDI padrão (SMF, formato 0) a partir de eventos de teclas e pedal,
// para abrir a gravação no MuseScore ou em qualquer programa de música. Puro.

import type { InputEvent } from '../core/events';

/** Divisões por semínima. */
export const PPQ = 480;

/** Inteiro em "quantidade de tamanho variável" (7 bits por byte, o último sem o bit alto). */
export function vlq(n: number): number[] {
  let v = Math.max(0, Math.round(n));
  const out = [v & 0x7f];
  while ((v >>= 7) > 0) out.unshift((v & 0x7f) | 0x80);
  return out;
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0) & 0x7f);

/**
 * `events`: t em ms desde o início. `bpm` só define a grade de compassos que o
 * programa vai mostrar; os instantes são preservados.
 */
export function writeSmf(
  events: readonly InputEvent[],
  opts: { bpm?: number; name?: string } = {},
): Uint8Array {
  const bpm = opts.bpm ?? 120;
  const msToTicks = (ms: number) => Math.round((ms * PPQ * bpm) / 60_000);
  const track: number[] = [];
  if (opts.name) {
    const name = ascii(opts.name).slice(0, 120);
    track.push(0, 0xff, 0x03, ...vlq(name.length), ...name);
  }
  track.push(0, 0xff, 0x51, 0x03, ...u32(Math.round(60_000_000 / bpm)).slice(1));

  let last = 0;
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    const tick = msToTicks(e.t);
    track.push(...vlq(tick - last));
    last = tick;
    if (e.type === 'pedal') track.push(0xb0, 64, e.down ? 127 : 0);
    else if (e.type === 'on') track.push(0x90, e.pitch & 0x7f, Math.max(1, e.velocity & 0x7f));
    else track.push(0x80, e.pitch & 0x7f, 0);
  }
  track.push(0, 0xff, 0x2f, 0x00);

  return Uint8Array.from([
    ...ascii('MThd'),
    ...u32(6),
    ...u16(0), // formato 0: uma trilha
    ...u16(1),
    ...u16(PPQ),
    ...ascii('MTrk'),
    ...u32(track.length),
    ...track,
  ]);
}
