// Service worker (PWA): registra, avisa quando o app está pronto para uso
// offline e quando há uma versão nova (o usuário decide quando recarregar,
// para não interromper uma sessão de prática).

import { registerSW } from 'virtual:pwa-register';

export const pwa = $state({ needRefresh: false, offlineReady: false });

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export function initPwa(): void {
  if (updateSW) return;
  updateSW = registerSW({
    onNeedRefresh: () => (pwa.needRefresh = true),
    onOfflineReady: () => (pwa.offlineReady = true),
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // o tablet deixa o app aberto por dias: procura versão nova ao voltar para ele
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine)
          void registration.update().catch(() => {});
      });
    },
  });
}

/** Ativa a versão nova e recarrega a página. */
export const applyUpdate = () => updateSW?.(true);
