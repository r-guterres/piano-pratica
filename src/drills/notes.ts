// Notas escritas na pauta (letra + alteração + oitava) e o conjunto de itens do
// treino de leitura. Puro.

import type { MidiPitch } from '../core/events';
import { DEFAULT_NAMING, type PitchNaming } from '../core/pitch';

export type Clef = 'treble' | 'bass';
export type ClefSelection = Clef | 'grand';

/** Alteração efetiva da nota: −1 = ♭, 0 = natural, 1 = ♯. */
export type Alter = -1 | 0 | 1;

/** Nota como escrita. `letter`: 0 = Dó … 6 = Si; `octave` na convenção científica (Dó central = 4). */
export interface WrittenNote {
  letter: number;
  alter: Alter;
  octave: number;
}

/** Item do treino: o par (clave, nota escrita) do §6, com a altura que deve ser tocada. */
export interface DrillItem {
  id: string;
  clef: Clef;
  note: WrittenNote;
  pitch: MidiPitch;
}

/** Extensão em posições diatônicas (`octave * 7 + letter`), inclusive. */
export interface DiatonicRange {
  low: number;
  high: number;
}

export interface PoolConfig {
  clefs: ClefSelection;
  range: Record<Clef, DiatonicRange>;
  /** Incluir notas com ♯/♭ (ou ♮) escritos. */
  accidentals: boolean;
  /** Armadura em quintas: 0 = nenhuma, 1 = um ♯ (Sol maior), −1 = um ♭ (Fá maior)… */
  keySignature: number;
}

const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const LETTERS = 'CDEFGAB';
const SOLFEGE = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];
/** Ordem dos sustenidos na armadura (F C G D A E B); a dos bemóis é a inversa. */
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];

export const diatonic = (letter: number, octave: number) => octave * 7 + letter;
export const fromDiatonic = (d: number) => ({
  letter: ((d % 7) + 7) % 7,
  octave: Math.floor(d / 7),
});

export function midiOf(n: WrittenNote): MidiPitch {
  return (n.octave + 1) * 12 + LETTER_PC[n.letter]! + n.alter;
}

/** Alteração que a armadura dá a uma letra. */
export function keyAlter(fifths: number, letter: number): Alter {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
  if (fifths < 0) return SHARP_ORDER.toReversed().slice(0, -fifths).includes(letter) ? -1 : 0;
  return 0;
}

/** Acidente a escrever junto da nota, dada a armadura (null = nenhum). */
export function displayedAccidental(n: WrittenNote, fifths: number): '#' | 'b' | 'n' | null {
  if (n.alter === keyAlter(fifths, n.letter)) return null;
  return n.alter === 1 ? '#' : n.alter === -1 ? 'b' : 'n';
}

export function itemId(clef: Clef, n: WrittenNote): string {
  const acc = n.alter === 1 ? '#' : n.alter === -1 ? 'b' : '';
  return `${clef}:${LETTERS[n.letter]}${acc}${n.octave}`;
}

/** Nome da nota escrita, respeitando as preferências (Fá♯3, F♯3, Dó central = Dó3…). */
export function writtenName(n: WrittenNote, naming: PitchNaming = DEFAULT_NAMING): string {
  const letter = naming.style === 'solfege' ? SOLFEGE[n.letter] : LETTERS[n.letter];
  const acc = n.alter === 1 ? '♯' : n.alter === -1 ? '♭' : '';
  const octave = naming.octave === 'middle-c-4' ? n.octave : n.octave - 1;
  return `${letter}${acc}${octave}`;
}

/** Nome de uma posição natural da pauta (para os seletores de extensão). */
export function diatonicName(d: number, naming: PitchNaming = DEFAULT_NAMING): string {
  return writtenName({ ...fromDiatonic(d), alter: 0 }, naming);
}

/** Mi♯, Si♯, Dó♭ e Fá♭ só entram quando a armadura já os pede. */
const isOddSpelling = (letter: number, alter: Alter) =>
  (alter === 1 && (letter === 2 || letter === 6)) ||
  (alter === -1 && (letter === 0 || letter === 3));

/** Todos os itens possíveis com a configuração, por clave e de grave para agudo. */
export function buildPool(config: PoolConfig): DrillItem[] {
  const clefs: Clef[] = config.clefs === 'grand' ? ['treble', 'bass'] : [config.clefs];
  const items: DrillItem[] = [];
  for (const clef of clefs) {
    const { low, high } = config.range[clef];
    for (let d = low; d <= high; d++) {
      const { letter, octave } = fromDiatonic(d);
      const base = keyAlter(config.keySignature, letter);
      const alters: Alter[] = config.accidentals ? [-1, 0, 1] : [base];
      for (const alter of alters) {
        if (alter !== base && isOddSpelling(letter, alter)) continue;
        const note: WrittenNote = { letter, alter, octave };
        items.push({ id: itemId(clef, note), clef, note, pitch: midiOf(note) });
      }
    }
  }
  return items;
}

/** Nome da tonalidade maior da armadura, no formato do VexFlow. */
export function keySignatureName(fifths: number): string {
  const major = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  return major[fifths + 7] ?? 'C';
}

/** Linhas da pauta (para escolher extensões): Sol = Mi4…Fá5, Fá = Sol2…Lá3. */
export const STAFF_LINES: Record<Clef, DiatonicRange> = {
  treble: { low: diatonic(2, 4), high: diatonic(3, 5) },
  bass: { low: diatonic(4, 2), high: diatonic(5, 3) },
};
