import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from './settings.svelte';

describe('mergeSettings', () => {
  it('returns defaults when nothing was saved', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps saved fields and fills new ones with defaults', () => {
    const s = mergeSettings({ naming: { style: 'letters' }, input: { virtualKeyboard: true } });
    expect(s.naming).toEqual({ ...DEFAULT_SETTINGS.naming, style: 'letters' });
    expect(s.input.virtualKeyboard).toBe(true);
    expect(s.input.computerKeyboard).toBe(DEFAULT_SETTINGS.input.computerKeyboard);
    expect(s.score).toEqual(DEFAULT_SETTINGS.score);
  });

  it('migrates the old single zoom number to both orientations', () => {
    expect(mergeSettings({ score: { zoom: 1.4 } }).score.zoom).toEqual({
      portrait: 1.4,
      landscape: 1.4,
    });
  });

  it('merges a partial per-orientation zoom', () => {
    expect(mergeSettings({ score: { zoom: { landscape: 1.6 } } }).score.zoom).toEqual({
      portrait: DEFAULT_SETTINGS.score.zoom.portrait,
      landscape: 1.6,
    });
  });
});
