<script lang="ts">
  import { isBlackKey } from '../core/pitch';

  // Teclado de exibição. Padrão: as 61 teclas do Casio CTK-3500 (Dó2–Dó7).
  let {
    low = 36,
    high = 96,
    active,
  }: { low?: number; high?: number; active: ReadonlySet<number> } = $props();

  const layout = $derived.by(() => {
    const whites: { pitch: number; index: number }[] = [];
    const blacks: { pitch: number; boundary: number }[] = [];
    for (let p = low; p <= high; p++) {
      if (isBlackKey(p)) blacks.push({ pitch: p, boundary: whites.length });
      else whites.push({ pitch: p, index: whites.length });
    }
    return { whites, blacks, count: whites.length };
  });
</script>

<div class="keyboard" style:--n={layout.count} aria-hidden="true">
  {#each layout.whites as k (k.pitch)}
    <div
      class="key white"
      class:on={active.has(k.pitch)}
      class:middle-c={k.pitch === 60}
      style:left="calc({k.index} * 100% / var(--n))"
    ></div>
  {/each}
  {#each layout.blacks as k (k.pitch)}
    <div
      class="key black"
      class:on={active.has(k.pitch)}
      style:left="calc({k.boundary} * 100% / var(--n))"
    ></div>
  {/each}
</div>

<style>
  .keyboard {
    position: relative;
    width: 100%;
    aspect-ratio: 9 / 1;
    max-height: 7rem;
    user-select: none;
  }
  .key {
    position: absolute;
    top: 0;
    box-sizing: border-box;
    border-radius: 0 0 3px 3px;
  }
  .white {
    width: calc(100% / var(--n));
    height: 100%;
    background: var(--key-white);
    border: 1px solid var(--key-border);
  }
  .black {
    width: calc(100% / var(--n) * 0.6);
    height: 62%;
    transform: translateX(-50%);
    background: var(--key-black);
    z-index: 1;
  }
  .middle-c::after {
    content: '';
    position: absolute;
    bottom: 8%;
    left: 50%;
    width: 30%;
    aspect-ratio: 1;
    transform: translateX(-50%);
    border-radius: 50%;
    background: var(--muted);
  }
  .key.on {
    background: var(--accent);
  }
</style>
