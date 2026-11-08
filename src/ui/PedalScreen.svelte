<script lang="ts">
  // Treino de pedal sincopado: o aluno toca uma progressão (um acorde por
  // compasso) e a cada troca o app diz se o pedal subiu e desceu na hora certa
  // e se o acorde tocado era o pedido. No modo livre, qualquer acorde vale.
  import { pitchName } from '../core/pitch';
  import { onDestroy } from 'svelte';
  import type { InputEvent } from '../core/events';
  import { inputHub } from '../input/hub';
  import { makeOutputs } from '../playback/outputs';
  import { Player } from '../playback/player';
  import { metronomeSchedule } from '../playback/schedule';
  import { audioContext } from '../playback/sinks';
  import { checkChord, nameChord, parseChord, type ChordCheck } from '../practice/chords';
  import { analyzePedal, chordAttacks, VERDICT_TEXT, type PedalVerdict } from '../practice/pedal';
  import { appHistory, newId } from '../storage/history';
  import RecordButton from './RecordButton.svelte';
  import { settings } from './settings.svelte';

  const FREE = 'livre';
  const PROGRESSIONS = ['C F G C', 'C G Am F', 'C Am F G', 'Am Dm E Am', FREE];
  const WINDOW_MS = 8000;

  let progression = $state(PROGRESSIONS[0]!);
  let running = $state(false);
  let events = $state.raw<InputEvent[]>([]);
  let now = $state(performance.now());
  let startedAt = 0;
  let sessionId = '';
  let saved = $state('');

  let bpm = $state(60);
  let metronome = $state(true);
  let player: Player | null = null;
  let beat = $state<number | null>(null);
  let clock: ReturnType<typeof setInterval> | undefined;

  const free = $derived(progression === FREE);
  const chords = $derived(free ? [] : progression.split(' '));
  const changes = $derived(analyzePedal(events, now));
  const played = $derived(chordAttacks(events));
  const attacks = $derived(played.length);
  const nextChord = $derived(chords[attacks % chords.length]);
  /** Conferência de cada acorde tocado (null no modo livre). */
  const checks = $derived(
    free
      ? []
      : played.map((a, k) => checkChord(parseChord(chords[k % chords.length]!)!, a.pitches)),
  );
  const chordsOk = $derived(checks.filter((c) => c.ok).length);
  const lastPlayed = $derived(played.at(-1));

  const noteName = (pc: number) => pitchName(60 + pc, settings.naming).replace(/-?\d+$/, '');
  const playedName = (pitches: number[]) =>
    nameChord(pitches) ?? pitches.map((p) => pitchName(p, settings.naming)).join(' ');
  function checkText(c: ChordCheck): string {
    if (c.ok) return '✓';
    const parts = [];
    if (c.missing.length) parts.push('faltou ' + c.missing.map(noteName).join(', '));
    if (c.extra.length) parts.push('sobrou ' + c.extra.map(noteName).join(', '));
    return '✗ ' + parts.join('; ');
  }
  /** Nome da troca na lista: o pedido ou, no modo livre, o que foi tocado. */
  const label = (k: number) =>
    free ? playedName(played[k]?.pitches ?? []) : chords[k % chords.length]!;
  const ok = $derived(changes.filter((c) => c.verdict === 'ok').length);
  const worst = $derived.by(() => {
    const counts: Partial<Record<PedalVerdict, number>> = {};
    for (const c of changes)
      if (c.verdict !== 'ok') counts[c.verdict] = (counts[c.verdict] ?? 0) + 1;
    return (
      (Object.entries(counts) as [PedalVerdict, number][]).sort((a, b) => b[1] - a[1])[0] ?? null
    );
  });

  const unsubscribe = inputHub.subscribe((e) => {
    if (!running) return;
    events = [...events, e];
  });

  function start() {
    events = [];
    saved = '';
    startedAt = Date.now();
    sessionId = newId();
    running = true;
    clock = setInterval(() => (now = performance.now()), 200);
    if (metronome) {
      audioContext();
      player = new Player(
        makeOutputs({ clicks: true, notes: false }),
        (e) => {
          if (e.kind === 'click') beat = e.beat;
        },
        () => {},
      );
      player.start(metronomeSchedule(bpm, 4, 4), true);
    }
  }

  function stop() {
    running = false;
    clearInterval(clock);
    player?.stop();
    player = null;
    beat = null;
    now = performance.now() + 10_000; // decide a última troca
    persist();
  }

  function persist() {
    const list = analyzePedal(events, now);
    if (!list.length) return;
    const verdicts: Partial<Record<PedalVerdict, number>> = {};
    for (const c of list) verdicts[c.verdict] = (verdicts[c.verdict] ?? 0) + 1;
    appHistory()
      .savePedalSession({
        id: sessionId,
        startedAt,
        durationMs: Date.now() - startedAt,
        progression,
        changes: list.length,
        ok: verdicts.ok ?? 0,
        verdicts,
        ...(free ? {} : { chords: checks.length, chordsOk }),
      })
      .then(() => (saved = 'Sessão salva no histórico.'))
      .catch((err: unknown) => console.warn('Não consegui salvar o treino de pedal:', err));
  }

  const onHidden = () => document.visibilityState === 'hidden' && running && stop();
  document.addEventListener('visibilitychange', onHidden);
  onDestroy(() => {
    if (running) stop();
    unsubscribe();
    document.removeEventListener('visibilitychange', onHidden);
  });

  // ---- linha do tempo (últimos 8 s): teclas presas e pedal abaixado ----
  const W = 600;
  const H = 96;
  const LANE = { keys: 26, pedal: 66 };
  const timeline = $derived.by(() => {
    const end = running ? now : (events.at(-1)?.t ?? now) + 500;
    const t0 = end - WINDOW_MS;
    const x = (t: number) => ((t - t0) / WINDOW_MS) * W;
    const keys: [number, number][] = [];
    const pedal: [number, number][] = [];
    // teclas presas agora (contagem por altura)
    const held: Record<number, boolean> = {};
    let heldCount = 0;
    let keyStart: number | null = null;
    let pedalStart: number | null = null;
    for (const e of events) {
      if (e.type === 'pedal') {
        if (e.down && pedalStart === null) pedalStart = e.t;
        else if (!e.down && pedalStart !== null) {
          pedal.push([pedalStart, e.t]);
          pedalStart = null;
        }
        continue;
      }
      if (e.type === 'on') {
        if (heldCount === 0) keyStart = e.t;
        if (!held[e.pitch]) heldCount++;
        held[e.pitch] = true;
      } else {
        if (held[e.pitch]) heldCount--;
        held[e.pitch] = false;
        if (heldCount === 0 && keyStart !== null) {
          keys.push([keyStart, e.t]);
          keyStart = null;
        }
      }
    }
    if (keyStart !== null) keys.push([keyStart, end]);
    if (pedalStart !== null) pedal.push([pedalStart, end]);
    const bar = ([a, b]: [number, number]) => ({
      x: Math.max(0, x(a)),
      w: Math.max(2, x(b) - Math.max(0, x(a))),
    });
    return {
      keys: keys.filter(([, b]) => b > t0).map(bar),
      pedal: pedal.filter(([, b]) => b > t0).map(bar),
      marks: changes
        .filter((c) => c.to.t > t0)
        .map((c) => ({ x: x(c.to.t), ok: c.verdict === 'ok' })),
    };
  });

  const ms = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v)} ms`);
</script>

<section class="card pedal">
  <h2>Pedal sincopado</h2>
  <p class="muted">
    Toque um acorde por compasso. Na troca, <b
      >levante o pedal no instante em que tocar o novo acorde</b
    >
    e pise de novo logo depois, com as teclas ainda presas. O app avalia cada troca e confere os acordes
    (em qualquer inversão); no modo <b>livre</b>, vale qualquer acorde.
  </p>

  <div class="row">
    <label>
      Progressão
      <select bind:value={progression} disabled={running}>
        {#each PROGRESSIONS as p (p)}
          <option value={p}>{p === FREE ? 'Livre (qualquer acorde)' : p}</option>
        {/each}
      </select>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={metronome} disabled={running} />
      Metrônomo
    </label>
    <label>
      Andamento
      <span class="bpm">
        <button onclick={() => (bpm = Math.max(30, bpm - 5))} disabled={running}>−</button>
        <b>{bpm}</b> bpm
        <button onclick={() => (bpm = Math.min(160, bpm + 5))} disabled={running}>+</button>
      </span>
    </label>
    <button class="primary" onclick={() => (running ? stop() : start())}>
      {running ? '■ Encerrar' : '▶ Começar'}
    </button>
    <RecordButton title={free ? 'Pedal (livre)' : `Pedal: ${progression}`} />
  </div>

  {#if running || events.length}
    <div class="now">
      {#each chords as c, i (i)}
        <span class="chord" class:next={running && i === attacks % chords.length}>{c}</span>
      {/each}
      {#if running && !free}<span class="muted">próximo: <b>{nextChord}</b></span>{/if}
      {#if lastPlayed}
        {@const check = checks.at(-1)}
        <span class:bad={check && !check.ok} class:good={check?.ok}>
          tocou <b>{playedName(lastPlayed.pitches)}</b>
          {#if check}{checkText(check)}{/if}
        </span>
      {/if}
      {#if beat !== null}
        <span class="beats">
          {#each [0, 1, 2, 3] as i (i)}<i class:on={beat === i}></i>{/each}
        </span>
      {/if}
    </div>

    <div class="legend">
      <span><i style:background="var(--series-1)"></i>teclas presas</span>
      <span><i style:background="var(--series-2)"></i>pedal abaixado</span>
      <span class="muted">traço = troca de acorde (verde certo, vermelho com problema)</span>
    </div>
    <svg
      viewBox="0 0 {W} {H}"
      class="timeline"
      role="img"
      aria-label="Teclas e pedal nos últimos 8 segundos"
    >
      <text x="2" y={LANE.keys - 14} class="axis">teclas</text>
      <text x="2" y={LANE.pedal - 14} class="axis">pedal</text>
      {#each timeline.keys as b, i (i)}
        <rect x={b.x} y={LANE.keys - 8} width={b.w} height="16" rx="3" fill="var(--series-1)" />
      {/each}
      {#each timeline.pedal as b, i (i)}
        <rect x={b.x} y={LANE.pedal - 8} width={b.w} height="16" rx="3" fill="var(--series-2)" />
      {/each}
      {#each timeline.marks as m, i (i)}
        <line
          x1={m.x}
          x2={m.x}
          y1="6"
          y2={H - 4}
          stroke={m.ok ? 'var(--ok)' : 'var(--bad)'}
          stroke-width="2"
        />
      {/each}
    </svg>

    {#if changes.length}
      <p class="score">
        Trocas certas: <b>{ok}</b> de {changes.length} ({Math.round((100 * ok) / changes.length)}%)
        {#if worst}<span class="muted"> · mais comum: {VERDICT_TEXT[worst[0]]}</span>{/if}
      </p>
      {#if !free && checks.length}
        <p class="score">
          Acordes certos: <b>{chordsOk}</b> de {checks.length}
        </p>
      {/if}
      <ol class="changes" reversed>
        {#each changes.slice(-8).toReversed() as c (c.index)}
          <li class:ok={c.verdict === 'ok'}>
            <b>{label(c.index - 1)} → {label(c.index)}</b>: pedal
            {c.verdict === 'ok'
              ? c.sameChord && c.liftMs === null
                ? '✓ mesmo acorde, pedal mantido'
                : '✓ certo'
              : `✗ ${VERDICT_TEXT[c.verdict]}`}
            <span class="muted">(subiu {ms(c.liftMs)}, desceu {ms(c.pressMs)})</span>
            {#if checks[c.index] && !checks[c.index]!.ok}
              <span class="chord-bad"
                >· acorde {checkText(checks[c.index]!)} (tocou {playedName(
                  played[c.index]!.pitches,
                )})</span
              >
            {/if}
          </li>
        {/each}
      </ol>
    {:else if running}
      <p class="muted">
        Toque o primeiro acorde e pise o pedal; a avaliação começa na primeira troca.
      </p>
    {/if}
    {#if saved}<p class="muted">{saved}</p>{/if}
  {/if}
</section>

<style>
  .pedal {
    display: grid;
    gap: 0.75rem;
  }
  .pedal p {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    align-items: end;
  }
  label {
    display: inline-flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  label.check {
    flex-direction: row;
    align-items: center;
    min-height: 2.75rem;
  }
  .bpm {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .now {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .chord {
    padding: 0.3rem 0.7rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    font-weight: 600;
  }
  .chord.next {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .beats {
    display: inline-flex;
    gap: 0.3rem;
  }
  .beats i {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    border: 2px solid var(--border);
  }
  .beats i.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
    font-size: 0.85rem;
  }
  .legend i {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    margin-right: 0.35rem;
  }
  .timeline {
    width: 100%;
    height: auto;
    background: var(--surface-2);
    border-radius: 8px;
  }
  .axis {
    fill: var(--muted);
    font-size: 11px;
  }
  .score {
    font-size: 1.05rem;
  }
  .changes {
    margin: 0;
    padding-left: 1.5rem;
    display: grid;
    gap: 0.3rem;
  }
  .changes li {
    color: var(--bad);
  }
  .changes li.ok {
    color: var(--ok);
  }
  .changes .muted {
    font-size: 0.85rem;
  }
  .changes li.ok .chord-bad,
  .bad {
    color: var(--bad);
  }
  .good {
    color: var(--ok);
  }
</style>
