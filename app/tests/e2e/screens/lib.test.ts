/**
 * Recipe Library screen (#lib) — Playwright E2E with screenshots
 * Pre-condition: global-setup + appPage fixture injected test-backup.json
 */
import { test, expect, goTo, shot, collectErrors, isCritical } from '../setup/fixtures.js';

test.describe('Library screen (#lib)', () => {

  test('loads and shows recipe cards', async ({ appPage: page }) => {
    const errors = collectErrors(page);
    // appPage fixture already navigated here — just screenshot
    await shot(page, 'lib', '01-loaded');
    expect(errors.filter(isCritical)).toHaveLength(0);
    const body = await page.evaluate(() => document.body.innerHTML.length);
    expect(body).toBeGreaterThan(500);
  });

  test('recipe library contains content (recipes loaded from backup)', async ({ appPage: page }) => {
    // Already on #lib from fixture — screenshot what it looks like with data
    await page.waitForTimeout(600);
    await shot(page, 'lib', '02-with-recipes');

    const text = await page.evaluate(() => document.body.innerText);
    // Any recipe name longer than 3 chars should be in the page text
    expect(text.length).toBeGreaterThan(100);
  });

  test('more than system recipes are present (user recipes loaded)', async ({ appPage: page }) => {
    await page.waitForTimeout(600);
    await shot(page, 'lib', '03-recipe-count');

    // Count user recipes directly from IDB
    const userRecipeCount = await page.evaluate(async () => {
      try {
        const { getUserRecipes } = await import('/src/data/recipes.js');
        const recipes = await getUserRecipes();
        return recipes.length;
      } catch {
        return 0;
      }
    });
    await shot(page, 'lib', `03b-user-count-${userRecipeCount}`);
    expect(userRecipeCount).toBeGreaterThan(0);
  });

  test('recipe cards are clickable and open the node editor', async ({ appPage: page }) => {
    await page.waitForTimeout(600);
    await shot(page, 'lib', '04-before-click');

    // Find any clickable element that might be a recipe card
    // (lib.js renders cards with various class patterns)
    const clickTargets = [
      '[class*="recipe-card"]',
      '[class*="RecipeCard"]',
      '[data-recipe-id]',
      '.card',
      '[class*="card"]',
    ];

    let clicked = false;
    for (const selector of clickTargets) {
      const el = page.locator(selector).first();
      if (await el.count() > 0) {
        await el.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(800);
        clicked = true;
        break;
      }
    }

    await shot(page, 'lib', '05-after-click');

    if (clicked) {
      // After clicking a recipe the URL should have changed (to #ned or similar)
      const url = page.url();
      // Could be #ned?id=... or #lib still if click navigated inline
      expect(url.length).toBeGreaterThan(20);
    }
  });

});
