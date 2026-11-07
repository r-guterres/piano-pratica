// O que os treinos e as partituras do app contam para a Trilha: pontos por
// pilar, a leitura de notas por dia (marco automático) e o resumo de um dia
// (para lembrar no diário). Puro.

import type { HistoryData } from '../storage/history';
import { dayKey } from '../storage/progress';
import type { Pillar } from './content';
import { SONGS } from './content';
import type { Day } from './dates';
import { effectiveMinutes, GRADE_TEXT, type ReadingDay, type TrailState } from './state';

export type Activity = Pick<HistoryData, 'scoreSessions' | 'drillRounds' | 'pedalSessions'>;

/**
 * Pontos que vêm do app (somados aos da Trilha): 1 por nota lida de primeira
 * no treino de leitura, 1 por troca de pedal certa e 1 por minuto de partitura.
 */
export function appPoints(data: Activity): Record<Pillar, number> {
  const out: Record<Pillar, number> = {
    harmony: 0,
    reading: 0,
    ear: 0,
    technique: 0,
    repertoire: 0,
    voice: 0,
  };
  for (const r of data.drillRounds) out.reading += r.summary.firstTry;
  for (const p of data.pedalSessions) out.technique += p.ok;
  const scoreMs = data.scoreSessions.reduce((a, s) => a + s.summary.durationMs, 0);
  out.repertoire += Math.floor(scoreMs / 60_000);
  return out;
}

export function readingDays(data: Pick<HistoryData, 'drillRounds'>): ReadingDay[] {
  return data.drillRounds.map((r) => ({
    day: dayKey(r.startedAt),
    clefs: r.config.clefs,
    answered: r.summary.answered,
    firstTry: r.summary.firstTry,
  }));
}

const pct = (a: number, t: number) => (t ? Math.round((100 * a) / t) : 0);
const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

/** O que foi feito no dia, em frases curtas (para lembrar ao escrever o diário). */
export function daySummary(s: TrailState, data: Activity, d: Day): string[] {
  const out: string[] = [];
  const min = effectiveMinutes(s, d);
  if (min) out.push(`${min} min de prática`);
  if (s.plan?.day === d) {
    const done = s.plan.blocks.filter((b) => s.plan!.done[b.id]);
    if (done.length)
      out.push(
        'Blocos feitos: ' + done.map((b) => b.title + (b.theme ? ` (${b.theme})` : '')).join('; '),
      );
  }
  const rounds = data.drillRounds.filter((r) => dayKey(r.startedAt) === d);
  if (rounds.length) {
    const a = rounds.reduce((x, r) => x + r.summary.firstTry, 0);
    const t = rounds.reduce((x, r) => x + r.summary.answered, 0);
    out.push(
      `Treino de leitura: ${rounds.length} ${rounds.length === 1 ? 'rodada' : 'rodadas'}, ${a} de ${t} de primeira (${pct(a, t)}%)`,
    );
  }
  const pieces: Record<string, { ms: number; follow: boolean }> = {};
  for (const x of data.scoreSessions.filter((x) => dayKey(x.startedAt) === d)) {
    const p = (pieces[x.title] ??= { ms: 0, follow: false });
    p.ms += x.summary.durationMs;
    p.follow ||= x.mode === 'follow';
  }
  for (const [title, p] of Object.entries(pieces))
    out.push(
      `Partitura ${title}: ${minutes(p.ms)} min${p.follow ? ' (com o cursor no tempo)' : ''}`,
    );
  const pedal = data.pedalSessions.filter((p) => dayKey(p.startedAt) === d);
  if (pedal.length) {
    const ok = pedal.reduce((x, p) => x + p.ok, 0);
    const n = pedal.reduce((x, p) => x + p.changes, 0);
    out.push(`Pedal sincopado: ${ok} de ${n} trocas certas`);
  }
  for (const [id, m] of Object.entries(s.songs)) {
    const title = SONGS[id]?.title ?? id;
    for (const r of (m.logs ?? []).filter((r) => r.day === d))
      out.push(
        `${title}: ${r.bpm ? r.bpm + ' bpm, ' : ''}${r.clean} de 3 sem erro${r.stuck ? ', travou em ' + r.stuck : ''}`,
      );
    if (m.lastReview === d && m.lastGrade)
      out.push(`${title}: revisão "${GRADE_TEXT[m.lastGrade]}"`);
  }
  return out;
}
