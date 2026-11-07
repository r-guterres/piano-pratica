// Histórico de prática no IndexedDB: sessões do modo espera, rodadas do treino
// de leitura, estatísticas do Prioritizer, partituras importadas, o estado da
// Trilha e o diário.
//
// Os registros são objetos simples (structured clone): não passar proxies do
// Svelte ($state) direto; usar $state.snapshot antes.

import type { InputEvent } from '../core/events';
import type { ItemStats } from '../drills/priority';
import type { PoolConfig } from '../drills/notes';
import type { DrillSummary } from '../drills/readingDrill';
import type { PedalVerdict } from '../practice/pedal';
import type { RhythmSummary } from '../practice/rhythm';
import type { LoopRange, WaitModeSummary } from '../practice/waitMode';
import type { HandSelection } from '../score/types';
import type { DiaryEntry } from '../trail/migrate';
import type { TrailState } from '../trail/state';
import { openDb, run, type RecordStore } from './db';

export interface ScoreSessionRecord {
  id: string;
  /** Id da biblioteca, ou `file:<nome>` para arquivo importado. */
  scoreId: string;
  title: string;
  /** Início da sessão (Date.now()). */
  startedAt: number;
  hands: HandSelection;
  loop: LoopRange | null;
  /** Passos no trecho praticado (a peça inteira ou o loop). */
  stepCount: number;
  /** true = chegou ao fim da peça; false = interrompida. */
  finished: boolean;
  /**
   * No modo acompanhar: completed = notas avaliadas, clean = no tempo,
   * wrongNotes = erradas + perdidas, errorsByMeasure = problemas por compasso.
   */
  summary: WaitModeSummary;
  /** Modo da sessão (ausente = espera, registros anteriores ao M6). */
  mode?: 'wait' | 'follow';
  /** Andamento (modo acompanhar). */
  bpm?: number;
  /** Detalhes do ritmo (modo acompanhar). */
  rhythm?: RhythmSummary;
}

export interface DrillRoundRecord {
  id: string;
  startedAt: number;
  /** Duração da rodada (ms). */
  durationMs: number;
  config: PoolConfig;
  summary: DrillSummary;
}

export interface StoredFile {
  /** `file:<nome do arquivo>`: importar de novo o mesmo arquivo substitui o anterior. */
  id: string;
  name: string;
  title: string;
  addedAt: number;
  data: ArrayBuffer;
}

export type StoredFileInfo = Omit<StoredFile, 'data'>;

export interface PedalSessionRecord {
  id: string;
  startedAt: number;
  durationMs: number;
  /** Progressão pedida (ex.: "C F G C"), ou "livre". */
  progression: string;
  /** Acordes conferidos e quantos estavam certos (ausente no modo livre e antes do 2026-11-05). */
  chords?: number;
  chordsOk?: number;
  /** Trocas de acorde avaliadas e quantas certas. */
  changes: number;
  ok: number;
  verdicts: Partial<Record<PedalVerdict, number>>;
}

export interface RecordingRecord {
  id: string;
  createdAt: number;
  title: string;
  /** Partitura aberta durante a gravação (null = fora do leitor). */
  scoreId: string | null;
  durationMs: number;
  /** Teclas e pedal, com t em ms desde o início da gravação. */
  events: InputEvent[];
}

export type RecordingInfo = Omit<RecordingRecord, 'events'> & { notes: number };

export type ExerciseKind = 'chords' | 'ear' | 'sight';

/** Uma sessão de um treino do M8 (gravada de novo pelo id a cada resposta). */
export interface ExerciseRecord {
  id: string;
  kind: ExerciseKind;
  /** Ouvido: mm/int/degree; ler e tocar: treble/bass/alternate/both; acordes: "fase N". */
  mode: string;
  startedAt: number;
  durationMs: number;
  /** Perguntas (acordes, trechos) respondidas. */
  answered: number;
  correct: number;
  /** Acordes: certos sem tentativa errada; ler e tocar: trechos todos no tempo. */
  firstTry: number;
}

export type DrillStats = Record<string, ItemStats>;

const PRIORITIZER_KEY = 'prioritizer';
const TRAIL_KEY = 'trail';

export class History {
  readonly #db: Promise<IDBDatabase>;

  constructor(db: Promise<IDBDatabase>) {
    this.#db = db;
  }

  async #put(store: RecordStore, value: { id: string }): Promise<void> {
    await run(await this.#db, store, 'readwrite', (s) => s.put(value));
  }

  async #all<T extends { startedAt?: number; addedAt?: number }>(store: RecordStore): Promise<T[]> {
    const rows = (await run(await this.#db, store, 'readonly', (s) => s.getAll())) as T[];
    return rows.sort((a, b) => (a.startedAt ?? a.addedAt ?? 0) - (b.startedAt ?? b.addedAt ?? 0));
  }

  /** Grava (ou atualiza, pelo id) uma sessão do modo espera. */
  saveScoreSession(r: ScoreSessionRecord): Promise<void> {
    return this.#put('scoreSessions', r);
  }

  /** Em ordem cronológica. */
  scoreSessions(): Promise<ScoreSessionRecord[]> {
    return this.#all('scoreSessions');
  }

  saveDrillRound(r: DrillRoundRecord): Promise<void> {
    return this.#put('drillRounds', r);
  }

  drillRounds(): Promise<DrillRoundRecord[]> {
    return this.#all('drillRounds');
  }

  async saveDrillStats(stats: DrillStats): Promise<void> {
    await run(await this.#db, 'kv', 'readwrite', (s) => s.put(stats, PRIORITIZER_KEY));
  }

  async drillStats(): Promise<DrillStats | null> {
    const v = await run(await this.#db, 'kv', 'readonly', (s) => s.get(PRIORITIZER_KEY));
    return (v as DrillStats | undefined) ?? null;
  }

  saveFile(f: StoredFile): Promise<void> {
    return this.#put('files', f);
  }

  async file(id: string): Promise<StoredFile | null> {
    const v = await run(await this.#db, 'files', 'readonly', (s) => s.get(id));
    return (v as StoredFile | undefined) ?? null;
  }

  /** Arquivos importados, sem o conteúdo, do mais antigo ao mais novo. */
  async files(): Promise<StoredFileInfo[]> {
    const all = await this.#all<StoredFile>('files');
    return all.map(({ id, name, title, addedAt }) => ({ id, name, title, addedAt }));
  }

  async deleteFile(id: string): Promise<void> {
    await run(await this.#db, 'files', 'readwrite', (s) => s.delete(id));
  }

  savePedalSession(r: PedalSessionRecord): Promise<void> {
    return this.#put('pedalSessions', r);
  }

  pedalSessions(): Promise<PedalSessionRecord[]> {
    return this.#all('pedalSessions');
  }

  saveRecording(r: RecordingRecord): Promise<void> {
    return this.#put('recordings', r);
  }

  async recording(id: string): Promise<RecordingRecord | null> {
    const v = await run(await this.#db, 'recordings', 'readonly', (s) => s.get(id));
    return (v as RecordingRecord | undefined) ?? null;
  }

  /** Gravações sem os eventos, da mais antiga à mais nova. */
  async recordings(): Promise<RecordingInfo[]> {
    const all = (await run(await this.#db, 'recordings', 'readonly', (s) =>
      s.getAll(),
    )) as RecordingRecord[];
    return all
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(({ events, ...info }) => ({
        ...info,
        notes: events.filter((e) => e.type === 'on').length,
      }));
  }

  async deleteRecording(id: string): Promise<void> {
    await run(await this.#db, 'recordings', 'readwrite', (s) => s.delete(id));
  }

  async saveTrail(state: TrailState): Promise<void> {
    await run(await this.#db, 'kv', 'readwrite', (s) => s.put(state, TRAIL_KEY));
  }

  async trail(): Promise<TrailState | null> {
    const v = await run(await this.#db, 'kv', 'readonly', (s) => s.get(TRAIL_KEY));
    return (v as TrailState | undefined) ?? null;
  }

  saveExercise(r: ExerciseRecord): Promise<void> {
    return this.#put('exercises', r);
  }

  exercises(): Promise<ExerciseRecord[]> {
    return this.#all('exercises');
  }

  /** Grava a entrada do dia; texto vazio apaga. */
  async saveDiary(entry: DiaryEntry): Promise<void> {
    if (entry.text.trim()) return this.#put('diary', entry);
    await run(await this.#db, 'diary', 'readwrite', (s) => s.delete(entry.id));
  }

  async diaryEntry(day: string): Promise<DiaryEntry | null> {
    const v = await run(await this.#db, 'diary', 'readonly', (s) => s.get(day));
    return (v as DiaryEntry | undefined) ?? null;
  }

  /** Do dia mais antigo ao mais novo. */
  async diary(): Promise<DiaryEntry[]> {
    const all = (await run(await this.#db, 'diary', 'readonly', (s) => s.getAll())) as DiaryEntry[];
    return all.sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  /** Tudo o que vai para a exportação em JSON (arquivos e gravações sem o conteúdo). */
  async exportData(): Promise<HistoryData> {
    const [
      scoreSessions,
      drillRounds,
      drillStats,
      files,
      pedalSessions,
      recordings,
      trail,
      diary,
      exercises,
    ] = await Promise.all([
      this.scoreSessions(),
      this.drillRounds(),
      this.drillStats(),
      this.files(),
      this.pedalSessions(),
      this.recordings(),
      this.trail(),
      this.diary(),
      this.exercises(),
    ]);
    return {
      scoreSessions,
      drillRounds,
      drillStats: drillStats ?? {},
      files,
      pedalSessions,
      recordings,
      trail,
      diary,
      exercises,
    };
  }
}

export interface HistoryData {
  scoreSessions: ScoreSessionRecord[];
  drillRounds: DrillRoundRecord[];
  drillStats: DrillStats;
  files: StoredFileInfo[];
  pedalSessions: PedalSessionRecord[];
  recordings: RecordingInfo[];
  trail: TrailState | null;
  diary: DiaryEntry[];
  exercises: ExerciseRecord[];
}

/** Id único para um registro (crypto.randomUUID exige HTTPS; `dev:lan` é HTTP). */
export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let shared: History | null = null;

/** O histórico do app (abre o banco na primeira chamada). */
export function appHistory(): History {
  if (!shared) {
    const db = openDb(indexedDB);
    db.catch((err: unknown) => console.warn('IndexedDB indisponível:', err));
    shared = new History(db);
    // pede ao navegador para não apagar os dados quando faltar espaço
    void navigator.storage?.persist?.().catch(() => {});
  }
  return shared;
}
