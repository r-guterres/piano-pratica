<script lang="ts">
  import { onDestroy } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { pitchName } from '../core/pitch';
  import { connectMidi, getMidiConnection, midi } from '../input/midi.svelte';
  import { checkMidiSupport, type MidiConnection, type MidiDeviceInfo } from '../midi/access';
  import { formatBytes, type MidiMessage } from '../midi/parse';
  import PianoKeyboard from './PianoKeyboard.svelte';
  import { settings } from './settings.svelte';

  type RowBase = { id: number; t: number; device: string; channel: number | null };
  type EventRow = RowBase &
    (
      | { kind: 'note'; on: boolean; pitch: number; velocity: number }
      | { kind: 'pedal'; value: number; down: boolean }
      | { kind: 'other'; description: string }
    );

  const MAX_ROWS = 100;
  const MAX_LOG = 300;

  const support = checkMidiSupport();
  const commit = (import.meta.env.VITE_COMMIT ?? 'dev').slice(0, 7);
  const buildTime = new Date(__BUILD_TIME__).toLocaleString('pt-BR');

  let selectedId = $state<string>('');
  let rows = $state<EventRow[]>([]);
  let log = $state<string[]>([]);
  let ignoredCount = $state(0);
  let pedalDown = $state(false);
  let lastNote = $state<{ pitch: number; velocity: number } | null>(null);
  const held = new SvelteSet<number>();

  // A conexão MIDI é do app inteiro (input/midi.svelte.ts); o monitor só a escuta.
  let unsubscribe: (() => void)[] = [];
  let t0: number | null = null;
  let nextId = 0;

  const heldNames = $derived(
    [...held].sort((a, b) => a - b).map((p) => pitchName(p, settings.naming)),
  );

  function addLog(line: string) {
    const time = new Date().toLocaleTimeString('pt-BR');
    log = [`${time}  ${line}`, ...log].slice(0, MAX_LOG);
  }

  function relTime(t: number): number {
    t0 ??= t;
    return (t - t0) / 1000;
  }

  function handleMessage(msg: MidiMessage, raw: Uint8Array, source: MidiDeviceInfo) {
    if (msg.kind === 'ignored') {
      ignoredCount++;
      return;
    }
    addLog(`[${source.name}] ${formatBytes(raw)}`);
    const base = { id: nextId++, device: source.name };
    let row: EventRow;
    if (msg.kind === 'note') {
      const e = msg.event;
      if (e.type === 'on') {
        held.add(e.pitch);
        lastNote = { pitch: e.pitch, velocity: e.velocity };
      } else {
        held.delete(e.pitch);
      }
      row = {
        ...base,
        t: relTime(e.t),
        kind: 'note',
        on: e.type === 'on',
        pitch: e.pitch,
        velocity: e.velocity,
        channel: msg.channel,
      };
    } else if (msg.kind === 'pedal') {
      pedalDown = msg.event.down;
      row = {
        ...base,
        t: relTime(msg.event.t),
        kind: 'pedal',
        value: msg.event.value,
        down: msg.event.down,
        channel: msg.channel,
      };
    } else {
      row = {
        ...base,
        t: relTime(performance.now()),
        kind: 'other',
        description: msg.description,
        channel: msg.channel,
      };
    }
    rows = [row, ...rows].slice(0, MAX_ROWS);
  }

  function describeDevice(d: MidiDeviceInfo): string {
    return `${d.name}${d.manufacturer ? ` (${d.manufacturer})` : ''} — ${d.state}/${d.connection}`;
  }

  function attach(connection: MidiConnection) {
    if (unsubscribe.length) return;
    addLog(`Acesso MIDI ativo. ${connection.inputs.length} entrada(s).`);
    for (const d of connection.inputs) addLog(`  • ${describeDevice(d)}`);
    unsubscribe = [
      connection.onMessage(handleMessage),
      connection.onDevicesChange((list, changed) => {
        if (changed) addLog(`Dispositivo: ${describeDevice(changed)}`);
        if (selectedId && !list.some((d) => d.id === selectedId && d.state === 'connected')) {
          held.clear();
        }
      }),
    ];
  }

  // pega a conexão também quando ela é aberta automaticamente ou em outra tela
  $effect(() => {
    if (midi.status === 'ready') {
      const c = getMidiConnection();
      if (c) attach(c);
    }
  });

  async function connect() {
    addLog('Pedindo acesso MIDI…');
    const c = await connectMidi();
    if (c) attach(c);
    else addLog(`Erro: ${midi.error}`);
  }

  function selectDevice() {
    getMidiConnection()?.select(selectedId || null);
    held.clear();
    addLog(
      `Escutando: ${selectedId ? (midi.devices.find((d) => d.id === selectedId)?.name ?? selectedId) : 'todos'}`,
    );
  }

  function clearAll() {
    rows = [];
    log = [];
    ignoredCount = 0;
    held.clear();
    lastNote = null;
    t0 = null;
  }

  async function copyLog() {
    const text = [
      `piano-pratica ${commit} (${buildTime})`,
      navigator.userAgent,
      ...midi.devices.map(describeDevice),
      '',
      ...log.toReversed(),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      addLog('Log copiado para a área de transferência.');
    } catch {
      addLog('Não consegui copiar o log (permissão da área de transferência).');
    }
  }

  onDestroy(() => unsubscribe.forEach((off) => off()));
</script>

<section class="card">
  <h2>Diagnóstico</h2>
  <ul class="checks">
    <li class:ok={window.isSecureContext} class:bad={!window.isSecureContext}>
      Contexto seguro (HTTPS): {window.isSecureContext ? 'sim' : 'não'}
    </li>
    <li class:ok={'requestMIDIAccess' in navigator} class:bad={!('requestMIDIAccess' in navigator)}>
      Web MIDI no navegador: {'requestMIDIAccess' in navigator ? 'sim' : 'não'}
    </li>
    <li class="muted">Versão {commit} · build {buildTime}</li>
  </ul>
  {#if !support.ok}
    <p class="error">{support.message}</p>
  {/if}
</section>

<section class="card">
  <h2>Dispositivos</h2>
  {#if midi.status === 'idle' || midi.status === 'error'}
    <button class="primary" onclick={connect} disabled={!support.ok}>Conectar MIDI</button>
  {:else if midi.status === 'connecting'}
    <p>Aguardando permissão… (aceite o pedido do navegador)</p>
  {/if}
  {#if midi.error}<p class="error">{midi.error}</p>{/if}

  {#if midi.status === 'ready'}
    {#if midi.devices.length === 0}
      <p class="warn">
        Nenhuma entrada MIDI. Confira o cabo OTG, ligue o teclado e espere alguns segundos — a lista
        se atualiza sozinha.
      </p>
    {:else}
      <ul class="devices">
        {#each midi.devices as d (d.id)}
          <li class:disconnected={d.state !== 'connected'}>
            <strong>{d.name}</strong>
            {#if d.manufacturer}<span class="muted"> · {d.manufacturer}</span>{/if}
            <span class="badge">{d.state === 'connected' ? 'conectado' : 'desconectado'}</span>
          </li>
        {/each}
      </ul>
      <label class="field">
        Escutar
        <select bind:value={selectedId} onchange={selectDevice}>
          <option value="">Todos os dispositivos</option>
          {#each midi.devices as d (d.id)}
            <option value={d.id}>{d.name}</option>
          {/each}
        </select>
      </label>
    {/if}
  {/if}
</section>

<section class="card now">
  <div class="now-head">
    <h2>Agora</h2>
    <span class="pedal" class:down={pedalDown}>Pedal {pedalDown ? 'abaixado' : 'solto'}</span>
  </div>
  <p class="held" aria-live="polite">
    {heldNames.length ? heldNames.join(' · ') : '—'}
  </p>
  {#if lastNote}
    <div class="velocity">
      <span
        >Última: {pitchName(lastNote.pitch, settings.naming)} ({lastNote.pitch}) · velocity {lastNote.velocity}</span
      >
      <div class="bar"><div style:width="{(lastNote.velocity / 127) * 100}%"></div></div>
    </div>
  {/if}
  <PianoKeyboard active={held} />
</section>

<section class="card">
  <div class="now-head">
    <h2>Eventos</h2>
    <button onclick={clearAll}>Limpar</button>
  </div>
  {#if ignoredCount > 0}
    <p class="muted small">
      {ignoredCount} mensagem(ns) de sistema ignorada(s) (Active Sensing/Clock).
    </p>
  {/if}
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>t (s)</th><th>Tipo</th><th>Nota</th><th>Nº</th><th>Vel.</th><th>Canal</th></tr>
      </thead>
      <tbody>
        {#each rows as r (r.id)}
          <tr class={r.kind === 'note' ? (r.on ? 'on' : 'off') : r.kind}>
            <td>{r.t.toFixed(3)}</td>
            {#if r.kind === 'note'}
              <td>{r.on ? 'note-on' : 'note-off'}</td>
              <td>{pitchName(r.pitch, settings.naming)}</td>
              <td>{r.pitch}</td>
              <td>{r.velocity}</td>
            {:else if r.kind === 'pedal'}
              <td>pedal</td>
              <td colspan="2">{r.down ? 'abaixado' : 'solto'}</td>
              <td>{r.value}</td>
            {:else}
              <td colspan="4">{r.description}</td>
            {/if}
            <td>{r.channel ?? '—'}</td>
          </tr>
        {:else}
          <tr><td colspan="6" class="muted">Toque uma nota no teclado.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<p class="muted small">Nomes das notas (Dó/C, oitava, ♯/♭): em <strong>Configurações</strong>.</p>

<section class="card">
  <div class="now-head">
    <h2>Log de diagnóstico</h2>
    <button onclick={copyLog}>Copiar log</button>
  </div>
  <pre class="log">{log.join('\n') || '(vazio)'}</pre>
</section>

<style>
  .checks {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.25rem;
  }
  .checks li.ok::before {
    content: '✓ ';
    color: var(--ok);
  }
  .checks li.bad::before {
    content: '✗ ';
    color: var(--bad);
  }
  .devices {
    list-style: none;
    padding: 0;
    margin: 0 0 0.75rem;
  }
  .devices li {
    padding: 0.4rem 0;
  }
  .devices li.disconnected {
    opacity: 0.55;
  }
  .badge {
    font-size: 0.8rem;
    margin-left: 0.5rem;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: var(--surface-2);
  }
  .now-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .held {
    font-size: clamp(1.8rem, 6vw, 3rem);
    font-weight: 600;
    margin: 0.5rem 0;
    min-height: 1.3em;
  }
  .pedal {
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: var(--surface-2);
  }
  .pedal.down {
    background: var(--accent);
    color: var(--on-accent);
  }
  .velocity {
    margin-bottom: 0.75rem;
  }
  .bar {
    height: 0.5rem;
    background: var(--surface-2);
    border-radius: 999px;
    overflow: hidden;
    margin-top: 0.3rem;
  }
  .bar > div {
    height: 100%;
    background: var(--accent);
  }
  .table-wrap {
    max-height: 22rem;
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    text-align: left;
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--border);
  }
  tr.off td {
    color: var(--muted);
  }
  tr.pedal td,
  tr.other td {
    font-style: italic;
  }
  .settings {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .field {
    display: inline-flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  .log {
    max-height: 16rem;
    overflow: auto;
    font-size: 0.8rem;
    background: var(--surface-2);
    padding: 0.75rem;
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .error {
    color: var(--bad);
  }
  .warn {
    color: var(--warn);
  }
  .small {
    font-size: 0.85rem;
  }
</style>
