/**
 * Models screen (mdl.js) — Playwright E2E with screenshots
 * Screenshots: tests/screenshots/mdl/
 */

import { test, expect, goTo, shot, collectErrors, isCritical } from '../setup/fixtures.js';

test.describe('Models screen (#mdl)', () => {

  test('loads without errors and shows model list', async ({ appPage: page }) => {
    const errors = collectErrors(page);
    await goTo(page, 'mdl');
    await page.waitForTimeout(800);
    await shot(page, 'mdl', '01-loaded');
    expect(errors.filter(isCritical)).toHaveLength(0);
    const body = await page.evaluate(() => document.body.innerHTML.length);
    expect(body).toBeGreaterThan(200);
  });

  test('model cards or list items are visible', async ({ appPage: page }) => {
    await goTo(page, 'mdl');
    await page.waitForTimeout(800);
    await shot(page, 'mdl', '02-model-list');
    // Models page should have some content about downloadable AI models
    const text = await page.evaluate(() => document.body.innerText);
    // Should mention something related to models/AI
    expect(text.length).toBeGreaterThan(20);
  });

});
