<script lang="ts">
  // Um bloco da sessão do dia: o que fazer, por quanto tempo, materiais e
  // atalhos para o treino, o metrônomo ou a partitura.
  import { PILLARS, topicLinks } from '../../trail/content';
  import { toggleBlock, toggleTopic, type Block } from '../../trail/state';
  import { go } from '../nav.svelte';
  import { showToast } from '../toast.svelte';
  import { saveTrail, trail } from '../trail.svelte';
  import Links from './Links.svelte';
  import SongLine from './SongLine.svelte';

  let { block, n }: { block: Block; n: number } = $props();

  const done = $derived(!!trail.s!.plan?.done[block.id]);
  const topicOpen = $derived(!!block.topic && !trail.s!.topics[block.topic]);
  const technique = $derived(block.id === 'aq');

  function toggle() {
    const msg = toggleBlock(trail.s!, block.id);
    saveTrail();
    if (msg) showToast(msg);
  }

  function masterTopic() {
    toggleTopic(trail.s!, block.topic!, trail.day);
    saveTrail();
    showToast('Tópico marcado como dominado.');
  }
</script>

<article class="block" class:done>
  <div class="num" aria-hidden="true">{done ? '✓' : n}</div>
  <div class="body">
    <div class="meta">
      <span class="pill accent">{block.min} min</span>
      <span class="pill">{PILLARS[block.pillar]}</span>
    </div>
    <h3>{block.title}{block.theme && !block.extra ? ': ' + block.theme : ''}</h3>
    <p>{block.text}</p>
    {#if block.topic}<Links links={topicLinks(block.topic)} />{/if}
    {#if block.extra}
      <p class="muted"><b>Tópico de leitura:</b> {block.theme}. {block.extra}</p>
    {/if}
    {#each block.songs ?? [] as id (id)}<SongLine {id} review />{/each}
    {#if block.song}<SongLine id={block.song} />{/if}
    <div class="row">
      {#if block.drill === 'reading'}
        <button class="small" onclick={() => go('drill', { training: 'reading' })}>
          Abrir treino de leitura
        </button>
      {/if}
      {#if block.topic === 'tp0'}
        <button class="small" onclick={() => go('drill', { training: 'pedal' })}>
          Abrir treino de pedal
        </button>
      {/if}
      {#if technique}
        <button class="small" onclick={() => go('metronome')}>Abrir metrônomo</button>
      {/if}
      {#if block.goTo === 'repertoire'}
        <button class="small" onclick={() => go('trail', { trailView: 'repertoire' })}>
          Abrir repertório
        </button>
      {/if}
      {#if topicOpen}
        <button class="small ghost" onclick={masterTopic}>Já domino este tópico</button>
      {/if}
      <button class="small" class:good={!done} onclick={toggle}>
        {done ? 'Desmarcar' : 'Feito'}
      </button>
    </div>
  </div>
</article>

<style>
  .block {
    display: grid;
    grid-template-columns: 2.6rem 1fr;
    gap: 0.75rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem;
  }
  .block.done {
    background: var(--ok-soft);
    border-color: transparent;
  }
  .num {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 700;
    border: 2px solid var(--border);
    color: var(--muted);
  }
  .done .num {
    background: var(--ok);
    border-color: var(--ok);
    color: var(--surface);
  }
  .body {
    min-width: 0;
    display: grid;
    gap: 0.5rem;
  }
  .meta,
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  h3 {
    margin: 0;
    font-size: 1.05rem;
  }
  p {
    margin: 0;
  }
</style>
