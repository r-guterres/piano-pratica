// @vitest-environment jsdom
// (o módulo lê o localStorage ao ser importado)
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

  it('fills the reading drill settings, including a partial range', () => {
    const s = mergeSettings({ drill: { clefs: 'bass', range: { bass: { low: 10 } } } });
    expect(s.drill.clefs).toBe('bass');
    expect(s.drill.range.bass).toEqual({ ...DEFAULT_SETTINGS.drill.range.bass, low: 10 });
    expect(s.drill.range.treble).toEqual(DEFAULT_SETTINGS.drill.range.treble);
    expect(s.drill.minutes).toBe(DEFAULT_SETTINGS.drill.minutes);
  });
});
