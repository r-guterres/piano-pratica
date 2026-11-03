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

import { CursorType, OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
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

  destroy(): void {
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
    this.#replayCursorTo(this.#position);
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
