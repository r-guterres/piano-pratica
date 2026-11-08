import { describe, expect, it } from 'vitest';
import { ChordDrill } from './chordDrill';
import { CHORD_PRESETS, chordPreset } from './chordPresets';
import { PHASES } from '../trail/content';
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
    const right = inversionVoicing(q.chord, q.inv!);
    expect(drill.check(right.slice(0, 2))).toBeNull(); // ainda montando
    // notas certas, mas em outra inversão (baixo errado)
    const other = inversionVoicing(q.chord, (q.inv! + 1) % q.chord.tones.length);
    expect(drill.check(other)).toBe('wrong-bass');
    expect(drill.check(right)).toBe('correct');
    expect(drill.check(right)).toBeNull(); // já acertado
    expect(drill.stats).toEqual({ correct: 1, firstTry: 0, skipped: 0, answered: 1 });
    drill.next();
    const q2 = drill.question;
    expect(q2.symbol).not.toBe(q.symbol); // não repete o anterior
    expect(drill.check(inversionVoicing(q2.chord, q2.inv!))).toBe('correct');
    drill.next();
    drill.skip();
    expect(drill.stats).toEqual({ correct: 2, firstTry: 1, skipped: 1, answered: 3 });
  });

  it('flags an incomplete chord when the keys are released (tablet: D7 played as a lone D)', () => {
    const drill = new ChordDrill(['D7'], seededRng(3));
    const d = 50; // Ré
    expect(drill.check([d])).toBeNull(); // ainda montando
    expect(drill.check([])).toBe('incomplete'); // soltou sem completar
    expect(drill.lastAttempt).toEqual([d]);
    // uma nota de fora do acorde, mesmo com poucas teclas, é erro
    drill.check([d]);
    drill.check([d, 51]);
    expect(drill.check([])).toBe('wrong');
    // soltar depois de um veredito não conta de novo
    const q = drill.question;
    const right = inversionVoicing(q.chord, q.inv!);
    expect(drill.check(right)).toBe('correct');
    expect(drill.check([])).toBeNull();
    expect(drill.stats.firstTry).toBe(0);
  });

  it('ignores the keys of the previous chord still held when the next one appears', () => {
    const drill = new ChordDrill(['C', 'G'], seededRng(4));
    const q = drill.question;
    const right = inversionVoicing(q.chord, q.inv!);
    expect(drill.check(right)).toBe('correct');
    drill.next(right); // o aluno ainda segura o acorde
    expect(drill.check(right.slice(0, 2))).toBeNull(); // soltando aos poucos
    expect(drill.check([])).toBeNull(); // não conta como tentativa do novo acorde
    drill.check([right[0]!]);
    expect(drill.check([])).not.toBeNull(); // agora sim
  });

  it('asks a progression in order, with the bass written in the chart (tópico h0c)', () => {
    const p = chordPreset('h0c')!;
    const drill = new ChordDrill(p.chords, seededRng(5), p);
    expect(drill.labels).toEqual(['C', 'F/C', 'G/B', 'C']);
    const seen: string[] = [];
    for (let k = 0; k < 5; k++) {
      const q = drill.question;
      seen.push(q.label);
      expect(drill.check(inversionVoicing(q.chord, q.inv!))).toBe('correct');
      drill.next();
    }
    expect(seen).toEqual(['C', 'F/C', 'G/B', 'C', 'C']); // recomeça no fim
  });

  it('accepts any inversion when the exercise asks for voice leading', () => {
    const p = chordPreset('h1b')!;
    const drill = new ChordDrill(p.chords, seededRng(6), p);
    const q = drill.question;
    expect(q.inv).toBeNull();
    expect(drill.check(inversionVoicing(q.chord, 2))).toBe('correct');
  });

  it('remembers the chords that did not come out first try', () => {
    const drill = new ChordDrill(['C/E', 'G'], seededRng(7), {
      order: 'sequence',
      inversions: 'written',
    });
    const q = drill.question; // C/E
    drill.check(inversionVoicing(q.chord, 0)); // fundamental: baixo errado
    drill.check(inversionVoicing(q.chord, 1));
    drill.next();
    drill.skip(); // G
    expect(drill.trouble).toEqual({ 'C/E': 1, G: 1 });
  });

  it('reads every chord of every exercise, and each exercise belongs to a harmony topic', () => {
    const topics = PHASES.flatMap((f) => f.harmony.map((t) => t.id));
    for (const p of CHORD_PRESETS) {
      expect(topics).toContain(p.topic);
      expect(new ChordDrill(p.chords, seededRng(1), p).labels).toHaveLength(p.chords.length);
    }
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

it('names any interval', async () => {
  const { intervalName } = await import('./earDrill');
  expect([intervalName(1), intervalName(11), intervalName(12), intervalName(19)]).toEqual([
    '2ª menor',
    '7ª maior',
    'oitava',
    '5ª justa',
  ]);
});
