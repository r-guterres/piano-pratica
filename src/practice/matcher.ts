// Comparação de notas tocadas com UM passo esperado. Não sabe nada de modo de
// prática (espera, tempo…): só classifica cada note-on. Puro.

import type { MidiPitch } from '../core/events';

export type MatchResult =
  /** altura exigida, tocada pela primeira vez neste passo */
  | 'required'
  /** altura exigida que já tinha sido tocada neste passo */
  | 'repeat'
  /** não exigida, mas aceitável (ligadura, apojatura, outra mão) */
  | 'tolerated'
  /** fora do esperado */
  | 'wrong';

export class StepMatcher {
  readonly required: ReadonlySet<MidiPitch>;
  readonly tolerated: ReadonlySet<MidiPitch>;
  readonly #played = new Set<MidiPitch>();

  constructor(required: Iterable<MidiPitch>, tolerated: Iterable<MidiPitch> = []) {
    this.required = new Set(required);
    this.tolerated = new Set(tolerated);
  }

  /**
   * Acumula os note-on desde o início do passo (PLANO_INICIAL.md §5.2): a ordem
   * não importa e soltar a tecla não desfaz nada.
   */
  noteOn(pitch: MidiPitch): MatchResult {
    if (this.required.has(pitch)) {
      if (this.#played.has(pitch)) return 'repeat';
      this.#played.add(pitch);
      return 'required';
    }
    return this.tolerated.has(pitch) ? 'tolerated' : 'wrong';
  }

  /** O conjunto exigido está contido no acumulado. */
  get complete(): boolean {
    return this.#played.size === this.required.size;
  }

  get played(): MidiPitch[] {
    return [...this.#played].sort((a, b) => a - b);
  }

  get missing(): MidiPitch[] {
    return [...this.required].filter((p) => !this.#played.has(p)).sort((a, b) => a - b);
  }
}
