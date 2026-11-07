<script lang="ts">
  // Treino de ouvido: maior ou menor, intervalos e graus. Responde nos botões
  // ou tocando (intervalo: a nota de cima; maior/menor e graus: o acorde).
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
  import { chordEvents, exerciseSaver, playEvents, stopSound } from './support';

  void loadTrail();
  const phase = $derived(trail.s?.phase ?? 0);
  const modes = $derived(earModesFor(phase));

  let mode = $state<EarMode | null>(null);
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

  function start(m: EarMode) {
    mode = m;
    stats = { answered: 0, correct: 0, firstTry: 0 };
    save = exerciseSaver('ear', m);
    newQuestion();
  }

  // só vale como resposta uma tecla tocada depois do início da pergunta
  let askedAt = 0;
  let lastOn = $state(0);
  const unsubscribe = inputHub.subscribe((e) => {
    if (e.type === 'on') lastOn = performance.now();
  });

  function newQuestion() {
    if (!mode) return;
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
    }
    save?.(stats);
  }

  // resposta pelo teclado, 250 ms depois da última tecla (o acorde "assentou")
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const held = [...heldPitches].sort((a, b) => a - b);
    clearTimeout(timer);
    if (!q || result || !heard || !held.length || lastOn <= askedAt) return;
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

  onDestroy(() => {
    unsubscribe();
    clearTimeout(timer);
    stopSound();
  });
</script>

<section class="card drill">
  <div class="head">
    <h2>Ouvido</h2>
    {#if mode}<span class="muted">{stats.correct} de {stats.answered}</span>{/if}
  </div>
  <div class="row">
    {#each modes as m (m)}
      <button class:primary={mode === m} onclick={() => start(m)}>{EAR_MODES[m]}</button>
    {/each}
  </div>
  {#if !mode}
    <p class="muted">
      Escolha um modo. O som sai pelo teclado ou pelo tablet, conforme Configurações → Som. Os graus
      entram a partir da Fase 1 (ii e ♭VII na Fase 2).
    </p>
  {:else if q}
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
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
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
  .feedback.ok {
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
