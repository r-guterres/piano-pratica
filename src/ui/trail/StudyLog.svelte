<script lang="ts">
  // Registro de estudo de uma música em estudo: andamento, vezes seguidas sem
  // erro, trecho que travou e próximo passo. Regra: subir 5 bpm só depois de 3
  // vezes seguidas sem erro.
  import { DEFAULT_SCORE } from '../../trail/content';
  import { shortDay } from '../../trail/dates';
  import { addStudyLog, lastLog } from '../../trail/state';
  import { settings } from '../settings.svelte';
  import { showToast } from '../toast.svelte';
  import { saveTrail, trail } from '../trail.svelte';

  let { id, history = false }: { id: string; history?: boolean } = $props();

  const song = $derived(trail.s!.songs[id]!);
  const last = $derived(lastLog(trail.s!, id));
  let open = $state(false);
  let bpm = $state(60);
  let clean = $state(0);
  let stuck = $state('');
  let next = $state('');

  function startForm() {
    const scoreId = song.scoreId ?? DEFAULT_SCORE[id];
    const fromReader = scoreId ? settings.playback.bpm[scoreId] : undefined;
    bpm = last?.bpm ? (last.clean >= 3 ? last.bpm + 5 : last.bpm) : (fromReader ?? 60);
    clean = 0;
    stuck = '';
    next = '';
    open = true;
  }

  function save() {
    const b = Number(bpm) > 0 ? Math.round(Number(bpm)) : null;
    addStudyLog(trail.s!, id, {
      day: trail.day,
      bpm: b,
      clean,
      stuck: stuck.trim().slice(0, 200),
      next: next.trim().slice(0, 200),
    });
    saveTrail();
    open = false;
    showToast(
      clean >= 3 && b ? `Registrado. Na próxima, suba para ${b + 5} bpm.` : 'Registro salvo.',
    );
  }

  const logs = $derived((song.logs ?? []).slice(-10).toReversed());
</script>

<div class="log">
  {#if last}
    <div class="last">
      <span class="label">Último registro · {shortDay(last.day)}</span>
      <span class="mono"
        >{last.bpm ? `${last.bpm} bpm · ` : ''}{last.clean} de 3 vezes seguidas sem erro</span
      >
      {#if last.stuck}<span><b>Travou:</b> {last.stuck}</span>{/if}
      {#if last.next}<span><b>Próximo passo:</b> {last.next}</span>{/if}
      {#if last.clean >= 3 && last.bpm}
        <span><span class="pill good">Hora de subir para {last.bpm + 5} bpm</span></span>
      {/if}
    </div>
  {:else}
    <p class="muted small">
      Nenhum registro de estudo ainda. Ao terminar de estudar esta música, registre andamento,
      trecho que travou e próximo passo.
    </p>
  {/if}

  {#if open}
    <div class="form">
      <span class="label">Registrar o estudo de hoje</span>
      <label class="inline">
        Andamento <input type="number" min="30" max="220" bind:value={bpm} class="bpm" /> bpm
      </label>
      <div class="inline" role="radiogroup" aria-label="Vezes seguidas sem erro">
        Vezes seguidas sem erro:
        {#each [0, 1, 2, 3] as n (n)}
          <label class="radio"><input type="radio" bind:group={clean} value={n} /> {n}</label>
        {/each}
      </div>
      <label class="field">
        Trecho que travou
        <input type="text" bind:value={stuck} placeholder="Ex.: troca de G para Am no refrão" />
      </label>
      <label class="field">
        Próximo passo
        <input
          type="text"
          bind:value={next}
          placeholder="Ex.: repetir só essa troca 10 vezes a 50 bpm"
        />
      </label>
      <div class="inline">
        <button class="primary small" onclick={save}>Salvar registro</button>
        <button class="ghost small" onclick={() => (open = false)}>Cancelar</button>
      </div>
      <p class="muted small">
        Suba 5 bpm só depois de 3 vezes seguidas sem erro. O andamento vem do último registro (ou do
        leitor de partitura). Os textos são opcionais.
      </p>
    </div>
  {:else}
    <div><button class="small" onclick={startForm}>Registrar estudo</button></div>
  {/if}

  {#if history && (song.logs?.length ?? 0) >= 2}
    <details>
      <summary>Histórico de estudo ({song.logs!.length})</summary>
      <table>
        <tbody>
          {#each logs as x, i (i)}
            <tr>
              <td class="mono">{shortDay(x.day)}</td>
              <td class="mono nowrap">{x.bpm ? `${x.bpm} bpm` : '—'} · {x.clean}/3</td>
              <td>{x.stuck}{x.stuck && x.next ? ' → ' : ''}{x.next}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
  {/if}
</div>

<style>
  .log {
    display: grid;
    gap: 0.5rem;
  }
  .last,
  .form {
    display: grid;
    gap: 0.35rem;
    background: var(--surface-2);
    border-radius: 10px;
    padding: 0.6rem 0.8rem;
  }
  .label {
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--muted);
  }
  .mono {
    font-variant-numeric: tabular-nums;
  }
  .small {
    font-size: 0.85rem;
    margin: 0;
  }
  .inline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .radio {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
  }
  .bpm {
    width: 5.5rem;
  }
  .field {
    display: grid;
    gap: 0.2rem;
  }
  table {
    border-collapse: collapse;
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }
  td {
    padding: 0.2rem 0.7rem 0.2rem 0;
    vertical-align: top;
  }
  .nowrap {
    white-space: nowrap;
  }
</style>
