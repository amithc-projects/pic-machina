#!/usr/bin/env node
/**
 * ZumiLabs Studio — seed missing DE keys from EN.
 *
 * For every key present in en.json but missing from de.json, copy the English
 * value across as a placeholder (so the app stays functional in `de` and
 * i18n:validate passes). Existing German translations are preserved — this
 * only ADDS missing keys, never overwrites.
 *
 * Run after extracting new strings into en.json:
 *   node scripts/i18n-seed-de.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');

const en = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8'));
const de = JSON.parse(readFileSync(join(LOCALES_DIR, 'de.json'), 'utf8'));

let added = 0;

/** Recursively merge en into de, only filling keys de is missing. */
function seed(src, dst) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {};
      seed(v, dst[k]);
    } else if (!(k in dst)) {
      dst[k] = v; // English placeholder
      added++;
    }
  }
}

seed(en, de);
writeFileSync(join(LOCALES_DIR, 'de.json'), JSON.stringify(de, null, 2) + '\n', 'utf8');
console.log(`Seeded ${added} missing DE key(s) from EN.`);
