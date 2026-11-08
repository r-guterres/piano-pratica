// Exercícios do treino de acordes ligados aos tópicos de harmonia da Trilha:
// o bloco "Harmonia" do dia pede uma progressão específica (C → F/C → G/B → C)
// e o treino a pede na mesma ordem. Tópicos sem exercício (levadas, arranjo,
// tocar pela cifra) usam os acordes da fase. Puro.

import type { ChordDrillOptions } from './chordDrill';

export interface ChordPreset extends Required<ChordDrillOptions> {
  /** Id do tópico da Trilha (content.ts). */
  topic: string;
  /** O que fazer, em uma linha. */
  hint: string;
  /** Cifras; com `inversions: 'written'`, "F/C" pede Dó no baixo e sem barra, a fundamental. */
  chords: string[];
}

const P = (
  topic: string,
  order: ChordPreset['order'],
  inversions: ChordPreset['inversions'],
  chords: string,
  hint: string,
): ChordPreset => ({ topic, order, inversions, chords: chords.split(' '), hint });

export const CHORD_PRESETS: ChordPreset[] = [
  P(
    'h0a',
    'random',
    'written',
    'C F G Am Dm Em',
    'Tríades em posição fundamental, sorteadas. Monte, solte e monte de novo sem olhar.',
  ),
  P(
    'h0b',
    'sequence',
    'written',
    'C C/E C/G F F/A F/C G G/B G/D',
    'Cada acorde em fundamental, 1ª e 2ª inversão, subindo. Repare em qual nota fica no baixo.',
  ),
  P(
    'h0c',
    'sequence',
    'written',
    'C F/C G/B C',
    'I–IV–V–I com condução de vozes: a mão quase não se move.',
  ),
  P(
    'h0d',
    'sequence',
    'written',
    'C G Am F',
    'A fundamental no baixo (ME) e o acorde na MD, em qualquer posição.',
  ),
  P(
    'h1a',
    'sequence',
    'any',
    'C Dm Em F G Am Bdim G Am Bm C D Em F#dim F Gm Am Bb C Dm Edim',
    'O campo harmônico de C, G e F, grau por grau (I ii iii IV V vi vii°), em qualquer inversão.',
  ),
  P(
    'h1b',
    'sequence',
    'any',
    'C G Am F G D Em C F C Dm Bb',
    'I–V–vi–IV em C, G e F. Use inversões para mover a mão o mínimo possível.',
  ),
  P(
    'h1c',
    'sequence',
    'written',
    'C Am F G',
    'I–vi–IV–V com a fundamental no baixo (o 1–5–8 da ME começa nela).',
  ),
  P(
    'h1d',
    'sequence',
    'written',
    'C Cmaj7 F C G Am',
    'Os acordes de Imagine (C Cmaj7 F) e de Simple Man (C G Am), com a fundamental no baixo.',
  ),
  P(
    'h1e',
    'sequence',
    'written',
    'F C C7 F Bb F C7 F',
    'O verso de Hey Jude, com a fundamental no baixo (a ME em mínimas).',
  ),
  P(
    'h2a',
    'random',
    'written',
    'Cmaj7 C7 Cm7 Fmaj7 F7 Fm7 Gmaj7 G7 Gm7',
    'maj7, 7 e m7 em C, F e G, sorteados. Ouça a cor de cada um.',
  ),
  P(
    'h2b',
    'sequence',
    'any',
    'Csus4 C Dsus2 D',
    'A suspensão e a resolução: sus4 → maior, sus2 → maior.',
  ),
  P(
    'h2c',
    'sequence',
    'any',
    'F Eb Bb F A E F#m A7 D Dm A',
    'O ♭VII na coda de Hey Jude (F E♭ B♭ F) e o iv de In My Life (A … D Dm A).',
  ),
  P('h2d', 'sequence', 'any', 'F Em7 A7 Dm Bb C7 F', 'Yesterday: o A7 é o V do vi (Dm).'),
  P(
    'h2f',
    'sequence',
    'any',
    'G D Em C G D C G F C Dm Bb F C Bb F',
    'O verso de Let It Be em G e depois em F, pensando em graus (I V vi IV | I V IV I).',
  ),
];

export const chordPreset = (topic: string | null | undefined) =>
  CHORD_PRESETS.find((p) => p.topic === topic) ?? null;
