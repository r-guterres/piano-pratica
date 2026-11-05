// Toca uma agenda: a cada 25 ms pede ao Sequencer os eventos dos próximos
// ~150 ms e os agenda nas saídas (som) com horário exato; o cursor e o
// indicador de tempo são atualizados na tela no instante em que o som sai.
//
// Se alguma saída tem atraso (alto-falante), as demais (MIDI, tela) esperam o
// mesmo tanto, para tudo coincidir com o que se ouve.

import type { PlaybackEvent, Schedule } from './schedule';
import { Sequencer, type TimedEvent } from './sequencer';
import type { Sink } from './sinks';

const TICK_MS = 25;
const LOOKAHEAD_MS = 150;
const LEAD_MS = 120;

export interface PlayerOutputs {
  /** Onde soa o metrônomo (null = mudo). */
  clicks: Sink | null;
  /** Onde soam as notas (null = mudo). */
  notes: Sink | null;
}

/** O que a tela recebe: cursor, cliques (para o indicador de tempo) e voltas do loop. */
export type VisualEvent = Extract<TimedEvent, { kind: 'cursor' | 'click' | 'lap' }>;

export class Player {
  readonly #out: PlayerOutputs;
  readonly #onVisual: (e: VisualEvent) => void;
  readonly #onEnd: () => void;
  #seq: Sequencer | null = null;
  #start = 0;
  #delay = 0;
  #countInMs = 0;
  #timer: ReturnType<typeof setInterval> | undefined;
  #raf = 0;
  #visual: { at: number; e: VisualEvent }[] = [];

  constructor(out: PlayerOutputs, onVisual: (e: VisualEvent) => void, onEnd: () => void) {
    this.#out = out;
    this.#onVisual = onVisual;
    this.#onEnd = onEnd;
  }

  get playing(): boolean {
    return this.#seq !== null;
  }

  /** Instante (performance.now) em que o início do trecho é ouvido, depois da contagem. */
  get bodyOrigin(): number {
    return this.#start + this.#delay + this.#countInMs;
  }

  start(schedule: Schedule, loop: boolean): void {
    this.stop();
    this.#seq = new Sequencer(schedule, loop);
    const sinks = [this.#out.clicks, this.#out.notes].filter((s): s is Sink => s !== null);
    this.#delay = Math.max(0, ...sinks.map((s) => s.latencyMs));
    this.#start = performance.now() + LEAD_MS;
    this.#countInMs = schedule.countInMs;
    this.#tick();
    this.#timer = setInterval(() => this.#tick(), TICK_MS);
    this.#raf = requestAnimationFrame(() => this.#frame());
  }

  stop(): void {
    if (!this.#seq) return;
    this.#seq = null;
    clearInterval(this.#timer);
    cancelAnimationFrame(this.#raf);
    this.#visual = [];
    this.#out.clicks?.stop();
    if (this.#out.notes !== this.#out.clicks) this.#out.notes?.stop();
  }

  #tick(): void {
    const seq = this.#seq;
    if (!seq) return;
    const horizon = performance.now() + LOOKAHEAD_MS - this.#start;
    for (const e of seq.pull(horizon)) {
      // instante em que o som é ouvido
      const heard = this.#start + this.#delay + e.t;
      this.#dispatch(e, heard);
    }
  }

  #dispatch(e: TimedEvent, heard: number): void {
    const { clicks, notes } = this.#out;
    switch (e.kind) {
      case 'click':
        clicks?.click(heard - clicks.latencyMs, e.accent);
        this.#visual.push({ at: heard, e });
        break;
      case 'on':
        notes?.noteOn(heard - notes.latencyMs, e.pitch, e.velocity);
        break;
      case 'off':
        notes?.noteOff(heard - notes.latencyMs, e.pitch);
        break;
      case 'pedal':
        notes?.pedal(heard - notes.latencyMs, e.down);
        break;
      case 'cursor':
      case 'lap':
        this.#visual.push({ at: heard, e });
        break;
    }
  }

  #frame(): void {
    const seq = this.#seq;
    if (!seq) return;
    const now = performance.now();
    while (this.#visual.length && this.#visual[0]!.at <= now)
      this.#onVisual(this.#visual.shift()!.e);
    // a tela pode ter parado (ou recomeçado) o Player dentro do callback
    if (this.#seq !== seq) return;
    const end = seq.endMs;
    if (seq.done && end !== null && now >= this.#start + this.#delay + end) {
      this.stop();
      this.#onEnd();
      return;
    }
    this.#raf = requestAnimationFrame(() => this.#frame());
  }
}

export type { PlaybackEvent };
