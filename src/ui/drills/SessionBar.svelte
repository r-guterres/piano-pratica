<script lang="ts">
  // Barra do treino em andamento: ■ Encerrar, o cronômetro (com a meta do
  // bloco, se houver) e os números da sessão.
  import type { Snippet } from 'svelte';
  import { clock, type DrillSession } from './session.svelte';

  let {
    session,
    onfinish,
    children,
  }: { session: DrillSession; onfinish: () => void; children?: Snippet } = $props();
</script>

<div class="bar">
  <button onclick={onfinish}>■ Encerrar</button>
  <span class="clock" class:met={session.reached}>
    ⏱ {clock(session.elapsedMs)}{session.goalMs ? ` / ${clock(session.goalMs)}` : ''}
  </span>
  {@render children?.()}
</div>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--border);
  }
  .clock {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .clock.met {
    color: var(--ok);
  }
</style>
