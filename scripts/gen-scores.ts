// Gera public/scores/*.musicxml e public/scores/index.json a partir das
// especificações abaixo. Uso: `npm run gen:scores`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { toMusicXml, type PieceSpec } from './musicxml.ts';

const ORIGINAL = 'Exercício original deste projeto';

// ---- Estudo de 32 compassos: 8 frases de 5 dedos em posições diatônicas de Dó maior ----

const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];

/** Nota `degree` graus acima de `base` (ex.: "g4"), dentro de Dó maior. */
function diatonic(base: string, degree: number): string {
  const li = LETTERS.indexOf(base[0]!);
  const abs = li + degree;
  return `${LETTERS[abs % 7]}${Number(base.slice(1)) + Math.floor(abs / 7)}`;
}

type Bar = [degree: number, dur: string][];
const TEMPLATES: { rh: Bar[]; lh: Bar[] }[] = [
  {
    rh: [
      [
        [0, 'q'],
        [1, 'q'],
        [2, 'q'],
        [3, 'q'],
      ],
      [
        [4, 'q'],
        [3, 'q'],
        [2, 'h'],
      ],
      [
        [1, 'q'],
        [2, 'q'],
        [3, 'q'],
        [1, 'q'],
      ],
      [[0, 'w']],
    ],
    lh: [
      [
        [0, 'h'],
        [4, 'h'],
      ],
      [[2, 'w']],
      [
        [1, 'h'],
        [4, 'h'],
      ],
      [[0, 'w']],
    ],
  },
  {
    rh: [
      [
        [4, 'q'],
        [2, 'q'],
        [3, 'q'],
        [1, 'q'],
      ],
      [
        [2, 'q'],
        [0, 'q'],
        [1, 'h'],
      ],
      [
        [0, 'q'],
        [2, 'q'],
        [4, 'q'],
        [2, 'q'],
      ],
      [
        [1, 'h'],
        [0, 'h'],
      ],
    ],
    lh: [
      [[0, 'w']],
      [
        [4, 'h'],
        [2, 'h'],
      ],
      [
        [0, 'h'],
        [2, 'h'],
      ],
      [
        [4, 'h'],
        [0, 'h'],
      ],
    ],
  },
];
const POSITIONS: [rh: string, lh: string, template: number][] = [
  ['c4', 'c3', 0],
  ['g4', 'g2', 1],
  ['f4', 'f2', 0],
  ['d4', 'd3', 1],
  ['a4', 'a2', 0],
  ['e4', 'e3', 1],
  ['g4', 'g2', 1],
  ['c4', 'c3', 0],
];
const barText = (base: string, bar: Bar) =>
  bar.map(([deg, dur]) => `${diatonic(base, deg)}/${dur}`).join(' ');

const estudo32: string[][] = POSITIONS.flatMap(([rh, lh, t]) =>
  TEMPLATES[t]!.rh.map((bar, i) => [barText(rh, bar), barText(lh, TEMPLATES[t]!.lh[i]!)]),
);

// ---- Biblioteca ----

const PIECES: PieceSpec[] = [
  {
    id: 'do-md-01',
    title: 'Leitura em Dó — mão direita',
    composer: 'piano-pratica',
    level: 1,
    tags: ['exercício', 'MD', 'clave de sol', 'Dó maior'],
    source: ORIGINAL,
    fifths: 0,
    time: [4, 4],
    clefs: ['G'],
    measures: [
      ['c4/q d4 e4 f4'],
      ['g4/h e4'],
      ['f4/q e4 d4 c4'],
      ['d4/h g4'],
      ['e4/q g4 f4 d4'],
      ['e4/q c4 d4/h'],
      ['g4/q f4 e4 d4'],
      ['c4/w'],
    ],
  },
  {
    id: 'do-me-01',
    title: 'Leitura em Dó — mão esquerda',
    composer: 'piano-pratica',
    level: 1,
    tags: ['exercício', 'ME', 'clave de fá', 'Dó maior'],
    source: ORIGINAL,
    fifths: 0,
    time: [4, 4],
    clefs: ['F'],
    measures: [
      ['c3/q d3 e3 f3'],
      ['g3/h e3'],
      ['f3/q d3 e3 c3'],
      ['g3/h c3'],
      ['e3/q f3 g3 e3'],
      ['d3/q e3 f3 d3'],
      ['g3/q f3 e3 d3'],
      ['c3/w'],
    ],
  },
  {
    id: 'do-maos-juntas-01',
    title: 'Mãos juntas em Dó',
    composer: 'Tradicional (Mary Had a Little Lamb)',
    level: 1,
    tags: ['exercício', 'mãos juntas', 'Dó maior'],
    source: 'Melodia tradicional (domínio público); acompanhamento original deste projeto',
    fifths: 0,
    time: [4, 4],
    clefs: ['G', 'F'],
    measures: [
      ['e4/q d4 c4 d4', 'c3/w'],
      ['e4/q e4 e4/h', 'c3/h e3'],
      ['d4/q d4 d4/h', 'g3/w'],
      ['e4/q g4 g4/h', 'c3/h e3'],
      ['e4/q d4 c4 d4', 'c3/w'],
      ['e4/q e4 e4 e4', 'c3/h e3'],
      ['d4/q d4 e4 d4', 'g3/h f3'],
      ['c4/w', 'c3/w'],
    ],
  },
  {
    id: 'acordes-do-01',
    title: 'Acordes em Dó, com ligaduras',
    composer: 'piano-pratica',
    level: 2,
    tags: ['exercício', 'acordes', 'ligaduras', 'mãos juntas', 'Dó maior'],
    source: ORIGINAL,
    fifths: 0,
    time: [4, 4],
    clefs: ['G', 'F'],
    measures: [
      ['[c4 e4 g4]/h [c4 e4 g4]', 'c3/w'],
      ['[c4 f4 a4]/h [c4 f4 a4]', 'f2/w'],
      ['[b3 d4 g4]/h [c4 e4 g4]', 'g2/h c3'],
      ['[b3 f4 g4]/h [c4~ e4~ g4~]', 'g2/h c3'],
      ['[c4 e4 g4]/h [d4 f4 a4]', 'c3/h d3'],
      ['[e4 g4 c5]/w', 'c3/q e3 g3 c3'],
      ['g4/h~ g4/q f4', 'g2/h b2'],
      ['[e4 g4 c5]/w', 'c3/w'],
    ],
  },
  {
    id: 'estudo-leitura-32',
    title: 'Estudo de leitura em Dó (32 compassos)',
    composer: 'piano-pratica',
    level: 2,
    tags: ['exercício', 'mãos juntas', 'posições', 'Dó maior', 'várias páginas'],
    source: ORIGINAL,
    fifths: 0,
    time: [4, 4],
    clefs: ['G', 'F'],
    measures: estudo32,
  },
  {
    id: 'ode-alegria',
    title: 'Ode à Alegria (simplificada)',
    composer: 'Ludwig van Beethoven',
    level: 1,
    tags: ['peça', 'mãos juntas', 'Dó maior', 'domínio público'],
    source: 'Tema da 9ª Sinfonia (domínio público); arranjo simplificado original deste projeto',
    fifths: 0,
    time: [4, 4],
    clefs: ['G', 'F'],
    measures: [
      ['e4/q e4 f4 g4', 'c3/w'],
      ['g4/q f4 e4 d4', 'g2/w'],
      ['c4/q c4 d4 e4', 'c3/w'],
      ['e4/q. d4/e d4/h', 'g2/w'],
      ['e4/q e4 f4 g4', 'c3/w'],
      ['g4/q f4 e4 d4', 'g2/w'],
      ['c4/q c4 d4 e4', 'c3/w'],
      ['d4/q. c4/e c4/h', 'g2/h c3'],
      ['d4/q d4 e4 c4', 'g2/w'],
      ['d4/q e4/e f4 e4/q c4', 'g2/h c3'],
      ['d4/q e4/e f4 e4/q d4', 'g2/w'],
      ['c4/q d4 g3/h', 'c3/h g2'],
      ['e4/q e4 f4 g4', 'c3/w'],
      ['g4/q f4 e4 d4', 'g2/w'],
      ['c4/q c4 d4 e4', 'c3/w'],
      ['d4/q. c4/e c4/h', 'g2/h c3'],
    ],
  },
  {
    id: 'minueto-sol',
    title: 'Minueto em Sol maior (1ª parte)',
    composer: 'Christian Petzold (atrib.)',
    level: 2,
    tags: ['peça', 'mãos juntas', 'Sol maior', 'barroco', 'domínio público'],
    source:
      'Caderno de Anna Magdalena Bach, BWV Anh. 114 (domínio público). Compassos 1–16, sem ' +
      'ritornelo; transcrição deste projeto — confira com uma edição impressa.',
    fifths: 1,
    time: [3, 4],
    clefs: ['G', 'F'],
    measures: [
      ['d5/q g4/e a4 b4 c5', '[g3 b3 d4]/h a3/q'],
      ['d5/q g4 g4', 'b3/h.'],
      ['e5/q c5/e d5 e5 f#5', 'c4/h.'],
      ['g5/q g4 g4', 'b3/h.'],
      ['c5/q d5/e c5 b4 a4', 'a3/h.'],
      ['b4/q c5/e b4 a4 g4', 'g3/h.'],
      ['f#4/q g4/e a4 b4 g4', 'd4/q b3 g3'],
      ['a4/h.', 'd4/q d3/e c4 b3 a3'],
      ['d5/q g4/e a4 b4 c5', 'b3/h a3/q'],
      ['d5/q g4 g4', 'g3/q b3 g3'],
      ['e5/q c5/e d5 e5 f#5', 'c4/h.'],
      ['g5/q g4 g4', 'b3/q c4/e b3 a3 g3'],
      ['c5/q d5/e c5 b4 a4', 'a3/h f#3/q'],
      ['b4/q c5/e b4 a4 g4', 'g3/h b3/q'],
      ['a4/q b4/e a4 g4 f#4', 'c4/q d4 d3'],
      ['g4/h.', 'g3/h g2/q'],
    ],
  },
];

const OUT = join(import.meta.dirname, '..', 'public', 'scores');
mkdirSync(OUT, { recursive: true });

const index = PIECES.map((p) => {
  const file = `${p.id}.musicxml`;
  writeFileSync(join(OUT, file), toMusicXml(p));
  return {
    id: p.id,
    title: p.title,
    composer: p.composer,
    level: p.level,
    tags: p.tags,
    file,
    source: p.source,
  };
});
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`${index.length} partituras geradas em ${OUT}`);
