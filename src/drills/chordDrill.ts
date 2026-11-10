// Treino de acordes: o app pede um acorde numa inversão ("Am, 1ª inversão")
// e confere pelo MIDI as notas presas (as notas do acorde e a nota certa no
// baixo). Os acordes vêm da fase da Trilha (sorteados, em inversão sorteada)
// ou de um exercício do tópico (uma progressão em ordem, com o baixo escrito
// na cifra, "F/C", ou em qualquer inversão). Puro.

import type { MidiPitch } from '../core/events';
import {
  checkInversion,
  noteLetter,
  parseChord,
  spellChord,
  type SpelledChord,
} from '../practice/chords';
import type { Rng } from './priority';
import { KEYS, transposeChords } from './transpose';

export interface ChordQuestion {
  /** Cifra sem o baixo ("F"). */
  symbol: string;
  chord: SpelledChord;
  /** 0 = fundamental, 1 = 1ª inversão…; null = qualquer inversão (o baixo não é conferido). */
  inv: number | null;
  /** Cifra mostrada, com o baixo quando a inversão importa ("F/C"). */
  label: string;
  /** Posição na lista (na progressão, o acorde da vez). */
  index: number;
}

export interface ChordDrillOptions {
  /** Sorteados (sem repetir o anterior) ou em ordem, recomeçando no fim. */
  order?: 'random' | 'sequence';
  /**
   * random: inversão sorteada; written: a da cifra ("F/C" = Dó no baixo; sem
   * barra = fundamental); any: qualquer inversão.
   */
  inversions?: 'random' | 'written' | 'any';
  /** Tom maior em que as cifras estão escritas (padrão: Dó). */
  key?: string;
  /**
   * Tom em que o treino pede os acordes (um de `KEYS`), ou 'random': um tom
   * sorteado no começo e outro a cada volta (fim da progressão, ou tantos
   * acordes quanto a lista no sorteio). Padrão: o tom escrito.
   */
  to?: string;
}

interface Item {
  symbol: string;
  chord: SpelledChord;
  /** Inversão pedida pela barra da cifra (written); -1 se a nota do baixo não é do acorde. */
  written: number;
}

const flat = (s: string) => s.replace('b', '♭').replace('#', '♯');

function parseItem(text: string): Item | null {
  const [symbol, bass] = text.trim().split('/');
  const chord = spellChord(symbol!);
  if (!chord) return null;
  // pela grafia; se a transposição soletrou o baixo de outro jeito (enarmônico), pela altura
  const bassPc = bass ? parseChord(bass)?.root : undefined;
  let written = bass ? chord.tones.findIndex((n) => noteLetter(n) === flat(bass)) : 0;
  if (written < 0) written = chord.tones.findIndex((n) => n.pc === bassPc);
  return written < 0 ? null : { symbol: symbol!, chord, written };
}

/** Cifra com o baixo da inversão ("F/C"); a fundamental e "qualquer" ficam sem barra. */
export const questionLabel = (chord: SpelledChord, inv: number | null) =>
  inv ? `${chord.display}/${noteLetter(chord.tones[inv]!)}` : chord.display;

export type ChordAnswer =
  /** acertou (notas e baixo) */
  | 'correct'
  /** as notas estão certas, mas o baixo não */
  | 'wrong-bass'
  /** soltou as teclas com notas do acorde, mas faltando alguma */
  | 'incomplete'
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
  readonly #from: string;
  readonly #randomKey: boolean;
  #key: string;
  #items: readonly Item[] = [];
  /** Perguntas desde a última troca de tom (no sorteio). */
  #count = 0;
  readonly #order: 'random' | 'sequence';
  readonly #inversions: 'random' | 'written' | 'any';
  readonly #rng: Rng;
  #q: ChordQuestion;
  #missed = false;
  #done = false;
  /** Teclas presas desde a última vez que todas foram soltas. */
  #attempt = new Set<MidiPitch>();
  #judged = false;
  #lastAttempt: MidiPitch[] = [];
  /** Teclas do acorde anterior ainda presas ao passar para o próximo: ignorar até soltar tudo. */
  #waitRelease = false;
  readonly stats: ChordDrillStats = { correct: 0, firstTry: 0, skipped: 0, answered: 0 };
  /** Acordes que não saíram de primeira (cifra mostrada → vezes). */
  readonly trouble: Record<string, number> = {};

  constructor(symbols: readonly string[], rng: Rng = Math.random, opts: ChordDrillOptions = {}) {
    this.#symbols = symbols;
    this.#from = opts.key ?? 'C';
    this.#randomKey = opts.to === 'random';
    this.#order = opts.order ?? 'random';
    this.#inversions = opts.inversions ?? 'random';
    this.#rng = rng;
    this.#key = this.#from;
    this.#setKey(this.#randomKey ? this.#otherKey() : (opts.to ?? this.#from));
    if (!this.#items.length) throw new Error('Nenhum acorde reconhecido');
    this.#q = this.#draw(null);
  }

  /** O tom em que os acordes estão sendo pedidos. */
  get key(): string {
    return this.#key;
  }

  #setKey(key: string): void {
    this.#key = key;
    this.#items = transposeChords(this.#symbols, this.#from, key)
      .map(parseItem)
      .filter((x): x is Item => x !== null);
  }

  /** Um tom sorteado, diferente do atual. */
  #otherKey(): string {
    const others = KEYS.filter((k) => k !== this.#key);
    return others[Math.floor(this.#rng() * others.length)]!;
  }

  /** As cifras da lista, na ordem (para mostrar a progressão). */
  get labels(): string[] {
    return this.#items.map((it) =>
      questionLabel(it.chord, this.#inversions === 'written' ? it.written : null),
    );
  }

  get order(): 'random' | 'sequence' {
    return this.#order;
  }

  get question(): ChordQuestion {
    return this.#q;
  }

  /** O acorde atual já foi acertado (esperando o próximo). */
  get done(): boolean {
    return this.#done;
  }

  #draw(previous: ChordQuestion | null): ChordQuestion {
    const n = this.#items.length;
    let index: number;
    // uma volta completa: troca de tom (no sorteio)
    const lap =
      this.#order === 'sequence' ? previous?.index === n - 1 : previous && ++this.#count % n === 0;
    if (lap && this.#randomKey) this.#setKey(this.#otherKey());
    if (this.#order === 'sequence') index = previous ? (previous.index + 1) % n : 0;
    else
      do index = Math.floor(this.#rng() * n);
      while (n > 1 && previous && this.#items[index]!.symbol === previous.symbol);
    const { symbol, chord, written } = this.#items[index]!;
    const inv =
      this.#inversions === 'any'
        ? null
        : this.#inversions === 'written'
          ? written
          : Math.floor(this.#rng() * chord.tones.length);
    return { symbol, chord, inv, index, label: questionLabel(chord, inv) };
  }

  /** As teclas da última tentativa (para mostrar o que foi tocado depois de soltar). */
  get lastAttempt(): MidiPitch[] {
    return this.#lastAttempt;
  }

  /**
   * Avalia as notas presas. Devolve null enquanto houver menos notas presas
   * que as do acorde (o aluno ainda está montando). Se ele soltar tudo sem
   * ter chegado a um veredito, a tentativa conta: incompleta ou errada.
   */
  check(held: readonly MidiPitch[]): ChordAnswer | null {
    if (this.#waitRelease) {
      if (!held.length) this.#waitRelease = false;
      return null;
    }
    if (!held.length) return this.#released();
    for (const p of held) this.#attempt.add(p);
    if (this.#done || held.length < this.#q.chord.tones.length) return null;
    this.#judged = true;
    this.#lastAttempt = [...held].sort((a, b) => a - b);
    const r = checkInversion(this.#q.chord, this.#q.inv ?? 0, held);
    if (r.ok || (this.#q.inv === null && r.notesOk)) {
      this.#done = true;
      this.stats.correct++;
      this.stats.answered++;
      if (!this.#missed) this.stats.firstTry++;
      else this.#addTrouble();
      return 'correct';
    }
    this.#missed = true;
    return r.notesOk ? 'wrong-bass' : 'wrong';
  }

  #released(): ChordAnswer | null {
    const attempt = [...this.#attempt].sort((a, b) => a - b);
    const judged = this.#judged;
    this.#attempt.clear();
    this.#judged = false;
    if (this.#done || judged || !attempt.length) return null;
    this.#lastAttempt = attempt;
    this.#missed = true;
    const pcs = new Set(this.#q.chord.pcs);
    return attempt.every((p) => pcs.has(((p % 12) + 12) % 12)) ? 'incomplete' : 'wrong';
  }

  /** Mostrar a resposta conta como erro nesta pergunta. */
  reveal(): void {
    this.#missed = true;
  }

  #addTrouble(): void {
    this.trouble[this.#q.label] = (this.trouble[this.#q.label] ?? 0) + 1;
  }

  skip(held: readonly MidiPitch[] = []): void {
    if (!this.#done) {
      this.stats.skipped++;
      this.stats.answered++;
      this.#addTrouble();
    }
    this.next(held);
  }

  /** `held`: as teclas presas agora (são ignoradas até serem soltas). */
  next(held: readonly MidiPitch[] = []): void {
    this.#waitRelease = held.length > 0;
    this.#q = this.#draw(this.#q);
    this.#missed = false;
    this.#done = false;
    this.#attempt.clear();
    this.#judged = false;
    this.#lastAttempt = [];
  }
}
