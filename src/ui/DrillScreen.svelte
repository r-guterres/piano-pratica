<script module lang="ts">
  import { Prioritizer } from '../drills/priority';

  // Lembra das notas difíceis entre rodadas enquanto o app estiver aberto
  // (o histórico persistente vem no M4).
  const prioritizer = new Prioritizer();
</script>

<script lang="ts">
  import { onDestroy, tick as svelteTick } from 'svelte';
  import { pitchName } from '../core/pitch';
  import {
    buildPool,
    diatonicName,
    STAFF_LINES,
    writtenName,
    type Clef,
    type ClefSelection,
    type DrillItem,
  } from '../drills/notes';
  import { ReadingDrill, type DrillSummary } from '../drills/readingDrill';
  import { heldPitches } from '../input/held.svelte';
  import { inputHub } from '../input/hub';
  import DrillSummaryView from './DrillSummary.svelte';
  import { drawStaff, fontsReady } from './drillStaff';
  import PianoKeyboard from './PianoKeyboard.svelte';
  import { saveSettings, settings } from './settings.svelte';

  const COLOR = { ok: '#2e7d32', late: '#e65100', wrong: '#d32f2f' };
  const CLEF_LABELS: Record<ClefSelection, string> = {
    treble: 'Clave de sol',
    bass: 'Clave de fá',
    grand: 'Pauta dupla',
  };
  const MAJOR_KEYS = [
    'Dó♭',
    'Sol♭',
    'Ré♭',
    'Lá♭',
    'Mi♭',
    'Si♭',
    'Fá',
    'Dó',
    'Sol',
    'Ré',
    'Lá',
    'Mi',
    'Si',
    'Fá♯',
    'Dó♯',
  ];
  const keyLabel = (f: number) =>
    f === 0
      ? 'Nenhuma (Dó maior)'
      : `${Math.abs(f)}${f > 0 ? '♯' : '♭'} (${MAJOR_KEYS[f + 7]} maior)`;

  let phase = $state<'setup' | 'running' | 'summary'>('setup');
  let drill: ReadingDrill | null = null;
  let pool = $state.raw<DrillItem[]>([]);
  let shownClefs = $state<ClefSelection>('treble');
  let shownKey = 0;
  let tick = $state(0);
  let staffEl = $state<HTMLDivElement>();

  let lastWrong = $state<string | null>(null);
  let lastOk = $state<string | null>(null);
  let summary = $state<DrillSummary | null>(null);
  let startedAt = $state(0);
  let endedAt = $state(0);
  let now = $state(0);
  let clock: ReturnType<typeof setInterval> | undefined;
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  const preview = $derived(buildPool(settings.drill));
  const naming = $derived(settings.naming);
  const usedClefs = $derived<Clef[]>(
    settings.drill.clefs === 'grand' ? ['treble', 'bass'] : [settings.drill.clefs],
  );

  /** Até 4 linhas suplementares de cada lado da pauta. */
  function rangeOptions(clef: Clef): number[] {
    const { low, high } = STAFF_LINES[clef];
    return Array.from({ length: high - low + 17 }, (_, i) => low - 8 + i);
  }

  function changeRange(clef: Clef) {
    const r = settings.drill.range[clef];
    if (r.low > r.high) [r.low, r.high] = [r.high, r.low];
    saveSettings();
  }

  async function start() {
    saveSettings();
    pool = buildPool(settings.drill);
    if (!pool.length) return;
    shownClefs = settings.drill.clefs;
    shownKey = settings.drill.keySignature;
    drill = new ReadingDrill(pool, { revealAfter: settings.drill.revealAfter, prioritizer });
    summary = null;
    lastWrong = lastOk = null;
    phase = 'running';
    await fontsReady;
    await svelteTick();
    startedAt = now = performance.now();
    clock = setInterval(() => (now = performance.now()), 250);
    showNext();
  }

  const limitMs = () => settings.drill.minutes * 60_000;
  const timeUp = () => limitMs() > 0 && performance.now() - startedAt >= limitMs();

  function showNext() {
    if (!drill) return;
    if (timeUp()) return finish();
    drill.next(performance.now());
    lastWrong = null;
    render();
    tick++;
  }

  function render(color?: string) {
    if (staffEl && drill)
      drawStaff(staffEl, {
        clefs: shownClefs,
        keySignature: shownKey,
        item: drill.current,
        color,
      });
  }

  function finish() {
    if (!drill) return;
    clearInterval(clock);
    clearTimeout(advanceTimer);
    clearTimeout(flashTimer);
    endedAt = performance.now();
    summary = drill.summary();
    phase = 'summary';
  }

  const unsubscribe = inputHub.subscribe((event) => {
    if (phase !== 'running' || !drill || event.type === 'pedal') return;
    // relógio único com o instante em que a nota apareceu
    for (const e of drill.handle({ ...event, t: performance.now() })) {
      const name = writtenName(e.item.note, naming);
      if (e.type === 'correct') {
        clearTimeout(flashTimer);
        lastOk = `✓ ${name} · ${(e.reactionMs / 1000).toFixed(1).replace('.', ',')} s`;
        render(e.firstTry ? COLOR.ok : COLOR.late);
        advanceTimer = setTimeout(showNext, e.firstTry ? 350 : 800);
      } else if (e.type === 'wrong') {
        lastWrong = `✗ tocou ${pitchName(e.played, naming)}`;
        render(COLOR.wrong);
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => render(drill?.revealedNow ? COLOR.late : undefined), 350);
      }
    }
    tick++;
  });

  onDestroy(() => {
    unsubscribe();
    clearInterval(clock);
    clearTimeout(advanceTimer);
    clearTimeout(flashTimer);
  });

  const live = $derived.by(() => {
    void tick;
    return drill?.summary() ?? null;
  });
  const current = $derived.by(() => {
    void tick;
    return drill?.current ?? null;
  });
  const revealed = $derived.by(() => {
    void tick;
    return drill?.revealedNow ?? false;
  });

  function clockText(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  const clockLabel = $derived(
    limitMs() > 0 ? clockText(limitMs() - (now - startedAt)) : clockText(now - startedAt),
  );

  const kbRange = $derived.by(() => {
    void tick;
    const pitches = pool.map((i) => i.pitch);
    if (!pitches.length) return { low: 48, high: 72 };
    const low = Math.floor(Math.min(...pitches) / 12) * 12;
    const high = Math.ceil((Math.max(...pitches) + 1) / 12) * 12;
    return { low: Math.min(low, 48), high: Math.max(high, 72) };
  });
  const press = (pitch: number) =>
    inputHub.emit({ type: 'on', pitch, velocity: 80, t: performance.now() }, 'virtual');
  const release = (pitch: number) =>
    inputHub.emit({ type: 'off', pitch, velocity: 0, t: performance.now() }, 'virtual');
</script>

{#if phase === 'setup'}
  <section class="card setup">
    <h2>Treino de leitura</h2>
    <p class="muted">
      O app mostra uma nota; toque-a no teclado. As notas que você erra ou demora para achar
      aparecem mais vezes.
    </p>

    <label>
      Pauta
      <select bind:value={settings.drill.clefs} onchange={saveSettings}>
        {#each Object.entries(CLEF_LABELS) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>

    {#each usedClefs as clef (clef)}
      <div class="range">
        <span>Extensão na {clef === 'treble' ? 'clave de sol' : 'clave de fá'}:</span>
        <select bind:value={settings.drill.range[clef].low} onchange={() => changeRange(clef)}>
          {#each rangeOptions(clef) as d (d)}
            <option value={d}>{diatonicName(d, naming)}</option>
          {/each}
        </select>
        <span>a</span>
        <select bind:value={settings.drill.range[clef].high} onchange={() => changeRange(clef)}>
          {#each rangeOptions(clef) as d (d)}
            <option value={d}>{diatonicName(d, naming)}</option>
          {/each}
        </select>
      </div>
    {/each}

    <label>
      Armadura
      <select bind:value={settings.drill.keySignature} onchange={saveSettings}>
        {#each Array.from({ length: 15 }, (_, i) => i - 7) as f (f)}
          <option value={f}>{keyLabel(f)}</option>
        {/each}
      </select>
    </label>

    <label class="check">
      <input type="checkbox" bind:checked={settings.drill.accidentals} onchange={saveSettings} />
      Incluir acidentes (♯, ♭, ♮)
    </label>

    <label>
      Mostrar a resposta depois de
      <select bind:value={settings.drill.revealAfter} onchange={saveSettings}>
        {#each [1, 2, 3, 5] as n (n)}
          <option value={n}>{n} {n === 1 ? 'erro' : 'erros'}</option>
        {/each}
        <option value={0}>nunca</option>
      </select>
    </label>

    <label>
      Duração da rodada
      <select bind:value={settings.drill.minutes} onchange={saveSettings}>
        {#each [1, 2, 3, 5, 10] as m (m)}
          <option value={m}>{m} min</option>
        {/each}
        <option value={0}>sem limite</option>
      </select>
    </label>

    <div class="go">
      <span class="muted">{preview.length} notas possíveis</span>
      <button class="primary" disabled={!preview.length} onclick={start}>Começar</button>
    </div>
  </section>
{:else if phase === 'summary' && summary}
  <DrillSummaryView
    {summary}
    {pool}
    {prioritizer}
    durationMs={endedAt - startedAt}
    onagain={start}
    onsetup={() => (phase = 'setup')}
  />
{:else}
  <div class="runner">
    <div class="bar">
      <button onclick={finish}>Encerrar</button>
      <span class="clock" class:low={limitMs() > 0 && limitMs() - (now - startedAt) < 10_000}
        >{clockLabel}</span
      >
      {#if live}
        <span>
          De primeira: <strong>{live.firstTry}/{live.answered}</strong>
        </span>
        {#if live.meanReactionMs !== null}
          <span class="muted">
            média {(live.meanReactionMs / 1000).toFixed(1).replace('.', ',')} s
          </span>
        {/if}
      {/if}
    </div>

    <div class="staff" class:grand={shownClefs === 'grand'} bind:this={staffEl}></div>

    <div class="feedback">
      {#if revealed && current}
        <span class="reveal">Resposta: {writtenName(current.note, naming)}</span>
      {/if}
      {#if lastWrong}<span class="bad">{lastWrong}</span>{/if}
      {#if !lastWrong && !revealed && lastOk}<span class="ok">{lastOk}</span>{/if}
    </div>

    {#if settings.input.virtualKeyboard}
      <div class="kb">
        <PianoKeyboard
          low={kbRange.low}
          high={kbRange.high}
          active={heldPitches}
          marked={revealed && current ? new Set([current.pitch]) : undefined}
          onpress={press}
          onrelease={release}
        />
      </div>
    {/if}
  </div>
{/if}

<style>
  .setup {
    display: grid;
    gap: 0.9rem;
    max-width: 34rem;
  }
  .setup h2 {
    margin: 0;
  }
  .setup p {
    margin: 0;
  }
  label {
    display: grid;
    gap: 0.3rem;
  }
  label.check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .range {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .go {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .runner {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .clock {
    font-size: 1.2rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .clock.low {
    color: var(--bad);
  }
  .staff {
    flex: 1;
    min-height: 0;
    display: flex;
    justify-content: center;
    padding: 1rem;
    background: var(--paper, #fffdf8);
    color: #000;
  }
  .staff :global(svg) {
    max-width: 40rem;
  }
  .feedback {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    min-height: 2.6rem;
    padding: 0.5rem 1rem;
    font-size: 1.3rem;
    font-weight: 600;
  }
  .ok {
    color: var(--ok);
  }
  .bad {
    color: var(--bad);
  }
  .reveal {
    color: #e65100;
  }
</style>
