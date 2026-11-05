<script lang="ts">
  import { onMount } from 'svelte';
  import { attachComputerKeyboard, ComputerKeyboardMapper } from './input/computerKeyboard';
  import './input/held.svelte';
  import { inputHub } from './input/hub';
  import { autoConnectMidi, connectedDeviceNames, connectMidi, midi } from './input/midi.svelte';
  import Library, { type ScoreSource } from './ui/Library.svelte';
  import MidiMonitor from './ui/MidiMonitor.svelte';
  import ProgressScreen from './ui/ProgressScreen.svelte';
  import SettingsScreen from './ui/SettingsScreen.svelte';
  import { settings } from './ui/settings.svelte';

  // Navegação simples por estado (sem roteador).
  const screens = [
    { id: 'library', label: 'Partituras' },
    { id: 'drill', label: 'Treino de leitura' },
    { id: 'progress', label: 'Progresso' },
    { id: 'monitor', label: 'Monitor MIDI' },
    { id: 'settings', label: 'Configurações' },
  ] as const;
  type ScreenId = (typeof screens)[number]['id'];
  let screen = $state<ScreenId>('library');
  let openScore = $state<ScoreSource | null>(null);

  // O leitor (com o OSMD, ~1 MB) só é baixado quando uma partitura é aberta.
  const loadReader = () => import('./ui/ScoreReader.svelte');
  // Idem para o treino de leitura (com o VexFlow e a fonte Bravura).
  const loadDrill = () => import('./ui/DrillScreen.svelte');

  const mapper = new ComputerKeyboardMapper();
  $effect(() => {
    if (!settings.input.computerKeyboard) return;
    return attachComputerKeyboard(mapper, (e) => inputHub.emit(e, 'computer'));
  });

  onMount(() => {
    void autoConnectMidi();
  });

  // Só em `npm run dev`: permite simular notas pelo console/testes de navegador.
  if (import.meta.env.DEV) (window as unknown as { __inputHub: unknown }).__inputHub = inputHub;

  const deviceNames = $derived(midi.status === 'ready' ? connectedDeviceNames() : []);
</script>

{#if openScore}
  {#await loadReader()}
    <p class="loading">Carregando leitor…</p>
  {:then { default: ScoreReader }}
    <ScoreReader source={openScore} onclose={() => (openScore = null)} />
  {:catch err}
    <p class="loading">Não consegui carregar o leitor: {String(err)}</p>
  {/await}
{:else}
  <header>
    <h1>Piano Prática</h1>
    <nav>
      {#each screens as s (s.id)}
        <button class:active={screen === s.id} onclick={() => (screen = s.id)}>{s.label}</button>
      {/each}
    </nav>
    <div class="midi">
      {#if midi.status === 'ready'}
        <span class="dot" class:on={deviceNames.length > 0}></span>
        {deviceNames.length ? deviceNames.join(', ') : 'MIDI: nenhum dispositivo'}
      {:else if midi.status === 'connecting'}
        MIDI: aguardando permissão…
      {:else if midi.status === 'unsupported'}
        <span class="muted">Sem Web MIDI</span>
      {:else}
        <button onclick={() => connectMidi()}>Conectar MIDI</button>
      {/if}
    </div>
  </header>

  <main>
    {#if screen === 'library'}
      <Library onopen={(s) => (openScore = s)} />
    {:else if screen === 'drill'}
      {#await loadDrill()}
        <p class="loading">Carregando treino…</p>
      {:then { default: DrillScreen }}
        <DrillScreen />
      {:catch err}
        <p class="loading">Não consegui carregar o treino: {String(err)}</p>
      {/await}
    {:else if screen === 'progress'}
      <ProgressScreen />
    {:else if screen === 'monitor'}
      <MidiMonitor />
    {:else}
      <SettingsScreen />
    {/if}
  </main>
{/if}

<style>
  header {
    display: flex;
    align-items: center;
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
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  nav button.active {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .midi {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  .dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    background: var(--border);
  }
  .dot.on {
    background: var(--ok);
  }
  main {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1rem;
    display: grid;
    gap: 1rem;
  }
  .loading {
    padding: 2rem;
    text-align: center;
  }
</style>
