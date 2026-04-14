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
  const mode = (role === 'output' || role === 'browse') ? 'readwrite' : 'read';
  const handle = await window.showDirectoryPicker({ mode });
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
  const mode = (role === 'output' || role === 'browse') ? 'readwrite' : 'read';

  // Verify (and re-request) permission
  const permission = await handle.queryPermission({ mode });
  if (permission === 'granted') return handle;

  const request = await handle.requestPermission({ mode });
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
/** Returns the hidden preview sidecar filename for a video. */
export function previewNameFor(videoName) {
  return `.${videoName}.preview.jpg`;
}

/**
 * Try to read an existing video preview sidecar from the folder.
 * Returns a File or null if it doesn't exist.
 */
export async function readVideoPreview(dirHandle, videoName) {
  try {
    const handle = await dirHandle.getFileHandle(previewNameFor(videoName));
    return await handle.getFile();
  } catch {
    return null;
  }
}

/**
 * Write a video preview sidecar (JPEG blob) to the folder.
 * Requires readwrite permission on the folder handle.
 */
export async function writeVideoPreview(dirHandle, videoName, blob) {
  try {
    await writeFile(dirHandle, previewNameFor(videoName), blob);
  } catch {
    // Silently ignore — folder may be read-only
  }
}

/**
 * Load all existing preview sidecars from a directory into a Map<videoName, File>.
 * Call once after opening a folder so thumbnails render immediately.
 */
export async function loadVideoPreviews(dirHandle) {
  const map = new Map();
  try {
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind !== 'file') continue;
      // Pattern: .{videoName}.preview.jpg
      const match = name.match(/^\.(.+)\.preview\.jpg$/);
      if (match) {
        const file = await entry.getFile();
        map.set(match[1], file);
      }
    }
  } catch { /* ignore */ }
  return map;
}

export async function listImages(dirHandle, { includeVideo = false, onlyVideo = false } = {}) {
  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.heic', '.heif', '.bmp']);
  const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm']);
  const files = [];
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind !== 'file') continue;
    if (name.startsWith('.')) continue;  // skip hidden files (preview sidecars, .DS_Store, etc.)
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    
    let match = false;
    if (onlyVideo) {
      if (VIDEO_EXTS.has(ext)) match = true;
    } else if (includeVideo) {
      if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) match = true;
    } else {
      if (IMAGE_EXTS.has(ext)) match = true;
    }
    
    if (match) {
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
