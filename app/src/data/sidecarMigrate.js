/**
 * Sidecar format migration — one-time, idempotent.
 *
 * Renames legacy `filename.json` sidecar files to the dot-prefix format
 * `.filename` used by ux-file-manager (sidekick-manager). After this runs,
 * both tools share the same on-disk sidecar files.
 *
 * Rules:
 *  - Only renames files whose name ends with `.json` AND whose name without
 *    that suffix looks like a media file (has another extension).
 *  - Skips if the dot-prefix version already exists (idempotent).
 *  - Skips any file whose rename would produce a name already taken.
 *  - Runs shallowly (no recursion) — caller must invoke once per folder.
 *
 * Usage (in fld.js, on folder open):
 *   import { migrateSidecarFiles } from '../data/sidecarMigrate.js';
 *   await migrateSidecarFiles(dirHandle);
 */

const LEGACY_EXT = '.json';
const DOT_PREFIX = '.';

/**
 * Collect all file names in `dirHandle` as a Set for fast lookup.
 */
async function collectNames(dirHandle) {
  const names = new Set();
  for await (const [name] of dirHandle.entries()) names.add(name);
  return names;
}

/**
 * Return true when `base` (the part before `.json`) looks like a media file
 * that has its own extension — prevents accidentally renaming plain JSON
 * data files like `config.json`.
 */
function looksLikeMediaSidecar(base) {
  // Must contain a dot that isn't the first character → has its own extension.
  return base.includes('.') && !base.startsWith('.');
}

/**
 * Migrate all legacy `filename.json` sidecar files in `dirHandle` to
 * `.filename` dot-prefix format.
 *
 * @param {FileSystemDirectoryHandle} dirHandle
 * @returns {Promise<{ renamed: string[], skipped: string[], errors: string[] }>}
 */
export async function migrateSidecarFiles(dirHandle) {
  if (!dirHandle) return { renamed: [], skipped: [], errors: [] };

  const renamed  = [];
  const skipped  = [];
  const errors   = [];

  let existingNames;
  try {
    existingNames = await collectNames(dirHandle);
  } catch (err) {
    errors.push(`Could not list directory: ${err.message}`);
    return { renamed, skipped, errors };
  }

  // Find candidates: files ending in .json whose base looks like a media file.
  const candidates = [...existingNames].filter(name => {
    if (!name.endsWith(LEGACY_EXT)) return false;
    const base = name.slice(0, -LEGACY_EXT.length);
    return looksLikeMediaSidecar(base);
  });

  for (const legacyName of candidates) {
    const base      = legacyName.slice(0, -LEGACY_EXT.length); // e.g. "photo.jpg"
    const newName   = `${DOT_PREFIX}${base}`;                   // e.g. ".photo.jpg"

    if (existingNames.has(newName)) {
      // Dot-prefix version already present — nothing to do.
      skipped.push(legacyName);
      continue;
    }

    try {
      // Read the legacy file.
      const legacyHandle  = await dirHandle.getFileHandle(legacyName);
      const legacyFile    = await legacyHandle.getFile();
      const content       = await legacyFile.text();

      // Write under the new name.
      const newHandle   = await dirHandle.getFileHandle(newName, { create: true });
      const writable    = await newHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // Remove the old file.
      await dirHandle.removeEntry(legacyName);

      existingNames.add(newName);
      existingNames.delete(legacyName);
      renamed.push(`${legacyName} → ${newName}`);
    } catch (err) {
      errors.push(`Failed to rename ${legacyName}: ${err.message}`);
    }
  }

  return { renamed, skipped, errors };
}
