import { describe, expect, it } from 'vitest';
import type { MeasureInfo, TimelineNote, TimelinePosition } from '../score/types';
import {
  beatGrid,
  buildSchedule,
  metronomeSchedule,
  REARTICULATE_MS,
  recordingSchedule,
  type PlaybackEvent,
  type ScheduleOptions,
} from './schedule';

const note = (
  pitch: number,
  duration: number,
  extra: Partial<TimelineNote> = {},
): TimelineNote => ({
  pitch,
  hand: pitch >= 60 ? 'right' : 'left',
  staff: pitch >= 60 ? 0 : 1,
  tieContinuation: false,
  grace: false,
  duration,
  ...extra,
});

const measure = (index: number, start: number, extra: Partial<MeasureInfo> = {}): MeasureInfo => ({
  index,
  start,
  duration: 1,
  beats: 4,
  beatType: 4,
  tempo: null,
  ...extra,
});

/** Posições [compasso, tempo escrito, tempo de execução, notas]. */
const tl = (...rows: [number, number, number, TimelineNote[]][]): TimelinePosition[] =>
  rows.map(([measure, time, perfTime, notes], index) => ({
    index,
    measure,
    time,
    perfTime,
    notes,
  }));

const opts = (over: Partial<ScheduleOptions> = {}): ScheduleOptions => ({
  bpm: 60,
  from: 0,
  to: 99,
  countIn: 0,
  metronome: true,
  play: 'none',
  ...over,
});

const only = (events: PlaybackEvent[], kind: PlaybackEvent['kind']) =>
  events.filter((e) => e.kind === kind);
const times = (events: PlaybackEvent[]) => events.map((e) => e.t);

// 4/4, dois compassos; MD em semínimas e mínima, ME em mínimas e semibreve
const TWO_BARS = tl(
  [0, 0, 0, [note(60, 0.25), note(48, 0.5)]],
  [0, 0.25, 0.25, [note(62, 0.25)]],
  [0, 0.5, 0.5, [note(64, 0.5), note(43, 0.5)]],
  [1, 1, 1, [note(65, 1), note(41, 1)]],
);
const TWO_MEASURES = [measure(0, 0), measure(1, 1)];

describe('buildSchedule', () => {
  it('places beats and cursor moves at the chosen tempo', () => {
    const s = buildSchedule(TWO_BARS, TWO_MEASURES, opts({ bpm: 60 }));
    // a 60 bpm uma semínima = 1 s
    expect(s.bodyMs).toBe(8000);
    const clicks = only(s.body, 'click');
    expect(times(clicks)).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]);
    expect(clicks.map((e) => e.kind === 'click' && e.accent)).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(times(only(s.body, 'cursor'))).toEqual([0, 1000, 2000, 4000]);
  });

  it('plays only the chosen hand, with note lengths', () => {
    const s = buildSchedule(TWO_BARS, TWO_MEASURES, opts({ play: 'left', metronome: false }));
    const notes = s.body.filter((e) => e.kind === 'on' || e.kind === 'off');
    expect(notes.map((e) => [e.t, e.kind, 'pitch' in e && e.pitch])).toEqual([
      [0, 'on', 48],
      [2000, 'off', 48],
      [2000, 'on', 43],
      [4000, 'off', 43],
      [4000, 'on', 41],
      [8000, 'off', 41],
    ]);
  });

  it('skips tie continuations (the tied start already lasts) and grace notes', () => {
    const t = tl(
      [0, 0, 0, [note(60, 0.75)]],
      [0, 0.5, 0.5, [note(60, 0.25, { tieContinuation: true }), note(72, 0, { grace: true })]],
      [0, 0.75, 0.75, [note(62, 0.25)]],
    );
    const s = buildSchedule(t, [measure(0, 0)], opts({ play: 'both', metronome: false }));
    expect(times(only(s.body, 'on'))).toEqual([0, 3000]);
    expect(times(only(s.body, 'off'))).toEqual([3000, 4000]);
  });

  it('plays staccato notes shorter than written', () => {
    const t = tl(
      [0, 0, 0, [note(60, 0.25, { gate: 0.5 })]],
      [0, 0.25, 0.25, [note(60, 0.25, { gate: 0.5 })]],
      [0, 0.5, 0.5, [note(62, 0.5)]],
    );
    const s = buildSchedule(t, [measure(0, 0)], opts({ play: 'both', metronome: false }));
    expect(only(s.body, 'on').map((e) => e.t)).toEqual([0, 1000, 2000]);
    expect(only(s.body, 'off').map((e) => e.t)).toEqual([500, 1500, 4000]);
  });

  it('cuts a note short when the same key is struck again', () => {
    const t = tl([0, 0, 0, [note(60, 1)]], [0, 0.25, 0.25, [note(60, 0.25)]]);
    const s = buildSchedule(t, [measure(0, 0)], opts({ play: 'both', metronome: false }));
    expect(s.body.map((e) => [e.t, e.kind])).toEqual([
      [0, 'on'],
      [0, 'cursor'],
      [1000 - REARTICULATE_MS, 'off'],
      [1000, 'on'],
      [1000, 'cursor'],
      [2000, 'off'],
    ]);
  });

  // Bug do tablet (M5): Sol4 seguido de Sol4 pelo Casio só tocava o primeiro. O
  // note-off e o note-on saíam com o mesmo horário e o caminho até o teclado
  // pode trocar a ordem: o teclado recebia o novo note-on e logo o note-off.
  it('releases a repeated key strictly before striking it again', () => {
    const t = tl([0, 0, 0, [note(67, 0.25)]], [0, 0.25, 0.25, [note(67, 0.25)]]);
    const s = buildSchedule(t, [measure(0, 0)], opts({ play: 'both', metronome: false }));
    const [firstOff] = only(s.body, 'off');
    const secondOn = only(s.body, 'on')[1]!;
    expect(secondOn.t - firstOff!.t).toBeGreaterThanOrEqual(10);
    expect(firstOff!.t).toBeGreaterThan(0);
  });

  it('also leaves the gap when a loop ends and restarts on the same key', () => {
    const t = tl([0, 0, 0, [note(67, 0.5)]], [0, 0.5, 0.5, [note(67, 0.5)]]);
    const s = buildSchedule(t, [measure(0, 0)], opts({ play: 'both', metronome: false }));
    expect(s.bodyMs).toBe(4000);
    expect(times(only(s.body, 'off'))).toEqual([2000 - REARTICULATE_MS, 4000 - REARTICULATE_MS]);
  });

  it('scales a written tempo and its later changes', () => {
    const measures = [measure(0, 0, { tempo: 120 }), measure(1, 1, { tempo: 60 })];
    // escolhido 60 = metade do escrito: o 2º compasso passa a 30 bpm
    const s = buildSchedule(TWO_BARS, measures, opts({ bpm: 60 }));
    expect(times(only(s.body, 'click'))).toEqual([0, 1000, 2000, 3000, 4000, 6000, 8000, 10000]);
    expect(s.bodyMs).toBe(12000);
  });

  it('counts in with full bars of the first meter', () => {
    const s = buildSchedule(TWO_BARS, TWO_MEASURES, opts({ countIn: 1 }));
    expect(s.countInMs).toBe(4000);
    expect(times(s.countIn)).toEqual([0, 1000, 2000, 3000]);
    expect(s.countIn[0]).toMatchObject({ accent: true });
  });

  it('aligns a pickup bar to its end, without accent', () => {
    // anacruse de 1 tempo em 3/4
    const t = tl([0, 0, 0, [note(67, 0.25)]], [1, 0.25, 0.25, [note(72, 0.75)]]);
    const measures = [
      measure(0, 0, { duration: 0.25, beats: 3 }),
      measure(1, 0.25, { duration: 0.75, beats: 3 }),
    ];
    const s = buildSchedule(t, measures, opts());
    const clicks = only(s.body, 'click').map((e) => e.kind === 'click' && [e.t, e.accent, e.beat]);
    expect(clicks).toEqual([
      [0, false, 2],
      [1000, true, 0],
      [2000, false, 1],
      [3000, false, 2],
    ]);
  });

  it('clicks dotted quarters in 6/8', () => {
    expect(beatGrid(6, 8)).toEqual({ beat: 3 / 8, count: 2 });
    expect(beatGrid(3, 8)).toEqual({ beat: 1 / 8, count: 3 });
    const t = tl([0, 0, 0, [note(60, 0.75)]]);
    const s = buildSchedule(t, [measure(0, 0, { duration: 0.75, beats: 6, beatType: 8 })], opts());
    // semibreve = 4 s a 60 bpm; semínima pontuada = 1,5 s
    expect(times(only(s.body, 'click'))).toEqual([0, 1500]);
  });

  it('follows repeats in performance time', () => {
    // compasso 0 tocado duas vezes, depois o 1
    const t = tl([0, 0, 0, [note(60, 1)]], [0, 0, 1, [note(60, 1)]], [1, 1, 2, [note(62, 1)]]);
    const s = buildSchedule(t, TWO_MEASURES, opts({ play: 'both' }));
    expect(times(only(s.body, 'cursor'))).toEqual([0, 4000, 8000]);
    expect(only(s.body, 'click').filter((e) => e.kind === 'click' && e.accent)).toHaveLength(3);
    expect(s.bodyMs).toBe(12000);
  });

  it('lists the notes the student must play, without ties', () => {
    const s = buildSchedule(TWO_BARS, TWO_MEASURES, opts({ expect: 'right', metronome: false }));
    expect(s.expected).toEqual([
      { t: 0, pitch: 60, position: 0, measure: 0 },
      { t: 1000, pitch: 62, position: 1, measure: 0 },
      { t: 2000, pitch: 64, position: 2, measure: 0 },
      { t: 4000, pitch: 65, position: 3, measure: 1 },
    ]);
    expect(buildSchedule(TWO_BARS, TWO_MEASURES, opts()).expected).toEqual([]);
  });

  it('plays only the requested range', () => {
    const s = buildSchedule(TWO_BARS, TWO_MEASURES, opts({ from: 3, to: 3, play: 'right' }));
    expect(s.bodyMs).toBe(4000);
    expect(only(s.body, 'cursor')).toEqual([{ t: 0, kind: 'cursor', position: 3 }]);
    expect(only(s.body, 'on').map((e) => e.kind === 'on' && e.pitch)).toEqual([65]);
  });
});

describe('recordingSchedule', () => {
  it('replays keys and pedal in time order', () => {
    const s = recordingSchedule(
      [
        { type: 'pedal', value: 127, down: true, t: 100 },
        { type: 'on', pitch: 60, velocity: 90, t: 0 },
        { type: 'off', pitch: 60, velocity: 0, t: 400 },
      ],
      1000,
    );
    expect(s.body).toEqual([
      { t: 0, kind: 'on', pitch: 60, velocity: 90 },
      { t: 100, kind: 'pedal', down: true },
      { t: 400, kind: 'off', pitch: 60 },
    ]);
    expect(s.bodyMs).toBe(1000);
  });
});

describe('metronomeSchedule', () => {
  it('repeats one bar, in clicks per minute', () => {
    const s = metronomeSchedule(120, 3, 4);
    expect(times(s.body)).toEqual([0, 500, 1000]);
    expect(s.bodyMs).toBe(1500);
    expect(times(metronomeSchedule(60, 6, 8).body)).toEqual([0, 1000]);
    // "sem compasso" (1 tempo): nenhum acento
    expect(metronomeSchedule(60, 1, 4).body[0]).toMatchObject({ accent: false });
  });
});
