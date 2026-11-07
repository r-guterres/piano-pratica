<script lang="ts">
  import { onMount } from 'svelte';
  import { attachComputerKeyboard, ComputerKeyboardMapper } from './input/computerKeyboard';
  import './input/held.svelte';
  import { inputHub } from './input/hub';
  import { autoConnectMidi, connectedDeviceNames, connectMidi, midi } from './input/midi.svelte';
  import Library from './ui/Library.svelte';
  import MetronomeScreen from './ui/MetronomeScreen.svelte';
  import MidiMonitor from './ui/MidiMonitor.svelte';
  import { go, nav, type ScreenId } from './ui/nav.svelte';
  import ProgressScreen from './ui/ProgressScreen.svelte';
  import { applyUpdate, initPwa, pwa } from './ui/pwa.svelte';
  import SettingsScreen from './ui/SettingsScreen.svelte';
  import TodayScreen from './ui/TodayScreen.svelte';
  import { toast } from './ui/toast.svelte';
  import { loadTrail, startTrailClock } from './ui/trail.svelte';
  import TrailScreen from './ui/TrailScreen.svelte';
  import TrainingScreen from './ui/TrainingScreen.svelte';
  import { settings } from './ui/settings.svelte';

  // Navegação simples por estado (sem roteador): ui/nav.svelte.ts.
  const screens: { id: ScreenId; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: 'trail', label: 'Trilha' },
    { id: 'library', label: 'Partituras' },
    { id: 'drill', label: 'Treinos' },
    { id: 'metronome', label: 'Metrônomo' },
    { id: 'progress', label: 'Progresso' },
    { id: 'monitor', label: 'MIDI' },
    { id: 'settings', label: 'Configurações' },
  ];

  // O leitor (com o OSMD, ~1 MB) só é baixado quando uma partitura é aberta.
  const loadReader = () => import('./ui/ScoreReader.svelte');

  const mapper = new ComputerKeyboardMapper();
  $effect(() => {
    if (!settings.input.computerKeyboard) return;
    return attachComputerKeyboard(mapper, (e) => inputHub.emit(e, 'computer'));
  });

  onMount(() => {
    void autoConnectMidi();
    initPwa();
    void loadTrail();
    // tempo com o teclado em uso conta para a Trilha em qualquer aba
    return startTrailClock();
  });

  $effect(() => {
    if (!pwa.offlineReady) return;
    const t = setTimeout(() => (pwa.offlineReady = false), 6000);
    return () => clearTimeout(t);
  });

  // Só em `npm run dev`: permite simular notas pelo console/testes de navegador.
  if (import.meta.env.DEV) (window as unknown as { __inputHub: unknown }).__inputHub = inputHub;

  const deviceNames = $derived(midi.status === 'ready' ? connectedDeviceNames() : []);
</script>

{#if nav.openScore}
  {#await loadReader()}
    <p class="loading">Carregando leitor…</p>
  {:then { default: ScoreReader }}
    <ScoreReader source={nav.openScore} onclose={() => (nav.openScore = null)} />
  {:catch err}
    <p class="loading">Não consegui carregar o leitor: {String(err)}</p>
  {/await}
{:else}
  <header>
    <h1>Piano Prática</h1>
    <nav>
      {#each screens as s (s.id)}
        <button class:active={nav.screen === s.id} onclick={() => go(s.id)}>{s.label}</button>
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
    {#if nav.screen === 'today'}
      <TodayScreen />
    {:else if nav.screen === 'trail'}
      <TrailScreen />
    {:else if nav.screen === 'library'}
      <Library onopen={(s) => (nav.openScore = s)} />
    {:else if nav.screen === 'drill'}
      <TrainingScreen />
    {:else if nav.screen === 'metronome'}
      <MetronomeScreen />
    {:else if nav.screen === 'progress'}
      <ProgressScreen />
    {:else if nav.screen === 'monitor'}
      <MidiMonitor />
    {:else}
      <SettingsScreen />
    {/if}
  </main>
{/if}

{#if toast.text}
  <div class="toast notice" role="status">{toast.text}</div>
{/if}

{#if pwa.needRefresh}
  <div class="toast" role="status">
    Há uma versão nova do app.
    <button class="primary" onclick={() => applyUpdate()}>Atualizar</button>
    <button onclick={() => (pwa.needRefresh = false)}>Depois</button>
  </div>
{:else if pwa.offlineReady}
  <div class="toast" role="status">
    Pronto para uso offline.
    <button onclick={() => (pwa.offlineReady = false)}>OK</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 50;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    max-width: calc(100vw - 2rem);
    padding: 0.5rem 0.75rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
  }
  .toast.notice {
    right: auto;
    left: 50%;
    transform: translateX(-50%);
    bottom: 4.5rem;
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
  }
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
