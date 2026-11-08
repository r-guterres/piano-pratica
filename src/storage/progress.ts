// Números da tela de progresso e o arquivo de exportação, calculados a partir
// do histórico. Puro (datas no fuso local do aparelho).

import type {
  DrillRoundRecord,
  ExerciseKind,
  ExerciseRecord,
  HistoryData,
  ScoreSessionRecord,
} from './history';

/** Dia local no formato AAAA-MM-DD. */
export function dayKey(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface DayTotal {
  day: string;
  scoreMs: number;
  drillMs: number;
}

/** Tempo de prática por dia nos últimos `days` dias (inclui hoje), do mais antigo ao mais novo. */
export function dailyTotals(data: HistoryData, days: number, now: number): DayTotal[] {
  const out: DayTotal[] = [];
  const index = new Map<string, DayTotal>();
  const today = new Date(now);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const total = { day: dayKey(d.getTime()), scoreMs: 0, drillMs: 0 };
    out.push(total);
    index.set(total.day, total);
  }
  for (const s of data.scoreSessions) {
    const total = index.get(dayKey(s.startedAt));
    if (total) total.scoreMs += s.summary.durationMs;
  }
  for (const r of [...data.drillRounds, ...data.exercises]) {
    const total = index.get(dayKey(r.startedAt));
    if (total) total.drillMs += r.durationMs;
  }
  return out;
}

export interface ExerciseDay {
  day: string;
  answered: number;
  /** Acordes: de primeira; ouvido e ler e tocar: certos. */
  hits: number;
}

export interface ExerciseGroup {
  /** "chords", "ear:int", "sight:treble"… */
  key: string;
  kind: ExerciseKind;
  /** Modo do ouvido / do ler e tocar (os acordes ficam todos juntos). */
  mode: string | null;
  sessions: number;
  answered: number;
  hits: number;
  durationMs: number;
  days: ExerciseDay[];
  /** O que mais deu trabalho, somado em todas as sessões (no máximo 6). */
  trouble: [label: string, times: number][];
}

/** Treinos do M8 agrupados por tipo (e modo), com a taxa de acerto por dia. */
export function exerciseProgress(list: readonly ExerciseRecord[]): ExerciseGroup[] {
  const groups = new Map<string, ExerciseGroup & { troubleMap: Map<string, number> }>();
  for (const e of [...list].sort((a, b) => a.startedAt - b.startedAt)) {
    if (!e.answered) continue;
    const mode = e.kind === 'chords' ? null : e.mode;
    const key = mode ? `${e.kind}:${mode}` : e.kind;
    let g = groups.get(key);
    if (!g) {
      const empty = { sessions: 0, answered: 0, hits: 0, durationMs: 0, trouble: [] };
      g = { key, kind: e.kind, mode, ...empty, days: [], troubleMap: new Map() };
      groups.set(key, g);
    }
    const hits = e.kind === 'chords' ? e.firstTry : e.correct;
    g.sessions++;
    g.answered += e.answered;
    g.hits += hits;
    g.durationMs += e.durationMs;
    const day = dayKey(e.startedAt);
    let d = g.days.at(-1);
    if (d?.day !== day) g.days.push((d = { day, answered: 0, hits: 0 }));
    d.answered += e.answered;
    d.hits += hits;
    for (const [label, n] of Object.entries(e.trouble ?? {}))
      g.troubleMap.set(label, (g.troubleMap.get(label) ?? 0) + n);
  }
  return [...groups.values()].map(({ troubleMap, ...g }) => ({
    ...g,
    trouble: [...troubleMap].sort((a, b) => b[1] - a[1]).slice(0, 6),
  }));
}

export interface PieceProgress {
  scoreId: string;
  title: string;
  sessions: number;
  totalMs: number;
  lastAt: number;
  /** Sessões que chegaram ao fim da peça. */
  finished: number;
  /** % de passos limpos (sem erro) na primeira e na última sessão com passos. */
  firstCleanPct: number | null;
  lastCleanPct: number | null;
}

const cleanPct = (s: ScoreSessionRecord) =>
  s.summary.completed ? Math.round((100 * s.summary.clean) / s.summary.completed) : null;

/** Uma linha por peça, a praticada mais recentemente primeiro. */
export function pieceProgress(sessions: readonly ScoreSessionRecord[]): PieceProgress[] {
  const byScore = new Map<string, ScoreSessionRecord[]>();
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const list = byScore.get(s.scoreId) ?? [];
    list.push(s);
    byScore.set(s.scoreId, list);
  }
  return [...byScore.values()]
    .map((list) => {
      const withSteps = list.filter((s) => s.summary.completed > 0);
      const last = list.at(-1)!;
      return {
        scoreId: last.scoreId,
        title: last.title,
        sessions: list.length,
        totalMs: list.reduce((a, s) => a + s.summary.durationMs, 0),
        lastAt: last.startedAt,
        finished: list.filter((s) => s.finished).length,
        firstCleanPct: withSteps.length ? cleanPct(withSteps[0]!) : null,
        lastCleanPct: withSteps.length ? cleanPct(withSteps.at(-1)!) : null,
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

export interface MeasureTrouble {
  /** Índice do compasso (0 = primeiro). */
  measure: number;
  /** Problemas somados (erradas, perdidas, fora do tempo). */
  count: number;
  /** Em quantas das sessões consideradas ele teve problema. */
  sessions: number;
}

/**
 * Compassos onde mais se erra numa peça, somando as últimas `lastN` sessões
 * (modo espera e acompanhar), do pior para o melhor.
 */
export function troubleMeasures(
  sessions: readonly ScoreSessionRecord[],
  scoreId: string,
  lastN = 10,
  top = 6,
): MeasureTrouble[] {
  const recent = sessions
    .filter((s) => s.scoreId === scoreId)
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-lastN);
  const byMeasure = new Map<number, MeasureTrouble>();
  for (const s of recent)
    for (const [m, count] of Object.entries(s.summary.errorsByMeasure)) {
      if (!count) continue;
      const measure = Number(m);
      const t = byMeasure.get(measure) ?? { measure, count: 0, sessions: 0 };
      t.count += count;
      t.sessions++;
      byMeasure.set(measure, t);
    }
  return [...byMeasure.values()]
    .sort((a, b) => b.count - a.count || a.measure - b.measure)
    .slice(0, top);
}

export interface RoundPoint {
  startedAt: number;
  answered: number;
  /** % de notas acertadas de primeira. */
  firstTryPct: number | null;
  meanReactionMs: number | null;
  clefs: DrillRoundRecord['config']['clefs'];
}

/** Rodadas do treino em ordem cronológica (só as que tiveram respostas). */
export function drillTrend(rounds: readonly DrillRoundRecord[]): RoundPoint[] {
  return [...rounds]
    .filter((r) => r.summary.answered > 0)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((r) => ({
      startedAt: r.startedAt,
      answered: r.summary.answered,
      firstTryPct: Math.round((100 * r.summary.firstTry) / r.summary.answered),
      meanReactionMs: r.summary.meanReactionMs,
      clefs: r.config.clefs,
    }));
}

export const EXPORT_FORMAT = 'piano-pratica/history';
/** 2: + trail e diary (M7); 3: + exercises (M8). */
export const EXPORT_VERSION = 3;

/** O arquivo JSON exportado (para analisar no computador). */
export function toExportJson(
  data: HistoryData,
  meta: { exportedAt: number; commit: string },
): string {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date(meta.exportedAt).toISOString(),
      commit: meta.commit,
      ...data,
    },
    null,
    2,
  );
}

export const exportFileName = (now: number) => `piano-pratica-historico-${dayKey(now)}.json`;
