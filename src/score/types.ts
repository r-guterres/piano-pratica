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
}

/**
 * Uma parada do cursor do OSMD. `index` é a quantidade de `cursor.next()` a
 * partir do início — é a chave que liga passos à posição visual do cursor.
 */
export interface TimelinePosition {
  index: number;
  /** Índice do compasso (0 = primeiro). */
  measure: number;
  /** Instante em semibreves desde o início (1 = uma semibreve). */
  time: number;
  notes: TimelineNote[];
}
