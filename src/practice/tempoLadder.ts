// Escada de andamento: depois de N voltas limpas seguidas no loop, sobe o
// andamento alguns bpm (até um alvo). Uma volta com erro zera a sequência. Puro.

export interface TempoLadderOptions {
  /** Quanto sobe a cada degrau (bpm). */
  step: number;
  /** Voltas limpas seguidas para subir. */
  needed: number;
  /** Andamento-alvo: não passa dele. */
  target: number;
}

export class TempoLadder {
  readonly options: TempoLadderOptions;
  #streak = 0;

  constructor(options: TempoLadderOptions) {
    this.options = options;
  }

  /** Voltas limpas seguidas até agora. */
  get streak(): number {
    return this.#streak;
  }

  /** Registra uma volta; devolve o novo andamento quando é hora de subir (senão null). */
  record(clean: boolean, bpm: number): number | null {
    if (!clean) {
      this.#streak = 0;
      return null;
    }
    if (bpm >= this.options.target) return null;
    if (++this.#streak < this.options.needed) return null;
    this.#streak = 0;
    return Math.min(this.options.target, bpm + this.options.step);
  }
}
