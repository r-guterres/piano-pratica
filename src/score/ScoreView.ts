// Visualização da partitura como página de papel (PLANO_INICIAL.md §5.1).
//
// - O OSMD renderiza em páginas com a proporção exata da área visível
//   (setCustomPageFormat), então 1 página = 1 tela, em retrato ou paisagem.
// - As páginas ficam empilhadas num contêiner; mostrar a página p é deslocar o
//   contêiner de uma vez (sem rolagem animada).
// - Meia-virada: quando o cursor entra na metade de baixo da página p, uma
//   camada por cima mostra o início da página p+1 na metade de cima.
// - Zoom e mudança de tamanho/orientação re-renderizam e recolocam o cursor
//   pelo índice da posição, não por pixels.

import { CursorType, OpenSheetMusicDisplay, type GraphicalNote } from 'opensheetmusicdisplay';
import { planHalfTurn, type SystemBox } from './halfTurn';
import { extractTimeline } from './timeline';
import type { TimelinePosition } from './types';

export type PageTurnMode = 'full' | 'half';
export type Orientation = 'portrait' | 'landscape';

export interface ScoreViewOptions {
  /** Zoom separado por orientação: em paisagem costuma-se querer a partitura maior. */
  zoom: Record<Orientation, number>;
  pageTurn: PageTurnMode;
  cursorColor: string;
}

export interface ScoreViewState {
  /** Posição do cursor (índice na linha do tempo). */
  position: number;
  positionCount: number;
  /** Página onde está o cursor (0 = primeira). */
  cursorPage: number;
  /** Página exibida (difere de cursorPage se o usuário virou à mão). */
  viewPage: number;
  pageCount: number;
  halfTurn: boolean;
  orientation: Orientation;
  measure: number;
  rendering: boolean;
}

/** OSMD: 1 unidade = 10 px no zoom 1. */
const UNIT_PX = 10;
const PAPER = '#fffdf8';

export class ScoreView {
  readonly osmd: OpenSheetMusicDisplay;
  timeline: TimelinePosition[] = [];

  readonly #viewport: HTMLElement;
  readonly #sheet: HTMLElement;
  readonly #host: HTMLElement;
  readonly #overlay: HTMLElement;
  readonly #options: ScoreViewOptions;
  readonly #onChange: (state: ScoreViewState) => void;
  readonly #resizeObserver: ResizeObserver;

  #position = 0;
  #manualPage: number | null = null;
  #rendering = false;
  #loaded = false;
  #size = { w: 0, h: 0 };
  #resizeTimer: ReturnType<typeof setTimeout> | undefined;
  /** notas gráficas sob o cursor em cada posição (refeito a cada renderização) */
  #notesIndex: GraphicalNote[][] = [];
  /** cores aplicadas: posição → altura → cor (sobrevive a re-renderizações) */
  readonly #colors = new Map<number, Map<number, string>>();
  readonly #flashTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    viewport: HTMLElement,
    options: ScoreViewOptions,
    onChange: (state: ScoreViewState) => void,
  ) {
    this.#viewport = viewport;
    this.#options = { ...options, zoom: { ...options.zoom } };
    this.#onChange = onChange;

    viewport.classList.add('score-viewport');
    this.#sheet = el('div', 'score-sheet');
    this.#host = el('div', 'score-host');
    this.#overlay = el('div', 'score-overlay');
    this.#sheet.append(this.#host);
    viewport.append(this.#sheet, this.#overlay);

    this.osmd = new OpenSheetMusicDisplay(this.#host, {
      autoResize: false,
      backend: 'svg',
      drawPartNames: false,
      drawCredits: true,
      autoBeam: true,
      pageBackgroundColor: PAPER,
      cursorsOptions: [
        { type: CursorType.ThinLeft, color: options.cursorColor, alpha: 0.9, follow: false },
      ],
    });

    this.#resizeObserver = new ResizeObserver(() => this.#scheduleRelayout());
    this.#resizeObserver.observe(viewport);
  }

  async load(content: string | Blob, title?: string): Promise<void> {
    this.#setRendering(true);
    try {
      await this.osmd.load(content, title);
      this.timeline = extractTimeline(this.osmd.Sheet);
      this.#loaded = true;
      this.#position = 0;
      this.#manualPage = null;
      this.#colors.clear();
      this.#layout();
    } finally {
      this.#setRendering(false);
    }
  }

  get position(): number {
    return this.#position;
  }

  /** Move o cursor para a posição k (0…timeline.length-1). */
  moveTo(k: number): void {
    if (!this.#loaded || this.timeline.length === 0) return;
    const target = clamp(k, 0, this.timeline.length - 1);
    const cursor = this.osmd.cursor;
    if (target === this.#position + 1) {
      cursor.next();
    } else if (target === this.#position - 1) {
      cursor.previous();
    } else if (target !== this.#position) {
      this.#replayCursorTo(target);
    }
    this.#position = target;
    this.#manualPage = null;
    this.#updateView();
  }

  next(): void {
    this.moveTo(this.#position + 1);
  }

  previous(): void {
    this.moveTo(this.#position - 1);
  }

  /** Virada manual. A próxima movimentação do cursor volta a seguir o cursor. */
  turnPage(delta: number): void {
    const pages = this.#pageElements().length;
    if (pages === 0) return;
    const current = this.#manualPage ?? this.#cursorPage();
    this.#manualPage = clamp(current + delta, 0, pages - 1);
    this.#updateView();
  }

  get orientation(): Orientation {
    return this.#viewport.clientWidth > this.#viewport.clientHeight ? 'landscape' : 'portrait';
  }

  setZoom(orientation: Orientation, zoom: number): void {
    if (zoom === this.#options.zoom[orientation]) return;
    this.#options.zoom[orientation] = zoom;
    if (orientation === this.orientation) this.#relayout();
  }

  setPageTurn(mode: PageTurnMode): void {
    this.#options.pageTurn = mode;
    this.#updateView();
  }

  // ---- cores nas cabeças de nota (feedback de acerto/erro) ----

  /** Pinta (ou, com null, despinta) as cabeças de nota das alturas dadas na posição. */
  colorNotes(position: number, pitches: Iterable<number>, color: string | null): void {
    let byPitch = this.#colors.get(position);
    for (const pitch of pitches) {
      if (color === null) byPitch?.delete(pitch);
      else {
        if (!byPitch) this.#colors.set(position, (byPitch = new Map()));
        byPitch.set(pitch, color);
      }
      this.#paint(position, pitch, color);
    }
  }

  /** Remove as cores (de todas as posições, ou só das indicadas). */
  clearColors(positions?: Iterable<number>): void {
    for (const position of positions ?? [...this.#colors.keys()]) {
      const byPitch = this.#colors.get(position);
      if (!byPitch) continue;
      for (const pitch of byPitch.keys()) this.#paint(position, pitch, null);
      this.#colors.delete(position);
    }
  }

  /** Pisca uma cor por `ms` e volta à cor guardada. */
  flash(position: number, pitches: readonly number[], color: string, ms = 450): void {
    for (const p of pitches) this.#paint(position, p, color);
    const timer = setTimeout(() => {
      this.#flashTimers.delete(timer);
      for (const p of pitches) this.#paint(position, p, this.#colors.get(position)?.get(p) ?? null);
    }, ms);
    this.#flashTimers.add(timer);
  }

  #paint(position: number, pitch: number, color: string | null): void {
    for (const head of this.#noteheads(position, pitch)) {
      for (const path of head.querySelectorAll<SVGElement>('path')) {
        path.style.fill = color ?? '';
        path.style.stroke = color ?? '';
      }
    }
  }

  /**
   * Cabeças de nota da altura `pitch` na posição (sem continuações de ligadura
   * nem apojaturas). O OSMD devolve todas as cabeças de um acorde juntas; elas
   * são pareadas com as notas por altura: a mais grave é a mais baixa na pauta.
   */
  #noteheads(position: number, pitch: number): Element[] {
    const notes = this.#notesIndex[position] ?? [];
    const heads: Element[] = [];
    for (const g of notes) {
      const src = g.sourceNote;
      const tieContinuation = src.NoteTie !== undefined && src.NoteTie.StartNote !== src;
      if (src.halfTone + 12 !== pitch || tieContinuation || src.IsGraceNote) continue;
      const vf = (g as unknown as { getVFNoteSVG?: () => Element | null }).getVFNoteSVG?.();
      const all = (g as unknown as { getNoteheadSVGs?: () => Element[] }).getNoteheadSVGs?.() ?? [];
      if (all.length <= 1) {
        heads.push(...all);
        continue;
      }
      const chord = notes
        .filter(
          (o) => (o as unknown as { getVFNoteSVG?: () => Element | null }).getVFNoteSVG?.() === vf,
        )
        .sort((a, b) => a.sourceNote.halfTone - b.sourceNote.halfTone);
      const byHeight = [...all].sort(
        (a, b) => (b as SVGGraphicsElement).getBBox().y - (a as SVGGraphicsElement).getBBox().y,
      );
      const head = chord.length === byHeight.length ? byHeight[chord.indexOf(g)] : undefined;
      heads.push(...(head ? [head] : all));
    }
    return heads;
  }

  #buildNotesIndex(): void {
    const cursor = this.osmd.cursor;
    cursor.reset();
    const index: GraphicalNote[][] = [];
    for (let k = 0; k < this.timeline.length && !cursor.iterator.EndReached; k++) {
      index.push(cursor.GNotesUnderCursor());
      cursor.iterator.moveToNextVisibleVoiceEntry(false);
    }
    this.#notesIndex = index;
  }

  #repaintAll(): void {
    for (const [position, byPitch] of this.#colors) {
      for (const [pitch, color] of byPitch) this.#paint(position, pitch, color);
    }
  }

  destroy(): void {
    for (const t of this.#flashTimers) clearTimeout(t);
    clearTimeout(this.#resizeTimer);
    this.#resizeObserver.disconnect();
    this.osmd.clear();
    this.#viewport.replaceChildren();
  }

  // ---- layout ----

  #scheduleRelayout(): void {
    clearTimeout(this.#resizeTimer);
    this.#resizeTimer = setTimeout(() => {
      const { clientWidth: w, clientHeight: h } = this.#viewport;
      if (Math.abs(w - this.#size.w) > 2 || Math.abs(h - this.#size.h) > 2) this.#relayout();
    }, 250);
  }

  #relayout(): void {
    if (!this.#loaded) return;
    this.#setRendering(true);
    // deixa o navegador pintar o aviso "renderizando" antes do trabalho pesado
    requestAnimationFrame(() =>
      setTimeout(() => {
        try {
          this.#layout();
        } finally {
          this.#setRendering(false);
        }
      }),
    );
  }

  #layout(): void {
    const w = this.#viewport.clientWidth;
    const h = this.#viewport.clientHeight;
    if (w < 50 || h < 50) return;
    this.#size = { w, h };
    this.osmd.setCustomPageFormat(w, h);
    this.osmd.Zoom = this.#options.zoom[this.orientation];
    this.osmd.render();
    this.osmd.cursor.show();
    this.#buildNotesIndex();
    this.#replayCursorTo(this.#position);
    this.#repaintAll();
    this.#updateView();
  }

  #replayCursorTo(k: number): void {
    const cursor = this.osmd.cursor;
    cursor.reset();
    for (let i = 0; i < k && !cursor.iterator.EndReached; i++) {
      cursor.iterator.moveToNextVisibleVoiceEntry(false);
    }
    cursor.update();
  }

  // ---- páginas e sistemas ----

  #pageElements(): HTMLElement[] {
    return Array.from(this.#host.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.id.startsWith('osmdCanvasPage'),
    );
  }

  #cursorPage(): number {
    const parent = this.osmd.cursor?.cursorElement?.parentElement;
    const index = parent ? this.#pageElements().indexOf(parent) : -1;
    return Math.max(0, index);
  }

  /** Caixas verticais (px, relativas à página) dos sistemas da página p. */
  #systems(p: number): SystemBox[] {
    const page = this.osmd.GraphicSheet?.MusicPages[p];
    if (!page) return [];
    const scale = UNIT_PX * this.osmd.Zoom;
    return page.MusicSystems.map((s) => {
      const ps = s.PositionAndShape;
      const top = (ps.AbsolutePosition.y + ps.BorderTop) * scale;
      return { top, bottom: top + ps.Size.height * scale };
    });
  }

  #cursorTop(): number {
    return parseFloat(this.osmd.cursor.cursorElement.style.top) || 0;
  }

  // ---- exibição ----

  #updateView(): void {
    const pages = this.#pageElements();
    const cursorPage = this.#cursorPage();
    const viewPage = this.#manualPage ?? cursorPage;
    const pageEl = pages[viewPage];
    this.#sheet.style.transform = `translateY(${-(pageEl?.offsetTop ?? 0)}px)`;

    let halfTurn = false;
    this.#overlay.replaceChildren();
    this.#overlay.style.display = 'none';
    if (
      this.#manualPage === null &&
      this.#options.pageTurn === 'half' &&
      cursorPage + 1 < pages.length
    ) {
      halfTurn = this.#showHalfTurn(cursorPage, pages[cursorPage + 1]!);
    }

    this.#onChange({
      position: this.#position,
      positionCount: this.timeline.length,
      cursorPage,
      viewPage,
      pageCount: pages.length,
      halfTurn,
      orientation: this.orientation,
      measure: this.timeline[this.#position]?.measure ?? 0,
      rendering: this.#rendering,
    });
  }

  /**
   * Se o cursor estiver na metade de baixo da página p, cobre a metade de cima
   * com o começo da página p+1 (regra em halfTurn.ts). Retorna true se aplicou.
   */
  #showHalfTurn(p: number, nextPageEl: HTMLElement): boolean {
    const plan = planHalfTurn(this.#systems(p), this.#systems(p + 1), this.#cursorTop());
    const svg = nextPageEl.querySelector('svg');
    if (!plan || !svg) return false;
    const clip = el('div', 'score-overlay-clip');
    clip.style.height = `${plan.clipHeight}px`;
    clip.append(svg.cloneNode(true));
    this.#overlay.style.height = `${plan.coverHeight}px`;
    this.#overlay.style.display = 'block';
    this.#overlay.append(clip);
    return true;
  }

  #setRendering(value: boolean): void {
    this.#rendering = value;
    this.#viewport.classList.toggle('rendering', value);
  }
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
