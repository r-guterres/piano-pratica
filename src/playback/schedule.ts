// Agenda de reprodução: transforma a linha do tempo da partitura em eventos com
// horário (ms) — cliques do metrônomo, notas a tocar e movimentos do cursor.
// Quem toca é o Player; aqui só há aritmética. Puro.
//
// Tempo musical em semibreves (1 = semibreve); andamento em semínimas por
// minuto, então uma semibreve dura 4·60000/bpm ms. O andamento escolhido
// substitui o primeiro andamento escrito, e os demais mudam na mesma proporção.

import type { InputEvent } from '../core/events';
import type { HandSelection, MeasureInfo, TimelinePosition } from '../score/types';

export type PlaybackEvent =
  /** `beat`: 0 = tempo forte; na anacruse, conta a partir do fim do compasso. */
  | { t: number; kind: 'click'; accent: boolean; beat: number }
  | { t: number; kind: 'on'; pitch: number; velocity: number }
  | { t: number; kind: 'off'; pitch: number }
  | { t: number; kind: 'pedal'; down: boolean }
  | { t: number; kind: 'cursor'; position: number };

export type PlaySelection = 'none' | HandSelection;

export interface ScheduleOptions {
  /** Andamento escolhido (semínimas por minuto). */
  bpm: number;
  /** Primeira e última posição do cursor (inclusive). */
  from: number;
  to: number;
  /** Compassos de contagem antes de começar. */
  countIn: number;
  metronome: boolean;
  /** Quais notas tocar. */
  play: PlaySelection;
  /** Quais notas o aluno deve tocar (para avaliar o ritmo). */
  expect?: PlaySelection;
  velocity?: number;
}

/** Uma nota que o aluno deve tocar, com o instante (ms desde o início do trecho). */
export interface ExpectedNote {
  t: number;
  pitch: number;
  position: number;
  measure: number;
}

export interface Schedule {
  /** Contagem inicial (só antes da primeira volta), com t desde o início. */
  countIn: PlaybackEvent[];
  countInMs: number;
  /** O trecho, com t desde o início dele (depois da contagem). */
  body: PlaybackEvent[];
  bodyMs: number;
  /** Notas esperadas do aluno no trecho, em ordem de tempo. */
  expected: ExpectedNote[];
}

const EPS = 1e-6;
const DEFAULT_VELOCITY = 72;
/**
 * Folga entre soltar uma tecla e tocá-la de novo. Com o mesmo horário, o
 * caminho até o teclado (Android → USB-MIDI) pode entregar o note-on antes do
 * note-off, e a nota repetida não soa (bug do tablet, Sol4–Sol4 no Minueto).
 */
export const REARTICULATE_MS = 20;

/** Pulsação do compasso: em 6/8, 9/8 e 12/8 o tempo é a semínima pontuada. */
export function beatGrid(beats: number, beatType: number): { beat: number; count: number } {
  if (beatType === 8 && beats > 3 && beats % 3 === 0) return { beat: 3 / 8, count: beats / 3 };
  return { beat: 1 / beatType, count: beats };
}

export const msPerWhole = (bpm: number) => (4 * 60_000) / bpm;

/** Um compasso tal como é executado (um compasso repetido aparece duas vezes). */
interface Span {
  measure: MeasureInfo;
  perfStart: number;
  perfEnd: number;
  msStart: number;
  msPerWhole: number;
}

function clicksIn(span: Span, toMs: (x: number) => number): PlaybackEvent[] {
  const { beats, beatType, duration } = span.measure;
  const { beat, count } = beatGrid(beats, beatType);
  const out: PlaybackEvent[] = [];
  if (duration < beats / beatType - EPS) {
    // anacruse: os tempos se alinham pelo fim do compasso
    for (let k = 1; span.perfEnd - k * beat > span.perfStart - EPS; k++)
      out.push({ t: toMs(span.perfEnd - k * beat), kind: 'click', accent: false, beat: count - k });
    return out.reverse();
  }
  for (let k = 0; span.perfStart + k * beat < span.perfEnd - EPS; k++)
    out.push({ t: toMs(span.perfStart + k * beat), kind: 'click', accent: k === 0, beat: k });
  return out;
}

const ORDER = { off: 0, pedal: 1, click: 2, on: 3, cursor: 4 } as const;
const byTime = (a: PlaybackEvent, b: PlaybackEvent) => a.t - b.t || ORDER[a.kind] - ORDER[b.kind];

export function buildSchedule(
  timeline: readonly TimelinePosition[],
  measures: readonly MeasureInfo[],
  opt: ScheduleOptions,
): Schedule {
  const positions = timeline.slice(opt.from, opt.to + 1);
  const empty: Schedule = { countIn: [], countInMs: 0, body: [], bodyMs: 0, expected: [] };
  if (!positions.length || !measures.length) return empty;

  const written = measures[positions[0]!.measure]?.tempo ?? measures.find((m) => m.tempo)?.tempo;
  const factor = written ? opt.bpm / written : 1;

  // compassos na ordem de execução
  const spans: Span[] = [];
  let ms = 0;
  for (const pos of positions) {
    const measure = measures[pos.measure];
    if (!measure) continue;
    const perfStart = pos.perfTime - (pos.time - measure.start);
    const last = spans.at(-1);
    if (last && last.measure.index === measure.index && Math.abs(last.perfStart - perfStart) < EPS)
      continue;
    if (last) ms += (last.perfEnd - last.perfStart) * last.msPerWhole;
    spans.push({
      measure,
      perfStart,
      perfEnd: perfStart + measure.duration,
      msStart: ms,
      msPerWhole: msPerWhole((measure.tempo ?? written ?? opt.bpm) * factor),
    });
  }
  const lastSpan = spans.at(-1)!;
  const bodyMs = lastSpan.msStart + measureMs(lastSpan);

  /** Semibreves de execução → ms desde o início do trecho (limitado ao trecho). */
  const toMs = (x: number): number => {
    let span = spans[0]!;
    for (const s of spans) if (s.perfStart <= x + EPS) span = s;
    if (x >= span.perfEnd) return span.msStart + measureMs(span);
    return span.msStart + Math.max(0, x - span.perfStart) * span.msPerWhole;
  };

  const body: PlaybackEvent[] = positions.map((p) => ({
    t: toMs(p.perfTime),
    kind: 'cursor',
    position: p.index,
  }));
  if (opt.metronome) for (const s of spans) body.push(...clicksIn(s, toMs));
  if (opt.play !== 'none') body.push(...noteEvents(positions, opt, toMs, bodyMs));
  body.sort(byTime);

  // contagem: compassos inteiros na fórmula e no andamento do primeiro compasso
  const first = spans[0]!;
  const { beats, beatType } = first.measure;
  const barMs = (beats / beatType) * first.msPerWhole;
  const countIn: PlaybackEvent[] = [];
  for (let bar = 0; bar < opt.countIn; bar++) {
    const span: Span = {
      ...first,
      measure: { ...first.measure, duration: beats / beatType },
      perfStart: 0,
      perfEnd: beats / beatType,
    };
    countIn.push(...clicksIn(span, (x) => bar * barMs + x * first.msPerWhole));
  }
  return {
    countIn,
    countInMs: opt.countIn * barMs,
    body,
    bodyMs,
    expected: expectedNotes(positions, opt.expect ?? 'none', toMs),
  };
}

const struck = (n: TimelinePosition['notes'][number], hands: PlaySelection) =>
  !n.tieContinuation && !n.grace && hands !== 'none' && (hands === 'both' || n.hand === hands);

function expectedNotes(
  positions: readonly TimelinePosition[],
  hands: PlaySelection,
  toMs: (x: number) => number,
): ExpectedNote[] {
  const out: ExpectedNote[] = [];
  for (const pos of positions) {
    const pitches = new Set(pos.notes.filter((n) => struck(n, hands)).map((n) => n.pitch));
    for (const pitch of [...pitches].sort((a, b) => a - b))
      out.push({ t: toMs(pos.perfTime), pitch, position: pos.index, measure: pos.measure });
  }
  return out;
}

const measureMs = (s: Span) => (s.perfEnd - s.perfStart) * s.msPerWhole;

function noteEvents(
  positions: readonly TimelinePosition[],
  opt: ScheduleOptions,
  toMs: (x: number) => number,
  bodyMs: number,
): PlaybackEvent[] {
  const velocity = opt.velocity ?? DEFAULT_VELOCITY;
  const byPitch = new Map<number, { on: number; off: number }[]>();
  for (const pos of positions)
    for (const n of pos.notes) {
      if (!struck(n, opt.play)) continue;
      const list = byPitch.get(n.pitch) ?? [];
      const sounding = n.duration * (n.gate ?? 1); // staccato: soa só uma parte
      list.push({ on: toMs(pos.perfTime), off: toMs(pos.perfTime + sounding) });
      byPitch.set(n.pitch, list);
    }
  const out: PlaybackEvent[] = [];
  for (const [pitch, list] of byPitch) {
    list.sort((a, b) => a.on - b.on);
    list.forEach((note, i) => {
      // a última nota volta para a primeira se o trecho se repete (loop)
      const next = list[i + 1] ?? (list[0]!.on === 0 ? { on: bodyMs, off: bodyMs } : undefined);
      if (next && next.on === note.on) return; // duas vozes na mesma nota: uma só
      // a mesma tecla tocada de novo (logo em seguida ou antes de a anterior
      // acabar): solta um pouco antes, sem passar da metade da nota
      const off =
        next && next.on <= note.off
          ? Math.max(note.on + (next.on - note.on) / 2, next.on - REARTICULATE_MS)
          : note.off;
      out.push({ t: note.on, kind: 'on', pitch, velocity });
      out.push({ t: off, kind: 'off', pitch });
    });
  }
  return out;
}

/** Reprodução de uma gravação (teclas e pedal, t em ms desde o início). */
export function recordingSchedule(events: readonly InputEvent[], durationMs: number): Schedule {
  const body: PlaybackEvent[] = events.map((e) =>
    e.type === 'pedal'
      ? { t: e.t, kind: 'pedal', down: e.down }
      : e.type === 'on'
        ? { t: e.t, kind: 'on', pitch: e.pitch, velocity: e.velocity }
        : { t: e.t, kind: 'off', pitch: e.pitch },
  );
  body.sort(byTime);
  const end = Math.max(durationMs, body.at(-1)?.t ?? 0);
  return { countIn: [], countInMs: 0, body, bodyMs: end, expected: [] };
}

/**
 * Metrônomo avulso: um compasso de cliques que o Player repete. Aqui `bpm` são
 * cliques por minuto (em 6/8, semínimas pontuadas), como num metrônomo comum.
 */
export function metronomeSchedule(bpm: number, beats: number, beatType: number): Schedule {
  const { count } = beatGrid(beats, beatType);
  const interval = 60_000 / bpm;
  const body: PlaybackEvent[] = Array.from({ length: count }, (_, k) => ({
    t: k * interval,
    kind: 'click',
    accent: k === 0 && count > 1,
    beat: k,
  }));
  return { countIn: [], countInMs: 0, body, bodyMs: count * interval, expected: [] };
}
