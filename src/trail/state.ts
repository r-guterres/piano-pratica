// Estado e regras da Trilha (rotina diária do artefato "Trilha do Teclado"):
// plano do dia em blocos, revisão espaçada do repertório, pontos por pilar,
// tópicos, marcos e fases. Puro: as funções recebem o estado e o alteram;
// quem chama grava. As regras são as do artefato.

import { addDays, dayNumber, diffDays, weekOf, type Day } from './dates';
import {
  METHOD,
  PHASES,
  PILLAR_ORDER,
  SONGS,
  TOPIC_PILLARS,
  type Pillar,
  type Song,
  type Topic,
  type TopicPillar,
} from './content';

/** Revisão espaçada: dias até a próxima revisão, por caixa. */
export const BOX_DAYS = [1, 3, 7, 14, 30, 60, 120];
/** Caixa a partir da qual a música conta como dominada (revisão a cada 30 dias ou mais). */
export const MASTERED_BOX = 4;

export type SongStatus = 'queue' | 'learning' | 'maintenance' | 'project';
export type Grade = 'flowed' | 'hesitated' | 'forgot';

export const STATUS_TEXT: Record<SongStatus, string> = {
  queue: 'Na fila',
  learning: 'Em estudo',
  maintenance: 'Em manutenção',
  project: 'Projeto longo',
};
export const GRADE_TEXT: Record<Grade, string> = {
  flowed: 'fluiu',
  hesitated: 'hesitei',
  forgot: 'esqueci',
};

/**
 * Peça clássica escolhida pelo aluno: a partitura vem de um arquivo dele (ou da
 * biblioteca), não do catálogo. O estado (estudo, revisão) fica em `songs`.
 */
export interface Piece {
  title: string;
  scoreId: string;
  added: Day;
}

/** Registro de estudo de uma música ainda em estudo. */
export interface StudyLog {
  day: Day;
  bpm: number | null;
  /** Vezes seguidas sem erro (0 a 3). */
  clean: number;
  /** Trecho que travou. */
  stuck: string;
  next: string;
}

export interface SongState {
  status: SongStatus;
  /** Caixa da revisão espaçada (índice em BOX_DAYS). */
  box: number;
  /** Próxima revisão (em manutenção). */
  due: Day | null;
  lastReview: Day | null;
  lastGrade?: Grade;
  reviews: number;
  notes: string;
  logs?: StudyLog[];
  /** Partitura do app ligada à música (id da biblioteca ou `file:<nome>`). */
  scoreId?: string;
}

export interface DayLog {
  /** Minutos registrados à mão (sessão, "tocou fora do plano"). */
  min: number;
  blocks: number;
  /** Segundos com o teclado em uso (medidos pelo app). */
  midiSec: number;
}

export type BlockId = 'aq' | 'rev' | 'harm' | 'clas' | 'nova' | 'fim' | 'livre';
export type BlockDrill = 'reading' | 'chords' | 'ear';

export interface Block {
  id: BlockId;
  pillar: Pillar;
  min: number;
  title: string;
  text: string;
  /** Tema (título do tópico), quando o bloco trabalha um tópico. */
  theme?: string | null;
  /** Texto do tópico de leitura quando o bloco é o Skoove ou uma peça. */
  extra?: string | null;
  topic?: string | null;
  /** Músicas para revisar (Fluiu/Hesitei/Esqueci). */
  songs?: string[];
  /** Música em estudo. */
  song?: string;
  drill?: BlockDrill;
  goTo?: 'repertoire';
}

export interface DayPlan {
  day: Day;
  minimal: boolean;
  blocks: Block[];
  done: Partial<Record<BlockId, true>>;
}

export interface TrailGoals {
  /** Horas de prática para o cofrinho. */
  hours: number;
  /** Músicas dominadas para o cofrinho. */
  songs: number;
  daysPerWeek: number;
  skoove: boolean;
}

export interface TrailState {
  version: 1;
  start: Day;
  phase: number;
  goals: TrailGoals;
  days: Record<Day, DayLog>;
  /** Pontos dados pela Trilha (blocos, tópicos, marcos, revisões…). */
  xp: Record<Pillar, number>;
  songs: Record<string, SongState>;
  /** Peças clássicas escolhidas pelo aluno a partir de uma partitura (id = `pieceId`). */
  pieces?: Record<string, Piece>;
  /** Tópicos dominados → dia. */
  topics: Record<string, Day>;
  /** Marcos conquistados → dia. */
  milestones: Record<string, Day>;
  /** Quantos blocos de cada tipo já foram feitos (escolhe o próximo tópico). */
  counters: { harmony: number; technique: number; reading: number };
  plan: DayPlan | null;
  session: { day: Day; startedAt: number } | null;
  /** Dados do artefato sem equivalente no app (históricos dos treinos de lá). */
  legacy?: unknown;
}

const emptyXp = (): Record<Pillar, number> => ({
  harmony: 0,
  reading: 0,
  ear: 0,
  technique: 0,
  repertoire: 0,
  voice: 0,
});

const newSong = (): SongState => ({
  status: 'queue',
  box: 0,
  due: null,
  lastReview: null,
  reviews: 0,
  notes: '',
});

export function initialTrail(today: Day): TrailState {
  const songs: Record<string, SongState> = {};
  for (const id of Object.keys(SONGS)) songs[id] = newSong();
  songs.letitbe!.status = 'learning';
  songs.minueto!.status = 'learning';
  songs.chopinEm!.status = 'project';
  return {
    version: 1,
    start: today,
    phase: 0,
    goals: { hours: 500, songs: 20, daysPerWeek: 5, skoove: true },
    days: {},
    xp: emptyXp(),
    songs,
    topics: {},
    milestones: {},
    counters: { harmony: 0, technique: 0, reading: 0 },
    plan: null,
    session: null,
  };
}

/** Completa um estado gravado com o que faltar (músicas novas no conteúdo etc.). */
export function normalizeTrail(s: TrailState): TrailState {
  const base = initialTrail(s.start);
  const out = { ...base, ...s };
  out.goals = { ...base.goals, ...s.goals };
  out.xp = { ...emptyXp(), ...s.xp };
  out.counters = { ...base.counters, ...s.counters };
  out.songs = { ...s.songs };
  for (const id of Object.keys(SONGS)) out.songs[id] ??= newSong();
  return out;
}

// ---- dias e minutos ----

export function dayLog(s: TrailState, d: Day): DayLog {
  return (s.days[d] ??= { min: 0, blocks: 0, midiSec: 0 });
}

/** Minutos do dia: o maior entre o registrado à mão e o tempo com o teclado em uso. */
export function effectiveMinutes(s: TrailState, d: Day): number {
  const x = s.days[d];
  if (!x) return 0;
  return Math.max(x.min, Math.round(x.midiSec / 60));
}

/** O dia conta como praticado com 5 minutos ou um bloco feito. */
export function practiced(s: TrailState, d: Day): boolean {
  const x = s.days[d];
  return !!x && (effectiveMinutes(s, d) >= 5 || x.blocks >= 1);
}

export function totalMinutes(s: TrailState): number {
  return Object.keys(s.days).reduce((a, d) => a + effectiveMinutes(s, d), 0);
}

export function addMidiSeconds(s: TrailState, d: Day, sec: number): void {
  dayLog(s, d).midiSec += sec;
}

export function logExtraMinutes(s: TrailState, d: Day, min: number, pillar: Pillar): void {
  const m = Math.min(min, 300);
  dayLog(s, d).min += m;
  addXp(s, pillar, Math.min(m, 60));
}

// ---- pontos ----

export function addXp(s: TrailState, p: Pillar, n: number): void {
  s.xp[p] = Math.max(0, (s.xp[p] ?? 0) + n);
}

/** Nível: 100 pontos para o 1º, 200 para o 2º, … */
export function level(xp: number): { n: number; frac: number } {
  let n = 0;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    n++;
    need = 100 * (n + 1);
  }
  return { n, frac: (xp - acc) / need };
}

// ---- repertório ----

export function masteredCount(s: TrailState): number {
  return Object.values(s.songs).filter((m) => m.status === 'maintenance' && m.box >= MASTERED_BOX)
    .length;
}

/** Músicas com revisão vencida até `d`, da mais atrasada para a menos. */
export function overdueSongs(s: TrailState, d: Day): string[] {
  return Object.entries(s.songs)
    .filter(([, m]) => m.status === 'maintenance' && m.due && m.due <= d)
    .sort((a, b) => (a[1].due! < b[1].due! ? -1 : 1))
    .map(([id]) => id);
}

export function reviewSong(s: TrailState, id: string, grade: Grade, d: Day): void {
  const m = s.songs[id];
  if (!m) return;
  if (grade === 'flowed') m.box = Math.min(m.box + 1, BOX_DAYS.length - 1);
  else if (grade === 'forgot') m.box = 0;
  m.due = addDays(d, BOX_DAYS[m.box]!);
  m.lastReview = d;
  m.reviews++;
  m.lastGrade = grade;
  addXp(s, 'repertoire', grade === 'flowed' ? 5 : grade === 'hesitated' ? 3 : 2);
  dayLog(s, d);
}

// ---- peça clássica escolhida pelo aluno ----

export const pieceId = (scoreId: string) => `peca:${scoreId}`;

/** A música do catálogo ou a peça escolhida (com os campos que o catálogo tem). */
export function songInfo(s: TrailState | null, id: string): Song | null {
  const M = SONGS[id];
  if (M) return M;
  const p = s?.pieces?.[id];
  if (!p) return null;
  return {
    title: p.title,
    artist: 'Partitura escolhida por você',
    kind: 'classical',
    phase: s!.phase,
    key: '',
    structure: '',
    tip: '',
  };
}

/** A peça clássica em estudo (a escolhida mais recentemente), ou null. */
export function currentPiece(s: TrailState): string | null {
  const ids = Object.entries(s.pieces ?? {})
    .filter(([id]) => s.songs[id]?.status === 'learning')
    .sort((a, b) => (a[1].added < b[1].added ? 1 : a[1].added > b[1].added ? -1 : 0))
    .map(([id]) => id);
  return ids[0] ?? null;
}

/** Escolhe a próxima peça (uma de cada vez: a que estava em estudo volta para a fila). */
export function choosePiece(s: TrailState, scoreId: string, title: string, d: Day): string {
  const id = pieceId(scoreId);
  for (const other of Object.keys(s.pieces ?? {}))
    if (other !== id && s.songs[other]?.status === 'learning') s.songs[other]!.status = 'queue';
  s.pieces = { ...s.pieces, [id]: { title, scoreId, added: d } };
  const st = (s.songs[id] ??= newSong());
  st.status = 'learning';
  st.scoreId = scoreId;
  refreshPlan(s, d);
  return id;
}

export function songsInStudy(s: TrailState, kind: 'pop' | 'classical'): string[] {
  return Object.entries(s.songs)
    .filter(([id, m]) => m.status === 'learning' && SONGS[id]?.kind === kind)
    .map(([id]) => id);
}

export function setSongStatus(s: TrailState, id: string, status: SongStatus): void {
  const m = s.songs[id];
  if (!m) return;
  m.status = status;
  s.plan = null;
}

/** "Já toco de memória": entra na revisão espaçada, 1ª revisão amanhã. */
export function learnedSong(s: TrailState, id: string, d: Day): void {
  const m = s.songs[id];
  if (!m) return;
  m.status = 'maintenance';
  m.box = 0;
  m.due = addDays(d, 1);
  addXp(s, 'repertoire', 30);
  s.plan = null;
}

export function addStudyLog(s: TrailState, id: string, log: StudyLog): void {
  const m = s.songs[id];
  if (!m) return;
  m.logs = [...(m.logs ?? []), log].slice(-60);
  addXp(s, 'repertoire', 5);
  dayLog(s, log.day);
}

export const lastLog = (s: TrailState, id: string): StudyLog | null =>
  s.songs[id]?.logs?.at(-1) ?? null;

// ---- tópicos, marcos, fases ----

export function topicById(id: string): (Topic & { pillar: TopicPillar; phase: number }) | null {
  for (const [phase, F] of PHASES.entries())
    for (const pillar of TOPIC_PILLARS)
      for (const t of F[pillar]) if (t.id === id) return { ...t, pillar, phase };
  return null;
}

/** O próximo tópico em aberto da lista (em rodízio); se todos estão dominados, revisa todos. */
export function nextTopic(s: TrailState, list: readonly Topic[], index: number): Topic | null {
  if (!list.length) return null;
  const open = list.filter((t) => !s.topics[t.id]);
  const base = open.length ? open : list;
  return base[index % base.length]!;
}

export function toggleTopic(s: TrailState, id: string, d: Day): void {
  const t = topicById(id);
  if (!t) return;
  if (s.topics[id]) {
    delete s.topics[id];
    addXp(s, t.pillar, -20);
  } else {
    s.topics[id] = d;
    addXp(s, t.pillar, 20);
  }
}

export const allMilestones = () => PHASES.flatMap((F) => F.milestones);

/** Marca/desmarca um marco; devolve o aviso a mostrar (ou null). */
export function toggleMilestone(s: TrailState, id: string, d: Day): string | null {
  const m = allMilestones().find((x) => x.id === id);
  if (!m) return null;
  const points = m.boss ? 150 : 50;
  if (s.milestones[id]) {
    delete s.milestones[id];
    addXp(s, m.pillar, -points);
    return null;
  }
  s.milestones[id] = d;
  addXp(s, m.pillar, points);
  return m.boss ? 'Chefão vencido! A próxima fase está liberada.' : 'Marco conquistado.';
}

export function setPhase(s: TrailState, phase: number): void {
  s.phase = Math.max(0, Math.min(PHASES.length - 1, phase));
  s.plan = null;
}

/** Leitura de notas por dia (rodadas do treino do app), para o marco automático. */
export interface ReadingDay {
  day: Day;
  clefs: 'treble' | 'bass' | 'grand';
  answered: number;
  firstTry: number;
}

export const READING_MILESTONE = 'm0a';

/**
 * Marco "ler notas nas duas claves com 90% de acerto": num mesmo dia, 30 notas
 * nas duas claves juntas, ou 20 em cada clave separada, com 90% de primeira.
 * Devolve true se o marco acabou de ser conquistado.
 */
export function autoReadingMilestone(s: TrailState, rounds: readonly ReadingDay[]): boolean {
  if (s.milestones[READING_MILESTONE]) return false;
  const byDay: Record<Day, Record<string, { a: number; t: number }>> = {};
  for (const r of rounds) {
    const x = ((byDay[r.day] ??= {})[r.clefs] ??= { a: 0, t: 0 });
    x.a += r.firstTry;
    x.t += r.answered;
  }
  const ok = (x: { a: number; t: number } | undefined, min: number) =>
    !!x && x.t >= min && x.a / x.t >= 0.9;
  for (const day of Object.keys(byDay).sort()) {
    const c = byDay[day]!;
    if (ok(c.grand, 30) || (ok(c.treble, 20) && ok(c.bass, 20))) {
      s.milestones[READING_MILESTONE] = day;
      addXp(s, 'reading', 50);
      return true;
    }
  }
  return false;
}

// ---- semana e cofrinho ----

export function practicedThisWeek(s: TrailState, d: Day): number {
  return weekOf(d).filter((x) => practiced(s, x)).length;
}

/** Semanas completas (antes da atual) em que a meta de dias foi cumprida. */
export function weeksOnTarget(s: TrailState, today: Day): number {
  let n = 0;
  const first = weekOf(s.start)[0]!;
  for (let d = addDays(weekOf(today)[0]!, -7); d >= first; d = addDays(d, -7))
    if (weekOf(d).filter((x) => practiced(s, x)).length >= s.goals.daysPerWeek) n++;
  return n;
}

/** Cofrinho do piano: média do avanço nas metas de horas e de músicas dominadas. */
export function piggyBank(s: TrailState): { hours: number; mastered: number; frac: number } {
  const hours = totalMinutes(s) / 60;
  const mastered = masteredCount(s);
  const frac = (Math.min(1, hours / s.goals.hours) + Math.min(1, mastered / s.goals.songs)) / 2;
  return { hours, mastered, frac };
}

// ---- plano do dia ----

const topicsOf = (phase: number, p: TopicPillar) => PHASES[phase]?.[p] ?? [];

export function generatePlan(s: TrailState, d: Day, minimal: boolean): DayPlan {
  const F = PHASES[s.phase]!;
  const dn = dayNumber(d);
  const B: Block[] = [];
  const due = overdueSongs(s, d);
  const pops = songsInStudy(s, 'pop');
  const piece = currentPiece(s);

  if (minimal) {
    if (due.length)
      B.push({
        id: 'rev',
        pillar: 'repertoire',
        min: 5,
        title: 'Revisão relâmpago',
        songs: due.slice(0, 1),
        text: 'Toque de memória a música abaixo e avalie. Se quiser continuar depois, ótimo; se não, o dia já conta.',
      });
    else if (pops.length)
      B.push({
        id: 'nova',
        pillar: 'repertoire',
        min: 5,
        title: 'Cinco minutos com uma música',
        song: pops[dn % pops.length]!,
        text: 'Toque o trecho que você já sabe, do começo ao fim. Só isso.',
      });
    else
      B.push({
        id: 'livre',
        pillar: 'repertoire',
        min: 5,
        title: 'Cinco minutos livres',
        text: 'Toque qualquer coisa que dê prazer. O objetivo de hoje é só sentar ao teclado.',
      });
    return { day: d, minimal: true, blocks: B, done: {} };
  }

  const tec = nextTopic(s, F.technique, s.counters.technique);
  if (tec)
    B.push({
      id: 'aq',
      pillar: 'technique',
      min: 5,
      title: 'Aquecimento',
      theme: tec.title,
      text: tec.text,
      topic: tec.id,
    });
  if (due.length)
    B.push({
      id: 'rev',
      pillar: 'repertoire',
      min: 10,
      title: 'Revisão do repertório',
      songs: due.slice(0, 3),
      text: 'Toque cada uma de memória. Antes de começar, diga o tom e a progressão. Depois avalie com sinceridade: é isso que agenda a próxima revisão.',
    });
  else
    B.push({
      id: 'rev',
      pillar: 'reading',
      min: 10,
      title: 'Leitura relâmpago',
      text: 'Nenhuma revisão vence hoje. Faça uns 5 minutos de Treino de leitura e depois toque, por prazer, uma música que você já sabe.',
      drill: 'reading',
    });
  const h = nextTopic(s, F.harmony, s.counters.harmony);
  if (h)
    B.push({
      id: 'harm',
      pillar: 'harmony',
      min: 15,
      title: 'Harmonia e acompanhamento',
      theme: h.title,
      text: h.text,
      topic: h.id,
      drill: 'chords',
    });
  const lt = nextTopic(s, F.reading, s.counters.reading);
  const readingTopic = {
    theme: lt?.title ?? null,
    extra: lt?.text ?? null,
    topic: lt?.id ?? null,
  };
  if (s.songs.chopinEm?.status === 'project' && dn % 4 === 0 && diffDays(s.start, d) >= 14)
    B.push({
      id: 'clas',
      pillar: 'technique',
      min: 15,
      title: 'Projeto longo',
      song: 'chopinEm',
      text: '10 minutos só no trecho difícil, mãos separadas e devagar. Sem meta de terminar. Nos 5 minutos finais, toque algo que você já domina.',
    });
  else if (s.goals.skoove && dn % 2 === 0)
    B.push({
      id: 'clas',
      pillar: 'reading',
      min: 15,
      title: 'Leitura com o Skoove',
      text: 'Abra o Skoove e faça a próxima lição. Ele escuta pelo MIDI e corrige na hora.',
      ...readingTopic,
    });
  else if (piece)
    // a peça vem de uma partitura escolhida pelo aluno (não do catálogo)
    B.push({
      id: 'clas',
      pillar: 'reading',
      min: 15,
      title: 'Peça clássica',
      song: piece,
      text: 'Leia com atenção ao dedilhado. Trabalhe 4 a 8 compassos novos e repasse os já estudados.',
      ...readingTopic,
    });
  else
    B.push({
      id: 'clas',
      pillar: 'reading',
      min: 15,
      title: 'Escolher a peça clássica',
      text: 'Nenhuma peça clássica em estudo. Importe a partitura em Partituras e escolha-a no Repertório como a próxima peça. Enquanto isso, faça o Treino de leitura.',
      ...readingTopic,
      drill: 'reading',
      goTo: 'repertoire',
    });
  if (pops.length)
    B.push({
      id: 'nova',
      pillar: 'repertoire',
      min: 10,
      title: 'Música em estudo',
      song: pops[dn % pops.length]!,
      text: METHOD[dn % METHOD.length]!,
    });
  else
    B.push({
      id: 'nova',
      pillar: 'repertoire',
      min: 10,
      title: 'Escolher a próxima música',
      text: 'Nenhuma música pop está em estudo. Abra o Repertório e coloque uma da fila em estudo.',
      goTo: 'repertoire',
    });
  const voice = topicsOf(s.phase, 'voice');
  const ear = nextTopic(s, F.ear, dn);
  if (voice.length && dn % 3 === 0)
    B.push({
      id: 'fim',
      pillar: 'voice',
      min: 5,
      title: 'Fechamento com a voz',
      theme: voice[0]!.title,
      text: voice[0]!.text,
      topic: voice[0]!.id,
    });
  else if (dn % 2 === 1 && ear)
    B.push({
      id: 'fim',
      pillar: 'ear',
      min: 5,
      title: 'Fechamento: ouvido',
      theme: ear.title,
      text: ear.text,
      topic: ear.id,
      drill: 'ear',
    });
  else
    B.push({
      id: 'fim',
      pillar: 'repertoire',
      min: 5,
      title: 'Fechamento livre',
      text: 'Toque o que quiser, sem corrigir nada. Termine sempre com música.',
    });
  return { day: d, minimal: false, blocks: B, done: {} };
}

/** O plano de hoje (gera um novo se o gravado é de outro dia). */
export function planForDay(s: TrailState, d: Day): DayPlan {
  if (!s.plan || s.plan.day !== d) s.plan = generatePlan(s, d, false);
  return s.plan;
}

/** Gera o plano de novo mantendo marcados os blocos já feitos. */
export function refreshPlan(s: TrailState, d: Day, minimal = s.plan?.minimal ?? false): DayPlan {
  const done = s.plan?.day === d ? s.plan.done : {};
  const plan = generatePlan(s, d, minimal);
  for (const b of plan.blocks) if (done[b.id]) plan.done[b.id] = true;
  return (s.plan = plan);
}

const COUNTER: Partial<Record<BlockId, keyof TrailState['counters']>> = {
  aq: 'technique',
  harm: 'harmony',
  clas: 'reading',
};

/** Marca/desmarca um bloco; devolve o aviso a mostrar (ou null). */
export function toggleBlock(s: TrailState, id: BlockId): string | null {
  const P = s.plan;
  const b = P?.blocks.find((x) => x.id === id);
  if (!P || !b) return null;
  const log = dayLog(s, P.day);
  if (P.done[id]) {
    delete P.done[id];
    log.blocks = Math.max(0, log.blocks - 1);
    addXp(s, b.pillar, -b.min);
    return null;
  }
  P.done[id] = true;
  log.blocks++;
  addXp(s, b.pillar, b.min);
  const counter = COUNTER[id];
  if (counter) s.counters[counter]++;
  if (Object.keys(P.done).length === P.blocks.length)
    return P.minimal
      ? 'Dia cumprido. Quer continuar? Gere a sessão completa.'
      : 'Sessão completa. Bom trabalho.';
  return null;
}

// ---- sessão com cronômetro ----

export function startSession(s: TrailState, d: Day, now: number): void {
  s.session = { day: d, startedAt: now };
  dayLog(s, d);
}

/** Minutos sugeridos ao encerrar (1 a 300). */
export const sessionMinutes = (s: TrailState, now: number) =>
  s.session ? Math.max(1, Math.min(300, Math.round((now - s.session.startedAt) / 60_000))) : 0;

export function finishSession(s: TrailState, minutes: number): void {
  if (!s.session) return;
  dayLog(s, s.session.day).min += Math.min(minutes, 300);
  s.session = null;
}

export { PILLAR_ORDER };
