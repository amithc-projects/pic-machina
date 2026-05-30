#!/usr/bin/env node
/**
 * ZumiLabs Studio — i18n key-validation script.
 *
 * Compares every non-English locale against en.json (the source of truth) and
 * reports keys that are missing or extra. Exits non-zero if any locale is out
 * of sync so it can gate CI / pre-commit.
 *
 * Usage:  node scripts/i18n-validate.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');
const BASE = 'en';

/** Flatten a nested object into dotted keys: { a: { b: 1 } } -> ['a.b']. */
function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.push(key);
  }
  return out;
}

function load(code) {
  return JSON.parse(readFileSync(join(LOCALES_DIR, `${code}.json`), 'utf8'));
}

const baseKeys = new Set(flatten(load(BASE)));
const locales = readdirSync(LOCALES_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace('.json', ''))
  .filter(code => code !== BASE);

let failed = false;
for (const code of locales) {
  const keys = new Set(flatten(load(code)));
  const missing = [...baseKeys].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !baseKeys.has(k));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n✗ ${code}.json out of sync with ${BASE}.json`);
    if (missing.length) {
      console.error(`  Missing ${missing.length} key(s):`);
      missing.forEach(k => console.error(`    - ${k}`));
    }
    if (extra.length) {
      console.error(`  Extra ${extra.length} key(s) (not in ${BASE}):`);
      extra.forEach(k => console.error(`    + ${k}`));
    }
  } else {
    console.log(`✓ ${code}.json — ${keys.size} keys, in sync with ${BASE}.json`);
  }
}

if (failed) {
  console.error('\ni18n validation FAILED.');
  process.exit(1);
}
console.log(`\ni18n validation passed (${baseKeys.size} keys in ${BASE}).`);
