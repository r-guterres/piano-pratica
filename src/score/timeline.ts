// Adaptador OSMD → linha do tempo. Percorre a partitura carregada exatamente
// como o cursor do OSMD faz (`moveToNextVisibleVoiceEntry(false)`), de modo que
// a posição k da linha do tempo é a posição do cursor após k chamadas a next().

import type { MusicSheet } from 'opensheetmusicdisplay';
import type { Hand, MeasureInfo, TimelineNote, TimelinePosition } from './types';

// No OSMD, halfTone 48 = Dó4; em MIDI, Dó4 = 60.
const HALFTONE_TO_MIDI = 12;
const CLEF_F = 1; // ClefEnum.F
// ArticulationEnum → fração da nota que soa (o resto é silêncio)
const GATES: Record<number, number> = {
  6: 0.5, // staccato
  7: 0.25, // staccatissimo
  8: 0.5, // spiccato
  25: 0.75, // detachedlegato (portato)
};

/** Mão de cada pauta: em instrumento de 2+ pautas, a de cima é MD; pauta única segue a clave. */
export function staffHands(sheet: MusicSheet): Map<number, Hand> {
  const hands = new Map<number, Hand>();
  const firstMeasure = sheet.SourceMeasures[0];
  for (const instrument of sheet.Instruments) {
    const staves = instrument.Staves;
    if (staves.length >= 2) {
      staves.forEach((s, i) => hands.set(s.idInMusicSheet, i === 0 ? 'right' : 'left'));
      continue;
    }
    for (const s of staves) {
      const entry = firstMeasure?.FirstInstructionsStaffEntries[s.idInMusicSheet];
      const clef = entry?.Instructions.find((i) => 'ClefType' in i) as
        { ClefType: number } | undefined;
      hands.set(s.idInMusicSheet, clef?.ClefType === CLEF_F ? 'left' : 'right');
    }
  }
  return hands;
}

export function extractTimeline(sheet: MusicSheet): TimelinePosition[] {
  const hands = staffHands(sheet);
  const iterator = sheet.MusicPartManager.getIterator();
  const timeline: TimelinePosition[] = [];
  while (!iterator.EndReached) {
    const notes: TimelineNote[] = [];
    for (const ve of iterator.CurrentVoiceEntries) {
      const gates = ve.Articulations.map((a) => GATES[a.articulationEnum] ?? 1);
      const gate = Math.min(1, ...gates);
      for (const note of ve.Notes) {
        if (note.isRest() || !note.PrintObject) continue;
        const staff = note.ParentStaff.idInMusicSheet;
        const tie = note.NoteTie;
        notes.push({
          // a articulação vale para o acorde todo; numa nota ligada, não encurta
          ...(gate < 1 && !tie ? { gate } : {}),
          pitch: note.halfTone + HALFTONE_TO_MIDI,
          hand: hands.get(staff) ?? 'right',
          staff,
          tieContinuation: tie !== undefined && tie.StartNote !== note,
          grace: note.IsGraceNote || ve.IsGrace,
          duration: tie && tie.StartNote === note ? tie.Duration.RealValue : note.Length.RealValue,
        });
      }
    }
    timeline.push({
      index: timeline.length,
      measure: iterator.CurrentMeasureIndex,
      time: iterator.CurrentSourceTimestamp.RealValue,
      perfTime: iterator.CurrentEnrolledTimestamp.RealValue,
      notes,
    });
    iterator.moveToNextVisibleVoiceEntry(false);
  }
  return timeline;
}

/** Compassos com fórmula e andamento (o andamento só se a partitura indicar algum). */
export function extractMeasures(sheet: MusicSheet): MeasureInfo[] {
  const hasTempo = sheet.HasBPMInfo;
  return sheet.SourceMeasures.map((m, index) => ({
    index,
    start: m.AbsoluteTimestamp.RealValue,
    duration: m.Duration.RealValue,
    beats: m.ActiveTimeSignature?.Numerator ?? 4,
    beatType: m.ActiveTimeSignature?.Denominator ?? 4,
    tempo: hasTempo && m.TempoInBPM > 0 ? m.TempoInBPM : null,
  }));
}
