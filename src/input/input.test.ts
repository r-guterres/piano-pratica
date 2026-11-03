import { describe, expect, it } from 'vitest';
import type { InputEvent } from '../core/events';
import { ComputerKeyboardMapper } from './computerKeyboard';
import { HeldNotes, InputHub, type InputSourceId } from './hub';

describe('ComputerKeyboardMapper', () => {
  it('maps the home row to white keys starting at middle C', () => {
    const m = new ComputerKeyboardMapper();
    const pitches = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK'].map(
      (code) => m.keyDown(code, 0)?.pitch,
    );
    expect(pitches).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('maps the upper row to black keys', () => {
    const m = new ComputerKeyboardMapper();
    const pitches = ['KeyW', 'KeyE', 'KeyT', 'KeyY', 'KeyU'].map((c) => m.keyDown(c, 0)?.pitch);
    expect(pitches).toEqual([61, 63, 66, 68, 70]);
  });

  it('emits note-on then note-off with the same pitch', () => {
    const m = new ComputerKeyboardMapper();
    expect(m.keyDown('KeyA', 10)).toEqual({ type: 'on', pitch: 60, velocity: 80, t: 10 });
    expect(m.keyUp('KeyA', 20)).toEqual({ type: 'off', pitch: 60, velocity: 0, t: 20 });
  });

  it('ignores auto-repeat and unknown keys', () => {
    const m = new ComputerKeyboardMapper();
    expect(m.keyDown('KeyA', 0)).not.toBeNull();
    expect(m.keyDown('KeyA', 5, true)).toBeNull();
    expect(m.keyDown('KeyA', 6)).toBeNull(); // ainda presa
    expect(m.keyDown('KeyQ', 0)).toBeNull();
    expect(m.keyUp('KeyQ', 0)).toBeNull();
  });

  it('shifts octaves with Z/X, within limits', () => {
    const m = new ComputerKeyboardMapper();
    m.keyDown('KeyZ', 0);
    expect(m.keyDown('KeyA', 0)?.pitch).toBe(48);
    for (let i = 0; i < 10; i++) m.keyDown('KeyX', 0);
    expect(m.base).toBe(96);
  });

  it('releases the original pitch after an octave change while held', () => {
    const m = new ComputerKeyboardMapper();
    m.keyDown('KeyA', 0);
    m.keyDown('KeyX', 0);
    expect(m.keyUp('KeyA', 1)?.pitch).toBe(60);
  });

  it('releases all held keys', () => {
    const m = new ComputerKeyboardMapper();
    m.keyDown('KeyA', 0);
    m.keyDown('KeyD', 0);
    expect(m.releaseAll(5).map((e) => e.pitch)).toEqual([60, 64]);
    expect(m.releaseAll(6)).toEqual([]);
  });
});

describe('InputHub', () => {
  it('delivers events with their source and supports unsubscribe', () => {
    const hub = new InputHub();
    const got: [InputEvent, InputSourceId][] = [];
    const off = hub.subscribe((e, s) => got.push([e, s]));
    hub.emit({ type: 'on', pitch: 60, velocity: 90, t: 0 }, 'midi');
    off();
    hub.emit({ type: 'off', pitch: 60, velocity: 0, t: 1 }, 'midi');
    expect(got).toEqual([[{ type: 'on', pitch: 60, velocity: 90, t: 0 }, 'midi']]);
  });
});

describe('HeldNotes', () => {
  it('tracks the union of held keys across sources', () => {
    const h = new HeldNotes();
    h.apply({ type: 'on', pitch: 60, velocity: 1, t: 0 }, 'midi');
    h.apply({ type: 'on', pitch: 60, velocity: 1, t: 0 }, 'virtual');
    h.apply({ type: 'on', pitch: 64, velocity: 1, t: 0 }, 'computer');
    h.apply({ type: 'off', pitch: 60, velocity: 0, t: 1 }, 'midi');
    expect([...h.pitches()].sort()).toEqual([60, 64]); // ainda presa no teclado virtual
    h.apply({ type: 'pedal', value: 127, down: true, t: 2 }, 'midi');
    h.clear('virtual');
    expect([...h.pitches()]).toEqual([64]);
  });
});
