<script lang="ts">
  // Cifra de uma música: cada caixa é um compasso.
  import type { ChordChart } from '../../trail/content';

  let { chart }: { chart: ChordChart } = $props();
</script>

<div class="chart">
  <div class="row">
    <span class="pill accent">{chart.key}</span>
    <span class="pill">{chart.meter}</span>
  </div>
  <p class="muted small">{chart.note}</p>
  {#each chart.sections as s (s.name)}
    <div class="section">
      <span class="label">{s.name}</span>
      {#each s.lines as line, i (i)}
        <div class="bars" style:--n={Math.max(line.length, 3)}>
          {#each line as bar, j (j)}<span class="bar">{bar}</span>{/each}
        </div>
      {/each}
      {#if s.note}<p class="muted small">{s.note}</p>{/if}
    </div>
  {/each}
  {#if chart.form}<p><b>Forma:</b> {chart.form}</p>{/if}
</div>

<style>
  .chart {
    display: grid;
    gap: 0.6rem;
    background: var(--surface-2);
    border-radius: 10px;
    padding: 0.8rem;
  }
  .chart p {
    margin: 0;
  }
  .row {
    display: flex;
    gap: 0.4rem;
  }
  .small {
    font-size: 0.9rem;
  }
  .section {
    display: grid;
    gap: 0.3rem;
  }
  .label {
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--muted);
  }
  .bars {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    border-left: 2px solid var(--text);
  }
  .bar {
    border-right: 2px solid var(--text);
    padding: 0.5rem;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-weight: 600;
    overflow-wrap: anywhere;
    min-width: 0;
  }
</style>
