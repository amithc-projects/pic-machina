/**
 * Help screen (hlp.js) — Playwright E2E with screenshots
 * Screenshots: tests/screenshots/hlp/
 */

import { test, expect, goTo, shot, collectErrors, isCritical } from '../setup/fixtures.js';

test.describe('Help screen (#hlp)', () => {

  test('loads without errors', async ({ appPage: page }) => {
    const errors = collectErrors(page);
    await goTo(page, 'hlp');
    await shot(page, 'hlp', '01-loaded');
    expect(errors.filter(isCritical)).toHaveLength(0);
  });

  test('displays help content', async ({ appPage: page }) => {
    await goTo(page, 'hlp');
    await page.waitForTimeout(500);
    await shot(page, 'hlp', '02-content');
    const text = await page.evaluate(() => document.body.innerText.trim());
    expect(text.length).toBeGreaterThan(30);
  });

});
