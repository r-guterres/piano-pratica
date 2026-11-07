<script lang="ts">
  // Aba "Hoje": a sessão do dia já montada em blocos (como no artefato
  // "Trilha do Teclado"), o cronômetro da sessão, o diário e os minutos fora
  // do plano.
  import { onDestroy } from 'svelte';
  import { appHistory } from '../storage/history';
  import { readingDays, type Activity } from '../trail/activity';
  import { PHASES, PILLAR_ORDER, PILLARS, type Pillar } from '../trail/content';
  import { addDays, shortDay, weekOf } from '../trail/dates';
  import {
    autoReadingMilestone,
    finishSession,
    generatePlan,
    logExtraMinutes,
    planForDay,
    practiced,
    practicedThisWeek,
    refreshPlan,
    sessionMinutes,
    startSession,
  } from '../trail/state';
  import { showToast } from './toast.svelte';
  import { loadTrail, saveTrail, trail } from './trail.svelte';
  import BlockCard from './trail/BlockCard.svelte';
  import DiaryCard from './trail/DiaryCard.svelte';

  let activity = $state.raw<Activity | null>(null);

  void loadTrail().then(async () => {
    const h = appHistory();
    const [scoreSessions, drillRounds, pedalSessions] = await Promise.all([
      h.scoreSessions().catch(() => []),
      h.drillRounds().catch(() => []),
      h.pedalSessions().catch(() => []),
    ]);
    const a: Activity = { scoreSessions, drillRounds, pedalSessions };
    activity = a;
    if (trail.s && autoReadingMilestone(trail.s, readingDays(a))) {
      saveTrail();
      showToast('Marco conquistado: ler notas nas duas claves com 90% de acerto.');
    }
  });

  const s = $derived(trail.s);
  const d = $derived(trail.day);
  // plano de outro dia (ou nenhum): gera o de hoje
  $effect(() => {
    if (s && s.plan?.day !== d) {
      planForDay(s, d);
      saveTrail();
    }
  });
  const plan = $derived(s?.plan?.day === d ? s.plan : null);
  const week = $derived(weekOf(d));
  const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const dateText = $derived(
    new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );

  const banner = $derived.by(() => {
    if (!s || practiced(s, d)) return null;
    const hasHistory = Object.keys(s.days).some((x) => x < d);
    if (hasHistory && !practiced(s, addDays(d, -1)))
      return {
        warn: true,
        title: 'Ontem ficou sem teclado.',
        text: 'Regra da trilha: nunca dois dias seguidos. Hoje, 5 minutos já bastam.',
      };
    if (!hasHistory)
      return {
        warn: false,
        title: 'Bem-vindo de volta.',
        text: 'As primeiras semanas são de retomada: nada de metas ambiciosas, só voltar a tocar com prazer.',
      };
    return null;
  });

  // ---- cronômetro da sessão ----
  let now = $state(Date.now());
  const clock = setInterval(() => (now = Date.now()), 1000);
  onDestroy(() => clearInterval(clock));
  const running = $derived(s?.session?.day === d);
  const elapsed = $derived.by(() => {
    if (!s?.session) return '00:00';
    const sec = Math.max(0, Math.floor((now - s.session.startedAt) / 1000));
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  });
  let finishing = $state<number | null>(null);

  function start(minimal: boolean) {
    if (!s) return;
    if (minimal) s.plan = generatePlan(s, d, true);
    startSession(s, d, Date.now());
    saveTrail();
  }

  function saveSession() {
    if (!s || !finishing || !(finishing > 0)) return showToast('Informe os minutos.');
    const m = Math.round(finishing);
    finishSession(s, m);
    finishing = null;
    saveTrail();
    showToast(`${m} min registrados.`);
  }

  function closeOld(register: boolean) {
    if (!s) return;
    if (register) finishSession(s, 30);
    else s.session = null;
    saveTrail();
  }

  function refresh(minimal?: boolean) {
    if (!s) return;
    refreshPlan(s, d, minimal);
    saveTrail();
    showToast('Plano atualizado.');
  }

  // ---- minutos fora do plano ----
  let extraMin = $state<number | null>(null);
  let extraPillar = $state<Pillar>('repertoire');
  function logExtra() {
    if (!s || !extraMin || !(extraMin > 0)) return showToast('Informe os minutos.');
    const m = Math.round(extraMin);
    logExtraMinutes(s, d, m, extraPillar);
    extraMin = null;
    saveTrail();
    showToast(`${m} min registrados.`);
  }
</script>

{#if !s || !plan}
  <p class="muted">{trail.error || 'Carregando…'}</p>
{:else}
  <section class="card hero">
    <div class="who">
      <span class="label">{dateText}</span>
      <h2>{PHASES[s.phase]!.name}</h2>
      <div class="week" aria-label="Dias praticados nesta semana">
        {#each week as x, i (x)}
          <div class="d" class:done={practiced(s, x)} class:today={x === d}>
            <i></i>{WEEKDAYS[i]}
          </div>
        {/each}
      </div>
      <span class="muted">{practicedThisWeek(s, d)} de {s.goals.daysPerWeek} dias nesta semana</span
      >
    </div>
    <div class="control">
      {#if running}
        <span class="label">Sessão em andamento</span>
        <span class="timer">{elapsed}</span>
        <button class="primary" onclick={() => (finishing = sessionMinutes(s, Date.now()))}>
          Encerrar e registrar
        </button>
      {:else}
        <div class="row">
          <button class="primary" onclick={() => start(false)}>Começar sessão</button>
          <button onclick={() => start(true)}>Só 5 minutos</button>
        </div>
        <span class="muted small">
          {plan.minimal
            ? 'Plano mínimo de hoje'
            : `Plano de ≈${plan.blocks.reduce((a, b) => a + b.min, 0)} min, já montado`}
        </span>
      {/if}
    </div>
  </section>

  {#if banner}
    <div class="banner" class:warn={banner.warn}><b>{banner.title}</b> {banner.text}</div>
  {/if}
  {#if trail.error}<p class="warn-text">{trail.error}</p>{/if}

  {#if finishing !== null}
    <section class="card stack">
      <h2>Registrar a sessão</h2>
      <p class="muted">Ajuste os minutos se precisar.</p>
      <div class="row">
        <input type="number" min="1" max="300" bind:value={finishing} class="min" /> minutos
        <button class="primary" onclick={saveSession}>Salvar</button>
        <button class="ghost" onclick={() => (finishing = null)}>Voltar</button>
      </div>
    </section>
  {/if}
  {#if s.session && s.session.day !== d}
    <div class="banner">
      Ficou uma sessão aberta de {shortDay(s.session.day)}.
      <button class="small" onclick={() => closeOld(true)}>Registrar 30 min e fechar</button>
      <button class="small ghost" onclick={() => closeOld(false)}>Descartar</button>
    </div>
  {/if}

  <div class="between">
    <h2 class="title">Sessão de hoje</h2>
    <div class="row">
      {#if plan.minimal}
        <button class="small" onclick={() => refresh(false)}>Gerar sessão completa</button>
      {/if}
      <button class="small ghost" onclick={() => refresh()}>Atualizar plano</button>
    </div>
  </div>
  <div class="blocks">
    {#each plan.blocks as block, i (plan.day + block.id)}
      <BlockCard {block} n={i + 1} />
    {/each}
  </div>

  <DiaryCard {activity} />

  <section class="card stack">
    <h2>Tocou fora do plano?</h2>
    <p class="muted">Skoove, curso ou só diversão. Tudo conta para o cofrinho.</p>
    <div class="row">
      <input type="number" min="1" max="300" placeholder="min" bind:value={extraMin} class="min" />
      <select bind:value={extraPillar} aria-label="Pilar">
        {#each PILLAR_ORDER as p (p)}<option value={p}>{PILLARS[p]}</option>{/each}
      </select>
      <button onclick={logExtra}>Registrar</button>
    </div>
    <p class="muted small">
      O tempo com o teclado em uso já é contado sozinho enquanto o app está aberto; registre aqui o
      que você tocou com o app fechado.
    </p>
  </section>
{/if}

<style>
  .hero {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1rem;
    align-items: center;
  }
  @media (max-width: 640px) {
    .hero {
      grid-template-columns: 1fr;
    }
  }
  .who,
  .control,
  .stack {
    display: grid;
    gap: 0.5rem;
  }
  .stack p,
  h2 {
    margin: 0;
  }
  .label {
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--muted);
  }
  h2 {
    font-size: 1.3rem;
  }
  .title {
    font-size: 1.2rem;
  }
  .week {
    display: flex;
    gap: 0.35rem;
  }
  .week .d {
    width: 2.2rem;
    text-align: center;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .week .d i {
    display: block;
    width: 1.9rem;
    height: 1.9rem;
    margin: 0 auto 0.15rem;
    border-radius: 50%;
    border: 2px solid var(--border);
  }
  .week .d.done i {
    background: var(--ok);
    border-color: var(--ok);
  }
  .week .d.today i {
    border-color: var(--accent);
  }
  .week .d.done.today i {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .timer {
    font-size: 1.8rem;
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .between {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
  }
  .banner {
    border-radius: 10px;
    padding: 0.75rem 0.9rem;
    background: var(--accent-soft);
  }
  .banner.warn {
    background: var(--warn-soft);
  }
  .warn-text {
    color: var(--warn);
    margin: 0;
  }
  .blocks {
    display: grid;
    gap: 0.75rem;
  }
  .min {
    width: 6rem;
  }
  .small {
    font-size: 0.85rem;
  }
</style>
