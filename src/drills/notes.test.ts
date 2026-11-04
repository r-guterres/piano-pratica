import { describe, expect, it } from 'vitest';
import {
  buildPool,
  diatonic,
  displayedAccidental,
  keyAlter,
  keySignatureName,
  midiOf,
  STAFF_LINES,
  writtenName,
  type PoolConfig,
} from './notes';

const C = 0;
const D = 1;
const E = 2;
const F = 3;
const G = 4;
const A = 5;
const B = 6;

const config = (extra: Partial<PoolConfig> = {}): PoolConfig => ({
  clefs: 'treble',
  range: {
    treble: { low: diatonic(C, 4), high: diatonic(C, 5) },
    bass: { low: diatonic(G, 2), high: diatonic(A, 3) },
  },
  accidentals: false,
  keySignature: 0,
  ...extra,
});

describe('written notes', () => {
  it('converts to MIDI', () => {
    expect(midiOf({ letter: C, alter: 0, octave: 4 })).toBe(60);
    expect(midiOf({ letter: F, alter: 1, octave: 3 })).toBe(54);
    expect(midiOf({ letter: B, alter: -1, octave: 2 })).toBe(46);
    expect(midiOf({ letter: C, alter: -1, octave: 4 })).toBe(59); // Dó♭4 = Si3
  });

  it('knows the key signature of each letter', () => {
    expect([C, D, E, F, G, A, B].map((l) => keyAlter(2, l))).toEqual([1, 0, 0, 1, 0, 0, 0]); // Ré maior
    expect([C, D, E, F, G, A, B].map((l) => keyAlter(-3, l))).toEqual([0, 0, -1, 0, 0, -1, -1]); // Mi♭ maior
    expect(keyAlter(0, F)).toBe(0);
  });

  it('writes an accidental only when it differs from the key signature', () => {
    expect(displayedAccidental({ letter: F, alter: 1, octave: 4 }, 1)).toBeNull();
    expect(displayedAccidental({ letter: F, alter: 0, octave: 4 }, 1)).toBe('n');
    expect(displayedAccidental({ letter: C, alter: 1, octave: 4 }, 1)).toBe('#');
    expect(displayedAccidental({ letter: B, alter: -1, octave: 4 }, 0)).toBe('b');
  });

  it('names notes with the user preferences', () => {
    const fs3 = { letter: F, alter: 1, octave: 3 } as const;
    expect(writtenName(fs3)).toBe('Fá♯3');
    expect(writtenName(fs3, { style: 'letters', octave: 'middle-c-4', accidental: 'flat' })).toBe(
      'F♯3',
    );
    expect(
      writtenName(
        { letter: C, alter: 0, octave: 4 },
        { style: 'solfege', octave: 'middle-c-3', accidental: 'sharp' },
      ),
    ).toBe('Dó3');
  });

  it('maps key signatures to VexFlow names', () => {
    expect([0, 1, -1, 7, -7].map(keySignatureName)).toEqual(['C', 'G', 'F', 'C#', 'Cb']);
  });

  it('describes the staff lines of each clef', () => {
    expect(STAFF_LINES.treble).toEqual({ low: diatonic(E, 4), high: diatonic(F, 5) });
    expect(STAFF_LINES.bass).toEqual({ low: diatonic(G, 2), high: diatonic(A, 3) });
  });
});

describe('buildPool', () => {
  it('naturals in the range, low to high', () => {
    const pool = buildPool(config());
    expect(pool.map((i) => i.pitch)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(pool[0]).toMatchObject({ id: 'treble:C4', clef: 'treble' });
  });

  it('follows the key signature', () => {
    const pool = buildPool(config({ keySignature: 1 }));
    expect(pool.map((i) => i.id)).toContain('treble:F#4');
    expect(pool.map((i) => i.id)).not.toContain('treble:F4');
  });

  it('adds sharps and flats, skipping E♯, B♯, C♭ and F♭', () => {
    const ids = buildPool(config({ accidentals: true })).map((i) => i.id);
    expect(ids).toContain('treble:C#4');
    expect(ids).toContain('treble:Db4');
    expect(ids).not.toContain('treble:E#4');
    expect(ids).not.toContain('treble:Cb4');
    expect(ids).not.toContain('treble:Fb4');
    expect(ids).not.toContain('treble:B#4');
    // 8 naturais com ♭, ♮ e ♯, menos Dó♭4, Mi♯4, Fá♭4, Si♯4 e Dó♭5
    expect(ids.length).toBe(8 * 3 - 5);
  });

  it('keeps unusual spellings that the key signature requires', () => {
    const ids = buildPool(config({ keySignature: 6 })).map((i) => i.id); // Fá♯ maior: tem Mi♯
    expect(ids).toContain('treble:E#4');
  });

  it('uses both clefs on the grand staff', () => {
    const pool = buildPool(config({ clefs: 'grand' }));
    expect(pool.filter((i) => i.clef === 'treble')).toHaveLength(8);
    expect(pool.filter((i) => i.clef === 'bass').map((i) => i.id)).toEqual([
      'bass:G2',
      'bass:A2',
      'bass:B2',
      'bass:C3',
      'bass:D3',
      'bass:E3',
      'bass:F3',
      'bass:G3',
      'bass:A3',
    ]);
  });
});
