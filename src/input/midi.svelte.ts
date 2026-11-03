// Conexão MIDI única para o app inteiro: o Monitor e o leitor de partitura
// compartilham o mesmo MIDIAccess. Notas e pedal são repassados ao inputHub.

import {
  checkMidiSupport,
  describeMidiError,
  MidiConnection,
  type MidiDeviceInfo,
} from '../midi/access';
import { inputHub } from './hub';

export type MidiStatus = 'idle' | 'connecting' | 'ready' | 'error' | 'unsupported';

export const midi: {
  status: MidiStatus;
  error: string;
  devices: MidiDeviceInfo[];
} = $state({ status: 'idle', error: '', devices: [] });

let connection: MidiConnection | null = null;
let pending: Promise<MidiConnection | null> | null = null;

export function getMidiConnection(): MidiConnection | null {
  return connection;
}

/** Pede acesso MIDI (mostra o pedido de permissão na primeira vez). */
export function connectMidi(): Promise<MidiConnection | null> {
  if (connection) return Promise.resolve(connection);
  pending ??= open().finally(() => (pending = null));
  return pending;
}

async function open(): Promise<MidiConnection | null> {
  const support = checkMidiSupport();
  if (!support.ok) {
    midi.status = 'unsupported';
    midi.error = support.message;
    return null;
  }
  midi.status = 'connecting';
  midi.error = '';
  try {
    connection = await MidiConnection.open();
  } catch (err) {
    midi.status = 'error';
    midi.error = describeMidiError(err);
    return null;
  }
  midi.status = 'ready';
  midi.devices = connection.inputs;
  connection.onDevicesChange((list) => (midi.devices = list));
  connection.onMessage((msg) => {
    if (msg.kind === 'note' || msg.kind === 'pedal') inputHub.emit(msg.event, 'midi');
  });
  return connection;
}

/** Conecta sem perguntar nada se a permissão já foi concedida antes. */
export async function autoConnectMidi(): Promise<void> {
  if (!checkMidiSupport().ok) return;
  try {
    const status = await navigator.permissions.query({ name: 'midi' as PermissionName });
    if (status.state === 'granted') await connectMidi();
  } catch {
    // navegador sem Permissions API para MIDI: o usuário conecta pelo botão
  }
}

export function connectedDeviceNames(): string[] {
  return midi.devices.filter((d) => d.state === 'connected').map((d) => d.name);
}
