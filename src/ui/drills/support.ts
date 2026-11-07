// Apoio aos treinos do M8: tocar notas pela saída escolhida (Casio ou tablet)
// e gravar a sessão do treino no histórico a cada resposta.

import type { InputEvent } from '../../core/events';
import { makeOutputs } from '../../playback/outputs';
import { Player, type VisualEvent } from '../../playback/player';
import { recordingSchedule, type Schedule } from '../../playback/schedule';
import { audioContext } from '../../playback/sinks';
import { appHistory, newId, type ExerciseKind, type ExerciseRecord } from '../../storage/history';

let current: Player | null = null;

/** Para o que estiver tocando. */
export function stopSound(): void {
  current?.stop();
  current = null;
}

/**
 * Toca um Schedule (notas e/ou cliques) pelas saídas das configurações.
 * Devolve o Player (para o `bodyOrigin`) e um aviso se caiu para o tablet.
 */
export function playSchedule(
  schedule: Schedule,
  opts: { clicks?: boolean; onVisual?: (e: VisualEvent) => void; onEnd?: () => void } = {},
): { player: Player; warning: string } {
  stopSound();
  audioContext();
  const out = makeOutputs({ clicks: opts.clicks ?? false, notes: true });
  const player = new Player(
    out,
    (e) => opts.onVisual?.(e),
    () => {
      if (current === player) current = null;
      opts.onEnd?.();
    },
  );
  player.start(schedule, false);
  current = player;
  return { player, warning: out.warning };
}

/** Toca eventos de nota (t em ms desde o início). */
export const playEvents = (events: InputEvent[], durationMs: number) =>
  playSchedule(recordingSchedule(events, durationMs));

/** Notas soltas em sequência e depois juntas (arpejo + acorde), para ouvir um acorde. */
export function chordEvents(pitches: readonly number[], gapMs = 300): InputEvent[] {
  const sorted = [...pitches].sort((a, b) => a - b);
  const chordAt = sorted.length * gapMs + 250;
  return [
    ...sorted.flatMap((pitch, i): InputEvent[] => [
      { type: 'on', pitch, velocity: 80, t: i * gapMs },
      { type: 'off', pitch, velocity: 0, t: i * gapMs + 1000 },
    ]),
    ...sorted.flatMap((pitch): InputEvent[] => [
      { type: 'on', pitch, velocity: 80, t: chordAt },
      { type: 'off', pitch, velocity: 0, t: chordAt + 1800 },
    ]),
  ];
}

export type ExerciseStats = Pick<ExerciseRecord, 'answered' | 'correct' | 'firstTry'>;

/** Grava a sessão do treino (pelo mesmo id) sempre que os números mudam. */
export function exerciseSaver(kind: ExerciseKind, mode: string): (s: ExerciseStats) => void {
  const base = { id: newId(), kind, mode, startedAt: Date.now() };
  return (s) => {
    if (!s.answered) return;
    appHistory()
      .saveExercise({ ...base, ...s, durationMs: Date.now() - base.startedAt })
      .catch((err: unknown) => console.warn('Não consegui salvar o treino:', err));
  };
}
