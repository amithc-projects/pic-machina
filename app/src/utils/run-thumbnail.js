/**
 * PicMachina — run thumbnail helper
 *
 * Lazily generates and caches a small JPEG thumbnail for a completed run,
 * derived from the first available output (image, or one frame from a
 * video). The result is persisted on the run record's `thumbnail` field
 * (data URL) so subsequent renders are free.
 *
 * Idempotent: if `run.thumbnail` is already set, the existing value is
 * returned without touching disk.
 *
 * Failure is silent — the helper resolves to `null` and leaves the run
 * record untouched on any error (folder gone, permissions denied,
 * unsupported codec, etc.). Callers should treat a null return as "no
 * thumbnail available right now" and degrade to a placeholder.
 */

import { getRun, updateRun } from '../data/runs.js';
import { getOrCreateOutputSubfolder, listImages } from '../data/folders.js';
import { generateBaselineThumbnail } from './thumbnails.js';
import { extractVideoFrame, isVideoFile } from './video-frame.js';

const THUMB_WIDTH  = 160;
const THUMB_HEIGHT = 100;
const THUMB_QUALITY = 0.78;

/**
 * Ensure a thumbnail exists on the given run record.
 *
 * @param {object} run         The run record (must have id, outputFolder,
 *                             outputHandleObj, status).
 * @param {object} [opts]
 * @param {boolean} [opts.persist=true]  Save the updated run back to IDB.
 * @returns {Promise<string|null>}       Data URL of the thumbnail, or null.
 */
export async function ensureRunThumbnail(run, { persist = true } = {}) {
  if (!run) return null;
  if (run.thumbnail) return run.thumbnail;
  if (run.status !== 'completed') return null;
  if (!run.outputHandleObj) return null;

  try {
    // Resolve the output subfolder.
    const subfolder = run.outputFolder || 'output';
    const subHandle = await getOrCreateOutputSubfolder(run.outputHandleObj, subfolder);

    // Permission check — in some browsers handles need re-prompt after a
    // page reload. We only proceed if we already have read access; we never
    // prompt the user for a thumbnail.
    if (typeof subHandle.queryPermission === 'function') {
      const perm = await subHandle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') return null;
    }

    // List outputs (images and videos). First entry by lexical order is fine.
    const files = await listImages(subHandle, { includeVideo: true });
    if (!files.length) return null;
    const first = files[0];

    // Build a source canvas / blob suitable for the thumbnailer.
    let source;
    if (isVideoFile(first)) {
      // Pull a single frame; coverCrop will resize it to thumb size.
      source = await extractVideoFrame(first);
    } else {
      source = first;
    }

    const { dataUrl } = await generateBaselineThumbnail(source, {
      width:   THUMB_WIDTH,
      height:  THUMB_HEIGHT,
      quality: THUMB_QUALITY,
    });

    run.thumbnail = dataUrl;
    if (persist) {
      // Re-fetch in case other writes (e.g. log appends) raced; merge
      // thumbnail onto the freshest record.
      const fresh = await getRun(run.id);
      if (fresh) {
        fresh.thumbnail = dataUrl;
        await updateRun(fresh);
      } else {
        await updateRun(run);
      }
    }
    return dataUrl;
  } catch (err) {
    console.warn('[run-thumbnail] generation failed', err);
    return null;
  }
}

/**
 * Walk a list of runs and fill in missing thumbnails with bounded
 * concurrency. Calls `onReady(run, dataUrl)` for each run once its
 * thumbnail is ready (or when generation has been skipped/failed —
 * `dataUrl` will be null in that case so the caller can stop showing a
 * spinner).
 *
 * @param {object[]} runs
 * @param {(run:object, dataUrl:string|null) => void} onReady
 * @param {{concurrency?: number}} [opts]
 */
export async function backfillRunThumbnails(runs, onReady, { concurrency = 3 } = {}) {
  const queue = runs.filter(r => !r.thumbnail && r.status === 'completed' && r.outputHandleObj);
  if (!queue.length) return;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (cursor < queue.length) {
      const run = queue[cursor++];
      const dataUrl = await ensureRunThumbnail(run);
      try { onReady(run, dataUrl); } catch { /* render-side errors are not fatal */ }
    }
  });
  await Promise.all(workers);
}
