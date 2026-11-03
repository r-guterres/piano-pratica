// Acesso à Web MIDI API: permissão, lista de dispositivos de entrada (com
// conexão/desconexão a quente) e entrega de mensagens já interpretadas.

import { parseMidiMessage, type MidiMessage } from './parse';

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: MIDIPortDeviceState;
  connection: MIDIPortConnectionState;
}

export type MidiSupport =
  { ok: true } | { ok: false; reason: 'insecure-context' | 'unsupported'; message: string };

export function checkMidiSupport(): MidiSupport {
  if (!window.isSecureContext) {
    return {
      ok: false,
      reason: 'insecure-context',
      message: 'A página não está em HTTPS; o navegador bloqueia o Web MIDI.',
    };
  }
  if (!('requestMIDIAccess' in navigator)) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Este navegador não suporta Web MIDI (use Chrome ou Edge).',
    };
  }
  return { ok: true };
}

/** Traduz a exceção de `requestMIDIAccess` para uma mensagem em português. */
export function describeMidiError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'SecurityError' || err.name === 'NotAllowedError') {
      return 'Permissão de MIDI negada. Libere em Configurações do site → Dispositivos MIDI.';
    }
    if (err.name === 'NotSupportedError') return 'Web MIDI não disponível neste dispositivo.';
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

export type MessageListener = (msg: MidiMessage, raw: Uint8Array, source: MidiDeviceInfo) => void;
export type DeviceListener = (devices: MidiDeviceInfo[], changed: MidiDeviceInfo | null) => void;

export class MidiConnection {
  readonly #access: MIDIAccess;
  #selectedId: string | null = null;
  readonly #messageListeners = new Set<MessageListener>();
  readonly #deviceListeners = new Set<DeviceListener>();

  private constructor(access: MIDIAccess) {
    this.#access = access;
    access.onstatechange = (e) => {
      const port = (e as MIDIConnectionEvent).port;
      if (port?.type === 'input' && port.state === 'connected') this.#attach(port as MIDIInput);
      const changed = port?.type === 'input' ? deviceInfo(port) : null;
      for (const l of this.#deviceListeners) l(this.inputs, changed);
    };
    for (const input of access.inputs.values()) this.#attach(input);
  }

  /** Pede permissão e abre o acesso MIDI (sem SysEx). Lança DOMException se negado. */
  static async open(): Promise<MidiConnection> {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    return new MidiConnection(access);
  }

  get inputs(): MidiDeviceInfo[] {
    return Array.from(this.#access.inputs.values(), deviceInfo);
  }

  /** Restringe a escuta a um dispositivo; `null` = todos. */
  select(id: string | null): void {
    this.#selectedId = id;
  }

  onMessage(listener: MessageListener): () => void {
    this.#messageListeners.add(listener);
    return () => this.#messageListeners.delete(listener);
  }

  onDevicesChange(listener: DeviceListener): () => void {
    this.#deviceListeners.add(listener);
    return () => this.#deviceListeners.delete(listener);
  }

  close(): void {
    this.#access.onstatechange = null;
    for (const input of this.#access.inputs.values()) {
      input.onmidimessage = null;
      void input.close();
    }
    this.#messageListeners.clear();
    this.#deviceListeners.clear();
  }

  // Atribuir `onmidimessage` abre a porta implicitamente. Reatribuímos a cada
  // reconexão porque alguns navegadores recriam a porta ao replugar o cabo.
  #attach(input: MIDIInput): void {
    input.onmidimessage = (e: MIDIMessageEvent) => {
      if (this.#selectedId !== null && input.id !== this.#selectedId) return;
      if (!e.data) return;
      const msg = parseMidiMessage(e.data, e.timeStamp);
      if (!msg) return;
      const source = deviceInfo(input);
      for (const l of this.#messageListeners) l(msg, e.data, source);
    };
  }
}

function deviceInfo(port: MIDIPort): MidiDeviceInfo {
  return {
    id: port.id,
    name: port.name ?? '(sem nome)',
    manufacturer: port.manufacturer ?? '',
    state: port.state,
    connection: port.connection,
  };
}
