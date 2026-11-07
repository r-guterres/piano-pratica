<script lang="ts">
  import { onDestroy } from 'svelte';
  import { pitchName } from '../core/pitch';
  import { midi } from '../input/midi.svelte';
  import { Player } from '../playback/player';
  import { metronomeSchedule } from '../playback/schedule';
  import { audioContext, estimatedSpeakerLatency, SpeakerSink } from '../playback/sinks';
  import { saveSettings, settings, ZOOM_MAX, ZOOM_MIN } from './settings.svelte';
  import TrailImport from './trail/TrailImport.svelte';

  const pb = settings.playback;
  const outputs = $derived(midi.outputs.filter((o) => o.state === 'connected'));

  // ---- teste do atraso do alto-falante ----
  // Cliques pelo tablet com um ponto que pisca no instante compensado: ajusta-se o
  // atraso até o ponto piscar junto com o som.
  let testing = $state(false);
  let flash = $state(false);
  let estimated = $state<number | null>(null);
  let tester: Player | null = null;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  function startTest() {
    audioContext();
    estimated = Math.round(estimatedSpeakerLatency());
    tester = new Player(
      { clicks: new SpeakerSink(pb.speakerLatencyMs), notes: null },
      (e) => {
        if (e.kind !== 'click') return;
        flash = true;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => (flash = false), 120);
      },
      () => {},
    );
    tester.start(metronomeSchedule(60, 1, 4), true);
    testing = true;
  }
  function stopTest() {
    tester?.stop();
    tester = null;
    testing = false;
  }
  function changeLatency(fn: () => void) {
    const was = testing;
    stopTest();
    fn();
    saveSettings();
    if (was) startTest();
  }
  onDestroy(stopTest);

  const orientations = [
    ['portrait', 'retrato'],
    ['landscape', 'paisagem'],
  ] as const;

  const example = $derived([60, 61, 69].map((p) => pitchName(p, settings.naming)).join(', '));
</script>

<section class="card">
  <h2>Nomes das notas</h2>
  <div class="row">
    <label class="field">
      Nomes
      <select bind:value={settings.naming.style} onchange={saveSettings}>
        <option value="solfege">Dó Ré Mi</option>
        <option value="letters">C D E</option>
      </select>
    </label>
    <label class="field">
      Dó central
      <select bind:value={settings.naming.octave} onchange={saveSettings}>
        <option value="middle-c-4">Dó4 / C4 (científica)</option>
        <option value="middle-c-3">Dó3 / C3 (franco-belga)</option>
      </select>
    </label>
    <label class="field">
      Teclas pretas
      <select bind:value={settings.naming.accidental} onchange={saveSettings}>
        <option value="sharp">sustenidos (♯)</option>
        <option value="flat">bemóis (♭)</option>
      </select>
    </label>
  </div>
  <p class="muted">Exemplo: {example}</p>
</section>

<section class="card">
  <h2>Partitura</h2>
  <div class="row">
    {#each orientations as [o, label] (o)}
      <label class="field grow">
        Tamanho em {label}: {Math.round(settings.score.zoom[o] * 100)}%
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step="0.05"
          bind:value={settings.score.zoom[o]}
          onchange={saveSettings}
        />
      </label>
    {/each}
    <label class="field">
      Virada de página
      <select bind:value={settings.score.pageTurn} onchange={saveSettings}>
        <option value="full">Inteira (no fim da página)</option>
        <option value="half">Meia-virada (lê adiante)</option>
      </select>
    </label>
  </div>
  <p class="muted">Na partitura, toque na borda esquerda ou direita para virar a página à mão.</p>
</section>

<section class="card">
  <h2>Som</h2>
  <div class="row">
    <label class="field">
      Notas da partitura
      <select bind:value={pb.notesOutput} onchange={saveSettings}>
        <option value="casio">pelo teclado (Casio, via MIDI)</option>
        <option value="speaker">pelo alto-falante do tablet</option>
      </select>
    </label>
    <label class="field">
      Metrônomo
      <select bind:value={pb.clickOutput} onchange={saveSettings}>
        <option value="casio">pelo teclado (Casio, via MIDI)</option>
        <option value="speaker">pelo alto-falante do tablet</option>
      </select>
    </label>
    <label class="field">
      Contagem antes de tocar
      <select bind:value={pb.countIn} onchange={saveSettings}>
        <option value={0}>nenhuma</option>
        <option value={1}>1 compasso</option>
        <option value={2}>2 compassos</option>
      </select>
    </label>
    <label class="field">
      Andamento de partituras sem andamento escrito
      <input type="number" min="20" max="240" bind:value={pb.defaultBpm} onchange={saveSettings} />
    </label>
  </div>
  <p class="muted">
    {#if outputs.length}
      Saída MIDI: {outputs.map((o) => o.name).join(', ')}.
    {:else}
      Nenhuma saída MIDI conectada: o som sai pelo tablet até o teclado ser conectado.
    {/if}
    No teclado, as notas vão pelo canal 2 (o timbre escolhido no Casio para você tocar não muda) e o metrônomo
    pelo canal de percussão (10).
    {#if midi.echoes}
      Notas devolvidas pelo teclado e ignoradas: {midi.echoes}.
    {/if}
  </p>

  <h3>Atraso do alto-falante</h3>
  <p class="muted">
    O som do tablet sai um pouco depois do instante agendado; o app atrasa o cursor (e o Casio) na
    mesma medida para tudo coincidir. Toque em Testar: o ponto deve piscar junto com o clique. Se
    piscar antes, aumente o atraso.
  </p>
  <div class="row">
    <label class="check inline">
      <input
        type="checkbox"
        checked={pb.speakerLatencyMs === null}
        onchange={(e) =>
          changeLatency(
            () =>
              (pb.speakerLatencyMs = (e.currentTarget as HTMLInputElement).checked
                ? null
                : Math.round(estimatedSpeakerLatency())),
          )}
      />
      Automático{#if estimated !== null}&nbsp;(estimado: {estimated} ms){/if}
    </label>
    {#if pb.speakerLatencyMs !== null}
      <label class="field grow">
        Atraso: {pb.speakerLatencyMs} ms
        <input
          type="range"
          min="0"
          max="400"
          step="5"
          value={pb.speakerLatencyMs}
          onchange={(e) =>
            changeLatency(
              () => (pb.speakerLatencyMs = Number((e.currentTarget as HTMLInputElement).value)),
            )}
        />
      </label>
    {/if}
    <button onclick={() => (testing ? stopTest() : startTest())}>
      {testing ? '■ Parar teste' : '▶ Testar'}
    </button>
    <span class="flash" class:on={flash} aria-hidden="true"></span>
  </div>
</section>

<section class="card">
  <h2>Entrada</h2>
  <label class="check">
    <input type="checkbox" bind:checked={settings.input.computerKeyboard} onchange={saveSettings} />
    Teclado do computador como piano (A S D F… = Dó Ré Mi Fá…; W E T Y U = pretas; Z/X muda a oitava)
  </label>
  <label class="check">
    <input type="checkbox" bind:checked={settings.input.virtualKeyboard} onchange={saveSettings} />
    Mostrar teclado na tela no leitor de partitura
  </label>
  <label class="field">
    Extensão do teclado na tela
    <select bind:value={settings.input.virtualRange} onchange={saveSettings}>
      <option value="compact">Dó3–Dó6 (3 oitavas, teclas maiores)</option>
      <option value="full">Dó2–Dó7 (61 teclas, como o CTK-3500)</option>
    </select>
  </label>
</section>

<TrailImport />

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .field {
    display: inline-flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  .grow {
    flex: 1;
    min-width: 14rem;
  }
  .check {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }
  .check input {
    width: 1.3rem;
    height: 1.3rem;
    margin-top: 0.1rem;
  }
  input[type='range'] {
    width: 100%;
    min-height: 2.75rem;
  }
  input[type='number'] {
    font: inherit;
    width: 6rem;
    min-height: 2.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
  }
  h3 {
    font-size: 0.95rem;
    margin: 1rem 0 0.25rem;
  }
  .check.inline {
    margin: 0;
    align-items: center;
  }
  .row {
    align-items: center;
  }
  .flash {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--surface-2);
    border: 2px solid var(--border);
  }
  .flash.on {
    background: var(--accent);
    border-color: var(--accent);
  }
</style>
