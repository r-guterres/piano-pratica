<script lang="ts">
  // Treino de acordes: o app pede um acorde e confere pelo teclado as notas
  // presas e a nota do baixo. Exercícios: os acordes da fase (sorteados, em
  // inversão sorteada) ou o do tópico de harmonia (uma progressão em ordem).
  // Sessão: escolher → ▶ Começar → ■ Encerrar → resumo.
  import { onDestroy } from 'svelte';
  import { pitchName } from '../../core/pitch';
  import { ChordDrill, type ChordAnswer } from '../../drills/chordDrill';
  import { CHORD_PRESETS } from '../../drills/chordPresets';
  import { heldPitches } from '../../input/held.svelte';
  import { inputHub } from '../../input/hub';
  import { INVERSION_NAMES, inversionVoicing, noteSolfege } from '../../practice/chords';
  import { CHORDS_BY_PHASE, PHASES, type Topic } from '../../trail/content';
  import PianoKeyboard from '../PianoKeyboard.svelte';
  import { settings } from '../settings.svelte';
  import { loadTrail, trail } from '../trail.svelte';
  import { DrillSession } from './session.svelte';
  import SessionBar from './SessionBar.svelte';
  import SessionSummary from './SessionSummary.svelte';
  import { chordEvents, exerciseSaver, playEvents, stopSound } from './support';

  void loadTrail();
  const session = new DrillSession('chords');

  const phase = $derived(trail.s?.phase ?? 0);
  const topicTitle = (id: string): string => {
    for (const f of PHASES) {
      const t = f.harmony.find((x: Topic) => x.id === id);
      if (t) return t.title;
    }
    return id;
  };
  // os exercícios da fase atual, mais o do bloco do Hoje (se for de outra fase)
  const presets = $derived(
    CHORD_PRESETS.filter(
      (p) =>
        PHASES[phase]?.harmony.some((t) => t.id === p.topic) || p.topic === session.goal?.topic,
    ),
  );
  /** Tópico do exercício escolhido; null = acordes da fase. */
  let choiceTopic = $state<string | null>(
    CHORD_PRESETS.find((p) => p.topic === session.goal?.topic)?.topic ?? null,
  );
  const choice = $derived(CHORD_PRESETS.find((p) => p.topic === choiceTopic) ?? null);

  let drill = $state.raw<ChordDrill | null>(null);
  let tick = $state(0);
  let answer = $state<ChordAnswer | null>(null);
  let revealed = $state(false);
  let warning = $state('');
  let save: ReturnType<typeof exerciseSaver> | null = null;

  function start() {
    const symbols = choice?.chords ?? CHORDS_BY_PHASE[Math.min(phase, CHORDS_BY_PHASE.length - 1)]!;
    drill = new ChordDrill(symbols, Math.random, choice ?? {});
    save = exerciseSaver('chords', choice?.topic ?? `fase ${phase}`);
    answer = null;
    revealed = false;
    tick++;
    session.start();
  }

  function persist() {
    if (drill) save?.({ ...drill.stats, trouble: drill.trouble });
  }

  function finish() {
    clearTimeout(timer);
    clearTimeout(nextTimer);
    stopSound();
    persist();
    session.finish();
    tick++;
  }

  const q = $derived((void tick, drill?.question ?? null));
  // cópia: o objeto do treino é o mesmo, e o $derived só nota um valor novo
  const stats = $derived((void tick, drill ? { ...drill.stats } : null));
  const voicing = $derived(q ? new Set(inversionVoicing(q.chord, q.inv ?? 0)) : undefined);
  // o que foi tocado na última tentativa (continua visível depois de soltar)
  const attemptNames = $derived(
    (void tick, drill?.lastAttempt ?? []).map((p) => pitchName(p, settings.naming)),
  );
  const trouble = $derived(
    (void tick, Object.entries(drill?.trouble ?? {}).sort((a, b) => b[1] - a[1])),
  );

  // confere 220 ms depois da última mudança nas teclas presas (o acorde "assentou")
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nextTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const held = [...heldPitches];
    clearTimeout(timer);
    if (session.phase !== 'running' || !drill || drill.done) return;
    timer = setTimeout(() => {
      const r = drill!.check(held);
      if (r === null) return;
      answer = r;
      tick++;
      if (r === 'correct') {
        persist();
        nextTimer = setTimeout(next, 900);
      }
    }, 220);
  });

  function next() {
    if (!drill || session.phase !== 'running') return;
    drill.next([...heldPitches]);
    answer = null;
    revealed = false;
    tick++;
  }

  function skip() {
    clearTimeout(nextTimer);
    drill?.skip([...heldPitches]);
    persist();
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

  const pct = (a: number, t: number) => (t ? `${Math.round((100 * a) / t)}%` : '—');

  onDestroy(() => {
    if (session.phase === 'running') persist();
    session.dispose();
    clearTimeout(timer);
    clearTimeout(nextTimer);
    stopSound();
  });
</script>

<section class="card drill">
  <h2>Acordes</h2>

  {#if session.phase === 'setup'}
    <p class="muted small">
      Monte cada acorde no teclado. O app confere as notas e qual fica no baixo (pode dobrar notas e
      usar as duas mãos). Escolha o exercício:
    </p>
    <div class="choices">
      {#each presets as p (p.topic)}
        <button
          class="choice"
          class:primary={choiceTopic === p.topic}
          onclick={() => (choiceTopic = p.topic)}
        >
          <b>{topicTitle(p.topic)}</b>
          {#if p.topic === session.goal?.topic}<span class="pill accent">bloco de hoje</span>{/if}
          <span class="chords">{p.chords.join(' ')}</span>
        </button>
      {/each}
      <button
        class="choice"
        class:primary={choiceTopic === null}
        onclick={() => (choiceTopic = null)}
      >
        <b>Acordes da {PHASES[phase]?.name}</b>
        <span class="chords">sorteados, em inversão sorteada</span>
      </button>
    </div>
    {#if choice}<p class="muted small">{choice.hint}</p>{/if}
    <div class="row">
      <button class="primary" onclick={start}>▶ Começar</button>
      {#if session.goal}
        <span class="muted small">Meta do bloco: {session.goal.minutes} min</span>
      {/if}
    </div>
  {:else if session.phase === 'summary' && stats}
    <SessionSummary
      {session}
      onagain={start}
      tiles={[
        { value: stats.correct, label: 'acordes certos' },
        { value: pct(stats.firstTry, stats.answered), label: 'de primeira' },
        { value: stats.skipped, label: 'pulados' },
      ]}
    >
      {#if trouble.length}
        <p>
          <b>Deram trabalho:</b>
          {trouble.map(([label, n]) => (n > 1 ? `${label} (${n}×)` : label)).join(' · ')}
        </p>
      {:else if stats.answered}
        <p class="ok">Todos de primeira!</p>
      {/if}
    </SessionSummary>
  {:else if q && stats && drill}
    <SessionBar {session} onfinish={finish}>
      <span class="muted">
        {stats.correct} certos ({stats.firstTry} de primeira){stats.skipped
          ? ` · ${stats.skipped} pulados`
          : ''}
      </span>
    </SessionBar>
    {#if drill.order === 'sequence'}
      <div class="progression" aria-label="Progressão">
        {#each drill.labels as label, i (i)}
          <span class="pill" class:accent={i === q.index}>{label}</span>
        {/each}
      </div>
    {/if}
    <div class="big">{q.label}</div>
    <p>
      <b>{q.chord.name}</b> · {q.inv === null
        ? 'qualquer inversão'
        : INVERSION_NAMES[q.inv] +
          (q.inv ? ` (${noteSolfege(q.chord.tones[q.inv]!)} no baixo)` : '')}
    </p>
    <div class="feedback" class:ok={answer === 'correct'} class:no={answer && answer !== 'correct'}>
      {#if answer === 'correct'}
        Certo!
      {:else if answer === 'wrong-bass'}
        As notas estão certas; falta a nota certa no baixo.
      {:else if answer === 'incomplete'}
        Faltam notas: você tocou só {attemptNames.join(' · ')}.
      {:else if answer === 'wrong'}
        Ainda não. Você tocou: {attemptNames.join(' · ') || '—'}
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
  h2 {
    margin: 0;
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 0.5rem;
  }
  .choice {
    display: grid;
    justify-items: start;
    gap: 0.2rem;
    text-align: left;
  }
  .chords {
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }
  .progression {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .big {
    font-size: 2.6rem;
    font-weight: 700;
  }
  .feedback {
    min-height: 1.5em;
    font-weight: 700;
  }
  .feedback.ok,
  .ok {
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
    align-items: center;
    gap: 0.5rem;
  }
  .small {
    font-size: 0.9rem;
  }
  .warn {
    color: var(--warn);
  }
</style>
