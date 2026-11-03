<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { pitchName } from '../core/pitch';
  import { heldPitches } from '../input/held.svelte';
  import { inputHub } from '../input/hub';
  import { midi } from '../input/midi.svelte';
  import { ScoreView, type ScoreViewState } from '../score/ScoreView';
  import { buildSteps, stepAtOrAfter } from '../score/steps';
  import type { HandSelection, TimelinePosition } from '../score/types';
  import type { ScoreSource } from './Library.svelte';
  import PianoKeyboard from './PianoKeyboard.svelte';
  import { saveSettings, settings, ZOOM_MAX, ZOOM_MIN } from './settings.svelte';

  let { source, onclose }: { source: ScoreSource; onclose: () => void } = $props();

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
  const stepIndex = $derived(vs ? stepAtOrAfter(steps, vs.position) : -1);
  const step = $derived(stepIndex >= 0 ? steps[stepIndex] : undefined);
  const expected = $derived(new Set(step?.pitches ?? []));
  const range = $derived(
    settings.input.virtualRange === 'full' ? { low: 36, high: 96 } : { low: 48, high: 84 },
  );

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
        const first = buildSteps(timeline, settings.score.hands)[0];
        if (first) view!.moveTo(first.position);
      })
      .catch((err: unknown) => (error = `Não consegui abrir a partitura: ${String(err)}`))
      .finally(() => (loading = false));
  });

  onDestroy(() => view?.destroy());

  function goStep(delta: number) {
    if (!view || steps.length === 0) return;
    // se o cursor não está exatamente num passo, "voltar" vai para o passo anterior a ele
    const current = stepIndex === -1 ? steps.length : stepIndex;
    const onStep = step?.position === vs?.position;
    const target = delta > 0 ? (onStep ? current + 1 : current) : current - 1;
    const s = steps[Math.min(steps.length - 1, Math.max(0, target))];
    if (s) view.moveTo(s.position);
  }

  function setHands(h: HandSelection) {
    settings.score.hands = h;
    saveSettings();
    // reposiciona no passo mais próximo para a nova seleção de mão
    const s = buildSteps(timeline, h);
    const i = stepAtOrAfter(s, vs?.position ?? 0);
    const target = s[i === -1 ? s.length - 1 : i];
    if (target) view?.moveTo(target.position);
  }

  function zoom(factor: number) {
    if (!view) return;
    const o = view.orientation;
    const current = settings.score.zoom[o];
    const z = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * factor)) * 100) / 100;
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
    if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') goStep(1);
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
      <button onclick={() => goStep(-1)} aria-label="Passo anterior" disabled={!vs}>◀</button>
      <span class="counter">
        {#if step}
          Passo {stepIndex + 1}/{steps.length} · c.{step.measure + 1}
        {:else}
          —
        {/if}
      </span>
      <button onclick={() => goStep(1)} aria-label="Próximo passo" disabled={!vs}>▶</button>
    </span>

    <span class="group segmented" role="group" aria-label="Mão">
      {#each handLabels as [h, label] (h)}
        <button class:active={settings.score.hands === h} onclick={() => setHands(h)}
          >{label}</button
        >
      {/each}
    </span>

    <span class="group">
      <button onclick={() => zoom(1 / 1.15)} aria-label="Diminuir">A−</button>
      <button onclick={() => zoom(1.15)} aria-label="Aumentar">A+</button>
    </span>

    <span class="group">
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

  <div class="expected">
    <span>
      Esperado:
      <strong
        >{step ? step.pitches.map((p) => pitchName(p, settings.naming)).join(' · ') : '—'}</strong
      >
    </span>
    <span class="muted">
      Tocando: {heldPitches.size
        ? [...heldPitches]
            .sort((a, b) => a - b)
            .map((p) => pitchName(p, settings.naming))
            .join(' · ')
        : '—'}
    </span>
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
  .expected {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.5rem;
    padding: 0.3rem 0.8rem;
    font-size: 0.95rem;
    border-bottom: 1px solid var(--border);
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
