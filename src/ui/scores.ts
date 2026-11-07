// Partituras do app: a biblioteca (public/scores) e os arquivos importados,
// e como abrir qualquer uma pelo id (a Trilha liga músicas a partituras).

import { appHistory, type StoredFileInfo } from '../storage/history';
import type { ScoreEntry, ScoreSource } from './Library.svelte';

const base = import.meta.env.BASE_URL;
let entries: Promise<ScoreEntry[]> | null = null;

export function libraryEntries(): Promise<ScoreEntry[]> {
  entries ??= fetch(`${base}scores/index.json`).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<ScoreEntry[]>;
  });
  entries.catch(() => (entries = null));
  return entries;
}

export const entrySource = (e: ScoreEntry): ScoreSource => ({
  id: e.id,
  title: e.title,
  load: async () => {
    const r = await fetch(`${base}scores/${e.file}`);
    if (!r.ok) throw new Error(`Não consegui baixar ${e.file} (HTTP ${r.status})`);
    return r.text();
  },
});

export const fileSource = (f: StoredFileInfo): ScoreSource => ({
  id: f.id,
  title: f.title,
  load: async () => {
    const stored = await appHistory().file(f.id);
    if (!stored) throw new Error(`O arquivo ${f.name} não está mais salvo`);
    return new File([stored.data], stored.name);
  },
});

/** Todas as partituras disponíveis (importadas primeiro). */
export async function scoreChoices(): Promise<{ id: string; title: string }[]> {
  const [files, list] = await Promise.all([
    appHistory()
      .files()
      .catch(() => []),
    libraryEntries().catch(() => []),
  ]);
  return [...files.toReversed(), ...list].map(({ id, title }) => ({ id, title }));
}

/** A partitura com este id, ou null se não existe (arquivo removido, por exemplo). */
export async function scoreSource(id: string): Promise<ScoreSource | null> {
  if (id.startsWith('file:')) {
    const f = (await appHistory().files()).find((x) => x.id === id);
    return f ? fileSource(f) : null;
  }
  const e = (await libraryEntries()).find((x) => x.id === id);
  return e ? entrySource(e) : null;
}
