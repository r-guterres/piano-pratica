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
  playback: {
    /** Onde soam as notas da partitura e o metrônomo (sem MIDI, o tablet). */
    notesOutput: SoundOutput;
    clickOutput: SoundOutput;
    /** Atraso do alto-falante (ms), calibrado; null = estimativa do navegador. */
    speakerLatencyMs: number | null;
    /** Compassos de contagem antes de começar. */
    countIn: number;
    /** Metrônomo ligado no modo acompanhar. */
    metronome: boolean;
    /** Escada de andamento no loop do modo acompanhar. */
    ladder: boolean;
    /** O que o app toca no modo acompanhar. */
    listen: ListenMode;
    /** Andamento das partituras sem andamento escrito (semínimas por minuto). */
    defaultBpm: number;
    /** Andamento escolhido por partitura (id → bpm). */
    bpm: Record<string, number>;
    /** Metrônomo avulso. */
    metronomeBpm: number;
    metronomeMeter: MetronomeMeter;
  };
  drill: PoolConfig & {
    /** Erros na mesma nota antes de mostrar a resposta (0 = nunca). */
    revealAfter: number;
    /** Duração da rodada em minutos (0 = sem limite). */
    minutes: number;
  };
}

export type SoundOutput = 'casio' | 'speaker';
/** none = só o cursor; other = a mão que não está selecionada; all = tudo. */
export type ListenMode = 'none' | 'other' | 'all';
export const METRONOME_METERS = ['1/4', '2/4', '3/4', '4/4', '6/8'] as const;
export type MetronomeMeter = (typeof METRONOME_METERS)[number];

export const DEFAULT_SETTINGS: Settings = {
  naming: { ...DEFAULT_NAMING },
  score: { zoom: { portrait: 1, landscape: 1.2 }, pageTurn: 'full', hands: 'both' },
  input: { computerKeyboard: true, virtualKeyboard: false, virtualRange: 'compact' },
  playback: {
    notesOutput: 'casio',
    clickOutput: 'casio',
    speakerLatencyMs: null,
    countIn: 1,
    metronome: true,
    ladder: false,
    listen: 'none',
    defaultBpm: 80,
    bpm: {},
    metronomeBpm: 80,
    metronomeMeter: '4/4',
  },
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
    playback: {
      ...DEFAULT_SETTINGS.playback,
      ...s.playback,
      bpm: { ...(s.playback as { bpm?: object } | undefined)?.bpm },
    },
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
