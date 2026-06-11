/**
 * Keyboard Shortcuts screen (shc.js) — Playwright E2E with screenshots
 * Screenshots: tests/screenshots/shc/
 */

import { test, expect, goTo, shot, collectErrors, isCritical } from '../setup/fixtures.js';

test.describe('Shortcuts screen (#shc)', () => {

  test('loads without errors', async ({ appPage: page }) => {
    const errors = collectErrors(page);
    await goTo(page, 'shc');
    await shot(page, 'shc', '01-loaded');
    expect(errors.filter(isCritical)).toHaveLength(0);
  });

  test('lists keyboard shortcuts', async ({ appPage: page }) => {
    await goTo(page, 'shc');
    await page.waitForTimeout(400);
    await shot(page, 'shc', '02-shortcuts-list');
    const text = await page.evaluate(() => document.body.innerText.trim());
    expect(text.length).toBeGreaterThan(30);
  });

});
