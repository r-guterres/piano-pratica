// Ciclo de uma sessão de treino (acordes, ouvido, ler e tocar): configurar →
// ▶ Começar → treino com cronômetro → ■ Encerrar → resumo. Se o treino foi
// aberto por um bloco do Hoje, a meta é a duração do bloco.

import { nav, type DrillGoal, type Training } from '../nav.svelte';
import { showToast } from '../toast.svelte';

export class DrillSession {
  phase = $state<'setup' | 'running' | 'summary'>('setup');
  elapsedMs = $state(0);
  readonly goal: DrillGoal | null;
  #t0 = 0;
  #timer: ReturnType<typeof setInterval> | undefined;
  #notified = false;

  constructor(training: Training) {
    this.goal = nav.goal?.training === training ? nav.goal : null;
  }

  get goalMs(): number {
    return this.goal ? this.goal.minutes * 60_000 : 0;
  }

  get reached(): boolean {
    return this.goalMs > 0 && this.elapsedMs >= this.goalMs;
  }

  start(): void {
    clearInterval(this.#timer);
    this.#t0 = performance.now();
    this.elapsedMs = 0;
    this.phase = 'running';
    this.#timer = setInterval(() => {
      this.elapsedMs = performance.now() - this.#t0;
      if (this.reached && !this.#notified) {
        this.#notified = true;
        showToast(
          `${this.goal!.minutes} min: a meta do bloco foi cumprida. Encerre quando quiser.`,
        );
      }
    }, 500);
  }

  finish(): void {
    if (this.phase !== 'running') return;
    clearInterval(this.#timer);
    this.elapsedMs = performance.now() - this.#t0;
    this.phase = 'summary';
  }

  setup(): void {
    this.phase = 'setup';
  }

  dispose(): void {
    clearInterval(this.#timer);
  }
}

/** 75 000 → "1:15" */
export function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
