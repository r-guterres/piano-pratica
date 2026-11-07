<script lang="ts" module>
  export interface ScoreEntry {
    id: string;
    title: string;
    composer: string;
    level: number;
    tags: string[];
    file: string;
    source: string;
  }

  /** O que o leitor recebe: id (para o histórico), título e conteúdo (texto MusicXML ou arquivo .mxl/.musicxml). */
  export interface ScoreSource {
    id: string;
    title: string;
    load: () => Promise<string | Blob>;
  }
</script>

<script lang="ts">
  import { appHistory, type StoredFileInfo } from '../storage/history';
  import { entrySource, fileSource, libraryEntries } from './scores';

  let { onopen }: { onopen: (source: ScoreSource) => void } = $props();

  const entries = libraryEntries();

  let files = $state<StoredFileInfo[]>([]);
  let filesError = $state('');
  const refreshFiles = () =>
    appHistory()
      .files()
      .then((list) => (files = list.toReversed()))
      .catch(
        (err: unknown) => (filesError = `Não consegui ler os arquivos salvos: ${String(err)}`),
      );
  void refreshFiles();

  const openEntry = (e: ScoreEntry) => onopen(entrySource(e));
  const openStored = (f: StoredFileInfo) => onopen(fileSource(f));

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const id = `file:${file.name}`;
    const title = file.name.replace(/\.(musicxml|xml|mxl)$/i, '');
    // salva no aparelho; se falhar, abre mesmo assim
    try {
      const data = await file.arrayBuffer();
      await appHistory().saveFile({ id, name: file.name, title, addedAt: Date.now(), data });
      void refreshFiles();
    } catch (err) {
      console.warn('Não consegui salvar o arquivo:', err);
    }
    onopen({ id, title, load: async () => file });
  }

  async function removeFile(f: StoredFileInfo) {
    if (!confirm(`Remover "${f.title}" do app? O histórico de prática dele continua salvo.`))
      return;
    await appHistory().deleteFile(f.id);
    await refreshFiles();
  }

  const levelLabel = (n: number) => '●'.repeat(n) + '○'.repeat(Math.max(0, 3 - n));
</script>

<section class="card">
  <div class="head">
    <h2>Partituras</h2>
    <label class="import">
      Abrir arquivo…
      <input type="file" accept=".musicxml,.xml,.mxl" onchange={importFile} />
    </label>
  </div>
  <p class="muted small">
    Arquivos abertos do tablet (.musicxml ou .mxl, ex.: exportados do MuseScore) ficam salvos só
    neste aparelho e não são enviados para lugar nenhum.
  </p>

  {#if files.length}
    <h3>Meus arquivos</h3>
    <ul class="list">
      {#each files as f (f.id)}
        <li class="row">
          <button class="entry" onclick={() => openStored(f)}>
            <span class="title">{f.title}</span>
            <span class="meta"
              >{f.name} · importado em {new Date(f.addedAt).toLocaleDateString('pt-BR')}</span
            >
          </button>
          <button class="remove" onclick={() => removeFile(f)} aria-label="Remover {f.title}"
            >×</button
          >
        </li>
      {/each}
    </ul>
    <h3>Biblioteca</h3>
  {/if}
  {#if filesError}<p class="error small">{filesError}</p>{/if}

  {#await entries}
    <p class="muted">Carregando…</p>
  {:then list}
    <ul class="list">
      {#each list as e (e.id)}
        <li>
          <button class="entry" onclick={() => openEntry(e)}>
            <span class="title">{e.title}</span>
            <span class="meta">
              {e.composer} · <span title="nível {e.level}">{levelLabel(e.level)}</span>
            </span>
            <span class="tags">{e.tags.join(' · ')}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:catch err}
    <p class="error">Não consegui carregar a biblioteca: {String(err)}</p>
  {/await}
</section>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .import {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    padding: 0.4rem 0.9rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    cursor: pointer;
  }
  .import input {
    display: none;
  }
  .list {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .entry {
    width: 100%;
    display: grid;
    gap: 0.15rem;
    text-align: left;
    padding: 0.75rem 1rem;
    background: var(--surface);
  }
  .entry:hover {
    border-color: var(--accent);
  }
  .title {
    font-weight: 600;
    font-size: 1.05rem;
  }
  .meta,
  .tags {
    font-size: 0.85rem;
    color: var(--muted);
  }
  h3 {
    margin: 1rem 0 0;
    font-size: 1rem;
  }
  .row {
    display: flex;
    gap: 0.5rem;
  }
  .remove {
    flex: none;
    width: 2.75rem;
    font-size: 1.3rem;
    color: var(--muted);
  }
  .small {
    font-size: 0.85rem;
  }
  .error {
    color: var(--bad);
  }
</style>
