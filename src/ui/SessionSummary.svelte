<script lang="ts">
  import { pitchName } from '../core/pitch';
  import type { WaitModeSummary } from '../practice/waitMode';
  import { settings } from './settings.svelte';

  let {
    summary,
    finished,
    looping,
    onrestart,
    onclose,
  }: {
    summary: WaitModeSummary;
    /** true = a peça terminou; false = o usuário interrompeu */
    finished: boolean;
    looping: boolean;
    onrestart: () => void;
    onclose: () => void;
  } = $props();

  const name = (p: number) => pitchName(p, settings.naming);

  function duration(ms: number): string {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  const byMeasure = $derived(
    Object.entries(summary.errorsByMeasure)
      .map(([m, count]) => ({ measure: Number(m) + 1, count }))
      .sort((a, b) => b.count - a.count || a.measure - b.measure),
  );
  const maxCount = $derived(Math.max(1, ...byMeasure.map((m) => m.count)));
  const cleanPct = $derived(
    summary.completed ? Math.round((summary.clean / summary.completed) * 100) : 0,
  );
  const recent = $derived(summary.mistakes.slice(-8).toReversed());
</script>

<div class="backdrop">
  <div class="panel card" role="dialog" aria-label="Resumo da sessão">
    <h2>{finished ? 'Fim! Resumo da sessão' : 'Resumo da sessão'}</h2>

    <div class="stats">
      <div><span class="big">{summary.completed}</span>passos tocados</div>
      <div><span class="big">{cleanPct}%</span>de primeira</div>
      <div>
        <span class="big" class:bad={summary.wrongNotes > 0}>{summary.wrongNotes}</span>notas
        erradas
      </div>
      <div><span class="big">{duration(summary.durationMs)}</span>tempo total</div>
      {#if summary.meanStepMs !== null}
        <div><span class="big">{(summary.meanStepMs / 1000).toFixed(1)} s</span>por passo</div>
      {/if}
      {#if looping}
        <div><span class="big">{summary.laps}</span>voltas no loop</div>
      {/if}
    </div>

    {#if byMeasure.length}
      <h3>Erros por compasso</h3>
      <ul class="bars">
        {#each byMeasure as m (m.measure)}
          <li>
            <span class="label">c.{m.measure}</span>
            <span class="bar" style:width="{(m.count / maxCount) * 100}%"></span>
            <span class="count">{m.count}</span>
          </li>
        {/each}
      </ul>

      <h3>Últimos erros</h3>
      <ul class="mistakes">
        {#each recent as m, i (i)}
          <li>
            c.{m.measure + 1}: esperado <strong>{m.expected.map(name).join(' · ')}</strong>, tocou
            <strong class="bad">{name(m.played)}</strong>
          </li>
        {/each}
      </ul>
    {:else if summary.completed > 0}
      <p>Nenhum erro. 🎉</p>
    {/if}

    <p class="muted small">O histórico das sessões passa a ser salvo no M4.</p>

    <div class="actions">
      <button class="primary" onclick={onrestart}>Praticar de novo</button>
      <button onclick={onclose}>{finished ? 'Fechar' : 'Continuar'}</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.45);
  }
  .panel {
    width: min(36rem, 100%);
    max-height: 90dvh;
    overflow: auto;
  }
  h3 {
    font-size: 0.95rem;
    margin: 1rem 0 0.4rem;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.75rem;
  }
  .stats > div {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .big {
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .bad {
    color: var(--bad);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .bars li {
    display: grid;
    grid-template-columns: 3rem 1fr 2rem;
    align-items: center;
    gap: 0.5rem;
    margin: 0.2rem 0;
    font-variant-numeric: tabular-nums;
  }
  .bars .bar {
    height: 0.7rem;
    border-radius: 999px;
    background: var(--bad);
    opacity: 0.8;
  }
  .bars .count {
    text-align: right;
  }
  .mistakes li {
    margin: 0.2rem 0;
    font-size: 0.9rem;
  }
  .small {
    font-size: 0.8rem;
  }
  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }
</style>
