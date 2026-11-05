// Monta as saídas do Player conforme as configurações: Casio (MIDI) ou
// alto-falante do tablet. Sem saída MIDI disponível, cai para o tablet.

import { echoFilter, midiOutput } from '../input/midi.svelte';
import { settings, type SoundOutput } from '../ui/settings.svelte';
import type { PlayerOutputs } from './player';
import { MidiSink, SpeakerSink, type Sink } from './sinks';

export interface Outputs extends PlayerOutputs {
  /** Aviso para a tela (ex.: pediu o Casio, mas ele não está conectado). */
  warning: string;
}

export function makeOutputs(want: { clicks: boolean; notes: boolean }): Outputs {
  const pb = settings.playback;
  const out = midiOutput();
  let midi: MidiSink | null = null;
  let speaker: SpeakerSink | null = null;
  let warning = '';
  const sink = (target: SoundOutput): Sink => {
    if (target === 'casio' && out)
      return (midi ??= new MidiSink(out, (p, at) => echoFilter.sent(p, at)));
    if (target === 'casio') warning = 'Teclado não conectado por MIDI: o som sai pelo tablet.';
    return (speaker ??= new SpeakerSink(pb.speakerLatencyMs));
  };
  return {
    clicks: want.clicks ? sink(pb.clickOutput) : null,
    notes: want.notes ? sink(pb.notesOutput) : null,
    warning,
  };
}
