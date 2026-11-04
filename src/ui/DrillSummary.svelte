<script lang="ts">
  import { writtenName, type DrillItem } from '../drills/notes';
  import type { Prioritizer } from '../drills/priority';
  import type { DrillSummary } from '../drills/readingDrill';
  import { settings } from './settings.svelte';

  let {
    summary,
    pool,
    prioritizer,
    durationMs,
    onagain,
    onsetup,
  }: {
    summary: DrillSummary;
    pool: readonly DrillItem[];
    prioritizer: Prioritizer;
    durationMs: number;
    onagain: () => void;
    onsetup: () => void;
  } = $props();

  const name = (item: DrillItem) => writtenName(item.note, settings.naming);
  const seconds = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');

  function duration(ms: number): string {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  const firstPct = $derived(
    summary.answered ? Math.round((summary.firstTry / summary.answered) * 100) : 0,
  );

  /** Cor do "mapa de calor": verde = sempre de primeira, vermelho = nunca. */
  function heat(firstTry: number, shown: number): string {
    const rate = shown ? firstTry / shown : 1;
    return `hsl(${Math.round(rate * 120)} 55% 42%)`;
  }

  // Chance de cada nota aparecer no próximo sorteio (sem contar a exclusão das
  // últimas mostradas): as que o app vai priorizar agora.
  const nextUp = $derived.by(() => {
    const median = prioritizer.medianMs();
    const weights = pool.map((item) => ({ item, w: prioritizer.weight(item.id, median) }));
    const total = weights.reduce((a, b) => a + b.w, 0);
    return weights
      .map(({ item, w }) => ({ item, pct: (w / total) * 100 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  });
  const uniformPct = $derived(100 / Math.max(1, pool.length));
</script>

<section class="card summary">
  <h2>Resumo da rodada</h2>

  <div class="stats">
    <div><span class="big">{summary.answered}</span>notas</div>
    <div><span class="big">{firstPct}%</span>de primeira</div>
    <div>
      <span class="big" class:bad={summary.wrongNotes > 0}>{summary.wrongNotes}</span>notas erradas
    </div>
    {#if summary.meanReactionMs !== null}
      <div><span class="big">{seconds(summary.meanReactionMs)} s</span>tempo médio</div>
    {/if}
    <div><span class="big">{duration(durationMs)}</span>duração</div>
    {#if summary.revealed}
      <div><span class="big">{summary.revealed}</span>respostas mostradas</div>
    {/if}
  </div>

  {#if summary.items.length}
    <h3>Nota por nota</h3>
    <p class="muted small">
      Acertos de primeira / vezes que apareceu, e o tempo médio dos acertos de primeira.
    </p>
    <ul class="heat">
      {#each summary.items as s (s.item.id)}
        <li style:background={heat(s.firstTry, s.shown)}>
          <strong>{name(s.item)}</strong>
          {#if settings.drill.clefs === 'grand'}
            <span class="clef">{s.item.clef === 'treble' ? 'sol' : 'fá'}</span>
          {/if}
          <span>{s.firstTry}/{s.shown}</span>
          {#if s.meanMs !== null}<span>{seconds(s.meanMs)} s</span>{/if}
        </li>
      {/each}
    </ul>

    <h3>Vão aparecer mais</h3>
    <ul class="next">
      {#each nextUp as n (n.item.id)}
        <li>
          <strong>{name(n.item)}</strong>
          <span class="bar" style:width="{Math.min(100, n.pct * 2)}%"></span>
          <span>{Math.round(n.pct)}%</span>
        </li>
      {/each}
    </ul>
    <p class="muted small">
      Chance de cada nota no próximo sorteio (se fosse uniforme: {Math.round(uniformPct)}%).
    </p>
  {/if}

  <p class="muted small">
    O app lembra das notas difíceis enquanto estiver aberto; o histórico passa a ser salvo no M4.
  </p>

  <div class="actions">
    <button onclick={onsetup}>Configurar</button>
    <button class="primary" onclick={onagain}>Nova rodada</button>
  </div>
</section>

<style>
  .summary {
    max-width: 40rem;
  }
  h2 {
    margin-top: 0;
  }
  h3 {
    font-size: 0.95rem;
    margin: 1.2rem 0 0.4rem;
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
  .small {
    font-size: 0.8rem;
    margin: 0.3rem 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .heat {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .heat li {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 4.2rem;
    padding: 0.35rem 0.5rem;
    border-radius: 0.5rem;
    color: #fff;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
  .heat strong {
    font-size: 1rem;
  }
  .clef {
    opacity: 0.85;
  }
  .next li {
    display: grid;
    grid-template-columns: 4.5rem 1fr 3rem;
    align-items: center;
    gap: 0.5rem;
    margin: 0.2rem 0;
    font-variant-numeric: tabular-nums;
  }
  .next .bar {
    height: 0.7rem;
    border-radius: 999px;
    background: var(--accent);
  }
  .next li > span:last-child {
    text-align: right;
  }
  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }
</style>
