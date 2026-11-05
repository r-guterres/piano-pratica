import { describe, expect, it } from 'vitest';
import type { NoteEvent } from '../core/events';
import type { ExpectedNote } from '../playback/schedule';
import { RhythmJudge } from './rhythm';

// três semínimas a 60 bpm: Dó (c.1), Ré (c.1), Mi (c.2); o trecho dura 3 s
const NOTES: ExpectedNote[] = [
  { t: 0, pitch: 60, position: 0, measure: 0 },
  { t: 1000, pitch: 62, position: 1, measure: 0 },
  { t: 2000, pitch: 64, position: 2, measure: 1 },
];
const ORIGIN = 10_000;
const on = (pitch: number, t: number): NoteEvent => ({ type: 'on', pitch, velocity: 80, t });
const judge = (loop = false) => new RhythmJudge(NOTES, { origin: ORIGIN, bodyMs: 3000, loop });

describe('RhythmJudge', () => {
  it('classifies hits as on time, early or late', () => {
    const j = judge();
    expect(j.handle(on(60, ORIGIN + 40))).toEqual([
      { type: 'hit', note: NOTES[0], lap: 0, offsetMs: 40, timing: 'ontime' },
    ]);
    expect(j.handle(on(62, ORIGIN + 1000 - 150))[0]).toMatchObject({
      timing: 'early',
      offsetMs: -150,
    });
    expect(j.handle(on(64, ORIGIN + 2000 + 200))[0]).toMatchObject({
      timing: 'late',
      offsetMs: 200,
    });
    const s = j.summary();
    expect(s).toMatchObject({ ontime: 1, early: 1, late: 1, wrong: 0 });
    expect(s.meanOffsetMs).toBeCloseTo(30);
    expect(s.meanAbsOffsetMs).toBeCloseTo(130);
    // fora do tempo conta como problema no compasso
    expect(s.problemsByMeasure).toEqual({ 0: 1, 1: 1 });
  });

  it('counts a wrong key against the nearest expected note', () => {
    const j = judge();
    expect(j.handle(on(61, ORIGIN + 980))).toEqual([
      { type: 'wrong', pitch: 61, t: ORIGIN + 980, near: NOTES[1] },
    ]);
    // a mesma tecla, longe demais no tempo, também é errada
    expect(j.handle(on(64, ORIGIN + 1000))[0]).toMatchObject({ type: 'wrong' });
    expect(j.summary()).toMatchObject({ wrong: 2, problemsByMeasure: { 0: 2 } });
  });

  it('does not count a wrong key in place of a note as also missed', () => {
    const j = judge();
    j.handle(on(60, ORIGIN));
    j.handle(on(63, ORIGIN + 1010)); // Ré♯ no lugar do Ré
    j.handle(on(64, ORIGIN + 2000));
    const done = j.advance(ORIGIN + 2400);
    expect(done.filter((e) => e.type === 'missed')).toEqual([]);
    expect(j.summary()).toMatchObject({ wrong: 1, missed: 0, ontime: 2 });
  });

  it('does not match the same expected note twice', () => {
    const j = judge();
    j.handle(on(60, ORIGIN));
    expect(j.handle(on(60, ORIGIN + 50))[0]).toMatchObject({ type: 'wrong' });
  });

  it('ignores keys during the count-in', () => {
    expect(judge().handle(on(60, ORIGIN - 2000))).toEqual([]);
  });

  it('reports missed notes once their window has passed, then the end of the lap', () => {
    const j = judge();
    j.handle(on(60, ORIGIN));
    expect(j.advance(ORIGIN + 1200)).toEqual([]);
    expect(j.advance(ORIGIN + 1400)).toEqual([{ type: 'missed', note: NOTES[1], lap: 0 }]);
    j.handle(on(64, ORIGIN + 2010));
    const end = j.advance(ORIGIN + 2400);
    expect(end).toEqual([
      {
        type: 'lapDone',
        lap: 0,
        stats: { notes: 3, ontime: 2, early: 0, late: 0, missed: 1, wrong: 0 },
        clean: false,
      },
    ]);
    // sem loop, nada depois disso
    expect(j.advance(ORIGIN + 99_000)).toEqual([]);
    expect(j.summary()).toMatchObject({ notes: 3, missed: 1, laps: 1 });
  });

  it('judges each lap of a loop and tells which ones were clean', () => {
    const j = judge(true);
    const laps: boolean[] = [];
    for (let lap = 0; lap < 3; lap++) {
      const base = ORIGIN + lap * 3000;
      j.handle(on(60, base + 10));
      // na 2ª volta o Ré sai atrasado
      j.handle(on(62, base + 1000 + (lap === 1 ? 150 : -20)));
      j.handle(on(64, base + 2000));
      for (const e of j.advance(base + 2400)) if (e.type === 'lapDone') laps.push(e.clean);
    }
    expect(laps).toEqual([true, false, true]);
    expect(j.summary()).toMatchObject({ notes: 9, ontime: 8, late: 1, laps: 3 });
  });
});
