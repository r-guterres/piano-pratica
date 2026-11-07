import { describe, expect, it } from 'vitest';
import {
  checkChord,
  checkInversion,
  inversionVoicing,
  nameChord,
  noteLetter,
  noteSolfege,
  parseChord,
  spellChord,
} from './chords';

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

describe('spellChord and inversions', () => {
  it('spells chords with the right letters', () => {
    const bbm = spellChord('Bbm')!;
    expect([bbm.display, bbm.name, bbm.tones.map(noteLetter)]).toEqual([
      'B♭m',
      'Si♭ menor',
      ['B♭', 'D♭', 'F'],
    ]);
    expect(spellChord('E7')!.tones.map(noteSolfege)).toEqual(['Mi', 'Sol♯', 'Si', 'Ré']);
    expect(spellChord('Dsus2')!.tones.map(noteLetter)).toEqual(['D', 'E', 'A']);
    expect(spellChord('Eb')!.tones.map(noteLetter)).toEqual(['E♭', 'G', 'B♭']);
  });

  it('builds a close voicing for each inversion', () => {
    const c = spellChord('C')!;
    expect(inversionVoicing(c, 0)).toEqual([48, 52, 55]);
    expect(inversionVoicing(c, 1)).toEqual([52, 55, 60]);
    expect(inversionVoicing(c, 2)).toEqual([55, 60, 64]);
  });

  it('checks the notes and the bass', () => {
    const am = spellChord('Am')!;
    // 1ª inversão: Dó no baixo
    expect(checkInversion(am, 1, [60, 64, 69])).toEqual({ ok: true, notesOk: true, bassOk: true });
    // notas certas, baixo errado (posição fundamental)
    expect(checkInversion(am, 1, [57, 60, 64])).toEqual({
      ok: false,
      notesOk: true,
      bassOk: false,
    });
    // com o baixo dobrado na ME
    expect(checkInversion(am, 1, [48, 64, 69, 72]).ok).toBe(true);
    expect(checkInversion(am, 1, [60, 65, 69]).notesOk).toBe(false);
  });
});
