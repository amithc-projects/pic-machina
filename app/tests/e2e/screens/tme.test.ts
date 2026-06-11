/**
 * Timeline editor screen (tme.js) — Playwright E2E with screenshots
 * Screenshots: tests/screenshots/tme/
 */

import { test, expect, goTo, shot, collectErrors, isCritical } from '../setup/fixtures.js';

test.describe('Timeline screen (#tme)', () => {

  test('loads without errors', async ({ appPage: page }) => {
    const errors = collectErrors(page);
    await goTo(page, 'tme');
    await page.waitForTimeout(500);
    await shot(page, 'tme', '01-loaded');
    expect(errors.filter(isCritical)).toHaveLength(0);
  });

  test('timeline editor UI renders', async ({ appPage: page }) => {
    await goTo(page, 'tme');
    await page.waitForTimeout(500);
    await shot(page, 'tme', '02-editor');
    const body = await page.evaluate(() => document.body.innerHTML.length);
    expect(body).toBeGreaterThan(200);
  });

  test('create new timeline button or empty state is present', async ({ appPage: page }) => {
    await goTo(page, 'tme');
    await page.waitForTimeout(500);
    await shot(page, 'tme', '03-new-timeline');
    const buttons = await page.locator('button').count();
    expect(buttons).toBeGreaterThanOrEqual(1);
  });

});
