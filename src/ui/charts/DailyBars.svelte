<script lang="ts">
  // Minutos de prática por dia, em colunas empilhadas (partituras + treinos).
  import type { DayTotal } from '../../storage/progress';

  let { days }: { days: DayTotal[] } = $props();

  const H = 160;
  const PAD = { top: 12, right: 8, bottom: 22, left: 34 };
  const GAP = 2;

  let width = $state(320);
  let hover = $state<number | null>(null);

  const minutes = (ms: number) => ms / 60_000;
  const rows = $derived(
    days.map((d) => ({
      day: d.day,
      score: minutes(d.scoreMs),
      drill: minutes(d.drillMs),
      total: minutes(d.scoreMs + d.drillMs),
    })),
  );
  // topo do eixo: múltiplo "redondo" acima do maior dia (mínimo 10 min)
  const yMax = $derived.by(() => {
    const max = Math.max(10, ...rows.map((r) => r.total));
    const step = max <= 30 ? 10 : max <= 60 ? 15 : 30;
    return Math.ceil(max / step) * step;
  });
  const plotW = $derived(Math.max(10, width - PAD.left - PAD.right));
  const plotH = H - PAD.top - PAD.bottom;
  const band = $derived(plotW / Math.max(1, rows.length));
  const barW = $derived(Math.min(24, band * 0.6));
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;
  const xCenter = (i: number) => PAD.left + band * (i + 0.5);

  /** Retângulo com os cantos de cima arredondados (raio 4), base reta. */
  function topRounded(x: number, top: number, w: number, h: number): string {
    const r = Math.min(4, w / 2, h);
    return `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${top + h}Z`;
  }

  const fmtMin = (v: number) => (v < 1 && v > 0 ? '<1' : String(Math.round(v)));
  const dayLabel = (day: string) => String(Number(day.slice(8)));
  const longDay = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  function onPointer(e: PointerEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - PAD.left) / band);
    hover = i >= 0 && i < rows.length ? i : null;
  }
</script>

<div class="chart" bind:clientWidth={width}>
  <div class="legend">
    <span><i style:background="var(--series-1)"></i>Partituras</span>
    <span><i style:background="var(--series-2)"></i>Treinos</span>
  </div>
  <svg
    {width}
    height={H}
    role="img"
    aria-label="Minutos de prática por dia"
    onpointermove={onPointer}
    onpointerdown={onPointer}
    onpointerleave={() => (hover = null)}
  >
    {#each [0, yMax / 2, yMax] as v (v)}
      <line class="grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
      <text class="axis" x={PAD.left - 6} y={y(v) + 4} text-anchor="end">{v}</text>
    {/each}
    {#each rows as r, i (r.day)}
      {@const x = xCenter(i) - barW / 2}
      {#if hover === i}
        <rect class="hover" x={xCenter(i) - band / 2} y={PAD.top} width={band} height={plotH} />
      {/if}
      {#if r.score > 0}
        {@const h = y(0) - y(r.score)}
        {#if r.drill > 0}
          <rect {x} y={y(r.score)} width={barW} height={h} fill="var(--series-1)" />
        {:else}
          <path d={topRounded(x, y(r.score), barW, h)} fill="var(--series-1)" />
        {/if}
      {/if}
      {#if r.drill > 0}
        {@const base = r.score > 0 ? y(r.score) - GAP : y(0)}
        {@const top = Math.min(base - 1, y(r.total) - (r.score > 0 ? GAP : 0))}
        <path d={topRounded(x, top, barW, base - top)} fill="var(--series-2)" />
      {/if}
      <text class="axis" x={xCenter(i)} y={H - 6} text-anchor="middle">{dayLabel(r.day)}</text>
    {/each}
  </svg>
  {#if hover !== null && rows[hover]}
    {@const r = rows[hover]!}
    <div
      class="tip"
      style:left="{Math.min(Math.max(xCenter(hover), 70), width - 70)}px"
      style:top="{PAD.top + 22}px"
    >
      <strong>{longDay(r.day)}</strong>
      <span><i style:background="var(--series-1)"></i>Partituras {fmtMin(r.score)} min</span>
      <span><i style:background="var(--series-2)"></i>Treino {fmtMin(r.drill)} min</span>
    </div>
  {/if}
</div>

<style>
  .chart {
    position: relative;
    width: 100%;
  }
  svg {
    display: block;
    touch-action: pan-y;
  }
  .legend {
    display: flex;
    gap: 1rem;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 0.25rem;
  }
  i {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    margin-right: 0.35rem;
    vertical-align: -0.05rem;
  }
  .grid {
    stroke: var(--grid);
    stroke-width: 1;
  }
  .axis {
    fill: var(--muted);
    font-size: 11px;
  }
  .hover {
    fill: var(--text);
    opacity: 0.05;
  }
  .tip {
    position: absolute;
    transform: translateX(-50%);
    display: grid;
    gap: 0.1rem;
    padding: 0.4rem 0.6rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
    font-size: 0.85rem;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
