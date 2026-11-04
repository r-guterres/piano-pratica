import { describe, expect, it } from 'vitest';
import type { InputEvent } from '../core/events';
import { parseMidiMessage } from '../midi/parse';
import { buildSteps } from '../score/steps';
import type { Hand, TimelineNote, TimelinePosition } from '../score/types';
import { StepMatcher } from './matcher';
import { loopStepRange, WaitMode, type WaitModeEvent } from './waitMode';

// ---- helpers: linha do tempo à mão e sequências MIDI simuladas ----

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
  ...extra,
});

/** Cada argumento é uma posição; `measure` = índice/2 (2 posições por compasso). */
const timeline = (...positions: TimelineNote[][]): TimelinePosition[] =>
  positions.map((notes, index) => ({
    index,
    measure: Math.floor(index / 2),
    time: index / 4,
    notes,
  }));

let clock = 0;
const on = (pitch: number, velocity = 90): InputEvent => ({
  type: 'on',
  pitch,
  velocity,
  t: (clock += 100),
});
const off = (pitch: number): InputEvent => ({ type: 'off', pitch, velocity: 0, t: (clock += 10) });

function play(mode: WaitMode, ...events: InputEvent[]): WaitModeEvent[] {
  return events.flatMap((e) => mode.handle(e));
}
const types = (events: WaitModeEvent[]) => events.map((e) => e.type);

// ---- StepMatcher ----

describe('StepMatcher', () => {
  it('classifies note-ons against the step', () => {
    const m = new StepMatcher([60, 64], [67]);
    expect(m.noteOn(60)).toBe('required');
    expect(m.noteOn(60)).toBe('repeat');
    expect(m.noteOn(67)).toBe('tolerated');
    expect(m.noteOn(61)).toBe('wrong');
    expect(m.complete).toBe(false);
    expect(m.missing).toEqual([64]);
    expect(m.noteOn(64)).toBe('required');
    expect(m.complete).toBe(true);
    expect(m.played).toEqual([60, 64]);
  });
});

// ---- casos obrigatórios (PLANO_INICIAL.md §5.2) ----

describe('WaitMode — required cases', () => {
  it('single note: advances on the right note', () => {
    const mode = new WaitMode(buildSteps(timeline([n(60)], [n(62)]), 'both'));
    const events = play(mode, on(60));
    expect(types(events)).toEqual(['started', 'hit', 'advance']);
    expect(mode.current?.pitches).toEqual([62]);
  });

  it('chord played in any order advances only when complete', () => {
    const mode = new WaitMode(buildSteps(timeline([n(60), n(64), n(67)], [n(72)]), 'both'));
    expect(types(play(mode, on(67), on(60)))).toEqual(['started', 'hit', 'hit']);
    expect(mode.current?.index).toBe(0);
    expect(mode.played).toEqual([60, 67]);
    expect(types(play(mode, on(64)))).toEqual(['hit', 'advance']);
    expect(mode.current?.pitches).toEqual([72]);
  });

  it('accumulates note-ons: releasing keys of a chord does not undo progress', () => {
    const mode = new WaitMode(buildSteps(timeline([n(60), n(64)], [n(72)]), 'both'));
    play(mode, on(60), off(60));
    expect(types(play(mode, on(64)))).toEqual(['hit', 'advance']);
  });

  it('wrong note in the middle of a chord marks an error and does not advance', () => {
    const mode = new WaitMode(buildSteps(timeline([n(60), n(64), n(67)], [n(72)]), 'both'));
    const events = play(mode, on(60), on(65), on(64));
    expect(types(events)).toEqual(['started', 'hit', 'wrong', 'hit']);
    expect(mode.current?.index).toBe(0);
    const done = play(mode, on(67));
    expect(done.at(-1)).toMatchObject({ type: 'advance', clean: false });
    const s = mode.summary();
    expect(s.mistakes).toEqual([
      expect.objectContaining({ measure: 0, expected: [60, 64, 67], played: 65 }),
    ]);
    expect(s).toMatchObject({ completed: 1, clean: 0, wrongNotes: 1, errorsByMeasure: { 0: 1 } });
  });

  it('a tied note crossing steps is not required again (and re-striking it is tolerated)', () => {
    // MD segura Sol4 ligado enquanto a ME toca Dó3 no passo seguinte
    const tl = timeline(
      [n(67)],
      [n(67, 'right', { tieContinuation: true }), n(48, 'left')],
      [n(69)],
    );
    const mode = new WaitMode(buildSteps(tl, 'both'));
    play(mode, on(67));
    expect(mode.current?.pitches).toEqual([48]);
    expect(types(play(mode, on(67)))).toEqual([]); // re-ataque da ligada: tolerado
    expect(types(play(mode, on(48)))).toEqual(['hit', 'advance']);
    expect(mode.summary().wrongNotes).toBe(0);
  });

  it('hand filter: right hand only, left-hand notes are tolerated', () => {
    const tl = timeline([n(72), n(48, 'left')], [n(50, 'left')], [n(74), n(52, 'left')]);
    const mode = new WaitMode(buildSteps(tl, 'right'));
    expect(mode.steps.map((s) => s.pitches)).toEqual([[72], [74]]);
    play(mode, on(48), on(72)); // tocou a ME junto, por hábito
    play(mode, on(50), on(52));
    expect(mode.current?.pitches).toEqual([74]);
    expect(types(play(mode, on(74)))).toEqual(['hit', 'advance', 'finished']);
    expect(mode.summary().wrongNotes).toBe(0);
  });

  it('hand filter: the other hand may arrive just after the step advanced', () => {
    // MD toca Ré5 e a ME o acorde Sol3-Si3-Ré4, que chega depois (já no passo do Sol4)
    const tl = timeline([n(74), n(55, 'left'), n(59, 'left'), n(62, 'left')], [n(67)], [n(69)]);
    const mode = new WaitMode(buildSteps(tl, 'right'));
    play(mode, on(74), on(55), on(59), on(62));
    expect(mode.current?.pitches).toEqual([67]);
    expect(mode.summary().wrongNotes).toBe(0);
    // mas um passo depois já não é tolerado
    play(mode, on(67));
    expect(types(play(mode, on(55)))).toEqual(['wrong']);
  });

  it('hand filter: left hand only', () => {
    const tl = timeline([n(72), n(48, 'left')], [n(74)], [n(50, 'left')]);
    const mode = new WaitMode(buildSteps(tl, 'left'));
    expect(mode.steps.map((s) => s.pitches)).toEqual([[48], [50]]);
    expect(types(play(mode, on(55)))).toEqual(['started', 'wrong']);
  });

  it('loop returns to the start of the passage', () => {
    // 4 compassos com 2 posições cada; loop nos compassos 2–3 (índices 1–2)
    const tl = timeline([n(60)], [n(62)], [n(64)], [n(65)], [n(67)], [n(69)], [n(71)], [n(72)]);
    const mode = new WaitMode(buildSteps(tl, 'both'), { loop: { startMeasure: 1, endMeasure: 2 } });
    expect(mode.range).toEqual({ first: 2, last: 5 });
    expect(mode.current?.pitches).toEqual([64]);
    play(mode, on(64), on(65), on(67));
    const events = play(mode, on(69));
    expect(types(events)).toEqual(['hit', 'advance', 'lap']);
    expect(events.at(-1)).toMatchObject({ type: 'lap', lap: 1, to: { pitches: [64] } });
    expect(mode.current?.pitches).toEqual([64]);
    expect(mode.finished).toBe(false);
    play(mode, on(64), on(65), on(67), on(69));
    expect(mode.summary()).toMatchObject({ completed: 8, laps: 2 });
  });

  it('note-on with velocity 0 is a note-off and never counts as playing', () => {
    const mode = new WaitMode(buildSteps(timeline([n(60)], [n(62)]), 'both'));
    const fromBytes = (bytes: number[]) => {
      const msg = parseMidiMessage(bytes, (clock += 100));
      if (msg?.kind !== 'note') throw new Error('esperava nota');
      return msg.event;
    };
    expect(play(mode, fromBytes([0x90, 60, 0]))).toEqual([]); // "note-on" vel 0 = soltou
    expect(mode.current?.index).toBe(0);
    expect(types(play(mode, fromBytes([0x90, 60, 70])))).toEqual(['started', 'hit', 'advance']);
  });
});

// ---- outros comportamentos ----

describe('WaitMode — other behaviour', () => {
  it('requires a new key press for a repeated note', () => {
    const mode = new WaitMode(buildSteps(timeline([n(60)], [n(60)], [n(62)]), 'both'));
    play(mode, on(60));
    expect(mode.current?.index).toBe(1);
    expect(mode.played).toEqual([]);
    play(mode, on(60));
    expect(mode.current?.index).toBe(2);
  });

  it('ignores the sustain pedal', () => {
    const mode = new WaitMode(buildSteps(timeline([n(60)]), 'both'));
    expect(mode.handle({ type: 'pedal', value: 127, down: true, t: 1 })).toEqual([]);
  });

  it('finishes after the last step and ignores further input', () => {
    const mode = new WaitMode(buildSteps(timeline([n(60)]), 'both'));
    const events = play(mode, on(60));
    expect(types(events)).toEqual(['started', 'hit', 'advance', 'finished']);
    expect(events.find((e) => e.type === 'advance')).toMatchObject({ to: null, clean: true });
    expect(mode.finished).toBe(true);
    expect(mode.current).toBeNull();
    expect(play(mode, on(61))).toEqual([]);
  });

  it('jumpTo moves within the passage, resets the step but keeps statistics', () => {
    const mode = new WaitMode(buildSteps(timeline([n(60)], [n(62)], [n(64)]), 'both'));
    play(mode, on(61), on(60));
    mode.jumpTo(2);
    expect(mode.current?.pitches).toEqual([64]);
    mode.jumpTo(99);
    expect(mode.current?.index).toBe(2);
    expect(mode.summary()).toMatchObject({ completed: 1, wrongNotes: 1 });
  });

  it('measures duration and mean step time', () => {
    const mode = new WaitMode(buildSteps(timeline([n(60)], [n(62)]), 'both'));
    mode.handle({ type: 'on', pitch: 60, velocity: 80, t: 1000 });
    mode.handle({ type: 'on', pitch: 61, velocity: 80, t: 1500 });
    mode.handle({ type: 'on', pitch: 62, velocity: 80, t: 1800 });
    // passo 1: 1000→1000 (0 ms, começa no 1º toque); passo 2: 1000→1800
    expect(mode.summary()).toMatchObject({ durationMs: 800, meanStepMs: 400 });
  });

  it('handles an empty score', () => {
    const mode = new WaitMode([]);
    expect(mode.current).toBeNull();
    expect(play(mode, on(60))).toEqual([]);
  });
});

describe('loopStepRange', () => {
  const steps = buildSteps(timeline([n(60)], [n(62)], [n(64)], [n(65)], [n(60)], [n(62)]), 'both');

  it('resolves measures to a contiguous step range', () => {
    expect(loopStepRange(steps, { startMeasure: 1, endMeasure: 1 })).toEqual({ first: 2, last: 3 });
  });

  it('starts at the first step at or after the start measure', () => {
    // compasso 0 vazio após o filtro → começa no 1º passo dentro do trecho
    expect(loopStepRange(steps, { startMeasure: 0, endMeasure: 2 })).toEqual({ first: 0, last: 5 });
  });

  it('returns null when the passage has no steps', () => {
    expect(loopStepRange(steps, { startMeasure: 10, endMeasure: 12 })).toBeNull();
  });

  it('uses the first pass of a repeated passage', () => {
    // simula ritornelo: compassos 0,1,0,1
    const repeated = steps.map((s, i) => ({ ...s, measure: [0, 0, 1, 1, 0, 0][i]! }));
    expect(loopStepRange(repeated, { startMeasure: 1, endMeasure: 1 })).toEqual({
      first: 2,
      last: 3,
    });
    expect(loopStepRange(repeated, { startMeasure: 0, endMeasure: 0 })).toEqual({
      first: 0,
      last: 1,
    });
  });
});
