<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { InputEvent } from '../core/events';
  import { pitchName } from '../core/pitch';
  import { heldPitches } from '../input/held.svelte';
  import { inputHub } from '../input/hub';
  import { midi } from '../input/midi.svelte';
  import {
    loopStepRange,
    WaitMode,
    type LoopRange,
    type WaitModeSummary,
  } from '../practice/waitMode';
  import { ScoreView, type ScoreViewState } from '../score/ScoreView';
  import { buildSteps } from '../score/steps';
  import { appHistory, newId, type ScoreSessionRecord } from '../storage/history';
  import type { HandSelection, TimelinePosition } from '../score/types';
  import type { ScoreSource } from './Library.svelte';
  import PianoKeyboard from './PianoKeyboard.svelte';
  import SessionSummary from './SessionSummary.svelte';
  import { saveSettings, settings, ZOOM_MAX, ZOOM_MIN } from './settings.svelte';

  let { source, onclose }: { source: ScoreSource; onclose: () => void } = $props();

  // Cores do feedback nas cabeças de nota (sobre papel claro).
  const COLOR = {
    partial: '#1e6fd9', // nota certa de um acorde ainda incompleto
    clean: '#2e7d32', // passo tocado de primeira
    fixed: '#e65100', // passo concluído depois de erro(s)
    wrong: '#d32f2f', // pisca ao errar
  };

  let viewport: HTMLDivElement;
  let view: ScoreView | null = null;
  let error = $state('');
  let loading = $state(true);
  let timeline = $state.raw<TimelinePosition[]>([]);
  // título de dentro da partitura (MusicXML), se houver; senão, o da biblioteca/arquivo
  let sheetTitle = $state('');
  const title = $derived(sheetTitle || source.title);
  let vs = $state<ScoreViewState | null>(null);

  const steps = $derived(buildSteps(timeline, settings.score.hands));
  const measureCount = $derived((timeline.at(-1)?.measure ?? 0) + 1);

  // ---- sessão do modo espera ----
  // O WaitMode não é reativo; incrementar `tick` faz a UI reler o estado dele.
  let mode = $state.raw<WaitMode | null>(null);
  let tick = $state(0);
  let loop = $state<LoopRange | null>(null);
  let summary = $state<WaitModeSummary | null>(null);
  let lastWrong = $state<number | null>(null);

  const current = $derived.by(() => (void tick, mode?.current ?? null));
  const played = $derived.by(() => (void tick, new Set(mode?.played ?? [])));
  const wrongCount = $derived.by(() => (void tick, mode?.summary().wrongNotes ?? 0));
  const expected = $derived(new Set(current?.pitches ?? []));
  const range = $derived(
    settings.input.virtualRange === 'full' ? { low: 36, high: 96 } : { low: 48, high: 84 },
  );

  // ---- histórico (IndexedDB) ----
  let record: Omit<ScoreSessionRecord, 'finished' | 'summary'> | null = null;

  /** Grava a sessão atual (de novo pelo mesmo id, se já gravada); sem nenhuma nota tocada, não grava. */
  function persistSession() {
    if (!mode || !record) return;
    const summary = mode.summary();
    if (summary.completed === 0 && summary.wrongNotes === 0) return;
    appHistory()
      .saveScoreSession({ ...record, finished: mode.finished, summary })
      .catch((err: unknown) => console.warn('Não consegui salvar a sessão:', err));
  }

  function startSession() {
    if (!view) return;
    persistSession();
    mode = new WaitMode(steps, { loop });
    record = {
      id: newId(),
      scoreId: source.id,
      title,
      startedAt: Date.now(),
      hands: settings.score.hands,
      loop: loop ? { ...loop } : null,
      stepCount: mode.range.last - mode.range.first + 1,
    };
    view.clearColors();
    summary = null;
    lastWrong = null;
    tick++;
    if (mode.current) view.moveTo(mode.current.position);
  }

  function handleInput(event: InputEvent) {
    if (!mode || !view || summary) return;
    const events = mode.handle(event);
    if (events.length === 0) return;
    for (const ev of events) {
      switch (ev.type) {
        case 'hit':
          view.colorNotes(ev.step.position, [ev.pitch], COLOR.partial);
          break;
        case 'wrong':
          view.flash(ev.step.position, ev.step.pitches, COLOR.wrong);
          lastWrong = ev.pitch;
          break;
        case 'advance':
          view.colorNotes(ev.from.position, ev.from.pitches, ev.clean ? COLOR.clean : COLOR.fixed);
          lastWrong = null;
          if (ev.to) view.moveTo(ev.to.position);
          break;
        case 'lap': {
          const { first, last } = mode.range;
          view.clearColors(mode.steps.slice(first, last + 1).map((s) => s.position));
          view.moveTo(ev.to.position);
          break;
        }
        case 'finished':
          summary = ev.summary;
          persistSession();
          break;
      }
    }
    tick++;
  }

  onMount(() => {
    view = new ScoreView(
      viewport,
      {
        zoom: settings.score.zoom,
        pageTurn: settings.score.pageTurn,
        cursorColor: '#2f6fb3',
      },
      (s) => (vs = s),
    );
    source
      .load()
      .then((content) => view!.load(content, source.title))
      .then(() => {
        timeline = view!.timeline;
        sheetTitle = view!.osmd.Sheet.TitleString ?? '';
        startSession();
      })
      .catch((err: unknown) => (error = `Não consegui abrir a partitura: ${String(err)}`))
      .finally(() => (loading = false));
  });

  const unsubscribe = inputHub.subscribe((event) => handleInput(event));

  // o Android pode encerrar o app em segundo plano sem aviso: grava ao sair da tela
  const onHidden = () => document.visibilityState === 'hidden' && persistSession();
  document.addEventListener('visibilitychange', onHidden);

  onDestroy(() => {
    persistSession();
    document.removeEventListener('visibilitychange', onHidden);
    unsubscribe();
    view?.destroy();
  });

  /** Navegação manual (◀ ▶ / setas): pula passos sem tocar. */
  function goStep(delta: number) {
    if (!mode || !view) return;
    const from = mode.current?.index ?? mode.range.last + 1;
    mode.jumpTo(from + delta);
    lastWrong = null;
    tick++;
    if (mode.current) view.moveTo(mode.current.position);
  }

  function setHands(h: HandSelection) {
    settings.score.hands = h;
    saveSettings();
    startSession();
  }

  // ---- loop de compassos ----
  let loopPanel = $state(false);
  let loopFrom = $state(1);
  let loopTo = $state(1);
  let loopError = $state('');

  function toggleLoopPanel() {
    loopPanel = !loopPanel;
    loopError = '';
    if (loop) {
      loopFrom = loop.startMeasure + 1;
      loopTo = loop.endMeasure + 1;
    } else {
      const m = (current?.measure ?? 0) + 1;
      loopFrom = m;
      loopTo = Math.min(measureCount, m + 3);
    }
  }

  function applyLoop() {
    const a = Math.max(1, Math.min(loopFrom, loopTo));
    const b = Math.min(measureCount, Math.max(loopFrom, loopTo));
    const candidate = { startMeasure: a - 1, endMeasure: b - 1 };
    if (!loopStepRange(steps, candidate)) {
      loopError = 'Não há notas para tocar nesse trecho com a mão escolhida.';
      return;
    }
    loop = candidate;
    loopPanel = false;
    startSession();
  }

  function clearLoop() {
    loop = null;
    loopPanel = false;
    startSession();
  }

  function zoom(factor: number) {
    if (!view) return;
    const o = view.orientation;
    const z =
      Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, settings.score.zoom[o] * factor)) * 100) /
      100;
    settings.score.zoom[o] = z;
    saveSettings();
    view.setZoom(o, z);
  }

  function togglePageTurn() {
    settings.score.pageTurn = settings.score.pageTurn === 'full' ? 'half' : 'full';
    saveSettings();
    view?.setPageTurn(settings.score.pageTurn);
  }

  function toggleKeyboard() {
    settings.input.virtualKeyboard = !settings.input.virtualKeyboard;
    saveSettings();
  }

  // Toque nas bordas da partitura vira a página à mão.
  let downAt: { x: number; y: number } | null = null;
  function viewportDown(e: PointerEvent) {
    downAt = { x: e.clientX, y: e.clientY };
  }
  function viewportUp(e: PointerEvent) {
    if (!downAt || !view) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 20) return;
    const rect = viewport.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.2) view.turnPage(-1);
    else if (x > 0.8) view.turnPage(1);
  }

  function onKey(e: KeyboardEvent) {
    if (summary) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') goStep(1);
    else if (e.key === 'ArrowLeft') goStep(-1);
    else if (e.key === 'PageDown') view?.turnPage(1);
    else if (e.key === 'PageUp') view?.turnPage(-1);
    else return;
    e.preventDefault();
  }

  const press = (pitch: number) =>
    inputHub.emit({ type: 'on', pitch, velocity: 80, t: performance.now() }, 'virtual');
  const release = (pitch: number) =>
    inputHub.emit({ type: 'off', pitch, velocity: 0, t: performance.now() }, 'virtual');

  const name = (p: number) => pitchName(p, settings.naming);

  const handLabels: [HandSelection, string][] = [
    ['right', 'MD'],
    ['left', 'ME'],
    ['both', 'Ambas'],
  ];
</script>

<svelte:window onkeydown={onKey} />

<div class="reader">
  <div class="toolbar">
    <button onclick={onclose} aria-label="Voltar à biblioteca">‹</button>
    <span class="title" {title}>{title}</span>

    <span class="group">
      <button onclick={() => goStep(-1)} aria-label="Passo anterior" disabled={!mode}>◀</button>
      <span class="counter">
        {#if current}
          Passo {current.index + 1}/{steps.length} · c.{current.measure + 1}
        {:else if mode?.finished}
          Fim
        {:else}
          —
        {/if}
      </span>
      <button onclick={() => goStep(1)} aria-label="Próximo passo" disabled={!mode}>▶</button>
    </span>

    <span class="group segmented" role="group" aria-label="Mão">
      {#each handLabels as [h, label] (h)}
        <button class:active={settings.score.hands === h} onclick={() => setHands(h)}>
          {label}
        </button>
      {/each}
    </span>

    <span class="group">
      <button class:active={loop !== null} onclick={toggleLoopPanel} title="Repetir um trecho">
        {loop ? `Loop c.${loop.startMeasure + 1}–${loop.endMeasure + 1}` : 'Loop'}
      </button>
      <button onclick={startSession} title="Recomeçar a sessão" aria-label="Recomeçar">⟲</button>
      <button onclick={() => mode && (summary = mode.summary())} disabled={!mode}>Resumo</button>
    </span>

    <span class="group">
      <button onclick={() => zoom(1 / 1.15)} aria-label="Diminuir">A−</button>
      <button onclick={() => zoom(1.15)} aria-label="Aumentar">A+</button>
      <button onclick={togglePageTurn} title="Modo de virada de página">
        Virada: {settings.score.pageTurn === 'half' ? 'meia' : 'inteira'}
      </button>
      <button
        class:active={settings.input.virtualKeyboard}
        onclick={toggleKeyboard}
        aria-label="Teclado na tela">🎹</button
      >
    </span>

    <span class="status">
      {#if vs}pág. {vs.viewPage + 1}/{vs.pageCount}{#if vs.viewPage !== vs.cursorPage}
          (cursor na {vs.cursorPage + 1}){/if}{/if}
      <span class="dot" class:on={midi.status === 'ready'} title="MIDI"></span>
    </span>
  </div>

  {#if loopPanel}
    <div class="loop-panel">
      <label>
        Do compasso
        <input type="number" min="1" max={measureCount} bind:value={loopFrom} />
      </label>
      <label>
        ao
        <input type="number" min="1" max={measureCount} bind:value={loopTo} />
      </label>
      <span class="muted">(de {measureCount})</span>
      <button class="primary" onclick={applyLoop}>Repetir trecho</button>
      {#if loop}<button onclick={clearLoop}>Tirar loop</button>{/if}
      {#if loopError}<span class="error">{loopError}</span>{/if}
    </div>
  {/if}

  <div class="expected">
    <span>
      Esperado:
      {#if current}
        {#each current.pitches as p, i (p)}
          {#if i > 0}<span class="sep">·</span>{/if}
          <strong class:done={played.has(p)}>{name(p)}</strong>
        {/each}
      {:else}
        <strong>—</strong>
      {/if}
    </span>
    {#if lastWrong !== null}
      <span class="wrong">✗ tocou {name(lastWrong)}</span>
    {/if}
    <span class="muted">
      Tocando: {heldPitches.size
        ? [...heldPitches]
            .sort((a, b) => a - b)
            .map(name)
            .join(' · ')
        : '—'}
    </span>
    <span class="errors" class:has={wrongCount > 0}>Erros: {wrongCount}</span>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="viewport"
    bind:this={viewport}
    onpointerdown={viewportDown}
    onpointerup={viewportUp}
  ></div>

  {#if loading}<div class="message">Carregando partitura…</div>{/if}
  {#if error}<div class="message error">{error}</div>{/if}

  {#if settings.input.virtualKeyboard}
    <div class="kb">
      <PianoKeyboard
        low={range.low}
        high={range.high}
        active={heldPitches}
        marked={expected}
        onpress={press}
        onrelease={release}
      />
    </div>
  {/if}
</div>

{#if summary && mode}
  <SessionSummary
    {summary}
    finished={mode.finished}
    looping={mode.looping}
    onrestart={startSession}
    onclose={() => (summary = null)}
  />
{/if}

<style>
  .reader {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.75rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .toolbar button {
    min-height: 2.5rem;
    min-width: 2.5rem;
    padding: 0.2rem 0.6rem;
  }
  .title {
    font-weight: 600;
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .group {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .segmented button.active,
  button.active {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .counter {
    min-width: 8.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .status {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-variant-numeric: tabular-nums;
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
  .loop-panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding: 0.5rem 0.8rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .loop-panel input {
    width: 4.5rem;
    min-height: 2.5rem;
    font: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
  }
  .expected {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 1.5rem;
    padding: 0.3rem 0.8rem;
    font-size: 0.95rem;
    border-bottom: 1px solid var(--border);
  }
  .sep {
    margin: 0 0.3rem;
  }
  strong.done {
    color: var(--ok);
  }
  .wrong {
    color: var(--bad);
    font-weight: 600;
  }
  .errors {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }
  .errors.has {
    color: var(--bad);
  }
  .viewport {
    flex: 1;
    min-height: 0;
  }
  .kb {
    padding: 0.3rem 0.3rem calc(0.3rem + env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--border);
  }
  .message {
    position: fixed;
    top: 40%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem 1.5rem;
    z-index: 10;
  }
  .error {
    color: var(--bad);
  }
</style>
