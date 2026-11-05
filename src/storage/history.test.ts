import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { WaitModeSummary } from '../practice/waitMode';
import { openDb } from './db';
import { History, type ScoreSessionRecord } from './history';

const fresh = () => new History(openDb(new IDBFactory()));

const summary = (completed: number): WaitModeSummary => ({
  completed,
  clean: completed,
  wrongNotes: 0,
  errorsByMeasure: {},
  mistakes: [],
  durationMs: 1000 * completed,
  laps: 0,
  meanStepMs: 1000,
});

const session = (id: string, startedAt: number, completed = 1): ScoreSessionRecord => ({
  id,
  scoreId: 'minueto-sol',
  title: 'Minueto',
  startedAt,
  hands: 'both',
  loop: null,
  stepCount: 40,
  finished: false,
  summary: summary(completed),
});

describe('History', () => {
  it('stores score sessions and returns them in chronological order', async () => {
    const h = fresh();
    await h.saveScoreSession(session('b', 200));
    await h.saveScoreSession(session('a', 100));
    expect((await h.scoreSessions()).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('updates a session saved again with the same id', async () => {
    const h = fresh();
    await h.saveScoreSession(session('a', 100, 3));
    await h.saveScoreSession(session('a', 100, 10));
    const all = await h.scoreSessions();
    expect(all).toHaveLength(1);
    expect(all[0]!.summary.completed).toBe(10);
  });

  it('keeps the reading drill statistics', async () => {
    const h = fresh();
    expect(await h.drillStats()).toBeNull();
    const stats = { 'bass:F2': { attempts: 2, errors: 1, meanMs: 900, timed: 1, seen: 2 } };
    await h.saveDrillStats(stats);
    expect(await h.drillStats()).toEqual(stats);
  });

  it('saves imported files and lists them without their content', async () => {
    const h = fresh();
    const data = new TextEncoder().encode('<score-partwise/>').buffer;
    await h.saveFile({ id: 'file:a.musicxml', name: 'a.musicxml', title: 'a', addedAt: 1, data });
    expect(await h.files()).toEqual([
      { id: 'file:a.musicxml', name: 'a.musicxml', title: 'a', addedAt: 1 },
    ]);
    const back = await h.file('file:a.musicxml');
    expect(new TextDecoder().decode(back!.data)).toBe('<score-partwise/>');
    await h.deleteFile('file:a.musicxml');
    expect(await h.files()).toEqual([]);
    expect(await h.file('file:a.musicxml')).toBeNull();
  });

  it('survives reopening the database', async () => {
    const factory = new IDBFactory();
    const first = new History(openDb(factory));
    await first.saveScoreSession(session('a', 100));
    (await openDb(factory)).close();
    const second = new History(openDb(factory));
    expect(await second.scoreSessions()).toHaveLength(1);
  });

  it('exports everything in one object', async () => {
    const h = fresh();
    await h.saveScoreSession(session('a', 100));
    const data = await h.exportData();
    expect(data.scoreSessions).toHaveLength(1);
    expect(data.drillRounds).toEqual([]);
    expect(data.drillStats).toEqual({});
    expect(data.files).toEqual([]);
  });
});
