// Ponto único de entrada: todas as fontes (MIDI, teclado virtual, teclado do
// computador) publicam aqui; telas e modos de prática assinam. Puro.

import type { InputEvent } from '../core/events';

export type InputSourceId = 'midi' | 'virtual' | 'computer';

export const SOURCE_LABELS: Record<InputSourceId, string> = {
  midi: 'Teclado MIDI',
  virtual: 'Teclado na tela',
  computer: 'Teclado do computador',
};

export type InputListener = (event: InputEvent, source: InputSourceId) => void;

export class InputHub {
  readonly #listeners = new Set<InputListener>();

  subscribe(listener: InputListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(event: InputEvent, source: InputSourceId): void {
    for (const l of this.#listeners) l(event, source);
  }
}

/** Teclas (alturas) atualmente pressionadas, contando cada fonte separadamente. */
export class HeldNotes {
  readonly #bySource = new Map<InputSourceId, Set<number>>();

  apply(event: InputEvent, source: InputSourceId): void {
    if (event.type === 'pedal') return;
    let set = this.#bySource.get(source);
    if (!set) this.#bySource.set(source, (set = new Set()));
    if (event.type === 'on') set.add(event.pitch);
    else set.delete(event.pitch);
  }

  /** União de todas as fontes. */
  pitches(): Set<number> {
    const all = new Set<number>();
    for (const set of this.#bySource.values()) for (const p of set) all.add(p);
    return all;
  }

  clear(source?: InputSourceId): void {
    if (source) this.#bySource.delete(source);
    else this.#bySource.clear();
  }
}

/** Instância única usada pelo app. */
export const inputHub = new InputHub();
