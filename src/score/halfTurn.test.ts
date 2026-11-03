import { describe, expect, it } from 'vitest';
import { planHalfTurn, type SystemBox } from './halfTurn';

// Caixas reais medidas no Edge com o "Estudo de leitura (32 compassos)".
const boxes = (...pairs: [number, number][]): SystemBox[] =>
  pairs.map(([top, bottom]) => ({ top, bottom }));

// retrato 800×1147, zoom 1: página 1 (com título) e página 2
const P0_ZOOM1 = boxes([150, 302], [340, 492], [526, 689], [723, 881], [920, 1083]);
const P1_ZOOM1 = boxes([50, 213]);
// retrato, zoom 1,8: páginas sem título, com 2 sistemas e espaço vazio embaixo
const P2_ZOOM18 = boxes([91, 374], [445, 719]);
const P3_ZOOM18 = boxes([91, 383], [445, 728]);
// paisagem 1280×714, zoom 1,2
const P0_LAND = boxes([180, 362], [413, 595]);
const P1_LAND = boxes([60, 249], [297, 491]);

/** topo do cursor quando ele está no sistema i (fica abaixo da borda do sistema) */
const inSystem = (page: SystemBox[], i: number) => page[i]!.top + 25;

describe('planHalfTurn', () => {
  it('waits while the cursor is in the upper half', () => {
    expect(planHalfTurn(P0_ZOOM1, P1_ZOOM1, inSystem(P0_ZOOM1, 0))).toBeNull();
    expect(planHalfTurn(P0_ZOOM1, P1_ZOOM1, inSystem(P0_ZOOM1, 2))).toBeNull();
  });

  it('covers the upper half with the start of the next page', () => {
    expect(planHalfTurn(P0_ZOOM1, P1_ZOOM1, inSystem(P0_ZOOM1, 3))).toEqual({
      coverHeight: 719,
      clipHeight: 217,
    });
  });

  it('keeps the half turn on the last system of the page', () => {
    expect(planHalfTurn(P0_ZOOM1, P1_ZOOM1, inSystem(P0_ZOOM1, 4))).not.toBeNull();
  });

  // Regressão (bug relatado no tablet): da 2ª virada em diante, páginas sem
  // título têm os sistemas no alto e a meia-virada não disparava.
  it('works on pages whose systems do not reach the lower half of the page', () => {
    expect(planHalfTurn(P2_ZOOM18, P3_ZOOM18, inSystem(P2_ZOOM18, 0))).toBeNull();
    expect(planHalfTurn(P2_ZOOM18, P3_ZOOM18, inSystem(P2_ZOOM18, 1))).toEqual({
      coverHeight: 441,
      clipHeight: 387,
    });
  });

  it('works in landscape on the title page', () => {
    expect(planHalfTurn(P0_LAND, P1_LAND, inSystem(P0_LAND, 1))).toEqual({
      coverHeight: 409,
      clipHeight: 253,
    });
  });

  it('does nothing on a page with a single system', () => {
    expect(planHalfTurn(P1_ZOOM1, P0_ZOOM1, inSystem(P1_ZOOM1, 0))).toBeNull();
  });

  it('does nothing when no system of the next page fits', () => {
    const tall = boxes([10, 600]);
    expect(planHalfTurn(P2_ZOOM18, tall, inSystem(P2_ZOOM18, 1))).toBeNull();
  });

  it('does nothing without a next page', () => {
    expect(planHalfTurn(P2_ZOOM18, [], inSystem(P2_ZOOM18, 1))).toBeNull();
  });
});
