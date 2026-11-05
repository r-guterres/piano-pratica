import { describe, expect, it } from 'vitest';
import { Recorder } from './recorder';

describe('Recorder', () => {
  it('keeps keys and pedal relative to the start, and closes what is still held', () => {
    const r = new Recorder(1000);
    r.add({ type: 'off', pitch: 50, velocity: 0, t: 1005 }); // apertada antes: ignora
    r.add({ type: 'on', pitch: 60, velocity: 90, t: 1100 });
    r.add({ type: 'pedal', value: 127, down: true, t: 1150 });
    r.add({ type: 'pedal', value: 120, down: true, t: 1160 }); // sem mudança
    r.add({ type: 'on', pitch: 64, velocity: 80, t: 1200 });
    r.add({ type: 'off', pitch: 60, velocity: 0, t: 1500 });
    expect(r.count).toBe(4);
    expect(r.stop(2000)).toEqual({
      durationMs: 1000,
      events: [
        { type: 'on', pitch: 60, velocity: 90, t: 100 },
        { type: 'pedal', value: 127, down: true, t: 150 },
        { type: 'on', pitch: 64, velocity: 80, t: 200 },
        { type: 'off', pitch: 60, velocity: 0, t: 500 },
        { type: 'off', pitch: 64, velocity: 0, t: 1000 },
        { type: 'pedal', value: 0, down: false, t: 1000 },
      ],
    });
  });
});
