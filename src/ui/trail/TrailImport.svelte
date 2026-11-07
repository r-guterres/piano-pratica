<script lang="ts">
  // Configurações → migração dos dados do artefato "Trilha do Teclado":
  // lê o arquivo gerado a partir do db do artefato e substitui a Trilha do app.
  import { appHistory } from '../../storage/history';
  import { parseMigration } from '../../trail/migrate';
  import { replaceTrail, trail } from '../trail.svelte';

  let status = $state('');
  let error = $state('');

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    status = '';
    error = '';
    try {
      const { trail: next, diary } = parseMigration(await file.text(), trail.day);
      const days = Object.keys(next.days).length;
      if (
        !confirm(
          `Importar a Trilha do artefato (${days} dias de prática, ${diary.length} ` +
            `${diary.length === 1 ? 'entrada' : 'entradas'} de diário)? ` +
            'Isso substitui o estado atual da Trilha neste aparelho.',
        )
      )
        return;
      for (const e of diary) await appHistory().saveDiary(e);
      replaceTrail(next);
      status = `Pronto: Trilha importada (${days} dias, ${diary.length} de diário). Abra a aba Hoje.`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<section class="card">
  <h2>Trilha do Teclado (migração)</h2>
  <p class="muted">
    Traz para cá os dados do artefato "Trilha do Teclado": fase, tópicos, marcos, repertório,
    registros de estudo, pontos, dias de prática e o diário. Use o arquivo
    <code>trilha-migracao.json</code> preparado pelo Claude. O estado atual da Trilha neste aparelho é
    substituído.
  </p>
  <label class="import">
    Importar arquivo…
    <input type="file" accept=".json,application/json" onchange={importFile} />
  </label>
  {#if status}<p class="ok">{status}</p>{/if}
  {#if error}<p class="error">{error}</p>{/if}
</section>

<style>
  section {
    display: grid;
    gap: 0.6rem;
  }
  h2,
  p {
    margin: 0;
  }
  .import {
    display: inline-flex;
    align-items: center;
    justify-self: start;
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
  .ok {
    color: var(--ok);
  }
  .error {
    color: var(--bad);
  }
</style>
