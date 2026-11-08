// Pedal sincopado (legato): a cada troca de acorde, o pedal deve subir no
// instante do novo acorde e descer de novo logo depois, com as teclas ainda
// presas. Este módulo analisa uma sequência de eventos (teclas e pedal) e
// classifica cada troca. Puro.

import type { InputEvent, Millis, MidiPitch } from '../core/events';

/** Notas que começam a menos disto uma da outra formam o mesmo acorde. */
export const CHORD_MS = 120;
/** Levantar o pedal mais cedo que isto antes do acorde deixa um buraco no som. */
export const EARLY_LIFT_MS = 100;
/** O pedal ainda pode subir até isto depois do acorde (reação normal). */
export const LIFT_AFTER_MS = 400;
/** Pisar de novo até isto depois do acorde conta como "junto" (prende o anterior). */
export const PRESS_TOO_SOON_MS = 20;
/** Pisar de novo depois disto: os acordes não ficam ligados. */
export const PRESS_LATE_MS = 700;

export type PedalVerdict =
  | 'ok'
  /** não levantou: as harmonias se misturam */
  | 'held'
  /** levantou antes do acorde: o som falha */
  | 'early-lift'
  /** pisou junto/antes do acorde: o acorde anterior continua soando */
  | 'early-press'
  /** demorou a pisar de novo (ou não pisou) */
  | 'late-press'
  /** nem usou o pedal nesta troca */
  | 'no-pedal';

export interface ChordAttack {
  t: Millis;
  pitches: MidiPitch[];
}

export interface PedalChange {
  /** Índice do acorde novo (1 = a troca do 1º para o 2º). */
  index: number;
  from: ChordAttack;
  to: ChordAttack;
  verdict: PedalVerdict;
  /** Pedal subiu este tanto depois do acorde (negativo = antes); null se não subiu. */
  liftMs: number | null;
  /** Pedal desceu de novo este tanto depois do acorde; null se não desceu. */
  pressMs: number | null;
  /** O acorde repete a harmonia anterior (mesmas classes de altura): manter o pedal vale. */
  sameChord: boolean;
}

const pitchClasses = (a: ChordAttack) => [...new Set(a.pitches.map((p) => p % 12))].sort().join();

/** Acordes: grupos de note-ons próximos no tempo. */
export function chordAttacks(events: readonly InputEvent[]): ChordAttack[] {
  const out: ChordAttack[] = [];
  let lastOn = -Infinity;
  for (const e of events) {
    if (e.type !== 'on') continue;
    const current = out.at(-1);
    if (current && e.t - lastOn <= CHORD_MS) {
      if (!current.pitches.includes(e.pitch)) current.pitches.push(e.pitch);
    } else out.push({ t: e.t, pitches: [e.pitch] });
    lastOn = e.t;
  }
  for (const a of out) a.pitches.sort((x, y) => x - y);
  return out;
}

/** Mudanças do pedal (só as transições), em ordem. */
function pedalChanges(events: readonly InputEvent[]): { t: Millis; down: boolean }[] {
  const out: { t: Millis; down: boolean }[] = [];
  let down = false;
  for (const e of events) {
    if (e.type !== 'pedal' || e.down === down) continue;
    down = e.down;
    out.push({ t: e.t, down });
  }
  return out;
}

/**
 * Classifica cada troca de acorde. Só entram as trocas já decididas: as que
 * têm um acorde seguinte ou cuja janela (PRESS_LATE_MS) já passou em `now`.
 */
export function analyzePedal(events: readonly InputEvent[], now: Millis): PedalChange[] {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const attacks = chordAttacks(sorted);
  const pedal = pedalChanges(sorted);
  const downAt = (t: Millis) => {
    let down = false;
    for (const p of pedal) if (p.t <= t) down = p.down;
    return down;
  };

  const out: PedalChange[] = [];
  /** Cada subida do pedal vale para uma troca só. */
  const used = new Set<number>();
  for (let k = 1; k < attacks.length; k++) {
    const from = attacks[k - 1]!;
    const to = attacks[k]!;
    const next = attacks[k + 1];
    const A = to.t;
    if (!next && now < A + PRESS_LATE_MS) break;
    const limit = next ? Math.min(next.t, A + PRESS_LATE_MS * 2) : A + PRESS_LATE_MS * 2;

    // a última subida entre o acorde anterior e pouco depois deste
    const lift = pedal
      .filter((p) => !p.down && !used.has(p.t) && p.t > from.t && p.t <= A + LIFT_AFTER_MS)
      .at(-1);
    if (lift) used.add(lift.t);
    const press = lift && pedal.find((p) => p.down && p.t > lift.t && p.t < limit);
    const liftMs = lift ? lift.t - A : null;
    const pressMs = press ? press.t - A : null;

    let verdict: PedalVerdict;
    if (!lift) {
      // sem subida: ou o pedal ficou abaixado (borrão) ou o acorde anterior foi sem pedal
      const pressedDuring = pedal.some((p) => p.down && p.t > from.t && p.t < A);
      verdict = downAt(A) ? 'held' : pressedDuring ? 'late-press' : 'no-pedal';
    } else if (liftMs! < -EARLY_LIFT_MS) verdict = 'early-lift';
    else if (pressMs === null || pressMs > PRESS_LATE_MS) verdict = 'late-press';
    else if (pressMs <= PRESS_TOO_SOON_MS) verdict = 'early-press';
    else verdict = 'ok';
    // mesma harmonia: segurar o pedal (ou pisar junto) não mistura nada
    const sameChord = pitchClasses(from) === pitchClasses(to);
    if (sameChord && (verdict === 'held' || verdict === 'early-press')) verdict = 'ok';
    out.push({ index: k, from, to, verdict, liftMs, pressMs, sameChord });
  }
  return out;
}

export const VERDICT_TEXT: Record<PedalVerdict, string> = {
  ok: 'certo',
  held: 'não levantou o pedal: as harmonias se misturam',
  'early-lift': 'levantou antes do acorde: o som falhou',
  'early-press': 'pisou junto com o acorde: o anterior continua soando',
  'late-press': 'demorou a pisar de novo: os acordes não ficaram ligados',
  'no-pedal': 'sem pedal nesta troca',
};
