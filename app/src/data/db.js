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
      // Silently restore from file system shadow if IDB has no user data
      import('../utils/backup.js').then(({ shadowRestore }) => {
        shadowRestore().then(restored => {
          if (restored) console.info('[PicMachina] User data restored from file system shadow.');
        });
      });
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
  // 1. Get existing system recipes from DB first
  const existingMap = new Map();
  const txRead = db.transaction('recipes', 'readonly');
  const storeRead = txRead.objectStore('recipes');
  const allExisting = await new Promise((resolve, reject) => {
    const req = storeRead.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  allExisting.filter(r => r.isSystem).forEach(r => existingMap.set(r.id, r));

  const { SYSTEM_RECIPES } = await import('./system-recipes.js');

  // 2. Perform upsert
  const txWrite = db.transaction('recipes', 'readwrite');
  const storeWrite = txWrite.objectStore('recipes');
  
  SYSTEM_RECIPES.forEach(incoming => {
    const existing = existingMap.get(incoming.id);
    if (existing && existing.thumbnail && !incoming.thumbnail) {
      // Preserve existing thumbnail if the new one is undefined/null
      incoming.thumbnail = existing.thumbnail;
    }
    storeWrite.put(incoming);
  });

  return new Promise((resolve, reject) => {
    txWrite.oncomplete = resolve;
    txWrite.onerror = () => reject(txWrite.error);
  });
}

// ─── Directory History (MRU) ──────────────────────────────
export async function dbSaveFolderHistory(type, handle) {
  const key = `mru_${type}`; // e.g., 'mru_input'
  const record = (await dbGet('folders', key)) || { key, handles: [] };
  
  // Remove if it exists to bubble it to the top
  record.handles = record.handles.filter(h => h.name !== handle.name);
  record.handles.unshift(handle);
  
  // Keep only top 5 recent folders
  if (record.handles.length > 5) {
    record.handles = record.handles.slice(0, 5);
  }
  return dbPut('folders', record);
}

export async function dbGetFolderHistory(type) {
  const key = `mru_${type}`;
  const record = await dbGet('folders', key);
  return record ? record.handles : [];
}
