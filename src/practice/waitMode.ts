// Modo espera: o cursor só avança quando o passo inteiro foi tocado. Recebe
// eventos de entrada e devolve o que aconteceu; quem desenha é a UI. Puro.

import type { InputEvent, Millis, MidiPitch } from '../core/events';
import type { Step } from '../score/steps';
import { StepMatcher } from './matcher';

/** Trecho em loop, em índices de compasso (0 = primeiro), inclusive. */
export interface LoopRange {
  startMeasure: number;
  endMeasure: number;
}

export interface Mistake {
  step: number;
  measure: number;
  expected: MidiPitch[];
  played: MidiPitch;
  t: Millis;
}

export type WaitModeEvent =
  | { type: 'started'; t: Millis }
  | { type: 'hit'; step: Step; pitch: MidiPitch; t: Millis }
  | { type: 'wrong'; step: Step; pitch: MidiPitch; t: Millis }
  /** passo concluído; `clean` = sem nenhum erro nele; `to` = null no fim */
  | { type: 'advance'; from: Step; to: Step | null; clean: boolean; t: Millis }
  /** loop: voltou ao início do trecho */
  | { type: 'lap'; lap: number; to: Step; t: Millis }
  | { type: 'finished'; summary: WaitModeSummary };

export interface WaitModeSummary {
  /** Passos concluídos (somando todas as voltas do loop). */
  completed: number;
  /** Concluídos sem erro. */
  clean: number;
  /** Total de notas erradas. */
  wrongNotes: number;
  /** Notas erradas por compasso (índice 0 = primeiro compasso). */
  errorsByMeasure: Record<number, number>;
  mistakes: Mistake[];
  /** Do primeiro note-on até o último evento, em ms. */
  durationMs: number;
  /** Voltas completas do loop. */
  laps: number;
  /** Tempo médio por passo (ms), do fim do passo anterior até completar. */
  meanStepMs: number | null;
}

/**
 * Resolve o trecho de loop em índices de passo: do primeiro passo no compasso
 * inicial até o fim da sequência contínua dentro do trecho (se a peça tiver
 * ritornelo, o trecho é o da primeira passagem).
 */
export function loopStepRange(
  steps: readonly Step[],
  loop: LoopRange,
): { first: number; last: number } | null {
  const inside = (s: Step) => s.measure >= loop.startMeasure && s.measure <= loop.endMeasure;
  const first = steps.findIndex(inside);
  if (first === -1) return null;
  let last = first;
  while (last + 1 < steps.length && inside(steps[last + 1]!)) last++;
  return { first, last };
}

export class WaitMode {
  readonly steps: readonly Step[];
  readonly #first: number;
  readonly #last: number;
  readonly #looping: boolean;

  #index: number;
  #matcher: StepMatcher | null = null;
  #stepErrors = 0;
  #stepStart: Millis | null = null;
  #startedAt: Millis | null = null;
  #lastEventAt: Millis | null = null;
  #finished = false;

  #completed = 0;
  #clean = 0;
  #laps = 0;
  #stepTimes: number[] = [];
  readonly #mistakes: Mistake[] = [];

  constructor(steps: readonly Step[], options: { loop?: LoopRange | null } = {}) {
    this.steps = steps;
    const range = options.loop ? loopStepRange(steps, options.loop) : null;
    this.#looping = range !== null;
    this.#first = range?.first ?? 0;
    this.#last = range?.last ?? steps.length - 1;
    this.#index = this.#first;
    this.#resetStep();
  }

  get current(): Step | null {
    return this.#finished ? null : (this.steps[this.#index] ?? null);
  }

  get finished(): boolean {
    return this.#finished;
  }

  get looping(): boolean {
    return this.#looping;
  }

  /** Primeiro e último passo do trecho praticado (a peça inteira, sem loop). */
  get range(): { first: number; last: number } {
    return { first: this.#first, last: this.#last };
  }

  /** Alturas do passo atual já tocadas. */
  get played(): MidiPitch[] {
    return this.#matcher?.played ?? [];
  }

  handle(event: InputEvent): WaitModeEvent[] {
    // note-off (inclusive note-on com velocity 0, já convertido) e pedal não
    // afetam a avaliação
    if (event.type !== 'on' || this.#finished) return [];
    const step = this.current;
    if (!step || !this.#matcher) return [];

    const out: WaitModeEvent[] = [];
    if (this.#startedAt === null) {
      this.#startedAt = event.t;
      out.push({ type: 'started', t: event.t });
    }
    this.#stepStart ??= event.t;
    this.#lastEventAt = event.t;

    const result = this.#matcher.noteOn(event.pitch);
    if (result === 'wrong') {
      this.#stepErrors++;
      this.#mistakes.push({
        step: step.index,
        measure: step.measure,
        expected: step.pitches,
        played: event.pitch,
        t: event.t,
      });
      out.push({ type: 'wrong', step, pitch: event.pitch, t: event.t });
      return out;
    }
    if (result !== 'required') return out;

    out.push({ type: 'hit', step, pitch: event.pitch, t: event.t });
    if (this.#matcher.complete) out.push(...this.#advance(step, event.t));
    return out;
  }

  /** Navegação manual: vai para o passo i (dentro do trecho). Não zera as estatísticas. */
  jumpTo(stepIndex: number): void {
    this.#index = Math.min(this.#last, Math.max(this.#first, stepIndex));
    this.#finished = false;
    this.#resetStep();
  }

  summary(): WaitModeSummary {
    const errorsByMeasure: Record<number, number> = {};
    for (const m of this.#mistakes)
      errorsByMeasure[m.measure] = (errorsByMeasure[m.measure] ?? 0) + 1;
    const times = this.#stepTimes;
    return {
      completed: this.#completed,
      clean: this.#clean,
      wrongNotes: this.#mistakes.length,
      errorsByMeasure,
      mistakes: [...this.#mistakes],
      durationMs:
        this.#startedAt === null || this.#lastEventAt === null
          ? 0
          : this.#lastEventAt - this.#startedAt,
      laps: this.#laps,
      meanStepMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    };
  }

  #advance(from: Step, t: Millis): WaitModeEvent[] {
    const clean = this.#stepErrors === 0;
    this.#completed++;
    if (clean) this.#clean++;
    if (this.#stepStart !== null) this.#stepTimes.push(t - this.#stepStart);

    if (this.#index < this.#last) {
      this.#index++;
      this.#resetStep(t);
      return [{ type: 'advance', from, to: this.steps[this.#index]!, clean, t }];
    }
    if (this.#looping) {
      this.#laps++;
      this.#index = this.#first;
      this.#resetStep(t);
      const to = this.steps[this.#index]!;
      return [
        { type: 'advance', from, to, clean, t },
        { type: 'lap', lap: this.#laps, to, t },
      ];
    }
    this.#finished = true;
    this.#matcher = null;
    return [
      { type: 'advance', from, to: null, clean, t },
      { type: 'finished', summary: this.summary() },
    ];
  }

  #resetStep(t: Millis | null = null): void {
    const step = this.steps[this.#index];
    this.#matcher = step ? new StepMatcher(step.pitches, step.tolerated) : null;
    this.#stepErrors = 0;
    this.#stepStart = t;
  }
}
