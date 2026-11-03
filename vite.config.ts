import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// GitHub Pages serve o site em https://<usuario>.github.io/piano-pratica/
const PAGES_BASE = '/piano-pratica/';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [svelte()],
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
