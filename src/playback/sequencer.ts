// Entrega os eventos de uma agenda em ordem, aos poucos ("até o instante x"),
// repetindo o trecho quando há loop. O Player pede sempre um pouco à frente do
// relógio e agenda o que recebe. Puro.

import type { PlaybackEvent, Schedule } from './schedule';

/** Evento com `t` absoluto (ms desde o play, contagem incluída). */
export type TimedEvent = (PlaybackEvent | { t: number; kind: 'lap'; lap: number }) & {
  lap: number;
};

export class Sequencer {
  readonly #s: Schedule;
  readonly #loop: boolean;
  #inCountIn: boolean;
  #i = 0;
  #lap = 0;

  constructor(schedule: Schedule, loop: boolean) {
    this.#s = schedule;
    // loop de trecho vazio repetiria para sempre no mesmo instante
    this.#loop = loop && schedule.bodyMs > 0;
    this.#inCountIn = schedule.countIn.length > 0;
  }

  /** Fim da reprodução (ms), ou null se repete para sempre. */
  get endMs(): number | null {
    return this.#loop ? null : this.#s.countInMs + this.#s.bodyMs;
  }

  get done(): boolean {
    return !this.#loop && !this.#inCountIn && this.#i >= this.#s.body.length;
  }

  #lapStart(lap: number): number {
    return this.#s.countInMs + lap * this.#s.bodyMs;
  }

  /** Eventos com t < until ainda não entregues. */
  pull(until: number): TimedEvent[] {
    const out: TimedEvent[] = [];
    if (this.#inCountIn) {
      const list = this.#s.countIn;
      while (this.#i < list.length && list[this.#i]!.t < until)
        out.push({ ...list[this.#i++]!, lap: 0 });
      if (this.#i < list.length) return out;
      this.#inCountIn = false;
      this.#i = 0;
    }
    const body = this.#s.body;
    for (;;) {
      const start = this.#lapStart(this.#lap);
      while (this.#i < body.length && start + body[this.#i]!.t < until) {
        const e = body[this.#i++]!;
        out.push({ ...e, t: start + e.t, lap: this.#lap });
      }
      if (this.#i < body.length || !this.#loop) return out;
      // volta: o próximo trecho começa em start + bodyMs
      const next = this.#lapStart(this.#lap + 1);
      if (next >= until) return out;
      this.#lap++;
      this.#i = 0;
      out.push({ t: next, kind: 'lap', lap: this.#lap });
    }
  }
}
