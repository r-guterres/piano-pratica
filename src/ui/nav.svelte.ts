// Navegação do app (sem roteador): a aba aberta, as sub-abas e a partitura
// aberta no leitor. Fica num módulo para que a aba "Hoje" possa levar direto
// a um treino, ao metrônomo ou a uma partitura.

import type { ScoreSource } from './Library.svelte';
import type { BlockId } from '../trail/state';
import { scoreSource } from './scores';
import { showToast } from './toast.svelte';

export type ScreenId =
  'today' | 'trail' | 'library' | 'drill' | 'metronome' | 'progress' | 'monitor' | 'settings';
export type Training = 'reading' | 'sight' | 'chords' | 'ear' | 'pedal';
export type TrailView = 'phases' | 'repertoire';

/** Treino aberto por um bloco do Hoje: a meta de minutos e o tópico do bloco. */
export interface DrillGoal {
  training: Training;
  minutes: number;
  block: BlockId;
  /** Tópico do bloco (escolhe o exercício: progressão de acordes, modo do ouvido). */
  topic: string | null;
}

export const nav = $state<{
  screen: ScreenId;
  training: Training;
  trailView: TrailView;
  /** Música a mostrar no repertório (rola até ela). */
  song: string | null;
  openScore: ScoreSource | null;
  goal: DrillGoal | null;
}>({
  screen: 'today',
  training: 'reading',
  trailView: 'phases',
  song: null,
  openScore: null,
  goal: null,
});

export function go(
  screen: ScreenId,
  opts: {
    training?: Training;
    trailView?: TrailView;
    song?: string | null;
    goal?: Omit<DrillGoal, 'training'>;
  } = {},
): void {
  if (opts.training) nav.training = opts.training;
  nav.goal = opts.goal && opts.training ? { ...opts.goal, training: opts.training } : null;
  if (opts.trailView) nav.trailView = opts.trailView;
  nav.song = opts.song ?? null;
  nav.screen = screen;
  window.scrollTo(0, 0);
}

/** Abre no leitor a partitura com este id (da biblioteca ou importada). */
export async function openScoreById(id: string): Promise<void> {
  const source = await scoreSource(id).catch(() => null);
  if (source) nav.openScore = source;
  else showToast('Não achei essa partitura no app. Ligue a música a outra no Repertório.');
}
