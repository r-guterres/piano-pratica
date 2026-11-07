<script lang="ts">
  // Aba "Treinos": escolhe entre o treino de leitura e o de pedal.
  import { nav } from './nav.svelte';
  import PedalScreen from './PedalScreen.svelte';

  // O treino de leitura (com o VexFlow e a fonte Bravura) só é baixado quando aberto.
  const loadDrill = () => import('./DrillScreen.svelte');
</script>

<div class="choose" role="group" aria-label="Treino">
  <button class:active={nav.training === 'reading'} onclick={() => (nav.training = 'reading')}>
    Leitura de notas
  </button>
  <button class:active={nav.training === 'pedal'} onclick={() => (nav.training = 'pedal')}>
    Pedal sincopado
  </button>
</div>

{#if nav.training === 'reading'}
  {#await loadDrill()}
    <p class="loading">Carregando treino…</p>
  {:then { default: DrillScreen }}
    <DrillScreen />
  {:catch err}
    <p class="loading">Não consegui carregar o treino: {String(err)}</p>
  {/await}
{:else}
  <PedalScreen />
{/if}

<style>
  .choose {
    display: flex;
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
