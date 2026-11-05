import { describe, expect, it } from 'vitest';
import type { Schedule } from './schedule';
import { Sequencer } from './sequencer';

const schedule: Schedule = {
  countIn: [
    { t: 0, kind: 'click', accent: true, beat: 0 },
    { t: 500, kind: 'click', accent: false, beat: 1 },
  ],
  countInMs: 1000,
  body: [
    { t: 0, kind: 'cursor', position: 0 },
    { t: 400, kind: 'cursor', position: 1 },
  ],
  bodyMs: 800,
};

const brief = (events: { t: number; kind: string }[]) => events.map((e) => `${e.kind}@${e.t}`);

describe('Sequencer', () => {
  it('delivers the count-in, then the body, a slice at a time', () => {
    const seq = new Sequencer(schedule, false);
    expect(brief(seq.pull(400))).toEqual(['click@0']);
    expect(brief(seq.pull(1001))).toEqual(['click@500', 'cursor@1000']);
    expect(seq.done).toBe(false);
    expect(brief(seq.pull(5000))).toEqual(['cursor@1400']);
    expect(seq.done).toBe(true);
    expect(seq.endMs).toBe(1800);
  });

  it('repeats the body without the count-in, marking each lap', () => {
    const seq = new Sequencer(schedule, true);
    const events = seq.pull(3500);
    expect(brief(events)).toEqual([
      'click@0',
      'click@500',
      'cursor@1000',
      'cursor@1400',
      'lap@1800',
      'cursor@1800',
      'cursor@2200',
      'lap@2600',
      'cursor@2600',
      'cursor@3000',
      'lap@3400',
      'cursor@3400',
    ]);
    expect(events.at(-1)).toMatchObject({ lap: 3 });
    expect(seq.endMs).toBeNull();
    expect(seq.done).toBe(false);
  });

  it('does not loop forever on an empty body', () => {
    const seq = new Sequencer({ countIn: [], countInMs: 0, body: [], bodyMs: 0 }, true);
    expect(seq.pull(1000)).toEqual([]);
    expect(seq.done).toBe(true);
  });
});
