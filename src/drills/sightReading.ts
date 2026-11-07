// Ler e tocar (do artefato "Trilha do Teclado"): um trecho curto na pauta,
// em semínimas (a mão esquerda das duas mãos em mínimas), para tocar no tempo
// depois de uma contagem. O ritmo é avaliado como no modo acompanhar
// (practice/rhythm.ts). Puro.
//
// As notas são índices diatônicos (oitava × 7 + letra; Dó4 = 28), sem
// alterações (Dó maior).

import type { InputEvent } from '../core/events';
import type { ExpectedNote } from '../playback/schedule';
import { midiOf } from './notes';
import type { Rng } from './priority';

export type SightMode = 'treble' | 'bass' | 'alternate' | 'both';

export const SIGHT_MODES: Record<SightMode, string> = {
  treble: 'Clave de Sol',
  bass: 'Clave de Fá',
  alternate: 'Alternar claves',
  both: 'Duas mãos',
};

/** Extensão por clave: [Fase 0, Fase 1+] (igual ao artefato) e a ampliada. */
const RANGE = {
  treble: { 0: [28, 39], 1: [26, 42] },
  bass: { 0: [17, 28], 1: [16, 30] },
} as const;
const RANGE_EXTENDED = { treble: [26, 44], bass: [14, 30] } as const;

export interface Passage {
  /** Pauta a desenhar. */
  clef: 'treble' | 'bass' | 'grand';
  /** Notas da pauta de cima (ou da única), uma por tempo. */
  upper: number[];
  /** Mão esquerda nas duas mãos: uma mínima a cada dois tempos. */
  lower: number[] | null;
}

export function rangeFor(
  clef: 'treble' | 'bass',
  phase: number,
  extended: boolean,
): readonly [number, number] {
  return extended ? RANGE_EXTENDED[clef] : RANGE[clef][phase >= 1 ? 1 : 0];
}

/** Um passo melódico: graus conjuntos e pequenos saltos (ou só saltos, para a ME). */
function step(d: number, lo: number, hi: number, leaps: boolean, rng: Rng): number {
  const steps = leaps ? [-4, -3, -2, 2, 3, 4] : [-2, -1, -1, 1, 1, 2, -3, 3];
  let n = d;
  for (let k = 0; k < 30; k++) {
    n = d + steps[Math.floor(rng() * steps.length)]!;
    if (n >= lo && n <= hi) break;
  }
  return Math.max(lo, Math.min(hi, n));
}

export function melody(
  range: readonly [number, number],
  count: number,
  leaps: boolean,
  rng: Rng,
): number[] {
  const [lo, hi] = range;
  let d = Math.round((lo + hi) / 2) + Math.floor(rng() * 5) - 2;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i) d = step(d, lo, hi, leaps, rng);
    out.push(d);
  }
  return out;
}

export function makePassage(
  mode: SightMode,
  opts: { phase: number; count: number; extended: boolean; previous?: Passage | null },
  rng: Rng = Math.random,
): Passage {
  // o "ler e tocar" do artefato usa a extensão da Fase 1 desde o começo
  const phase = Math.max(opts.phase, 1);
  if (mode === 'both')
    return {
      clef: 'grand',
      upper: melody(rangeFor('treble', phase, opts.extended), 8, false, rng),
      lower: melody(rangeFor('bass', phase, opts.extended), 4, true, rng),
    };
  const clef = mode === 'alternate' ? (opts.previous?.clef === 'treble' ? 'bass' : 'treble') : mode;
  return {
    clef,
    upper: melody(rangeFor(clef, phase, opts.extended), opts.count, false, rng),
    lower: null,
  };
}

const pitchOf = (d: number) =>
  midiOf({ letter: ((d % 7) + 7) % 7, octave: Math.floor(d / 7), alter: 0 });

/** Posição usada para colorir: pauta de cima = índice, mão esquerda = 100 + índice. */
export const LOWER_POSITION = 100;

/** Notas esperadas no tempo (ms desde o primeiro tempo do trecho). */
export function passageExpected(p: Passage, bpm: number): ExpectedNote[] {
  const beat = 60_000 / bpm;
  const out: ExpectedNote[] = p.upper.map((d, i) => ({
    t: i * beat,
    pitch: pitchOf(d),
    position: i,
    measure: Math.floor(i / 4),
  }));
  for (const [j, d] of (p.lower ?? []).entries())
    out.push({
      t: j * 2 * beat,
      pitch: pitchOf(d),
      position: LOWER_POSITION + j,
      measure: Math.floor(j / 2),
    });
  return out.sort((a, b) => a.t - b.t || a.pitch - b.pitch);
}

/** Duração do trecho (ms). */
export const passageMs = (p: Passage, bpm: number) => (p.upper.length * 60_000) / bpm;

/** O trecho tocado, para ouvir (`recordingSchedule`). */
export function passageEvents(p: Passage, bpm: number, velocity = 80): InputEvent[] {
  const beat = 60_000 / bpm;
  return passageExpected(p, bpm).flatMap((n): InputEvent[] => {
    const len = (n.position >= LOWER_POSITION ? 2 : 1) * beat * 0.9;
    return [
      { type: 'on', pitch: n.pitch, velocity, t: n.t },
      { type: 'off', pitch: n.pitch, velocity: 0, t: n.t + len },
    ];
  });
}
