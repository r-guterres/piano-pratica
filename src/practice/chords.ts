// Acordes por cifra: quais classes de altura (Dó = 0 … Si = 11) formam um
// acorde, se o que foi tocado é aquele acorde (em qualquer inversão, oitava ou
// dobramento) e que nome tem o que foi tocado. Puro.

import type { MidiPitch } from '../core/events';

/** Intervalos (em semitons, a partir da fundamental) por sufixo da cifra. */
const QUALITIES: [suffix: string, intervals: number[]][] = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
  ['sus4', [0, 5, 7]],
  ['sus2', [0, 2, 7]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
];

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PC_LETTER = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export interface Chord {
  symbol: string;
  root: number;
  /** Classes de altura do acorde, em ordem crescente. */
  pcs: number[];
}

export const pitchClass = (p: MidiPitch) => ((p % 12) + 12) % 12;
const classes = (pitches: readonly MidiPitch[]) =>
  [...new Set(pitches.map(pitchClass))].sort((a, b) => a - b);

/** "Am" → Lá menor; null se a cifra não for reconhecida. */
export function parseChord(symbol: string): Chord | null {
  const m = /^([A-G])([#b♯♭]?)(.*)$/.exec(symbol.trim());
  if (!m) return null;
  const quality = QUALITIES.find(([suffix]) => suffix === m[3]);
  if (!quality) return null;
  const shift = m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0;
  const root = pitchClass(LETTER_PC[m[1]!]! + shift);
  return {
    symbol: symbol.trim(),
    root,
    pcs: [...new Set(quality[1].map((i) => (root + i) % 12))].sort((a, b) => a - b),
  };
}

export interface ChordCheck {
  ok: boolean;
  /** Notas do acorde que não foram tocadas (classes de altura). */
  missing: number[];
  /** Notas tocadas que não são do acorde. */
  extra: number[];
}

/** Compara as notas tocadas com o acorde: todas as notas dele e nenhuma a mais. */
export function checkChord(chord: Chord, pitches: readonly MidiPitch[]): ChordCheck {
  const played = classes(pitches);
  const missing = chord.pcs.filter((pc) => !played.includes(pc));
  const extra = played.filter((pc) => !chord.pcs.includes(pc));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

/**
 * Nome do acorde tocado ("C", "Am", "G7", "C/E" com o baixo fora da
 * fundamental), ou null se não for um acorde conhecido.
 */
export function nameChord(pitches: readonly MidiPitch[]): string | null {
  const played = classes(pitches);
  if (played.length < 3) return null;
  const bass = pitchClass(Math.min(...pitches));
  // o baixo primeiro: resolve as ambiguidades (Csus2 = Gsus4, aumentados)
  const roots = [bass, ...played.filter((pc) => pc !== bass)];
  for (const root of roots)
    for (const [suffix, intervals] of QUALITIES) {
      const pcs = [...new Set(intervals.map((i) => (root + i) % 12))].sort((a, b) => a - b);
      if (pcs.length === played.length && pcs.every((pc, i) => pc === played[i])) {
        const name = PC_LETTER[root]! + suffix;
        return bass === root ? name : `${name}/${PC_LETTER[bass]}`;
      }
    }
  return null;
}
