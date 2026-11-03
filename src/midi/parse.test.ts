import { describe, expect, it } from 'vitest';
import { formatBytes, parseMidiMessage } from './parse';

describe('parseMidiMessage — notes', () => {
  it('parses note-on', () => {
    expect(parseMidiMessage([0x90, 60, 100], 12.5)).toEqual({
      kind: 'note',
      channel: 1,
      event: { type: 'on', pitch: 60, velocity: 100, t: 12.5 },
    });
  });

  it('parses note-off with release velocity', () => {
    expect(parseMidiMessage([0x80, 60, 40], 20)).toEqual({
      kind: 'note',
      channel: 1,
      event: { type: 'off', pitch: 60, velocity: 40, t: 20 },
    });
  });

  it('treats note-on with velocity 0 as note-off', () => {
    expect(parseMidiMessage([0x90, 64, 0], 30)).toEqual({
      kind: 'note',
      channel: 1,
      event: { type: 'off', pitch: 64, velocity: 0, t: 30 },
    });
  });

  it('extracts the channel (1–16) from the status byte', () => {
    const msg = parseMidiMessage([0x9f, 60, 1], 0);
    expect(msg).toMatchObject({ kind: 'note', channel: 16 });
  });

  it('masks data bytes to 7 bits', () => {
    const msg = parseMidiMessage([0x90, 0xbc, 0xff], 0);
    expect(msg).toMatchObject({ event: { pitch: 60, velocity: 127 } });
  });
});

describe('parseMidiMessage — sustain pedal (CC64)', () => {
  it('reports pedal down and up', () => {
    expect(parseMidiMessage([0xb0, 64, 127], 5)).toEqual({
      kind: 'pedal',
      channel: 1,
      event: { type: 'pedal', value: 127, down: true, t: 5 },
    });
    expect(parseMidiMessage([0xb0, 64, 0], 6)).toMatchObject({
      kind: 'pedal',
      event: { value: 0, down: false },
    });
  });

  it('uses 64 as the down threshold', () => {
    expect(parseMidiMessage([0xb0, 64, 63], 0)).toMatchObject({ event: { down: false } });
    expect(parseMidiMessage([0xb0, 64, 64], 0)).toMatchObject({ event: { down: true } });
  });

  it('reports other controllers as "other"', () => {
    expect(parseMidiMessage([0xb0, 7, 100], 0)).toEqual({
      kind: 'other',
      channel: 1,
      description: 'CC 7 = 100',
    });
  });
});

describe('parseMidiMessage — other and ignored messages', () => {
  it('ignores system real-time messages (Active Sensing, Clock)', () => {
    expect(parseMidiMessage([0xfe], 0)).toEqual({ kind: 'ignored', description: 'Active Sensing' });
    expect(parseMidiMessage([0xf8], 0)).toEqual({ kind: 'ignored', description: 'Timing Clock' });
  });

  it('reports program change and pitch bend', () => {
    expect(parseMidiMessage([0xc0, 5], 0)).toMatchObject({
      kind: 'other',
      description: 'Program Change 5',
    });
    expect(parseMidiMessage([0xe0, 0x00, 0x40], 0)).toMatchObject({
      kind: 'other',
      description: 'Pitch Bend 0',
    });
  });

  it('reports SysEx without failing', () => {
    expect(parseMidiMessage([0xf0, 0x7e, 0x7f, 0xf7], 0)).toMatchObject({
      kind: 'other',
      description: 'SysEx',
    });
  });

  it('flags incomplete messages and stray data bytes as ignored', () => {
    expect(parseMidiMessage([0x90, 60], 0)).toMatchObject({ kind: 'ignored' });
    expect(parseMidiMessage([0x3c, 0x40], 0)).toMatchObject({ kind: 'ignored' });
  });

  it('returns null for empty input', () => {
    expect(parseMidiMessage([], 0)).toBeNull();
  });

  it('accepts Uint8Array (as delivered by Web MIDI)', () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 60, 90]), 0)).toMatchObject({
      kind: 'note',
      event: { type: 'on', pitch: 60, velocity: 90 },
    });
  });
});

describe('formatBytes', () => {
  it('formats bytes as uppercase hex', () => {
    expect(formatBytes([0x90, 60, 0x7f])).toBe('90 3C 7F');
  });
});
