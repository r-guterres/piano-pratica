import { describe, expect, it } from 'vitest';
import { MidiSink } from './sinks';

/** Saída MIDI falsa: guarda o que foi enviado. */
function fakeOutput() {
  const sent: [number[], number | undefined][] = [];
  const out = { send: (data: number[], at?: number) => sent.push([[...data], at]) };
  return { out: out as unknown as MIDIOutput, sent };
}

describe('MidiSink', () => {
  it('plays notes on channel 2 with a piano program, and clicks on the drum channel', () => {
    const { out, sent } = fakeOutput();
    const echoes: number[] = [];
    const sink = new MidiSink(out, (p) => echoes.push(p));
    sink.noteOn(1000, 60, 70);
    sink.noteOff(1500, 60);
    sink.click(2000, true);
    sink.pedal(2100, true);
    expect(sent).toEqual([
      [[0xc1, 0], undefined],
      [[0x91, 60, 70], 1000],
      [[0x81, 60, 0], 1500],
      [[0x99, 76, 120], 2000],
      [[0x89, 76, 0], 2060],
      [[0xb1, 64, 127], 2100],
    ]);
    expect(echoes).toEqual([60]);
  });

  it('releases notes that were already scheduled when stopped', () => {
    const { out, sent } = fakeOutput();
    const sink = new MidiSink(out);
    const later = performance.now() + 100;
    sink.noteOn(later, 64, 70);
    sent.length = 0;
    sink.stop();
    expect(sent[0]).toEqual([[0x81, 64, 0], later + 1]);
    // "all notes off" nos canais das notas e do metrônomo
    expect(sent.slice(1).map(([d]) => d)).toEqual([
      [0xb1, 64, 0],
      [0xb1, 123, 0],
      [0xb9, 123, 0],
    ]);
  });
});

describe('MidiSink stopped and replaced (ear drill: "Próximo" while the last question still sounds)', () => {
  it('does not silence the next sound: the new sink waits for the old one to be released', () => {
    const { out, sent } = fakeOutput();
    const old = new MidiSink(out);
    const now = performance.now();
    old.noteOn(now + 140, 60, 80); // already queued by the look-ahead
    old.stop();
    const next = new MidiSink(out);
    const start = Math.max(now + 120, next.readyAt);
    next.noteOn(start, 64, 80);
    const resets = sent.filter(([d]) => d[0] === 0xb1 && d[1] === 123);
    // o "all notes off" sai antes da nota nova, não depois (cortando-a)
    expect(resets.length).toBe(1);
    expect(resets[0]![1]!).toBeLessThan(start);
    expect(next.readyAt).toBeGreaterThan(now + 140);
  });
});
