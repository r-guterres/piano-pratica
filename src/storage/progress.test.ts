import { describe, expect, it } from 'vitest';
import type { DrillSummary } from '../drills/readingDrill';
import type { WaitModeSummary } from '../practice/waitMode';
import type { DrillRoundRecord, ExerciseRecord, HistoryData, ScoreSessionRecord } from './history';
import {
  dailyTotals,
  dayKey,
  drillTrend,
  EXPORT_FORMAT,
  exerciseProgress,
  exportFileName,
  pieceProgress,
  toExportJson,
  troubleMeasures,
} from './progress';

// datas no fuso local, como no aparelho
const at = (day: number, hour = 10) => new Date(2026, 10, day, hour).getTime();
const MIN = 60_000;

const waitSummary = (completed: number, clean: number, durationMs: number): WaitModeSummary => ({
  completed,
  clean,
  wrongNotes: completed - clean,
  errorsByMeasure: {},
  mistakes: [],
  durationMs,
  laps: 0,
  meanStepMs: null,
});

let n = 0;
const session = (
  scoreId: string,
  startedAt: number,
  completed: number,
  clean: number,
  durationMs = 5 * MIN,
  finished = false,
): ScoreSessionRecord => ({
  id: `s${n++}`,
  scoreId,
  title: scoreId.toUpperCase(),
  startedAt,
  hands: 'both',
  loop: null,
  stepCount: 40,
  finished,
  summary: waitSummary(completed, clean, durationMs),
});

const drillSummary = (answered: number, firstTry: number, meanMs: number | null): DrillSummary => ({
  answered,
  firstTry,
  wrongNotes: answered - firstTry,
  revealed: 0,
  meanReactionMs: meanMs,
  items: [],
});

const round = (startedAt: number, answered: number, firstTry: number): DrillRoundRecord => ({
  id: `r${n++}`,
  startedAt,
  durationMs: 5 * MIN,
  config: {
    clefs: 'bass',
    range: { treble: { low: 28, high: 40 }, bass: { low: 16, high: 28 } },
    accidentals: false,
    keySignature: 0,
  },
  summary: drillSummary(answered, firstTry, 1500),
});

const exercise = (
  kind: ExerciseRecord['kind'],
  mode: string,
  startedAt: number,
  answered: number,
  correct: number,
  firstTry: number,
  durationMs = MIN,
  trouble?: Record<string, number>,
): ExerciseRecord => ({
  id: `e${n++}`,
  kind,
  mode,
  startedAt,
  durationMs,
  answered,
  correct,
  firstTry,
  trouble,
});

const data = (over: Partial<HistoryData> = {}): HistoryData => ({
  trail: null,
  diary: [],
  exercises: [],
  scoreSessions: [],
  drillRounds: [],
  drillStats: {},
  files: [],
  pedalSessions: [],
  recordings: [],
  ...over,
});

describe('progress', () => {
  it('formats local days', () => {
    expect(dayKey(at(4, 0))).toBe('2026-11-04');
    expect(dayKey(at(4, 23))).toBe('2026-11-04');
  });

  it('adds up practice time per day, with empty days, oldest first', () => {
    const totals = dailyTotals(
      data({
        scoreSessions: [
          session('a', at(4, 9), 1, 1),
          session('a', at(4, 20), 1, 1),
          session('a', at(1), 1, 1),
        ],
        drillRounds: [round(at(3), 10, 5), round(at(4), 10, 5)],
        exercises: [exercise('ear', 'mm', at(2), 10, 8, 8, 3 * MIN)],
      }),
      3,
      at(4, 22),
    );
    expect(totals).toEqual([
      { day: '2026-11-02', scoreMs: 0, drillMs: 3 * MIN },
      { day: '2026-11-03', scoreMs: 0, drillMs: 5 * MIN },
      { day: '2026-11-04', scoreMs: 10 * MIN, drillMs: 5 * MIN },
    ]);
  });

  it('summarizes each piece, most recent first', () => {
    const rows = pieceProgress([
      session('b', at(2), 10, 5),
      session('a', at(1), 20, 10),
      session('a', at(3), 0, 0), // abriu e não tocou: conta a sessão, não a porcentagem
      session('a', at(2), 20, 18, 3 * MIN, true),
    ]);
    expect(rows.map((r) => r.scoreId)).toEqual(['a', 'b']);
    expect(rows[0]).toEqual({
      scoreId: 'a',
      title: 'A',
      sessions: 3,
      totalMs: 13 * MIN,
      lastAt: at(3),
      finished: 1,
      firstCleanPct: 50,
      lastCleanPct: 90,
    });
  });

  it('ranks the measures with most problems over the last sessions of a piece', () => {
    const withErrors = (scoreId: string, day: number, errors: Record<number, number>) => ({
      ...session(scoreId, at(day), 10, 5),
      summary: { ...waitSummary(10, 5, MIN), errorsByMeasure: errors },
    });
    const sessions = [
      withErrors('a', 1, { 7: 9 }), // fica de fora com lastN = 2
      withErrors('a', 2, { 3: 2, 4: 1 }),
      withErrors('a', 3, { 3: 1, 5: 0, 6: 3 }),
      withErrors('b', 3, { 1: 50 }), // outra peça
    ];
    expect(troubleMeasures(sessions, 'a', 2)).toEqual([
      { measure: 3, count: 3, sessions: 2 },
      { measure: 6, count: 3, sessions: 1 },
      { measure: 4, count: 1, sessions: 1 },
    ]);
  });

  it('lists the drill rounds that had answers, in order', () => {
    const trend = drillTrend([round(at(2), 20, 15), round(at(1), 10, 5), round(at(3), 0, 0)]);
    expect(trend.map((p) => p.firstTryPct)).toEqual([50, 75]);
    expect(trend[0]).toMatchObject({ answered: 10, meanReactionMs: 1500, clefs: 'bass' });
  });

  it('exports a self-describing JSON file', () => {
    const json = JSON.parse(
      toExportJson(data({ scoreSessions: [session('a', at(1), 4, 3)] }), {
        exportedAt: at(4),
        commit: 'abc123',
      }),
    );
    expect(json).toMatchObject({ format: EXPORT_FORMAT, version: 3, commit: 'abc123' });
    expect(json.scoreSessions[0].summary.clean).toBe(3);
    expect(exportFileName(at(4))).toBe('piano-pratica-historico-2026-11-04.json');
  });
});

describe('exerciseProgress', () => {
  it('groups the M8 drills by kind and mode, with the hit rate per day', () => {
    const groups = exerciseProgress([
      exercise('chords', 'fase 0', at(3), 10, 10, 6, MIN, { D7: 2, 'C/E': 1 }),
      exercise('chords', 'h0c', at(3, 18), 8, 8, 8),
      exercise('chords', 'h0c', at(4), 4, 3, 2, MIN, { D7: 1 }),
      exercise('ear', 'int', at(4), 10, 7, 7),
      exercise('ear', 'mm', at(4), 0, 0, 0), // sessão sem respostas não conta
    ]);
    expect(groups.map((g) => g.key)).toEqual(['chords', 'ear:int']);
    const chords = groups[0]!;
    // acordes contam os de primeira; os modos ficam juntos
    expect(chords).toMatchObject({ sessions: 3, answered: 22, hits: 16, durationMs: 3 * MIN });
    expect(chords.days).toEqual([
      { day: '2026-11-03', answered: 18, hits: 14 },
      { day: '2026-11-04', answered: 4, hits: 2 },
    ]);
    expect(chords.trouble).toEqual([
      ['D7', 3],
      ['C/E', 1],
    ]);
    expect(groups[1]).toMatchObject({ mode: 'int', hits: 7, answered: 10 });
  });
});
