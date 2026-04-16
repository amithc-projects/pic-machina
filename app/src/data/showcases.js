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
import { processImageThumbnail } from '../utils/images.js';

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
export async function setShowcaseThumbnail(showcaseId, file) {
  const entry = await getShowcase(showcaseId);
  if (!entry) throw new Error(`Showcase entry ${showcaseId} not found`);

  const { dataUrl } = await processImageThumbnail(file, 640, 400); // slightly larger for showcase hero
  entry.thumbnail = dataUrl;

  return saveShowcase(entry);
}

export async function clearShowcaseThumbnail(showcaseId) {
  const entry = await getShowcase(showcaseId);
  if (!entry) return;
  delete entry.thumbnail;
  await saveShowcase(entry);
}
