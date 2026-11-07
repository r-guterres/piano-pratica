// Treino de acordes: o app pede um acorde numa inversão ("Am, 1ª inversão")
// e confere pelo MIDI as notas presas (as notas do acorde e a nota certa no
// baixo). Os acordes vêm da fase da Trilha. Puro.

import type { MidiPitch } from '../core/events';
import { checkInversion, spellChord, type SpelledChord } from '../practice/chords';
import type { Rng } from './priority';

export interface ChordQuestion {
  symbol: string;
  chord: SpelledChord;
  /** 0 = fundamental, 1 = 1ª inversão… */
  inv: number;
}

export type ChordAnswer =
  /** acertou (notas e baixo) */
  | 'correct'
  /** as notas estão certas, mas o baixo não */
  | 'wrong-bass'
  | 'wrong';

export interface ChordDrillStats {
  /** Acordes acertados. */
  correct: number;
  /** Acertados sem nenhuma tentativa errada antes. */
  firstTry: number;
  /** Pulados (contam como respondidos, sem acerto). */
  skipped: number;
  /** Acordes mostrados (acertados + pulados). */
  answered: number;
}

export class ChordDrill {
  readonly #symbols: readonly string[];
  readonly #rng: Rng;
  #q: ChordQuestion;
  #missed = false;
  #done = false;
  readonly stats: ChordDrillStats = { correct: 0, firstTry: 0, skipped: 0, answered: 0 };

  constructor(symbols: readonly string[], rng: Rng = Math.random) {
    this.#symbols = symbols.filter((s) => spellChord(s));
    if (!this.#symbols.length) throw new Error('Nenhum acorde reconhecido');
    this.#rng = rng;
    this.#q = this.#draw(null);
  }

  get question(): ChordQuestion {
    return this.#q;
  }

  /** O acorde atual já foi acertado (esperando o próximo). */
  get done(): boolean {
    return this.#done;
  }

  #draw(previous: string | null): ChordQuestion {
    let symbol: string;
    do symbol = this.#symbols[Math.floor(this.#rng() * this.#symbols.length)]!;
    while (symbol === previous && this.#symbols.length > 1);
    const chord = spellChord(symbol)!;
    return { symbol, chord, inv: Math.floor(this.#rng() * chord.tones.length) };
  }

  /**
   * Avalia as notas presas. Devolve null enquanto houver menos notas presas
   * que as do acorde (o aluno ainda está montando).
   */
  check(held: readonly MidiPitch[]): ChordAnswer | null {
    if (this.#done || held.length < this.#q.chord.tones.length) return null;
    const r = checkInversion(this.#q.chord, this.#q.inv, held);
    if (r.ok) {
      this.#done = true;
      this.stats.correct++;
      this.stats.answered++;
      if (!this.#missed) this.stats.firstTry++;
      return 'correct';
    }
    this.#missed = true;
    return r.notesOk ? 'wrong-bass' : 'wrong';
  }

  /** Mostrar a resposta conta como erro nesta pergunta. */
  reveal(): void {
    this.#missed = true;
  }

  skip(): void {
    if (!this.#done) {
      this.stats.skipped++;
      this.stats.answered++;
    }
    this.next();
  }

  next(): void {
    this.#q = this.#draw(this.#q.symbol);
    this.#missed = false;
    this.#done = false;
  }
}
