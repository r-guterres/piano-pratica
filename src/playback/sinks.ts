// Saídas de som do Player: o alto-falante do tablet (Web Audio, timbre
// sintetizado) e o teclado (MIDI). Os instantes `at` estão no relógio de
// performance.now(), em ms; cada saída agenda o som para tocar exatamente ali.

export interface Sink {
  /** Atraso entre o instante agendado e o som sair (ms). */
  readonly latencyMs: number;
  click(at: number, accent: boolean): void;
  noteOn(at: number, pitch: number, velocity: number): void;
  noteOff(at: number, pitch: number): void;
  /** Pedal de sustentação. */
  pedal(at: number, down: boolean): void;
  /** Silencia tudo agora, inclusive o que estava agendado. */
  stop(): void;
  /** Antes deste instante (performance.now) nada novo deve soar: a saída ainda está sendo silenciada. */
  readonly readyAt?: number;
}

// ---------- alto-falante ----------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let pianoWave: PeriodicWave | null = null;

/** Contexto de áudio único; precisa ser criado/retomado num toque do usuário. */
export function audioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    // acordes somam amplitude: o compressor evita distorção
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(comp);
    // timbre simples de piano: fundamental + harmônicos decrescentes
    const harmonics = [0, 1, 0.55, 0.3, 0.18, 0.1, 0.06, 0.03];
    pianoWave = ctx.createPeriodicWave(
      new Float32Array(harmonics.length),
      Float32Array.from(harmonics),
    );
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Atraso estimado do alto-falante pelo navegador (ms). */
export function estimatedSpeakerLatency(): number {
  const c = audioContext();
  return ((c.outputLatency || 0) + (c.baseLatency || 0)) * 1000;
}

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

export class SpeakerSink implements Sink {
  readonly latencyMs: number;
  readonly #ctx = audioContext();
  /** Notas soando ou agendadas, por altura (FIFO). */
  readonly #voices = new Map<number, Voice[]>();
  readonly #all = new Set<Voice>();
  /** Pedal abaixado: as notas soltas continuam soando até ele subir. */
  #sustain = false;
  readonly #sustained: Voice[] = [];

  /** `latencyMs`: valor calibrado pelo usuário; null = estimativa do navegador. */
  constructor(latencyMs: number | null) {
    this.latencyMs = latencyMs ?? estimatedSpeakerLatency();
  }

  /** performance.now() → relógio do áudio. */
  #time(at: number): number {
    return Math.max(this.#ctx.currentTime, this.#ctx.currentTime + (at - performance.now()) / 1000);
  }

  #voice(type: OscillatorType | 'piano', freq: number): Voice {
    const osc = this.#ctx.createOscillator();
    if (type === 'piano') osc.setPeriodicWave(pianoWave!);
    else osc.type = type;
    osc.frequency.value = freq;
    const gain = this.#ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(master!);
    const v = { osc, gain };
    this.#all.add(v);
    osc.onended = () => {
      gain.disconnect();
      this.#all.delete(v);
    };
    return v;
  }

  click(at: number, accent: boolean): void {
    const t = this.#time(at);
    const v = this.#voice('triangle', accent ? 1760 : 1175);
    v.gain.gain.setValueAtTime(0, t);
    v.gain.gain.linearRampToValueAtTime(accent ? 0.9 : 0.6, t + 0.002);
    v.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    v.osc.start(t);
    v.osc.stop(t + 0.08);
  }

  noteOn(at: number, pitch: number, velocity: number): void {
    const t = this.#time(at);
    const v = this.#voice('piano', 440 * 2 ** ((pitch - 69) / 12));
    const peak = 0.25 * (velocity / 127) ** 1.5 + 0.03;
    const g = v.gain.gain;
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + 0.005);
    // decaimento de corda: rápido no início, depois longo
    g.setTargetAtTime(peak * 0.35, t + 0.005, 0.25);
    g.setTargetAtTime(0, t + 1, 2.5);
    v.osc.start(t);
    v.osc.stop(t + 8);
    const list = this.#voices.get(pitch) ?? [];
    list.push(v);
    this.#voices.set(pitch, list);
  }

  noteOff(at: number, pitch: number): void {
    const v = this.#voices.get(pitch)?.shift();
    if (!v) return;
    if (this.#sustain) this.#sustained.push(v);
    else this.#release(v, at);
  }

  #release(v: Voice, at: number): void {
    const t = this.#time(at);
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, 0.05);
    v.osc.stop(t + 0.4);
  }

  // Os eventos chegam em ordem de tempo, então o estado do pedal no momento
  // em que cada nota é solta é o do último evento de pedal recebido.
  pedal(at: number, down: boolean): void {
    this.#sustain = down;
    if (down) return;
    for (const v of this.#sustained.splice(0)) this.#release(v, at);
  }

  stop(): void {
    const t = this.#ctx.currentTime;
    for (const v of this.#all) {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, 0.01);
      try {
        v.osc.stop(t + 0.1);
      } catch {
        // oscilador agendado para começar depois de t: start/stop já resolvem
      }
    }
    this.#voices.clear();
    this.#sustained.length = 0;
    this.#sustain = false;
  }
}

// ---------- teclado (MIDI) ----------

// As notas vão no canal 2 (o 1 é o do próprio teclado; assim o timbre escolhido
// no Casio para tocar não muda); o metrônomo no canal 10, o de percussão do GM.
const NOTE_CH = 1;
const DRUM_CH = 9;
const WOOD_HI = 76;
const WOOD_LO = 77;

/**
 * Por saída: quando termina o silenciamento do último `stop()`. Os sinks são
 * recriados a cada reprodução, e o "all notes off" de um não pode cair depois
 * das primeiras notas do seguinte (cortava a 1ª nota da pergunta seguinte do
 * treino de ouvido).
 */
const quietAt = new WeakMap<MIDIOutput, number>();

export class MidiSink implements Sink {
  readonly latencyMs = 0;
  readonly #out: MIDIOutput;
  readonly #onSent: (pitch: number, at: number) => void;
  /** Notas com note-on enviado e note-off ainda não. */
  readonly #pending = new Map<number, number>();
  /** O maior horário já enviado (o que está na fila do navegador). */
  #lastAt = 0;

  /** `onSent`: avisado de cada note-on (para o filtro de eco da entrada). */
  constructor(out: MIDIOutput, onSent: (pitch: number, at: number) => void = () => {}) {
    this.#out = out;
    this.#onSent = onSent;
    this.#send([0xc0 | NOTE_CH, 0]); // piano acústico
  }

  get readyAt(): number {
    return quietAt.get(this.#out) ?? 0;
  }

  #send(data: number[], at?: number): void {
    if (at !== undefined && at > this.#lastAt) this.#lastAt = at;
    try {
      this.#out.send(data, at);
    } catch (err) {
      console.warn('MIDI: falha ao enviar', err);
    }
  }

  click(at: number, accent: boolean): void {
    const note = accent ? WOOD_HI : WOOD_LO;
    this.#send([0x90 | DRUM_CH, note, accent ? 120 : 90], at);
    this.#send([0x80 | DRUM_CH, note, 0], at + 60);
  }

  noteOn(at: number, pitch: number, velocity: number): void {
    this.#send([0x90 | NOTE_CH, pitch, velocity], at);
    this.#pending.set(pitch, at);
    this.#onSent(pitch, at);
  }

  noteOff(at: number, pitch: number): void {
    this.#send([0x80 | NOTE_CH, pitch, 0], at);
    this.#pending.delete(pitch);
  }

  pedal(at: number, down: boolean): void {
    this.#send([0xb0 | NOTE_CH, 64, down ? 127 : 0], at);
  }

  stop(): void {
    // note-ons já agendados ainda vão sair: solta cada um logo depois dele
    const now = performance.now();
    for (const [pitch, at] of this.#pending)
      this.#send([0x80 | NOTE_CH, pitch, 0], Math.max(now, at + 1));
    this.#pending.clear();
    // e, por garantia, pedal solto e "all notes off" logo depois do que ainda estava na fila
    const at = Math.max(now, this.#lastAt) + 1;
    this.#send([0xb0 | NOTE_CH, 64, 0], at);
    for (const ch of [NOTE_CH, DRUM_CH]) this.#send([0xb0 | ch, 123, 0], at);
    quietAt.set(this.#out, at + 2);
  }
}
