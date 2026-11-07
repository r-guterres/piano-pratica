<script lang="ts">
  // As fases da Trilha: foco, marcos (o "chefão" libera a fase seguinte),
  // músicas e tópicos por pilar, com a marcação do que já domina.
  import {
    PHASES,
    PILLARS,
    SONGS,
    TOPIC_PILLARS,
    topicLinks,
    type Phase,
  } from '../../trail/content';
  import { shortDay } from '../../trail/dates';
  import { setPhase, toggleMilestone, toggleTopic } from '../../trail/state';
  import { showToast } from '../toast.svelte';
  import { saveTrail, trail } from '../trail.svelte';
  import Links from './Links.svelte';

  const s = $derived(trail.s!);

  function milestone(id: string) {
    const msg = toggleMilestone(s, id, trail.day);
    saveTrail();
    if (msg) showToast(msg);
  }

  function topic(id: string) {
    toggleTopic(s, id, trail.day);
    saveTrail();
  }

  function phase(i: number) {
    setPhase(s, i);
    saveTrail();
    window.scrollTo(0, 0);
    showToast(`Agora na ${PHASES[i]!.name}.`);
  }

  const bossBeaten = (F: Phase) => {
    const boss = F.milestones.find((m) => m.boss);
    return !!boss && !!s.milestones[boss.id];
  };
  const songClass = (id: string) => {
    const st = s.songs[id]?.status;
    return st === 'maintenance' ? 'good' : st === 'learning' ? 'accent' : '';
  };
</script>

{#snippet content(F: Phase, i: number)}
  <p>{F.focus}</p>
  <div class="grid2">
    <div class="card stack">
      <h3>Marcos</h3>
      {#each F.milestones as m (m.id)}
        <div class="item">
          <button
            class="check"
            class:on={!!s.milestones[m.id]}
            onclick={() => milestone(m.id)}
            aria-label="Marcar marco: {m.title}">{s.milestones[m.id] ? '✓' : ''}</button
          >
          <div>
            <b>{m.title}</b>
            {#if s.milestones[m.id]}<span class="muted">
                · {shortDay(s.milestones[m.id]!)}</span
              >{/if}
          </div>
        </div>
      {/each}
      {#if i === s.phase && i < PHASES.length - 1}
        <button class:primary={bossBeaten(F)} onclick={() => phase(i + 1)}>
          {bossBeaten(F)
            ? `Avançar para a ${PHASES[i + 1]!.name.split(' · ')[0]}`
            : 'Avançar mesmo assim'}
        </button>
      {/if}
      {#if i !== s.phase}
        <button class="small ghost" onclick={() => phase(i)}>Ir para esta fase</button>
      {/if}
    </div>
    <div class="card stack">
      <h3>Músicas da fase</h3>
      <div class="pills">
        {#each F.songs as id (id)}<span class="pill {songClass(id)}">{SONGS[id]?.title}</span
          >{/each}
      </div>
    </div>
  </div>
  <div class="card stack">
    {#each TOPIC_PILLARS.filter((p) => F[p].length) as p (p)}
      <div class="stack">
        <span class="label">{PILLARS[p]}</span>
        <div>
          {#each F[p] as t (t.id)}
            <div class="item topic">
              <button
                class="check"
                class:on={!!s.topics[t.id]}
                onclick={() => topic(t.id)}
                aria-label="Marcar {t.title} como dominado">{s.topics[t.id] ? '✓' : ''}</button
              >
              <div class="stack tight">
                <b>{t.title}</b>
                <p class="muted">{t.text}</p>
                <Links links={topicLinks(t.id)} />
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/snippet}

<div class="phases">
  {#each PHASES as F, i (F.name)}
    <section class="phase" class:cur={i === s.phase} class:past={i < s.phase}>
      <div class="stack tight">
        <span class="label"
          >{F.period}{i === s.phase ? ' · fase atual' : i < s.phase ? ' · concluída' : ''}</span
        >
        <h2>{F.name}</h2>
      </div>
      {#if i === s.phase}
        {@render content(F, i)}
      {:else}
        <details>
          <summary>Ver conteúdo</summary>
          <div class="stack open">{@render content(F, i)}</div>
        </details>
      {/if}
    </section>
  {/each}
</div>

<style>
  .phases {
    display: grid;
    gap: 1.5rem;
  }
  .phase {
    display: grid;
    gap: 0.8rem;
    border-left: 4px solid var(--border);
    padding-left: 1rem;
  }
  .phase.cur {
    border-left-color: var(--accent);
  }
  .phase.past {
    border-left-color: var(--ok);
  }
  h2 {
    margin: 0;
    font-size: 1.3rem;
  }
  h3 {
    margin: 0;
    font-size: 1.05rem;
  }
  p {
    margin: 0;
  }
  .label {
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--muted);
  }
  .stack {
    display: grid;
    gap: 0.6rem;
  }
  .stack.tight {
    gap: 0.25rem;
  }
  .open {
    margin-top: 0.75rem;
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1rem;
  }
  .item {
    display: grid;
    grid-template-columns: 2rem 1fr;
    gap: 0.6rem;
    align-items: start;
  }
  .topic {
    padding-block: 0.5rem;
    border-top: 1px solid var(--border);
  }
  .topic:first-child {
    border-top: 0;
  }
  .check {
    width: 1.8rem;
    height: 1.8rem;
    min-height: 0;
    padding: 0;
    border-radius: 6px;
    border: 2px solid var(--muted);
    background: none;
    display: grid;
    place-items: center;
    color: var(--surface);
    font-weight: 700;
  }
  .check.on {
    background: var(--ok);
    border-color: var(--ok);
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  summary {
    cursor: pointer;
  }
</style>
