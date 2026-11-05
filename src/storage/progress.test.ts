import { describe, expect, it } from 'vitest';
import type { DrillSummary } from '../drills/readingDrill';
import type { WaitModeSummary } from '../practice/waitMode';
import type { DrillRoundRecord, HistoryData, ScoreSessionRecord } from './history';
import {
  dailyTotals,
  dayKey,
  drillTrend,
  EXPORT_FORMAT,
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

const data = (over: Partial<HistoryData> = {}): HistoryData => ({
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
      }),
      3,
      at(4, 22),
    );
    expect(totals).toEqual([
      { day: '2026-11-02', scoreMs: 0, drillMs: 0 },
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
    expect(json).toMatchObject({ format: EXPORT_FORMAT, version: 1, commit: 'abc123' });
    expect(json.scoreSessions[0].summary.clean).toBe(3);
    expect(exportFileName(at(4))).toBe('piano-pratica-historico-2026-11-04.json');
  });
});
