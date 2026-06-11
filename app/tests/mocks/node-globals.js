/**
 * Global polyfills for Node test environment.
 * Loaded via vitest.config.js setupFiles — runs before every test file.
 */

// db.js checks localStorage.getItem() during legacy migration detection.
// In Node there is no localStorage — stub it so the check fails silently
// (which is the correct behaviour: no legacy DB to migrate in tests).
if (typeof localStorage === 'undefined') {
  const _store = {};
  global.localStorage = {
    getItem:    (k) => _store[k] ?? null,
    setItem:    (k, v) => { _store[k] = v; },
    removeItem: (k) => { delete _store[k]; },
    clear:      () => { Object.keys(_store).forEach(k => delete _store[k]); },
  };
}
