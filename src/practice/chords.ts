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

// ---- soletrar e inversões (treino de acordes) ----

/** Graus (em letras acima da fundamental) de cada nota, por sufixo; mesma ordem dos intervalos. */
const LETTER_STEPS: Record<string, number[]> = {
  '': [0, 2, 4],
  m: [0, 2, 4],
  dim: [0, 2, 4],
  aug: [0, 2, 4],
  sus4: [0, 3, 4],
  sus2: [0, 1, 4],
  '7': [0, 2, 4, 6],
  maj7: [0, 2, 4, 6],
  m7: [0, 2, 4, 6],
};
const QUALITY_NAME: Record<string, string> = {
  '': 'maior',
  m: 'menor',
  dim: 'diminuto',
  aug: 'aumentado',
  sus4: 'sus4',
  sus2: 'sus2',
  '7': 'com sétima',
  maj7: 'com sétima maior',
  m7: 'menor com sétima',
};
const LETTERS = 'CDEFGAB';
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];
const SOLFEGE = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];

export const INVERSION_NAMES = ['fundamental', '1ª inversão', '2ª inversão', '3ª inversão'];

export interface SpelledNote {
  /** 0 = Dó … 6 = Si */
  letter: number;
  /** −1 = ♭, +1 = ♯ */
  alter: number;
  pc: number;
}

export interface SpelledChord extends Chord {
  /** Cifra com ♯/♭ ("B♭m"). */
  display: string;
  /** "Si♭ menor" */
  name: string;
  /** Notas na ordem fundamental, terça, quinta (sétima). */
  tones: SpelledNote[];
}

const accidental = (a: number) => (a > 0 ? '♯'.repeat(a) : '♭'.repeat(-a));
export const noteLetter = (n: SpelledNote) => LETTERS[n.letter]! + accidental(n.alter);
export const noteSolfege = (n: SpelledNote) => SOLFEGE[n.letter]! + accidental(n.alter);

/** "Bbm" → Si♭ menor, com as notas soletradas (Si♭, Ré♭, Fá). */
export function spellChord(symbol: string): SpelledChord | null {
  const chord = parseChord(symbol);
  const m = /^([A-G])([#b♯♭]?)(.*)$/.exec(symbol.trim());
  if (!chord || !m) return null;
  const quality = QUALITIES.find(([s]) => s === m[3])!;
  const steps = LETTER_STEPS[m[3]!]!;
  const rootLetter = LETTERS.indexOf(m[1]!);
  const tones = quality[1].map((semi, i): SpelledNote => {
    const letter = (rootLetter + steps[i]!) % 7;
    const pc = (chord.root + semi) % 12;
    let alter = pc - NATURAL_PC[letter]!;
    if (alter > 6) alter -= 12;
    if (alter < -6) alter += 12;
    return { letter, alter, pc };
  });
  const rootAlter = m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0;
  return {
    ...chord,
    display: m[1]! + accidental(rootAlter) + m[3],
    name: `${SOLFEGE[rootLetter]}${accidental(rootAlter)} ${QUALITY_NAME[m[3]!]}`,
    tones,
  };
}

/** Uma posição fechada do acorde na inversão pedida, a partir de `base` (Dó3 = 48). */
export function inversionVoicing(chord: SpelledChord, inv: number, base = 48): MidiPitch[] {
  const order = [...chord.tones.slice(inv), ...chord.tones.slice(0, inv)];
  const out = [base + order[0]!.pc];
  for (const n of order.slice(1)) {
    let p = base + n.pc;
    while (p <= out.at(-1)!) p += 12;
    out.push(p);
  }
  return out;
}

export interface InversionCheck {
  ok: boolean;
  /** As notas (classes de altura) são as do acorde, sem faltar nem sobrar. */
  notesOk: boolean;
  /** A nota mais grave é a pedida pela inversão. */
  bassOk: boolean;
}

/** Confere um acorde numa inversão: as notas certas e a nota certa no baixo. */
export function checkInversion(
  chord: SpelledChord,
  inv: number,
  pitches: readonly MidiPitch[],
): InversionCheck {
  const notesOk = pitches.length > 0 && checkChord(chord, pitches).ok;
  const bassOk = pitches.length > 0 && pitchClass(Math.min(...pitches)) === chord.tones[inv]!.pc;
  return { ok: notesOk && bassOk, notesOk, bassOk };
}
