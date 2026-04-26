/**
 * PicMachina — run thumbnail helper
 *
 * Lazily generates and caches a small JPEG thumbnail for a completed run,
 * derived from one of the run's output files (image, or one frame from a
 * video). The result is persisted on the run record's `thumbnail` field
 * (data URL) so subsequent renders are free.
 *
 * Run → output correlation: at end-of-batch, `captureRunOutputFiles` is
 * called from `engine/batch.js` to record the exact filenames this run
 * produced into `run.outputFiles`. The thumbnail picker then opens those
 * files by name — it never has to guess by mtime or lexical order, so
 * runs sharing an output folder can't collide. For legacy runs that
 * predate the manifest, the picker falls back to mtime filtering against
 * the run's [startedAt, finishedAt] window.
 *
 * Failure is silent — every public helper resolves to a sensible empty
 * value on error (null thumbnail, empty filenames). Callers should treat
 * a null thumbnail as "not available right now" and show a placeholder.
 */

import { getRun, updateRun } from '../data/runs.js';
import { getOrCreateOutputSubfolder, listImages } from '../data/folders.js';
import { generateBaselineThumbnail } from './thumbnails.js';
import { extractVideoFrame, isVideoFile } from './video-frame.js';

/**
 * Capture the list of output filenames produced by a run and stamp them
 * onto the run record. Called once at end-of-batch (status === 'completed'),
 * when no other batch is writing to the same folder.
 *
 * Why this exists: when several runs share an output folder, we can't
 * tell at render time which file belongs to which run. By recording the
 * filenames on the run record itself — keyed by run id — we get an exact
 * correlation that survives folder churn, clock drift, and re-runs.
 *
 * The capture itself is mtime-filtered for safety (in case the folder
 * already contained files from other tools / previous runs we didn't
 * track). At end-of-batch, mtime is unambiguous because no other
 * PicMachina batch is writing concurrently.
 *
 * Mutates `run` in place and returns the captured filenames. Safe to
 * call before `updateRun(run)` — the caller persists.
 *
 * @param {object} run                            run record
 * @param {FileSystemDirectoryHandle} outputHandle parent output folder handle
 * @returns {Promise<string[]>}
 */
export async function captureRunOutputFiles(run, outputHandle) {
  if (!run || !outputHandle) return [];
  try {
    const subfolder = run.outputFolder || 'output';
    const subHandle = await getOrCreateOutputSubfolder(outputHandle, subfolder);
    const all = await listImages(subHandle, { includeVideo: true });
    const ours = filterFilesForRun(all, run);
    const names = ours.map(f => f.name);
    run.outputFiles = names;
    return names;
  } catch (err) {
    console.warn('[run-thumbnail] capture failed', err);
    return [];
  }
}

/**
 * Resolve a run's actual output File objects, in display order. Uses the
 * `run.outputFiles` manifest where available (modern runs) and falls back
 * to mtime-window filtering for legacy runs that predate the manifest.
 *
 * Includes both images and videos so callers don't have to filter.
 *
 * Returns an empty array on any failure (folder missing, permission lost,
 * etc.). Callers should treat the empty array as "nothing to show".
 *
 * @param {object} run
 * @returns {Promise<File[]>}
 */
export async function getRunOutputFiles(run) {
  if (!run || !run.outputHandleObj) return [];
  try {
    const subfolder = run.outputFolder || 'output';
    const subHandle = await getOrCreateOutputSubfolder(run.outputHandleObj, subfolder);

    if (typeof subHandle.queryPermission === 'function') {
      const perm = await subHandle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') return [];
    }

    if (Array.isArray(run.outputFiles) && run.outputFiles.length) {
      // Manifest path — open by name. Skip files that have since been
      // moved/deleted rather than throwing, so the caller still gets a
      // partial gallery.
      const files = [];
      for (const name of run.outputFiles) {
        try {
          const fh = await subHandle.getFileHandle(name);
          files.push(await fh.getFile());
        } catch { /* file gone — skip */ }
      }
      return files;
    }

    // Legacy fallback for runs that don't have a manifest yet.
    const all = await listImages(subHandle, { includeVideo: true });
    return filterFilesForRun(all, run);
  } catch (err) {
    console.warn('[run-thumbnail] getRunOutputFiles failed', err);
    return [];
  }
}

const THUMB_WIDTH  = 160;
const THUMB_HEIGHT = 100;
const THUMB_QUALITY = 0.78;

// Bump when the selection logic changes so previously-cached (now-stale)
// thumbnails are transparently regenerated on next render.
//   v1 = naive listImages()[0] — picked the lexically-first file regardless
//        of which run produced it.
//   v2 = filter by file.lastModified within [startedAt, finishedAt] —
//        correct most of the time, but reliant on filesystem clocks.
//   v3 = use `run.outputFiles` recorded at batch completion (manifest);
//        fall back to mtime filter only for runs that predate v3.
export const THUMBNAIL_VERSION = 3;

// Filesystem timestamp resolution + minor clock drift between the JS clock
// (Date.now used for startedAt/finishedAt) and what the OS stamps on files.
// We open the window slightly on both sides to avoid false negatives.
const MTIME_SLACK_BEFORE_MS = 2_000;
const MTIME_SLACK_AFTER_MS  = 5_000;

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
  if (run.status !== 'completed') return null;
  if (!run.outputHandleObj) return null;

  // Use the cached value only if it was generated by the current selection
  // logic. Older versions may have picked the wrong file from a shared
  // output folder, so we transparently regenerate them.
  if (run.thumbnail && run.thumbnailVersion === THUMBNAIL_VERSION) {
    return run.thumbnail;
  }

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

    // Pick the source file. Two strategies, in priority order:
    //
    // 1. Manifest: `run.outputFiles` is recorded at batch completion and
    //    contains the exact filenames this run produced. This is the
    //    correct source of truth — it correlates outputs to runs by id,
    //    not by guessing — and works even when several runs share a
    //    single output folder.
    //
    // 2. Legacy fallback: for runs created before the manifest existed,
    //    we filter the folder listing by `lastModified` against the run's
    //    [startedAt, finishedAt] window. Best-effort only.
    let first = null;
    if (Array.isArray(run.outputFiles) && run.outputFiles.length) {
      for (const name of run.outputFiles) {
        try {
          const fh = await subHandle.getFileHandle(name);
          first = await fh.getFile();
          break;
        } catch { /* file may have been moved/deleted — try next */ }
      }
      if (!first) return null;
    } else {
      const allFiles = await listImages(subHandle, { includeVideo: true });
      if (!allFiles.length) return null;
      const ours = filterFilesForRun(allFiles, run);
      if (!ours.length) return null;
      first = ours[0];
    }

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
    run.thumbnailVersion = THUMBNAIL_VERSION;
    run.thumbnailSourceName = first.name;
    if (persist) {
      // Re-fetch in case other writes (e.g. log appends) raced; merge
      // thumbnail onto the freshest record.
      const fresh = await getRun(run.id);
      const target = fresh || run;
      target.thumbnail = dataUrl;
      target.thumbnailVersion = THUMBNAIL_VERSION;
      target.thumbnailSourceName = first.name;
      await updateRun(target);
    }
    return dataUrl;
  } catch (err) {
    console.warn('[run-thumbnail] generation failed', err);
    return null;
  }
}

/**
 * Narrow a folder's full file list down to the ones produced by a specific
 * run, using `file.lastModified` against the run's start/finish window.
 * Sorted ascending by mtime so callers can pick the earliest output —
 * the most stable choice across re-runs and parallel writes.
 */
function filterFilesForRun(files, run) {
  const start = (run.startedAt || 0) - MTIME_SLACK_BEFORE_MS;
  const end = (run.finishedAt || Date.now()) + MTIME_SLACK_AFTER_MS;
  return files
    .filter(f => {
      const m = f.lastModified;
      if (!Number.isFinite(m)) return false;
      return m >= start && m <= end;
    })
    .sort((a, b) => a.lastModified - b.lastModified);
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
  const queue = runs.filter(r =>
    r.status === 'completed' &&
    r.outputHandleObj &&
    (!r.thumbnail || r.thumbnailVersion !== THUMBNAIL_VERSION)
  );
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
