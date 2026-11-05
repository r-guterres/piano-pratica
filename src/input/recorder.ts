// Gravador: guarda teclas e pedal com o instante relativo ao início. Ao parar,
// solta o que ainda estava preso, para a gravação não terminar com notas
// penduradas. Puro.

import type { InputEvent, Millis, MidiPitch } from '../core/events';

export class Recorder {
  readonly #start: Millis;
  readonly #events: InputEvent[] = [];
  readonly #held = new Set<MidiPitch>();
  #pedal = false;

  constructor(start: Millis) {
    this.#start = start;
  }

  get count(): number {
    return this.#events.length;
  }

  add(e: InputEvent): void {
    if (e.t < this.#start) return;
    if (e.type === 'pedal') {
      if (e.down === this.#pedal) return;
      this.#pedal = e.down;
    } else if (e.type === 'on') this.#held.add(e.pitch);
    // soltura de tecla apertada antes de começar: não entra
    else if (!this.#held.delete(e.pitch)) return;
    this.#events.push({ ...e, t: e.t - this.#start });
  }

  /** Termina a gravação em `end` e devolve os eventos (t em ms desde o início). */
  stop(end: Millis): { events: InputEvent[]; durationMs: number } {
    const t = Math.max(0, end - this.#start);
    for (const pitch of this.#held) this.#events.push({ type: 'off', pitch, velocity: 0, t });
    this.#held.clear();
    if (this.#pedal) this.#events.push({ type: 'pedal', value: 0, down: false, t });
    this.#pedal = false;
    return { events: [...this.#events], durationMs: t };
  }
}
