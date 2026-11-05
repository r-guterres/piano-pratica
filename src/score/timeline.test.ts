// @vitest-environment jsdom
// Integração: OSMD real (no jsdom) carregando os arquivos da biblioteca.

import { readFileSync } from 'node:fs';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { describe, expect, it } from 'vitest';
import { buildSteps } from './steps';
import { extractMeasures, extractTimeline } from './timeline';

async function loadSheet(xml: string) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const osmd = new OpenSheetMusicDisplay(div, { autoResize: false });
  await osmd.load(xml);
  return osmd.Sheet;
}

const loadTimeline = async (id: string) =>
  extractTimeline(await loadSheet(readFileSync(`public/scores/${id}.musicxml`, 'utf8')));

// 2/4 a 90 bpm: Dó ligado (semínima + semínima), Ré com ritornelo, Mi
const note = (step: string, dur: number, type: string, tie = '') =>
  `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>${dur}</duration><type>${type}</type>` +
  (tie ? `<tie type="${tie}"/><notations><tied type="${tie}"/></notations>` : '') +
  '</note>';
const REPEAT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
<part id="P1">
<measure number="1"><attributes><divisions>1</divisions><time><beats>2</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>90</per-minute></metronome></direction-type><sound tempo="90"/></direction>
${note('C', 1, 'quarter', 'start')}${note('C', 1, 'quarter', 'stop')}</measure>
<measure number="2">${note('D', 2, 'half')}<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline></measure>
<measure number="3">${note('E', 2, 'half')}</measure>
</part></score-partwise>`;

const index = JSON.parse(readFileSync('public/scores/index.json', 'utf8')) as { id: string }[];

describe('extractTimeline (OSMD)', () => {
  it('reads a single-staff treble exercise as right hand, middle C = 60', async () => {
    const tl = await loadTimeline('do-md-01');
    expect(tl[0]!.notes).toEqual([
      { pitch: 60, hand: 'right', staff: 0, tieContinuation: false, grace: false, duration: 0.25 },
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

  it('follows repeats in performance time and keeps tied durations', async () => {
    const sheet = await loadSheet(REPEAT_XML);
    const tl = extractTimeline(sheet);
    expect(tl.map((p) => p.measure)).toEqual([0, 0, 1, 0, 0, 1, 2]);
    expect(tl.map((p) => p.time)).toEqual([0, 0.25, 0.5, 0, 0.25, 0.5, 1]);
    expect(tl.map((p) => p.perfTime)).toEqual([0, 0.25, 0.5, 1, 1.25, 1.5, 2]);
    expect(tl[0]!.notes[0]).toMatchObject({ pitch: 60, duration: 0.5, tieContinuation: false });
    expect(tl[1]!.notes[0]).toMatchObject({ tieContinuation: true });
    expect(extractMeasures(sheet)[0]).toEqual({
      index: 0,
      start: 0,
      duration: 0.5,
      beats: 2,
      beatType: 4,
      tempo: 90,
    });
  });

  it('reads the meter and no tempo when the score has none', async () => {
    const sheet = await loadSheet(readFileSync('public/scores/minueto-sol.musicxml', 'utf8'));
    expect(extractMeasures(sheet)[1]).toMatchObject({ beats: 3, beatType: 4, tempo: null });
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
