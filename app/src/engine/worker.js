/**
 * ImageChef — Batch Processing Web Worker
 *
 * Runs the full batch job off the main thread.
 * Communicates via postMessage:
 *
 * Incoming messages (main → worker):
 *   { type: 'START', payload: { recipe, files: File[], outputConfig, runId } }
 *   { type: 'CANCEL' }
 *
 * Outgoing messages (worker → main):
 *   { type: 'PROGRESS',  payload: { runId, processed, total, filename } }
 *   { type: 'LOG',       payload: { runId, level, msg } }
 *   { type: 'FILE_DONE', payload: { runId, filename, blobs: [{filename, blob}] } }
 *   { type: 'COMPLETE',  payload: { runId, successCount, failCount } }
 *   { type: 'ERROR',     payload: { runId, msg } }
 */

// ─── Worker environment polyfills ────────────────────────────
// Web Workers have no `document` — polyfill canvas creation with OffscreenCanvas.
if (typeof document === 'undefined') {
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') return new OffscreenCanvas(1, 1);
      return {};
    }
  };
  // OffscreenCanvas lacks toBlob — add a shim backed by convertToBlob().
  if (typeof OffscreenCanvas !== 'undefined' && !OffscreenCanvas.prototype.toBlob) {
    OffscreenCanvas.prototype.toBlob = function(callback, type, quality) {
      this.convertToBlob({ type, quality }).then(callback).catch(() => callback(null));
    };
  }
}

// Import transforms to register them
import './transforms/geometry.js';
import './transforms/color.js';
import './transforms/overlays.js';
import './transforms/ai.js';
import './transforms/ai/translate.js';
import './transforms/metadata.js';
import './transforms/flow.js';

import { ImageProcessor }   from './processor.js';
import { createGIF, createVideo, createContactSheet, createPhotoStack, createAnimatedStack } from './compositor.js';
import { extractExif }       from './exif-reader.js';
import { applyRunParams }    from '../utils/nodes.js';
import { initDB }            from '../data/db.js';
import { ingestFile }        from '../data/assets.js';

let cancelled = false;

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'CANCEL') {
    cancelled = true;
    return;
  }

  if (type === 'START') {
    cancelled = false;
    await runBatch(payload);
  }
};

async function runBatch({ recipe, files, outputConfig, runId, inputHandle }) {
  const processor = new ImageProcessor();
  let successCount = 0, failCount = 0;
  const total = files.length;
  const runParams = outputConfig.runParams || {};

  // Initialise IndexedDB within the worker (IDB is available in workers).
  // This enables asset store reads/writes from transforms running here.
  let dbReady = false;
  try {
    await initDB();
    dbReady = true;
  } catch { /* non-fatal — sidecar interpolation degrades gracefully */ }

  // Resolve block-refs in recipe nodes
  const resolvedNodes = await resolveBlocks(recipe.nodes || [], outputConfig.blocks || {});
  applyRunParams(resolvedNodes, runParams);

  // Aggregation collector: aggregationId → { nodeConfig, blobs[] }
  const aggregations = {};
  for (const node of flatNodes(resolvedNodes)) {
    if (['flow-create-gif', 'flow-create-video', 'flow-video-stitcher', 'flow-geo-timeline', 'flow-contact-sheet', 'flow-photo-stack', 'flow-animate-stack', 'flow-template-aggregator', 'flow-face-swap', 'flow-bg-swap'].includes(node.transformId)) {
      aggregations[node.id] = { node, blobs: [] };
    }
    if (node.transformId === 'flow-video-wall') {
      aggregations[node.id] = { node, blobs: [], files: [] };
    }
  }

  const numAggs = Object.keys(aggregations).length;
  const totalSteps = total + numAggs;
  const runState = { injectedSlides: [], triggerStates: {} };

  log(runId, 'info', `Starting batch: ${total} file(s) — recipe "${recipe.name}"`);

  for (let i = 0; i < files.length; i++) {
    if (cancelled) {
      log(runId, 'warn', 'Batch cancelled by user.');
      break;
    }

    const file = files[i];
    log(runId, 'info', `[${i + 1}/${total}] Processing: ${file.name}`);

    try {
      const image = await loadImage(file);
      const exif  = await extractExif(file);
      const ext   = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();

      // Ingest into asset store and load any previously-geocoded sidecar data.
      let asset = null;
      if (dbReady) {
        try { asset = await ingestFile(file); } catch { /* non-fatal */ }
      }

      let fileSidecar = null;
      if (inputHandle) {
        try {
          const { readSidecar } = await import('../data/sidecar.js');
          fileSidecar = await readSidecar(inputHandle, file.name);
        } catch { /* best effort */ }
      }

      const variables = new Map();
      if (fileSidecar) {
        try {
          const { flattenSidecarVars } = await import('../data/sidecar.js');
          flattenSidecarVars(fileSidecar).forEach((v, k) => variables.set(k, v));
        } catch { /* ignore */ }
      }

      const context = {
        originalImage: image,
        originalFile:  file,
        filename: file.name,
        ext,
        exif,
        meta:      {},
        variables,
        recipe:    runParams,
        outputSubfolder: outputConfig.subfolder || 'output',
        sidecar:   fileSidecar ?? { ...(asset?.geo ?? {}), ...(asset?.sidecar ?? {}) },
        assetHash: asset?.hash ?? null,
        runState,
        inputHandle,
        log: (level, msg) => log(runId, level, msg),
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
            (agg.metadata ??= []).push(result.metadata ?? {});
          }
        } else {
          self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: result.filename, blob: result.blob, subfolder: result.subfolder } });
        }
      }

      // Write sidecar JSON — re-read asset so any enrichment (geocode etc.) is captured
      if (dbReady && context.assetHash) {
        try {
          const { getAsset } = await import('../data/assets.js');
          const latest = await getAsset(context.assetHash);
          if (latest) {
            const json = JSON.stringify(latest, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: `${file.name}.json`, blob, subfolder: '.PicMachina' } });
          }
        } catch { /* non-fatal */ }
      }

      successCount++;
    } catch (err) {
      log(runId, 'error', `FAILED: ${file.name} — ${err.message}`);
      failCount++;
    }

    self.postMessage({ type: 'PROGRESS', payload: { runId, processed: i + 1, total, filename: file.name, overridePct: Math.round(((i+1)/totalSteps)*100) } });
  }

  // Post-process aggregations
  let aggCount = 0;
  for (const [, agg] of Object.entries(aggregations)) {
    if (!agg.blobs.length) continue;
    try {
      log(runId, 'info', `Rendering aggregation: ${agg.node.transformId} (${agg.blobs.length} frames)`);
      let resultBlob;
      let format;
      const p = agg.node.params || {};

      if (agg.node.transformId === 'flow-create-gif') {
        resultBlob = await createGIF(agg.blobs, { delay: p.delay || 200, loop: p.loop !== false });
        format = 'image/gif';
        self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: p.filename || 'animation.gif', blob: resultBlob } });
      } else if (agg.node.transformId === 'flow-create-video') {
        resultBlob = await createVideo(agg.blobs, { durationPerSlide: p.durationPerSlide || 2, fps: p.fps || 30, width: p.width, height: p.height });
        format = 'video/mp4';
        self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: p.filename || 'slideshow.mp4', blob: resultBlob } });
      } else if (agg.node.transformId === 'flow-video-stitcher') {
        const { createWebGLStitcher } = await import('./stitcher.js');
        let _lastPct = -1;
        let _sTime = Date.now();
        const baseAggPct = (total + aggCount) / totalSteps;
        const aggRange = 1 / totalSteps;
        
        resultBlob = await createWebGLStitcher(agg.blobs, {
          ...p, width: p.width, height: p.height,
          onLog: (msg) => log(runId, 'info', msg),
          onProgress: (f, t) => {
            const subPct = t > 0 ? (f / t) : 0;
            const overallPct = Math.round((baseAggPct + (aggRange * subPct)) * 100);
            self.postMessage({ type: 'PROGRESS', payload: { runId, processed: total, total, filename: 'Stitching WebGL Video...', overridePct: overallPct } });
            if (t > 0) {
              const pct = Math.floor(subPct * 100);
              if (pct % 5 === 0 && pct !== _lastPct) {
                _lastPct = pct;
                let msg = `Stitching video: ${pct}% complete`;
                if (pct >= 20) {
                  const elMs = Date.now() - _sTime;
                  const remainSecs = Math.round(((elMs / (pct / 100)) - elMs) / 1000);
                  msg += ` (ETA: ~${remainSecs}s)`;
                }
                log(runId, 'info', msg);
              }
            }
          }
        });
        format = 'video/mp4';
        self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: p.filename || 'stitched.mp4', blob: resultBlob } });
      } else if (agg.node.transformId === 'flow-geo-timeline') {
        const { createGeoTimeline } = await import('./geo-timeline.js');
        let _lastPct = -1;
        let _sTime = Date.now();
        const baseAggPct = (total + aggCount) / totalSteps;
        const aggRange = 1 / totalSteps;
        
        resultBlob = await createGeoTimeline(agg.blobs, agg.metadata || [], {
          ...p, width: p.width, height: p.height,
          onLog: (msg) => log(runId, 'info', msg),
          onProgress: (f, t) => {
            const subPct = t > 0 ? (f / t) : 0;
            const overallPct = Math.round((baseAggPct + (aggRange * subPct)) * 100);
            self.postMessage({ type: 'PROGRESS', payload: { runId, processed: total, total, filename: 'Rendering Geotemporal Timeline...', overridePct: overallPct } });
            if (t > 0) {
              const pct = Math.floor(subPct * 100);
              if (pct % 5 === 0 && pct !== _lastPct) {
                _lastPct = pct;
                let msg = `Rendering timeline: ${pct}% complete`;
                if (pct >= 20) {
                  const elMs = Date.now() - _sTime;
                  const remainSecs = Math.round(((elMs / (pct / 100)) - elMs) / 1000);
                  msg += ` (ETA: ~${remainSecs}s)`;
                }
                log(runId, 'info', msg);
              }
            }
          }
        });
        format = 'video/mp4';
        self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: p.filename || 'geo-timeline.mp4', blob: resultBlob } });
      } else if (agg.node.transformId === 'flow-contact-sheet') {
        resultBlob = await createContactSheet(agg.blobs, agg.metadata, { columns: p.columns || 4, gap: p.gap || 8, groupBy1: p.groupBy1, groupBy2: p.groupBy2 });
        self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: p.filename || 'contact-sheet.jpg', blob: resultBlob } });
      } else if (agg.node.transformId === 'flow-photo-stack') {
        const fmt = p.format || 'gif';
        resultBlob = await createPhotoStack(agg.blobs, {
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
        self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: `${base}.${fmt === 'mp4' ? 'mp4' : 'gif'}`, blob: resultBlob } });
      } else if (agg.node.transformId === 'flow-animate-stack') {
        const fmt = p.format || 'gif';
        resultBlob = await createAnimatedStack(agg.blobs, {
          width:       p.width       || 1920,
          height:      p.height      || 1080,
          deskColor:   p.deskColor   || '#3d2b1a',
          frameDelay:  p.frameDelay  || 800,
          maxRotation: p.maxRotation ?? 35,
          overlap:     p.overlap     ?? 0,
          format:      fmt,
        });
        const base = (p.filename || 'stack').replace(/\.(gif|mp4)$/i, '');
        self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: `${base}.${fmt === 'mp4' ? 'mp4' : 'gif'}`, blob: resultBlob } });
      }
      aggCount++;
      self.postMessage({ type: 'PROGRESS', payload: { runId, processed: total, total, filename: `Finished ${agg.node.name || agg.node.transformId}`, overridePct: Math.round(((total + aggCount) / totalSteps) * 100) } });

    } catch (err) {
      log(runId, 'error', `Aggregation failed (${agg.node.transformId}): ${err.message}`);
    }
  }

  log(runId, 'ok', `Batch complete. ✓ ${successCount} succeeded  ✗ ${failCount} failed`);
  self.postMessage({ type: 'COMPLETE', payload: { runId, successCount, failCount } });
}

// ─── Helpers ──────────────────────────────────────────────
function log(runId, level, msg) {
  self.postMessage({ type: 'LOG', payload: { runId, level, msg, ts: Date.now() } });
}

async function loadImage(file) {
  // Web Workers have no HTMLImageElement — use createImageBitmap instead.
  // Video files can't be decoded as bitmaps — return a dummy 1×1 so the
  // processor can still run (video transforms read context.originalFile directly).
  const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  if (VIDEO_EXTS.has(ext)) return createImageBitmap(new ImageData(1, 1));
  const bitmap = await createImageBitmap(file);
  return bitmap;
}

/** Flatten all transform nodes in a node tree (ignoring branch structure). */
function flatNodes(nodes) {
  const out = [];
  for (const n of nodes) {
    if (n.type === 'transform') out.push(n);
    if (n.type === 'branch') for (const b of n.branches || []) out.push(...flatNodes(b.nodes || []));
    if (n.type === 'conditional') { out.push(...flatNodes(n.thenNodes || [])); out.push(...flatNodes(n.elseNodes || [])); }
  }
  return out;
}

/** Inline block-ref nodes from the blocks dictionary. */
async function resolveBlocks(nodes, blocks) {
  const resolved = [];
  for (const node of nodes) {
    if (node.type === 'block-ref') {
      const block = blocks[node.blockId];
      if (block) {
        resolved.push(...(await resolveBlocks(block.nodes || [], blocks)));
      } else {
        console.warn(`[worker] Block "${node.blockId}" not found — skipping`);
      }
    } else if (node.type === 'branch') {
      resolved.push({
        ...node,
        branches: await Promise.all((node.branches || []).map(async b => ({
          ...b, nodes: await resolveBlocks(b.nodes || [], blocks)
        })))
      });
    } else {
      resolved.push(node);
    }
  }
  return resolved;
}
