<script lang="ts">
  // Cifra de uma música: cada caixa é um compasso. Mostra os acordes ou os
  // graus romanos, e transpõe para outro tom.
  import type { ChordChart } from '../../trail/content';
  import { degreeOf, keyName, mapChords, parseKey, transposeChord } from '../../trail/harmony';

  let { chart }: { chart: ChordChart } = $props();

  const key = $derived(parseKey(chart.key));
  let degrees = $state(false);
  let shift = $state(0);
  const target = $derived(key ? { ...key, tonic: (((key.tonic + shift) % 12) + 12) % 12 } : null);

  const show = (cell: string) => {
    if (!key || !target) return cell;
    if (degrees) return mapChords(cell, (s) => degreeOf(s, key));
    return shift ? mapChords(cell, (s) => transposeChord(s, shift, target)) : cell;
  };
</script>

<div class="chart">
  <div class="row">
    <span class="pill accent">{shift && target ? keyName(target) : chart.key}</span>
    <span class="pill">{chart.meter}</span>
    {#if key}
      <span class="tools">
        <button class="small" class:primary={!degrees} onclick={() => (degrees = false)}
          >Acordes</button
        >
        <button class="small" class:primary={degrees} onclick={() => (degrees = true)}>Graus</button
        >
        <span class="transpose" aria-label="Transpor">
          Tom
          <button
            class="small"
            onclick={() => (shift -= 1)}
            disabled={degrees}
            aria-label="Meio tom abaixo">−</button
          >
          <b>{shift > 0 ? `+${shift}` : shift}</b>
          <button
            class="small"
            onclick={() => (shift += 1)}
            disabled={degrees}
            aria-label="Meio tom acima">+</button
          >
          {#if shift}<button class="small ghost" onclick={() => (shift = 0)}>original</button>{/if}
        </span>
      </span>
    {/if}
  </div>
  <p class="muted small">{chart.note}</p>
  {#if degrees}
    <p class="muted small">
      Graus em relação à escala maior da tônica: minúsculo = menor, ♭VII = acorde emprestado; o
      número depois da barra é o grau da nota do baixo (I/5 = acorde de I com a 5ª no baixo).
    </p>
  {/if}
  {#each chart.sections as s (s.name)}
    <div class="section">
      <span class="label">{s.name}</span>
      {#each s.lines as line, i (i)}
        <div class="bars" style:--n={Math.max(line.length, 3)}>
          {#each line as bar, j (j)}<span class="bar">{show(bar)}</span>{/each}
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
  .row,
  .tools,
  .transpose {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .tools {
    margin-left: auto;
  }
  .transpose b {
    min-width: 1.6rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
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
    white-space: pre-wrap;
  }
</style>
