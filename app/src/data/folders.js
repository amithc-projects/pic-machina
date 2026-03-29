/**
 * ImageChef — Persistent folder handle management (File System Access API)
 *
 * Folder handles are stored in IndexedDB under the key 'input' or 'output'.
 * On app start the handle must be re-verified (user may need to re-grant permission).
 */

import { dbGet, dbPut } from './db.js';

/**
 * Prompt the user to pick a directory and persist its handle.
 * @param {'input'|'output'} role
 * @returns {FileSystemDirectoryHandle}
 */
export async function pickFolder(role) {
  const handle = await window.showDirectoryPicker({ mode: role === 'output' ? 'readwrite' : 'read' });
  await dbPut('folders', { key: role, handle });
  return handle;
}

/**
 * Retrieve the persisted handle for a role, or null if not set.
 * Automatically requests permission if the handle exists but permission was revoked.
 */
export async function getFolder(role) {
  const record = await dbGet('folders', role);
  if (!record) return null;

  const handle = record.handle;

  // Verify (and re-request) permission
  const permission = await handle.queryPermission({ mode: role === 'output' ? 'readwrite' : 'read' });
  if (permission === 'granted') return handle;

  const request = await handle.requestPermission({ mode: role === 'output' ? 'readwrite' : 'read' });
  if (request === 'granted') return handle;

  // Permission denied — clear stored handle
  await clearFolder(role);
  return null;
}

export async function clearFolder(role) {
  const { dbDelete } = await import('./db.js');
  return dbDelete('folders', role);
}

/**
 * Returns an array of File objects from a directory handle.
 * Optionally filtered by accepted MIME types / extensions.
 */
export async function listImages(dirHandle) {
  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.heic', '.heif', '.bmp']);
  const files = [];
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind !== 'file') continue;
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    if (IMAGE_EXTS.has(ext)) {
      const file = await entry.getFile();
      files.push(file);
    }
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Ensure the /output subfolder exists and return its handle.
 */
export async function getOrCreateOutputSubfolder(outputHandle, subfolderName = 'output') {
  return outputHandle.getDirectoryHandle(subfolderName, { create: true });
}

/**
 * Write a Blob to a file in the given directory handle.
 */
export async function writeFile(dirHandle, filename, blob) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}
