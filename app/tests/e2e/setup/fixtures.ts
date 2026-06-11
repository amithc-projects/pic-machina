/**
 * Playwright test fixtures for E2E screen tests.
 *
 * `appPage` fixture:
 *   1. Intercepts /test-fixtures/* URLs to serve real test images from disk
 *   2. Overrides showDirectoryPicker → returns OPFS handle (no OS dialog)
 *   3. Navigates to the app and waits for DB init
 *   4. Calls importAll() to populate IDB with test-backup.json
 *   5. Fetches real test images and writes them into OPFS test-input/ folder
 *   6. Stores OPFS folder handles as the app's input/output/project_root
 *   7. Navigates to #lib to force a fresh render with populated data
 *
 * Real images are served via page.route() so the browser can fetch() them
 * without needing any Vite config changes.
 */
import { test as base, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs   from 'fs';

const SCREENSHOTS_DIR   = path.resolve('tests/screenshots');
const TEST_IMAGES_DIR   = path.resolve('tests/fixtures/test-images');
const BACKUP_JSON       = fs.readFileSync(path.resolve('tests/fixtures/test-backup.json'), 'utf8');

// Build list of test image filenames available on disk
const TEST_IMAGE_FILES = fs.readdirSync(TEST_IMAGES_DIR)
  .filter(f => /\.(png|jpe?g)$/i.test(f))
  .sort();

// ── Serve test images via page.route() ────────────────────────────────────────

async function routeTestImages(page: Page) {
  await page.route('/test-fixtures/test-images/**', async (route) => {
    const url      = route.request().url();
    const filename = decodeURIComponent(url.split('/test-fixtures/test-images/').pop() ?? '');
    const filePath = path.join(TEST_IMAGES_DIR, filename);
    if (fs.existsSync(filePath)) {
      const body        = fs.readFileSync(filePath);
      const contentType = /\.png$/i.test(filename) ? 'image/png' : 'image/jpeg';
      await route.fulfill({ body, contentType, status: 200 });
    } else {
      await route.fulfill({ status: 404 });
    }
  });
}

// ── FSA override ──────────────────────────────────────────────────────────────

async function injectFsaOverride(page: Page) {
  await page.addInitScript(() => {
    const _orig = (window as any).showDirectoryPicker?.bind(window);
    (window as any).showDirectoryPicker = async (opts?: any) => {
      try {
        const root = await navigator.storage.getDirectory();
        const id   = opts?.id ?? '';
        if (id === 'output' || opts?.startIn === 'output') {
          return root.getDirectoryHandle('test-output', { create: true });
        }
        return root.getDirectoryHandle('test-input', { create: true });
      } catch {
        return _orig?.(opts);
      }
    };
  });
}

// ── IDB + OPFS setup ──────────────────────────────────────────────────────────

async function setupTestData(page: Page, backupJson: string, imageFiles: string[]) {
  await page.evaluate(async ({ json, images }: { json: string; images: string[] }) => {
    try {
      // 1. Import test recipes/blocks into IDB
      const { importAll } = await import('/src/utils/backup.js');
      await importAll({ text: async () => json } as any, { wipeFirst: false, silent: true });

      // 2. Create OPFS directories
      const opfsRoot  = await navigator.storage.getDirectory();
      const inputDir  = await opfsRoot.getDirectoryHandle('test-input',  { create: true });
      const outputDir = await opfsRoot.getDirectoryHandle('test-output', { create: true });

      // 3. Fetch real test images from the intercepted route and write into OPFS
      for (const filename of images) {
        try {
          const resp = await fetch(`/test-fixtures/test-images/${filename}`);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const fh   = await inputDir.getFileHandle(filename, { create: true });
          const wr   = await fh.createWritable();
          await wr.write(blob);
          await wr.close();
        } catch (imgErr) {
          console.warn('[e2e] Failed to write image:', filename, imgErr);
        }
      }

      // 4. Register handles in the app's IDB 'folders' store
      const { initDB, dbPut } = await import('/src/data/db.js');
      await initDB();
      await dbPut('folders', { key: 'input',        handle: inputDir  });
      await dbPut('folders', { key: 'output',       handle: outputDir });
      await dbPut('folders', { key: 'project_root', handle: opfsRoot  });

      console.info(`[e2e] Setup complete: ${images.length} images in OPFS test-input/`);
    } catch (err) {
      console.warn('[e2e-fixture] setupTestData failed:', err);
    }
  }, { json: backupJson, images: imageFiles });
}

// ── Custom `test` with `appPage` fixture ──────────────────────────────────────

type AppFixtures = { appPage: Page };

export const test = base.extend<AppFixtures>({
  appPage: async ({ page }, use) => {
    // 1. Route test images before any navigation
    await routeTestImages(page);

    // 2. Override showDirectoryPicker before page JS runs
    await injectFsaOverride(page);

    // 3. Load the app and wait for DB to initialise
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 4. Inject recipes, blocks, and real images into IDB + OPFS
    await setupTestData(page, BACKUP_JSON, TEST_IMAGE_FILES);

    // 5. Navigate to the library — forces a re-render with fresh IDB data.
    //    We must use page.goto() here (initial setup), then use goTo()
    //    (hash-only change) for all subsequent navigations within tests.
    await page.goto('http://localhost:5173/#lib', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // 6. Hand the page to the test
    await use(page);
  },
});

export { expect };

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Navigate within the app's SPA by changing window.location.hash.
 * Preserves IDB data — does NOT do a full page reload.
 * Waits for the screen container to update (ViewTransition-safe).
 */
export async function goTo(page: Page, hash: string) {
  await page.evaluate((h: string) => { window.location.hash = '#' + h; }, hash);
  // Wait for the screen container to have rendered content
  await page.waitForSelector('#screen-container > *', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(300);
}

export async function shot(page: Page, screen: string, step: string): Promise<string> {
  const dir      = path.join(SCREENSHOTS_DIR, screen);
  const filePath = path.join(dir, `${step}.png`);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console',   msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

export function isCritical(msg: string): boolean {
  const noise = [
    'service-worker', 'favicon', '[vite]',
    'unsupported MIME type', 'Failed to load resource',
    'Cross-Origin', 'WebSocket',
  ];
  return !noise.some(n => msg.includes(n));
}
