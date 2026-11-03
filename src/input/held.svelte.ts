// Conjunto reativo das teclas pressionadas (todas as fontes), para a UI.

import { SvelteSet } from 'svelte/reactivity';
import { HeldNotes, inputHub } from './hub';

export const heldPitches = new SvelteSet<number>();

const tracker = new HeldNotes();

inputHub.subscribe((event, source) => {
  if (event.type === 'pedal') return;
  tracker.apply(event, source);
  const now = tracker.pitches();
  for (const p of heldPitches) if (!now.has(p)) heldPitches.delete(p);
  for (const p of now) heldPitches.add(p);
});
