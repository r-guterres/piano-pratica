import { describe, expect, it } from 'vitest';
import { EchoFilter } from './echo';

describe('EchoFilter', () => {
  it('drops a note-on that comes back right after being sent, and its note-off', () => {
    const f = new EchoFilter(80);
    f.sent(60, 1000);
    expect(f.isEchoOn(60, 1020)).toBe(true);
    expect(f.isEchoOff(60)).toBe(true);
    // consumido: a mesma tecla tocada de verdade logo depois passa
    expect(f.isEchoOn(60, 1030)).toBe(false);
    expect(f.isEchoOff(60)).toBe(false);
  });

  it('lets through other keys and the same key outside the window', () => {
    const f = new EchoFilter(80);
    f.sent(60, 1000);
    expect(f.isEchoOn(62, 1010)).toBe(false);
    expect(f.isEchoOn(60, 900)).toBe(false);
    expect(f.isEchoOn(60, 1200)).toBe(false);
  });
});
