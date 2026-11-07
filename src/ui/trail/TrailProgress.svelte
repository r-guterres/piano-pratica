<script lang="ts">
  // A Trilha na aba Progresso: cofrinho do piano, números, calendário de
  // minutos, pilares (pontos da Trilha + do app), marcos, metas e o diário.
  import type { HistoryData } from '../../storage/history';
  import { appPoints } from '../../trail/activity';
  import { PILLAR_ORDER, PILLARS } from '../../trail/content';
  import { addDays, parseDay, shortDay, weekOf } from '../../trail/dates';
  import {
    allMilestones,
    effectiveMinutes,
    level,
    piggyBank,
    practiced,
    weeksOnTarget,
  } from '../../trail/state';
  import { saveTrail, trail } from '../trail.svelte';

  let { data }: { data: HistoryData | null } = $props();

  const s = $derived(trail.s!);
  const bank = $derived(piggyBank(s));
  const app = $derived(data ? appPoints(data) : null);
  const pillars = $derived(
    PILLAR_ORDER.map((p) => {
      const xp = s.xp[p] + (app?.[p] ?? 0);
      return { p, name: PILLARS[p], xp, ...level(xp) };
    }),
  );
  const milestones = $derived(allMilestones().filter((m) => s.milestones[m.id]));
  const stats = $derived([
    { label: 'Horas', value: bank.hours.toFixed(1).replace('.', ',') },
    { label: 'Dias praticados', value: Object.keys(s.days).filter((d) => practiced(s, d)).length },
    { label: 'Semanas na meta', value: weeksOnTarget(s, trail.day) },
    { label: 'Revisões feitas', value: Object.values(s.songs).reduce((a, m) => a + m.reviews, 0) },
    { label: 'Dominadas', value: bank.mastered },
    { label: 'Marcos', value: milestones.length },
  ]);

  // ---- cofrinho: as 52 teclas brancas de um piano acendem com o avanço ----
  const KEYS = 52;
  const KW = 14;
  const KH = 70;
  const lit = $derived(Math.round(bank.frac * KEYS));
  /** Depois de Lá, Si, Dó, Ré, Mi, Fá, Sol: tem tecla preta à direita? (o piano começa em Lá0) */
  const BLACK_AFTER = [1, 0, 1, 1, 0, 1, 1];

  // ---- calendário: minutos por dia nas últimas 20 semanas ----
  const WEEKS = 20;
  const CELL = 14;
  const GAP = 3;
  const heatStart = $derived(addDays(weekOf(trail.day)[0]!, -(WEEKS - 1) * 7));
  const heatCells = $derived.by(() => {
    const cells: { x: number; y: number; day: string; min: number }[] = [];
    for (let w = 0; w < WEEKS; w++)
      for (let k = 0; k < 7; k++) {
        const day = addDays(heatStart, w * 7 + k);
        if (day > trail.day) continue;
        cells.push({
          x: 16 + w * (CELL + GAP),
          y: k * (CELL + GAP),
          day,
          min: effectiveMinutes(s, day),
        });
      }
    return cells;
  });
  const heat = (m: number) => (m <= 0 ? 0 : m < 15 ? 1 : m < 30 ? 2 : m < 60 ? 3 : 4);
  let showHeatTable = $state(false);

  function setGoal(key: 'hours' | 'songs' | 'daysPerWeek', v: string) {
    const n = parseInt(v, 10);
    if (!(n > 0)) return;
    s.goals[key] = n;
    saveTrail();
  }
  function setSkoove(v: boolean) {
    s.goals.skoove = v;
    s.plan = null;
    saveTrail();
  }

  const diary = $derived((data?.diary ?? []).toReversed().slice(0, 15));
  const longDate = (d: string) =>
    parseDay(d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
</script>

<section class="card stack">
  <div class="between">
    <h2>Cofrinho do piano</h2>
    <span class="big">{Math.round(bank.frac * 100)}%</span>
  </div>
  <svg
    viewBox="0 0 {KEYS * KW + 2} {KH + 2}"
    class="piano"
    role="img"
    aria-label="Cofrinho do piano: {Math.round(bank.frac * 100)}%"
  >
    {#each Array.from({ length: KEYS }, (_, i) => i) as i (i)}
      <rect
        x={1 + i * KW}
        y="1"
        width={KW - 1}
        height={KH}
        rx="2"
        fill={i < lit ? 'var(--accent)' : 'var(--key-white)'}
        stroke="var(--key-border)"
      />
    {/each}
    {#each Array.from({ length: KEYS - 1 }, (_, i) => i).filter((i) => BLACK_AFTER[i % 7]) as i (i)}
      <rect
        x={1 + i * KW + KW * 0.68}
        y="1"
        width={KW * 0.62}
        height={KH * 0.6}
        rx="1.5"
        fill="var(--key-black)"
      />
    {/each}
  </svg>
  <p class="muted">
    Cada tecla acende conforme você avança nas duas metas: <b
      >{bank.hours.toFixed(1).replace('.', ',')} h</b
    >
    de {s.goals.hours} h de prática e <b>{bank.mastered}</b> de {s.goals.songs} músicas dominadas.
  </p>
</section>

<div class="stats">
  {#each stats as t (t.label)}
    <div class="stat"><span class="label">{t.label}</span><b>{t.value}</b></div>
  {/each}
</div>

<section class="card stack">
  <h2>Últimas 20 semanas</h2>
  <div class="heat">
    <svg
      width={WEEKS * (CELL + GAP) + 30}
      height={7 * (CELL + GAP) + 20}
      role="img"
      aria-label="Minutos de prática por dia nas últimas 20 semanas"
    >
      {#each ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as l, i (i)}
        {#if i % 2 === 0}
          <text x="0" y={i * (CELL + GAP) + CELL - 2} class="axis">{l}</text>
        {/if}
      {/each}
      {#each heatCells as c (c.day)}
        <rect x={c.x} y={c.y} width={CELL} height={CELL} rx="3" fill="var(--heat-{heat(c.min)})"
          ><title>{shortDay(c.day)}: {c.min} min</title></rect
        >
      {/each}
      <text x="16" y={7 * (CELL + GAP) + 14} class="axis">{shortDay(heatStart)}</text>
    </svg>
  </div>
  <div class="legend muted">
    menos
    {#each [0, 1, 2, 3, 4] as k (k)}<i style:background="var(--heat-{k})"></i>{/each}
    mais (0, menos de 15, de 30, de 60, 60+ min)
    <button class="small ghost" onclick={() => (showHeatTable = !showHeatTable)}>
      {showHeatTable ? 'Ocultar tabela' : 'Ver em tabela'}
    </button>
  </div>
  {#if showHeatTable}
    <table>
      <thead><tr><th>Dia</th><th>Minutos</th></tr></thead>
      <tbody>
        {#each heatCells.filter((c) => c.min > 0).toReversed() as c (c.day)}
          <tr><td>{shortDay(c.day)}</td><td>{c.min}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<section class="card stack">
  <h2>Pilares</h2>
  <p class="muted small">
    Pontos dos blocos, tópicos, marcos e revisões da Trilha, mais os do app: 1 por nota lida de
    primeira no treino de leitura, 1 por troca de pedal certa e 1 por minuto de partitura.
  </p>
  {#each pillars as p (p.p)}
    <div class="pillar">
      <span>{p.name}</span>
      <div class="bar" title="{p.xp} pontos"><i style:width="{Math.round(p.frac * 100)}%"></i></div>
      <span class="lvl">Nív. {p.n}</span>
    </div>
  {/each}
</section>

{#if milestones.length}
  <section class="card stack">
    <h2>Marcos conquistados</h2>
    {#each milestones as m (m.id)}
      <div class="row">
        <span class="pill good">{shortDay(s.milestones[m.id]!)}</span><span>{m.title}</span>
      </div>
    {/each}
  </section>
{/if}

{#if diary.length}
  <section class="card stack">
    <h2>Diário</h2>
    {#each diary as e (e.id)}
      <details>
        <summary>
          <b>{longDate(e.id)}</b>
          <span class="muted"
            >· {e.text.trim().slice(0, 70)}{e.text.trim().length > 70 ? '…' : ''}</span
          >
        </summary>
        <p class="entry">{e.text}</p>
      </details>
    {/each}
  </section>
{/if}

<section class="card stack">
  <h2>Metas da Trilha</h2>
  <div class="settings">
    <label>
      Meta de horas para o piano
      <input
        type="number"
        min="50"
        max="5000"
        value={s.goals.hours}
        onchange={(e) => setGoal('hours', (e.currentTarget as HTMLInputElement).value)}
      />
    </label>
    <label>
      Meta de músicas dominadas
      <input
        type="number"
        min="5"
        max="200"
        value={s.goals.songs}
        onchange={(e) => setGoal('songs', (e.currentTarget as HTMLInputElement).value)}
      />
    </label>
    <label>
      Dias por semana
      <input
        type="number"
        min="1"
        max="7"
        value={s.goals.daysPerWeek}
        onchange={(e) => setGoal('daysPerWeek', (e.currentTarget as HTMLInputElement).value)}
      />
    </label>
    <label>
      Usar o Skoove nas sessões
      <select
        value={s.goals.skoove ? '1' : '0'}
        onchange={(e) => setSkoove((e.currentTarget as HTMLSelectElement).value === '1')}
      >
        <option value="1">Sim</option>
        <option value="0">Não</option>
      </select>
    </label>
  </div>
  <p class="muted small">
    Começou em {shortDay(s.start)}. Uma música conta como dominada quando passa a ser revisada a
    cada 30 dias ou mais.
  </p>
</section>

<style>
  .stack {
    display: grid;
    gap: 0.6rem;
  }
  .stack p,
  h2 {
    margin: 0;
  }
  .between {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .big {
    font-size: 1.3rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .piano {
    width: 100%;
    height: auto;
    display: block;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.75rem;
  }
  .stat {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.7rem 0.9rem;
  }
  .stat b {
    display: block;
    font-size: 1.4rem;
    font-variant-numeric: tabular-nums;
  }
  .label {
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--muted);
  }
  .heat {
    overflow-x: auto;
  }
  .heat svg {
    display: block;
  }
  .axis {
    font-size: 10px;
    fill: var(--muted);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
  }
  .legend i {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 3px;
  }
  table {
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.15rem 1rem 0.15rem 0;
  }
  .pillar {
    display: grid;
    grid-template-columns: 11rem 1fr 4rem;
    gap: 0.6rem;
    align-items: center;
  }
  @media (max-width: 480px) {
    .pillar {
      grid-template-columns: 7.5rem 1fr 3.5rem;
      font-size: 0.9rem;
    }
  }
  .bar {
    height: 10px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 999px;
  }
  .lvl {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .entry {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 0.5rem 0 0;
  }
  summary {
    cursor: pointer;
  }
  .settings {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.75rem;
  }
  .settings label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  .small {
    font-size: 0.85rem;
  }
</style>
