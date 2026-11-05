<script lang="ts">
  // Aba "Treinos": escolhe entre o treino de leitura e o de pedal.
  import PedalScreen from './PedalScreen.svelte';

  type Training = 'reading' | 'pedal';
  let training = $state<Training>('reading');

  // O treino de leitura (com o VexFlow e a fonte Bravura) só é baixado quando aberto.
  const loadDrill = () => import('./DrillScreen.svelte');
</script>

<div class="choose" role="group" aria-label="Treino">
  <button class:active={training === 'reading'} onclick={() => (training = 'reading')}>
    Leitura de notas
  </button>
  <button class:active={training === 'pedal'} onclick={() => (training = 'pedal')}>
    Pedal sincopado
  </button>
</div>

{#if training === 'reading'}
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
