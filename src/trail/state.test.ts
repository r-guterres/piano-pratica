import { describe, expect, it } from 'vitest';
import {
  autoReadingMilestone,
  choosePiece,
  currentPiece,
  effectiveMinutes,
  finishSession,
  generatePlan,
  initialTrail,
  learnedSong,
  level,
  masteredCount,
  normalizeTrail,
  overdueSongs,
  piggyBank,
  pieceId,
  practiced,
  refreshPlan,
  reviewSong,
  sessionMinutes,
  songInfo,
  startSession,
  toggleBlock,
  toggleMilestone,
  weeksOnTarget,
  type TrailState,
} from './state';

/** Um estado como o do artefato em 5/11/2026 (Fase 0, contadores avançados). */
function stateOfNov5(): TrailState {
  const s = initialTrail('2026-10-22');
  s.counters = { harmony: 7, technique: 9, reading: 6 };
  s.topics = { ta0: '2026-11-02' };
  return s;
}

describe('generatePlan', () => {
  it('builds the same blocks as the artifact did on 2026-11-05', () => {
    const plan = generatePlan(stateOfNov5(), '2026-11-05', false);
    expect(plan.blocks.map((b) => [b.id, b.title, b.theme ?? b.song ?? null])).toEqual([
      ['aq', 'Aquecimento', 'Escalas com bemóis: Fá e Si♭ maior'],
      ['rev', 'Leitura relâmpago', null],
      ['harm', 'Harmonia e acompanhamento', 'Baixo na ME, acorde na MD'],
      ['clas', 'Leitura com o Skoove', 'Notas na clave de Sol'],
      ['nova', 'Música em estudo', 'letitbe'],
      ['fim', 'Fechamento livre', null],
    ]);
    expect(plan.blocks.find((b) => b.id === 'nova')!.text).toMatch(/^Estrutura primeiro/);
    expect(plan.blocks.reduce((a, b) => a + b.min, 0)).toBe(60);
  });

  it('puts overdue songs in the review block', () => {
    const s = stateOfNov5();
    learnedSong(s, 'soundsilence', '2026-11-01'); // 1ª revisão em 2/11
    const plan = generatePlan(s, '2026-11-05', false);
    const rev = plan.blocks.find((b) => b.id === 'rev')!;
    expect(rev.title).toBe('Revisão do repertório');
    expect(rev.songs).toEqual(['soundsilence']);
  });

  it('makes a five-minute plan: a due review, else a song in study, else free play', () => {
    const s = stateOfNov5();
    expect(generatePlan(s, '2026-11-05', true).blocks.map((b) => b.song)).toEqual(['letitbe']);
    learnedSong(s, 'soundsilence', '2026-11-01');
    expect(generatePlan(s, '2026-11-05', true).blocks[0]!.songs).toEqual(['soundsilence']);
    const empty = initialTrail('2026-10-22');
    for (const m of Object.values(empty.songs)) m.status = 'queue';
    expect(generatePlan(empty, '2026-11-05', true).blocks[0]!.id).toBe('livre');
  });

  it('studies the classical piece chosen from a score file, one at a time', () => {
    const s = stateOfNov5();
    s.goals.skoove = false;
    const clas = () => generatePlan(s, '2026-11-05', false).blocks.find((b) => b.id === 'clas')!;
    // sem peça escolhida (o Minueto do catálogo não conta): pede para escolher
    expect([clas().title, clas().goTo]).toEqual(['Escolher a peça clássica', 'repertoire']);

    choosePiece(s, 'file:Bartok-Long-And-Short', 'Long And Short', '2026-11-08');
    const id = pieceId('file:Bartok-Long-And-Short');
    expect(currentPiece(s)).toBe(id);
    expect([clas().title, clas().song]).toEqual(['Peça clássica', id]);
    expect(s.songs[id]).toMatchObject({
      status: 'learning',
      scoreId: 'file:Bartok-Long-And-Short',
    });
    expect(songInfo(s, id)).toMatchObject({ title: 'Long And Short', kind: 'classical' });

    // outra peça vira o alvo; a anterior volta para a fila
    choosePiece(s, 'file:Sonatina', 'Sonatina', '2026-11-09');
    expect(currentPiece(s)).toBe(pieceId('file:Sonatina'));
    expect(s.songs[id]!.status).toBe('queue');

    // concluída: entra na revisão espaçada e o bloco volta a pedir a próxima
    learnedSong(s, pieceId('file:Sonatina'), '2026-11-20');
    expect(currentPiece(s)).toBeNull();
    expect(clas().title).toBe('Escolher a peça clássica');
    expect(overdueSongs(s, '2026-11-21')).toEqual([pieceId('file:Sonatina')]);
    // e sobrevive à normalização do estado gravado
    expect(normalizeTrail(structuredClone(s)).pieces).toEqual(s.pieces);
  });

  it('skips topics already mastered', () => {
    const s = stateOfNov5();
    s.topics.tb0 = '2026-11-05';
    s.counters.technique = 0;
    // abertos: só tp0
    expect(generatePlan(s, '2026-11-05', false).blocks[0]!.topic).toBe('tp0');
  });
});

describe('blocks', () => {
  it('gives points, advances the topic counters and announces a full session', () => {
    const s = stateOfNov5();
    s.plan = generatePlan(s, '2026-11-05', false);
    const messages = s.plan.blocks.map((b) => toggleBlock(s, b.id));
    expect(messages.slice(0, -1).every((m) => m === null)).toBe(true);
    expect(messages.at(-1)).toBe('Sessão completa. Bom trabalho.');
    expect(s.counters).toEqual({ harmony: 8, technique: 10, reading: 7 });
    expect(s.xp.technique).toBe(5);
    expect(s.xp.harmony).toBe(15);
    expect(s.days['2026-11-05']!.blocks).toBe(6);
    // desmarcar devolve os pontos
    toggleBlock(s, 'harm');
    expect(s.xp.harmony).toBe(0);
    expect(s.days['2026-11-05']!.blocks).toBe(5);
  });

  it('keeps the done marks when the plan is refreshed', () => {
    const s = stateOfNov5();
    s.plan = generatePlan(s, '2026-11-05', false);
    toggleBlock(s, 'aq');
    refreshPlan(s, '2026-11-05');
    expect(s.plan.done).toEqual({ aq: true });
  });
});

describe('repertoire review (spaced repetition)', () => {
  it('moves up a box when it flowed and back to the first when forgotten', () => {
    const s = initialTrail('2026-10-22');
    learnedSong(s, 'imagine', '2026-11-01');
    expect(s.songs.imagine!.due).toBe('2026-11-02');
    reviewSong(s, 'imagine', 'flowed', '2026-11-02');
    expect([s.songs.imagine!.box, s.songs.imagine!.due]).toEqual([1, '2026-11-05']);
    reviewSong(s, 'imagine', 'hesitated', '2026-11-05');
    expect([s.songs.imagine!.box, s.songs.imagine!.due]).toEqual([1, '2026-11-08']);
    reviewSong(s, 'imagine', 'forgot', '2026-11-08');
    expect([s.songs.imagine!.box, s.songs.imagine!.due]).toEqual([0, '2026-11-09']);
    expect(s.songs.imagine!.reviews).toBe(3);
    expect(s.xp.repertoire).toBe(30 + 5 + 3 + 2);
  });

  it('counts a song as mastered from the 30-day box on', () => {
    const s = initialTrail('2026-10-22');
    learnedSong(s, 'imagine', '2026-11-01');
    s.songs.imagine!.box = 4;
    expect(masteredCount(s)).toBe(1);
    expect(overdueSongs(s, '2026-11-01')).toEqual([]);
    expect(overdueSongs(s, '2026-11-02')).toEqual(['imagine']);
  });
});

describe('days, weeks and the piggy bank', () => {
  it('counts the larger of logged minutes and keyboard time; 5 min or a block = practiced', () => {
    const s = initialTrail('2026-10-22');
    s.days['2026-11-02'] = { min: 10, blocks: 0, midiSec: 1500 };
    s.days['2026-11-03'] = { min: 0, blocks: 0, midiSec: 200 };
    s.days['2026-11-04'] = { min: 0, blocks: 1, midiSec: 0 };
    expect(effectiveMinutes(s, '2026-11-02')).toBe(25);
    expect([
      practiced(s, '2026-11-02'),
      practiced(s, '2026-11-03'),
      practiced(s, '2026-11-04'),
    ]).toEqual([true, false, true]);
  });

  it('counts past weeks that reached the goal', () => {
    const s = initialTrail('2026-10-19');
    s.goals.daysPerWeek = 2;
    // semana de 19/10: 2 dias; semana de 26/10: 1 dia; semana atual não conta
    for (const d of ['2026-10-20', '2026-10-22', '2026-10-28', '2026-11-02', '2026-11-03'])
      s.days[d] = { min: 30, blocks: 0, midiSec: 0 };
    expect(weeksOnTarget(s, '2026-11-04')).toBe(1);
  });

  it('fills the piggy bank half by hours and half by mastered songs', () => {
    const s = initialTrail('2026-10-22');
    s.goals = { ...s.goals, hours: 10, songs: 4 };
    s.days['2026-11-01'] = { min: 300, blocks: 0, midiSec: 0 };
    learnedSong(s, 'imagine', '2026-11-01');
    s.songs.imagine!.box = 4;
    expect(piggyBank(s)).toEqual({ hours: 5, mastered: 1, frac: (0.5 + 0.25) / 2 });
  });
});

describe('milestones and points', () => {
  it('announces a boss and gives its points; unmarking takes them back', () => {
    const s = initialTrail('2026-10-22');
    expect(toggleMilestone(s, 'm0x', '2026-11-05')).toMatch(/Chefão/);
    expect(s.xp.repertoire).toBe(150);
    expect(toggleMilestone(s, 'm0x', '2026-11-05')).toBeNull();
    expect(s.xp.repertoire).toBe(0);
  });

  it('awards the reading milestone from the app’s drill rounds', () => {
    const s = initialTrail('2026-10-22');
    const day = (
      d: string,
      clefs: 'treble' | 'bass' | 'grand',
      answered: number,
      firstTry: number,
    ) => ({ day: d, clefs, answered, firstTry });
    expect(autoReadingMilestone(s, [day('2026-11-01', 'grand', 29, 29)])).toBe(false);
    expect(
      autoReadingMilestone(s, [
        day('2026-11-01', 'treble', 20, 19),
        day('2026-11-02', 'bass', 20, 20),
      ]),
    ).toBe(false);
    expect(
      autoReadingMilestone(s, [
        day('2026-11-03', 'treble', 10, 10),
        day('2026-11-03', 'treble', 10, 9),
        day('2026-11-03', 'bass', 25, 23),
      ]),
    ).toBe(true);
    expect(s.milestones.m0a).toBe('2026-11-03');
    expect(s.xp.reading).toBe(50);
    expect(autoReadingMilestone(s, [day('2026-11-04', 'grand', 50, 50)])).toBe(false);
  });

  it('levels need 100, then 200, then 300 points…', () => {
    expect(level(0)).toEqual({ n: 0, frac: 0 });
    expect(level(150)).toEqual({ n: 1, frac: 0.25 });
    expect(level(300).n).toBe(2);
  });
});

describe('session timer', () => {
  it('suggests the elapsed minutes and adds them to the day', () => {
    const s = initialTrail('2026-10-22');
    startSession(s, '2026-11-05', 0);
    expect(sessionMinutes(s, 25 * 60_000 + 20_000)).toBe(25);
    finishSession(s, 25);
    expect(s.days['2026-11-05']!.min).toBe(25);
    expect(s.session).toBeNull();
  });
});

it('normalizeTrail fills songs and fields missing from an older state', () => {
  const s = initialTrail('2026-10-22');
  delete s.songs.yesterday;
  const partial = { ...s, goals: { hours: 300 } } as unknown as TrailState;
  const n = normalizeTrail(partial);
  expect(n.songs.yesterday!.status).toBe('queue');
  expect(n.goals).toEqual({ hours: 300, songs: 20, daysPerWeek: 5, skoove: true });
});
