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

  /** O que o leitor recebe: título e conteúdo (texto MusicXML ou arquivo .mxl/.musicxml). */
  export interface ScoreSource {
    title: string;
    load: () => Promise<string | Blob>;
  }
</script>

<script lang="ts">
  let { onopen }: { onopen: (source: ScoreSource) => void } = $props();

  const base = import.meta.env.BASE_URL;
  const entries: Promise<ScoreEntry[]> = fetch(`${base}scores/index.json`).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<ScoreEntry[]>;
  });

  function openEntry(e: ScoreEntry) {
    onopen({
      title: e.title,
      load: async () => {
        const r = await fetch(`${base}scores/${e.file}`);
        if (!r.ok) throw new Error(`Não consegui baixar ${e.file} (HTTP ${r.status})`);
        return r.text();
      },
    });
  }

  function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    onopen({ title: file.name.replace(/\.(musicxml|xml|mxl)$/i, ''), load: async () => file });
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
    Arquivos abertos do tablet (.musicxml ou .mxl, ex.: exportados do MuseScore) não são enviados
    para lugar nenhum; ainda não ficam salvos no app (isso chega no M4).
  </p>

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
  .small {
    font-size: 0.85rem;
  }
  .error {
    color: var(--bad);
  }
</style>
