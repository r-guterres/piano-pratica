<script lang="ts">
  // Progresso dos treinos de acordes, ouvido e ler e tocar: por treino (e
  // modo), a taxa de acerto por dia e o que mais deu trabalho.
  import { EAR_MODES, type EarMode } from '../drills/earDrill';
  import { SIGHT_MODES, type SightMode } from '../drills/sightReading';
  import type { ExerciseRecord } from '../storage/history';
  import { exerciseProgress, type ExerciseGroup } from '../storage/progress';
  import TrendLine from './charts/TrendLine.svelte';

  let { exercises }: { exercises: ExerciseRecord[] } = $props();

  const DAYS_SHOWN = 30;
  const groups = $derived(exerciseProgress(exercises));

  function title(g: ExerciseGroup): string {
    if (g.kind === 'chords') return 'Acordes';
    if (g.kind === 'ear') return `Ouvido · ${EAR_MODES[g.mode as EarMode] ?? g.mode}`;
    return `Ler e tocar · ${SIGHT_MODES[g.mode as SightMode] ?? g.mode}`;
  }
  const hitLabel = (g: ExerciseGroup) => (g.kind === 'chords' ? 'de primeira' : 'certos');
  const pct = (a: number, t: number) => (t ? Math.round((100 * a) / t) : 0);
  const fmtDay = (d: string) => d.split('-').reverse().slice(0, 2).join('/');
  const minutes = (ms: number) => `${Math.max(1, Math.round(ms / 60_000))} min`;
</script>

<section class="card">
  <h2>Acordes, ouvido e ler e tocar</h2>
  {#if groups.length === 0}
    <p class="muted">Nenhuma sessão ainda. Cada sessão (▶ Começar … ■ Encerrar) aparece aqui.</p>
  {/if}
  {#each groups as g (g.key)}
    {@const days = g.days.slice(-DAYS_SHOWN)}
    <div class="group">
      <h3>{title(g)}</h3>
      <p class="muted">
        {g.sessions}
        {g.sessions === 1 ? 'sessão' : 'sessões'} · {g.answered} respostas · {pct(
          g.hits,
          g.answered,
        )}% {hitLabel(g)} · {minutes(g.durationMs)}
      </p>
      {#if days.length > 1}
        <TrendLine
          points={days.map((d) => ({ label: fmtDay(d.day), value: pct(d.hits, d.answered) }))}
          label={`${title(g)}: % ${hitLabel(g)} por dia`}
          format={(v) => `${Math.round(v)}%`}
          yMax={100}
        />
      {/if}
      {#if g.trouble.length}
        <p>
          <b>{g.kind === 'chords' ? 'Mais deram trabalho' : 'Mais errados'}:</b>
          {g.trouble.map(([label, n]) => `${label} (${n}×)`).join(' · ')}
        </p>
      {/if}
      <details>
        <summary>Ver em tabela</summary>
        <table>
          <thead><tr><th>Dia</th><th>Respostas</th><th>{hitLabel(g)}</th></tr></thead>
          <tbody>
            {#each days.toReversed() as d (d.day)}
              <tr>
                <td>{fmtDay(d.day)}</td>
                <td>{d.answered}</td>
                <td>{d.hits} ({pct(d.hits, d.answered)}%)</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </details>
    </div>
  {/each}
</section>

<style>
  .group {
    display: grid;
    gap: 0.4rem;
    padding-top: 0.6rem;
  }
  .group + .group {
    border-top: 1px solid var(--border);
  }
  h3,
  p {
    margin: 0;
  }
  table {
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 0.2rem 1rem 0.2rem 0;
  }
</style>
