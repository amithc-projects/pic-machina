/**
 * ImageChef — Batch runner (main thread side)
 *
 * Spawns the Web Worker for standard recipes.
 * Falls back to running on the main thread for recipes that contain AI transforms
 * (MediaPipe / Tesseract) which require DOM APIs unavailable in Web Workers.
 *
 * Coordinates file writes via File System Access API and routes progress/log
 * messages to the run record.
 */

import { writeFile, getOrCreateOutputSubfolder } from '../data/folders.js';
import { createRun, updateRun, appendLog }        from '../data/runs.js';
import { getAllBlocks }                            from '../data/blocks.js';
import { ImageProcessor }                         from './processor.js';
import { extractExif }                            from './exif-reader.js';
import { createGIF, createVideo, createContactSheet, createPhotoStack, createAnimatedStack } from './compositor.js';
import { createVideoWall } from './video-wall.js';
import { applyRunParams }                         from '../utils/nodes.js';

// ─── AI transform IDs that require the main thread ───────
const MAIN_THREAD_TRANSFORMS = new Set([
  'ai-remove-bg',
  'ai-face-privacy',
  'ai-silhouette',
  'ai-smart-redact',
  // gif.js requires HTMLCanvasElement (not OffscreenCanvas) so must run on main thread
  'flow-photo-stack',
  'flow-animate-stack',
  // video-wall uses document.fonts (loadHandwritingFont) — must run on main thread
  'flow-video-wall',
]);

function flattenNodes(nodes) {
  const out = [];
  for (const n of nodes) {
    if (n.type === 'transform') out.push(n);
    if (n.type === 'branch') for (const b of n.branches || []) out.push(...flattenNodes(b.nodes || []));
    if (n.type === 'conditional') { out.push(...flattenNodes(n.thenNodes || [])); out.push(...flattenNodes(n.elseNodes || [])); }
  }
  return out;
}

function resolveBlocks(nodes, blocks) {
  const resolved = [];
  for (const node of nodes) {
    if (node.type === 'block-ref') {
      const block = blocks[node.blockId];
      if (block) resolved.push(...resolveBlocks(block.nodes || [], blocks));
      else console.warn(`[batch] Block "${node.blockId}" not found — skipping`);
    } else if (node.type === 'branch') {
      resolved.push({
        ...node,
        branches: (node.branches || []).map(b => ({ ...b, nodes: resolveBlocks(b.nodes || [], blocks) }))
      });
    } else {
      resolved.push(node);
    }
  }
  return resolved;
}

function recipeNeedsMainThread(recipe) {
  return flattenNodes(recipe.nodes || []).some(n => MAIN_THREAD_TRANSFORMS.has(n.transformId));
}

// ─── Worker path ──────────────────────────────────────────
let _worker = null;

function getWorker() {
  if (!_worker) {
    _worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  }
  return _worker;
}

// ─── Main-thread batch runner ─────────────────────────────
async function runMainThreadBatch({ recipe, files, outputHandle, subfolder, blocksById, runParams, run, onProgress, onLog, onComplete }) {
  const subHandle = await getOrCreateOutputSubfolder(outputHandle, subfolder);
  const processor = new ImageProcessor();
  const total = files.length;

  const resolvedNodes = resolveBlocks(recipe.nodes || [], blocksById);
  applyRunParams(resolvedNodes, runParams);

  // Aggregation collector (GIF / video / contact sheet)
  const aggregations = {};
  for (const node of flattenNodes(resolvedNodes)) {
    if (['flow-create-gif', 'flow-create-video', 'flow-contact-sheet', 'flow-photo-stack', 'flow-animate-stack'].includes(node.transformId)) {
      aggregations[node.id] = { node, blobs: [] };
    }
    if (node.transformId === 'flow-video-wall') {
      aggregations[node.id] = { node, blobs: [], files: [] };
    }
  }

  onLog('info', `Starting batch: ${total} file(s) — recipe "${recipe.name}"`);

  let successCount = 0, failCount = 0;

  for (let i = 0; i < files.length; i++) {
    if (run._cancelled) {
      onLog('warn', 'Batch cancelled by user.');
      break;
    }

    const file = files[i];
    onLog('info', `[${i + 1}/${total}] Processing: ${file.name}`);

    try {
      const ext   = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
      const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);
      // Video files can't be decoded as images — use a dummy 1×1 bitmap so the
      // processor can still run (video-wall aggregation only needs originalFile).
      const image = VIDEO_EXTS.has(ext)
        ? await createImageBitmap(new ImageData(1, 1))
        : await createImageBitmap(file);
      const exif  = await extractExif(file);

      const context = {
        originalImage: image,
        originalFile:  file,
        filename: file.name,
        ext,
        exif,
        meta:      {},
        variables: new Map(),
        recipe:    runParams || {},
        outputSubfolder: subfolder || 'output',
      };

      const results = await processor.process(image, resolvedNodes, context);

      for (const result of results) {
        if (result.aggregationId && aggregations[result.aggregationId]) {
          const agg = aggregations[result.aggregationId];
          if (result.file) {
            agg.files.push(result.file);
          } else {
            agg.blobs.push(result.blob);
            (agg.captions ??= []).push(result.caption ?? '');
          }
        } else {
          try {
            const folder = result.subfolder
              ? await getOrCreateOutputSubfolder(outputHandle, result.subfolder)
              : subHandle;
            await writeFile(folder, result.filename, result.blob);
          } catch (err) {
            onLog('error', `Write failed: ${result.filename} — ${err.message}`);
          }
        }
      }

      successCount++;
    } catch (err) {
      onLog('error', `FAILED: ${file.name} — ${err.message}`);
      failCount++;
    }

    onProgress(i + 1, total, file.name);

    // Yield to keep the UI responsive between files
    await new Promise(res => setTimeout(res, 0));
  }

  // Post-process aggregations
  for (const [, agg] of Object.entries(aggregations)) {
    // Video wall uses files[], all others use blobs[]
    if (agg.node.transformId === 'flow-video-wall') {
      if (!agg.files?.length) continue;
      try {
        onLog('info', `Rendering video wall: ${agg.files.length} video(s)`);
        const p        = agg.node.params || {};
        const captions = (p.captions || '').split(',').map(s => s.trim());
        const blob     = await createVideoWall(agg.files, {
          layout:           p.layout           || 'grid-2x2',
          fps:              Number(p.fps)       || 30,
          outputWidth:      Number(p.outputWidth)  || 1920,
          outputHeight:     Number(p.outputHeight) || 1080,
          captions,
          endOfVideo:       p.endOfVideo       || 'black',
          fallbackImageUrl: p.fallbackImageUrl || null,
          endText:          p.endText          || 'No Signal Detected',
          bitrate:          Number(p.bitrate)  || 8_000_000,
          onProgress:       (pct, label) => onLog('info', label),
        });
        await writeFile(subHandle, p.filename || 'video-wall.mp4', blob);
      } catch (err) {
        onLog('error', `Video wall failed: ${err.message}`);
      }
      continue;
    }

    if (!agg.blobs.length) continue;
    try {
      onLog('info', `Rendering aggregation: ${agg.node.transformId} (${agg.blobs.length} frames)`);
      const p = agg.node.params || {};
      if (agg.node.transformId === 'flow-create-gif') {
        const blob = await createGIF(agg.blobs, { delay: p.delay || 200, loop: p.loop !== false });
        await writeFile(subHandle, p.filename || 'animation.gif', blob);
      } else if (agg.node.transformId === 'flow-create-video') {
        const blob = await createVideo(agg.blobs, { durationPerSlide: p.durationPerSlide || 2, fps: p.fps || 30 });
        await writeFile(subHandle, p.filename || 'slideshow.mp4', blob);
      } else if (agg.node.transformId === 'flow-contact-sheet') {
        const blob = await createContactSheet(agg.blobs, { columns: p.columns || 4, gap: p.gap || 8 });
        await writeFile(subHandle, p.filename || 'contact-sheet.jpg', blob);
      } else if (agg.node.transformId === 'flow-photo-stack') {
        const fmt  = p.format || 'gif';
        const blob = await createPhotoStack(agg.blobs, {
          width:        p.width        || 1920,
          height:       p.height       || 1080,
          deskColor:    p.deskColor    || '#3d2b1a',
          frameDelay:   p.frameDelay   || 800,
          maxRotation:  p.maxRotation  ?? 35,
          borderColor:  p.borderColor  || '#f5f5f0',
          borderBottom: p.borderBottom || 60,
          format:       fmt,
          captions:     agg.captions   || [],
          overlap:      p.overlap      ?? 0,
        });
        const base = (p.filename || 'photo-stack').replace(/\.(gif|mp4)$/i, '');
        await writeFile(subHandle, `${base}.${fmt === 'mp4' ? 'mp4' : 'gif'}`, blob);
      } else if (agg.node.transformId === 'flow-animate-stack') {
        const fmt  = p.format || 'gif';
        const blob = await createAnimatedStack(agg.blobs, {
          width:       p.width       || 1920,
          height:      p.height      || 1080,
          deskColor:   p.deskColor   || '#3d2b1a',
          frameDelay:  p.frameDelay  || 800,
          maxRotation: p.maxRotation ?? 35,
          overlap:     p.overlap     ?? 0,
          format:      fmt,
        });
        const base = (p.filename || 'stack').replace(/\.(gif|mp4)$/i, '');
        await writeFile(subHandle, `${base}.${fmt === 'mp4' ? 'mp4' : 'gif'}`, blob);
      }
    } catch (err) {
      onLog('error', `Aggregation failed (${agg.node.transformId}): ${err.message}`);
    }
  }

  onLog('ok', `Batch complete. ✓ ${successCount} succeeded  ✗ ${failCount} failed`);

  run.finishedAt   = Date.now();
  run.status       = 'completed';
  run.successCount = successCount;
  run.failCount    = failCount;
  await updateRun(run);
  onComplete(run);
}

// ─── Public API ───────────────────────────────────────────

/**
 * Start a batch job.
 *
 * @param {object} opts
 * @param {object}   opts.recipe         — full recipe object with nodes
 * @param {File[]}   opts.files          — input File array
 * @param {FileSystemDirectoryHandle} opts.outputHandle — output folder handle
 * @param {string}   opts.subfolder      — sub-folder name (default 'output')
 * @param {function} opts.onProgress     — (processed, total, filename) => void
 * @param {function} opts.onLog          — (level, msg) => void
 * @param {function} opts.onComplete     — (run) => void
 * @param {function} opts.onError        — (msg) => void
 * @returns {{ cancel: function, runId: string }}
 */
export async function startBatch({ recipe, files, outputHandle, subfolder = 'output', runParams = {}, onProgress, onLog, onComplete, onError }) {
  const allBlocks  = await getAllBlocks();
  const blocksById = Object.fromEntries(allBlocks.map(b => [b.id, b]));

  const run = await createRun({
    recipeId:     recipe.id,
    recipeName:   recipe.name,
    inputFolder:  '',
    outputFolder: subfolder,
    imageCount:   files.length,
  });

  // Wrap callbacks to also persist log entries to the run record
  const wrappedLog = async (level, msg) => {
    await appendLog(run, level, msg);
    onLog?.(level, msg);
  };
  const wrappedProgress = (p, t, fn) => onProgress?.(p, t, fn);
  const wrappedComplete  = (r) => onComplete?.(r);

  // ── Route: AI transforms need the main thread ────────────
  if (recipeNeedsMainThread(recipe)) {
    // Fire the batch as an async task so we can return { runId, cancel } immediately
    runMainThreadBatch({
      recipe, files, outputHandle, subfolder, blocksById, runParams, run,
      onProgress: wrappedProgress,
      onLog:      wrappedLog,
      onComplete: wrappedComplete,
    }).catch(err => {
      console.error('[batch] Main-thread batch crashed:', err);
      onError?.(err.message);
    });

    return {
      runId: run.id,
      cancel: async () => {
        run._cancelled   = true;
        run.status       = 'cancelled';
        run.finishedAt   = Date.now();
        await updateRun(run);
      }
    };
  }

  // ── Route: standard worker path ──────────────────────────
  const subHandle = await getOrCreateOutputSubfolder(outputHandle, subfolder);
  const worker = getWorker();

  worker.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (payload.runId !== run.id) return;

    if (type === 'PROGRESS') {
      run.successCount = payload.processed;
      wrappedProgress(payload.processed, payload.total, payload.filename);
    }

    if (type === 'LOG') {
      await appendLog(run, payload.level, payload.msg);
      onLog?.(payload.level, payload.msg);
    }

    if (type === 'FILE_DONE') {
      try {
        const folder = payload.subfolder ? await getOrCreateOutputSubfolder(outputHandle, payload.subfolder) : subHandle;
        await writeFile(folder, payload.filename, payload.blob);
      } catch (err) {
        onLog?.('error', `Write failed: ${payload.filename} — ${err.message}`);
      }
    }

    if (type === 'COMPLETE') {
      run.finishedAt    = Date.now();
      run.status        = 'completed';
      run.successCount  = payload.successCount;
      run.failCount     = payload.failCount;
      await updateRun(run);
      wrappedComplete(run);
    }

    if (type === 'ERROR') {
      run.status     = 'failed';
      run.finishedAt = Date.now();
      await updateRun(run);
      onError?.(payload.msg);
    }
  };

  worker.postMessage({
    type: 'START',
    payload: {
      recipe,
      files,
      outputConfig: { subfolder, blocks: blocksById, runParams },
      runId: run.id,
    }
  });

  return {
    runId: run.id,
    cancel: async () => {
      worker.postMessage({ type: 'CANCEL', payload: { runId: run.id } });
      run.status     = 'cancelled';
      run.finishedAt = Date.now();
      await updateRun(run);
    }
  };
}
