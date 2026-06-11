/**
 * Shared helpers for per-screen Playwright tests.
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.resolve('tests/screenshots');

/** Navigate to a hash route and wait for the page to settle */
export async function goTo(page: Page, hash: string) {
  await page.goto(`/#${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}

/** Save a named screenshot to tests/screenshots/{screen}/{name}.png */
export async function shot(page: Page, screen: string, name: string) {
  const dir = path.join(SCREENSHOTS_DIR, screen);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

/** Filter out dev-mode noise from console errors */
export function isCritical(msg: string): boolean {
  const noise = [
    'service-worker', 'favicon', '[vite]',
    'unsupported MIME type', 'Failed to load resource',
    'Cross-Origin', 'WebSocket',
  ];
  return !noise.some(n => msg.includes(n));
}

/** Collect console errors on a page */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

/** Assert no critical errors and screenshot the current state */
export async function assertClean(page: Page, errors: string[], screen: string, step: string) {
  const criticals = errors.filter(isCritical);
  await shot(page, screen, step);
  expect(criticals, `${screen}/${step} had errors:\n${criticals.join('\n')}`).toHaveLength(0);
}
