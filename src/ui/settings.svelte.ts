// Preferências do usuário. Por enquanto em localStorage (pequenas e por
// dispositivo); o histórico de prática irá para IndexedDB no M4.

import { DEFAULT_NAMING, type PitchNaming } from '../core/pitch';

const KEY = 'piano-pratica:settings';

interface Settings {
  naming: PitchNaming;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { naming: { ...DEFAULT_NAMING, ...parsed.naming } };
    }
  } catch {
    // armazenamento indisponível (aba anônima, dados bloqueados): usa o padrão
  }
  return { naming: { ...DEFAULT_NAMING } };
}

export const settings: Settings = $state(load());

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // sem persistência; a preferência vale só para esta sessão
  }
}
