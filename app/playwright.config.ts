import { defineConfig, devices } from '@playwright/test';
import { STORAGE_STATE_PATH } from './tests/e2e/setup/global-setup.js';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1, // single worker — shared IndexedDB/OPFS state

  reporter: [['line'], ['html', { open: 'never', outputFolder: 'tests/playwright-report' }]],

  // ── Global setup: import test data once before all tests ──────────────────
  globalSetup: './tests/e2e/setup/global-setup.ts',

  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'on',
    video: 'retain-on-failure',

    // Every test starts with the pre-populated IndexedDB + localStorage
    storageState: STORAGE_STATE_PATH,
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true, // always reuse — global-setup starts the app
    timeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
