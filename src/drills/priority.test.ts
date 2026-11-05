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
    for (let i = 0; i < 20; i++) for (const id of ['a', 'b', 'slow']) p.record(id, true, 1000);
    for (let i = 0; i < 20; i++) p.record('slow', true, 3000);
    expect(p.medianMs()).toBe(1000);
    // mesma taxa de erro; com muitas medições a lentidão chega perto de 2 → p·(1 + 0,5·2)
    expect(p.weight('slow') - 0.05).toBeGreaterThan(1.9 * (p.weight('a') - 0.05));
  });

  // Bug do tablet (M3): Fá2, sempre certa mas lenta, ficou à frente de Mi3 e Ré3,
  // erradas todas as vezes.
  it('never ranks a slow but correct note above notes that are always wrong', () => {
    const p = new Prioritizer();
    for (let i = 0; i < 3; i++) for (const id of ['c3', 'f3', 'g3', 'a3']) p.record(id, true, 1500);
    for (let i = 0; i < 4; i++) p.record('e3', false, null);
    for (let i = 0; i < 3; i++) p.record('f2', true, 6000);
    expect(p.weight('e3')).toBeGreaterThan(p.weight('f2'));
    // e a lenta ainda aparece mais que as normais
    expect(p.weight('f2')).toBeGreaterThan(1.5 * p.weight('c3'));
  });

  it('does not let a single hesitation define a note as slow', () => {
    const p = new Prioritizer();
    for (const id of ['a', 'b', 'c']) p.record(id, true, 1000);
    p.record('once', true, 3000);
    // uma medição: (1·3000 + 2·1000)/3 ≈ 1667 → lentidão ≈ 0,67, não 2
    expect(p.slowness('once')).toBeCloseTo(2 / 3);
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
