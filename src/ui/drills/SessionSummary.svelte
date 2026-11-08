<script lang="ts">
  // Resumo de uma sessão de treino: os números, os detalhes (o que deu
  // trabalho) e, se o treino veio de um bloco do Hoje, marcar o bloco.
  import type { Snippet } from 'svelte';
  import { toggleBlock } from '../../trail/state';
  import { showToast } from '../toast.svelte';
  import { saveTrail, trail } from '../trail.svelte';
  import { clock, type DrillSession } from './session.svelte';

  let {
    session,
    tiles,
    onagain,
    children,
  }: {
    session: DrillSession;
    tiles: { value: string | number; label: string }[];
    onagain: () => void;
    children?: Snippet;
  } = $props();

  const block = $derived(session.goal?.block ?? null);
  const plan = $derived(trail.s?.plan?.day === trail.day ? trail.s.plan : null);
  const blockTitle = $derived(plan?.blocks.find((b) => b.id === block)?.title ?? null);
  const blockOpen = $derived(!!block && !!blockTitle && !plan!.done[block]);

  function markBlock() {
    const msg = toggleBlock(trail.s!, block!);
    saveTrail();
    showToast(msg ?? 'Bloco marcado como feito.');
  }
</script>

<div class="summary">
  <h3>Resumo da sessão</h3>
  <div class="tiles">
    {#each tiles as t (t.label)}
      <div class="tile"><span class="big">{t.value}</span>{t.label}</div>
    {/each}
    <div class="tile"><span class="big">{clock(session.elapsedMs)}</span>duração</div>
  </div>
  {@render children?.()}
  <div class="row">
    <button class="primary" onclick={onagain}>▶ De novo</button>
    <button onclick={() => session.setup()}>Mudar o exercício</button>
    {#if blockOpen}
      <button class="good" onclick={markBlock}>Marcar “{blockTitle}” como feito</button>
    {/if}
  </div>
</div>

<style>
  .summary {
    display: grid;
    gap: 0.7rem;
  }
  h3 {
    margin: 0;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
    gap: 0.5rem;
  }
  .tile {
    background: var(--surface-2);
    border-radius: 8px;
    padding: 0.6rem;
    display: grid;
    font-size: 0.9rem;
    color: var(--muted);
  }
  .big {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
