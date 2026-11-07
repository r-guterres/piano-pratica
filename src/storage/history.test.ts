import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { WaitModeSummary } from '../practice/waitMode';
import { openDb } from './db';
import { History, type ScoreSessionRecord } from './history';
import { initialTrail } from '../trail/state';

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

  it('upgrades a version 1 database without losing data', async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const req = factory.open('piano-pratica', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('scoreSessions', { keyPath: 'id' }).put(session('old', 100));
        for (const s of ['drillRounds', 'files']) db.createObjectStore(s, { keyPath: 'id' });
        db.createObjectStore('kv');
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    const h = new History(openDb(factory));
    expect((await h.scoreSessions()).map((s) => s.id)).toEqual(['old']);
    expect(await h.pedalSessions()).toEqual([]);
    expect(await h.recordings()).toEqual([]);
  });

  it('upgrades a version 2 database and keeps the trail state and the diary', async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const req = factory.open('piano-pratica', 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ['scoreSessions', 'drillRounds', 'files', 'pedalSessions', 'recordings'])
          db.createObjectStore(s, { keyPath: 'id' });
        db.createObjectStore('kv').put({ old: true }, 'prioritizer');
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    const h = new History(openDb(factory));
    expect(await h.drillStats()).toEqual({ old: true });
    expect(await h.trail()).toBeNull();
    const trail = initialTrail('2026-11-07');
    await h.saveTrail(trail);
    expect(await h.trail()).toEqual(trail);
    await h.saveDiary({ id: '2026-11-07', text: 'Bom treino.', updatedAt: 1 });
    await h.saveDiary({ id: '2026-11-06', text: 'Cansado.', updatedAt: 1 });
    expect((await h.diary()).map((e) => e.id)).toEqual(['2026-11-06', '2026-11-07']);
    expect((await h.diaryEntry('2026-11-07'))?.text).toBe('Bom treino.');
    // apagar o texto apaga a entrada
    await h.saveDiary({ id: '2026-11-07', text: '  ', updatedAt: 2 });
    expect(await h.diaryEntry('2026-11-07')).toBeNull();
  });

  it('keeps recordings and lists them without their events', async () => {
    const h = fresh();
    await h.saveRecording({
      id: 'r1',
      createdAt: 5,
      title: 'Minueto',
      scoreId: 'minueto-sol',
      durationMs: 2000,
      events: [
        { type: 'on', pitch: 60, velocity: 80, t: 0 },
        { type: 'pedal', value: 127, down: true, t: 10 },
        { type: 'off', pitch: 60, velocity: 0, t: 500 },
      ],
    });
    expect(await h.recordings()).toEqual([
      {
        id: 'r1',
        createdAt: 5,
        title: 'Minueto',
        scoreId: 'minueto-sol',
        durationMs: 2000,
        notes: 1,
      },
    ]);
    expect((await h.recording('r1'))?.events).toHaveLength(3);
    await h.deleteRecording('r1');
    expect(await h.recordings()).toEqual([]);
  });

  it('exports everything in one object', async () => {
    const h = fresh();
    await h.saveScoreSession(session('a', 100));
    const data = await h.exportData();
    expect(data.scoreSessions).toHaveLength(1);
    expect(data.drillRounds).toEqual([]);
    expect(data.drillStats).toEqual({});
    expect(data.files).toEqual([]);
    expect(data.trail).toBeNull();
    expect(data.diary).toEqual([]);
  });
});
