<script lang="ts">
  import { pitchName } from '../core/pitch';
  import { saveSettings, settings, ZOOM_MAX, ZOOM_MIN } from './settings.svelte';

  const orientations = [
    ['portrait', 'retrato'],
    ['landscape', 'paisagem'],
  ] as const;

  const example = $derived([60, 61, 69].map((p) => pitchName(p, settings.naming)).join(', '));
</script>

<section class="card">
  <h2>Nomes das notas</h2>
  <div class="row">
    <label class="field">
      Nomes
      <select bind:value={settings.naming.style} onchange={saveSettings}>
        <option value="solfege">Dó Ré Mi</option>
        <option value="letters">C D E</option>
      </select>
    </label>
    <label class="field">
      Dó central
      <select bind:value={settings.naming.octave} onchange={saveSettings}>
        <option value="middle-c-4">Dó4 / C4 (científica)</option>
        <option value="middle-c-3">Dó3 / C3 (franco-belga)</option>
      </select>
    </label>
    <label class="field">
      Teclas pretas
      <select bind:value={settings.naming.accidental} onchange={saveSettings}>
        <option value="sharp">sustenidos (♯)</option>
        <option value="flat">bemóis (♭)</option>
      </select>
    </label>
  </div>
  <p class="muted">Exemplo: {example}</p>
</section>

<section class="card">
  <h2>Partitura</h2>
  <div class="row">
    {#each orientations as [o, label] (o)}
      <label class="field grow">
        Tamanho em {label}: {Math.round(settings.score.zoom[o] * 100)}%
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step="0.05"
          bind:value={settings.score.zoom[o]}
          onchange={saveSettings}
        />
      </label>
    {/each}
    <label class="field">
      Virada de página
      <select bind:value={settings.score.pageTurn} onchange={saveSettings}>
        <option value="full">Inteira (no fim da página)</option>
        <option value="half">Meia-virada (lê adiante)</option>
      </select>
    </label>
  </div>
  <p class="muted">Na partitura, toque na borda esquerda ou direita para virar a página à mão.</p>
</section>

<section class="card">
  <h2>Entrada</h2>
  <label class="check">
    <input type="checkbox" bind:checked={settings.input.computerKeyboard} onchange={saveSettings} />
    Teclado do computador como piano (A S D F… = Dó Ré Mi Fá…; W E T Y U = pretas; Z/X muda a oitava)
  </label>
  <label class="check">
    <input type="checkbox" bind:checked={settings.input.virtualKeyboard} onchange={saveSettings} />
    Mostrar teclado na tela no leitor de partitura
  </label>
  <label class="field">
    Extensão do teclado na tela
    <select bind:value={settings.input.virtualRange} onchange={saveSettings}>
      <option value="compact">Dó3–Dó6 (3 oitavas, teclas maiores)</option>
      <option value="full">Dó2–Dó7 (61 teclas, como o CTK-3500)</option>
    </select>
  </label>
</section>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .field {
    display: inline-flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  .grow {
    flex: 1;
    min-width: 14rem;
  }
  .check {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }
  .check input {
    width: 1.3rem;
    height: 1.3rem;
    margin-top: 0.1rem;
  }
  input[type='range'] {
    width: 100%;
    min-height: 2.75rem;
  }
</style>
