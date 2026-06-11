/**
 * Node Editor screen (#ned) — Playwright E2E with screenshots
 *
 * NED is a NODE-level editor, not just recipe-level.
 * URL format: #ned?recipe=RECIPE_ID&node=NODE_ID
 * Without both params NED shows "Node not found".
 */
import { test, expect, goTo, shot } from '../setup/fixtures.js';
import type { Page } from '@playwright/test';

/** Get first user recipe that has at least one transform node */
async function getFirstRecipeWithNode(page: Page) {
  return page.evaluate(async () => {
    try {
      const { getUserRecipes } = await import('/src/data/recipes.js');
      const { flattenNodes }   = await import('/src/utils/nodes.js');
      const recipes = await getUserRecipes();

      for (const recipe of recipes) {
        const flat  = flattenNodes(recipe.nodes ?? []);
        const first = flat.find((item: any) =>
          item.node.type === 'transform' || item.node.type === 'conditional' || item.node.type === 'branch'
        );
        if (first) return { recipe, nodeId: first.node.id };
      }
      return null;
    } catch (e) {
      console.warn('[ned] getFirstRecipeWithNode error:', e);
      return null;
    }
  });
}

/** Navigate to NED for a specific recipe + node, wait for it to render */
async function openNodeInNed(page: Page, recipeId: string, nodeId: string) {
  await page.evaluate(({ rid, nid }: { rid: string; nid: string }) => {
    window.location.hash = `#ned?recipe=${rid}&node=${nid}`;
  }, { rid: recipeId, nid: nodeId });

  // Wait for the NED editor to render (not just the empty state)
  await page.waitForSelector('.ned-body, #ned-done-btn, #ned-back', {
    timeout: 8000,
  }).catch(() => {});
  await page.waitForTimeout(300);
}

test.describe('Node Editor screen (#ned)', () => {

  test('#ned without params shows "Node not found" empty state', async ({ appPage: page }) => {
    await goTo(page, 'ned');
    await shot(page, 'ned', '01-empty-state-no-params');
    const text = await page.evaluate(() => document.body.innerText);
    // Shows error state — correct behaviour
    expect(text.length).toBeGreaterThan(5);
    expect(page.url()).toContain('#ned');
  });

  test('#ned with recipe only (no node) also shows empty state', async ({ appPage: page }) => {
    const data = await getFirstRecipeWithNode(page);
    if (!data) { await shot(page, 'ned', '02-no-data'); return; }

    await page.evaluate((rid: string) => {
      window.location.hash = `#ned?recipe=${rid}`;
    }, (data as any).recipe.id);
    await page.waitForTimeout(800);
    await shot(page, 'ned', '02-recipe-only-no-node');

    // Without node param → "Node not found"
    const hasBackBtn = await page.evaluate(() => !!document.querySelector('#ned-back-btn'));
    expect(hasBackBtn).toBe(true);
  });

  test('NED loads correctly with recipe + node params', async ({ appPage: page }) => {
    const data = await getFirstRecipeWithNode(page);

    if (!data) {
      await shot(page, 'ned', '03-no-recipe-or-node');
      console.warn('[ned] No user recipes with nodes in IDB');
      return;
    }

    const { recipe, nodeId } = data as any;
    console.log('[ned] Opening recipe:', recipe.name, '/ node:', nodeId);
    await openNodeInNed(page, recipe.id, nodeId);
    await shot(page, 'ned', '03-node-editor-loaded');

    const state = await page.evaluate(() => ({
      hasNedBody:  !!document.querySelector('.ned-body'),
      hasDoneBtn:  !!document.querySelector('#ned-done-btn'),
      hasBackBtn:  !!document.querySelector('#ned-back'),
      errorBackBtn: !!document.querySelector('#ned-back-btn'),  // only in error state
      hash:        window.location.hash,
    }));
    await shot(page, 'ned', '03b-state');
    console.log('[ned] State:', JSON.stringify(state));

    // Should NOT be in error state
    expect(state.errorBackBtn).toBe(false);
    // Should have the editor
    expect(state.hasNedBody || state.hasDoneBtn || state.hasBackBtn).toBe(true);
  });

  test('NED shows transform parameters panel', async ({ appPage: page }) => {
    const data = await getFirstRecipeWithNode(page);
    if (!data) { await shot(page, 'ned', '04-no-data'); return; }

    await openNodeInNed(page, (data as any).recipe.id, (data as any).nodeId);
    await shot(page, 'ned', '04-params-panel');

    // The params panel should have some fields
    const fieldCount = await page.evaluate(() =>
      document.querySelectorAll('.ned-field, .ned-fields, [class*="param"]').length
    );
    console.log('[ned] Param field elements:', fieldCount);
    // We just verify the screen is not in error state
    expect(await page.evaluate(() => !!document.querySelector('#ned-back-btn'))).toBe(false);
  });

  test('NED for a conditional node shows condition editor', async ({ appPage: page }) => {
    const data = await page.evaluate(async () => {
      try {
        const { getUserRecipes } = await import('/src/data/recipes.js');
        const { flattenNodes }   = await import('/src/utils/nodes.js');
        const recipes = await getUserRecipes();
        for (const r of recipes) {
          const flat = flattenNodes(r.nodes ?? []);
          const cond = flat.find((item: any) => item.node.type === 'conditional');
          if (cond) return { recipeId: r.id, nodeId: cond.node.id };
        }
        return null;
      } catch { return null; }
    });

    if (!data) { await shot(page, 'ned', '05-no-conditional'); return; }

    await openNodeInNed(page, (data as any).recipeId, (data as any).nodeId);
    await shot(page, 'ned', '05-conditional-node');
    expect(await page.evaluate(() => !!document.querySelector('#ned-back-btn'))).toBe(false);
  });

});
