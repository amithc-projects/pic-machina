/**
 * PicMachina — Asset Metadata Store
 *
 * Persists per-file metadata (EXIF, geocode, OCR, vision, user sidecar) in
 * the 'assets' IndexedDB store, keyed by a stable SHA-256 content hash.
 *
 * The hash covers the first 512KB of file content + file size appended as
 * a 64-bit value.  This is fast (<50ms on mobile), rename-stable, and
 * collision-resistant for all practical input sets.
 */

import { dbGet, dbGetAll, dbGetAllByIndex, dbPut, dbDelete } from './db.js';

// ─── Hashing ─────────────────────────────────────────────────

/**
 * Compute a stable content hash for a File.
 * @param {File} file
 * @returns {Promise<string>} SHA-256 hex string
 */
export async function hashFile(file) {
  const SAMPLE = 512 * 1024;
  const buf  = await file.slice(0, SAMPLE).arrayBuffer();
  // Append file.size as 8-byte little-endian to prevent collisions in burst
  // sequences that share identical headers (e.g. same-camera RAW files).
  const full = new Uint8Array(buf.byteLength + 8);
  full.set(new Uint8Array(buf));
  new DataView(full.buffer).setBigUint64(buf.byteLength, BigInt(file.size), true);
  const digest = await crypto.subtle.digest('SHA-256', full);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── CRUD ────────────────────────────────────────────────────

/** @returns {Promise<AssetRecord|null>} */
export function getAsset(hash) {
  return dbGet('assets', hash);
}

/** @returns {Promise<AssetRecord[]>} */
export function getAllAssets() {
  return dbGetAll('assets');
}

/** @returns {Promise<AssetRecord[]>} */
export function getAssetsByFilename(filename) {
  return dbGetAllByIndex('assets', 'filename', filename);
}

/**
 * Full replace — always refreshes updatedAt.
 * @param {AssetRecord} record
 */
export function upsertAsset(record) {
  return dbPut('assets', { ...record, updatedAt: Date.now() });
}

/**
 * Shallow-merge patch into the existing record (creates if missing).
 * Nested objects are replaced, not recursively merged.
 * @param {string} hash
 * @param {Partial<AssetRecord>} patch
 * @returns {Promise<AssetRecord>}
 */
export async function patchAsset(hash, patch) {
  const existing = (await getAsset(hash)) ?? { hash };
  const updated  = { ...existing, ...patch, hash, updatedAt: Date.now() };
  await dbPut('assets', updated);
  return updated;
}

/** @returns {Promise<void>} */
export function deleteAsset(hash) {
  return dbDelete('assets', hash);
}

// ─── Sidecar field helpers ────────────────────────────────────

/**
 * Set a single key in the asset's free-form sidecar map.
 * @param {string} hash
 * @param {string} key
 * @param {string} value
 */
export async function setSidecarField(hash, key, value) {
  const asset = (await getAsset(hash)) ?? { hash, sidecar: {} };
  await patchAsset(hash, { sidecar: { ...(asset.sidecar ?? {}), [key]: value } });
}

// ─── Annotation helpers ───────────────────────────────────────

/**
 * Add an annotation to an asset record.
 * @param {string} hash
 * @param {{ type: string, x: number, y: number, w: number, h: number, text: string }} annotation
 * @returns {Promise<string>} the new annotation id
 */
export async function addAnnotation(hash, annotation) {
  const asset = (await getAsset(hash)) ?? { hash, annotations: [] };
  const id    = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const entry = { ...annotation, id, createdAt: Date.now() };
  await patchAsset(hash, { annotations: [...(asset.annotations ?? []), entry] });
  return id;
}

/**
 * Remove an annotation by id.
 * @param {string} hash
 * @param {string} annotationId
 */
export async function removeAnnotation(hash, annotationId) {
  const asset = await getAsset(hash);
  if (!asset) return;
  await patchAsset(hash, {
    annotations: (asset.annotations ?? []).filter(a => a.id !== annotationId),
  });
}

// ─── Ingestion ────────────────────────────────────────────────

/**
 * Idempotent file ingestion.
 *
 * On first call: computes hash, runs EXIF extraction, creates the asset record.
 * On subsequent calls: returns the existing record immediately (no re-extraction).
 *
 * @param {File} file
 * @returns {Promise<AssetRecord>}
 */
export async function ingestFile(file) {
  const hash     = await hashFile(file);
  const existing = await getAsset(hash);
  if (existing) return existing;

  // Lazy-import so this module works in contexts that load assets.js before
  // the engine modules are bundled (e.g. tests, Storybook).
  const { extractExif } = await import('../engine/exif-reader.js');
  const exif = await extractExif(file);

  const record = {
    hash,
    filename:   file.name,
    fileSize:   file.size,
    mimeType:   file.type || '',
    ingestedAt: Date.now(),
    updatedAt:  Date.now(),

    exif,          // { date, gps, cameraMake, cameraModel, exposure, aperture, iso, focalLength, author, copyright, description }
    geo:        null,
    ocr:        null,
    vision:     null,
    sidecar:    {},
    annotations: [],
  };

  await dbPut('assets', record);
  return record;
}
