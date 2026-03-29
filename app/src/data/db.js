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
const DB_VERSION = 1;

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
    };

    req.onsuccess = async e => {
      _db = e.target.result;
      // Seed system recipes on first run
      await seedSystemRecipes(_db);
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

// ─── System recipe seeding ────────────────────────────────
async function seedSystemRecipes(db) {
  // Only seed if no system recipes exist yet
  const existing = await new Promise((resolve, reject) => {
    const tx = db.transaction('recipes', 'readonly');
    const req = tx.objectStore('recipes').getAll();
    req.onsuccess = () => resolve(req.result.filter(r => r.isSystem));
    req.onerror = () => reject(req.error);
  });

  if (existing.length > 0) return; // already seeded

  const { SYSTEM_RECIPES } = await import('./system-recipes.js');
  const tx = db.transaction('recipes', 'readwrite');
  const store = tx.objectStore('recipes');
  SYSTEM_RECIPES.forEach(r => store.put(r));
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
