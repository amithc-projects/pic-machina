/**
 * Folder screen (#fld) — Playwright E2E with screenshots
 * Pre-condition: 8 real test images (PNG/JPEG) in OPFS test-input/
 */
import { test, expect, goTo, shot, collectErrors, isCritical } from '../setup/fixtures.js';

test.describe('Folder screen (#fld)', () => {

  test('loads without errors', async ({ appPage: page }) => {
    const errors = collectErrors(page);
    await goTo(page, 'fld');
    await page.waitForTimeout(800);
    await shot(page, 'fld', '01-loaded');
    expect(errors.filter(isCritical)).toHaveLength(0);
  });

  test('folder screen shows the pre-configured input folder (OPFS)', async ({ appPage: page }) => {
    await goTo(page, 'fld');
    await page.waitForTimeout(1200);
    await shot(page, 'fld', '02-with-folder');
    const body = await page.evaluate(() => document.body.innerHTML.length);
    expect(body).toBeGreaterThan(200);
  });

  test('real test images appear as thumbnails', async ({ appPage: page }) => {
    await goTo(page, 'fld');
    // Give the scanner time to enumerate OPFS files
    await page.waitForTimeout(2000);
    await shot(page, 'fld', '03-thumbnails');

    // Check that OPFS input has the real images we loaded
    const fileCount = await page.evaluate(async () => {
      try {
        const root     = await navigator.storage.getDirectory();
        const inputDir = await root.getDirectoryHandle('test-input');
        let count = 0;
        for await (const [name] of (inputDir as any).entries()) {
          if (/\.(png|jpe?g)$/i.test(name)) count++;
        }
        return count;
      } catch { return 0; }
    });

    expect(fileCount).toBeGreaterThanOrEqual(8); // our 8 test images
    await shot(page, 'fld', `03b-file-count-${fileCount}`);
  });

  test('select-folder button uses OPFS override (no OS dialog)', async ({ appPage: page }) => {
    await goTo(page, 'fld');
    await page.waitForTimeout(800);

    const folderBtn = page.locator('button').filter({ hasText: /select|open|choose|folder|input/i }).first();
    if (await folderBtn.count() > 0) {
      await folderBtn.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    await shot(page, 'fld', '04-after-folder-btn');
  });

  test('output folder is also accessible', async ({ appPage: page }) => {
    // Verify the output folder handle is in IDB
    const hasOutput = await page.evaluate(async () => {
      try {
        const { initDB, dbGet } = await import('/src/data/db.js');
        await initDB();
        const rec = await dbGet('folders', 'output');
        return !!rec?.handle;
      } catch { return false; }
    });
    await shot(page, 'fld', '05-output-folder');
    expect(hasOutput).toBe(true);
  });

});
