// Eventos normalizados de entrada. Tudo que vem do teclado (MIDI real, teclado
// virtual, teclado do computador) é convertido para estes tipos antes de chegar
// a practice/ e drills/, que não conhecem a origem nem o navegador.

/** Instante em milissegundos (mesma base de `performance.now()`). */
export type Millis = number;

/** Altura MIDI: 0–127, Dó central = 60. */
export type MidiPitch = number;

export interface NoteEvent {
  type: 'on' | 'off';
  pitch: MidiPitch;
  /** 1–127 em note-on; em note-off é a velocity de soltura (0 se desconhecida). */
  velocity: number;
  t: Millis;
}

/** Pedal de sustentação (CC64). Só é registrado; não afeta a avaliação. */
export interface PedalEvent {
  type: 'pedal';
  /** Valor bruto 0–127. */
  value: number;
  /** Convenção MIDI: valor ≥ 64 = pedal abaixado. */
  down: boolean;
  t: Millis;
}

export type InputEvent = NoteEvent | PedalEvent;
