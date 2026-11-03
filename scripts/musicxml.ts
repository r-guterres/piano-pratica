// Mini-notação → MusicXML (partwise), usada só para gerar a biblioteca inicial.
//
// Cada compasso é uma string por pauta, com tokens separados por espaço:
//   nota    "c4", "f#5", "bb3"   (letra + acidente opcional # ou b + oitava, Dó central = c4)
//   acorde  "[c4 e4 g4]"
//   pausa   "r"
//   duração "/w" "/h" "/q" "/e" "/s" (+ "." pontuada); se omitida, repete a anterior
//   ligadura "~" logo após a nota (dentro ou fora do acorde) liga à próxima nota igual na pauta
// Exemplo: "d5/q g4/e a4 b4 c5"

export interface PieceSpec {
  id: string;
  title: string;
  composer: string;
  level: number;
  tags: string[];
  source: string;
  /** Armadura em número de quintas (1 = Sol maior, -1 = Fá maior). */
  fifths: number;
  time: [beats: number, beatType: number];
  clefs: ('G' | 'F')[];
  /** measures[i][staff] */
  measures: string[][];
}

const DIVISIONS = 4; // divisões por semínima
const DURATIONS: Record<string, { div: number; type: string }> = {
  w: { div: 16, type: 'whole' },
  h: { div: 8, type: 'half' },
  q: { div: 4, type: 'quarter' },
  e: { div: 2, type: 'eighth' },
  s: { div: 1, type: '16th' },
};

interface ParsedNote {
  step: string;
  alter: number;
  octave: number;
  tieStart: boolean;
}

interface ParsedEvent {
  notes: ParsedNote[]; // vazio = pausa
  div: number;
  type: string;
  dotted: boolean;
}

const TOKEN = /\[[^\]]*\](?:\/[whqes]\.?)?|\S+/g;
const NOTE = /^([a-g])([#b]?)(-?\d)(~?)$/;

function parseNote(text: string, where: string): ParsedNote {
  const m = NOTE.exec(text);
  if (!m) throw new Error(`${where}: nota inválida "${text}"`);
  return {
    step: m[1]!.toUpperCase(),
    alter: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0,
    octave: Number(m[3]),
    tieStart: m[4] === '~',
  };
}

export function parseStaff(text: string, where: string, start = 'q'): ParsedEvent[] {
  let current = start;
  const events: ParsedEvent[] = [];
  for (const token of text.match(TOKEN) ?? []) {
    let [body, dur] = token.startsWith('[')
      ? [token.slice(1, token.indexOf(']')), token.slice(token.indexOf(']') + 1).replace('/', '')]
      : (token.split('/') as [string, string?]);
    if (dur?.endsWith('~') && !token.startsWith('[')) {
      // aceita também "g4/h~" como sinônimo de "g4~/h"
      body += '~';
      dur = dur.slice(0, -1);
    }
    if (dur) current = dur;
    const base = DURATIONS[current.replace('.', '')];
    if (!base) throw new Error(`${where}: duração inválida "${current}"`);
    const dotted = current.endsWith('.');
    const notes =
      body === 'r'
        ? []
        : body
            .trim()
            .split(/\s+/)
            .map((n) => parseNote(n, where));
    events.push({ notes, div: dotted ? base.div * 1.5 : base.div, type: base.type, dotted });
  }
  return events;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function toMusicXml(spec: PieceSpec): string {
  const [beats, beatType] = spec.time;
  const measureDiv = (beats * DIVISIONS * 4) / beatType;
  const staves = spec.clefs.length;
  // ligaduras abertas por pauta: "C4" → true
  const openTies = spec.clefs.map(() => new Set<string>());

  const measuresXml = spec.measures.map((staffTexts, mi) => {
    if (staffTexts.length !== staves) {
      throw new Error(`${spec.id} c.${mi + 1}: esperava ${staves} pauta(s)`);
    }
    const parts: string[] = [];
    if (mi === 0) {
      parts.push(
        `<attributes><divisions>${DIVISIONS}</divisions>` +
          `<key><fifths>${spec.fifths}</fifths></key>` +
          `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
          (staves > 1 ? `<staves>${staves}</staves>` : '') +
          spec.clefs
            .map(
              (c, i) =>
                `<clef number="${i + 1}"><sign>${c}</sign><line>${c === 'G' ? 2 : 4}</line></clef>`,
            )
            .join('') +
          `</attributes>`,
      );
    }
    staffTexts.forEach((text, si) => {
      const where = `${spec.id} c.${mi + 1} pauta ${si + 1}`;
      const events = parseStaff(text, where);
      const total = events.reduce((sum, e) => sum + e.div, 0);
      if (total !== measureDiv) {
        throw new Error(`${where}: duração ${total} ≠ ${measureDiv} divisões`);
      }
      if (si > 0) parts.push(`<backup><duration>${measureDiv}</duration></backup>`);
      const voice = si * 4 + 1;
      for (const ev of events) {
        const common =
          `<duration>${ev.div}</duration><voice>${voice}</voice><type>${ev.type}</type>` +
          (ev.dotted ? '<dot/>' : '');
        const staffTag = staves > 1 ? `<staff>${si + 1}</staff>` : '';
        if (ev.notes.length === 0) {
          parts.push(`<note><rest/>${common}${staffTag}</note>`);
          continue;
        }
        ev.notes.forEach((n, ni) => {
          const key = `${n.step}${n.alter}${n.octave}`;
          const tieStop = openTies[si]!.has(key);
          if (tieStop) openTies[si]!.delete(key);
          if (n.tieStart) openTies[si]!.add(key);
          const ties =
            (tieStop ? '<tie type="stop"/>' : '') + (n.tieStart ? '<tie type="start"/>' : '');
          const tieds =
            (tieStop ? '<tied type="stop"/>' : '') + (n.tieStart ? '<tied type="start"/>' : '');
          parts.push(
            `<note>${ni > 0 ? '<chord/>' : ''}` +
              `<pitch><step>${n.step}</step>${n.alter ? `<alter>${n.alter}</alter>` : ''}<octave>${n.octave}</octave></pitch>` +
              `<duration>${ev.div}</duration>${ties}<voice>${voice}</voice><type>${ev.type}</type>` +
              (ev.dotted ? '<dot/>' : '') +
              staffTag +
              (tieds ? `<notations>${tieds}</notations>` : '') +
              `</note>`,
          );
        });
      }
    });
    if (mi === spec.measures.length - 1) {
      parts.push('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
    }
    return `<measure number="${mi + 1}">${parts.join('')}</measure>`;
  });

  for (const [si, ties] of openTies.entries()) {
    if (ties.size) throw new Error(`${spec.id}: ligadura sem fim na pauta ${si + 1}`);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    `<work><work-title>${esc(spec.title)}</work-title></work>`,
    `<identification><creator type="composer">${esc(spec.composer)}</creator>` +
      `<encoding><software>piano-pratica scripts/gen-scores.ts</software></encoding></identification>`,
    '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>',
    '<part id="P1">',
    ...measuresXml,
    '</part>',
    '</score-partwise>',
    '',
  ].join('\n');
}
