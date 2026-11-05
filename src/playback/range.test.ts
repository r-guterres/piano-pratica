import { describe, expect, it } from 'vitest';
import type { TimelinePosition } from '../score/types';
import { loopPositions, measureStart } from './range';

/** [compasso, tempo escrito, tempo de execução] por posição. */
const tl = (...rows: [number, number, number][]): TimelinePosition[] =>
  rows.map(([measure, time, perfTime], index) => ({ index, measure, time, perfTime, notes: [] }));

// compassos 0, 1, 1 de novo (ritornelo: o tempo escrito volta), 2
const T = tl(
  [0, 0, 0],
  [0, 0.5, 0.5],
  [1, 1, 1],
  [1, 1.5, 1.5],
  [1, 1, 2],
  [1, 1.5, 2.5],
  [2, 2, 3],
);

describe('measureStart', () => {
  it('goes back to the first position of the same pass of the measure', () => {
    expect(measureStart(T, 1)).toBe(0);
    expect(measureStart(T, 3)).toBe(2);
    expect(measureStart(T, 5)).toBe(4);
    expect(measureStart(T, 6)).toBe(6);
  });
});

describe('loopPositions', () => {
  it('takes the first pass of the measures in the loop', () => {
    expect(loopPositions(T, { startMeasure: 1, endMeasure: 1 })).toEqual({ from: 2, to: 5 });
    expect(loopPositions(T, { startMeasure: 0, endMeasure: 2 })).toEqual({ from: 0, to: 6 });
    expect(loopPositions(T, { startMeasure: 5, endMeasure: 6 })).toBeNull();
  });
});
