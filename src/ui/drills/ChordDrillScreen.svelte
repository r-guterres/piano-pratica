<script lang="ts">
  // Treino de acordes: o app pede um acorde numa inversão e confere pelo
  // teclado as notas presas e a nota do baixo. Os acordes vêm da fase atual.
  import { onDestroy } from 'svelte';
  import { pitchName } from '../../core/pitch';
  import { ChordDrill, type ChordAnswer } from '../../drills/chordDrill';
  import { heldPitches } from '../../input/held.svelte';
  import { inputHub } from '../../input/hub';
  import {
    INVERSION_NAMES,
    inversionVoicing,
    noteLetter,
    noteSolfege,
  } from '../../practice/chords';
  import { CHORDS_BY_PHASE, PHASES } from '../../trail/content';
  import PianoKeyboard from '../PianoKeyboard.svelte';
  import { settings } from '../settings.svelte';
  import { loadTrail, trail } from '../trail.svelte';
  import { chordEvents, exerciseSaver, playEvents, stopSound } from './support';

  let drill = $state.raw<ChordDrill | null>(null);
  let tick = $state(0);
  let answer = $state<ChordAnswer | null>(null);
  let revealed = $state(false);
  let warning = $state('');
  let save: ReturnType<typeof exerciseSaver> | null = null;

  void loadTrail().then(() => {
    const phase = trail.s?.phase ?? 0;
    drill = new ChordDrill(CHORDS_BY_PHASE[Math.min(phase, CHORDS_BY_PHASE.length - 1)]!);
    save = exerciseSaver('chords', `fase ${phase}`);
  });

  const q = $derived((void tick, drill?.question ?? null));
  // cópia: o objeto do treino é o mesmo, e o $derived só nota um valor novo
  const stats = $derived((void tick, drill ? { ...drill.stats } : null));
  const label = $derived(
    q ? (q.inv ? `${q.chord.display}/${noteLetter(q.chord.tones[q.inv]!)}` : q.chord.display) : '',
  );
  const voicing = $derived(q ? new Set(inversionVoicing(q.chord, q.inv)) : undefined);
  const heldNames = $derived(
    [...heldPitches].sort((a, b) => a - b).map((p) => pitchName(p, settings.naming)),
  );

  // confere 220 ms depois da última mudança nas teclas presas (o acorde "assentou")
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const held = [...heldPitches];
    clearTimeout(timer);
    if (!drill || drill.done) return;
    timer = setTimeout(() => {
      const r = drill!.check(held);
      if (r === null) return;
      answer = r;
      tick++;
      if (r === 'correct') {
        save?.(drill!.stats);
        setTimeout(next, 900);
      }
    }, 220);
  });

  function next() {
    if (!drill) return;
    drill.next();
    answer = null;
    revealed = false;
    tick++;
  }

  function skip() {
    drill?.skip();
    if (drill) save?.(drill.stats);
    answer = null;
    revealed = false;
    tick++;
  }

  function listen() {
    if (!q) return;
    warning = playEvents(chordEvents([...voicing!]), 4000).warning;
  }

  function reveal() {
    drill?.reveal();
    revealed = true;
    listen();
  }

  const press = (pitch: number) =>
    inputHub.emit({ type: 'on', pitch, velocity: 80, t: performance.now() }, 'virtual');
  const release = (pitch: number) =>
    inputHub.emit({ type: 'off', pitch, velocity: 0, t: performance.now() }, 'virtual');

  onDestroy(() => {
    clearTimeout(timer);
    stopSound();
  });
</script>

<section class="card drill">
  <div class="head">
    <h2>Acordes</h2>
    {#if stats}
      <span class="muted">
        {stats.correct} certos ({stats.firstTry} de primeira){stats.skipped
          ? ` · ${stats.skipped} pulados`
          : ''}
      </span>
    {/if}
  </div>
  {#if !q}
    <p class="muted">Carregando…</p>
  {:else}
    <p class="muted small">
      Monte o acorde no teclado, na inversão pedida. O app confere as notas e qual fica no baixo
      (pode dobrar notas e usar as duas mãos). Acordes da {PHASES[trail.s?.phase ?? 0]?.name}.
    </p>
    <div class="big">{label}</div>
    <p>
      <b>{q.chord.name}</b> · {INVERSION_NAMES[q.inv]}{q.inv
        ? ` (${noteSolfege(q.chord.tones[q.inv]!)} no baixo)`
        : ''}
    </p>
    <div class="feedback" class:ok={answer === 'correct'} class:no={answer && answer !== 'correct'}>
      {#if answer === 'correct'}
        Certo!
      {:else if answer === 'wrong-bass'}
        As notas estão certas; falta a nota certa no baixo.
      {:else if answer === 'wrong'}
        Ainda não. Você está tocando: {heldNames.join(' · ') || '—'}
      {/if}
    </div>
    <div class="kb">
      <PianoKeyboard
        low={48}
        high={84}
        active={heldPitches}
        marked={revealed || answer === 'correct' ? voicing : undefined}
        onpress={press}
        onrelease={release}
      />
    </div>
    {#if revealed}
      <p class="muted">Notas: {q.chord.tones.map(noteSolfege).join(' · ')}</p>
    {/if}
    <div class="row">
      <button onclick={reveal} disabled={revealed}>Mostrar resposta</button>
      <button onclick={listen}>Ouvir</button>
      <button onclick={skip}>Pular</button>
    </div>
    {#if warning}<p class="warn">{warning}</p>{/if}
  {/if}
</section>

<style>
  .drill {
    display: grid;
    gap: 0.6rem;
  }
  .drill p {
    margin: 0;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
  }
  .big {
    font-size: 2.6rem;
    font-weight: 700;
  }
  .feedback {
    min-height: 1.5em;
    font-weight: 700;
  }
  .feedback.ok {
    color: var(--ok);
  }
  .feedback.no {
    color: var(--bad);
  }
  .kb {
    overflow-x: auto;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .small {
    font-size: 0.9rem;
  }
  .warn {
    color: var(--warn);
  }
</style>
