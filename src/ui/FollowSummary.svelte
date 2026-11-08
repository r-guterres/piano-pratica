<script lang="ts" module>
  import type { RhythmSummary } from '../practice/rhythm';

  export interface FollowResult {
    rhythm: RhythmSummary;
    bpm: number;
    durationMs: number;
    /** Trecho em loop (as voltas importam). */
    looping: boolean;
    /** true = tocou até o fim; false = parado no meio. */
    finished: boolean;
  }
</script>

<script lang="ts">
  // Resumo de uma execução no modo acompanhar: ritmo (no tempo, adiantadas,
  // atrasadas, perdidas, erradas), tendência e os compassos com problemas.
  let {
    result,
    onrestart,
    onclose,
  }: { result: FollowResult; onrestart: () => void; onclose: () => void } = $props();

  const r = $derived(result.rhythm);
  const pct = $derived(r.notes ? Math.round((r.ontime / r.notes) * 100) : 0);

  function duration(ms: number): string {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  const byMeasure = $derived(
    Object.entries(r.problemsByMeasure)
      .map(([m, count]) => ({ measure: Number(m) + 1, count }))
      .sort((a, b) => b.count - a.count || a.measure - b.measure)
      .slice(0, 8),
  );
  const maxCount = $derived(Math.max(1, ...byMeasure.map((m) => m.count)));
  const tendency = $derived(
    r.meanOffsetMs === null || r.ontime + r.early + r.late < 4
      ? null
      : Math.abs(r.meanOffsetMs) < 25
        ? 'Sem tendência de adiantar ou atrasar.'
        : r.meanOffsetMs < 0
          ? `Tendência: adiantar (${Math.round(-r.meanOffsetMs)} ms em média).`
          : `Tendência: atrasar (${Math.round(r.meanOffsetMs)} ms em média).`,
  );
</script>

<div class="backdrop">
  <div class="panel card" role="dialog" aria-label="Resumo do acompanhar">
    <h2>{result.finished ? 'Fim! Resumo' : 'Resumo'} · {result.bpm} bpm</h2>

    <div class="stats">
      <div><span class="big">{pct}%</span>das notas no tempo</div>
      <div><span class="big">{r.ontime}</span>no tempo</div>
      <div><span class="big">{r.early}</span>adiantadas</div>
      <div><span class="big">{r.late}</span>atrasadas</div>
      <div><span class="big" class:bad={r.missed > 0}>{r.missed}</span>perdidas</div>
      <div><span class="big" class:bad={r.wrong > 0}>{r.wrong}</span>erradas</div>
      <div><span class="big">{duration(result.durationMs)}</span>tempo total</div>
      {#if result.looping}
        <div><span class="big">{r.laps}</span>voltas no loop</div>
      {/if}
    </div>

    {#if tendency}<p class="muted">{tendency}</p>{/if}

    {#if byMeasure.length}
      <h3>Problemas por compasso</h3>
      <ul class="bars">
        {#each byMeasure as m (m.measure)}
          <li>
            <span class="label">c.{m.measure}</span>
            <span class="bar" style:width="{(m.count / maxCount) * 100}%"></span>
            <span class="count">{m.count}</span>
          </li>
        {/each}
      </ul>
      <p class="muted small">Fora do tempo, erradas e perdidas. O botão "Difíceis" vira loop.</p>
    {:else if r.notes > 0}
      <p>Tudo no tempo. 🎉</p>
    {/if}

    <div class="actions">
      <button class="primary" onclick={onrestart}>Tocar de novo</button>
      <button onclick={onclose}>Fechar</button>
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
