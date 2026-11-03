// Sequência de "passos" esperados: o conjunto de alturas que começam a soar em
// cada posição do cursor, filtrado pela mão escolhida. Puro, sem OSMD.

import type { MidiPitch } from '../core/events';
import type { HandSelection, TimelinePosition } from './types';

export interface Step {
  /** Índice do passo na sequência (0, 1, 2…). */
  index: number;
  /** Posição do cursor correspondente (TimelinePosition.index). */
  position: number;
  measure: number;
  /** Alturas exigidas, sem repetição, em ordem crescente. */
  pitches: MidiPitch[];
}

/**
 * Regras (PLANO_INICIAL.md §5.2):
 * - só entram notas iniciadas no instante: continuação de ligadura não conta;
 * - apojaturas (grace) não bloqueiam o avanço na v1, então não entram;
 * - pausas e posições que ficam vazias após o filtro de mão são puladas.
 */
export function buildSteps(timeline: readonly TimelinePosition[], hands: HandSelection): Step[] {
  const steps: Step[] = [];
  for (const pos of timeline) {
    const pitches = new Set<MidiPitch>();
    for (const n of pos.notes) {
      if (n.tieContinuation || n.grace) continue;
      if (hands !== 'both' && n.hand !== hands) continue;
      pitches.add(n.pitch);
    }
    if (pitches.size === 0) continue;
    steps.push({
      index: steps.length,
      position: pos.index,
      measure: pos.measure,
      pitches: [...pitches].sort((a, b) => a - b),
    });
  }
  return steps;
}

/**
 * Índice do primeiro passo cuja posição é ≥ `position` (ou -1 se não houver).
 * Serve para sincronizar o passo atual quando o cursor é movido livremente.
 */
export function stepAtOrAfter(steps: readonly Step[], position: number): number {
  let lo = 0;
  let hi = steps.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (steps[mid]!.position < position) lo = mid + 1;
    else hi = mid;
  }
  return lo < steps.length ? lo : -1;
}
