// De onde até onde tocar, em posições do cursor. Puro.

import type { LoopRange } from '../practice/waitMode';
import type { TimelinePosition } from '../score/types';

/** Primeira posição do compasso (na mesma passagem, se houver ritornelo) que contém `position`. */
export function measureStart(timeline: readonly TimelinePosition[], position: number): number {
  let i = Math.min(Math.max(0, position), timeline.length - 1);
  const measure = timeline[i]?.measure;
  while (i > 0) {
    const prev = timeline[i - 1]!;
    // no ritornelo o tempo escrito volta: começou outra passagem
    if (prev.measure !== measure || prev.time >= timeline[i]!.time) break;
    i--;
  }
  return Math.max(0, i);
}

/**
 * Navegação por compassos (◀ ▶): o início do compasso seguinte; para trás, o
 * início do compasso atual se o cursor está no meio dele, senão o do anterior.
 * Cada passagem de um ritornelo conta como um compasso.
 */
export function measureStep(
  timeline: readonly TimelinePosition[],
  position: number,
  delta: 1 | -1,
): number {
  if (!timeline.length) return 0;
  const p = Math.min(Math.max(0, position), timeline.length - 1);
  const start = measureStart(timeline, p);
  if (delta < 0) return p > start ? start : measureStart(timeline, start - 1);
  let i = p + 1;
  while (i < timeline.length && measureStart(timeline, i) === start) i++;
  return i < timeline.length ? i : p; // no último compasso, fica
}

/**
 * Posições do trecho em loop: da primeira posição no compasso inicial até o fim
 * da sequência contínua dentro do trecho (com ritornelo, a primeira passagem),
 * como `loopStepRange` faz com os passos.
 */
export function loopPositions(
  timeline: readonly TimelinePosition[],
  loop: LoopRange,
): { from: number; to: number } | null {
  const inside = (p: TimelinePosition) =>
    p.measure >= loop.startMeasure && p.measure <= loop.endMeasure;
  const from = timeline.findIndex(inside);
  if (from === -1) return null;
  let to = from;
  while (to + 1 < timeline.length && inside(timeline[to + 1]!)) to++;
  return { from, to };
}
