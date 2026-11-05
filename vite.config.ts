import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// GitHub Pages serve o site em https://<usuario>.github.io/piano-pratica/
const PAGES_BASE = '/piano-pratica/';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [
    svelte(),
    // Service worker (só no build): guarda o app, os pedaços do leitor e do treino e a
    // biblioteca para funcionar offline. Versão nova = aviso "Atualizar" (registerSW em App).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // os ícones já entram pelo globPatterns abaixo
      includeManifestIcons: false,
      manifest: {
        name: 'Piano Prática',
        short_name: 'Piano',
        description: 'Leitor de partitura com modo espera via MIDI e treino de leitura.',
        lang: 'pt-BR',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f4ef',
        theme_color: '#2f6fb3',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,musicxml}'],
        // o pedaço do leitor (OSMD) tem ~1,4 MB; o limite padrão é 2 MiB
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    // O chunk do leitor contém o OSMD (~1,4 MB, ~370 kB gzip) e só é baixado ao abrir uma partitura.
    chunkSizeWarningLimit: 1600,
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
