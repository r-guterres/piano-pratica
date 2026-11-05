// Histórico de prática no IndexedDB: sessões do modo espera, rodadas do treino
// de leitura, estatísticas do Prioritizer e partituras importadas.
//
// Os registros são objetos simples (structured clone): não passar proxies do
// Svelte ($state) direto; usar $state.snapshot antes.

import type { ItemStats } from '../drills/priority';
import type { PoolConfig } from '../drills/notes';
import type { DrillSummary } from '../drills/readingDrill';
import type { LoopRange, WaitModeSummary } from '../practice/waitMode';
import type { HandSelection } from '../score/types';
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
  summary: WaitModeSummary;
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

export type DrillStats = Record<string, ItemStats>;

const PRIORITIZER_KEY = 'prioritizer';

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

  /** Tudo o que vai para a exportação em JSON (arquivos sem o conteúdo). */
  async exportData(): Promise<HistoryData> {
    const [scoreSessions, drillRounds, drillStats, files] = await Promise.all([
      this.scoreSessions(),
      this.drillRounds(),
      this.drillStats(),
      this.files(),
    ]);
    return { scoreSessions, drillRounds, drillStats: drillStats ?? {}, files };
  }
}

export interface HistoryData {
  scoreSessions: ScoreSessionRecord[];
  drillRounds: DrillRoundRecord[];
  drillStats: DrillStats;
  files: StoredFileInfo[];
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
