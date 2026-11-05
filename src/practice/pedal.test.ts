import { describe, expect, it } from 'vitest';
import type { InputEvent } from '../core/events';
import { analyzePedal, chordAttacks } from './pedal';

// Sequências MIDI simuladas: acordes de 3 notas e o pedal (CC64).
const chord = (t: number, pitches: number[]): InputEvent[] =>
  pitches.map((pitch, i) => ({ type: 'on', pitch, velocity: 80, t: t + i * 10 }));
const release = (t: number, pitches: number[]): InputEvent[] =>
  pitches.map((pitch) => ({ type: 'off', pitch, velocity: 0, t }));
const pedal = (t: number, down: boolean): InputEvent => ({
  type: 'pedal',
  value: down ? 127 : 0,
  down,
  t,
});

const C = [60, 64, 67];
const F = [60, 65, 69];
const G = [59, 62, 67];

/** C (0 ms) → F (2000 ms) → G (4000 ms), soltando cada acorde só na troca. */
const progression = (pedalEvents: InputEvent[]): InputEvent[] => [
  ...chord(0, C),
  ...release(1990, C),
  ...chord(2000, F),
  ...release(3990, F),
  ...chord(4000, G),
  ...pedalEvents,
];

const verdicts = (events: InputEvent[], now = 10_000) =>
  analyzePedal(events, now).map((c) => c.verdict);

describe('chordAttacks', () => {
  it('groups notes struck together into chords', () => {
    expect(chordAttacks(progression([]))).toEqual([
      { t: 0, pitches: C },
      { t: 2000, pitches: F },
      { t: 4000, pitches: [59, 62, 67] },
    ]);
  });
});

describe('analyzePedal', () => {
  it('accepts lifting with the new chord and pressing again right after', () => {
    const ev = progression([
      pedal(200, true),
      pedal(2010, false),
      pedal(2200, true),
      pedal(4030, false),
      pedal(4250, true),
    ]);
    const changes = analyzePedal(ev, 10_000);
    expect(changes.map((c) => c.verdict)).toEqual(['ok', 'ok']);
    expect(changes[0]).toMatchObject({ index: 1, liftMs: 10, pressMs: 200 });
  });

  it('flags holding the pedal through the change (blur)', () => {
    expect(verdicts(progression([pedal(200, true)]))).toEqual(['held', 'held']);
  });

  it('flags lifting too early, before the new chord', () => {
    const ev = progression([pedal(200, true), pedal(1700, false), pedal(2200, true)]);
    expect(verdicts(ev)[0]).toBe('early-lift');
  });

  it('flags pressing again together with the chord', () => {
    const ev = progression([pedal(200, true), pedal(1990, false), pedal(2005, true)]);
    expect(verdicts(ev)[0]).toBe('early-press');
  });

  it('flags pressing again too late, or never', () => {
    const late = progression([pedal(200, true), pedal(2010, false), pedal(2900, true)]);
    expect(verdicts(late)[0]).toBe('late-press');
    const never = progression([pedal(200, true), pedal(2010, false)]);
    expect(verdicts(never)).toEqual(['late-press', 'no-pedal']);
  });

  it('says when no pedal was used at all', () => {
    expect(verdicts(progression([]))).toEqual(['no-pedal', 'no-pedal']);
  });

  it('waits before judging the last change', () => {
    const ev = progression([pedal(200, true), pedal(2010, false), pedal(2200, true)]);
    // em 4100 a troca para o G ainda não está decidida
    expect(analyzePedal(ev, 4100)).toHaveLength(1);
    expect(analyzePedal(ev, 4800)).toHaveLength(2);
  });
});
