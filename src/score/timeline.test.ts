// @vitest-environment jsdom
// Integração: OSMD real (no jsdom) carregando os arquivos da biblioteca.

import { readFileSync } from 'node:fs';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { describe, expect, it } from 'vitest';
import { buildSteps } from './steps';
import { extractTimeline } from './timeline';

async function loadTimeline(id: string) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const osmd = new OpenSheetMusicDisplay(div, { autoResize: false });
  await osmd.load(readFileSync(`public/scores/${id}.musicxml`, 'utf8'));
  return extractTimeline(osmd.Sheet);
}

const index = JSON.parse(readFileSync('public/scores/index.json', 'utf8')) as { id: string }[];

describe('extractTimeline (OSMD)', () => {
  it('reads a single-staff treble exercise as right hand, middle C = 60', async () => {
    const tl = await loadTimeline('do-md-01');
    expect(tl[0]!.notes).toEqual([
      { pitch: 60, hand: 'right', staff: 0, tieContinuation: false, grace: false },
    ]);
    expect(buildSteps(tl, 'both').map((s) => s.pitches[0])).toEqual([
      60, 62, 64, 65, 67, 64, 65, 64, 62, 60, 62, 67, 64, 67, 65, 62, 64, 60, 62, 67, 65, 64, 62,
      60,
    ]);
  });

  it('assigns a single bass-clef staff to the left hand', async () => {
    const tl = await loadTimeline('do-me-01');
    expect(tl[0]!.notes[0]).toMatchObject({ pitch: 48, hand: 'left' });
    expect(buildSteps(tl, 'right')).toEqual([]);
  });

  it('assigns grand-staff upper/lower staves to right/left hands', async () => {
    const tl = await loadTimeline('do-maos-juntas-01');
    const first = tl[0]!.notes.map((n) => [n.pitch, n.hand]);
    expect(first).toEqual([
      [64, 'right'],
      [48, 'left'],
    ]);
  });

  it('handles chords and ties across barlines and between hands', async () => {
    const tl = await loadTimeline('acordes-do-01');
    const both = buildSteps(tl, 'both');
    const right = buildSteps(tl, 'right');

    // c.4, 2º tempo: acorde Dó–Mi–Sol ligado ao c.5
    const tiedStart = both.find((s) => s.measure === 3 && s.position === 7);
    expect(tiedStart?.pitches).toEqual([48, 60, 64, 67]);

    // c.5, 1º tempo: MD só continua a ligadura; com ambas as mãos o passo é só a ME
    const m5 = both.find((s) => s.position === 8);
    expect(m5?.pitches).toEqual([48]);
    // …e com a MD sozinha essa posição é pulada
    expect(right.some((s) => s.position === 8)).toBe(false);

    // c.7: Sol ligado (mínima → semínima); no 3º tempo só a ME toca nota nova
    const m7beat3 = both.find((s) => s.position === 15);
    expect(m7beat3?.pitches).toEqual([47]);
  });

  it('reads accidentals from the key (F♯ in G major)', async () => {
    const tl = await loadTimeline('minueto-sol');
    const pitches = tl.flatMap((p) => p.notes.map((n) => n.pitch));
    expect(pitches).toContain(66); // Fá♯4 (c.7)
    expect(pitches).toContain(78); // Fá♯5 (c.3)
    expect(pitches).not.toContain(65); // nenhum Fá natural
    expect(pitches).not.toContain(77);
  });

  it('loads every file in the library and yields steps', async () => {
    for (const { id } of index) {
      const tl = await loadTimeline(id);
      expect(buildSteps(tl, 'both').length, id).toBeGreaterThan(0);
      expect(
        tl.every((p, i) => p.index === i),
        id,
      ).toBe(true);
    }
  });
});
