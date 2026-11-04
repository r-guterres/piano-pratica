// Desenha a pauta do treino de leitura (uma nota, ou a pauta vazia) com o
// VexFlow. O SVG tem tamanho lógico fixo e escala para a largura do contêiner,
// então a pauta não "pula" quando a nota tem linhas suplementares.

import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
} from 'vexflow/bravura';
import {
  displayedAccidental,
  keySignatureName,
  type Clef,
  type ClefSelection,
  type DrillItem,
} from '../drills/notes';

/** O VexFlow 5 desenha os símbolos com a fonte Bravura: esperar ela carregar. */
export const fontsReady: Promise<void> = document.fonts
  .load('30px Bravura')
  .then(() => undefined)
  .catch(() => undefined);

const WIDTH = 260;
// Espaço para até 4 linhas suplementares acima e abaixo de cada pauta
// (linhas a cada 10 unidades; a linha de cima da pauta fica em y + 40).
const STAVE_Y: Record<'single' | Clef, number> = { single: 20, treble: 20, bass: 160 };
const HEIGHT = { single: 160, grand: 300 };

export interface StaffDrawing {
  clefs: ClefSelection;
  keySignature: number;
  item: DrillItem | null;
  color?: string;
}

const LETTERS = 'cdefgab';

export function drawStaff(el: HTMLElement, d: StaffDrawing): void {
  el.innerHTML = '';
  const grand = d.clefs === 'grand';
  const height = grand ? HEIGHT.grand : HEIGHT.single;
  const renderer = new Renderer(el as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(WIDTH, height);
  const ctx = renderer.getContext();

  const key = keySignatureName(d.keySignature);
  const staves = new Map<Clef, Stave>();
  const clefs: Clef[] = grand ? ['treble', 'bass'] : [d.clefs as Clef];
  for (const clef of clefs) {
    const y = grand ? STAVE_Y[clef] : STAVE_Y.single;
    const stave = new Stave(grand ? 30 : 10, y, WIDTH - (grand ? 40 : 20));
    stave.addClef(clef).addKeySignature(key).setContext(ctx).draw();
    staves.set(clef, stave);
  }
  if (grand) {
    const [top, bottom] = [staves.get('treble')!, staves.get('bass')!];
    new StaveConnector(top, bottom).setType('brace').setContext(ctx).draw();
    new StaveConnector(top, bottom).setType('singleLeft').setContext(ctx).draw();
  }

  if (d.item) {
    const stave = staves.get(d.item.clef)!;
    const { letter, octave } = d.item.note;
    const note = new StaveNote({
      keys: [`${LETTERS[letter]}/${octave}`],
      duration: 'w',
      clef: d.item.clef,
    });
    const acc = displayedAccidental(d.item.note, d.keySignature);
    if (acc) note.addModifier(new Accidental(acc), 0);
    if (d.color) {
      const style = { fillStyle: d.color, strokeStyle: d.color };
      note.setStyle(style);
      note.setLedgerLineStyle(style);
      for (const m of note.getModifiers()) m.setStyle(style);
    }
    // nota (com o acidente) no meio da área livre da pauta
    const start = stave.getNoteStartX();
    stave.setNoteStartX(start + Math.max(0, (stave.getNoteEndX() - start) / 2 - 30));
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note]);
    new Formatter().joinVoices([voice]).format([voice], 0);
    voice.draw(ctx, stave);
  }

  const svg = el.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${WIDTH} ${height}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '100%';
    svg.style.height = '100%';
  }
}
