import { describe, expect, it } from 'vitest';
import type { TimelinePosition } from '../score/types';
import { loopPositions, measureStart, measureStep } from './range';

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

describe('measureStep', () => {
  it('jumps to the start of the next measure, each repeat pass counting as one', () => {
    expect([0, 1, 2, 3, 4, 5].map((p) => measureStep(T, p, 1))).toEqual([2, 2, 4, 4, 6, 6]);
    expect(measureStep(T, 6, 1)).toBe(6); // último compasso: fica
    const end = tl([0, 0, 0], [1, 1, 1], [1, 1.5, 1.5]);
    expect(measureStep(end, 1, 1)).toBe(1); // não vai para a última nota
  });

  it('goes back to the start of the measure, or of the previous one when already there', () => {
    expect(measureStep(T, 3, -1)).toBe(2);
    expect(measureStep(T, 2, -1)).toBe(0);
    expect(measureStep(T, 4, -1)).toBe(2); // da 2ª passagem para a 1ª
    expect(measureStep(T, 6, -1)).toBe(4);
    expect(measureStep(T, 0, -1)).toBe(0);
  });
});

describe('loopPositions', () => {
  it('takes the first pass of the measures in the loop', () => {
    expect(loopPositions(T, { startMeasure: 1, endMeasure: 1 })).toEqual({ from: 2, to: 5 });
    expect(loopPositions(T, { startMeasure: 0, endMeasure: 2 })).toEqual({ from: 0, to: 6 });
    expect(loopPositions(T, { startMeasure: 5, endMeasure: 6 })).toBeNull();
  });
});
