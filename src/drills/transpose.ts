// Transpor cifras para outro tom maior, soletrando pelo grau: o IV de Dó (F)
// em Ré♭ vira G♭, não F♯; o V/7 (G/B) em Lá♭ vira E♭/G. Puro.

/** Os 12 tons maiores oferecidos, com a grafia mais usada. */
export const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const LETTERS = 'CDEFGAB';
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];
const SOLFEGE = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];

interface Note {
  letter: number;
  alter: number;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
const pcOf = (n: Note) => mod(NATURAL_PC[n.letter]! + n.alter, 12);

function parseNote(text: string): Note | null {
  const m = /^([A-G])([#b♯♭]?)$/.exec(text);
  if (!m) return null;
  return {
    letter: LETTERS.indexOf(m[1]!),
    alter: m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0,
  };
}

const ascii = (n: Note) => LETTERS[n.letter]! + (n.alter > 0 ? '#' : n.alter < 0 ? 'b' : '');

/** "Db" → "Ré♭" */
export function keyLabel(key: string): string {
  const n = parseNote(key);
  return n ? SOLFEGE[n.letter]! + (n.alter > 0 ? '♯' : n.alter < 0 ? '♭' : '') : key;
}

/** Tônica (classe de altura) de um tom de `KEYS`. */
export const keyTonic = (key: string) => {
  const n = parseNote(key);
  return n ? pcOf(n) : 0;
};

/** Leva `n` do tom `from` para o tom `to`, mantendo o grau (a letra anda junto). */
function moveNote(n: Note, from: Note, to: Note): Note {
  const letter = mod(n.letter + to.letter - from.letter, 7);
  const pc = mod(pcOf(n) + pcOf(to) - pcOf(from), 12);
  let alter = pc - NATURAL_PC[letter]!;
  if (alter > 6) alter -= 12;
  if (alter < -6) alter += 12;
  if (Math.abs(alter) <= 1) return { letter, alter };
  // dobrado sustenido/bemol: a grafia enarmônica, com bemóis nos tons de bemol
  const flats = to.alter < 0 || (to.letter === 3 && to.alter === 0);
  for (const a of flats ? [0, -1, 1] : [0, 1, -1]) {
    const l = NATURAL_PC.findIndex((p) => mod(p + a, 12) === pc);
    if (l >= 0) return { letter: l, alter: a };
  }
  return { letter, alter };
}

/** Transpõe uma cifra ("G/B", "Bbm7") de `from` para `to`; o que não for cifra volta igual. */
export function transposeSymbol(sym: string, from: string, to: string): string {
  const f = parseNote(from);
  const t = parseNote(to);
  const [main, bass] = sym.split('/');
  const m = /^([A-G][#b♯♭]?)(.*)$/.exec(main ?? '');
  const root = m && parseNote(m[1]!);
  if (!f || !t || !m || !root) return sym;
  let out = ascii(moveNote(root, f, t)) + m[2];
  if (bass !== undefined) {
    const b = parseNote(bass);
    if (!b) return sym;
    out += '/' + ascii(moveNote(b, f, t));
  }
  return out;
}

export const transposeChords = (chords: readonly string[], from: string, to: string) =>
  chords.map((c) => transposeSymbol(c, from, to));
