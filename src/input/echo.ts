// Filtro de eco: quando o app toca notas pelo Casio (saída MIDI), alguns
// teclados devolvem essas mesmas notas pela entrada. Sem o filtro, o app as
// trataria como se o aluno tivesse tocado. Puro.

import type { Millis, MidiPitch } from '../core/events';

export class EchoFilter {
  readonly #window: number;
  /** note-ons enviados, por altura: instantes (performance.now). */
  readonly #sent = new Map<MidiPitch, Millis[]>();
  /** Alturas cujo note-on foi descartado como eco: o note-off também é. */
  readonly #echoed = new Set<MidiPitch>();

  constructor(windowMs = 80) {
    this.#window = windowMs;
  }

  /** Registra um note-on enviado ao teclado para soar em `at`. */
  sent(pitch: MidiPitch, at: Millis): void {
    const list = (this.#sent.get(pitch) ?? []).filter((t) => t > at - 10 * this.#window);
    list.push(at);
    this.#sent.set(pitch, list);
  }

  /** true se o note-on recebido é eco de um enviado (e o consome). */
  isEchoOn(pitch: MidiPitch, t: Millis): boolean {
    const list = this.#sent.get(pitch);
    const i = list?.findIndex((at) => t >= at - 5 && t <= at + this.#window) ?? -1;
    if (i < 0) return false;
    list!.splice(i, 1);
    this.#echoed.add(pitch);
    return true;
  }

  /** true se o note-off recebido fecha uma nota que foi descartada como eco. */
  isEchoOff(pitch: MidiPitch): boolean {
    return this.#echoed.delete(pitch);
  }
}
