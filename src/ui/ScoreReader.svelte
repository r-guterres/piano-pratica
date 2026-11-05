<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { InputEvent } from '../core/events';
  import { pitchName } from '../core/pitch';
  import { heldPitches } from '../input/held.svelte';
  import { inputHub } from '../input/hub';
  import { Recorder } from '../input/recorder';
  import { midi } from '../input/midi.svelte';
  import { RhythmJudge, type RhythmEvent } from '../practice/rhythm';
  import { TempoLadder } from '../practice/tempoLadder';
  import {
    loopStepRange,
    WaitMode,
    type LoopRange,
    type WaitModeSummary,
  } from '../practice/waitMode';
  import { makeOutputs } from '../playback/outputs';
  import { Player, type VisualEvent } from '../playback/player';
  import { loopPositions, measureStart } from '../playback/range';
  import {
    beatGrid,
    buildSchedule,
    metronomeSchedule,
    type PlaySelection,
  } from '../playback/schedule';
  import { audioContext } from '../playback/sinks';
  import { ScoreView, type ScoreViewState } from '../score/ScoreView';
  import { buildSteps, stepAtOrAfter } from '../score/steps';
  import { appHistory, newId, type ScoreSessionRecord } from '../storage/history';
  import { troubleMeasures, type MeasureTrouble } from '../storage/progress';
  import type { HandSelection, MeasureInfo, TimelinePosition } from '../score/types';
  import type { ScoreSource } from './Library.svelte';
  import PianoKeyboard from './PianoKeyboard.svelte';
  import SessionSummary from './SessionSummary.svelte';
  import { saveSettings, settings, ZOOM_MAX, ZOOM_MIN, type ListenMode } from './settings.svelte';

  let { source, onclose }: { source: ScoreSource; onclose: () => void } = $props();

  // Cores do feedback nas cabeças de nota (sobre papel claro).
  const COLOR = {
    partial: '#1e6fd9', // nota certa de um acorde ainda incompleto
    clean: '#2e7d32', // passo tocado de primeira
    fixed: '#e65100', // passo concluído depois de erro(s)
    wrong: '#d32f2f', // pisca ao errar
    offtime: '#e65100', // acompanhar: tocada fora do tempo
    missed: '#9e2b25', // acompanhar: nota que passou sem ser tocada
  };

  let viewport: HTMLDivElement;
  let view: ScoreView | null = null;
  let error = $state('');
  let loading = $state(true);
  let timeline = $state.raw<TimelinePosition[]>([]);
  // título de dentro da partitura (MusicXML), se houver; senão, o da biblioteca/arquivo
  let sheetTitle = $state('');
  const title = $derived(sheetTitle || source.title);
  let vs = $state<ScoreViewState | null>(null);

  const steps = $derived(buildSteps(timeline, settings.score.hands));
  const measureCount = $derived((timeline.at(-1)?.measure ?? 0) + 1);

  // ---- sessão do modo espera ----
  // O WaitMode não é reativo; incrementar `tick` faz a UI reler o estado dele.
  let mode = $state.raw<WaitMode | null>(null);
  let tick = $state(0);
  let loop = $state<LoopRange | null>(null);
  let summary = $state<WaitModeSummary | null>(null);
  let lastWrong = $state<number | null>(null);

  const current = $derived.by(() => (void tick, mode?.current ?? null));
  const played = $derived.by(() => (void tick, new Set(mode?.played ?? [])));
  const wrongCount = $derived.by(() => (void tick, mode?.summary().wrongNotes ?? 0));
  const expected = $derived(new Set(current?.pitches ?? []));
  const range = $derived(
    settings.input.virtualRange === 'full' ? { low: 36, high: 96 } : { low: 48, high: 84 },
  );

  // ---- histórico (IndexedDB) ----
  let record: Omit<ScoreSessionRecord, 'finished' | 'summary'> | null = null;

  /** Grava a sessão atual (de novo pelo mesmo id, se já gravada); sem nenhuma nota tocada, não grava. */
  function persistSession() {
    if (!mode || !record) return;
    const summary = mode.summary();
    if (summary.completed === 0 && summary.wrongNotes === 0) return;
    appHistory()
      .saveScoreSession({ ...record, finished: mode.finished, summary })
      .catch((err: unknown) => console.warn('Não consegui salvar a sessão:', err));
  }

  function startSession() {
    if (!view) return;
    persistSession();
    mode = new WaitMode(steps, { loop });
    record = {
      id: newId(),
      scoreId: source.id,
      title,
      startedAt: Date.now(),
      hands: settings.score.hands,
      loop: loop ? { ...loop } : null,
      stepCount: mode.range.last - mode.range.first + 1,
    };
    view.clearColors();
    summary = null;
    lastWrong = null;
    tick++;
    if (mode.current) view.moveTo(mode.current.position);
  }

  function handleInput(event: InputEvent) {
    // no modo acompanhar o cursor anda sozinho; o juiz avalia o ritmo
    if (practice === 'follow') {
      if (judge && event.type === 'on') applyRhythm(judge.handle(event));
      return;
    }
    if (!mode || !view || summary) return;
    const events = mode.handle(event);
    if (events.length === 0) return;
    for (const ev of events) {
      switch (ev.type) {
        case 'hit':
          view.colorNotes(ev.step.position, [ev.pitch], COLOR.partial);
          break;
        case 'wrong':
          view.flash(ev.step.position, ev.step.pitches, COLOR.wrong);
          lastWrong = ev.pitch;
          break;
        case 'advance':
          view.colorNotes(ev.from.position, ev.from.pitches, ev.clean ? COLOR.clean : COLOR.fixed);
          lastWrong = null;
          if (ev.to) view.moveTo(ev.to.position);
          break;
        case 'lap': {
          const { first, last } = mode.range;
          view.clearColors(mode.steps.slice(first, last + 1).map((s) => s.position));
          view.moveTo(ev.to.position);
          break;
        }
        case 'finished':
          summary = ev.summary;
          persistSession();
          break;
      }
    }
    tick++;
  }

  onMount(() => {
    view = new ScoreView(
      viewport,
      {
        zoom: settings.score.zoom,
        pageTurn: settings.score.pageTurn,
        cursorColor: '#2f6fb3',
      },
      (s) => (vs = s),
    );
    source
      .load()
      .then((content) => view!.load(content, source.title))
      .then(() => {
        timeline = view!.timeline;
        measures = view!.measures;
        sheetTitle = view!.osmd.Sheet.TitleString ?? '';
        startSession();
      })
      .catch((err: unknown) => (error = `Não consegui abrir a partitura: ${String(err)}`))
      .finally(() => (loading = false));
  });

  const unsubscribe = inputHub.subscribe((event) => {
    recorder?.add(event);
    handleInput(event);
  });

  // ---- gravação (teclas e pedal; ouvir e exportar em Progresso → Gravações) ----
  let recorder = $state.raw<Recorder | null>(null);
  let recordStart = 0;
  let recordNote = $state('');
  let recordClock = $state(0);
  let recordTimer: ReturnType<typeof setInterval> | undefined;

  function startRecording() {
    recordStart = Date.now();
    recorder = new Recorder(performance.now());
    recordNote = '';
    recordClock = 0;
    recordTimer = setInterval(() => (recordClock = Date.now() - recordStart), 500);
  }

  function stopRecording() {
    if (!recorder) return;
    clearInterval(recordTimer);
    const { events, durationMs } = recorder.stop(performance.now());
    recorder = null;
    if (!events.length) {
      recordNote = 'Nada foi tocado: gravação descartada.';
      return;
    }
    appHistory()
      .saveRecording({
        id: newId(),
        createdAt: recordStart,
        title,
        scoreId: source.id,
        durationMs,
        events,
      })
      .then(() => (recordNote = 'Gravação salva: ouça em Progresso → Gravações.'))
      .catch((err: unknown) => (recordNote = `Não consegui salvar a gravação: ${String(err)}`));
  }

  const clockText = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // o Android pode encerrar o app em segundo plano sem aviso: grava ao sair da tela
  // (e para o som: em segundo plano o relógio do navegador fica impreciso)
  const onHidden = () => {
    if (document.visibilityState !== 'hidden') return;
    stopRecording();
    stopPlayback();
    persistSession();
  };
  document.addEventListener('visibilitychange', onHidden);

  onDestroy(() => {
    stopRecording();
    stopPlayback();
    persistSession();
    document.removeEventListener('visibilitychange', onHidden);
    unsubscribe();
    view?.destroy();
  });

  /** Navegação manual (◀ ▶ / setas): pula passos sem tocar. */
  function goStep(delta: number) {
    if (!mode || !view) return;
    const from = mode.current?.index ?? mode.range.last + 1;
    mode.jumpTo(from + delta);
    lastWrong = null;
    tick++;
    if (mode.current) view.moveTo(mode.current.position);
  }

  function setHands(h: HandSelection) {
    settings.score.hands = h;
    saveSettings();
    restartPlayback(() => startSession());
  }

  // ---- reprodução: metrônomo e modo acompanhar ----
  type Practice = 'wait' | 'follow';
  let practice = $state<Practice>('wait');
  let measures = $state.raw<MeasureInfo[]>([]);
  let playing = $state(false);
  /** Tempo atual do compasso (indicador) e quantos tempos ele tem. */
  let beat = $state<{ index: number; count: number } | null>(null);
  let playWarning = $state('');
  let player: Player | null = null;

  const BPM_MIN = 20;
  const BPM_MAX = 240;
  const writtenBpm = $derived(measures.find((m) => m.tempo)?.tempo ?? null);
  const bpm = $derived(
    settings.playback.bpm[source.id] ?? writtenBpm ?? settings.playback.defaultBpm,
  );
  const listenLabels: [ListenMode, string][] = [
    ['none', 'nada'],
    ['other', 'a outra mão'],
    ['all', 'tudo'],
  ];

  /** Quais notas o app toca, conforme "Ouvir" e a mão escolhida. */
  function playSelection(): PlaySelection {
    const listen = settings.playback.listen;
    const hands = settings.score.hands;
    if (listen === 'all') return 'both';
    if (listen === 'none' || hands === 'both') return 'none';
    return hands === 'right' ? 'left' : 'right';
  }

  function startPlayback() {
    if (!view || !timeline.length || !measures.length) return;
    audioContext(); // o áudio só pode começar num toque do usuário
    const position = view.position;
    const follow = practice === 'follow';
    const metronome = follow ? settings.playback.metronome : true;
    const play = follow ? playSelection() : 'none';
    const out = makeOutputs({ clicks: metronome, notes: play !== 'none' });
    playWarning = out.warning;

    let schedule;
    let repeat: boolean;
    const measure = measures[timeline[position]?.measure ?? 0]!;
    if (follow) {
      const range = loop ? loopPositions(timeline, loop) : null;
      const from = range ? range.from : measureStart(timeline, position);
      const to = range ? range.to : timeline.length - 1;
      schedule = buildSchedule(timeline, measures, {
        bpm,
        from,
        to,
        countIn: settings.playback.countIn,
        metronome,
        play,
        expect: settings.score.hands,
      });
      repeat = range !== null;
    } else {
      // só o metrônomo, na fórmula do compasso do cursor (bpm em semínimas → pulsos)
      const { beat: unit } = beatGrid(measure.beats, measure.beatType);
      schedule = metronomeSchedule(bpm / 4 / unit, measure.beats, measure.beatType);
      repeat = true;
    }
    player = new Player(out, onVisual, () => {
      finishFollow();
      playing = false;
      beat = null;
    });
    player.start(schedule, repeat);
    playing = true;
    if (follow) {
      view.clearColors();
      judge = new RhythmJudge(schedule.expected, {
        origin: player.bodyOrigin,
        bodyMs: schedule.bodyMs,
        loop: repeat,
      });
      lastHit = null;
      // só em `npm run dev`: permite a testes de navegador tocar "no tempo"
      if (import.meta.env.DEV)
        (window as unknown as { __follow: unknown }).__follow = {
          origin: player.bodyOrigin,
          bodyMs: schedule.bodyMs,
          expected: schedule.expected,
        };
      ladder = repeat && settings.playback.ladder ? new TempoLadder(ladderOptions()) : null;
      followRecord = {
        id: newId(),
        scoreId: source.id,
        title,
        startedAt: Date.now(),
        hands: settings.score.hands,
        loop: loop ? { ...loop } : null,
        stepCount: schedule.expected.length,
        mode: 'follow',
        bpm,
      };
      rhythmTick++;
    }
  }

  // ---- avaliação do ritmo (modo acompanhar) ----
  let judge: RhythmJudge | null = null;
  let ladder = $state.raw<TempoLadder | null>(null);
  let rhythmTick = $state(0);
  let lastHit = $state<{ text: string; kind: 'ok' | 'off' | 'bad' } | null>(null);
  let ladderNote = $state('');
  let ladderTarget = $state<number | null>(null);
  let followRecord: Omit<ScoreSessionRecord, 'finished' | 'summary' | 'rhythm'> | null = null;
  const rhythm = $derived.by(() => (void rhythmTick, judge?.summary() ?? null));
  const ladderStreak = $derived.by(() => (void rhythmTick, ladder?.streak ?? 0));
  const target = $derived(ladderTarget ?? writtenBpm ?? bpm + 20);

  const ladderOptions = () => ({ step: 5, needed: 3, target });

  function hitText(e: Extract<RhythmEvent, { type: 'hit' }>): string {
    const ms = (e.offsetMs > 0 ? '+' : '') + Math.round(e.offsetMs) + ' ms';
    const label =
      e.timing === 'ontime' ? '✓ no tempo' : e.timing === 'early' ? 'adiantada' : 'atrasada';
    return name(e.note.pitch) + ' ' + label + ' (' + ms + ')';
  }

  function applyRhythm(events: RhythmEvent[]) {
    if (!events.length || !view) return;
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const ok = e.timing === 'ontime';
          view.colorNotes(e.note.position, [e.note.pitch], ok ? COLOR.clean : COLOR.offtime);
          lastHit = { kind: ok ? 'ok' : 'off', text: hitText(e) };
          break;
        }
        case 'wrong':
          if (e.near) view.flash(e.near.position, [e.near.pitch], COLOR.wrong);
          lastHit = { kind: 'bad', text: '✗ tocou ' + name(e.pitch) };
          break;
        case 'missed':
          view.colorNotes(e.note.position, [e.note.pitch], COLOR.missed);
          break;
        case 'lapDone': {
          if (!ladder) break;
          const next = ladder.record(e.clean, bpm);
          if (next !== null) {
            ladderNote = '3 voltas limpas: subiu para ' + next + ' bpm';
            // recomeça com o novo andamento fora do callback do Player
            queueMicrotask(() => setBpm(next));
          } else if (!e.clean) ladderNote = '';
          break;
        }
      }
    }
    rhythmTick++;
  }

  /** Encerra a avaliação e grava a sessão do modo acompanhar. */
  function finishFollow() {
    if (!judge || !followRecord) return;
    applyRhythm(judge.advance(performance.now()));
    const r = judge.summary();
    const record = followRecord;
    judge = null;
    followRecord = null;
    rhythmTick++;
    const played = r.ontime + r.early + r.late;
    if (r.notes === 0 && r.wrong === 0 && played === 0) return;
    appHistory()
      .saveScoreSession({
        ...record,
        finished: false,
        summary: {
          completed: Math.max(r.notes, played),
          clean: r.ontime,
          wrongNotes: r.wrong + r.missed,
          errorsByMeasure: r.problemsByMeasure,
          mistakes: [],
          durationMs: Math.max(0, Date.now() - record.startedAt),
          laps: r.laps,
          meanStepMs: null,
        },
        rhythm: r,
      })
      .catch((err: unknown) => console.warn('Não consegui salvar a sessão:', err));
  }

  function onVisual(e: VisualEvent) {
    if (judge) applyRhythm(judge.advance(performance.now()));
    if (e.kind === 'lap' && loop) {
      // nova volta: limpa as cores do trecho
      const range = loopPositions(timeline, loop);
      if (range)
        view?.clearColors(
          Array.from({ length: range.to - range.from + 1 }, (_, k) => range.from + k),
        );
    }
    if (e.kind === 'cursor') view?.moveTo(e.position);
    else if (e.kind === 'click') {
      const m = measures[timeline[view?.position ?? 0]?.measure ?? 0];
      const count = m ? beatGrid(m.beats, m.beatType).count : 4;
      beat = { index: e.beat, count };
    }
  }

  function stopPlayback() {
    player?.stop();
    finishFollow();
    player = null;
    playing = false;
    beat = null;
  }

  /** Para, aplica a mudança e, se estava tocando, recomeça do compasso do cursor. */
  function restartPlayback(change: () => void = () => {}) {
    const was = playing;
    stopPlayback();
    change();
    if (was) startPlayback();
  }

  const togglePlayback = () => (playing ? stopPlayback() : startPlayback());

  function setPractice(p: Practice) {
    if (p === practice) return;
    const position = view?.position ?? 0;
    stopPlayback();
    practice = p;
    if (p === 'wait') {
      // retoma o modo espera no ponto em que o cursor parou
      startSession();
      const i = stepAtOrAfter(steps, position);
      if (mode && i >= 0) {
        mode.jumpTo(i);
        tick++;
        if (mode.current) view?.moveTo(mode.current.position);
      }
    }
  }

  function setBpm(value: number) {
    const v = Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, value)));
    restartPlayback(() => {
      settings.playback.bpm[source.id] = v;
      saveSettings();
    });
  }

  function setListen(l: ListenMode) {
    restartPlayback(() => {
      settings.playback.listen = l;
      saveSettings();
    });
  }

  function toggleMetronome() {
    restartPlayback(() => {
      settings.playback.metronome = !settings.playback.metronome;
      saveSettings();
    });
  }

  // ---- loop de compassos ----
  let loopPanel = $state(false);
  let loopFrom = $state(1);
  let loopTo = $state(1);
  let loopError = $state('');

  function toggleLoopPanel() {
    loopPanel = !loopPanel;
    loopError = '';
    if (loop) {
      loopFrom = loop.startMeasure + 1;
      loopTo = loop.endMeasure + 1;
    } else {
      const m = (current?.measure ?? 0) + 1;
      loopFrom = m;
      loopTo = Math.min(measureCount, m + 3);
    }
  }

  function applyLoop() {
    const a = Math.max(1, Math.min(loopFrom, loopTo));
    const b = Math.min(measureCount, Math.max(loopFrom, loopTo));
    const candidate = { startMeasure: a - 1, endMeasure: b - 1 };
    if (!loopStepRange(steps, candidate)) {
      loopError = 'Não há notas para tocar nesse trecho com a mão escolhida.';
      return;
    }
    loopPanel = false;
    restartPlayback(() => {
      loop = candidate;
      startSession();
    });
  }

  // ---- compassos difíceis (histórico das últimas sessões desta peça) ----
  let troublePanel = $state(false);
  let troubles = $state<MeasureTrouble[] | null>(null);

  async function toggleTroublePanel() {
    troublePanel = !troublePanel;
    if (!troublePanel) return;
    // inclui a sessão em andamento
    persistSession();
    troubles = null;
    try {
      troubles = troubleMeasures(await appHistory().scoreSessions(), source.id);
    } catch {
      troubles = [];
    }
  }

  function loopMeasure(measure: number) {
    troublePanel = false;
    restartPlayback(() => {
      loop = { startMeasure: measure, endMeasure: measure };
      startSession();
    });
  }

  function clearLoop() {
    loopPanel = false;
    restartPlayback(() => {
      loop = null;
      startSession();
    });
  }

  function zoom(factor: number) {
    if (!view) return;
    const o = view.orientation;
    const z =
      Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, settings.score.zoom[o] * factor)) * 100) /
      100;
    settings.score.zoom[o] = z;
    saveSettings();
    view.setZoom(o, z);
  }

  function togglePageTurn() {
    settings.score.pageTurn = settings.score.pageTurn === 'full' ? 'half' : 'full';
    saveSettings();
    view?.setPageTurn(settings.score.pageTurn);
  }

  function toggleKeyboard() {
    settings.input.virtualKeyboard = !settings.input.virtualKeyboard;
    saveSettings();
  }

  // Toque nas bordas da partitura vira a página à mão.
  let downAt: { x: number; y: number } | null = null;
  function viewportDown(e: PointerEvent) {
    downAt = { x: e.clientX, y: e.clientY };
  }
  function viewportUp(e: PointerEvent) {
    if (!downAt || !view) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 20) return;
    const rect = viewport.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.2) view.turnPage(-1);
    else if (x > 0.8) view.turnPage(1);
  }

  function onKey(e: KeyboardEvent) {
    if (summary) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return;
    if (e.key === ' ') togglePlayback();
    else if (e.key === 'ArrowRight') goStep(1);
    else if (e.key === 'ArrowLeft') goStep(-1);
    else if (e.key === 'PageDown') view?.turnPage(1);
    else if (e.key === 'PageUp') view?.turnPage(-1);
    else return;
    e.preventDefault();
  }

  const press = (pitch: number) =>
    inputHub.emit({ type: 'on', pitch, velocity: 80, t: performance.now() }, 'virtual');
  const release = (pitch: number) =>
    inputHub.emit({ type: 'off', pitch, velocity: 0, t: performance.now() }, 'virtual');

  const name = (p: number) => pitchName(p, settings.naming);

  const handLabels: [HandSelection, string][] = [
    ['right', 'MD'],
    ['left', 'ME'],
    ['both', 'Ambas'],
  ];
</script>

<svelte:window onkeydown={onKey} />

<div class="reader">
  <div class="toolbar">
    <button onclick={onclose} aria-label="Voltar à biblioteca">‹</button>
    <span class="title" {title}>{title}</span>

    <span class="group">
      <button onclick={() => goStep(-1)} aria-label="Passo anterior" disabled={!mode}>◀</button>
      <span class="counter">
        {#if practice === 'follow'}
          c.{(vs?.measure ?? 0) + 1}
        {:else if current}
          Passo {current.index + 1}/{steps.length} · c.{current.measure + 1}
        {:else if mode?.finished}
          Fim
        {:else}
          —
        {/if}
      </span>
      <button onclick={() => goStep(1)} aria-label="Próximo passo" disabled={!mode}>▶</button>
    </span>

    <span class="group segmented" role="group" aria-label="Mão">
      {#each handLabels as [h, label] (h)}
        <button class:active={settings.score.hands === h} onclick={() => setHands(h)}>
          {label}
        </button>
      {/each}
    </span>

    <span class="group">
      <button class:active={loop !== null} onclick={toggleLoopPanel} title="Repetir um trecho">
        {loop ? `Loop c.${loop.startMeasure + 1}–${loop.endMeasure + 1}` : 'Loop'}
      </button>
      <button
        class:active={troublePanel}
        onclick={toggleTroublePanel}
        title="Compassos onde você mais erra"
      >
        Difíceis
      </button>
      <button onclick={startSession} title="Recomeçar a sessão" aria-label="Recomeçar">⟲</button>
      <button onclick={() => mode && (summary = mode.summary())} disabled={!mode}>Resumo</button>
    </span>

    <span class="group">
      <button onclick={() => zoom(1 / 1.15)} aria-label="Diminuir">A−</button>
      <button onclick={() => zoom(1.15)} aria-label="Aumentar">A+</button>
      <button onclick={togglePageTurn} title="Modo de virada de página">
        Virada: {settings.score.pageTurn === 'half' ? 'meia' : 'inteira'}
      </button>
      <button
        class:active={settings.input.virtualKeyboard}
        onclick={toggleKeyboard}
        aria-label="Teclado na tela">🎹</button
      >
    </span>

    <span class="status">
      {#if vs}pág. {vs.viewPage + 1}/{vs.pageCount}{#if vs.viewPage !== vs.cursorPage}
          (cursor na {vs.cursorPage + 1}){/if}{/if}
      <span class="dot" class:on={midi.status === 'ready'} title="MIDI"></span>
    </span>
  </div>

  <div class="transport">
    <span class="group segmented" role="group" aria-label="Modo">
      <button class:active={practice === 'wait'} onclick={() => setPractice('wait')}>Esperar</button
      >
      <button class:active={practice === 'follow'} onclick={() => setPractice('follow')}>
        Acompanhar
      </button>
    </span>
    <button
      class="play"
      class:active={playing}
      onclick={togglePlayback}
      disabled={loading || !!error}
    >
      {#if playing}■ Parar{:else if practice === 'follow'}▶ Tocar{:else}▶ Metrônomo{/if}
    </button>
    <span class="group">
      <button onclick={() => setBpm(bpm - 5)} aria-label="Mais devagar">−</button>
      <span class="bpm">
        <strong>{bpm}</strong> bpm
        {#if writtenBpm}<span class="muted">({Math.round((bpm / writtenBpm) * 100)}%)</span>{/if}
      </span>
      <button onclick={() => setBpm(bpm + 5)} aria-label="Mais rápido">+</button>
    </span>
    {#if practice === 'follow'}
      <button class:active={settings.playback.metronome} onclick={toggleMetronome}>
        Metrônomo
      </button>
      <label class="listen">
        Ouvir
        <select
          value={settings.playback.listen}
          onchange={(e) => setListen((e.currentTarget as HTMLSelectElement).value as ListenMode)}
        >
          {#each listenLabels as [value, label] (value)}
            <option {value} disabled={value === 'other' && settings.score.hands === 'both'}>
              {label}
            </option>
          {/each}
        </select>
      </label>
    {/if}
    {#if beat}
      <span class="beats" aria-label="Tempo {beat.index + 1} de {beat.count}">
        {#each Array.from({ length: beat.count }, (_, k) => k) as i (i)}
          <i class:on={i === beat.index} class:first={i === 0}></i>
        {/each}
      </span>
    {/if}
    {#if practice === 'follow' && loop}
      <button
        class:active={settings.playback.ladder}
        onclick={() =>
          restartPlayback(() => {
            settings.playback.ladder = !settings.playback.ladder;
            saveSettings();
          })}
        title="Sobe 5 bpm a cada 3 voltas limpas seguidas"
      >
        Escada
      </button>
      {#if settings.playback.ladder}
        <label class="listen">
          até
          <input
            class="target"
            type="number"
            min="20"
            max="240"
            value={target}
            onchange={(e) =>
              restartPlayback(
                () => (ladderTarget = Number((e.currentTarget as HTMLInputElement).value)),
              )}
          />
          bpm
        </label>
      {/if}
    {/if}
    <button
      class="rec"
      class:on={recorder !== null}
      onclick={() => (recorder ? stopRecording() : startRecording())}
      title="Grava o que você toca (teclas e pedal)"
    >
      {recorder ? `■ ${clockText(recordClock)}` : '● Gravar'}
    </button>
    {#if recordNote}<span class="muted">{recordNote}</span>{/if}
    {#if playWarning}<span class="warn">{playWarning}</span>{/if}
  </div>

  {#if troublePanel}
    <div class="loop-panel trouble">
      {#if troubles === null}
        <span class="muted">Carregando…</span>
      {:else if troubles.length === 0}
        <span class="muted">Nenhum erro registrado nesta peça nas últimas sessões.</span>
      {:else}
        <span class="muted">Mais erros nas últimas 10 sessões:</span>
        {#each troubles as t (t.measure)}
          <button onclick={() => loopMeasure(t.measure)} title="Repetir este compasso em loop">
            c.{t.measure + 1}: {t.count}
            {t.count === 1 ? 'erro' : 'erros'}{t.sessions > 1 ? ` em ${t.sessions} sessões` : ''} ↻
          </button>
        {/each}
      {/if}
    </div>
  {/if}

  {#if loopPanel}
    <div class="loop-panel">
      <label>
        Do compasso
        <input type="number" min="1" max={measureCount} bind:value={loopFrom} />
      </label>
      <label>
        ao
        <input type="number" min="1" max={measureCount} bind:value={loopTo} />
      </label>
      <span class="muted">(de {measureCount})</span>
      <button class="primary" onclick={applyLoop}>Repetir trecho</button>
      {#if loop}<button onclick={clearLoop}>Tirar loop</button>{/if}
      {#if loopError}<span class="error">{loopError}</span>{/if}
    </div>
  {/if}

  {#if practice === 'follow'}
    <div class="expected rhythm">
      {#if lastHit}
        <strong class="hit {lastHit.kind}">{lastHit.text}</strong>
      {:else}
        <span class="muted">
          {playing ? 'Toque junto com o cursor' : 'Toque em ▶ Tocar e acompanhe o cursor'}
          ({settings.score.hands === 'both'
            ? 'as duas mãos'
            : settings.score.hands === 'right'
              ? 'mão direita'
              : 'mão esquerda'})
        </span>
      {/if}
      {#if rhythm}
        <span>
          No tempo <b>{rhythm.ontime}</b> · adiantadas <b>{rhythm.early}</b> · atrasadas
          <b>{rhythm.late}</b> · erradas <b>{rhythm.wrong}</b> · perdidas <b>{rhythm.missed}</b>
        </span>
        {#if rhythm.meanOffsetMs !== null && rhythm.ontime + rhythm.early + rhythm.late >= 4}
          <span class="muted">
            {Math.abs(rhythm.meanOffsetMs) < 25
              ? 'sem tendência'
              : rhythm.meanOffsetMs < 0
                ? 'tendência: adiantar ' + Math.round(-rhythm.meanOffsetMs) + ' ms'
                : 'tendência: atrasar ' + Math.round(rhythm.meanOffsetMs) + ' ms'}
          </span>
        {/if}
      {/if}
      {#if ladder && settings.playback.ladder}
        <span class="ladder">Escada: {ladderStreak}/3 voltas limpas · alvo {target} bpm</span>
      {/if}
      {#if ladderNote}<span class="ladder">{ladderNote}</span>{/if}
    </div>
  {/if}

  <div class="expected" class:hidden={practice === 'follow'}>
    <span>
      Esperado:
      {#if current}
        {#each current.pitches as p, i (p)}
          {#if i > 0}<span class="sep">·</span>{/if}
          <strong class:done={played.has(p)}>{name(p)}</strong>
        {/each}
      {:else}
        <strong>—</strong>
      {/if}
    </span>
    {#if lastWrong !== null}
      <span class="wrong">✗ tocou {name(lastWrong)}</span>
    {/if}
    <span class="muted">
      Tocando: {heldPitches.size
        ? [...heldPitches]
            .sort((a, b) => a - b)
            .map(name)
            .join(' · ')
        : '—'}
    </span>
    <span class="errors" class:has={wrongCount > 0}>Erros: {wrongCount}</span>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="viewport"
    bind:this={viewport}
    onpointerdown={viewportDown}
    onpointerup={viewportUp}
  ></div>

  {#if loading}<div class="message">Carregando partitura…</div>{/if}
  {#if error}<div class="message error">{error}</div>{/if}

  {#if settings.input.virtualKeyboard}
    <div class="kb">
      <PianoKeyboard
        low={range.low}
        high={range.high}
        active={heldPitches}
        marked={expected}
        onpress={press}
        onrelease={release}
      />
    </div>
  {/if}
</div>

{#if summary && mode}
  <SessionSummary
    {summary}
    finished={mode.finished}
    looping={mode.looping}
    onrestart={startSession}
    onclose={() => (summary = null)}
  />
{/if}

<style>
  .reader {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.75rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .toolbar button {
    min-height: 2.5rem;
    min-width: 2.5rem;
    padding: 0.2rem 0.6rem;
  }
  .title {
    font-weight: 600;
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .group {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .segmented button.active,
  button.active {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .counter {
    min-width: 8.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .status {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-variant-numeric: tabular-nums;
  }
  .dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    background: var(--border);
  }
  .dot.on {
    background: var(--ok);
  }
  .transport {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.75rem;
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .transport button {
    min-height: 2.5rem;
    min-width: 2.5rem;
    padding: 0.2rem 0.6rem;
  }
  .transport .play {
    min-width: 7.5rem;
    font-weight: 600;
  }
  .bpm {
    min-width: 6.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .listen {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .listen select {
    min-height: 2.5rem;
  }
  .beats {
    display: inline-flex;
    gap: 0.35rem;
  }
  .beats i {
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    border: 2px solid var(--border);
  }
  .beats i.first {
    border-color: var(--muted);
  }
  .beats i.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  .warn {
    color: var(--warn);
    font-size: 0.9rem;
  }
  .hit.ok {
    color: var(--ok);
  }
  .hit.off {
    color: var(--warn);
  }
  .hit.bad {
    color: var(--bad);
  }
  .ladder {
    color: var(--accent);
    font-weight: 600;
  }
  .target {
    width: 4.5rem;
    min-height: 2.5rem;
    font: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
  }
  .rec.on {
    background: var(--bad);
    border-color: var(--bad);
    color: #fff;
    font-variant-numeric: tabular-nums;
  }
  .expected.hidden {
    display: none;
  }
  .loop-panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding: 0.5rem 0.8rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .loop-panel input {
    width: 4.5rem;
    min-height: 2.5rem;
    font: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
  }
  .expected {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 1.5rem;
    padding: 0.3rem 0.8rem;
    font-size: 0.95rem;
    border-bottom: 1px solid var(--border);
  }
  .sep {
    margin: 0 0.3rem;
  }
  strong.done {
    color: var(--ok);
  }
  .wrong {
    color: var(--bad);
    font-weight: 600;
  }
  .errors {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }
  .errors.has {
    color: var(--bad);
  }
  .viewport {
    flex: 1;
    min-height: 0;
  }
  .kb {
    padding: 0.3rem 0.3rem calc(0.3rem + env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--border);
  }
  .message {
    position: fixed;
    top: 40%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem 1.5rem;
    z-index: 10;
  }
  .error {
    color: var(--bad);
  }
</style>
