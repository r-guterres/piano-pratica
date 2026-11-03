// Decisão da meia-virada de página. Puro: recebe as caixas verticais dos
// sistemas (px, relativas à própria página) e a posição do cursor.

export interface SystemBox {
  top: number;
  bottom: number;
}

export interface HalfTurnPlan {
  /** Altura (px, a partir do topo) da faixa da página atual coberta pela próxima. */
  coverHeight: number;
  /** Quanto da página seguinte mostrar dentro dessa faixa (só sistemas inteiros). */
  clipHeight: number;
}

const GAP = 4;

/**
 * A "metade de baixo" é medida pelo conteúdo da página (do topo do primeiro
 * sistema à base do último), e não pela altura da página: o OSMD agrupa os
 * sistemas no alto e pode deixar a parte de baixo vazia (paisagem, zoom grande),
 * e aí nenhum sistema começaria abaixo da metade da página.
 *
 * Retorna null se não houver meia-virada: o cursor ainda está na metade de
 * cima, a página tem um único sistema ou nenhum sistema da seguinte cabe.
 */
export function planHalfTurn(
  current: readonly SystemBox[],
  next: readonly SystemBox[],
  cursorTop: number,
): HalfTurnPlan | null {
  if (current.length < 2 || next.length === 0) return null;
  const middle = (current[0]!.top + current[current.length - 1]!.bottom) / 2;
  const firstLower = current.find((s, i) => i > 0 && s.top >= middle);
  if (!firstLower || cursorTop < firstLower.top - 1) return null;

  const coverHeight = Math.max(0, firstLower.top - GAP);
  const fitting = next.filter((s) => s.bottom <= coverHeight);
  if (fitting.length === 0) return null;
  return { coverHeight, clipHeight: fitting[fitting.length - 1]!.bottom + GAP };
}
