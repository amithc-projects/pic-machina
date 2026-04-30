import { dbGetAll, getDB, dbGet } from '../data/db.js';
import { showToast } from '../aurora/toast.js';
import { showConfirm } from './dialogs.js';

/**
 * ImageChef — Database Backup & Restore Utility
 */

// ─── File System Shadow Persistence ──────────────────────────────────────────
// After every mutation, shadow files are written to .PicMachina/data/ inside
// the project_root folder. On startup, if IDB is empty, they are silently
// restored. This survives browser storage clears.

const SHADOW_STORES = ['recipes', 'blocks', 'templates', 'showcases'];

async function getShadowDir() {
  try {
    const record = await dbGet('folders', 'project_root');
    if (!record?.handle) return null;
    const perm = await record.handle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      const req = await record.handle.requestPermission({ mode: 'readwrite' });
      if (req !== 'granted') return null;
    }
    const hidden = await record.handle.getDirectoryHandle('.PicMachina', { create: true });
    return hidden.getDirectoryHandle('data', { create: true });
  } catch {
    return null;
  }
}

/**
 * Write a single store's records to its shadow JSON file.
 * Fire-and-forget — never await this from mutation call sites.
 */
export async function shadowWrite(store) {
  try {
    const dir = await getShadowDir();
    if (!dir) return;
    const records = await dbGetAll(store);
    // Strip system records — they are recreated from code on startup
    const toWrite = (store === 'recipes' || store === 'blocks')
      ? records.filter(r => !r.isSystem)
      : records;
    // Strip non-serialisable blobs (e.g. templates.backgroundBlob)
    const serialisable = toWrite.map(r => {
      if (r.backgroundBlob) { const { backgroundBlob, ...rest } = r; return rest; }
      return r;
    });
    const blob = new Blob([JSON.stringify(serialisable)], { type: 'application/json' });
    const fh = await dir.getFileHandle(`${store}.json`, { create: true });
    const wr = await fh.createWritable();
    await wr.write(blob);
    await wr.close();
  } catch { /* silent — shadow is best-effort */ }
}

/**
 * Write all shadowed stores. Call after bulk imports/restores.
 */
export async function shadowWriteAll() {
  for (const store of SHADOW_STORES) await shadowWrite(store);
}

/**
 * On startup: if IDB has no user-created data, silently restore from shadow files.
 * Returns true if a restore was performed.
 */
export async function shadowRestore() {
  try {
    const dir = await getShadowDir();
    if (!dir) return false;

    // Only restore if there is no user data in IDB already
    const recipes = await dbGetAll('recipes');
    const hasUserData = recipes.some(r => !r.isSystem);
    if (hasUserData) return false;

    const snapshot = { version: 1, checksum: 'PicMachinaExport', data: {} };
    let found = false;
    for (const store of SHADOW_STORES) {
      try {
        const fh = await dir.getFileHandle(`${store}.json`);
        const file = await fh.getFile();
        snapshot.data[store] = JSON.parse(await file.text());
        if (snapshot.data[store].length > 0) found = true;
      } catch { snapshot.data[store] = []; }
    }
    if (!found) return false;

    await importAll(
      { text: async () => JSON.stringify(snapshot) },
      { wipeFirst: false, silent: true }
    );
    return true;
  } catch { return false; }
}

export async function exportAll() {
  const db = getDB();
  const stores = ['recipes', 'blocks', 'templates', 'showcases'];
  const snapshot = { version: 1, checksum: 'PicMachinaExport', metadata: { exportedAt: new Date().toISOString() }, data: {} };
  
  try {
    for (const store of stores) {
      snapshot.data[store] = await dbGetAll(store);
    }
    
    // Create downloaded blob automatically
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PicMachina_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast({ variant: 'success', title: 'Backup Successful', description: 'Your configuration has been downloaded.' });
  } catch (err) {
    console.error('Backup failed:', err);
    showToast({ variant: 'error', title: 'Backup Failed', description: err.message });
  }
}

export async function importAll(file, { wipeFirst = true, silent = false } = {}) {
  try {
    const text = await file.text();
    const snapshot = JSON.parse(text);

    if (snapshot.checksum !== 'PicMachinaExport' || !snapshot.data) {
      throw new Error('Invalid backup file format. Missing PicMachina checksum.');
    }

    const db = getDB();
    const stores = ['recipes', 'blocks', 'templates', 'showcases'];
    let count = 0;

    for (const store of stores) {
      if (!snapshot.data[store]) continue;

      await new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);

        const records = snapshot.data[store];
        if (wipeFirst && records.length > 0) {
          os.clear();
        }

        for (const record of records) {
          os.put(record);
          count++;
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    // Keep shadow files in sync with what was just imported
    shadowWriteAll();

    if (silent) return; // caller handles feedback

    showToast({ variant: 'success', title: 'Restore Complete', description: `Successfully restored ${count} configuration records. Reloading...` });
    setTimeout(() => window.location.reload(), 1500);
  } catch (err) {
    console.error('Restore failed:', err);
    if (!silent) {
      showToast({ variant: 'error', title: 'Restore Failed', description: err.message || 'The backup file is corrupt or unreadable.' });
    }
  }
}


