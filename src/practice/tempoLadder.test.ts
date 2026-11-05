import { describe, expect, it } from 'vitest';
import { TempoLadder } from './tempoLadder';

describe('TempoLadder', () => {
  it('goes up after N clean laps in a row, and a mistake restarts the count', () => {
    const l = new TempoLadder({ step: 5, needed: 3, target: 100 });
    expect([true, true].map((c) => l.record(c, 60))).toEqual([null, null]);
    expect(l.streak).toBe(2);
    expect(l.record(false, 60)).toBeNull();
    expect(l.streak).toBe(0);
    expect([true, true, true].map((c) => l.record(c, 60))).toEqual([null, null, 65]);
    expect(l.streak).toBe(0);
  });

  it('stops at the target', () => {
    const l = new TempoLadder({ step: 5, needed: 1, target: 72 });
    expect(l.record(true, 70)).toBe(72);
    expect(l.record(true, 72)).toBeNull();
  });
});
