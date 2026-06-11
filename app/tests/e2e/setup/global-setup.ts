/**
 * Playwright Global Setup — runs ONCE before all tests.
 *
 * Saves a storage state (localStorage + cookies) with test settings
 * pre-configured. IDB data is injected per-test by the `appPage` fixture
 * because storageState does not persist IndexedDB.
 */
import { chromium, FullConfig } from '@playwright/test';
import * as path from 'path';

export const STORAGE_STATE_PATH = path.resolve('tests/e2e/setup/storage-state.json');

export default async function globalSetup(_config: FullConfig) {
  console.log('[global-setup] Preparing localStorage settings...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(800);

  // Pre-configure settings in localStorage so every test starts with clean defaults
  await page.evaluate(() => {
    localStorage.setItem('ic-global-settings', JSON.stringify({
      license: 'Free',
      _e2eTestMode: true,
      telemetry:    { enabled: false, endpoint: '' },
      batch:        { useInputForOutput: false },
      thumbnails:   { smart: false },
      ai:           { describerEndpoint: '' },
      pexels:       { apiKey: '' },
      unsplash:     { accessKey: '' },
      pixabay:      { apiKey: '' },
      elevenlabs:   { apiKey: '' },
      localTts:     { url: '' },
      capabilities: { htmlInCanvasConfirmed: false },
    }));
  });

  // Save just the localStorage/cookies state
  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();

  console.log('[global-setup] Storage state saved to', STORAGE_STATE_PATH);
}
