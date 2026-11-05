import { describe, expect, it } from 'vitest';
import { buildSteps, stepAtOrAfter } from './steps';
import type { Hand, TimelineNote, TimelinePosition } from './types';

// Helpers para montar linhas do tempo à mão.
const n = (
  pitch: number,
  hand: Hand = 'right',
  extra: Partial<TimelineNote> = {},
): TimelineNote => ({
  pitch,
  hand,
  staff: hand === 'right' ? 0 : 1,
  tieContinuation: false,
  grace: false,
  duration: 0.25,
  ...extra,
});
const timeline = (...positions: TimelineNote[][]): TimelinePosition[] =>
  positions.map((notes, index) => ({
    index,
    measure: Math.floor(index / 4),
    time: index / 4,
    perfTime: index / 4,
    notes,
  }));

describe('buildSteps', () => {
  it('creates one step per position with a single note', () => {
    const steps = buildSteps(timeline([n(60)], [n(62)], [n(64)]), 'both');
    expect(steps.map((s) => s.pitches)).toEqual([[60], [62], [64]]);
    expect(steps.map((s) => s.position)).toEqual([0, 1, 2]);
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it('collects a chord as a sorted set', () => {
    const [step] = buildSteps(timeline([n(67), n(60), n(64)]), 'both');
    expect(step!.pitches).toEqual([60, 64, 67]);
  });

  it('merges unisons between hands', () => {
    const [step] = buildSteps(timeline([n(60, 'right'), n(60, 'left')]), 'both');
    expect(step!.pitches).toEqual([60]);
  });

  it('does not require tie continuations', () => {
    const tl = timeline([n(67)], [n(67, 'right', { tieContinuation: true }), n(48, 'left')]);
    expect(buildSteps(tl, 'both').map((s) => s.pitches)).toEqual([[67], [48]]);
  });

  it('skips positions that only continue ties', () => {
    const tl = timeline(
      [n(60), n(64)],
      [n(60, 'right', { tieContinuation: true }), n(64, 'right', { tieContinuation: true })],
      [n(62)],
    );
    const steps = buildSteps(tl, 'both');
    expect(steps.map((s) => s.position)).toEqual([0, 2]);
  });

  it('skips rests (positions without notes)', () => {
    const steps = buildSteps(timeline([n(60)], [], [n(62)]), 'both');
    expect(steps.map((s) => s.position)).toEqual([0, 2]);
  });

  it('ignores grace notes', () => {
    const tl = timeline(
      [n(61, 'right', { grace: true }), n(62)],
      [n(59, 'right', { grace: true })],
    );
    expect(buildSteps(tl, 'both').map((s) => s.pitches)).toEqual([[62]]);
  });

  it('filters by hand and skips positions left empty', () => {
    const tl = timeline([n(72, 'right'), n(48, 'left')], [n(50, 'left')], [n(74, 'right')]);
    expect(buildSteps(tl, 'right').map((s) => [s.position, s.pitches])).toEqual([
      [0, [72]],
      [2, [74]],
    ]);
    expect(buildSteps(tl, 'left').map((s) => [s.position, s.pitches])).toEqual([
      [0, [48]],
      [1, [50]],
    ]);
    expect(buildSteps(tl, 'both')).toHaveLength(3);
  });

  it('keeps the measure of each step', () => {
    const steps = buildSteps(timeline([n(60)], [], [], [], [n(62)]), 'both');
    expect(steps.map((s) => s.measure)).toEqual([0, 1]);
  });
});

describe('buildSteps — tolerated pitches', () => {
  it('tolerates re-striking a tied note', () => {
    const tl = timeline([n(67)], [n(67, 'right', { tieContinuation: true }), n(48, 'left')]);
    const [, second] = buildSteps(tl, 'both');
    expect(second).toMatchObject({ pitches: [48], tolerated: [67] });
  });

  it('tolerates grace notes of the step', () => {
    const [step] = buildSteps(timeline([n(61, 'right', { grace: true }), n(62)]), 'both');
    expect(step).toMatchObject({ pitches: [62], tolerated: [61] });
  });

  it('tolerates the other hand from the previous step position up to the current one', () => {
    const tl = timeline(
      [n(72, 'right'), n(48, 'left')],
      [n(50, 'left')],
      [n(74, 'right'), n(52, 'left')],
    );
    const steps = buildSteps(tl, 'right');
    // 48 continua tolerado no 2º passo: a ME pode chegar depois de a MD avançar
    expect(steps.map((s) => s.tolerated)).toEqual([[48], [48, 50, 52]]);
  });

  it('tolerates nothing extra with both hands and no ties', () => {
    const steps = buildSteps(timeline([n(72), n(48, 'left')], [n(74)]), 'both');
    expect(steps.map((s) => s.tolerated)).toEqual([[], []]);
  });

  it('never tolerates a pitch that is required in the same step', () => {
    const tl = timeline([n(60, 'right'), n(60, 'left', { tieContinuation: true })]);
    expect(buildSteps(tl, 'both')[0]).toMatchObject({ pitches: [60], tolerated: [] });
  });
});

describe('stepAtOrAfter', () => {
  const steps = buildSteps(timeline([n(60)], [], [n(62)], [], [n(64)]), 'both'); // posições 0, 2, 4

  it('finds the step at an exact position', () => {
    expect(stepAtOrAfter(steps, 2)).toBe(1);
  });

  it('finds the next step when the position has none', () => {
    expect(stepAtOrAfter(steps, 1)).toBe(1);
    expect(stepAtOrAfter(steps, 3)).toBe(2);
  });

  it('returns -1 past the last step', () => {
    expect(stepAtOrAfter(steps, 5)).toBe(-1);
  });
});
