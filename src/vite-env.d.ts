/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** SHA do commit, definido pelo CI no build. */
  readonly VITE_COMMIT?: string;
}

/** Data/hora do build (definida em vite.config.ts). */
declare const __BUILD_TIME__: string;
