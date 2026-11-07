import { describe, expect, it } from 'vitest';
import { ChordDrill } from './chordDrill';
import {
  answerFromKeys,
  earQuestion,
  questionEvents,
  questionMs,
  type EarQuestion,
} from './earDrill';
import { seededRng } from './rng';
import { makePassage, passageExpected, passageMs, rangeFor } from './sightReading';
import { inversionVoicing } from '../practice/chords';

describe('ChordDrill', () => {
  it('waits for enough keys, counts wrong attempts and moves on', () => {
    const drill = new ChordDrill(['C', 'Am'], seededRng(1));
    const q = drill.question;
    const right = inversionVoicing(q.chord, q.inv);
    expect(drill.check(right.slice(0, 2))).toBeNull(); // ainda montando
    // notas certas, mas em outra inversão (baixo errado)
    const other = inversionVoicing(q.chord, (q.inv + 1) % q.chord.tones.length);
    expect(drill.check(other)).toBe('wrong-bass');
    expect(drill.check(right)).toBe('correct');
    expect(drill.check(right)).toBeNull(); // já acertado
    expect(drill.stats).toEqual({ correct: 1, firstTry: 0, skipped: 0, answered: 1 });
    drill.next();
    const q2 = drill.question;
    expect(q2.symbol).not.toBe(q.symbol); // não repete o anterior
    expect(drill.check(inversionVoicing(q2.chord, q2.inv))).toBe('correct');
    drill.next();
    drill.skip();
    expect(drill.stats).toEqual({ correct: 2, firstTry: 1, skipped: 1, answered: 3 });
  });

  it('ignores symbols it cannot read', () => {
    expect(() => new ChordDrill(['H7'])).toThrow();
    expect(new ChordDrill(['xyz', 'G']).question.symbol).toBe('G');
  });
});

describe('earQuestion', () => {
  it('builds a major/minor question with the arpeggio and the chord', () => {
    const q = earQuestion('mm', 0, seededRng(3));
    expect(q.options.map((o) => o.value)).toEqual(['M', 'm']);
    expect(q.notes).toHaveLength(6);
    expect(questionEvents(q)).toHaveLength(12);
    expect(questionMs(q)).toBe(2900);
  });

  it('uses the intervals of the phase', () => {
    expect(earQuestion('int', 0, seededRng(1)).options).toHaveLength(5);
    expect(earQuestion('int', 3, seededRng(1)).options).toHaveLength(8);
  });

  it('plays the I–IV–V–I cadence before the degree', () => {
    const q = earQuestion('degree', 1, seededRng(2));
    expect(q.options.map((o) => o.value)).toEqual(['I', 'IV', 'V', 'vi']);
    expect(q.notes.filter((n) => n.t < 3000)).toHaveLength(16);
  });
});

describe('answerFromKeys', () => {
  const interval: EarQuestion = {
    mode: 'int',
    root: 60,
    answer: '7',
    notes: [],
    options: ['2', '3', '4', '7', '12'].map((v) => ({ label: v, value: v })),
  };

  it('reads an interval from the top note, ignoring the root itself', () => {
    expect(answerFromKeys(interval, [60])).toBeNull();
    expect(answerFromKeys(interval, [60, 67])).toBe('7');
    expect(answerFromKeys(interval, [72])).toBe('12');
    expect(answerFromKeys(interval, [79])).toBe('7'); // a quinta uma oitava acima
    expect(answerFromKeys(interval, [61])).toBe('1'); // errado, mas é uma resposta
  });

  it('reads a degree from the chord played', () => {
    const degree: EarQuestion = {
      mode: 'degree',
      root: 55, // Sol maior
      answer: 'vi',
      notes: [],
      options: ['I', 'IV', 'V', 'vi'].map((v) => ({ label: v, value: v })),
    };
    expect(answerFromKeys(degree, [64, 67])).toBeNull();
    expect(answerFromKeys(degree, [64, 67, 71])).toBe('vi'); // Em
    expect(answerFromKeys(degree, [60, 64, 67])).toBe('IV'); // C
    expect(answerFromKeys(degree, [60, 61, 62])).toBe('?');
  });

  it('reads major or minor from a chord', () => {
    const mm: EarQuestion = { mode: 'mm', root: 57, answer: 'm', notes: [], options: [] };
    expect(answerFromKeys(mm, [57, 60, 64])).toBe('m');
    expect(answerFromKeys(mm, [57, 61, 64])).toBe('M');
  });
});

describe('sight reading passages', () => {
  it('stays in the range and moves by small steps', () => {
    const rng = seededRng(5);
    for (let k = 0; k < 50; k++) {
      const p = makePassage('treble', { phase: 0, count: 8, extended: false }, rng);
      const [lo, hi] = rangeFor('treble', 1, false);
      expect(p.upper.every((d) => d >= lo && d <= hi)).toBe(true);
      expect(p.upper.slice(1).every((d, i) => Math.abs(d - p.upper[i]!) <= 3)).toBe(true);
    }
  });

  it('alternates clefs and builds both hands', () => {
    const a = makePassage('alternate', { phase: 1, count: 4, extended: false }, seededRng(1));
    const b = makePassage(
      'alternate',
      { phase: 1, count: 4, extended: false, previous: a },
      seededRng(2),
    );
    expect(a.clef).not.toBe(b.clef);
    const both = makePassage('both', { phase: 1, count: 4, extended: false }, seededRng(3));
    expect([both.clef, both.upper.length, both.lower?.length]).toEqual(['grand', 8, 4]);
  });

  it('times quarters in the right hand and halves in the left', () => {
    const p = { clef: 'grand' as const, upper: [28, 29, 30, 31], lower: [26, 28] };
    const ex = passageExpected(p, 60);
    expect(ex.map((n) => [n.t, n.pitch, n.position])).toEqual([
      [0, 57, 100], // Lá3
      [0, 60, 0], // Dó4
      [1000, 62, 1],
      [2000, 60, 101], // Dó4 na ME
      [2000, 64, 2],
      [3000, 65, 3],
    ]);
    expect(passageMs(p, 60)).toBe(4000);
  });
});
