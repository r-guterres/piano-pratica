// Desenha um trecho do "ler e tocar" com o VexFlow: semínimas na pauta de
// cima (ou única) e mínimas na mão esquerda, barra a cada 4 tempos, cores por
// nota (avaliação do ritmo) e, se pedido, o nome das notas embaixo.

import {
  Annotation,
  BarNote,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
  type Note,
} from 'vexflow/bravura';
import { LOWER_POSITION, type Passage } from '../../drills/sightReading';

const LETTERS = 'cdefgab';
const SOLFEGE = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];

function notes(
  list: number[],
  clef: 'treble' | 'bass',
  duration: 'q' | 'h',
  firstPosition: number,
  colors: Record<number, string>,
  names: boolean,
): Note[] {
  const perBar = duration === 'q' ? 4 : 2;
  const out: Note[] = [];
  list.forEach((d, i) => {
    if (i > 0 && i % perBar === 0) out.push(new BarNote());
    const letter = ((d % 7) + 7) % 7;
    const n = new StaveNote({
      keys: [`${LETTERS[letter]}/${Math.floor(d / 7)}`],
      duration,
      clef,
      autoStem: true,
    });
    const color = colors[firstPosition + i];
    if (color) {
      const style = { fillStyle: color, strokeStyle: color };
      n.setStyle(style);
      n.setLedgerLineStyle(style);
    }
    if (names)
      n.addModifier(
        new Annotation(SOLFEGE[letter]!).setVerticalJustification(
          Annotation.VerticalJustify.BOTTOM,
        ),
        0,
      );
    out.push(n);
  });
  return out;
}

export function drawPassage(
  el: HTMLElement,
  p: Passage,
  colors: Record<number, string> = {},
  names = false,
): void {
  el.innerHTML = '';
  const grand = p.clef === 'grand';
  const single = p.clef === 'grand' ? 'treble' : p.clef;
  const width = Math.max(320, 110 + p.upper.length * 52);
  const height = grand ? 300 : 170;
  const renderer = new Renderer(el as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  const x = grand ? 30 : 10;
  const top = new Stave(x, 20, width - x - 10);
  top.addClef(single).addTimeSignature('4/4').setContext(ctx).draw();
  const upper = new Voice({ numBeats: p.upper.length, beatValue: 4 })
    .setMode(Voice.Mode.SOFT)
    .addTickables(notes(p.upper, single, 'q', 0, colors, names));
  const voices: [Voice, Stave][] = [[upper, top]];
  if (grand && p.lower) {
    const bottom = new Stave(x, 160, width - x - 10);
    bottom.addClef('bass').addTimeSignature('4/4').setContext(ctx).draw();
    new StaveConnector(top, bottom).setType('brace').setContext(ctx).draw();
    new StaveConnector(top, bottom).setType('singleLeft').setContext(ctx).draw();
    const lower = new Voice({ numBeats: p.upper.length, beatValue: 4 })
      .setMode(Voice.Mode.SOFT)
      .addTickables(notes(p.lower, 'bass', 'h', LOWER_POSITION, colors, names));
    voices.push([lower, bottom]);
  }
  const formatter = new Formatter();
  for (const [v] of voices) formatter.joinVoices([v]);
  formatter.format(
    voices.map(([v]) => v),
    width - x - 90,
  );
  for (const [v, s] of voices) v.draw(ctx, s);

  const svg = el.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '100%';
    svg.style.maxWidth = `${width * 1.6}px`;
    svg.style.height = 'auto';
  }
}
