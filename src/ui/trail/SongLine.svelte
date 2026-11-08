<script lang="ts">
  // Uma música dentro de um bloco do dia: estrutura, materiais, partitura no
  // app e, conforme o bloco, a avaliação da revisão ou o registro de estudo.
  import { CHORD_CHARTS, DEFAULT_SCORE, songLinks } from '../../trail/content';
  import { GRADE_TEXT, reviewSong, songInfo, type Grade } from '../../trail/state';
  import { go, openScoreById } from '../nav.svelte';
  import { saveTrail, trail } from '../trail.svelte';
  import ChordChart from './ChordChart.svelte';
  import Links from './Links.svelte';
  import StudyLog from './StudyLog.svelte';

  let { id, review = false }: { id: string; review?: boolean } = $props();

  const M = $derived(songInfo(trail.s, id)!);
  const st = $derived(trail.s!.songs[id]!);
  const scoreId = $derived(st.scoreId ?? DEFAULT_SCORE[id]);
  const chart = $derived(CHORD_CHARTS[id]);
  let showChart = $state(false);

  function grade(g: Grade) {
    reviewSong(trail.s!, id, g, trail.day);
    saveTrail();
  }
</script>

<div class="song">
  <div>
    <b>{M.title}</b> <span class="muted">· {M.artist}</span>
    {#if M.key}<div class="struct">{M.key} · {M.structure}</div>{/if}
  </div>
  <Links links={songLinks(id)} />
  <div class="row">
    {#if scoreId}
      <button class="small" onclick={() => openScoreById(scoreId)}>Abrir partitura</button>
    {/if}
    {#if chart}
      <button class="small" class:primary={showChart} onclick={() => (showChart = !showChart)}
        >Cifra</button
      >
    {/if}
    <button class="small ghost" onclick={() => go('trail', { trailView: 'repertoire', song: id })}>
      Ficha da música
    </button>
  </div>
  {#if showChart && chart}<ChordChart {chart} />{/if}
  {#if review}
    <div class="row">
      {#if st.lastReview === trail.day && st.lastGrade}
        <span class="pill good">avaliada: {GRADE_TEXT[st.lastGrade]}</span>
      {:else}
        <button class="small good" onclick={() => grade('flowed')}>Fluiu</button>
        <button class="small" onclick={() => grade('hesitated')}>Hesitei</button>
        <button class="small" onclick={() => grade('forgot')}>Esqueci</button>
      {/if}
    </div>
  {:else if st.status === 'learning' || st.status === 'project'}
    <StudyLog {id} />
  {/if}
</div>

<style>
  .song {
    display: grid;
    gap: 0.5rem;
    border-top: 1px dashed var(--border);
    padding-top: 0.6rem;
  }
  .struct {
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 0.85rem;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
</style>
