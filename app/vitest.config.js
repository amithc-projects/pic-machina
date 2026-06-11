import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Run unit and integration tests in Node — fast, no browser overhead
    environment: 'node',

    // Only pick up tests/unit and tests/integration — exclude Playwright e2e files
    include: ['tests/unit/**/*.test.{js,ts}', 'tests/integration/**/*.test.{js,ts}'],

    // Silence the localStorage-not-defined warning from db.js legacy migration path
    setupFiles: ['./tests/mocks/node-globals.js'],

    pool: 'forks',

    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/engine/vendor/**', 'src/**/*.css'],
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      // Replace Photon WASM with a no-op stub so color transforms load in Node
      './vendor/photon/photon_rs.js':  resolve('./tests/mocks/photon-stub.js'),
      '../vendor/photon/photon_rs.js': resolve('./tests/mocks/photon-stub.js'),

      // WASM URL imports — return empty string (never actually loaded)
      './vendor/photon/photon_rs_bg.wasm?url': resolve('./tests/mocks/empty-url.js'),
    },
  },
});
