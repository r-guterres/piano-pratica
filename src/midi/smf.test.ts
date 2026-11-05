import { describe, expect, it } from 'vitest';
import { vlq, writeSmf } from './smf';

describe('vlq', () => {
  it('encodes variable-length quantities', () => {
    expect(vlq(0)).toEqual([0x00]);
    expect(vlq(127)).toEqual([0x7f]);
    expect(vlq(128)).toEqual([0x81, 0x00]);
    expect(vlq(480)).toEqual([0x83, 0x60]);
    expect(vlq(0x0fffffff)).toEqual([0xff, 0xff, 0xff, 0x7f]);
  });
});

describe('writeSmf', () => {
  it('writes a format 0 file with tempo, notes and pedal', () => {
    // a 120 bpm, 500 ms = uma semínima = 480 ticks
    const bytes = writeSmf(
      [
        { type: 'on', pitch: 60, velocity: 100, t: 0 },
        { type: 'pedal', value: 127, down: true, t: 250 },
        { type: 'off', pitch: 60, velocity: 0, t: 500 },
      ],
      { bpm: 120 },
    );
    const text = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
    expect(text(0, 4)).toBe('MThd');
    expect([...bytes.slice(4, 14)]).toEqual([0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0]);
    expect(text(14, 18)).toBe('MTrk');
    const length = (bytes[18]! << 24) | (bytes[19]! << 16) | (bytes[20]! << 8) | bytes[21]!;
    expect(length).toBe(bytes.length - 22);
    expect([...bytes.slice(22)]).toEqual([
      // andamento: 500000 µs por semínima
      0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
      // Dó4 em 0
      0, 0x90, 60, 100,
      // pedal em 240 ticks
      0x81, 0x70, 0xb0, 64, 127,
      // solta em 480 (240 depois)
      0x81, 0x70, 0x80, 60, 0,
      // fim da trilha
      0, 0xff, 0x2f, 0,
    ]);
  });
});
