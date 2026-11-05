// Avaliação do ritmo no modo acompanhar: cada note-on do aluno é comparado com
// a nota esperada de mesma altura mais próxima no tempo. Puro.
//
//   |desvio| ≤ 80 ms → no tempo; até 300 ms → adiantada/atrasada;
//   sem nota esperada daquela altura dentro de ±300 ms → errada (e a nota
//   esperada mais próxima, se estiver dentro da janela, conta como tocada);
//   nota esperada que passou sem ser tocada → perdida.
//
// Os instantes estão no relógio de performance.now(): `origin` é quando o
// início do trecho é ouvido (o Player desconta o atraso do alto-falante).

import type { Millis, MidiPitch, NoteEvent } from '../core/events';
import type { ExpectedNote } from '../playback/schedule';

export const ON_TIME_MS = 80;
export const WINDOW_MS = 300;

export type Timing = 'ontime' | 'early' | 'late';

export interface LapStats {
  notes: number;
  ontime: number;
  early: number;
  late: number;
  missed: number;
  wrong: number;
}

export type RhythmEvent =
  | { type: 'hit'; note: ExpectedNote; lap: number; offsetMs: number; timing: Timing }
  | { type: 'wrong'; pitch: MidiPitch; t: Millis; near: ExpectedNote | null }
  | { type: 'missed'; note: ExpectedNote; lap: number }
  /** a volta terminou (todas as notas dela já foram avaliadas) */
  | { type: 'lapDone'; lap: number; stats: LapStats; clean: boolean };

export interface RhythmClock {
  /** Instante (performance.now) em que o início do trecho é ouvido. */
  origin: Millis;
  bodyMs: number;
  loop: boolean;
}

export interface RhythmSummary extends LapStats {
  /** Desvio médio nos acertos (ms): negativo = adiantando, positivo = atrasando. */
  meanOffsetMs: number | null;
  /** Desvio absoluto médio (ms). */
  meanAbsOffsetMs: number | null;
  /** Notas fora do tempo, erradas ou perdidas, por compasso (0 = primeiro). */
  problemsByMeasure: Record<number, number>;
  /** Voltas completas avaliadas. */
  laps: number;
}

const emptyStats = (): LapStats => ({
  notes: 0,
  ontime: 0,
  early: 0,
  late: 0,
  missed: 0,
  wrong: 0,
});
export const isClean = (s: LapStats) =>
  s.notes > 0 && s.wrong === 0 && s.missed === 0 && s.early === 0 && s.late === 0;

export class RhythmJudge {
  readonly #notes: readonly ExpectedNote[];
  readonly #clock: RhythmClock;
  readonly #matched = new Set<string>();
  readonly #lapStats = new Map<number, LapStats>();
  readonly #total = emptyStats();
  readonly #offsets: number[] = [];
  readonly #byMeasure: Record<number, number> = {};
  /** Próxima nota ainda não encerrada (para as perdidas). */
  #lap = 0;
  #i = 0;
  #laps = 0;

  constructor(expected: readonly ExpectedNote[], clock: RhythmClock) {
    this.#notes = expected;
    this.#clock = clock;
  }

  #at(lap: number, i: number): Millis {
    return this.#clock.origin + lap * this.#clock.bodyMs + this.#notes[i]!.t;
  }

  #passed(lap: number, i: number): boolean {
    return lap < this.#lap || (lap === this.#lap && i < this.#i);
  }

  #stats(lap: number): LapStats {
    let s = this.#lapStats.get(lap);
    if (!s) this.#lapStats.set(lap, (s = emptyStats()));
    return s;
  }

  #count(lap: number, key: keyof LapStats, measure: number | null): void {
    this.#stats(lap)[key]++;
    this.#total[key]++;
    if (key !== 'notes' && key !== 'ontime' && measure !== null)
      this.#byMeasure[measure] = (this.#byMeasure[measure] ?? 0) + 1;
  }

  /** Voltas a examinar perto do instante t. */
  #lapsNear(t: Millis): number[] {
    const { origin, bodyMs, loop } = this.#clock;
    if (!loop || bodyMs <= 0) return [0];
    const center = Math.floor((t - origin) / bodyMs);
    return [center - 1, center, center + 1].filter((l) => l >= 0);
  }

  handle(e: NoteEvent): RhythmEvent[] {
    if (e.type !== 'on' || !this.#notes.length) return [];
    // teclas antes do início (na contagem) não contam
    if (e.t < this.#clock.origin - WINDOW_MS) return [];

    let best: { lap: number; i: number; d: number } | null = null;
    for (const lap of this.#lapsNear(e.t))
      this.#notes.forEach((n, i) => {
        if (n.pitch !== e.pitch || this.#matched.has(`${lap}:${i}`) || this.#passed(lap, i)) return;
        const d = e.t - this.#at(lap, i);
        if (Math.abs(d) <= WINDOW_MS && (!best || Math.abs(d) < Math.abs(best.d)))
          best = { lap, i, d };
      });

    if (best) {
      const { lap, i, d } = best;
      const note = this.#notes[i]!;
      this.#matched.add(`${lap}:${i}`);
      const timing: Timing = Math.abs(d) <= ON_TIME_MS ? 'ontime' : d < 0 ? 'early' : 'late';
      this.#offsets.push(d);
      this.#count(lap, timing, note.measure);
      return [{ type: 'hit', note, lap, offsetMs: d, timing }];
    }

    // errada: atribuída à nota esperada mais próxima no tempo (de uma volta ainda aberta)
    let near: { lap: number; i: number; d: number } | null = null;
    for (const lap of this.#lapsNear(e.t))
      this.#notes.forEach((_, i) => {
        if (this.#passed(lap, i) && !(lap === this.#lap && i === this.#i - 1)) return;
        const d = Math.abs(e.t - this.#at(lap, i));
        if (!near || d < near.d) near = { lap, i, d };
      });
    const n = near as { lap: number; i: number; d: number } | null;
    const lap = n && n.lap >= this.#lap ? n.lap : this.#lap;
    const note = n ? this.#notes[n.i]! : null;
    // a tecla errada "ocupa" a nota esperada ali perto: ela foi tocada (errado),
    // não esquecida; senão um único engano contaria como errada e perdida
    if (n && n.d <= WINDOW_MS && !this.#passed(n.lap, n.i)) this.#matched.add(`${n.lap}:${n.i}`);
    this.#count(lap, 'wrong', note?.measure ?? null);
    return [{ type: 'wrong', pitch: e.pitch, t: e.t, near: note }];
  }

  /** Encerra as notas cuja janela já passou (perdidas) e as voltas completas. */
  advance(now: Millis): RhythmEvent[] {
    const out: RhythmEvent[] = [];
    const notes = this.#notes;
    if (!notes.length) return out;
    while (this.#clock.loop || this.#lap === 0) {
      if (this.#at(this.#lap, this.#i) + WINDOW_MS >= now) break;
      const note = notes[this.#i]!;
      this.#count(this.#lap, 'notes', null);
      if (!this.#matched.has(`${this.#lap}:${this.#i}`)) {
        this.#count(this.#lap, 'missed', note.measure);
        out.push({ type: 'missed', note, lap: this.#lap });
      }
      if (++this.#i < notes.length) continue;
      const stats = { ...this.#stats(this.#lap) };
      out.push({ type: 'lapDone', lap: this.#lap, stats, clean: isClean(stats) });
      this.#lapStats.delete(this.#lap - 1);
      this.#laps++;
      this.#lap++;
      this.#i = 0;
    }
    return out;
  }

  summary(): RhythmSummary {
    const o = this.#offsets;
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    return {
      ...this.#total,
      meanOffsetMs: mean(o),
      meanAbsOffsetMs: mean(o.map(Math.abs)),
      problemsByMeasure: { ...this.#byMeasure },
      laps: this.#laps,
    };
  }
}
