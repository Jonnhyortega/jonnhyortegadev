import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Cada test del servidor levanta un PGlite en memoria; en paralelo tarda más de 5 s.
    testTimeout: 30000,
    hookTimeout: 30000,
    // Tope de workers: cada uno carga PGlite (WASM) y argon2; sin tope se agota la memoria.
    globalSetup: ['tests/server/helpers/globalSetup.js'],
    setupFiles: ['tests/server/helpers/setup.js'],
    pool: 'forks',
    maxWorkers: 2,
  },
});
