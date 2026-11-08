<script lang="ts">
  // Ficha de uma música no repertório: estrutura, dica, materiais, partitura
  // no app, anotações, cifra, registros de estudo e mudança de status.
  import { CHORD_CHARTS, DEFAULT_SCORE, songLinks } from '../../trail/content';
  import { dueText } from '../../trail/dates';
  import {
    choosePiece,
    learnedSong,
    MASTERED_BOX,
    setSongStatus,
    songInfo,
    STATUS_TEXT,
    type SongStatus,
  } from '../../trail/state';
  import { openScoreById } from '../nav.svelte';
  import { showToast } from '../toast.svelte';
  import { saveTrail, trail } from '../trail.svelte';
  import ChordChart from './ChordChart.svelte';
  import Links from './Links.svelte';
  import StudyLog from './StudyLog.svelte';

  let { id, scores }: { id: string; scores: { id: string; title: string }[] } = $props();

  const M = $derived(songInfo(trail.s, id)!);
  const piece = $derived(!!trail.s!.pieces?.[id]);
  const st = $derived(trail.s!.songs[id]!);
  const mastered = $derived(st.status === 'maintenance' && st.box >= MASTERED_BOX);
  const scoreId = $derived(st.scoreId ?? DEFAULT_SCORE[id] ?? '');
  const chart = $derived(CHORD_CHARTS[id]);
  let showChart = $state(false);

  const statusClass = $derived(
    mastered || st.status === 'maintenance'
      ? 'good'
      : st.status === 'learning'
        ? 'accent'
        : st.status === 'project'
          ? 'warn'
          : '',
  );

  function status(s: SongStatus) {
    // peça escolhida: uma de cada vez (a que estava em estudo volta para a fila)
    if (piece && s === 'learning') choosePiece(trail.s!, st.scoreId!, M.title, trail.day);
    else setSongStatus(trail.s!, id, s);
    saveTrail();
  }

  function learned() {
    learnedSong(trail.s!, id, trail.day);
    saveTrail();
    showToast('Entrou em revisão espaçada. Primeira revisão: amanhã.');
  }

  function linkScore(v: string) {
    if (v) st.scoreId = v;
    else delete st.scoreId;
    saveTrail();
  }

  function saveNotes(v: string) {
    st.notes = v.slice(0, 4000);
    saveTrail();
    showToast('Anotação salva.');
  }
</script>

<article class="card song" id="song-{id}">
  <div class="between">
    <div class="name">
      <h3>{M.title}</h3>
      <span class="muted">{M.artist}</span>
    </div>
    <div class="row">
      <span class="pill">{M.kind === 'pop' ? 'Pop-rock' : 'Clássico'}</span>
      {#if !piece}<span class="pill">Fase {M.phase}</span>{/if}
      <span class="pill {statusClass}">{mastered ? 'Dominada' : STATUS_TEXT[st.status]}</span>
    </div>
  </div>
  {#if M.key}<div class="struct">{M.key} · {M.structure}</div>{/if}
  {#if M.tip}<p>{M.tip}</p>{/if}
  <Links links={songLinks(id)} />

  <div class="row">
    <label class="score">
      Partitura no app
      <select
        value={scoreId}
        onchange={(e) => linkScore((e.currentTarget as HTMLSelectElement).value)}
      >
        <option value="">— nenhuma —</option>
        {#each scores as sc (sc.id)}<option value={sc.id}>{sc.title}</option>{/each}
      </select>
    </label>
    {#if scoreId}
      <button class="small" onclick={() => openScoreById(scoreId)}>Abrir partitura</button>
    {/if}
    {#if chart}
      <button class="small" class:primary={showChart} onclick={() => (showChart = !showChart)}
        >Cifra</button
      >
    {/if}
  </div>
  {#if showChart && chart}<ChordChart {chart} />{/if}

  <label class="notes">
    <span class="label">Minhas anotações</span>
    <textarea
      value={st.notes}
      placeholder="Compassos difíceis, dedilhado, onde parei…"
      onchange={(e) => saveNotes((e.currentTarget as HTMLTextAreaElement).value)}></textarea>
  </label>

  {#if st.status === 'learning' || st.status === 'project'}<StudyLog {id} history />{/if}

  <div class="row">
    {#if st.status === 'queue'}
      <button class="small" onclick={() => status('learning')}>Começar a estudar</button>
    {:else if st.status === 'learning'}
      <button class="small good" onclick={learned}
        >{piece ? 'Concluí a peça' : 'Já toco de memória'}</button
      >
      <button class="small ghost" onclick={() => status('queue')}>Voltar para a fila</button>
    {:else if st.status === 'project'}
      <button class="small good" onclick={learned}>Concluí a peça</button>
    {:else}
      <span class="muted small">
        Próxima revisão: {dueText(trail.day, st.due)} · {st.reviews}
        {st.reviews === 1 ? 'revisão' : 'revisões'}
      </span>
    {/if}
  </div>
</article>

<style>
  .song {
    display: grid;
    gap: 0.6rem;
    scroll-margin-top: 1rem;
  }
  .song p {
    margin: 0;
  }
  h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  .name {
    min-width: 0;
  }
  .between {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: space-between;
    align-items: center;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .struct {
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 0.85rem;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .score {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9rem;
  }
  .score select {
    max-width: 16rem;
  }
  .notes {
    display: grid;
    gap: 0.25rem;
  }
  .label {
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--muted);
  }
  .small {
    font-size: 0.9rem;
  }
</style>
