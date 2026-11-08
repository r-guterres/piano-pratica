<script lang="ts">
  // Ler e tocar: um trecho curto na pauta para tocar no tempo, depois de uma
  // contagem de 4 tempos. O app avalia cada nota (no tempo, adiantada,
  // atrasada, perdida) como no modo acompanhar.
  // Sessão: escolher o modo → ▶ Começar → ■ Encerrar → resumo.
  import { onDestroy } from 'svelte';
  import type { InputEvent } from '../../core/events';
  import { pitchName } from '../../core/pitch';
  import {
    makePassage,
    passageEvents,
    passageExpected,
    passageMs,
    SIGHT_MODES,
    type Passage,
    type SightMode,
  } from '../../drills/sightReading';
  import { inputHub } from '../../input/hub';
  import type { PlaybackEvent, Schedule } from '../../playback/schedule';
  import { RhythmJudge, WINDOW_MS, type RhythmEvent } from '../../practice/rhythm';
  import { fontsReady } from '../drillStaff';
  import { settings } from '../settings.svelte';
  import { loadTrail, trail } from '../trail.svelte';
  import { drawPassage } from './passageStaff';
  import { DrillSession } from './session.svelte';
  import SessionBar from './SessionBar.svelte';
  import SessionSummary from './SessionSummary.svelte';
  import { exerciseSaver, playEvents, playSchedule, stopSound } from './support';

  void loadTrail();
  const session = new DrillSession('sight');

  const COLOR = { ontime: '#2e7d32', off: '#e65100', missed: '#9e2b25' };

  let mode = $state<SightMode>('treble');
  let count = $state(6);
  let bpm = $state(70);
  let extended = $state(false);
  let metronome = $state(true);
  let showNames = $state(false);
  let passage = $state.raw<Passage | null>(null);
  let colors = $state<Record<number, string>>({});
  let playing = $state(false);
  let beat = $state<number | null>(null);
  let lastWrong = $state('');
  let result = $state<{ text: string; ok: boolean } | null>(null);
  let warning = $state('');
  let stats = $state({ answered: 0, correct: 0, firstTry: 0 });
  /** Notas da sessão: no tempo e todas. */
  let notes = $state({ ontime: 0, total: 0 });
  let save: ReturnType<typeof exerciseSaver> | null = null;

  let staffEl = $state<HTMLDivElement | undefined>();
  let fontsLoaded = $state(false);
  void fontsReady.then(() => (fontsLoaded = true));

  function newPassage() {
    stop();
    passage = makePassage(mode, {
      phase: trail.s?.phase ?? 0,
      count,
      extended,
      previous: passage,
    });
    colors = {};
    result = null;
    lastWrong = '';
  }

  function start() {
    stats = { answered: 0, correct: 0, firstTry: 0 };
    notes = { ontime: 0, total: 0 };
    save = exerciseSaver('sight', mode);
    passage = null;
    newPassage();
    session.start();
  }

  function finishSession() {
    stop();
    if (stats.answered) save?.(stats);
    session.finish();
  }

  $effect(() => {
    if (staffEl && passage && fontsLoaded) drawPassage(staffEl, passage, colors, showNames);
  });

  // ---- tocar no tempo ----
  let judge: RhythmJudge | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;

  function apply(events: RhythmEvent[]) {
    for (const e of events) {
      if (e.type === 'hit')
        colors[e.note.position] = e.timing === 'ontime' ? COLOR.ontime : COLOR.off;
      else if (e.type === 'missed') colors[e.note.position] = COLOR.missed;
      else if (e.type === 'wrong') lastWrong = `✗ tocou ${pitchName(e.pitch, settings.naming)}`;
    }
  }

  const unsubscribe = inputHub.subscribe((e: InputEvent) => {
    if (judge && e.type === 'on') apply(judge.handle(e));
  });

  function play() {
    if (!passage) return;
    stop();
    colors = {};
    result = null;
    lastWrong = '';
    const beatMs = 60_000 / bpm;
    const click = (k: number, accent: boolean): PlaybackEvent => ({
      t: k * beatMs,
      kind: 'click',
      accent,
      beat: k % 4,
    });
    const beats = passage.upper.length;
    const schedule: Schedule = {
      countIn: [0, 1, 2, 3].map((k) => click(k, k === 0)),
      countInMs: 4 * beatMs,
      body: metronome ? Array.from({ length: beats }, (_, k) => click(k, k % 4 === 0)) : [],
      bodyMs: passageMs(passage, bpm),
      expected: passageExpected(passage, bpm),
    };
    const { player, warning: w } = playSchedule(schedule, {
      clicks: true,
      onVisual: (e) => {
        if (e.kind === 'click') beat = e.beat;
        if (judge) apply(judge.advance(performance.now()));
      },
      onEnd: () => {
        beat = null;
        finishTimer = setTimeout(judgePassage, WINDOW_MS + 100);
      },
    });
    warning = w;
    judge = new RhythmJudge(schedule.expected, {
      origin: player.bodyOrigin,
      bodyMs: schedule.bodyMs,
      loop: false,
    });
    playing = true;
    // só em `npm run dev`: permite a testes de navegador tocar "no tempo"
    if (import.meta.env.DEV)
      (window as unknown as { __sight: unknown }).__sight = {
        origin: player.bodyOrigin,
        expected: schedule.expected,
      };
  }

  function judgePassage() {
    if (!judge) return;
    apply(judge.advance(performance.now() + 10_000));
    const r = judge.summary();
    judge = null;
    playing = false;
    const ok = r.missed === 0 && r.wrong === 0;
    const clean = ok && r.early === 0 && r.late === 0;
    stats.answered++;
    if (ok) stats.correct++;
    if (clean) stats.firstTry++;
    notes.ontime += r.ontime;
    notes.total += r.ontime + r.early + r.late + r.missed;
    save?.(stats);
    result = {
      ok,
      text: clean
        ? 'Todas as notas certas e no tempo!'
        : ok
          ? `Notas certas; ${r.early + r.late} fora do tempo (adiantadas ${r.early}, atrasadas ${r.late}).`
          : `No tempo ${r.ontime} · fora do tempo ${r.early + r.late} · erradas ${r.wrong} · perdidas ${r.missed}.`,
    };
  }

  function stop() {
    clearTimeout(finishTimer);
    stopSound();
    judge = null;
    playing = false;
    beat = null;
  }

  function listen() {
    if (!passage) return;
    stop();
    warning = playEvents(passageEvents(passage, bpm), passageMs(passage, bpm) + 500).warning;
  }

  const pct = (a: number, t: number) => (t ? `${Math.round((100 * a) / t)}%` : '—');

  onDestroy(() => {
    if (session.phase === 'running' && stats.answered) save?.(stats);
    session.dispose();
    stop();
    unsubscribe();
  });
</script>

<section class="card drill">
  <h2>Ler e tocar</h2>
  {#if session.phase === 'setup'}
    <div class="row">
      {#each Object.entries(SIGHT_MODES) as [m, label] (m)}
        <button class:primary={mode === m} onclick={() => (mode = m as SightMode)}>{label}</button>
      {/each}
    </div>
    <p class="muted small">
      Em cada trecho, toque em ▶ Tocar: depois de 4 tempos de contagem, leia e toque no tempo, sem
      parar para corrigir. Verde = no tempo, laranja = adiantada ou atrasada, vermelho = perdida.
    </p>
    <div class="row settings">
      <label class="inline">
        Andamento
        <input
          type="number"
          min="40"
          max="160"
          step="5"
          bind:value={bpm}
          disabled={playing}
          class="bpm"
        /> bpm
      </label>
      {#if mode !== 'both'}
        <span class="inline">
          Notas:
          {#each [4, 6, 8] as n (n)}
            <button
              class="small"
              class:primary={count === n}
              onclick={() => {
                count = n;
                newPassage();
              }}>{n}</button
            >
          {/each}
        </span>
      {/if}
      <label class="inline">
        <input type="checkbox" bind:checked={metronome} disabled={playing} /> Metrônomo
      </label>
      <label class="inline">
        <input type="checkbox" bind:checked={extended} onchange={newPassage} disabled={playing} /> Extensão
        ampliada
      </label>
      <label class="inline">
        <input type="checkbox" bind:checked={showNames} /> Nomes das notas
      </label>
    </div>
    <div class="row">
      <button class="primary" onclick={start}>▶ Começar</button>
      {#if session.goal}
        <span class="muted small">Meta do bloco: {session.goal.minutes} min</span>
      {/if}
    </div>
  {:else if session.phase === 'summary'}
    <SessionSummary
      {session}
      onagain={start}
      tiles={[
        { value: stats.answered, label: 'trechos' },
        { value: stats.correct, label: 'certos' },
        { value: stats.firstTry, label: 'todos no tempo' },
        { value: pct(notes.ontime, notes.total), label: 'das notas no tempo' },
      ]}
    >
      <p class="muted">{SIGHT_MODES[mode]} · {bpm} bpm</p>
    </SessionSummary>
  {:else}
    <SessionBar {session} onfinish={finishSession}>
      <span class="muted"
        >{SIGHT_MODES[mode]} · {stats.correct} de {stats.answered} certos · {stats.firstTry} no tempo</span
      >
    </SessionBar>

    <div class="staff" bind:this={staffEl}></div>

    <div class="row">
      {#if playing}
        <button class="primary" onclick={stop}>■ Parar</button>
      {:else}
        <button class="primary" onclick={play}>▶ Tocar</button>
      {/if}
      <button onclick={listen} disabled={playing}>Ouvir</button>
      <button onclick={newPassage}>Outro trecho</button>
      {#if beat !== null}
        <span class="beats">
          {#each [0, 1, 2, 3] as i (i)}<i class:on={beat === i}></i>{/each}
        </span>
      {/if}
    </div>
    {#if lastWrong && playing}<p class="bad">{lastWrong}</p>{/if}
    {#if result}<p class="result" class:ok={result.ok}>{result.text}</p>{/if}
    <div class="row settings">
      <label class="inline">
        Andamento
        <input
          type="number"
          min="40"
          max="160"
          step="5"
          bind:value={bpm}
          disabled={playing}
          class="bpm"
        /> bpm
      </label>
      {#if mode !== 'both'}
        <span class="inline">
          Notas:
          {#each [4, 6, 8] as n (n)}
            <button
              class="small"
              class:primary={count === n}
              onclick={() => {
                count = n;
                newPassage();
              }}>{n}</button
            >
          {/each}
        </span>
      {/if}
      <label class="inline">
        <input type="checkbox" bind:checked={metronome} disabled={playing} /> Metrônomo
      </label>
      <label class="inline">
        <input type="checkbox" bind:checked={extended} onchange={newPassage} disabled={playing} /> Extensão
        ampliada
      </label>
      <label class="inline">
        <input type="checkbox" bind:checked={showNames} /> Nomes das notas
      </label>
    </div>
  {/if}
  {#if warning}<p class="warn">{warning}</p>{/if}
</section>

<style>
  .drill {
    display: grid;
    gap: 0.6rem;
  }
  .drill p {
    margin: 0;
  }
  h2 {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .staff {
    background: #fff;
    border-radius: 8px;
    overflow-x: auto;
    color: #000;
  }
  .inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .bpm {
    width: 5rem;
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
  .result {
    font-weight: 700;
    color: var(--bad);
  }
  .result.ok {
    color: var(--ok);
  }
  .bad {
    color: var(--bad);
  }
  .small {
    font-size: 0.9rem;
  }
  .warn {
    color: var(--warn);
  }
</style>
