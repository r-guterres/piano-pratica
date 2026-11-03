// Teclado do computador como piano (útil para desenvolver sem o Casio).
// Layout por posição física (KeyboardEvent.code), igual em QWERTY e ABNT2:
//
//    W E   T Y U   O P          ← teclas pretas
//   A S D F G H J K L Ç         ← teclas brancas (A = Dó)
//   Z = oitava abaixo, X = oitava acima

import type { Millis, NoteEvent } from '../core/events';

const CODE_OFFSETS: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16, // Ç no ABNT2
};

export const VELOCITY = 80;
const MIN_BASE = 24; // Dó1
const MAX_BASE = 96; // Dó7

/**
 * Converte teclas em eventos de nota. Guarda qual altura cada tecla ligou,
 * para que o note-off saia certo mesmo se a oitava mudar com a tecla presa.
 */
export class ComputerKeyboardMapper {
  /** Altura da tecla A (Dó). Padrão: Dó4 = 60. */
  base: number;
  readonly #held = new Map<string, number>();

  constructor(base = 60) {
    this.base = base;
  }

  keyDown(code: string, t: Millis, repeat = false): NoteEvent | null {
    if (code === 'KeyZ' || code === 'KeyX') {
      if (!repeat) {
        const next = this.base + (code === 'KeyZ' ? -12 : 12);
        this.base = Math.min(MAX_BASE, Math.max(MIN_BASE, next));
      }
      return null;
    }
    const offset = CODE_OFFSETS[code];
    if (offset === undefined || repeat || this.#held.has(code)) return null;
    const pitch = this.base + offset;
    this.#held.set(code, pitch);
    return { type: 'on', pitch, velocity: VELOCITY, t };
  }

  keyUp(code: string, t: Millis): NoteEvent | null {
    const pitch = this.#held.get(code);
    if (pitch === undefined) return null;
    this.#held.delete(code);
    return { type: 'off', pitch, velocity: 0, t };
  }

  /** Solta tudo (ex.: a janela perdeu o foco). */
  releaseAll(t: Millis): NoteEvent[] {
    const events = [...this.#held.values()].map((pitch): NoteEvent => ({
      type: 'off',
      pitch,
      velocity: 0,
      t,
    }));
    this.#held.clear();
    return events;
  }
}

/** Liga o mapeador aos eventos da janela. Retorna a função que desliga. */
export function attachComputerKeyboard(
  mapper: ComputerKeyboardMapper,
  emit: (event: NoteEvent) => void,
  target: Window = window,
): () => void {
  const typing = (e: KeyboardEvent) =>
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    (e.target instanceof HTMLElement && e.target.closest('input, textarea, select') !== null);

  const down = (e: KeyboardEvent) => {
    if (typing(e)) return;
    const ev = mapper.keyDown(e.code, performance.now(), e.repeat);
    if (ev) emit(ev);
  };
  const up = (e: KeyboardEvent) => {
    const ev = mapper.keyUp(e.code, performance.now());
    if (ev) emit(ev);
  };
  const blur = () => mapper.releaseAll(performance.now()).forEach(emit);

  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', blur);
  return () => {
    blur();
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
    target.removeEventListener('blur', blur);
  };
}
