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

const SHADOW_STORES = ['recipes', 'blocks', 'templates'];

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
  const stores = ['recipes', 'blocks', 'templates'];
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
    const stores = ['recipes', 'blocks', 'templates'];
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

export function showBackupModal() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px);';
  modal.innerHTML = `
    <div style="background:var(--ps-surface); border:1px solid var(--ps-border); border-radius:8px; width:400px; max-width:90vw; box-shadow:0 10px 40px rgba(0,0,0,0.5); overflow:hidden;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid var(--ps-border); background:rgba(0,0,0,0.2);">
        <h3 style="margin:0; font-size:16px; font-weight:600;">Database Backup & Restore</h3>
        <button class="btn-icon" id="db-bk-close" style="width:28px; height:28px;">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 24px; padding: 24px;">
        <div style="border:1px solid var(--ps-border); border-radius:6px; padding: 16px; background:rgba(0,0,0,0.1);">
          <h4 style="margin-top: 0; margin-bottom:8px;">Export Database</h4>
          <p class="text-xs text-muted" style="margin-bottom: 16px; line-height:1.4;">Download a JSON snapshot of all your local Recipes, UI Blocks, and Templates. This file can be used to migrate your configurations to another browser.</p>
          <button class="btn-primary" id="db-bk-export" style="width: 100%; justify-content:center;">
            <span class="material-symbols-outlined" style="font-size:16px; margin-right:8px;">download</span> Download Backup
          </button>
        </div>
        
        <div style="border:1px solid rgba(239, 68, 68, 0.4); border-radius:6px; padding: 16px; background:rgba(239, 68, 68, 0.05);">
          <h4 style="margin-top: 0; margin-bottom:8px; color: var(--ps-red);">Restore from File</h4>
          <p class="text-xs text-muted" style="margin-bottom: 16px; line-height:1.4;">Upload a previously exported JSON backup file. <strong style="color:var(--ps-red);">Warning: This is a destructive action.</strong> All existing recipes will be wiped and replaced by the imported file's contents.</p>
          
          <label class="btn-secondary" style="width: 100%; justify-content: center; cursor: pointer; color: var(--ps-red); border-color: rgba(239,68,68,0.3);">
            <span class="material-symbols-outlined" style="font-size:16px; margin-right:8px;">upload</span> Select Backup File
            <input type="file" id="db-bk-import-input" accept=".json,application/json" style="display:none">
          </label>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.querySelector('#db-bk-close').onclick = () => modal.remove();
  
  modal.querySelector('#db-bk-export').onclick = () => {
    exportAll();
    modal.remove();
  };
  
  modal.querySelector('#db-bk-import-input').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const confirmed = await showConfirm({
        title: 'Overwrite Database?',
        body: 'This will replace all existing recipes, blocks, and templates with the contents of the backup file. Any data not in the backup will be permanently deleted.',
        confirmText: 'Overwrite',
        cancelText: 'Cancel',
        variant: 'danger',
        icon: 'warning',
      });
      if (confirmed) {
        importAll(file, { wipeFirst: true });
      } else {
        e.target.value = '';
      }
    }
  };
}
