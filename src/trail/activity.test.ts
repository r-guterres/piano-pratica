import { describe, expect, it } from 'vitest';
import type { DrillRoundRecord, PedalSessionRecord, ScoreSessionRecord } from '../storage/history';
import { appPoints, daySummary, readingDays } from './activity';
import { addStudyLog, initialTrail } from './state';

const at = (day: string, h = 10) =>
  new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).getTime();

const round = (day: string, answered: number, firstTry: number): DrillRoundRecord =>
  ({
    id: day + answered,
    startedAt: at(day),
    durationMs: 120_000,
    config: { clefs: 'grand' },
    summary: { answered, firstTry, wrongNotes: 0, revealed: 0, meanReactionMs: null, items: [] },
  }) as unknown as DrillRoundRecord;

const score = (day: string, ms: number, mode?: 'follow'): ScoreSessionRecord =>
  ({
    id: day + ms,
    scoreId: 'minueto-sol',
    title: 'Minueto',
    startedAt: at(day),
    summary: { durationMs: ms },
    mode,
  }) as unknown as ScoreSessionRecord;

const pedal = (day: string, changes: number, ok: number): PedalSessionRecord => ({
  id: day,
  startedAt: at(day),
  durationMs: 60_000,
  progression: 'C F G C',
  changes,
  ok,
  verdicts: {},
});

const data = {
  drillRounds: [round('2026-11-06', 40, 36), round('2026-11-07', 20, 19)],
  scoreSessions: [score('2026-11-07', 6 * 60_000), score('2026-11-07', 5 * 60_000, 'follow')],
  pedalSessions: [pedal('2026-11-07', 8, 6)],
};

describe('appPoints', () => {
  it('gives reading, technique and repertoire points from the app’s history', () => {
    expect(appPoints(data)).toEqual({
      harmony: 0,
      reading: 55,
      ear: 0,
      technique: 6,
      repertoire: 11,
      voice: 0,
    });
  });
});

describe('readingDays', () => {
  it('turns drill rounds into reading per day', () => {
    expect(readingDays(data)[0]).toEqual({
      day: '2026-11-06',
      clefs: 'grand',
      answered: 40,
      firstTry: 36,
    });
  });
});

describe('daySummary', () => {
  it('lists what was done on the day', () => {
    const s = initialTrail('2026-10-22');
    s.days['2026-11-07'] = { min: 20, blocks: 0, midiSec: 1800 };
    addStudyLog(s, 'letitbe', { day: '2026-11-07', bpm: 65, clean: 3, stuck: 'refrão', next: '' });
    expect(daySummary(s, data, '2026-11-07')).toEqual([
      '30 min de prática',
      'Treino de leitura: 1 rodada, 19 de 20 de primeira (95%)',
      'Partitura Minueto: 11 min (com o cursor no tempo)',
      'Pedal sincopado: 6 de 8 trocas certas',
      'Let It Be: 65 bpm, 3 de 3 sem erro, travou em refrão',
    ]);
  });
});
