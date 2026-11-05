<script lang="ts">
  import { writtenName, type DrillItem } from '../drills/notes';
  import { Prioritizer } from '../drills/priority';
  import { appHistory, type HistoryData } from '../storage/history';
  import {
    dailyTotals,
    drillTrend,
    exportFileName,
    pieceProgress,
    toExportJson,
  } from '../storage/progress';
  import DailyBars from './charts/DailyBars.svelte';
  import RecordingsCard from './RecordingsCard.svelte';
  import TrendLine from './charts/TrendLine.svelte';
  import { settings } from './settings.svelte';

  const DAYS_SHOWN = 14;
  const ROUNDS_SHOWN = 30;
  const CLEF_SHORT = { treble: 'sol', bass: 'fá', grand: 'dupla' } as const;

  let data = $state.raw<HistoryData | null>(null);
  let error = $state('');
  appHistory()
    .exportData()
    .then((d) => (data = d))
    .catch((err: unknown) => (error = `Não consegui ler o histórico: ${String(err)}`));

  const now = Date.now();
  const days30 = $derived(data ? dailyTotals(data, 30, now) : []);
  const days = $derived(days30.slice(-DAYS_SHOWN));
  const sumMs = (list: typeof days30) => list.reduce((a, d) => a + d.scoreMs + d.drillMs, 0);
  const tiles = $derived([
    { label: 'hoje', value: fmtDuration(sumMs(days30.slice(-1))) },
    { label: 'últimos 7 dias', value: fmtDuration(sumMs(days30.slice(-7))) },
    { label: 'últimos 30 dias', value: fmtDuration(sumMs(days30)) },
    {
      label: 'dias com prática (30)',
      value: String(days30.filter((d) => d.scoreMs + d.drillMs > 0).length),
    },
  ]);

  const pieces = $derived(data ? pieceProgress(data.scoreSessions) : []);
  const rounds = $derived(data ? drillTrend(data.drillRounds).slice(-ROUNDS_SHOWN) : []);
  const roundLabel = (t: number) =>
    new Date(t).toLocaleString('pt-BR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  const firstTryPoints = $derived(
    rounds
      .filter((r) => r.firstTryPct !== null)
      .map((r) => ({ label: roundLabel(r.startedAt), value: r.firstTryPct! })),
  );
  const reactionPoints = $derived(
    rounds
      .filter((r) => r.meanReactionMs !== null)
      .map((r) => ({ label: roundLabel(r.startedAt), value: r.meanReactionMs! / 1000 })),
  );

  // Notas que o treino vai priorizar agora (mesmo peso usado no sorteio).
  const hardest = $derived.by(() => {
    if (!data) return [];
    const p = new Prioritizer();
    p.restore(data.drillStats);
    const items: Record<string, DrillItem> = {};
    for (const r of data.drillRounds) for (const i of r.summary.items) items[i.item.id] = i.item;
    const median = p.medianMs();
    return [...p.stats]
      .map(([id, s]) => ({
        id,
        item: items[id] ?? null,
        weight: p.weight(id, median),
        errorPct: Math.round(100 * p.errorRate(id)),
        meanMs: s.meanMs,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  });

  function fmtDuration(ms: number): string {
    const min = Math.round(ms / 60_000);
    if (ms > 0 && min === 0) return '<1 min';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
  }
  const fmtSeconds = (s: number) => `${s.toFixed(1).replace('.', ',')} s`;
  const fmtDate = (t: number) => new Date(t).toLocaleDateString('pt-BR');

  let exporting = $state(false);
  async function exportJson() {
    exporting = true;
    try {
      const json = toExportJson(await appHistory().exportData(), {
        exportedAt: Date.now(),
        commit: import.meta.env.VITE_COMMIT ?? 'dev',
      });
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName(Date.now());
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      error = `Não consegui exportar: ${String(err)}`;
    } finally {
      exporting = false;
    }
  }
</script>

<section class="card">
  <div class="head">
    <h2>Progresso</h2>
    <button onclick={exportJson} disabled={exporting || !data}>Exportar histórico (JSON)</button>
  </div>
  {#if error}<p class="error">{error}</p>{/if}

  {#if !data && !error}
    <p class="muted">Carregando…</p>
  {:else if data}
    <div class="tiles">
      {#each tiles as t (t.label)}
        <div class="tile"><span class="big">{t.value}</span>{t.label}</div>
      {/each}
    </div>
    <h3>Minutos por dia (últimos {DAYS_SHOWN} dias)</h3>
    <DailyBars {days} />
    <details>
      <summary>Ver em tabela</summary>
      <table>
        <thead><tr><th>Dia</th><th>Partituras</th><th>Treino</th></tr></thead>
        <tbody>
          {#each days.toReversed() as d (d.day)}
            <tr>
              <td>{d.day.split('-').reverse().join('/')}</td>
              <td>{fmtDuration(d.scoreMs)}</td>
              <td>{fmtDuration(d.drillMs)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
  {/if}
</section>

{#if data}
  <section class="card">
    <h2>Treino de leitura</h2>
    {#if rounds.length === 0}
      <p class="muted">Nenhuma rodada ainda.</p>
    {:else}
      <h3>Acertos de primeira, por rodada</h3>
      <TrendLine
        points={firstTryPoints}
        label="Porcentagem de acertos de primeira por rodada"
        format={(v) => `${Math.round(v)}%`}
        yMax={100}
      />
      {#if reactionPoints.length}
        <h3>Tempo médio de reação, por rodada</h3>
        <TrendLine
          points={reactionPoints}
          label="Tempo médio de reação por rodada, em segundos"
          format={fmtSeconds}
        />
      {/if}
      <details>
        <summary>Ver em tabela</summary>
        <table>
          <thead>
            <tr><th>Rodada</th><th>Clave</th><th>Notas</th><th>De primeira</th><th>Tempo</th></tr>
          </thead>
          <tbody>
            {#each rounds.toReversed() as r (r.startedAt)}
              <tr>
                <td>{roundLabel(r.startedAt)}</td>
                <td>{CLEF_SHORT[r.clefs]}</td>
                <td>{r.answered}</td>
                <td>{r.firstTryPct}%</td>
                <td>{r.meanReactionMs === null ? '—' : fmtSeconds(r.meanReactionMs / 1000)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </details>
    {/if}

    {#if hardest.length}
      <h3>Notas que o treino vai priorizar</h3>
      <table>
        <thead><tr><th>Nota</th><th>Clave</th><th>Taxa de erro</th><th>Tempo médio</th></tr></thead>
        <tbody>
          {#each hardest as h (h.id)}
            <tr>
              <td>{h.item ? writtenName(h.item.note, settings.naming) : h.id}</td>
              <td>{h.item ? CLEF_SHORT[h.item.clef] : '—'}</td>
              <td>{h.errorPct}%</td>
              <td>{h.meanMs === null ? '—' : fmtSeconds(h.meanMs / 1000)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="muted small">
        A taxa de erro é a estimada pelo treino: pesa mais as respostas recentes e começa em 25%
        para notas pouco vistas.
      </p>
    {/if}
  </section>

  <section class="card">
    <h2>Partituras</h2>
    {#if pieces.length === 0}
      <p class="muted">Nenhuma sessão ainda.</p>
    {:else}
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Peça</th><th>Sessões</th><th>Tempo</th><th>Até o fim</th><th
                title="Passos tocados sem erro: primeira sessão → última">Passos limpos</th
              ><th>Última</th>
            </tr>
          </thead>
          <tbody>
            {#each pieces as p (p.scoreId)}
              <tr>
                <td>{p.title}</td>
                <td>{p.sessions}</td>
                <td>{fmtDuration(p.totalMs)}</td>
                <td>{p.finished}</td>
                <td>
                  {#if p.lastCleanPct === null}—{:else if p.sessions > 1 && p.firstCleanPct !== p.lastCleanPct}{p.firstCleanPct}%
                    → {p.lastCleanPct}%{:else}{p.lastCleanPct}%{/if}
                </td>
                <td>{fmtDate(p.lastAt)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
  <RecordingsCard />
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }
  h3 {
    font-size: 0.95rem;
    margin: 1rem 0 0.4rem;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .tile {
    display: grid;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    background: var(--surface-2);
    font-size: 0.85rem;
    color: var(--muted);
  }
  .big {
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--text);
  }
  details {
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }
  summary {
    cursor: pointer;
    color: var(--muted);
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 0.9rem;
    margin-top: 0.4rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.3rem 0.75rem 0.3rem 0;
    border-bottom: 1px solid var(--grid);
    white-space: nowrap;
  }
  th {
    font-weight: 600;
    color: var(--muted);
  }
  .small {
    font-size: 0.85rem;
  }
  .error {
    color: var(--bad);
  }
</style>
