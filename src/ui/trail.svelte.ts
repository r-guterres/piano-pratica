// A Trilha em uso: o estado (carregado do IndexedDB e gravado sozinho depois
// de cada mudança), o dia de hoje e o tempo com o teclado em uso.
//
// As telas alteram `trail.s` com as funções de trail/state.ts e chamam
// saveTrail(). O tempo de teclado segue o artefato: a cada 15 s, se houve
// alguma nota nos últimos 15 s, soma 15 s ao dia.

import { inputHub } from '../input/hub';
import { appHistory } from '../storage/history';
import { today, type Day } from '../trail/dates';
import { addMidiSeconds, initialTrail, normalizeTrail, type TrailState } from '../trail/state';

export const trail = $state<{ s: TrailState | null; day: Day; error: string }>({
  s: null,
  day: today(),
  error: '',
});

let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Carrega a Trilha (uma vez); sem estado gravado, começa uma nova hoje. */
export function loadTrail(): Promise<void> {
  loading ??= appHistory()
    .trail()
    .then((saved) => {
      trail.s = saved ? normalizeTrail(saved) : initialTrail(trail.day);
      if (!saved) saveTrail();
    })
    .catch((err: unknown) => {
      trail.error = `Não consegui ler a Trilha: ${String(err)}`;
      trail.s = initialTrail(trail.day);
    });
  return loading;
}

/** Grava logo depois da última mudança (várias mudanças seguidas = uma gravação). */
export function saveTrail(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushTrail, 600);
}

export function flushTrail(): void {
  clearTimeout(saveTimer);
  if (!trail.s) return;
  appHistory()
    .saveTrail($state.snapshot(trail.s) as TrailState)
    .catch((err: unknown) => (trail.error = `Não consegui salvar a Trilha: ${String(err)}`));
}

/** Substitui a Trilha inteira (migração do artefato). */
export function replaceTrail(s: TrailState): void {
  trail.s = normalizeTrail(s);
  flushTrail();
}

const WINDOW_SEC = 15;

/** Liga o relógio do dia e a contagem do tempo de teclado; devolve a função que desliga. */
export function startTrailClock(): () => void {
  let lastInput = -Infinity;
  let pending = 0;
  const unsubscribe = inputHub.subscribe(() => (lastInput = performance.now()));
  const flushTime = () => {
    if (!pending || !trail.s) return;
    addMidiSeconds(trail.s, trail.day, pending);
    pending = 0;
    saveTrail();
  };
  const tick = setInterval(() => {
    trail.day = today();
    if (performance.now() - lastInput < WINDOW_SEC * 1000) pending += WINDOW_SEC;
    if (pending >= 60) flushTime();
  }, WINDOW_SEC * 1000);
  const onHidden = () => {
    if (document.visibilityState === 'hidden') {
      flushTime();
      flushTrail();
    } else trail.day = today();
  };
  document.addEventListener('visibilitychange', onHidden);
  return () => {
    unsubscribe();
    clearInterval(tick);
    document.removeEventListener('visibilitychange', onHidden);
    flushTime();
  };
}
