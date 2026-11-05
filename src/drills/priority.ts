// Priorização do treino de leitura (§6): sorteia com peso maior as notas com
// muitos erros ou reação lenta, sem deixar de variar. Puro.
//
// Para cada item guardamos contagens "com esquecimento": a cada vez que ele é
// respondido, as contagens antigas são multiplicadas por DECAY (0,85), então o
// peso reflete aproximadamente as últimas 1/(1−0,85) ≈ 7 respostas daquele item.
//
//   taxa de erro  p = (erros + 1) / (tentativas + 4)      (item novo: p = 0,25)
//   tempo         T = (k·tempo médio do item + 2·mediana) / (k + 2), k = acertos cronometrados
//   lentidão      s = T / mediana dos tempos − 1, limitada a [0, 2]
//   peso          w = 0,05 + p·(1 + 0,5·s)
//
// A lentidão multiplica a taxa de erro (em vez de somar), para que uma nota
// lenta mas sempre certa nunca passe à frente das que são erradas; e o tempo é
// puxado para a mediana enquanto há poucas medições, para que uma hesitação
// isolada não marque a nota como lenta.
//
// e o item é sorteado com probabilidade proporcional a w, excluindo os últimos
// mostrados (nunca repete o anterior; com 4+ itens, nem os dois últimos).

export interface ItemStats {
  /** Tentativas com esquecimento. */
  attempts: number;
  /** Erros (respostas que não saíram de primeira), com esquecimento. */
  errors: number;
  /** Média móvel do tempo de reação nos acertos de primeira (ms). */
  meanMs: number | null;
  /** Acertos de primeira cronometrados (contagem simples). */
  timed: number;
  /** Vezes que o item foi respondido (contagem simples, sem esquecimento). */
  seen: number;
}

export const DECAY = 0.85;
const PRIOR_ERRORS = 1;
const PRIOR_ATTEMPTS = 4;
const FLOOR = 0.05;
const SLOW_WEIGHT = 0.5;
const TIME_SMOOTHING = 0.3;
/** Peso da mediana no tempo de um item, em "medições fictícias". */
const PRIOR_TIMED = 2;

export type Rng = () => number;

export class Prioritizer {
  readonly stats = new Map<string, ItemStats>();

  /** Registra a resposta a um item. `reactionMs` só nos acertos de primeira. */
  record(id: string, firstTry: boolean, reactionMs: number | null): void {
    const s = this.stats.get(id) ?? { attempts: 0, errors: 0, meanMs: null, timed: 0, seen: 0 };
    s.attempts = s.attempts * DECAY + 1;
    s.errors = s.errors * DECAY + (firstTry ? 0 : 1);
    s.seen++;
    if (firstTry && reactionMs !== null) {
      s.meanMs =
        s.meanMs === null ? reactionMs : s.meanMs + TIME_SMOOTHING * (reactionMs - s.meanMs);
      s.timed++;
    }
    this.stats.set(id, s);
  }

  errorRate(id: string): number {
    const s = this.stats.get(id);
    return ((s?.errors ?? 0) + PRIOR_ERRORS) / ((s?.attempts ?? 0) + PRIOR_ATTEMPTS);
  }

  /** Mediana dos tempos médios dos itens já respondidos (null se não há nenhum). */
  medianMs(): number | null {
    const times = [...this.stats.values()]
      .map((s) => s.meanMs)
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b);
    if (!times.length) return null;
    const mid = times.length >> 1;
    return times.length % 2 ? times[mid]! : (times[mid - 1]! + times[mid]!) / 2;
  }

  /** Lentidão s ∈ [0, 2] (0 se o item ainda não tem tempo medido). */
  slowness(id: string, median = this.medianMs()): number {
    const s = this.stats.get(id);
    if (!s || s.meanMs === null || median === null || median <= 0) return 0;
    const time = (s.timed * s.meanMs + PRIOR_TIMED * median) / (s.timed + PRIOR_TIMED);
    return Math.min(2, Math.max(0, time / median - 1));
  }

  weight(id: string, median = this.medianMs()): number {
    return FLOOR + this.errorRate(id) * (1 + SLOW_WEIGHT * this.slowness(id, median));
  }

  /** Sorteia o próximo item. `recent`: ids mostrados por último (o mais recente no fim). */
  pick<T extends { id: string }>(pool: readonly T[], recent: readonly string[], rng: Rng): T {
    if (!pool.length) throw new Error('pool vazio');
    const n = pool.length >= 4 ? 2 : pool.length > 1 ? 1 : 0;
    const avoid = new Set(n ? recent.slice(-n) : []);
    const candidates = pool.filter((item) => !avoid.has(item.id));
    const median = this.medianMs();
    const weights = candidates.map((item) => this.weight(item.id, median));
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i]!;
      if (r < 0) return candidates[i]!;
    }
    return candidates.at(-1)!;
  }
}
