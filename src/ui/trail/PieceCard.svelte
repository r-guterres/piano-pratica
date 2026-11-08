<script lang="ts">
  // A peça clássica em estudo: o aluno escolhe a partitura (um arquivo
  // importado ou da biblioteca) e o bloco "Peça clássica" do Hoje passa a
  // trabalhar nela. Uma de cada vez; ao concluir, escolhe a próxima.
  import { choosePiece, currentPiece, learnedSong } from '../../trail/state';
  import { go, openScoreById } from '../nav.svelte';
  import { showToast } from '../toast.svelte';
  import { saveTrail, trail } from '../trail.svelte';

  let { scores }: { scores: { id: string; title: string }[] } = $props();

  const id = $derived(trail.s ? currentPiece(trail.s) : null);
  const piece = $derived(id ? trail.s!.pieces![id]! : null);
  let pick = $state('');

  function choose() {
    const sc = scores.find((x) => x.id === pick);
    if (!sc) return;
    choosePiece(trail.s!, sc.id, sc.title, trail.day);
    saveTrail();
    pick = '';
    showToast(`"${sc.title}" é a peça clássica em estudo.`);
  }

  function finished() {
    if (!id) return;
    learnedSong(trail.s!, id, trail.day);
    saveTrail();
    showToast('Concluída! Ela entra na revisão espaçada. Escolha a próxima peça.');
  }
</script>

<article class="card piece">
  <span class="label">Peça clássica em estudo</span>
  {#if piece}
    <h3>{piece.title}</h3>
    <div class="row">
      <button class="small primary" onclick={() => openScoreById(piece.scoreId)}>
        Abrir partitura
      </button>
      <button
        class="small ghost"
        onclick={() => go('trail', { trailView: 'repertoire', song: id! })}
      >
        Ficha e registros
      </button>
      <button class="small good" onclick={finished}>Concluí a peça</button>
    </div>
  {:else}
    <p class="muted">
      Nenhuma. Importe a partitura em Partituras (.mxl ou .musicxml) e escolha-a aqui: o bloco "Peça
      clássica" do Hoje passa a trabalhar nela até você concluí-la.
    </p>
  {/if}
  <div class="row">
    <select bind:value={pick} aria-label="Partitura da próxima peça">
      <option value="">{piece ? 'Trocar por outra partitura…' : 'Escolher a partitura…'}</option>
      {#each scores as sc (sc.id)}<option value={sc.id}>{sc.title}</option>{/each}
    </select>
    <button class="small" disabled={!pick} onclick={choose}>Estudar esta</button>
  </div>
</article>

<style>
  .piece {
    display: grid;
    gap: 0.5rem;
  }
  h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  p {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  select {
    max-width: 18rem;
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
