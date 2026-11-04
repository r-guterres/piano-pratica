// Treino de leitura (§6): mostra uma nota, espera a tecla certa e mede o tempo
// de reação. Recebe eventos de entrada e devolve o que aconteceu; quem desenha
// e cronometra a rodada é a UI. Puro.

import type { InputEvent, Millis, MidiPitch } from '../core/events';
import type { DrillItem } from './notes';
import { Prioritizer, type Rng } from './priority';

export type DrillEvent =
  | { type: 'correct'; item: DrillItem; firstTry: boolean; reactionMs: number; t: Millis }
  | { type: 'wrong'; item: DrillItem; played: MidiPitch; errors: number; t: Millis }
  /** errou `revealAfter` vezes: a UI mostra a resposta e espera a tecla certa */
  | { type: 'revealed'; item: DrillItem; t: Millis };

export interface DrillItemSummary {
  item: DrillItem;
  /** Vezes que apareceu nesta rodada. */
  shown: number;
  firstTry: number;
  wrongNotes: number;
  /** Tempo médio dos acertos de primeira (ms). */
  meanMs: number | null;
}

export interface DrillSummary {
  /** Notas respondidas (acertadas, de primeira ou não). */
  answered: number;
  firstTry: number;
  wrongNotes: number;
  /** Notas em que a resposta precisou ser mostrada. */
  revealed: number;
  /** Tempo médio de reação nos acertos de primeira (ms). */
  meanReactionMs: number | null;
  /** Por item, na ordem do conjunto de notas (clave, grave → agudo). */
  items: DrillItemSummary[];
}

export interface ReadingDrillOptions {
  /** Erros na mesma nota antes de mostrar a resposta (0 = nunca). */
  revealAfter?: number;
  /** Compartilhado entre rodadas, para lembrar das notas difíceis. */
  prioritizer?: Prioritizer;
  rng?: Rng;
}

export class ReadingDrill {
  readonly pool: readonly DrillItem[];
  readonly prioritizer: Prioritizer;
  readonly #revealAfter: number;
  readonly #rng: Rng;

  #current: DrillItem | null = null;
  #shownAt: Millis = 0;
  #errors = 0;
  #answered = false;
  readonly #recent: string[] = [];
  readonly #stats = new Map<
    string,
    { shown: number; firstTry: number; wrong: number; ms: number[] }
  >();
  #revealed = 0;

  constructor(pool: readonly DrillItem[], options: ReadingDrillOptions = {}) {
    this.pool = pool;
    this.prioritizer = options.prioritizer ?? new Prioritizer();
    this.#revealAfter = options.revealAfter ?? 3;
    this.#rng = options.rng ?? Math.random;
  }

  /** Nota na tela (null antes da primeira). */
  get current(): DrillItem | null {
    return this.#current;
  }

  /** Já acertou a nota atual (a UI mostra o verde e depois chama `next`). */
  get answered(): boolean {
    return this.#answered;
  }

  /** Erros na nota atual. */
  get errors(): number {
    return this.#errors;
  }

  get revealedNow(): boolean {
    return this.#revealAfter > 0 && this.#errors >= this.#revealAfter;
  }

  /** Sorteia e apresenta a próxima nota; `t` = instante em que ela apareceu na tela. */
  next(t: Millis): DrillItem | null {
    if (!this.pool.length) return null;
    const item = this.prioritizer.pick(this.pool, this.#recent, this.#rng);
    this.#current = item;
    this.#shownAt = t;
    this.#errors = 0;
    this.#answered = false;
    this.#recent.push(item.id);
    if (this.#recent.length > 4) this.#recent.shift();
    this.#entry(item.id).shown++;
    return item;
  }

  handle(event: InputEvent): DrillEvent[] {
    // note-off (inclusive note-on com velocity 0, já convertido) e pedal não contam
    if (event.type !== 'on') return [];
    const item = this.#current;
    if (!item || this.#answered) return [];
    const entry = this.#entry(item.id);

    if (event.pitch !== item.pitch) {
      this.#errors++;
      entry.wrong++;
      const out: DrillEvent[] = [
        { type: 'wrong', item, played: event.pitch, errors: this.#errors, t: event.t },
      ];
      if (this.#errors === this.#revealAfter) {
        this.#revealed++;
        out.push({ type: 'revealed', item, t: event.t });
      }
      return out;
    }

    this.#answered = true;
    const firstTry = this.#errors === 0;
    const reactionMs = Math.max(0, event.t - this.#shownAt);
    if (firstTry) {
      entry.firstTry++;
      entry.ms.push(reactionMs);
    }
    this.prioritizer.record(item.id, firstTry, firstTry ? reactionMs : null);
    return [{ type: 'correct', item, firstTry, reactionMs, t: event.t }];
  }

  summary(): DrillSummary {
    const items: DrillItemSummary[] = [];
    let answered = 0;
    let firstTry = 0;
    let wrongNotes = 0;
    const allMs: number[] = [];
    for (const item of this.pool) {
      const e = this.#stats.get(item.id);
      if (!e) continue;
      // a nota na tela que ainda não foi acertada não conta como respondida
      const pending = item === this.#current && !this.#answered ? 1 : 0;
      answered += e.shown - pending;
      firstTry += e.firstTry;
      wrongNotes += e.wrong;
      allMs.push(...e.ms);
      items.push({
        item,
        shown: e.shown,
        firstTry: e.firstTry,
        wrongNotes: e.wrong,
        meanMs: mean(e.ms),
      });
    }
    return {
      answered,
      firstTry,
      wrongNotes,
      revealed: this.#revealed,
      meanReactionMs: mean(allMs),
      items,
    };
  }

  #entry(id: string) {
    let e = this.#stats.get(id);
    if (!e) this.#stats.set(id, (e = { shown: 0, firstTry: 0, wrong: 0, ms: [] }));
    return e;
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
