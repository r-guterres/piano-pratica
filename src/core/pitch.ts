import type { MidiPitch } from './events';

/**
 * Convenção de numeração de oitava:
 * - 'middle-c-4': científica (MuseScore, MIDI 60 = Dó4);
 * - 'middle-c-3': franco-belga (MIDI 60 = Dó3).
 */
export type OctaveConvention = 'middle-c-4' | 'middle-c-3';

export interface PitchNaming {
  octave: OctaveConvention;
  style: 'solfege' | 'letters';
  accidental: 'sharp' | 'flat';
}

export const DEFAULT_NAMING: PitchNaming = {
  octave: 'middle-c-4',
  style: 'solfege',
  accidental: 'sharp',
};

const SOLFEGE_SHARP = [
  'Dó',
  'Dó♯',
  'Ré',
  'Ré♯',
  'Mi',
  'Fá',
  'Fá♯',
  'Sol',
  'Sol♯',
  'Lá',
  'Lá♯',
  'Si',
];
const SOLFEGE_FLAT = [
  'Dó',
  'Ré♭',
  'Ré',
  'Mi♭',
  'Mi',
  'Fá',
  'Sol♭',
  'Sol',
  'Lá♭',
  'Lá',
  'Si♭',
  'Si',
];
const LETTERS_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const LETTERS_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export function octaveOf(pitch: MidiPitch, convention: OctaveConvention): number {
  const offset = convention === 'middle-c-4' ? 1 : 2;
  return Math.floor(pitch / 12) - offset;
}

/** Nome legível de uma altura MIDI, ex.: 60 → "Dó4" (padrão) ou "C3". */
export function pitchName(pitch: MidiPitch, naming: PitchNaming = DEFAULT_NAMING): string {
  const table =
    naming.style === 'solfege'
      ? naming.accidental === 'sharp'
        ? SOLFEGE_SHARP
        : SOLFEGE_FLAT
      : naming.accidental === 'sharp'
        ? LETTERS_SHARP
        : LETTERS_FLAT;
  const pc = ((pitch % 12) + 12) % 12;
  return `${table[pc]}${octaveOf(pitch, naming.octave)}`;
}

export function isBlackKey(pitch: MidiPitch): boolean {
  return [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
}
