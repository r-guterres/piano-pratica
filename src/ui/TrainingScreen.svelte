<script lang="ts">
  // Aba "Treinos": leitura de notas, ler e tocar, acordes, ouvido e pedal.
  import ChordDrillScreen from './drills/ChordDrillScreen.svelte';
  import EarDrillScreen from './drills/EarDrillScreen.svelte';
  import { nav, type Training } from './nav.svelte';
  import PedalScreen from './PedalScreen.svelte';

  const TRAININGS: [Training, string][] = [
    ['reading', 'Leitura de notas'],
    ['sight', 'Ler e tocar'],
    ['chords', 'Acordes'],
    ['ear', 'Ouvido'],
    ['pedal', 'Pedal sincopado'],
  ];

  // Os treinos com pauta (VexFlow e a fonte Bravura) só são baixados quando abertos.
  const loadDrill = () => import('./DrillScreen.svelte');
  const loadSight = () => import('./drills/SightReadingScreen.svelte');
</script>

<div class="choose" role="group" aria-label="Treino">
  {#each TRAININGS as [id, label] (id)}
    <button class:active={nav.training === id} onclick={() => (nav.training = id)}>{label}</button>
  {/each}
</div>

{#if nav.training === 'reading'}
  {#await loadDrill()}
    <p class="loading">Carregando treino…</p>
  {:then { default: DrillScreen }}
    <DrillScreen />
  {:catch err}
    <p class="loading">Não consegui carregar o treino: {String(err)}</p>
  {/await}
{:else if nav.training === 'sight'}
  {#await loadSight()}
    <p class="loading">Carregando treino…</p>
  {:then { default: SightReadingScreen }}
    <SightReadingScreen />
  {:catch err}
    <p class="loading">Não consegui carregar o treino: {String(err)}</p>
  {/await}
{:else if nav.training === 'chords'}
  <ChordDrillScreen />
{:else if nav.training === 'ear'}
  <EarDrillScreen />
{:else}
  <PedalScreen />
{/if}

<style>
  .choose {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .choose button.active {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .loading {
    padding: 2rem;
    text-align: center;
  }
</style>
