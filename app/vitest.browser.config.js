import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  // Reuse the app's Vite server config for proper WASM/COEP headers
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  test: {
    // Run in a real Chromium browser via Playwright
    browser: {
      enabled: true,
      provider: playwright({ launch: { headless: true } }),
      headless: true,
      instances: [
        { browser: 'chromium' },
      ],
    },

    // Only the browser-specific test files
    include: ['tests/browser/**/*.test.{js,ts}'],

    // No setupFiles needed — real browser has everything
    setupFiles: [],

    // Give WASM transforms more time to load
    testTimeout: 30_000,

    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: [
        'src/engine/vendor/**',
        'src/screens/**',   // covered by Playwright E2E
        'src/main.js',
        'src/eval.js',
      ],
      reporter: ['text', 'lcov'],
    },
  },
});
