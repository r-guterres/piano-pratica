import { describe, expect, it } from 'vitest';
import { checkChord, nameChord, parseChord } from './chords';

describe('parseChord', () => {
  it('reads root, accidental and quality', () => {
    expect(parseChord('C')).toEqual({ symbol: 'C', root: 0, pcs: [0, 4, 7] });
    expect(parseChord('Am')?.pcs).toEqual([0, 4, 9]);
    expect(parseChord('F#m')?.pcs).toEqual([1, 6, 9]);
    expect(parseChord('Bb')?.pcs).toEqual([2, 5, 10]);
    expect(parseChord('G7')?.pcs).toEqual([2, 5, 7, 11]);
  });

  it('rejects unknown symbols', () => {
    expect(parseChord('H')).toBeNull();
    expect(parseChord('Cxyz')).toBeNull();
  });
});

describe('checkChord', () => {
  const F = parseChord('F')!;

  it('accepts any inversion, octave and doubling', () => {
    expect(checkChord(F, [65, 69, 72]).ok).toBe(true); // posição fundamental
    expect(checkChord(F, [60, 65, 69]).ok).toBe(true); // 2ª inversão (Let It Be)
    expect(checkChord(F, [41, 60, 65, 69]).ok).toBe(true); // com o baixo na ME
  });

  it('says which notes are missing or extra', () => {
    // Fá Lá Si em vez de Fá Lá Dó
    expect(checkChord(F, [65, 69, 71])).toEqual({ ok: false, missing: [0], extra: [11] });
    // só duas notas
    expect(checkChord(F, [65, 69])).toEqual({ ok: false, missing: [0], extra: [] });
  });
});

describe('nameChord', () => {
  it('names triads and sevenths in any inversion', () => {
    expect(nameChord([60, 64, 67])).toBe('C');
    expect(nameChord([57, 60, 64])).toBe('Am');
    expect(nameChord([64, 67, 72])).toBe('C/E');
    expect(nameChord([55, 59, 62, 65])).toBe('G7');
    expect(nameChord([43, 60, 64, 67])).toBe('C/G');
  });

  it('returns null for fewer than three notes or unknown sets', () => {
    expect(nameChord([60, 64])).toBeNull();
    expect(nameChord([60, 61, 62])).toBeNull();
  });
});
