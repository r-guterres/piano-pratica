<script lang="ts">
  // Botão ● Gravar: grava as teclas e o pedal enquanto estiver ligado e salva
  // em Progresso → Gravações. Para ao sair da tela ou ir para segundo plano.
  import { onDestroy } from 'svelte';
  import { inputHub } from '../input/hub';
  import { Recorder } from '../input/recorder';
  import { appHistory, newId } from '../storage/history';

  let {
    title,
    scoreId = null,
    onsaved = () => {},
  }: {
    /** Nome da gravação na lista (ex.: o título da partitura). */
    title: string;
    scoreId?: string | null;
    onsaved?: () => void;
  } = $props();

  let recorder = $state.raw<Recorder | null>(null);
  let startedAt = 0;
  let note = $state('');
  let clock = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  const unsubscribe = inputHub.subscribe((e) => recorder?.add(e));

  function start() {
    startedAt = Date.now();
    recorder = new Recorder(performance.now());
    note = '';
    clock = 0;
    timer = setInterval(() => (clock = Date.now() - startedAt), 500);
  }

  function stop() {
    if (!recorder) return;
    clearInterval(timer);
    const { events, durationMs } = recorder.stop(performance.now());
    recorder = null;
    if (!events.length) {
      note = 'Nada foi tocado: gravação descartada.';
      return;
    }
    appHistory()
      .saveRecording({ id: newId(), createdAt: startedAt, title, scoreId, durationMs, events })
      .then(() => {
        note = 'Gravação salva: ouça em Progresso → Gravações.';
        onsaved();
      })
      .catch((err: unknown) => (note = `Não consegui salvar a gravação: ${String(err)}`));
  }

  const clockText = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const onHidden = () => document.visibilityState === 'hidden' && stop();
  document.addEventListener('visibilitychange', onHidden);
  onDestroy(() => {
    stop();
    unsubscribe();
    document.removeEventListener('visibilitychange', onHidden);
  });
</script>

<button
  class="rec"
  class:on={recorder !== null}
  onclick={() => (recorder ? stop() : start())}
  title="Grava o que você toca (teclas e pedal)"
>
  {recorder ? `■ ${clockText(clock)}` : '● Gravar'}
</button>
{#if note}<span class="muted note">{note}</span>{/if}

<style>
  .rec.on {
    background: var(--bad);
    border-color: var(--bad);
    color: #fff;
    font-variant-numeric: tabular-nums;
  }
  .note {
    font-size: 0.85rem;
  }
</style>
