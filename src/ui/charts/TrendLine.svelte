<script lang="ts" module>
  export interface TrendPoint {
    /** Rótulo da dica (ex.: data da rodada). */
    label: string;
    value: number;
  }
</script>

<script lang="ts">
  // Uma série ao longo das rodadas (linha + pontos), com dica ao tocar/passar o mouse.

  let {
    points,
    label,
    format,
    yMin = 0,
    yMax,
    color = 'var(--series-2)',
  }: {
    points: TrendPoint[];
    /** Nome da série (leitores de tela). */
    label: string;
    format: (v: number) => string;
    yMin?: number;
    /** Topo fixo do eixo; sem ele, um pouco acima do maior valor. */
    yMax?: number;
    color?: string;
  } = $props();

  const H = 140;
  const PAD = { top: 12, right: 12, bottom: 12, left: 44 };

  let width = $state(320);
  let hover = $state<number | null>(null);

  const top = $derived(yMax ?? Math.max(yMin + 1, ...points.map((p) => p.value)) * 1.1);
  const plotW = $derived(Math.max(10, width - PAD.left - PAD.right));
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (top - yMin)) * plotH;
  const path = $derived(
    points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(''),
  );

  function onPointer(e: PointerEvent) {
    if (!points.length) return;
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const t = (e.clientX - rect.left - PAD.left) / plotW;
    hover = Math.min(points.length - 1, Math.max(0, Math.round(t * (points.length - 1))));
  }
</script>

<div class="chart" bind:clientWidth={width}>
  <svg
    {width}
    height={H}
    role="img"
    aria-label={label}
    onpointermove={onPointer}
    onpointerdown={onPointer}
    onpointerleave={() => (hover = null)}
  >
    {#each [yMin, (yMin + top) / 2, top] as v (v)}
      <line class="grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
      <text class="axis" x={PAD.left - 6} y={y(v) + 4} text-anchor="end">{format(v)}</text>
    {/each}
    {#if hover !== null}
      <line class="cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} />
    {/if}
    <path d={path} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" />
    {#each points as p, i (i)}
      <circle
        cx={x(i)}
        cy={y(p.value)}
        r={hover === i ? 6 : 4}
        fill={color}
        stroke="var(--surface)"
        stroke-width="2"
      />
    {/each}
  </svg>
  {#if hover !== null && points[hover]}
    {@const p = points[hover]!}
    <div
      class="tip"
      style:left="{Math.min(Math.max(x(hover), 60), width - 60)}px"
      style:top="{Math.max(0, y(p.value) - 52)}px"
    >
      <span class="muted">{p.label}</span>
      <strong>{format(p.value)}</strong>
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
  .grid {
    stroke: var(--grid);
    stroke-width: 1;
  }
  .cross {
    stroke: var(--muted);
    stroke-width: 1;
  }
  .axis {
    fill: var(--muted);
    font-size: 11px;
  }
  .tip {
    position: absolute;
    transform: translateX(-50%);
    display: grid;
    padding: 0.3rem 0.6rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
    font-size: 0.85rem;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
