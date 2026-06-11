/**
 * E2E-001 to E2E-016 — Smoke tests
 * Requires the Vite dev server running on http://localhost:5173
 * Run with: npx playwright test
 */
import { test, expect } from '@playwright/test';

/** Filter out known non-critical dev-mode noise */
function isCritical(msg: string): boolean {
  const noise = [
    'service-worker', 'favicon', '[vite]',
    // Vite dev server warmup: some modules serve as HTML before JS is ready
    'unsupported MIME type',
    // PWA manifest / icon 404s in dev
    'Failed to load resource',
    // Chromium CORS preflight noise
    'Cross-Origin',
    // Known Vite HMR overlay
    'WebSocket',
  ];
  return !noise.some(n => msg.includes(n));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Navigate to a hash route and wait for network to be idle */
async function goTo(page: import('@playwright/test').Page, hash: string) {
  await page.goto(`/#${hash}`, { waitUntil: 'networkidle' });
  // Small settle time for JS routing
  await page.waitForTimeout(300);
}

/** Collect all console errors during a page visit */
async function collectErrors(page: import('@playwright/test').Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

// ── E2E-001: App loads without JS errors ────────────────────────────────────

test('E2E-001: app loads without JavaScript errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const criticalErrors = errors.filter(isCritical);
  expect(criticalErrors, `Console errors: ${criticalErrors.join('\n')}`).toHaveLength(0);
});

// ── E2E-002: Landing screen is visible ──────────────────────────────────────

test('E2E-002: main UI renders on load', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  // The app should have SOME visible content — at minimum a nav element
  const hasContent = await page.evaluate(() =>
    document.body.children.length > 0 &&
    document.body.innerHTML.trim().length > 100
  );
  expect(hasContent).toBe(true);
});

// ── E2E-003 to E2E-014: Each major screen loads without error ────────────────

const SCREENS = [
  { id: 'E2E-003', hash: 'fld', name: 'Folder screen' },
  { id: 'E2E-004', hash: 'ned', name: 'Node editor' },
  { id: 'E2E-005', hash: 'lib', name: 'Recipe library' },
  { id: 'E2E-007', hash: 'bld', name: 'Build screen' },
  { id: 'E2E-008', hash: 'que', name: 'Queue screen' },
  { id: 'E2E-009', hash: 'set', name: 'Settings screen' },
  { id: 'E2E-011', hash: 'mdl', name: 'Models screen' },
  { id: 'E2E-012', hash: 'tme', name: 'Timeline screen' },
  { id: 'E2E-013', hash: 'hlp', name: 'Help screen' },
  { id: 'E2E-014', hash: 'shc', name: 'Shortcuts screen' },
];

for (const { id, hash, name } of SCREENS) {
  test(`${id}: ${name} (#${hash}) loads without critical errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await goTo(page, hash);

    // Page must have rendered body content
    const bodyText = await page.evaluate(() => document.body.innerHTML.length);
    expect(bodyText).toBeGreaterThan(100);

    const criticalErrors = errors.filter(isCritical);
    expect(criticalErrors, `${name} had errors:\n${criticalErrors.join('\n')}`).toHaveLength(0);
  });
}

// ── E2E-015: Full navigation round-trip ─────────────────────────────────────

test('E2E-015: full navigation round-trip — all screens render without crashing', async ({ page }) => {
  const allErrors: string[] = [];
  page.on('pageerror', err => allErrors.push(`[pageerror] ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') allErrors.push(`[console] ${msg.text()}`);
  });

  const hashes = ['lib', 'fld', 'ned', 'bld', 'que', 'set', 'mdl', 'tme', 'hlp'];
  for (const hash of hashes) {
    await goTo(page, hash);
    const len = await page.evaluate(() => document.body.innerHTML.length);
    expect(len, `Screen #${hash} rendered empty body`).toBeGreaterThan(100);
  }

  const criticalErrors = allErrors.filter(isCritical);
  expect(criticalErrors, `Navigation errors:\n${criticalErrors.join('\n')}`).toHaveLength(0);
});

// ── E2E-016: App starts cleanly with no stored data ─────────────────────────

test('E2E-016: app starts cleanly with cleared storage', async ({ browser }) => {
  // Use a fresh browser context with no prior IndexedDB / localStorage
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const criticalErrors = errors.filter(isCritical);
  expect(criticalErrors, `Errors on fresh start: ${criticalErrors.join('\n')}`).toHaveLength(0);

  await context.close();
});
