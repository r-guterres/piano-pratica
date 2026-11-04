// Preferências do usuário. Por enquanto em localStorage (pequenas e por
// dispositivo); o histórico de prática irá para IndexedDB no M4.

import { DEFAULT_NAMING, type PitchNaming } from '../core/pitch';
import { diatonic, type PoolConfig } from '../drills/notes';
import type { Orientation, PageTurnMode } from '../score/ScoreView';
import type { HandSelection } from '../score/types';

const KEY = 'piano-pratica:settings';

export interface Settings {
  naming: PitchNaming;
  score: {
    zoom: Record<Orientation, number>;
    pageTurn: PageTurnMode;
    hands: HandSelection;
  };
  input: {
    computerKeyboard: boolean;
    virtualKeyboard: boolean;
    /** compact = Dó3–Dó6; full = Dó2–Dó7 (as 61 teclas do CTK-3500). */
    virtualRange: 'compact' | 'full';
  };
  drill: PoolConfig & {
    /** Erros na mesma nota antes de mostrar a resposta (0 = nunca). */
    revealAfter: number;
    /** Duração da rodada em minutos (0 = sem limite). */
    minutes: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  naming: { ...DEFAULT_NAMING },
  score: { zoom: { portrait: 1, landscape: 1.2 }, pageTurn: 'full', hands: 'both' },
  input: { computerKeyboard: true, virtualKeyboard: false, virtualRange: 'compact' },
  drill: {
    clefs: 'treble',
    // uma linha suplementar de cada lado: Dó4–Lá5 (sol) e Mi2–Dó4 (fá)
    range: {
      treble: { low: diatonic(0, 4), high: diatonic(5, 5) },
      bass: { low: diatonic(2, 2), high: diatonic(0, 4) },
    },
    accidentals: false,
    keySignature: 0,
    revealAfter: 3,
    minutes: 5,
  },
};

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.5;

/** Mescla o que foi salvo com os padrões, campo a campo (versões antigas não quebram). */
export function mergeSettings(saved: unknown): Settings {
  const s = (saved ?? {}) as Partial<Record<keyof Settings, object>>;
  return {
    naming: { ...DEFAULT_SETTINGS.naming, ...s.naming },
    score: {
      ...DEFAULT_SETTINGS.score,
      ...s.score,
      zoom: mergeZoom((s.score as { zoom?: unknown } | undefined)?.zoom),
    },
    input: { ...DEFAULT_SETTINGS.input, ...s.input },
    drill: mergeDrill(s.drill),
  };
}

function mergeDrill(saved: object | undefined): Settings['drill'] {
  const d = (saved ?? {}) as Partial<Settings['drill']>;
  const range = DEFAULT_SETTINGS.drill.range;
  return {
    ...DEFAULT_SETTINGS.drill,
    ...d,
    range: {
      treble: { ...range.treble, ...d.range?.treble },
      bass: { ...range.bass, ...d.range?.bass },
    },
  };
}

function mergeZoom(saved: unknown): Record<Orientation, number> {
  // versões antigas guardavam um único número
  if (typeof saved === 'number') return { portrait: saved, landscape: saved };
  return { ...DEFAULT_SETTINGS.score.zoom, ...(saved as object | undefined) };
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return mergeSettings(JSON.parse(raw));
  } catch {
    // armazenamento indisponível (aba anônima, dados bloqueados): usa o padrão
  }
  return mergeSettings(null);
}

export const settings: Settings = $state(load());

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // sem persistência; a preferência vale só para esta sessão
  }
}
