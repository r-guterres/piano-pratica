import { describe, expect, it } from 'vitest';
import { degreeOf, keyName, mapChords, parseKey, transposeChord } from './harmony';

const C = { tonic: 0, minor: false };

describe('parseKey', () => {
  it('reads the key texts of the songs', () => {
    expect(parseKey('Dó maior')).toEqual(C);
    expect(parseKey('Lá menor (simplificado)')).toEqual({ tonic: 9, minor: true });
    expect(parseKey('Sol maior · 3/4')).toEqual({ tonic: 7, minor: false });
    expect(parseKey('Mi♭ maior')).toEqual({ tonic: 3, minor: false });
    expect(parseKey('a definir pela partitura')).toBeNull();
    expect(keyName({ tonic: 10, minor: false })).toBe('Si♭ maior');
  });
});

describe('degreeOf', () => {
  it('writes the Let It Be chart in degrees', () => {
    expect(
      ['C', 'G', 'Am', 'F', 'C/G', 'C/E', 'Dm', 'B♭', 'F/A'].map((s) => degreeOf(s, C)),
    ).toEqual(['I', 'V', 'vi', 'IV', 'I/5', 'I/3', 'ii', '♭VII', 'IV/6']);
  });

  it('marks sevenths, diminished and borrowed chords', () => {
    expect(degreeOf('G7', C)).toBe('V7');
    expect(degreeOf('Bdim', C)).toBe('vii°');
    expect(degreeOf('Em7', C)).toBe('iii7');
    expect(degreeOf('A7', { tonic: 5, minor: false })).toBe('III7'); // V/vi em Fá
    expect(degreeOf('|', C)).toBe('|');
  });
});

describe('transposeChord', () => {
  it('moves chords to another key, with flats in flat keys', () => {
    const F = { tonic: 5, minor: false };
    const G = { tonic: 7, minor: false };
    expect(mapChords('Am  C/G', (s) => transposeChord(s, 5, F))).toBe('Dm  F/C');
    expect(mapChords('F  C/E  Dm  C', (s) => transposeChord(s, 7, G))).toBe('C  G/B  Am  G');
    expect(transposeChord('B♭', 7, G)).toBe('F');
    expect(transposeChord('C', 1, { tonic: 1, minor: false })).toBe('D♭');
    expect(transposeChord('C', 2, { tonic: 2, minor: false })).toBe('D');
  });
});
