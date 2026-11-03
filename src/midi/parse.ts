// Conversão de bytes MIDI crus em eventos normalizados. Função pura: não usa o
// navegador e é testada com sequências simuladas.
//
// A Web MIDI API entrega uma mensagem completa por evento, já com o byte de
// status (sem "running status"), então cada chamada trata uma única mensagem.

import type { Millis, NoteEvent, PedalEvent } from '../core/events';

export type MidiMessage =
  | { kind: 'note'; channel: number; event: NoteEvent }
  | { kind: 'pedal'; channel: number; event: PedalEvent }
  /** Mensagem válida, mas sem uso no app (program change, outros CCs…). */
  | { kind: 'other'; channel: number | null; description: string }
  /** Ruído de protocolo que nem deve aparecer no monitor (Active Sensing, Clock…). */
  | { kind: 'ignored'; description: string };

const SUSTAIN_CC = 64;

const SYSTEM_REALTIME: Record<number, string> = {
  0xf8: 'Timing Clock',
  0xfa: 'Start',
  0xfb: 'Continue',
  0xfc: 'Stop',
  0xfe: 'Active Sensing',
  0xff: 'System Reset',
};

const DATA_LENGTH: Record<number, number> = {
  0x80: 2, // note off
  0x90: 2, // note on
  0xa0: 2, // polyphonic aftertouch
  0xb0: 2, // control change
  0xc0: 1, // program change
  0xd0: 1, // channel aftertouch
  0xe0: 2, // pitch bend
};

/**
 * Interpreta uma mensagem MIDI. `t` é o timestamp do evento (ms).
 * Retorna `null` para entrada vazia.
 */
export function parseMidiMessage(data: ArrayLike<number>, t: Millis): MidiMessage | null {
  if (data.length === 0) return null;
  const status = data[0]!;

  if (status < 0x80) {
    return { kind: 'ignored', description: 'byte de dados sem status' };
  }

  if (status >= 0xf0) {
    const realtime = SYSTEM_REALTIME[status];
    if (realtime) return { kind: 'ignored', description: realtime };
    if (status === 0xf0) return { kind: 'other', channel: null, description: 'SysEx' };
    return { kind: 'other', channel: null, description: `Sistema 0x${hex(status)}` };
  }

  const command = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  const needed = DATA_LENGTH[command]!;
  if (data.length < 1 + needed) {
    return { kind: 'ignored', description: `mensagem incompleta 0x${hex(status)}` };
  }
  const d1 = data[1]! & 0x7f;
  const d2 = needed === 2 ? data[2]! & 0x7f : 0;

  switch (command) {
    case 0x90:
      // Note-on com velocity 0 é, por convenção MIDI, um note-off.
      return d2 === 0
        ? { kind: 'note', channel, event: { type: 'off', pitch: d1, velocity: 0, t } }
        : { kind: 'note', channel, event: { type: 'on', pitch: d1, velocity: d2, t } };
    case 0x80:
      return { kind: 'note', channel, event: { type: 'off', pitch: d1, velocity: d2, t } };
    case 0xb0:
      if (d1 === SUSTAIN_CC) {
        return { kind: 'pedal', channel, event: { type: 'pedal', value: d2, down: d2 >= 64, t } };
      }
      return { kind: 'other', channel, description: `CC ${d1} = ${d2}` };
    case 0xc0:
      return { kind: 'other', channel, description: `Program Change ${d1}` };
    case 0xe0:
      return { kind: 'other', channel, description: `Pitch Bend ${((d2 << 7) | d1) - 8192}` };
    case 0xa0:
      return { kind: 'other', channel, description: `Aftertouch nota ${d1} = ${d2}` };
    default: // 0xd0
      return { kind: 'other', channel, description: `Aftertouch canal = ${d1}` };
  }
}

export function hex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, '0');
}

export function formatBytes(data: ArrayLike<number>): string {
  return Array.from(data, hex).join(' ');
}
