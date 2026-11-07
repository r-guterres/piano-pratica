import { describe, expect, it } from 'vitest';
import { diaryFromArtifact, MIGRATION_FORMAT, parseMigration, trailFromArtifact } from './migrate';
import { effectiveMinutes, planForDay } from './state';

// Dados inventados no formato do db do artefato (os reais ficam só no tablet).
const ARTIFACT = {
  v: 1,
  inicio: '2026-10-22',
  fase: 0,
  cfg: { metaDias: 4, metaHoras: 400, metaMusicas: 15, skoove: false },
  cont: { harm: 3, leit: 2, tec: 5 },
  dias: {
    '2026-10-24': { blocos: 6, midi: 1800, min: 43 },
    '2026-11-03': { blocos: 0, midi: 0, min: 10 },
  },
  xp: { harmonia: 100, leitura: 200, ouvido: 10, repertorio: 30, tecnica: 40, voz: 0 },
  musicas: {
    letitbe: {
      caixa: 0,
      notas: 'anotação de teste',
      prox: null,
      revisoes: 0,
      status: 'aprendendo',
      ult: null,
      registros: [{ bpm: 60, data: '2026-10-31', limpas: 2, proximo: 'p', trava: 't' }],
    },
    imagine: {
      caixa: 2,
      notas: '',
      prox: '2026-11-10',
      revisoes: 3,
      status: 'manutencao',
      ult: '2026-11-03',
      ultNota: 'hesitei',
    },
  },
  topicos: { ta0: '2026-11-02' },
  marcos: { m0a: '2026-10-28' },
  plano: {
    data: '2026-11-05',
    minimo: false,
    feitos: { aq: true },
    blocos: [
      {
        id: 'aq',
        min: 5,
        pilar: 'tecnica',
        tema: 'Escalas',
        texto: 'x',
        titulo: 'Aquecimento',
        topico: 'tb0',
      },
      {
        id: 'rev',
        min: 10,
        pilar: 'leitura',
        texto: 'y',
        titulo: 'Leitura relâmpago',
        treino: 'leitura',
      },
    ],
  },
  sessao: null,
  treinos: { leitura: { a: 10, t: 12 } },
  hist: { acordes: { '2026-10-31': { a: 8, t: 9 } } },
};

describe('trailFromArtifact', () => {
  const s = trailFromArtifact(ARTIFACT, '2026-11-07');

  it('keeps the start, phase, goals, days, points and counters', () => {
    expect([s.start, s.phase]).toEqual(['2026-10-22', 0]);
    expect(s.goals).toEqual({ hours: 400, songs: 15, daysPerWeek: 4, skoove: false });
    expect(s.days['2026-10-24']).toEqual({ min: 43, blocks: 6, midiSec: 1800 });
    expect(effectiveMinutes(s, '2026-10-24')).toBe(43);
    expect(s.xp).toEqual({
      harmony: 100,
      reading: 200,
      ear: 10,
      repertoire: 30,
      technique: 40,
      voice: 0,
    });
    expect(s.counters).toEqual({ harmony: 3, technique: 5, reading: 2 });
    expect([s.topics, s.milestones]).toEqual([{ ta0: '2026-11-02' }, { m0a: '2026-10-28' }]);
  });

  it('converts songs, study logs and the last review', () => {
    expect(s.songs.letitbe).toEqual({
      status: 'learning',
      box: 0,
      due: null,
      lastReview: null,
      reviews: 0,
      notes: 'anotação de teste',
      logs: [{ day: '2026-10-31', bpm: 60, clean: 2, stuck: 't', next: 'p' }],
    });
    expect(s.songs.imagine).toMatchObject({
      status: 'maintenance',
      box: 2,
      due: '2026-11-10',
      lastGrade: 'hesitated',
    });
    // músicas ausentes no artefato entram na fila
    expect(s.songs.yesterday!.status).toBe('queue');
  });

  it('keeps today’s plan with the blocks already done', () => {
    expect(s.plan!.done).toEqual({ aq: true });
    expect(s.plan!.blocks[1]).toMatchObject({ id: 'rev', pillar: 'reading', drill: 'reading' });
    expect(planForDay(s, '2026-11-05')).toBe(s.plan); // mesmo dia: não gera outro
    expect(s.legacy).toEqual({ treinos: ARTIFACT.treinos, hist: ARTIFACT.hist });
  });
});

describe('diary and migration file', () => {
  it('keeps diary entries with text', () => {
    expect(
      diaryFromArtifact([
        { data: '2026-11-01', texto: 'Treino bom.', atualizadoEm: '2026-11-01T22:00:00.000Z' },
        { data: '2026-11-02', texto: '   ' },
      ]),
    ).toEqual([
      { id: '2026-11-01', text: 'Treino bom.', updatedAt: Date.parse('2026-11-01T22:00:00.000Z') },
    ]);
  });

  it('rejects files that are not a trail migration', () => {
    expect(() => parseMigration('{', '2026-11-07')).toThrow(/JSON válido/);
    expect(() => parseMigration('{"format":"outro"}', '2026-11-07')).toThrow(/não é uma migração/);
    const ok = parseMigration(
      JSON.stringify({ format: MIGRATION_FORMAT, estado: ARTIFACT, diario: [] }),
      '2026-11-07',
    );
    expect(ok.trail.phase).toBe(0);
  });
});
