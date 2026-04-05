/**
 * ImageChef — IndexedDB wrapper
 *
 * Schema
 * ──────
 * Store: recipes      keyPath: id   indexes: name, isSystem, updatedAt
 * Store: blocks       keyPath: id   indexes: name, updatedAt
 * Store: runs         keyPath: id   indexes: recipeId, startedAt
 * Store: folders      keyPath: key  (singleton key per role: 'input' | 'output')
 */

const DB_NAME = 'PicMachina';
const DB_VERSION = 3;

let _db = null;

export function getDB() {
  if (!_db) throw new Error('Database not initialised. Call initDB() first.');
  return _db;
}

export function initDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      // recipes
      if (!db.objectStoreNames.contains('recipes')) {
        const recipeStore = db.createObjectStore('recipes', { keyPath: 'id' });
        recipeStore.createIndex('name', 'name', { unique: false });
        recipeStore.createIndex('isSystem', 'isSystem', { unique: false });
        recipeStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // blocks
      if (!db.objectStoreNames.contains('blocks')) {
        const blockStore = db.createObjectStore('blocks', { keyPath: 'id' });
        blockStore.createIndex('name', 'name', { unique: false });
        blockStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // runs  (batch execution logs)
      if (!db.objectStoreNames.contains('runs')) {
        const runStore = db.createObjectStore('runs', { keyPath: 'id' });
        runStore.createIndex('recipeId', 'recipeId', { unique: false });
        runStore.createIndex('startedAt', 'startedAt', { unique: false });
      }

      // folders (File System Access handles)
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'key' });
      }

      // assets (v2) — per-file metadata store keyed by content hash
      if (!db.objectStoreNames.contains('assets')) {
        const assetStore = db.createObjectStore('assets', { keyPath: 'hash' });
        assetStore.createIndex('filename',   'filename',   { unique: false });
        assetStore.createIndex('ingestedAt', 'ingestedAt', { unique: false });
        assetStore.createIndex('updatedAt',  'updatedAt',  { unique: false });
      }

      // templates
      if (!db.objectStoreNames.contains('templates')) {
        const tStore = db.createObjectStore('templates', { keyPath: 'id' });
        tStore.createIndex('name', 'name', { unique: false });
        tStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    req.onsuccess = async e => {
      _db = e.target.result;
      // Seed system recipes and blocks on every start (upserts keep them current)
      await seedSystemRecipes(_db);
      await seedSystemBlocks(_db);
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ─── Generic helpers ──────────────────────────────────────

export function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function dbGetAllByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function dbPut(storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── System block seeding ─────────────────────────────────
async function seedSystemBlocks(db) {
  const { SYSTEM_BLOCKS } = await import('./system-blocks.js');
  const tx = db.transaction('blocks', 'readwrite');
  const store = tx.objectStore('blocks');
  SYSTEM_BLOCKS.forEach(b => store.put(b));
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ─── System recipe seeding ────────────────────────────────
async function seedSystemRecipes(db) {
  // Upsert all system recipes so new ones added to system-recipes.js appear automatically
  const existing = await new Promise((resolve, reject) => {
    const tx = db.transaction('recipes', 'readonly');
    const req = tx.objectStore('recipes').getAll();
    req.onsuccess = () => resolve(req.result.filter(r => r.isSystem));
    req.onerror = () => reject(req.error);
  });

  const { SYSTEM_RECIPES } = await import('./system-recipes.js');
  // Always upsert every system recipe so param changes in system-recipes.js are reflected
  // on next app start. User-created recipes are unaffected (they are not in SYSTEM_RECIPES).

  const tx = db.transaction('recipes', 'readwrite');
  const store = tx.objectStore('recipes');
  SYSTEM_RECIPES.forEach(r => store.put(r));
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
