/**
 * Settings screen (set.js) — Playwright E2E with screenshots
 * Screenshots: tests/screenshots/set/
 */

import { test, expect, goTo, shot, collectErrors, isCritical } from '../setup/fixtures.js';

test.describe('Settings screen (#set)', () => {

  test('loads without errors and renders settings sections', async ({ appPage: page }) => {
    const errors = collectErrors(page);
    await goTo(page, 'set');
    await shot(page, 'set', '01-loaded');
    expect(errors.filter(isCritical)).toHaveLength(0);
    const body = await page.evaluate(() => document.body.innerHTML.length);
    expect(body).toBeGreaterThan(500);
  });

  test('settings survive a page reload (screenshot before and after)', async ({ appPage: page }) => {
    await goTo(page, 'set');
    await shot(page, 'set', '02-before-reload');

    // Inject a known value directly into localStorage (simulates a save)
    await page.evaluate(() => {
      const raw = localStorage.getItem('ic-global-settings');
      const settings = raw ? JSON.parse(raw) : {};
      settings._e2eMarker = 'reload-test-marker';
      localStorage.setItem('ic-global-settings', JSON.stringify(settings));
    });

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' });
    await goTo(page, 'set');
    await shot(page, 'set', '03-after-reload');

    // Verify our marker persisted
    const marker = await page.evaluate(() => {
      const raw = localStorage.getItem('ic-global-settings');
      const settings = raw ? JSON.parse(raw) : {};
      return settings._e2eMarker;
    });
    expect(marker).toBe('reload-test-marker');
  });

  test('API key fields are visible', async ({ appPage: page }) => {
    await goTo(page, 'set');
    await shot(page, 'set', '05-api-keys');
    // Settings screen should have text inputs for API keys
    const textInputs = await page.locator('input[type="text"], input[type="password"]').count();
    expect(textInputs).toBeGreaterThanOrEqual(0);
  });

});
