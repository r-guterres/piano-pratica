<script lang="ts">
  import { isBlackKey } from '../core/pitch';

  // Teclado desenhado. Só exibe, ou também toca se receber onpress/onrelease
  // (teclado virtual, com multitoque para acordes).
  let {
    low = 36,
    high = 96,
    active,
    marked,
    onpress,
    onrelease,
  }: {
    low?: number;
    high?: number;
    active: ReadonlySet<number>;
    /** Teclas destacadas (ex.: notas esperadas no passo atual). */
    marked?: ReadonlySet<number>;
    onpress?: (pitch: number) => void;
    onrelease?: (pitch: number) => void;
  } = $props();

  const interactive = $derived(onpress !== undefined);

  const layout = $derived.by(() => {
    const whites: { pitch: number; index: number }[] = [];
    const blacks: { pitch: number; boundary: number }[] = [];
    for (let p = low; p <= high; p++) {
      if (isBlackKey(p)) blacks.push({ pitch: p, boundary: whites.length });
      else whites.push({ pitch: p, index: whites.length });
    }
    return { whites, blacks, count: whites.length };
  });

  // dedo (pointerId) → tecla que ele está segurando; registro interno, não precisa ser reativo
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const pointers = new Map<number, number>();

  function down(e: PointerEvent) {
    if (!onpress) return;
    const pitch = Number((e.target as HTMLElement).dataset.pitch);
    if (Number.isNaN(pitch)) return;
    e.preventDefault();
    pointers.set(e.pointerId, pitch);
    onpress(pitch);
    try {
      // mantém o note-off certo mesmo se o dedo escorregar para fora da tecla
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ponteiro já inativo: o note-off virá por pointerup/pointercancel
    }
  }

  function up(e: PointerEvent) {
    const pitch = pointers.get(e.pointerId);
    if (pitch === undefined) return;
    pointers.delete(e.pointerId);
    onrelease?.(pitch);
  }
</script>

<div
  class="keyboard"
  class:interactive
  style:--n={layout.count}
  aria-hidden="true"
  onpointerdown={down}
  onpointerup={up}
  onpointercancel={up}
>
  {#each layout.whites as k (k.pitch)}
    <div
      class="key white"
      class:on={active.has(k.pitch)}
      class:marked={marked?.has(k.pitch)}
      class:middle-c={k.pitch === 60}
      data-pitch={k.pitch}
      style:left="calc({k.index} * 100% / var(--n))"
    ></div>
  {/each}
  {#each layout.blacks as k (k.pitch)}
    <div
      class="key black"
      class:on={active.has(k.pitch)}
      class:marked={marked?.has(k.pitch)}
      data-pitch={k.pitch}
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
  .keyboard.interactive {
    touch-action: none;
    aspect-ratio: auto;
    height: clamp(5rem, 16vh, 9rem);
    max-height: none;
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
    max-width: 0.6rem;
    aspect-ratio: 1;
    transform: translateX(-50%);
    border-radius: 50%;
    background: var(--muted);
    pointer-events: none;
  }
  .key.marked {
    box-shadow: inset 0 -0.5rem 0 var(--marked);
  }
  .key.on {
    background: var(--accent);
  }
</style>
