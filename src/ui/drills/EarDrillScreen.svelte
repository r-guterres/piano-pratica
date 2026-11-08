<script lang="ts">
  // Treino de ouvido: maior ou menor, intervalos e graus. Responde nos botões
  // ou tocando (intervalo: a nota de cima; maior/menor e graus: o acorde).
  // Sessão: escolher o modo → ▶ Começar → ■ Encerrar → resumo.
  import { onDestroy } from 'svelte';
  import {
    answerFromKeys,
    EAR_MODES,
    earModesFor,
    earQuestion,
    intervalName,
    questionEvents,
    questionMs,
    type EarMode,
    type EarQuestion,
  } from '../../drills/earDrill';
  import { heldPitches } from '../../input/held.svelte';
  import { inputHub } from '../../input/hub';
  import { loadTrail, trail } from '../trail.svelte';
  import { DrillSession } from './session.svelte';
  import SessionBar from './SessionBar.svelte';
  import SessionSummary from './SessionSummary.svelte';
  import { chordEvents, exerciseSaver, playEvents, stopSound } from './support';

  void loadTrail();
  const session = new DrillSession('ear');
  const phase = $derived(trail.s?.phase ?? 0);
  const modes = $derived(earModesFor(phase));

  // o tópico do bloco do Hoje escolhe o modo
  const TOPIC_MODE: Record<string, EarMode> = {
    o0a: 'mm',
    o0b: 'int',
    o1a: 'degree',
    o2b: 'degree',
  };
  let mode = $state<EarMode>(TOPIC_MODE[session.goal?.topic ?? ''] ?? 'mm');
  /** Respostas certas que foram erradas → vezes. */
  let trouble = $state<Record<string, number>>({});
  let q = $state.raw<EarQuestion | null>(null);
  let result = $state<{ ok: boolean; choice: string } | null>(null);
  let heard = $state(false);
  let warning = $state('');
  let stats = $state({ answered: 0, correct: 0, firstTry: 0 });
  let save: ReturnType<typeof exerciseSaver> | null = null;

  const HINT: Record<EarMode, string> = {
    mm: 'Responda nos botões ou toque o acorde que ouviu.',
    int: 'Responda nos botões ou toque a nota de cima (a de baixo é a primeira que soa).',
    degree: 'Ouça a cadência I–IV–V–I e depois o acorde. Responda nos botões ou toque o acorde.',
  };

  function start() {
    if (!modes.includes(mode)) mode = 'mm';
    stats = { answered: 0, correct: 0, firstTry: 0 };
    trouble = {};
    save = exerciseSaver('ear', mode);
    session.start();
    newQuestion();
  }

  function finish() {
    clearTimeout(timer);
    stopSound();
    if (stats.answered) save?.({ ...stats, trouble });
    session.finish();
  }

  // só vale como resposta uma tecla tocada depois do início da pergunta
  let askedAt = 0;
  let lastOn = $state(0);
  const unsubscribe = inputHub.subscribe((e) => {
    if (e.type === 'on') lastOn = performance.now();
  });

  function newQuestion() {
    if (session.phase !== 'running') return;
    askedAt = performance.now();
    q = earQuestion(mode, phase);
    result = null;
    heard = false;
    listen();
  }

  function listen() {
    if (!q) return;
    heard = true;
    warning = playEvents(questionEvents(q), questionMs(q)).warning;
  }

  function respond(value: string) {
    if (!q || result) return;
    const ok = value === q.answer;
    result = { ok, choice: value };
    stats.answered++;
    if (ok) {
      stats.correct++;
      stats.firstTry++;
    } else trouble[answerLabel] = (trouble[answerLabel] ?? 0) + 1;
    save?.({ ...stats, trouble });
  }

  // resposta pelo teclado, 250 ms depois da última tecla (o acorde "assentou")
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const held = [...heldPitches].sort((a, b) => a - b);
    clearTimeout(timer);
    if (session.phase !== 'running' || !q || result || !heard || !held.length || lastOn <= askedAt)
      return;
    timer = setTimeout(() => {
      const v = answerFromKeys(q!, held);
      if (v !== null) respond(v);
    }, 250);
  });

  function compare() {
    if (!q) return;
    const r = q.root;
    const major = chordEvents([r, r + 4, r + 7]);
    const minor = chordEvents([r, r + 3, r + 7]).map((e) => ({ ...e, t: e.t + 3500 }));
    warning = playEvents([...major, ...minor], 7000).warning;
  }

  const answerLabel = $derived(q?.options.find((o) => o.value === q!.answer)?.label ?? '');
  const choiceLabel = (v: string) =>
    q?.options.find((o) => o.value === v)?.label ??
    (v === '?' ? 'outro acorde' : q?.mode === 'int' ? intervalName(Number(v)) : v);

  const troubleList = $derived(Object.entries(trouble).sort((a, b) => b[1] - a[1]));
  const pct = (a: number, t: number) => (t ? `${Math.round((100 * a) / t)}%` : '—');

  onDestroy(() => {
    if (session.phase === 'running' && stats.answered) save?.({ ...stats, trouble });
    session.dispose();
    unsubscribe();
    clearTimeout(timer);
    stopSound();
  });
</script>

<section class="card drill">
  <h2>Ouvido</h2>
  {#if session.phase === 'setup'}
    <div class="row">
      {#each modes as m (m)}
        <button class:primary={mode === m} onclick={() => (mode = m)}>{EAR_MODES[m]}</button>
      {/each}
    </div>
    <p class="muted small">
      {HINT[mode]} O som sai pelo teclado ou pelo tablet, conforme Configurações → Som. Os graus entram
      a partir da Fase 1 (ii e ♭VII na Fase 2).
    </p>
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
        { value: stats.answered, label: 'respostas' },
        { value: stats.correct, label: 'certas' },
        { value: pct(stats.correct, stats.answered), label: 'de acerto' },
      ]}
    >
      <p class="muted">{EAR_MODES[mode]}</p>
      {#if troubleList.length}
        <p>
          <b>Errou:</b>
          {troubleList.map(([label, n]) => (n > 1 ? `${label} (${n}×)` : label)).join(' · ')}
        </p>
      {:else if stats.answered}
        <p class="ok">Nenhum erro!</p>
      {/if}
    </SessionSummary>
  {:else if q}
    <SessionBar {session} onfinish={finish}>
      <span class="muted">{EAR_MODES[mode]} · {stats.correct} de {stats.answered}</span>
    </SessionBar>
    <p class="muted small">{HINT[mode]}</p>
    <div class="row">
      <button class="primary" onclick={listen}>Ouvir{heard ? ' de novo' : ''}</button>
    </div>
    <div class="answers">
      {#each q.options as o (o.value)}
        <button
          class:right={result && o.value === q.answer}
          class:wrong={result && !result.ok && o.value === result.choice}
          onclick={() => respond(o.value)}>{o.label}</button
        >
      {/each}
    </div>
    <div class="feedback" class:ok={result?.ok} class:no={result && !result.ok}>
      {#if result}
        {result.ok
          ? 'Certo.'
          : `Era ${answerLabel}${result.choice ? ` (você respondeu ${choiceLabel(result.choice)})` : ''}. Ouça de novo para fixar.`}
      {/if}
    </div>
    {#if result}
      <div class="row">
        <button class="primary" onclick={newQuestion}>Próximo</button>
        {#if mode === 'mm'}<button onclick={compare}>Comparar maior e menor</button>{/if}
      </div>
    {/if}
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
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .answers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.4rem;
  }
  .answers button {
    min-height: 3.2rem;
    font-weight: 700;
  }
  .answers button.right {
    background: var(--ok);
    border-color: var(--ok);
    color: var(--surface);
  }
  .answers button.wrong {
    background: var(--bad);
    border-color: var(--bad);
    color: var(--surface);
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
  .small {
    font-size: 0.9rem;
  }
  .warn {
    color: var(--warn);
  }
</style>
