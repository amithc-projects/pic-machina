import { describe, test, expect, beforeEach } from 'vitest';

// settings.js uses localStorage — simulate it with a simple in-memory store
const _store = {};
global.localStorage = {
  getItem: (k) => _store[k] ?? null,
  setItem: (k, v) => { _store[k] = v; },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { Object.keys(_store).forEach(k => delete _store[k]); },
};

import { getSettings, saveSettings } from '../../../src/utils/settings.js';

beforeEach(() => {
  localStorage.clear();
});

describe('getSettings', () => {
  test('returns default settings when localStorage is empty', () => {
    const s = getSettings();
    expect(s.license).toBe('Free');
    expect(s.telemetry.enabled).toBe(true);
    expect(s.batch).toBeDefined();
    expect(s.ai).toBeDefined();
  });

  test('merges saved partial settings with defaults (no lost keys)', () => {
    localStorage.setItem('ic-global-settings', JSON.stringify({ license: 'Pro' }));
    const s = getSettings();
    expect(s.license).toBe('Pro');
    // Default keys must still be present
    expect(s.telemetry).toBeDefined();
    expect(s.batch).toBeDefined();
  });
});

describe('saveSettings + getSettings round-trip', () => {
  test('persists custom values to localStorage', () => {
    const original = getSettings();
    original.license = 'Pro';
    original.pexels = { apiKey: 'test-key' };
    saveSettings(original);

    const loaded = getSettings();
    expect(loaded.license).toBe('Pro');
    expect(loaded.pexels.apiKey).toBe('test-key');
  });

  test('empty localStorage key causes getSettings to return defaults', () => {
    // Don't set anything — should always return defaults cleanly
    const s = getSettings();
    expect(s.license).toBe('Free');
    expect(typeof s.telemetry).toBe('object');
  });
});
