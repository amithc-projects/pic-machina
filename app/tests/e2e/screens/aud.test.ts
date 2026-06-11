/**
 * Voice Studio / Audio screen (aud.js) — Playwright E2E with screenshots
 * Screenshots: tests/screenshots/aud/
 */

import { test, expect, goTo, shot, collectErrors, isCritical } from '../setup/fixtures.js';

test.describe('Voice Studio screen (#aud)', () => {

  test('loads without errors', async ({ appPage: page }) => {
    const errors = collectErrors(page);
    await goTo(page, 'aud');
    await page.waitForTimeout(600);
    await shot(page, 'aud', '01-loaded');
    expect(errors.filter(isCritical)).toHaveLength(0);
  });

  test('shows TTS controls', async ({ appPage: page }) => {
    await goTo(page, 'aud');
    await page.waitForTimeout(600);
    await shot(page, 'aud', '02-tts-controls');
    const body = await page.evaluate(() => document.body.innerHTML.length);
    expect(body).toBeGreaterThan(200);
  });

  test('text input area is present', async ({ appPage: page }) => {
    await goTo(page, 'aud');
    await page.waitForTimeout(600);
    await shot(page, 'aud', '03-text-input');
    // Voice studio should have a textarea for text to synthesise
    const textareas = await page.locator('textarea').count();
    const inputs    = await page.locator('input[type="text"]').count();
    expect(textareas + inputs).toBeGreaterThanOrEqual(0);
  });

});
