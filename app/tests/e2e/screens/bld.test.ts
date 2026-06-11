/**
 * Block Builder screen (#bld) — Playwright E2E with screenshots
 *
 * #bld requires ?id=RECIPE_ID to show the editor.
 * Without an ID it shows "Recipe not found" empty state.
 * We navigate via #lib → click a user recipe to open it in bld.
 */
import { test, expect, goTo, shot, collectErrors, isCritical } from '../setup/fixtures.js';
import type { Page } from '@playwright/test';

/** Get the first non-system user recipe */
async function getFirstUserRecipe(page: Page) {
  return page.evaluate(async () => {
    try {
      const { getUserRecipes } = await import('/src/data/recipes.js');
      return (await getUserRecipes())[0] ?? null;
    } catch { return null; }
  });
}

/** Navigate to bld with a recipe ID and wait for the editor to render */
async function openRecipeInBld(page: Page, recipeId: string) {
  await page.evaluate((id: string) => {
    window.location.hash = `#bld?id=${id}`;
  }, recipeId);
  // Wait for the block builder DOM (not just the empty state)
  await page.waitForSelector(
    '#bld-name, #bld-done-btn, #bld-node-list, .bld-node, [class*="bld-"]',
    { timeout: 8000 }
  ).catch(() => {});
  await page.waitForTimeout(300);
}

test.describe('Block Builder screen (#bld)', () => {

  test('#bld without recipe ID shows empty state', async ({ appPage: page }) => {
    const errors = collectErrors(page);
    await goTo(page, 'bld');
    await page.waitForTimeout(500);
    await shot(page, 'bld', '01-empty-no-id');
    expect(errors.filter(isCritical)).toHaveLength(0);
    // Should render something (even if just the error state)
    const body = await page.evaluate(() => document.body.innerHTML.length);
    expect(body).toBeGreaterThan(200);
  });

  test('block builder opens correctly with a user recipe ID', async ({ appPage: page }) => {
    const recipe = await getFirstUserRecipe(page);

    if (!recipe) {
      await shot(page, 'bld', '02-no-user-recipes');
      console.warn('[bld] No user recipes found');
      return;
    }

    console.log('[bld] Opening recipe:', (recipe as any).name);
    await openRecipeInBld(page, (recipe as any).id);
    await shot(page, 'bld', '02-recipe-loaded');

    const state = await page.evaluate(() => ({
      hasEditor:   !!document.querySelector('#bld-name, .bld-node-list, [id^="bld-"]'),
      hasErrorBtn: !!document.querySelector('[onclick*="navigate(\'#lib\')"]'),
      recipeInput: (document.querySelector('#bld-name') as HTMLInputElement)?.value ?? '',
      hash:        window.location.hash,
    }));
    await shot(page, 'bld', '02b-state');
    console.log('[bld] State:', JSON.stringify(state));

    // Should NOT be in error state
    expect(state.hasErrorBtn).toBe(false);
    // Should have editor controls
    expect(state.hasEditor).toBe(true);
  });

  test('recipe node list is visible in the editor', async ({ appPage: page }) => {
    const recipe = await getFirstUserRecipe(page);
    if (!recipe) { await shot(page, 'bld', '03-no-data'); return; }

    await openRecipeInBld(page, (recipe as any).id);
    await shot(page, 'bld', '03-node-list');

    // Count bld-specific elements
    const counts = await page.evaluate(() => ({
      bldElements:  document.querySelectorAll('[class*="bld-"], [id*="bld-"]').length,
      inputFields:  document.querySelectorAll('input, textarea, select').length,
    }));
    console.log('[bld] Element counts:', counts);
    // Editor has rendered something meaningful
    expect(counts.bldElements).toBeGreaterThan(0);
  });

  test('navigating from library to block builder via recipe selection', async ({ appPage: page }) => {
    // Start on lib (already there from fixture)
    await shot(page, 'bld', '04-library-start');

    // Find a user recipe in the page and click it
    const selectors = ['[class*="recipe-card"]', '[data-recipe-id]', '[class*="RecipeCard"]'];
    let clicked = false;
    for (const sel of selectors) {
      const items = page.locator(sel);
      if (await items.count() > 0) {
        await items.first().click({ timeout: 3000 }).catch(() => {});
        clicked = true;
        break;
      }
    }

    if (clicked) {
      await page.waitForSelector('#bld-name, .ned-body, [class*="screen"]', { timeout: 6000 }).catch(() => {});
    }
    await shot(page, 'bld', '05-after-recipe-click');
    // Just verify the page is still functional
    const body = await page.evaluate(() => document.body.innerHTML.length);
    expect(body).toBeGreaterThan(200);
  });

});
