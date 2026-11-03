import { describe, expect, it } from 'vitest';
import { DEFAULT_NAMING, isBlackKey, octaveOf, pitchName, type PitchNaming } from './pitch';

const fb: PitchNaming = { ...DEFAULT_NAMING, octave: 'middle-c-3' };

describe('pitchName', () => {
  it('names middle C in both octave conventions', () => {
    expect(pitchName(60)).toBe('Dó4');
    expect(pitchName(60, fb)).toBe('Dó3');
  });

  it('uses letters when requested', () => {
    expect(pitchName(60, { ...DEFAULT_NAMING, style: 'letters' })).toBe('C4');
    expect(pitchName(69, { ...DEFAULT_NAMING, style: 'letters' })).toBe('A4');
  });

  it('spells black keys with sharps or flats', () => {
    expect(pitchName(61)).toBe('Dó♯4');
    expect(pitchName(61, { ...DEFAULT_NAMING, accidental: 'flat' })).toBe('Ré♭4');
    expect(pitchName(70, { ...DEFAULT_NAMING, style: 'letters', accidental: 'flat' })).toBe('B♭4');
  });

  it('handles octave boundaries (B3 → C4)', () => {
    expect(pitchName(59)).toBe('Si3');
    expect(pitchName(48)).toBe('Dó3');
    expect(pitchName(48, fb)).toBe('Dó2');
  });

  it('covers the 88-key and CTK-3500 ranges', () => {
    expect(pitchName(21)).toBe('Lá0');
    expect(pitchName(108)).toBe('Dó8');
    expect(pitchName(36)).toBe('Dó2'); // tecla mais grave do CTK-3500 (61 teclas)
    expect(pitchName(96)).toBe('Dó7'); // tecla mais aguda
  });
});

describe('octaveOf', () => {
  it('maps MIDI 0 to octave -1 (scientific)', () => {
    expect(octaveOf(0, 'middle-c-4')).toBe(-1);
    expect(octaveOf(0, 'middle-c-3')).toBe(-2);
  });
});

describe('isBlackKey', () => {
  it('identifies the five black keys of an octave', () => {
    const blacks = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71].filter(isBlackKey);
    expect(blacks).toEqual([61, 63, 66, 68, 70]);
  });
});
