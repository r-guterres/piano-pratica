import { describe, expect, it } from 'vitest';
import { KEYS, keyLabel, keyTonic, transposeChords, transposeSymbol } from './transpose';

describe('transposeSymbol', () => {
  it('spells by scale degree, keeping the bass of the inversion', () => {
    expect(transposeChords(['C', 'F/C', 'G/B', 'C'], 'C', 'Db')).toEqual([
      'Db',
      'Gb/Db',
      'Ab/C',
      'Db',
    ]);
    expect(transposeChords(['C', 'F/C', 'G/B', 'C'], 'C', 'E')).toEqual(['E', 'A/E', 'B/D#', 'E']);
    // de Fá para Ré: B♭ (IV) vira G, C7 (V7) vira A7
    expect(transposeChords(['F', 'Bb', 'C7', 'Dm'], 'F', 'D')).toEqual(['D', 'G', 'A7', 'Bm']);
    expect(transposeSymbol('Bdim', 'C', 'Ab')).toBe('Gdim');
    expect(transposeSymbol('Bdim', 'C', 'F#')).toBe('E#dim');
  });

  it('avoids double sharps and flats', () => {
    // F♯m de Fá para Fá♯ seria F𝄪m: vira Gm
    expect(transposeSymbol('F#m', 'F', 'F#')).toBe('Gm');
    expect(transposeSymbol('Eb', 'C', 'Gb')).toBe('A'); // seria B𝄫
  });

  it('leaves anything that is not a chord alone', () => {
    expect(transposeSymbol('|', 'C', 'D')).toBe('|');
    expect(transposeSymbol('C/H', 'C', 'D')).toBe('C/H');
  });

  it('names the twelve keys', () => {
    expect(KEYS.map(keyLabel).join(' ')).toBe('Dó Ré♭ Ré Mi♭ Mi Fá Fá♯ Sol Lá♭ Lá Si♭ Si');
    expect(KEYS.map(keyTonic)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});
