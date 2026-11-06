<script lang="ts">
  // Metrônomo avulso (escalas, arpejos, exercícios sem partitura).
  import { onDestroy } from 'svelte';
  import { makeOutputs } from '../playback/outputs';
  import { Player } from '../playback/player';
  import { beatGrid, metronomeSchedule } from '../playback/schedule';
  import { audioContext } from '../playback/sinks';
  import RecordButton from './RecordButton.svelte';
  import { METRONOME_METERS, saveSettings, settings, type MetronomeMeter } from './settings.svelte';

  const BPM_MIN = 30;
  const BPM_MAX = 240;
  const METER_LABELS: Record<MetronomeMeter, string> = {
    '1/4': 'sem acento',
    '2/4': '2/4',
    '3/4': '3/4',
    '4/4': '4/4',
    '6/8': '6/8 (2 tempos)',
  };

  let playing = $state(false);
  let beat = $state<number | null>(null);
  let warning = $state('');
  let player: Player | null = null;

  const pb = settings.playback;
  const meter = $derived(pb.metronomeMeter.split('/').map(Number) as [number, number]);
  const count = $derived(beatGrid(meter[0], meter[1]).count);
  const outputLabel = $derived(
    pb.clickOutput === 'casio' ? 'pelo teclado (MIDI)' : 'pelo alto-falante do tablet',
  );

  function start() {
    audioContext();
    const out = makeOutputs({ clicks: true, notes: false });
    warning = out.warning;
    player = new Player(
      out,
      (e) => {
        if (e.kind === 'click') beat = e.beat;
      },
      () => {},
    );
    player.start(metronomeSchedule(pb.metronomeBpm, meter[0], meter[1]), true);
    playing = true;
  }

  function stop() {
    player?.stop();
    player = null;
    playing = false;
    beat = null;
  }

  function change(fn: () => void) {
    const was = playing;
    stop();
    fn();
    saveSettings();
    if (was) start();
  }

  const setBpm = (v: number) =>
    change(() => (pb.metronomeBpm = Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, v)))));

  // "toque para marcar": média dos intervalos entre os últimos toques
  let taps: number[] = [];
  function tap() {
    const now = performance.now();
    taps = [...taps.filter((t) => now - t < 3000), now].slice(-6);
    if (taps.length < 2) return;
    const span = (taps.at(-1)! - taps[0]!) / (taps.length - 1);
    setBpm(60_000 / span);
  }

  const onHidden = () => document.visibilityState === 'hidden' && stop();
  document.addEventListener('visibilitychange', onHidden);
  onDestroy(() => {
    stop();
    document.removeEventListener('visibilitychange', onHidden);
  });
</script>

<section class="card metronome">
  <h2>Metrônomo</h2>
  <div class="bpm"><strong>{pb.metronomeBpm}</strong> bpm</div>
  <div class="row">
    <button onclick={() => setBpm(pb.metronomeBpm - 5)}>−5</button>
    <button onclick={() => setBpm(pb.metronomeBpm - 1)}>−1</button>
    <button onclick={() => setBpm(pb.metronomeBpm + 1)}>+1</button>
    <button onclick={() => setBpm(pb.metronomeBpm + 5)}>+5</button>
  </div>
  <input
    type="range"
    min={BPM_MIN}
    max={BPM_MAX}
    value={pb.metronomeBpm}
    onchange={(e) => setBpm(Number((e.currentTarget as HTMLInputElement).value))}
    aria-label="Andamento"
  />
  <div class="row">
    <label>
      Compasso
      <select
        value={pb.metronomeMeter}
        onchange={(e) =>
          change(
            () =>
              (pb.metronomeMeter = (e.currentTarget as HTMLSelectElement).value as MetronomeMeter),
          )}
      >
        {#each METRONOME_METERS as m (m)}
          <option value={m}>{METER_LABELS[m]}</option>
        {/each}
      </select>
    </label>
    <button onclick={tap}>Toque no ritmo para marcar</button>
  </div>

  <div class="beats" aria-hidden="true">
    {#each Array.from({ length: count }, (_, k) => k) as i (i)}
      <i class:on={beat === i} class:first={i === 0 && count > 1}></i>
    {/each}
  </div>

  <button class="primary big" onclick={() => (playing ? stop() : start())}>
    {playing ? '■ Parar' : '▶ Iniciar'}
  </button>
  <div class="row">
    <RecordButton title="Exercício ({pb.metronomeBpm} bpm)" />
  </div>
  {#if warning}<p class="warn">{warning}</p>{/if}
  <p class="muted small">
    Som {outputLabel}. Mude em Configurações → Som. Em 6/8 o clique marca as semínimas pontuadas.
  </p>
</section>

<style>
  .metronome {
    display: grid;
    gap: 0.9rem;
    justify-items: center;
    text-align: center;
  }
  .bpm {
    font-size: 1.1rem;
  }
  .bpm strong {
    font-size: 3.5rem;
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    align-items: end;
  }
  .row button {
    min-width: 3.5rem;
  }
  label {
    display: inline-flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  input[type='range'] {
    width: min(100%, 28rem);
    min-height: 2.75rem;
  }
  .beats {
    display: flex;
    gap: 0.6rem;
    min-height: 1.6rem;
  }
  .beats i {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 2px solid var(--border);
  }
  .beats i.first {
    border-color: var(--muted);
  }
  .beats i.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  .big {
    min-width: 12rem;
    min-height: 3.5rem;
    font-size: 1.15rem;
  }
  .warn {
    color: var(--warn);
    margin: 0;
  }
  .small {
    font-size: 0.85rem;
    margin: 0;
  }
</style>
