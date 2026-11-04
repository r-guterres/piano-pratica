// @vitest-environment jsdom
// Integração: "tocar" cada partitura da biblioteca inteira no modo espera,
// com o OSMD real extraindo os passos.

import { readFileSync } from 'node:fs';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { describe, expect, it } from 'vitest';
import { buildSteps } from '../score/steps';
import { extractTimeline } from '../score/timeline';
import type { HandSelection } from '../score/types';
import { WaitMode } from './waitMode';

const index = JSON.parse(readFileSync('public/scores/index.json', 'utf8')) as { id: string }[];

async function timelineOf(id: string) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const osmd = new OpenSheetMusicDisplay(div, { autoResize: false });
  await osmd.load(readFileSync(`public/scores/${id}.musicxml`, 'utf8'));
  return extractTimeline(osmd.Sheet);
}

describe('playing whole library pieces in wait mode', () => {
  for (const hands of ['both', 'right', 'left'] as HandSelection[]) {
    it(`completes every piece without errors when playing exactly the steps (${hands})`, async () => {
      for (const { id } of index) {
        const steps = buildSteps(await timelineOf(id), hands);
        const mode = new WaitMode(steps);
        let t = 0;
        // acordes tocados de cima para baixo, de propósito fora de ordem
        for (const step of steps) {
          for (const pitch of [...step.pitches].reverse()) {
            mode.handle({ type: 'on', pitch, velocity: 80, t: (t += 50) });
            mode.handle({ type: 'off', pitch, velocity: 0, t: (t += 10) });
          }
        }
        const s = mode.summary();
        expect(mode.finished || steps.length === 0, id).toBe(true);
        expect(s.completed, id).toBe(steps.length);
        expect(s.wrongNotes, id).toBe(0);
      }
    });
  }

  // Bug do tablet (M2): na MD, o acorde da ME no c.1 do Minueto, tocado junto mas
  // chegando uns ms depois da nota da MD, contava como erro no passo seguinte.
  for (const hands of ['right', 'left'] as const) {
    it(`tolerates the other hand arriving slightly late (${hands} hand)`, async () => {
      for (const { id } of index) {
        const timeline = await timelineOf(id);
        const mode = new WaitMode(buildSteps(timeline, hands));
        let t = 0;
        const press = (pitch: number) =>
          mode.handle({ type: 'on', pitch, velocity: 80, t: (t += 15) });
        for (const pos of timeline) {
          const struck = pos.notes.filter((n) => !n.tieContinuation && !n.grace);
          struck.filter((n) => n.hand === hands).forEach((n) => press(n.pitch));
          struck.filter((n) => n.hand !== hands).forEach((n) => press(n.pitch));
        }
        expect(mode.summary().wrongNotes, id).toBe(0);
      }
    });
  }

  it('counts errors in the right measure of a real piece', async () => {
    const steps = buildSteps(await timelineOf('do-md-01'), 'both');
    const mode = new WaitMode(steps);
    // c.1: Dó Ré Mi Fá — erra o Ré tocando Ré♯ antes
    mode.handle({ type: 'on', pitch: 60, velocity: 80, t: 0 });
    mode.handle({ type: 'on', pitch: 63, velocity: 80, t: 100 });
    mode.handle({ type: 'on', pitch: 62, velocity: 80, t: 200 });
    expect(mode.summary()).toMatchObject({ completed: 2, clean: 1, errorsByMeasure: { 0: 1 } });
  });
});
