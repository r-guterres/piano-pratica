<script lang="ts">
  import MidiMonitor from './ui/MidiMonitor.svelte';

  // Navegação simples por estado; novas telas entram aqui nos próximos marcos.
  const screens = [{ id: 'monitor', label: 'Monitor MIDI' }] as const;
  let screen = $state<(typeof screens)[number]['id']>('monitor');
</script>

<header>
  <h1>Piano Prática</h1>
  <nav>
    {#each screens as s (s.id)}
      <button class:active={screen === s.id} onclick={() => (screen = s.id)}>{s.label}</button>
    {/each}
  </nav>
</header>

<main>
  {#if screen === 'monitor'}
    <MidiMonitor />
  {/if}
</main>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  h1 {
    font-size: 1.25rem;
    margin: 0;
  }
  nav {
    display: flex;
    gap: 0.5rem;
  }
  nav button.active {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  main {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1rem;
    display: grid;
    gap: 1rem;
  }
</style>
