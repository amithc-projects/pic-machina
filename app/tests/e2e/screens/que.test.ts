/**
 * Queue / Run history screen (que.js) — Playwright E2E with screenshots
 * Screenshots: tests/screenshots/que/
 */

import { test, expect, goTo, shot, collectErrors, isCritical } from '../setup/fixtures.js';

test.describe('Queue screen (#que)', () => {

  test('loads without errors', async ({ appPage: page }) => {
    const errors = collectErrors(page);
    await goTo(page, 'que');
    await shot(page, 'que', '01-loaded');
    expect(errors.filter(isCritical)).toHaveLength(0);
  });

  test('shows empty state or run list', async ({ appPage: page }) => {
    await goTo(page, 'que');
    await page.waitForTimeout(400);
    await shot(page, 'que', '02-run-list');
    const body = await page.evaluate(() => document.body.innerHTML.length);
    expect(body).toBeGreaterThan(100);
  });

});
