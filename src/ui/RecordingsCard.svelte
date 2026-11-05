<script lang="ts">
  // Gravações feitas no leitor: ouvir (pelo Casio ou pelo tablet, conforme as
  // configurações de som), baixar como .mid e excluir.
  import { onDestroy } from 'svelte';
  import { writeSmf } from '../midi/smf';
  import { makeOutputs } from '../playback/outputs';
  import { Player } from '../playback/player';
  import { recordingSchedule } from '../playback/schedule';
  import { audioContext } from '../playback/sinks';
  import { appHistory, type RecordingInfo } from '../storage/history';
  import { dayKey } from '../storage/progress';

  let list = $state<RecordingInfo[] | null>(null);
  let error = $state('');
  let playingId = $state<string | null>(null);
  let player: Player | null = null;

  const refresh = () =>
    appHistory()
      .recordings()
      .then((r) => (list = r.toReversed()))
      .catch((err: unknown) => (error = `Não consegui ler as gravações: ${String(err)}`));
  void refresh();

  async function play(r: RecordingInfo) {
    stop();
    const full = await appHistory().recording(r.id);
    if (!full) return;
    audioContext();
    const out = makeOutputs({ clicks: false, notes: true });
    error = out.warning;
    player = new Player(
      out,
      () => {},
      () => (playingId = null),
    );
    player.start(recordingSchedule(full.events, full.durationMs), false);
    playingId = r.id;
  }

  function stop() {
    player?.stop();
    player = null;
    playingId = null;
  }

  async function download(r: RecordingInfo) {
    const full = await appHistory().recording(r.id);
    if (!full) return;
    const bytes = writeSmf(full.events, { name: r.title });
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/midi' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${r.title.replace(/[\\/:*?"<>|]/g, '')} ${dayKey(r.createdAt)}.mid`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function remove(r: RecordingInfo) {
    if (!confirm(`Excluir a gravação "${r.title}" de ${when(r.createdAt)}?`)) return;
    if (playingId === r.id) stop();
    await appHistory().deleteRecording(r.id);
    await refresh();
  }

  const when = (t: number) =>
    new Date(t).toLocaleString('pt-BR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  const duration = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  onDestroy(stop);
</script>

<section class="card">
  <h2>Gravações</h2>
  {#if error}<p class="warn">{error}</p>{/if}
  {#if list === null}
    <p class="muted">Carregando…</p>
  {:else if list.length === 0}
    <p class="muted">
      Nenhuma gravação ainda. No leitor de partitura, toque em ● Gravar: ficam guardadas as teclas e
      o pedal, para ouvir aqui ou baixar como .mid.
    </p>
  {:else}
    <ul>
      {#each list as r (r.id)}
        <li>
          <span class="info">
            <b>{r.title}</b>
            <span class="muted"
              >{when(r.createdAt)} · {duration(r.durationMs)} · {r.notes} notas</span
            >
          </span>
          <span class="actions">
            <button onclick={() => (playingId === r.id ? stop() : play(r))}>
              {playingId === r.id ? '■ Parar' : '▶ Ouvir'}
            </button>
            <button onclick={() => download(r)} title="Baixar como arquivo MIDI">⬇ .mid</button>
            <button onclick={() => remove(r)} aria-label="Excluir {r.title}">×</button>
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--grid);
  }
  .info {
    display: grid;
  }
  .muted {
    font-size: 0.85rem;
  }
  .actions {
    display: flex;
    gap: 0.4rem;
  }
  .warn {
    color: var(--warn);
  }
</style>
