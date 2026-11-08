import type { MidiPitch } from '../core/events';

export type Hand = 'right' | 'left';
export type HandSelection = Hand | 'both';

/** Uma nota sob o cursor numa posição da partitura. */
export interface TimelineNote {
  pitch: MidiPitch;
  hand: Hand;
  /** Índice da pauta na partitura inteira (0 = mais alta). */
  staff: number;
  /** Continuação de ligadura (tie): a nota já soa, não é nova exigência. */
  tieContinuation: boolean;
  grace: boolean;
  /** Quanto a nota soa, em semibreves (no início de uma ligadura, a soma das notas ligadas). */
  duration: number;
  /** Fração da duração que soa na reprodução (staccato 0,5; staccatissimo 0,25); ausente = toda. */
  gate?: number;
}

/**
 * Uma parada do cursor do OSMD. `index` é a quantidade de `cursor.next()` a
 * partir do início — é a chave que liga passos à posição visual do cursor.
 */
export interface TimelinePosition {
  index: number;
  /** Índice do compasso (0 = primeiro). */
  measure: number;
  /** Instante em semibreves desde o início (1 = uma semibreve), na partitura escrita. */
  time: number;
  /** Instante na execução, em semibreves: igual a `time`, mas segue os ritornelos (só cresce). */
  perfTime: number;
  notes: TimelineNote[];
}

/** Um compasso da partitura escrita. */
export interface MeasureInfo {
  index: number;
  /** Início, em semibreves (na partitura escrita). */
  start: number;
  /** Duração real (menor que a fórmula num compasso de anacruse). */
  duration: number;
  /** Fórmula de compasso: 3/4 → beats 3, beatType 4. */
  beats: number;
  beatType: number;
  /** Andamento escrito em semínimas por minuto (null se a partitura não indica). */
  tempo: number | null;
}
