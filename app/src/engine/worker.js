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
import './transforms/metadata.js';
import './transforms/flow.js';

import { ImageProcessor }   from './processor.js';
import { createGIF, createVideo, createContactSheet, createPhotoStack, createAnimatedStack } from './compositor.js';
import { extractExif }       from './exif-reader.js';
import { applyRunParams }    from '../utils/nodes.js';

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

async function runBatch({ recipe, files, outputConfig, runId }) {
  const processor = new ImageProcessor();
  let successCount = 0, failCount = 0;
  const total = files.length;
  const runParams = outputConfig.runParams || {};

  // Resolve block-refs in recipe nodes
  const resolvedNodes = await resolveBlocks(recipe.nodes || [], outputConfig.blocks || {});
  applyRunParams(resolvedNodes, runParams);

  // Aggregation collector: aggregationId → { nodeConfig, blobs[] }
  const aggregations = {};
  for (const node of flatNodes(resolvedNodes)) {
    if (['flow-create-gif', 'flow-create-video', 'flow-contact-sheet', 'flow-photo-stack', 'flow-animate-stack'].includes(node.transformId)) {
      aggregations[node.id] = { node, blobs: [] };
    }
    if (node.transformId === 'flow-video-wall') {
      aggregations[node.id] = { node, blobs: [], files: [] };
    }
  }

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

      const context = {
        originalImage: image,
        originalFile:  file,
        filename: file.name,
        ext,
        exif,
        meta:      {},
        variables: new Map(),
        recipe:    runParams,
        outputSubfolder: outputConfig.subfolder || 'output',
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
          self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: result.filename, blob: result.blob, subfolder: result.subfolder } });
        }
      }

      successCount++;
    } catch (err) {
      log(runId, 'error', `FAILED: ${file.name} — ${err.message}`);
      failCount++;
    }

    self.postMessage({ type: 'PROGRESS', payload: { runId, processed: i + 1, total, filename: file.name } });
  }

  // Post-process aggregations
  for (const [aggId, agg] of Object.entries(aggregations)) {
    if (!agg.blobs.length) continue;
    try {
      log(runId, 'info', `Rendering aggregation: ${agg.node.transformId} (${agg.blobs.length} frames)`);
      let resultBlob;
      const p = agg.node.params || {};

      if (agg.node.transformId === 'flow-create-gif') {
        resultBlob = await createGIF(agg.blobs, { delay: p.delay || 200, loop: p.loop !== false });
        self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: p.filename || 'animation.gif', blob: resultBlob } });
      } else if (agg.node.transformId === 'flow-create-video') {
        resultBlob = await createVideo(agg.blobs, { durationPerSlide: p.durationPerSlide || 2, fps: p.fps || 30 });
        self.postMessage({ type: 'FILE_DONE', payload: { runId, filename: p.filename || 'slideshow.mp4', blob: resultBlob } });
      } else if (agg.node.transformId === 'flow-contact-sheet') {
        resultBlob = await createContactSheet(agg.blobs, { columns: p.columns || 4, gap: p.gap || 8 });
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
