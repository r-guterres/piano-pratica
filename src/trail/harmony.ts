// Cifras em graus romanos e transpostas para outro tom (fichas das músicas).
// Puro.

import { parseChord, pitchClass } from '../practice/chords';

export interface Key {
  tonic: number;
  minor: boolean;
}

const SOLFEGE: [string, number][] = [
  ['Dó', 0],
  ['Ré', 2],
  ['Mi', 4],
  ['Fá', 5],
  ['Sol', 7],
  ['Lá', 9],
  ['Si', 11],
];
/** Nome das tônicas (maior), com bemóis nos tons de bemol. */
const TONIC_NAME = ['Dó', 'Ré♭', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si'];
const MINOR_TONIC_NAME = [
  'Dó',
  'Dó♯',
  'Ré',
  'Mi♭',
  'Mi',
  'Fá',
  'Fá♯',
  'Sol',
  'Sol♯',
  'Lá',
  'Si♭',
  'Si',
];

/** "Dó maior", "Lá menor (simplificado)", "Sol maior · 3/4", "Mi♭" → tônica e modo. */
export function parseKey(text: string): Key | null {
  const m = /^(Dó|Ré|Mi|Fá|Sol|Lá|Si)\s*([♯#♭b]?)\s*(maior|menor)?/i.exec(text.trim());
  if (!m) return null;
  const base = SOLFEGE.find(([n]) => n.toLowerCase() === m[1]!.toLowerCase())![1];
  const shift = m[2] === '♯' || m[2] === '#' ? 1 : m[2] ? -1 : 0;
  return { tonic: pitchClass(base + shift), minor: m[3]?.toLowerCase() === 'menor' };
}

export const keyName = (k: Key) =>
  `${(k.minor ? MINOR_TONIC_NAME : TONIC_NAME)[k.tonic]} ${k.minor ? 'menor' : 'maior'}`;

/** Bemóis nos tons de bemol (Fá, Si♭, Mi♭… e Ré, Sol, Dó, Fá menor). */
function prefersFlats(k: Key): boolean {
  const major = k.minor ? pitchClass(k.tonic + 3) : k.tonic;
  return [5, 10, 3, 8, 1, 6].includes(major);
}

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/** Separa "C/G" em acorde e baixo; aceita ♯/♭ e #/b. */
function split(
  sym: string,
): { chord: string; root: number; suffix: string; bass: number | null } | null {
  const [main, bassText] = sym.split('/');
  const m = /^([A-G])([#b♯♭]?)(.*)$/.exec(main ?? '');
  if (!m) return null;
  const ascii = m[1]! + (m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2]!) + m[3];
  const chord = parseChord(ascii);
  if (!chord) return null;
  let bass: number | null = null;
  if (bassText) {
    const b = /^([A-G])([#b♯♭]?)$/.exec(bassText);
    const c = b && parseChord(b[1]! + (b[2] === '♯' ? '#' : b[2] === '♭' ? 'b' : b[2]!));
    if (!c) return null;
    bass = c.root;
  }
  return { chord: ascii, root: chord.root, suffix: m[3]!, bass };
}

/** Transpõe uma cifra; o que não for cifra (palavras, "|") volta igual. */
export function transposeChord(sym: string, semitones: number, to: Key): string {
  const s = split(sym);
  if (!s) return sym;
  const names = prefersFlats(to) ? FLAT_NAMES : SHARP_NAMES;
  const root = names[pitchClass(s.root + semitones)]!;
  const bass = s.bass === null ? '' : '/' + names[pitchClass(s.bass + semitones)]!;
  return root + s.suffix + bass;
}

const NUMERALS = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
const BASS_DEGREE = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];

/**
 * Grau romano de uma cifra no tom (sempre em relação à escala maior da tônica:
 * em Dó, Am = vi, B♭ = ♭VII). Minúsculo = menor; ° = diminuto; baixo como
 * grau da escala ("C/G" em Dó = I/5).
 */
export function degreeOf(sym: string, key: Key): string {
  const s = split(sym);
  if (!s) return sym;
  const n = NUMERALS[pitchClass(s.root - key.tonic)]!;
  const q = s.suffix;
  const lower = q === 'm' || q === 'm7' || q === 'dim';
  const numeral = lower ? n.replace(/[IV]+/, (r) => r.toLowerCase()) : n;
  const suffix = q === 'dim' ? '°' : q === 'aug' ? '+' : q === 'm' ? '' : q === 'm7' ? '7' : q;
  const bass = s.bass === null ? '' : '/' + BASS_DEGREE[pitchClass(s.bass - key.tonic)]!;
  return numeral + suffix + bass;
}

/** Aplica `f` a cada cifra de uma caixa da cifra ("C  G" → "I  V"), mantendo os espaços. */
export const mapChords = (cell: string, f: (sym: string) => string) =>
  cell.replace(/[^\s]+/g, (tok) => f(tok));
