<script lang="ts">
  // Vídeos e partituras externos (abrem no navegador ou no app do YouTube).
  import type { Link } from '../../trail/content';

  let { links }: { links: Link[] } = $props();
</script>

{#if links.length}
  <div class="links">
    {#each links as l (l.url)}
      <a href={l.url} target="_blank" rel="noopener">{l.recommended ? '★ ' : ''}{l.text}</a>
    {/each}
  </div>
{/if}

<style>
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    font-size: 0.9rem;
  }
  a {
    color: var(--accent);
    font-weight: 600;
    text-underline-offset: 3px;
  }
</style>
