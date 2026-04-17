/**
 * PicMachina — Showcase CRUD
 *
 * A Showcase captures a curated view of a run's output:
 * {
 *   id:              string,   // uuid
 *   runId:           string,   // which run
 *   recipeId:        string,
 *   recipeName:      string,
 *   title:           string,   // user-editable, defaults to recipeName
 *   description:     string,   // user-written
 *   sampleFileNames: string[], // up to 5 filenames from the run's output folder
 *   createdAt:       number,
 *   updatedAt:       number,
 * }
 */

import { dbGet, dbGetAll, dbPut, dbDelete } from './db.js';
import { shadowWrite } from '../utils/backup.js';
import { uuid, now }   from '../utils/misc.js';
import { generateBaselineThumbnail, generateSmartThumbnail } from '../utils/thumbnails.js';
import { getSettings } from '../utils/settings.js';

export function getAllShowcases() { return dbGetAll('showcases'); }
export function getShowcase(id)  { return dbGet('showcases', id); }

export async function saveShowcase(entry) {
  if (!entry.id) entry.id = uuid();
  if (!entry.createdAt) entry.createdAt = now();
  entry.updatedAt = now();
  await dbPut('showcases', entry);
  shadowWrite('showcases'); // fire-and-forget
  return entry;
}

export async function deleteShowcase(id) {
  await dbDelete('showcases', id);
  shadowWrite('showcases'); // fire-and-forget
}

/**
 * Resize a File and store as base64 in the showcase entry.
 */
export async function setShowcaseThumbnail(showcaseId, file, opts = {}) {
  const entry = await getShowcase(showcaseId);
  if (!entry) throw new Error(`Showcase entry ${showcaseId} not found`);

  // 1. Baseline cover-crop (fast, no inference).
  let { dataUrl } = await generateBaselineThumbnail(file, { width: 640, height: 400 });
  try { opts.onBaseline?.(dataUrl); } catch { /* non-fatal */ }

  // 2. Optional subject-aware replacement (feature-flag + model must be ready).
  if (getSettings()?.thumbnails?.smart) {
    const smart = await generateSmartThumbnail(file, { width: 640, height: 400 });
    if (smart) dataUrl = smart.dataUrl;
  }

  entry.thumbnail = dataUrl;
  return saveShowcase(entry);
}

export async function clearShowcaseThumbnail(showcaseId) {
  const entry = await getShowcase(showcaseId);
  if (!entry) return;
  delete entry.thumbnail;
  await saveShowcase(entry);
}
