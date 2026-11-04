import { describe, expect, it } from 'vitest';
import { DECAY, Prioritizer } from './priority';
import { seededRng as seeded } from './rng';

const items = (...ids: string[]) => ids.map((id) => ({ id }));

describe('Prioritizer', () => {
  it('starts every item with the prior error rate', () => {
    const p = new Prioritizer();
    expect(p.errorRate('x')).toBeCloseTo(0.25);
    expect(p.weight('x')).toBeCloseTo(0.3);
  });

  it('raises the weight of wrong answers and lowers it for correct ones', () => {
    const p = new Prioritizer();
    p.record('bad', false, null);
    p.record('good', true, 1000);
    expect(p.errorRate('bad')).toBeCloseTo(2 / 5);
    expect(p.errorRate('good')).toBeCloseTo(1 / 5);
    expect(p.weight('bad')).toBeGreaterThan(p.weight('good'));
  });

  it('forgets old answers: a note that is now right loses priority', () => {
    const p = new Prioritizer();
    for (let i = 0; i < 5; i++) p.record('x', false, null);
    const before = p.errorRate('x');
    for (let i = 0; i < 10; i++) p.record('x', true, 900);
    expect(p.errorRate('x')).toBeLessThan(before / 2);
    expect(p.stats.get('x')).toMatchObject({ seen: 15 });
    expect(p.stats.get('x')!.errors).toBeCloseTo(
      [0, 1, 2, 3, 4].reduce((acc, i) => acc + DECAY ** (10 + i), 0),
    );
  });

  it('adds weight to slow notes relative to the median', () => {
    const p = new Prioritizer();
    p.record('a', true, 1000);
    p.record('b', true, 1000);
    p.record('slow', true, 3000);
    expect(p.medianMs()).toBe(1000);
    // mesma taxa de erro; lentidão 3000/1000 − 1 = 2 → +0,5·2
    expect(p.weight('slow') - p.weight('a')).toBeCloseTo(1);
  });

  it('smooths the reaction time', () => {
    const p = new Prioritizer();
    p.record('a', true, 1000);
    p.record('a', true, 2000);
    expect(p.stats.get('a')!.meanMs).toBeCloseTo(1300);
    p.record('a', false, null); // erro não mexe no tempo
    expect(p.stats.get('a')!.meanMs).toBeCloseTo(1300);
  });

  it('never repeats the previous item and avoids the last two with 4+ items', () => {
    const p = new Prioritizer();
    const rng = seeded(1);
    const pool = items('a', 'b', 'c', 'd');
    const recent: string[] = [];
    for (let i = 0; i < 200; i++) {
      const { id } = p.pick(pool, recent, rng);
      expect(recent.slice(-2)).not.toContain(id);
      recent.push(id);
    }
    expect(p.pick(items('a', 'b'), ['a'], rng).id).toBe('b');
    expect(p.pick(items('a'), ['a'], rng).id).toBe('a');
  });

  it('picks heavier items more often', () => {
    const p = new Prioritizer();
    for (let i = 0; i < 6; i++) p.record('hard', false, null);
    for (const id of ['e1', 'e2', 'e3', 'e4', 'e5'])
      for (let i = 0; i < 6; i++) p.record(id, true, 1000);
    const pool = items('hard', 'e1', 'e2', 'e3', 'e4', 'e5');
    const rng = seeded(7);
    let hard = 0;
    for (let i = 0; i < 1000; i++) if (p.pick(pool, [], rng).id === 'hard') hard++;
    // peso ≈ 0,05 + 0,63 contra ≈ 0,05 + 0,12 de cada fácil → ~44% (uniforme seria 17%)
    expect(hard / 1000).toBeGreaterThan(0.35);
  });
});
