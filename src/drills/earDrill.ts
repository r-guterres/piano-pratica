// Treino de ouvido (do artefato "Trilha do Teclado"): maior ou menor,
// intervalos e graus (cadência I–IV–V–I e depois um acorde). A resposta pode
// ser dada nos botões ou tocando: o intervalo, tocando a nota de cima; o grau,
// tocando o acorde ouvido. Puro.

import type { InputEvent, MidiPitch } from '../core/events';
import { nameChord, parseChord, pitchClass } from '../practice/chords';
import type { Rng } from './priority';

export type EarMode = 'mm' | 'int' | 'degree';

export const EAR_MODES: Record<EarMode, string> = {
  mm: 'Maior ou menor',
  int: 'Intervalos',
  degree: 'Graus',
};

/** Intervalos por fase (a Fase 3 usa os da Fase 2). */
export const INTERVALS_BY_PHASE: [label: string, semitones: number][][] = [
  [
    ['2ª maior', 2],
    ['3ª menor', 3],
    ['3ª maior', 4],
    ['5ª justa', 7],
    ['Oitava', 12],
  ],
  [
    ['2ª maior', 2],
    ['3ª menor', 3],
    ['3ª maior', 4],
    ['4ª justa', 5],
    ['5ª justa', 7],
    ['Oitava', 12],
  ],
  [
    ['2ª maior', 2],
    ['3ª menor', 3],
    ['3ª maior', 4],
    ['4ª justa', 5],
    ['5ª justa', 7],
    ['6ª maior', 9],
    ['7ª menor', 10],
    ['Oitava', 12],
  ],
];

/** Graus: nome, distância da tônica, qualidade (maior/menor). */
export const DEGREES: [label: string, offset: number, quality: 'M' | 'm'][] = [
  ['I', 0, 'M'],
  ['ii', 2, 'm'],
  ['IV', 5, 'M'],
  ['V', 7, 'M'],
  ['vi', 9, 'm'],
  ['♭VII', 10, 'M'],
];

/** Até a Fase 1: I, IV, V e vi; da Fase 2 em diante, também ii e ♭VII. */
export const degreesFor = (phase: number) =>
  phase >= 2 ? DEGREES : DEGREES.filter(([g]) => ['I', 'IV', 'V', 'vi'].includes(g));

/** Fases em que cada modo aparece (graus a partir da Fase 1). */
export const earModesFor = (phase: number): EarMode[] =>
  phase >= 1 ? ['mm', 'int', 'degree'] : ['mm', 'int'];

export interface EarOption {
  label: string;
  value: string;
}

export interface EarQuestion {
  mode: EarMode;
  options: EarOption[];
  answer: string;
  /** O que tocar: notas com início e duração em ms. */
  notes: { pitch: MidiPitch; t: number; dur: number }[];
  /** Intervalo: a nota de baixo; graus: a tônica. */
  root: MidiPitch;
  /** Maior/menor: a qualidade sorteada; graus: o grau sorteado. */
  quality?: 'M' | 'm';
}

const triad = (r: MidiPitch, q: 'M' | 'm') => [r, r + (q === 'M' ? 4 : 3), r + 7];
const pick = <T>(list: readonly T[], rng: Rng) => list[Math.floor(rng() * list.length)]!;

export function earQuestion(mode: EarMode, phase: number, rng: Rng = Math.random): EarQuestion {
  if (mode === 'mm') {
    const r = 52 + Math.floor(rng() * 12);
    const q: 'M' | 'm' = rng() < 0.5 ? 'M' : 'm';
    const c = triad(r, q);
    return {
      mode,
      root: r,
      quality: q,
      options: [
        { label: 'Maior', value: 'M' },
        { label: 'Menor', value: 'm' },
      ],
      answer: q,
      // arpejo e depois o acorde
      notes: [
        ...c.map((pitch, i) => ({ pitch, t: i * 350, dur: 900 })),
        ...c.map((pitch) => ({ pitch, t: 1300, dur: 1600 })),
      ],
    };
  }
  if (mode === 'int') {
    const list = INTERVALS_BY_PHASE[Math.min(phase, 2)]!;
    const [, i] = pick(list, rng);
    const r = 55 + Math.floor(rng() * 10);
    return {
      mode,
      root: r,
      options: list.map(([label, n]) => ({ label, value: String(n) })),
      answer: String(i),
      notes: [
        { pitch: r, t: 0, dur: 900 },
        { pitch: r + i, t: 750, dur: 900 },
        { pitch: r, t: 1700, dur: 1400 },
        { pitch: r + i, t: 1700, dur: 1400 },
      ],
    };
  }
  const tonic = pick([60, 55, 53], rng);
  const list = degreesFor(phase);
  const [label, offset, q] = pick(list, rng);
  const chord = (o: number, qq: 'M' | 'm') => [tonic + o - 12, ...triad(tonic + o, qq)];
  const cadence: [number, 'M' | 'm'][] = [
    [0, 'M'],
    [5, 'M'],
    [7, 'M'],
    [0, 'M'],
  ];
  return {
    mode,
    root: tonic,
    quality: q,
    options: list.map(([l]) => ({ label: l, value: l })),
    answer: label,
    notes: [
      ...cadence.flatMap(([o, qq], i) =>
        chord(o, qq).map((pitch) => ({ pitch, t: i * 600, dur: 550 })),
      ),
      ...chord(offset, q).map((pitch) => ({ pitch, t: 3000, dur: 1500 })),
    ],
  };
}

/** Eventos para o Player (`recordingSchedule`). */
export function questionEvents(q: EarQuestion, velocity = 80): InputEvent[] {
  return q.notes.flatMap((n): InputEvent[] => [
    { type: 'on', pitch: n.pitch, velocity, t: n.t },
    { type: 'off', pitch: n.pitch, velocity: 0, t: n.t + n.dur },
  ]);
}

export const questionMs = (q: EarQuestion) => Math.max(...q.notes.map((n) => n.t + n.dur));

/**
 * Resposta dada tocando. Intervalo: a nota de cima (a nota de baixo exata é
 * ignorada, para o aluno poder se orientar); vale a distância exata ou a classe
 * de altura. Graus: o acorde inteiro (3 notas ou mais). Maior/menor: o acorde
 * na mesma fundamental. Devolve null enquanto não houver resposta.
 */
export function answerFromKeys(q: EarQuestion, held: readonly MidiPitch[]): string | null {
  if (q.mode === 'int') {
    const top = held.filter((p) => p !== q.root).at(-1);
    if (top === undefined) return null;
    const d = top - q.root;
    if (q.options.some((o) => o.value === String(d))) return String(d);
    const pc = pitchClass(d);
    return String(pc === 0 ? 12 : pc);
  }
  if (held.length < 3) return null;
  const name = nameChord(held);
  const chord = name ? parseChord(name.split('/')[0]!) : null;
  if (!chord) return '?';
  const minor = chord.pcs.includes((chord.root + 3) % 12);
  if (q.mode === 'mm') return minor ? 'm' : 'M';
  const offset = pitchClass(chord.root - q.root);
  const degree = DEGREES.find(([, o, qq]) => o === offset && qq === (minor ? 'm' : 'M'));
  return degree ? degree[0] : '?';
}

const INTERVAL_NAMES = [
  'uníssono',
  '2ª menor',
  '2ª maior',
  '3ª menor',
  '3ª maior',
  '4ª justa',
  'trítono',
  '5ª justa',
  '6ª menor',
  '6ª maior',
  '7ª menor',
  '7ª maior',
  'oitava',
];

/** Nome de um intervalo em semitons (até a oitava; acima, pela classe). */
export const intervalName = (n: number) => INTERVAL_NAMES[n <= 12 ? n : n % 12]!;
