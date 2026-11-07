<script lang="ts">
  // Diário do treino: texto livre por dia, salvo sozinho enquanto se digita,
  // com a lista do que foi feito no dia para ajudar a lembrar.
  import { onDestroy } from 'svelte';
  import { appHistory } from '../../storage/history';
  import { daySummary, type Activity } from '../../trail/activity';
  import { shortDay } from '../../trail/dates';
  import { trail } from '../trail.svelte';

  let { activity }: { activity: Activity | null } = $props();

  const PLACEHOLDER =
    'Como foi o treino? O que fluiu, o que travou, em que música ou exercício, o que quer tentar amanhã…';

  let day = $state(trail.day);
  let text = $state('');
  let loaded = $state(false);
  let status = $state('');
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const d = day;
    loaded = false;
    void appHistory()
      .diaryEntry(d)
      .then((e) => {
        if (d !== day) return;
        text = e?.text ?? '';
        status = e ? 'Já tem anotação deste dia.' : '';
        loaded = true;
      })
      .catch((err: unknown) => {
        status = `Não consegui ler o diário: ${String(err)}`;
        loaded = true;
      });
  });

  function onInput() {
    dirty = true;
    status = 'Salvando…';
    clearTimeout(timer);
    timer = setTimeout(save, 1200);
  }

  function save() {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    const d = day;
    appHistory()
      .saveDiary({ id: d, text: text.slice(0, 20_000), updatedAt: Date.now() })
      .then(() => {
        const n = new Date();
        status = `Salvo às ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
      })
      .catch(() => {
        dirty = true;
        status = 'Não salvou. Continue escrevendo que tento de novo.';
      });
  }

  function changeDay(v: string) {
    if (!v || v > trail.day) return;
    save();
    day = v;
  }

  const reminders = $derived(activity ? daySummary(trail.s!, activity, day) : []);

  const onHidden = () => document.visibilityState === 'hidden' && save();
  document.addEventListener('visibilitychange', onHidden);
  onDestroy(() => {
    save();
    document.removeEventListener('visibilitychange', onHidden);
  });
</script>

<section class="card diary">
  <div class="head">
    <h2>Diário do treino</h2>
    <label class="day">
      Dia
      <input
        type="date"
        value={day}
        max={trail.day}
        onchange={(e) => changeDay((e.currentTarget as HTMLInputElement).value)}
      />
    </label>
  </div>
  {#if reminders.length}
    <div>
      <span class="label"
        >Para lembrar o que você fez {day === trail.day ? 'hoje' : 'em ' + shortDay(day)}</span
      >
      <ul>
        {#each reminders as r, i (i)}<li>{r}</li>{/each}
      </ul>
    </div>
  {/if}
  <textarea
    bind:value={text}
    oninput={onInput}
    disabled={!loaded}
    placeholder={loaded ? PLACEHOLDER : 'Carregando…'}></textarea>
  <span class="muted small">{status}</span>
</section>

<style>
  .diary {
    display: grid;
    gap: 0.6rem;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
  }
  .day {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.9rem;
  }
  .label {
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--muted);
  }
  ul {
    margin: 0.2rem 0 0;
    padding-left: 1.2rem;
    font-size: 0.9rem;
    color: var(--muted);
  }
  textarea {
    min-height: 12rem;
    line-height: 1.55;
  }
  .small {
    font-size: 0.85rem;
  }
</style>
