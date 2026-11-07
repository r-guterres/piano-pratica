<script lang="ts">
  // Aba "Trilha": as fases (tópicos e marcos) e o repertório.
  import { tick } from 'svelte';
  import { SONGS } from '../trail/content';
  import { MASTERED_BOX, songsInStudy, type SongStatus } from '../trail/state';
  import { nav } from './nav.svelte';
  import { scoreChoices } from './scores';
  import { loadTrail, trail } from './trail.svelte';
  import PhasesView from './trail/PhasesView.svelte';
  import SongCard from './trail/SongCard.svelte';

  void loadTrail();

  type Filter = 'all' | SongStatus | 'mastered';
  const FILTERS: [Filter, string][] = [
    ['all', 'Todas'],
    ['learning', 'Em estudo'],
    ['maintenance', 'Manutenção'],
    ['project', 'Projeto'],
    ['queue', 'Fila'],
    ['mastered', 'Dominadas'],
  ];
  let filter = $state<Filter>('all');

  let scores = $state<{ id: string; title: string }[]>([]);
  void scoreChoices().then((list) => (scores = list));

  const ids = $derived.by(() => {
    const s = trail.s;
    if (!s) return [];
    return Object.keys(SONGS)
      .filter((id) => {
        const st = s.songs[id];
        if (!st) return false;
        if (filter === 'all') return true;
        if (filter === 'mastered') return st.status === 'maintenance' && st.box >= MASTERED_BOX;
        return st.status === filter;
      })
      .sort((a, b) => SONGS[a]!.phase - SONGS[b]!.phase);
  });
  const inStudy = $derived(
    trail.s ? songsInStudy(trail.s, 'pop').length + songsInStudy(trail.s, 'classical').length : 0,
  );

  // vindo de um bloco ("Ficha da música"): mostra a música
  $effect(() => {
    const song = nav.song;
    if (!song || !trail.s || nav.trailView !== 'repertoire') return;
    filter = 'all';
    void tick().then(() => document.getElementById(`song-${song}`)?.scrollIntoView());
  });
</script>

<div class="choose" role="group" aria-label="Trilha">
  <button class:active={nav.trailView === 'phases'} onclick={() => (nav.trailView = 'phases')}>
    Fases
  </button>
  <button
    class:active={nav.trailView === 'repertoire'}
    onclick={() => (nav.trailView = 'repertoire')}
  >
    Repertório
  </button>
</div>

{#if !trail.s}
  <p class="muted">{trail.error || 'Carregando…'}</p>
{:else if nav.trailView === 'phases'}
  <PhasesView />
{:else}
  <p class="muted intro">
    Cada música guarda a estrutura (tom, progressão, forma), não só o nome: é isso que você
    memoriza. Quando uma música sai de memória, ela entra em revisão espaçada e a aba Hoje cobra a
    revisão na hora certa. Ligue cada música à partitura no app (importada em Partituras) para
    abri-la direto da sessão do dia.
  </p>
  {#if inStudy > 3}
    <div class="banner">
      Você tem {inStudy} músicas em estudo. Três ao mesmo tempo (duas pop e uma clássica) costuma render
      mais.
    </div>
  {/if}
  <div class="filters" role="group" aria-label="Filtro">
    {#each FILTERS as [k, label] (k)}
      <button aria-pressed={filter === k} onclick={() => (filter = k)}>{label}</button>
    {/each}
  </div>
  {#each ids as id (id)}
    <SongCard {id} {scores} />
  {:else}
    <p class="muted">Nenhuma música nesse filtro.</p>
  {/each}
{/if}

<style>
  .choose,
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .choose button.active,
  .filters button[aria-pressed='true'] {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .filters button {
    border-radius: 999px;
    min-height: 2.25rem;
    font-size: 0.9rem;
  }
  .intro {
    margin: 0;
  }
  .banner {
    border-radius: 10px;
    padding: 0.75rem 0.9rem;
    background: var(--accent-soft);
  }
</style>
