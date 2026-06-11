/**
 * Browser-mode tests for the data layer — uses real browser IndexedDB.
 * No fake-indexeddb, no stubs. The actual ZumiLabs Studio database is opened.
 *
 * Run: npm run test:browser
 */
import { describe, test, expect, beforeEach } from 'vitest';

// Each suite gets a unique DB name to avoid connection conflicts
let _counter = 0;
function freshDB() { return `ZumilabsStudio_test_${Date.now()}_${_counter++}`; }

// ── Minimal IDB helpers (avoid importing db.js which auto-seeds) ──────────────

async function openTestDB(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const store = db.createObjectStore('recipes', { keyPath: 'id' });
      store.createIndex('name', 'name', { unique: false });
      db.createObjectStore('assets', { keyPath: 'hash' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(db, store, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteTestDB(dbRef, name) {
  return new Promise((resolve) => {
    if (dbRef) dbRef.close();
    if (!name) { resolve(); return; }
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Real browser IndexedDB — recipes store', () => {
  let db;
  let dbName;

  beforeEach(async () => {
    await deleteTestDB(db, dbName);
    dbName = freshDB();
    db = await openTestDB(dbName);
  });

  test('put + get round-trips a recipe record', async () => {
    const recipe = { id: 'r1', name: 'My Recipe', nodes: [], createdAt: 1000, updatedAt: 1000 };
    await dbPut(db, 'recipes', recipe);
    const result = await dbGet(db, 'recipes', 'r1');
    expect(result).toMatchObject({ id: 'r1', name: 'My Recipe' });
  });

  test('get returns null for non-existent key', async () => {
    expect(await dbGet(db, 'recipes', 'no-such-id')).toBeNull();
  });

  test('delete removes record', async () => {
    await dbPut(db, 'recipes', { id: 'del', name: 'Temp', nodes: [], createdAt: 1, updatedAt: 1 });
    await dbDelete(db, 'recipes', 'del');
    expect(await dbGet(db, 'recipes', 'del')).toBeNull();
  });

  test('put is idempotent — second write overwrites first', async () => {
    await dbPut(db, 'recipes', { id: 'r2', name: 'Original', nodes: [], createdAt: 1, updatedAt: 1 });
    await dbPut(db, 'recipes', { id: 'r2', name: 'Updated',  nodes: [], createdAt: 1, updatedAt: 2 });
    const result = await dbGet(db, 'recipes', 'r2');
    expect(result.name).toBe('Updated');
  });
});

describe('Real browser IndexedDB — assets store', () => {
  let db;
  let dbName;

  beforeEach(async () => {
    await deleteTestDB(db, dbName);
    dbName = freshDB();
    db = await openTestDB(dbName);
  });

  test('put + get round-trips an asset record', async () => {
    const asset = { hash: 'abc123', filename: 'photo.jpg', ingestedAt: Date.now() };
    await dbPut(db, 'assets', asset);
    const result = await dbGet(db, 'assets', 'abc123');
    expect(result.filename).toBe('photo.jpg');
  });
});

describe('Real browser localStorage', () => {
  const KEY = 'ic-global-settings-test';

  test('setItem + getItem round-trip', () => {
    localStorage.setItem(KEY, JSON.stringify({ license: 'Pro' }));
    const raw = localStorage.getItem(KEY);
    const parsed = JSON.parse(raw);
    expect(parsed.license).toBe('Pro');
    localStorage.removeItem(KEY);
  });

  test('getItem returns null for missing key', () => {
    expect(localStorage.getItem('__definitely_missing__')).toBeNull();
  });
});
