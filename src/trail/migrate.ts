// Migração dos dados do artefato "Trilha do Teclado" (db do artefato:
// `estado/principal` e a coleção `diario`) para o estado da Trilha do app.
// Puro: recebe o JSON e devolve o estado e as entradas do diário.

import type { Pillar } from './content';
import type { Day } from './dates';
import {
  initialTrail,
  normalizeTrail,
  type Block,
  type BlockDrill,
  type BlockId,
  type DayPlan,
  type Grade,
  type SongState,
  type SongStatus,
  type StudyLog,
  type TrailState,
} from './state';

/** Formato do arquivo de migração (gerado a partir do db do artefato). */
export const MIGRATION_FORMAT = 'piano-pratica/trilha-artefato';

export interface DiaryEntry {
  /** O dia (AAAA-MM-DD) é a chave. */
  id: Day;
  text: string;
  updatedAt: number;
}

const PILLAR: Record<string, Pillar> = {
  harmonia: 'harmony',
  leitura: 'reading',
  ouvido: 'ear',
  tecnica: 'technique',
  repertorio: 'repertoire',
  voz: 'voice',
};
const STATUS: Record<string, SongStatus> = {
  fila: 'queue',
  aprendendo: 'learning',
  manutencao: 'maintenance',
  projeto: 'project',
};
const GRADE: Record<string, Grade> = { fluiu: 'flowed', hesitei: 'hesitated', esqueci: 'forgot' };
const DRILL: Record<string, BlockDrill> = {
  leitura: 'reading',
  lertocar: 'reading',
  acordes: 'chords',
  ouvido: 'ear',
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && isFinite(v) ? v : d);
const dayOrNull = (v: unknown): Day | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

function song(raw: Obj): SongState {
  const out: SongState = {
    status: STATUS[str(raw.status)] ?? 'queue',
    box: num(raw.caixa),
    due: dayOrNull(raw.prox),
    lastReview: dayOrNull(raw.ult),
    reviews: num(raw.revisoes),
    notes: str(raw.notas),
  };
  const grade = GRADE[str(raw.ultNota)];
  if (grade) out.lastGrade = grade;
  if (Array.isArray(raw.registros))
    out.logs = raw.registros.map((r): StudyLog => {
      const x = obj(r);
      return {
        day: dayOrNull(x.data) ?? '',
        bpm: typeof x.bpm === 'number' ? x.bpm : null,
        clean: num(x.limpas),
        stuck: str(x.trava),
        next: str(x.proximo),
      };
    });
  return out;
}

function plan(raw: Obj): DayPlan | null {
  const day = dayOrNull(raw.data);
  if (!day || !Array.isArray(raw.blocos)) return null;
  const blocks = raw.blocos.map((b): Block => {
    const x = obj(b);
    const block: Block = {
      id: str(x.id) as BlockId,
      pillar: PILLAR[str(x.pilar)] ?? 'repertoire',
      min: num(x.min),
      title: str(x.titulo),
      text: str(x.texto),
    };
    if (x.tema != null) block.theme = str(x.tema);
    if (x.extra != null) block.extra = str(x.extra);
    if (x.topico != null) block.topic = str(x.topico);
    if (Array.isArray(x.musicas)) block.songs = x.musicas.map((m) => str(m));
    if (x.musica != null) block.song = str(x.musica);
    if (DRILL[str(x.treino)]) block.drill = DRILL[str(x.treino)];
    if (x.ir === 'repertorio') block.goTo = 'repertoire';
    return block;
  });
  const done: DayPlan['done'] = {};
  for (const [k, v] of Object.entries(obj(raw.feitos))) if (v) done[k as BlockId] = true;
  return { day, minimal: !!raw.minimo, blocks, done };
}

/** Converte o `estado/principal` do artefato. */
export function trailFromArtifact(raw: unknown, today: Day): TrailState {
  const a = obj(raw);
  const s = initialTrail(dayOrNull(a.inicio) ?? today);
  s.phase = num(a.fase);
  const cfg = obj(a.cfg);
  s.goals = {
    hours: num(cfg.metaHoras, s.goals.hours),
    songs: num(cfg.metaMusicas, s.goals.songs),
    daysPerWeek: num(cfg.metaDias, s.goals.daysPerWeek),
    skoove: typeof cfg.skoove === 'boolean' ? cfg.skoove : s.goals.skoove,
  };
  for (const [d, v] of Object.entries(obj(a.dias))) {
    const x = obj(v);
    if (dayOrNull(d)) s.days[d] = { min: num(x.min), blocks: num(x.blocos), midiSec: num(x.midi) };
  }
  for (const [p, v] of Object.entries(obj(a.xp))) {
    const pillar = PILLAR[p];
    if (pillar) s.xp[pillar] = num(v);
  }
  for (const [id, v] of Object.entries(obj(a.musicas))) s.songs[id] = song(obj(v));
  for (const [id, d] of Object.entries(obj(a.topicos))) if (dayOrNull(d)) s.topics[id] = d as Day;
  for (const [id, d] of Object.entries(obj(a.marcos)))
    if (dayOrNull(d)) s.milestones[id] = d as Day;
  const cont = obj(a.cont);
  s.counters = { harmony: num(cont.harm), technique: num(cont.tec), reading: num(cont.leit) };
  s.plan = plan(obj(a.plano));
  const ses = obj(a.sessao);
  s.session =
    dayOrNull(ses.data) && typeof ses.inicio === 'number'
      ? { day: ses.data as Day, startedAt: ses.inicio }
      : null;
  // os históricos dos treinos do artefato ficam guardados para o relatório (M9)
  s.legacy = { treinos: a.treinos ?? null, hist: a.hist ?? null };
  return normalizeTrail(s);
}

/** Converte os documentos da coleção `diario` ({data, texto, atualizadoEm}). */
export function diaryFromArtifact(docs: unknown): DiaryEntry[] {
  if (!Array.isArray(docs)) return [];
  return docs.flatMap((d): DiaryEntry[] => {
    const x = obj(d);
    const day = dayOrNull(x.data);
    const text = str(x.texto);
    if (!day || !text.trim()) return [];
    const at = Date.parse(str(x.atualizadoEm));
    return [{ id: day, text, updatedAt: isNaN(at) ? 0 : at }];
  });
}

/**
 * Lê o arquivo de migração: `{format, estado, diario}`. Lança um erro com
 * mensagem em português se o arquivo não for reconhecido.
 */
export function parseMigration(
  json: string,
  today: Day,
): { trail: TrailState; diary: DiaryEntry[] } {
  let data: Obj;
  try {
    data = obj(JSON.parse(json));
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (data.format !== MIGRATION_FORMAT || !data.estado || typeof data.estado !== 'object')
    throw new Error('Este arquivo não é uma migração da Trilha do Teclado.');
  return { trail: trailFromArtifact(data.estado, today), diary: diaryFromArtifact(data.diario) };
}
