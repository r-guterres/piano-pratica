import { describe, expect, it } from 'vitest';
import type { InputEvent } from '../core/events';
import { parseMidiMessage } from '../midi/parse';
import { buildPool, diatonic, type DrillItem } from './notes';
import { Prioritizer } from './priority';
import { ReadingDrill } from './readingDrill';
import { seededRng } from './rng';

// clave de fá, Sol2…Lá3 (as linhas e espaços da pauta), sem acidentes: 9 notas
const bassPool = buildPool({
  clefs: 'bass',
  range: { treble: { low: 0, high: 0 }, bass: { low: diatonic(4, 2), high: diatonic(5, 3) } },
  accidentals: false,
  keySignature: 0,
});

const on = (pitch: number, t: number): InputEvent => ({ type: 'on', pitch, velocity: 80, t });
const types = (events: { type: string }[]) => events.map((e) => e.type);

function drill(pool: readonly DrillItem[] = bassPool, revealAfter = 3, seed = 1) {
  return new ReadingDrill(pool, { revealAfter, rng: seededRng(seed) });
}

describe('ReadingDrill', () => {
  it('shows a note and accepts the right key, measuring the reaction time', () => {
    const d = drill();
    const item = d.next(1000)!;
    expect(d.current).toBe(item);
    const events = d.handle(on(item.pitch, 1850));
    expect(events).toEqual([{ type: 'correct', item, firstTry: true, reactionMs: 850, t: 1850 }]);
    expect(d.answered).toBe(true);
  });

  it('counts wrong notes and is no longer first try', () => {
    const d = drill();
    const item = d.next(0)!;
    expect(d.handle(on(item.pitch + 1, 100))).toMatchObject([
      { type: 'wrong', played: item.pitch + 1, errors: 1 },
    ]);
    expect(d.handle(on(item.pitch, 300))).toMatchObject([{ type: 'correct', firstTry: false }]);
  });

  it('the octave matters', () => {
    const d = drill();
    const item = d.next(0)!;
    expect(types(d.handle(on(item.pitch + 12, 100)))).toEqual(['wrong']);
  });

  it('reveals the answer after N errors and still waits for the right key', () => {
    const d = drill(bassPool, 2);
    const item = d.next(0)!;
    expect(types(d.handle(on(item.pitch + 2, 10)))).toEqual(['wrong']);
    expect(d.revealedNow).toBe(false);
    expect(types(d.handle(on(item.pitch + 2, 20)))).toEqual(['wrong', 'revealed']);
    expect(d.revealedNow).toBe(true);
    expect(types(d.handle(on(item.pitch + 2, 30)))).toEqual(['wrong']); // não revela de novo
    expect(types(d.handle(on(item.pitch, 40)))).toEqual(['correct']);
    expect(d.summary()).toMatchObject({ revealed: 1, wrongNotes: 3, firstTry: 0, answered: 1 });
  });

  it('never reveals with revealAfter = 0', () => {
    const d = drill(bassPool, 0);
    const item = d.next(0)!;
    for (let i = 1; i <= 10; i++) expect(types(d.handle(on(item.pitch + 1, i)))).toEqual(['wrong']);
  });

  it('ignores note-offs, velocity-0 note-ons, the pedal and keys after the answer', () => {
    const d = drill();
    const item = d.next(0)!;
    const zero = parseMidiMessage([0x90, item.pitch + 1, 0], 5);
    if (zero?.kind !== 'note') throw new Error('esperava nota');
    expect(d.handle(zero.event)).toEqual([]);
    expect(d.handle({ type: 'off', pitch: item.pitch + 1, velocity: 0, t: 6 })).toEqual([]);
    expect(d.handle({ type: 'pedal', value: 127, down: true, t: 7 })).toEqual([]);
    d.handle(on(item.pitch, 100));
    expect(d.handle(on(item.pitch + 1, 120))).toEqual([]); // já acertou: espera o next()
    expect(d.summary().wrongNotes).toBe(0);
  });

  it('does nothing before the first note and with an empty pool', () => {
    expect(drill().handle(on(60, 0))).toEqual([]);
    const empty = drill([]);
    expect(empty.next(0)).toBeNull();
  });

  it('summarizes per note, without counting the note still on screen as answered', () => {
    const d = drill();
    const a = d.next(0)!;
    d.handle(on(a.pitch, 1000));
    const b = d.next(1000)!;
    d.handle(on(b.pitch + 1, 1500));
    d.handle(on(b.pitch, 2000));
    d.next(2000);
    const s = d.summary();
    expect(s).toMatchObject({ answered: 2, firstTry: 1, wrongNotes: 1, meanReactionMs: 1000 });
    expect(s.items.find((i) => i.item === b)).toMatchObject({
      shown: 1,
      firstTry: 0,
      wrongNotes: 1,
    });
    // na ordem do conjunto (grave → agudo)
    const order = s.items.map((i) => bassPool.indexOf(i.item));
    expect(order).toEqual([...order].sort((x, y) => x - y));
  });

  it('shares what it learned across rounds through the prioritizer', () => {
    const prioritizer = new Prioritizer();
    const first = new ReadingDrill(bassPool, { prioritizer, rng: seededRng(3) });
    const item = first.next(0)!;
    first.handle(on(item.pitch + 1, 10));
    first.handle(on(item.pitch, 20));
    const second = new ReadingDrill(bassPool, { prioritizer, rng: seededRng(4) });
    expect(second.prioritizer.errorRate(item.id)).toBeGreaterThan(0.25);
  });
});

// Aceite do M3: "faço uma rodada de 5 minutos na clave de fá, e o app passa a
// mostrar mais as notas que errei".
describe('ReadingDrill — a 5-minute bass clef round', () => {
  it('shows the notes I miss more often than the others', () => {
    // aluno simulado: sempre confunde Fá3 com Lá3 e Si2 com Ré3 na primeira tentativa,
    // acerta o resto; ~2 s por nota → ~150 notas em 5 min
    const hard = new Set(['bass:F3', 'bass:B2']);
    const d = drill(bassPool, 3, 42);
    let t = 0;
    for (let i = 0; i < 150; i++) {
      const item = d.next(t)!;
      if (hard.has(item.id)) d.handle(on(item.pitch + 4, (t += 1500)));
      d.handle(on(item.pitch, (t += 1500)));
      t += 400;
    }
    const s = d.summary();
    const shown = (id: string) => s.items.find((i) => i.item.id === id)?.shown ?? 0;
    const hardShown = [...hard].map(shown);
    const others = s.items.filter((i) => !hard.has(i.item.id)).map((i) => i.shown);
    const meanOthers = others.reduce((a, b) => a + b, 0) / others.length;
    // uniforme daria 150/9 ≈ 17 cada
    for (const n of hardShown) expect(n).toBeGreaterThan(2 * meanOthers);
    // e nenhuma nota some do treino
    expect(Math.min(...others)).toBeGreaterThan(3);
  });
});
