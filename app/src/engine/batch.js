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
import { captureRunOutputFiles }                  from '../utils/run-thumbnail.js';
import { readSidecar, flattenSidecarVars }        from '../data/sidecar.js';
import { getAllBlocks }                            from '../data/blocks.js';
import { ImageProcessor }                         from './processor.js';
import { extractExif }                            from './exif-reader.js';
import { ingestFile }                             from '../data/assets.js';
import { createGIF, createVideo, createPDF, createPPTX, createContactSheet, createPhotoStack, createAnimatedStack } from './compositor.js';
import { createVideoWall } from './video-wall.js';
import { applyRunParams }                         from '../utils/nodes.js';
import { registry }                               from './registry.js';

// Ensure all transforms are registered for main-thread batch processing
import './transforms/geometry.js';
import './transforms/color.js';
import './transforms/overlays.js';
import './transforms/ai.js';
import './transforms/ai/translate.js';
import './transforms/metadata.js';
import './transforms/flow.js';
import './transforms/video.js';

// ─── Transform IDs that require the main thread ──────────
const MAIN_THREAD_TRANSFORMS = new Set([
  'ai-remove-bg',
  'ai-remove-bg-hq',
  'ai-portrait-bokeh',
  'ai-drop-shadow',
  'ai-sticker-outline',
  'ai-subject-glow',
  'ai-export-matte',
  'ai-subject-crop',
  'ai-subject-vignette',
  'ai-selective-grade',
  'ai-subject-sharpen',
  'ai-face-privacy',
  'ai-silhouette',
  'ai-smart-redact',
  // gif.js requires HTMLCanvasElement (not OffscreenCanvas) so must run on main thread
  'flow-photo-stack',
  'flow-animate-stack',
  // video-wall uses document.fonts (loadHandwritingFont) — must run on main thread
  'flow-video-wall',
  // video-extract-frame uses <video> element — not available in workers
  'video-extract-frame',
  // flow-template-aggregator draws onto canvas on the main thread
  'flow-template-aggregator',
  // flow-gif-from-states uses gif.js which needs HTMLCanvasElement
  'flow-gif-from-states',
  // ai-ocr-tag reads from IndexedDB asset store (needs main thread path for IDB)
  'ai-ocr-tag',
  // ai-chroma-key uses onnxruntime-web (via InSPyReNet) when AI refine is on — main thread only
  'ai-chroma-key',
  // ai-analyse-people uses MediaPipe which requires the main thread
  'ai-analyse-people',
  // Geometry transformers using MediaPipe AI (Tasks Vision) require the main thread
  'geo-face-crop',
  'geo-body-crop',
  'geo-face-align',
  'flow-face-swap',
  'flow-bg-swap',
  // Title slides need custom Web Fonts from the main thread document to render beautifully
  'flow-title-slide',
  // PDF, PPTX, and ZIP creation rely on DOM APIs or have large main thread dependencies
  'flow-create-pdf',
  'flow-create-pptx',
  'flow-create-zip',
  // Video conversion/trimming/compression/effects use mediabunny (WebCodecs + HTMLVideoElement)
  'flow-video-convert',
  'flow-video-trim',
  'flow-video-compress',
  'flow-video-change-fps',
  'flow-video-speed',       // seek-based re-encode — needs HTMLVideoElement (main thread only)
  'flow-video-concat',
  'flow-video-strip-audio',
  'flow-video-extract-audio',
  'flow-video-remix-audio',
  // HTML-in-Canvas experimental overlay uses real DOM
  'overlay-timer',
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

const CANVAS_CATEGORY_KEYS = new Set(['geo', 'color', 'overlay']);
const VIDEO_INPUT_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);

function recipeNeedsMainThread(recipe, files = []) {
  if (flattenNodes(recipe.nodes || []).some(n => {
    const def = registry.get(n.transformId);
    return MAIN_THREAD_TRANSFORMS.has(n.transformId) || (def && def.mainThread);
  })) return true;

  // video-effect transforms (per-frame mediabunny effects) always need main thread
  if (flattenNodes(recipe.nodes || []).some(n => registry.get(n.transformId)?.categoryKey === 'video-effect')) return true;

  // Canvas transforms applied to video files need main thread (mediabunny + WebCodecs)
  const hasVideoFiles = files.some(f => VIDEO_INPUT_EXTS.has(f.name.slice(f.name.lastIndexOf('.') + 1).toLowerCase()));
  if (hasVideoFiles || recipe.inputType === 'video') {
    if (flattenNodes(recipe.nodes || []).some(n => {
      const def = registry.get(n.transformId);
      return def && (CANVAS_CATEGORY_KEYS.has(def.categoryKey) || def.categoryKey === 'flow');
    })) return true;
  }
  return false;
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
async function runMainThreadBatch({ recipe, files, inputHandle, outputHandle, subfolder, blocksById, runParams, run, onProgress, onLog, onComplete }) {
  const subHandle = await getOrCreateOutputSubfolder(outputHandle, subfolder);
  const processor = new ImageProcessor();
  const total = files.length;

  const resolvedNodes = resolveBlocks(recipe.nodes || [], blocksById);
  applyRunParams(resolvedNodes, runParams);

  // Aggregation collector (GIF / video / contact sheet / zip)
  const aggregations = {};
  for (const node of flattenNodes(resolvedNodes)) {
    if (['flow-create-gif', 'flow-create-video', 'flow-create-pdf', 'flow-create-pptx', 'flow-create-zip', 'flow-video-stitcher', 'flow-geo-timeline', 'flow-contact-sheet', 'flow-photo-stack', 'flow-animate-stack', 'flow-template-aggregator', 'flow-face-swap', 'flow-bg-swap', 'flow-face-morph', 'flow-render-hyperframe'].includes(node.transformId)) {
      aggregations[node.id] = { node, blobs: [] };
    }
    if (node.transformId === 'flow-video-wall') {
      aggregations[node.id] = { node, blobs: [], files: [] };
    }
    if (node.transformId === 'flow-video-concat') {
      aggregations[node.id] = { node, files: [] };
    }
  }

  onLog('info', `Starting batch: ${total} file(s) — recipe "${recipe.name}"`);

  let successCount = 0, failCount = 0;
  const numAggs = Object.keys(aggregations).length;
  const totalSteps = total + numAggs;
  const runState = { injectedSlides: [], triggerStates: {} };

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

      // Persist this file to the asset store (idempotent — no-op if already ingested).
      const asset = await ingestFile(file);

      // Read sidecar from input folder (if available) so {{sidecar.*}} vars resolve
      const fileSidecar = inputHandle
        ? await readSidecar(inputHandle, file.name)
        : null;

      const variables = new Map();
      if (fileSidecar) {
        flattenSidecarVars(fileSidecar).forEach((v, k) => variables.set(k, v));
      }

      const context = {
        originalImage: image,
        originalFile:  file,
        filename: file.name,
        ext,
        exif,
        meta:      {},
        variables,
        recipe:    runParams || {},
        outputSubfolder: subfolder || 'output',
        sidecar:   fileSidecar ?? { ...(asset.geo ?? {}), ...(asset.sidecar ?? {}) },
        assetHash: asset.hash,
        inputHandle,
        fileIndex: i,
        runState,
        sidecarWrites: {},   // meta-sidecar-write transform accumulates here
        log: (level, msg) => onLog(level, msg),
      };

      const results = await processor.process(image, resolvedNodes, context);

      for (const result of results) {
        if (result.aggregationId && aggregations[result.aggregationId]) {
          const agg = aggregations[result.aggregationId];
          if (result.file) {
            agg.files.push(result.file);
          } else {
            agg.blobs.push(result.blob);
            (agg.captions     ??= []).push(result.caption ?? '');
            (agg.metadata     ??= []).push(result.metadata ?? {});
            (agg.originalNames??= []).push(context.originalFile?.name ?? result.filename);
            (agg.originalFiles??= []).push(context.originalFile ?? null);
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

      // Flush sidecar writes from meta-sidecar-write transform back to input folder
      if (inputHandle && Object.keys(context.sidecarWrites || {}).length > 0) {
        try {
          const { writeSidecar } = await import('../data/sidecar.js');
          const existing = await readSidecar(inputHandle, file.name) ?? {};
          existing.computed = { ...(existing.computed || {}), ...context.sidecarWrites };
          await writeSidecar(inputHandle, file.name, existing);
        } catch (err) {
          onLog('warn', `Sidecar write-back failed: ${file.name} — ${err.message}`);
        }
      }

      // Write internal .PicMachina sidecar to output folder (asset record snapshot)
      if (context.assetHash) {
        try {
          const { getAsset } = await import('../data/assets.js');
          const latest = await getAsset(context.assetHash);
          if (latest) {
            const json = JSON.stringify(latest, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const sidecarFolder = await getOrCreateOutputSubfolder(subHandle, '.PicMachina');
            await writeFile(sidecarFolder, `${file.name}.json`, blob);
          }
        } catch { /* non-fatal */ }
      }

      successCount++;
    } catch (err) {
      onLog('error', `FAILED: ${file.name} — ${err.message}`);
      failCount++;
    }

    onProgress(i + 1, total, file.name, Math.round(((i + 1) / totalSteps) * 100));

    // Yield to keep the UI responsive between files
    await new Promise(res => setTimeout(res, 0));
  }

  // Post-process aggregations
  let aggCount = 0;
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
      
      aggCount++;
      onProgress(total, total, `Video Wall Complete`, Math.round(((total + aggCount) / totalSteps) * 100));
      continue;
    }

    if (agg.node.transformId === 'flow-video-concat') {
      if (!agg.files?.length) continue;
      try {
        onLog('info', `Concatenating ${agg.files.length} video file(s)...`);
        const p = agg.node.params || {};
        const { concatVideos } = await import('./video-convert.js');
        const blob = await concatVideos(agg.files, {
          fps:     p.fps     || 30,
          width:   p.width   || undefined,
          height:  p.height  || undefined,
          bitrate: p.bitrate || 8_000_000,
          transitionMode: p.transitionMode || 'none',
          transitionDuration: Number(p.transitionDuration) || 0,
          onLog,
        });
        let fname = p.filename || 'concatenated.mp4';
        if (!fname.toLowerCase().endsWith('.mp4')) fname += '.mp4';
        await writeFile(subHandle, fname, blob);
        onLog('ok', `Concatenation complete → ${fname}`);
      } catch (err) {
        onLog('error', `Video concat failed: ${err.message}`);
      }
      aggCount++;
      onProgress(total, total, 'Video Concat Complete', Math.round(((total + aggCount) / totalSteps) * 100));
      continue;
    }

    // Note: flow-render-hyperframe generates content from scratch so it does not require input blobs
    if (!agg.blobs.length && agg.node.transformId !== 'flow-render-hyperframe') continue;
    try {
      onLog('info', `Rendering aggregation: ${agg.node.transformId} (${agg.blobs.length} frames)`);
      const p = agg.node.params || {};
      if (agg.node.transformId === 'flow-create-gif') {
        const blob = await createGIF(agg.blobs, { delay: p.delay || 200, loop: p.loop !== false });
        await writeFile(subHandle, p.filename || 'animation.gif', blob);
      } else if (agg.node.transformId === 'flow-create-video') {
        const blob = await createVideo(agg.blobs, { durationPerSlide: p.durationPerSlide || 2, fps: p.fps || 30, width: p.width, height: p.height });
        await writeFile(subHandle, p.filename || 'slideshow.mp4', blob);
      } else if (agg.node.transformId === 'flow-create-pdf') {
        const blob = await createPDF(agg.blobs, { orientation: p.orientation, format: p.format, quality: p.quality });
        let fname = p.filename || 'document.pdf';
        if (!fname.toLowerCase().endsWith('.pdf')) fname += '.pdf';
        await writeFile(subHandle, fname, blob);
      } else if (agg.node.transformId === 'flow-create-pptx') {
        const blob = await createPPTX(agg.blobs, { layout: p.layout });
        let fname = p.filename || 'presentation.pptx';
        if (!fname.toLowerCase().endsWith('.pptx')) fname += '.pptx';
        await writeFile(subHandle, fname, blob);
      } else if (agg.node.transformId === 'flow-create-zip') {
        const { createZIP } = await import('./compositor.js');
        const blob = await createZIP(agg.blobs, agg.originalNames || []);
        let fname = p.filename || 'archive.zip';
        if (!fname.toLowerCase().endsWith('.zip')) fname += '.zip';
        await writeFile(subHandle, fname, blob);
      } else if (agg.node.transformId === 'flow-video-stitcher') {
        const { createWebGLStitcher } = await import('./stitcher.js');
        let _lastPct = -1;
        let _sTime = Date.now();
        const baseAggPct = (total + aggCount) / totalSteps;
        const aggRange = 1 / totalSteps;

        const blob = await createWebGLStitcher(agg.blobs, {
          ...p, width: p.width, height: p.height,
          onLog: (msg) => onLog('info', msg),
          onProgress: (f, t) => {
            const subPct = t > 0 ? (f / t) : 0;
            const overallPct = Math.round((baseAggPct + (aggRange * subPct)) * 100);
            onProgress(total, total, 'Stitching WebGL Video...', overallPct);
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
                onLog('info', msg);
              }
            }
          }
        });
        await writeFile(subHandle, p.filename || 'stitched.mp4', blob);
      } else if (agg.node.transformId === 'flow-geo-timeline') {
        const { createGeoTimeline } = await import('./geo-timeline.js');
        let _lastPct = -1;
        let _sTime = Date.now();
        const baseAggPct = (total + aggCount) / totalSteps;
        const aggRange = 1 / totalSteps;

        const blob = await createGeoTimeline(agg.blobs, agg.metadata || [], agg.originalNames || [], {
          ...p, width: p.width, height: p.height,
          onLog: (msg) => onLog('info', msg),
          onProgress: (f, t) => {
            const subPct = t > 0 ? (f / t) : 0;
            const overallPct = Math.round((baseAggPct + (aggRange * subPct)) * 100);
            onProgress(total, total, 'Rendering Geotemporal Timeline...', overallPct);
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
                onLog('info', msg);
              }
            }
          }
        });
        await writeFile(subHandle, p.filename || 'geo-timeline.mp4', blob);
      } else if (agg.node.transformId === 'flow-contact-sheet') {
        p.filename = p.filename || 'contact-sheet.jpg'; // HACK: needed for progress UI mapping
        const blob = await createContactSheet(agg.blobs, agg.metadata, { columns: p.columns || 4, gap: p.gap || 8, groupBy1: p.groupBy1, groupBy2: p.groupBy2 });
        await writeFile(subHandle, p.filename || 'contact-sheet.jpg', blob);
      } else if (agg.node.transformId === 'flow-photo-stack') {
        const fmt  = p.format || 'gif';
        const blob = await createPhotoStack(agg.blobs, {
          width:          p.width          || 1920,
          height:         p.height         || 1080,
          deskColor:      p.deskColor      || '#3d2b1a',
          frameDelay:     p.frameDelay     || 800,
          maxRotation:    p.maxRotation    ?? 35,
          borderColor:    p.borderColor    || '#f5f5f0',
          borderBottom:   p.borderBottom   || 60,
          format:         fmt,
          captions:       agg.captions     || [],
          overlap:        p.overlap        ?? 0,
          isolateSubject: !!p.isolateSubject,
          log:            onLog,
        });
        const base = (p.filename || 'photo-stack').replace(/\.(gif|mp4)$/i, '');
        await writeFile(subHandle, `${base}.${fmt === 'mp4' ? 'mp4' : 'gif'}`, blob);
      } else if (agg.node.transformId === 'flow-animate-stack') {
        const blob = await createAnimatedStack(agg.blobs, {
          ...p,
          width:          p.width          || 1920,
          height:         p.height         || 1080,
          fps:            p.fps            || 30,
          durationPerPhoto: p.durationPerPhoto || 1.5,
          bgColor:        p.bgColor        || '#000000',
          captions:       agg.captions     || [],
          isolateSubject: !!p.isolateSubject,
          log:            onLog,
        });
        const fmt = p.format || 'gif';
        const base = (p.filename || 'animated-stack').replace(/\.(gif|mp4)$/i, '');
        await writeFile(subHandle, `${base}.${fmt === 'mp4' ? 'mp4' : 'gif'}`, blob);
      } else if (agg.node.transformId === 'flow-face-swap') {
        const { createFaceSwap } = await import('./face-swap.js');
        const N = agg.blobs.length;
        if (N >= 2) {
          const suffix = p.suffix || '_swap';
          // Helpers for filenames
          const getName = (idx) => (agg.originalNames?.[idx] || `face_${idx}.jpg`).replace(/\.[^/.]+$/, "");
          
          if (N === 2) {
            onLog('info', 'Swapping faces between 2 images...');
            // Swap both ways
            try {
              const b1 = await createFaceSwap(agg.blobs[0], agg.blobs[1], p);
              await writeFile(subHandle, `${getName(1)}${suffix}.jpg`, b1);
            } catch(e) { onLog('error', `Swap forward failed: ${e.message}`); }
            
            try {
              const b2 = await createFaceSwap(agg.blobs[1], agg.blobs[0], p);
              await writeFile(subHandle, `${getName(0)}${suffix}.jpg`, b2);
            } catch(e) { onLog('error', `Swap reverse failed: ${e.message}`); }
          } else {
            onLog('info', `Swapping face from image 1 onto ${N - 1} other images...`);
            // N > 2: Image 1 goes onto all others
            for (let i = 1; i < N; i++) {
              try {
                const bi = await createFaceSwap(agg.blobs[0], agg.blobs[i], p);
                await writeFile(subHandle, `${getName(i)}${suffix}.jpg`, bi);
              } catch(e) { onLog('error', `Swap onto ${getName(i)} failed: ${e.message}`); }
            }
          }
        }
      } else if (agg.node.transformId === 'flow-face-morph') {
        const { createFaceMorphVideo } = await import('./face-morph.js');
        if (agg.blobs.length < 2) {
          onLog('warn', 'Face Morph needs at least 2 images. Skipping.');
        } else {
          onLog('info', `Generating Face Morph video across ${agg.blobs.length} faces...`);
          try {
            const blob = await createFaceMorphVideo(agg.blobs, {
              duration: p.duration || 4,
              fps: p.fps || 30,
              onProgress: (f, t) => {
                const pct = Math.floor((f / t) * 100);
                if (pct % 10 === 0) onLog('info', `Morphing: ${pct}% complete`);
              }
            });
            await writeFile(subHandle, p.filename || 'face-morph.mp4', blob);
          } catch(e) {
            onLog('error', `Face morph failed: ${e.message}`);
          }
        }
      } else if (agg.node.transformId === 'flow-bg-swap') {
        const N = agg.blobs.length;
        if (N < 2) {
          onLog('warn', 'Background Swap needs at least 2 images (photo 1 = foreground subject, photos 2+ = backgrounds). Skipping.');
        } else {
          // blobs[0]         = Photo 1 after pipeline (ai-remove-bg ran only on this image → transparent subject)
          // originalFiles[i] = Photos 2+ original files used as backgrounds (no pipeline processing done on them)
          const fgBlob = agg.blobs[0];
          const fgName = agg.originalNames?.[0] ?? 'subject';
          onLog('info', `Background Swap: compositing "${fgName}" onto ${N - 1} background(s)…`);
          const { createBgSwap } = await import('./bg-swap.js');
          const suffix = p.suffix || '_bgswap';
          const format = p.format || 'image/jpeg';
          const ext    = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';
          const getBgName = idx => (agg.originalNames?.[idx] || `bg_${idx}.jpg`).replace(/\.[^/.]+$/, '');
          for (let i = 1; i < N; i++) {
            try {
              // Use original unprocessed file as background — bypass whatever the pipeline did to it
              const bgBlob = agg.originalFiles?.[i] ?? agg.blobs[i];
              onLog('info', `  → onto "${getBgName(i)}"…`);
              const blob = await createBgSwap(bgBlob, fgBlob, p);
              await writeFile(subHandle, `${getBgName(i)}${suffix}.${ext}`, blob);
              onLog('success', `  Saved ${getBgName(i)}${suffix}.${ext}`);
            } catch (e) {
              onLog('error', `  Failed for "${getBgName(i)}": ${e.message}`);
            }
          }
        }
      } else if (agg.node.transformId === 'flow-render-hyperframe') {
        const { createStandaloneHyperframe } = await import('./hyperframe.js');
        const { getTemplate } = await import('../data/templates.js');
        let html = '';
        if (p.templateId) {
           const tpl = await getTemplate(p.templateId);
           if (tpl && tpl.type === 'hyperframe') {
              html = tpl.htmlContent || '';
           }
        }
        if (!html) html = String(p.htmlContent || '');
        onLog('info', `Rendering Standalone Hyperframe (FPS: ${p.fps || 30})...`);
        try {
          const blob = await createStandaloneHyperframe(html, {
            fps: p.fps || 30,
            width: p.width || 1920,
            height: p.height || 1080,
            durationFallback: p.duration || 5,
            onProgress: (pct) => {
              if (pct % 10 === 0) {
                 onLog('info', `Rendering Hyperframe: ${pct}% complete`);
                 onProgress(total, total, `Rendering Hyperframe: ${pct}%`, Math.round(((total + aggCount) / totalSteps) * 100));
              }
            }
          });
          
          let fname = p.filename || 'hyperframe.mp4';
          if (!fname.toLowerCase().endsWith('.mp4')) fname += '.mp4';
          
          await writeFile(subHandle, fname, blob);
          onLog('ok', `Successfully generated standalone hyperframe: ${fname}`);
        } catch (err) {
          onLog('error', `Hyperframe render failed: ${err.message}`);
        }
      } else if (agg.node.transformId === 'flow-template-aggregator') {
        const { getTemplate } = await import('../data/templates.js');
        const { drawPerspectiveCell } = await import('./utils/perspective.js');
        
        const tplId = runParams?.templateId || p.templateId; // allow override via recipe run params
        const tpl = await getTemplate(tplId);
        if (!tpl) throw new Error(`Template not found: ${tplId}`);

        const canvas = document.createElement('canvas');
        canvas.width = tpl.width;
        canvas.height = tpl.height;
        const ctx = canvas.getContext('2d');

        // Draw background
        if (tpl.backgroundBlob) {
          const bgBitmap = await createImageBitmap(tpl.backgroundBlob);
          ctx.drawImage(bgBitmap, 0, 0, canvas.width, canvas.height);
          bgBitmap.close();
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const placeholders = [...(tpl.placeholders || [])].sort((a,b) => (a.zIndex||0) - (b.zIndex||0));
        const numSlots = placeholders.length || 1; // Prevent divide by zero

        // Batch processing logic for generic templates: consume `numSlots` blobs at a time
        const numOutputs = Math.ceil(agg.blobs.length / numSlots);
        let outputCount = 0;

        for (let i = 0; i < agg.blobs.length; i += numSlots) {
            const chunk = agg.blobs.slice(i, i + numSlots);

            const canvas = document.createElement('canvas');
            canvas.width = tpl.width;
            canvas.height = tpl.height;
            const ctx = canvas.getContext('2d');

            // Draw background
            if (tpl.backgroundBlob) {
               const bgBitmap = await createImageBitmap(tpl.backgroundBlob);
               ctx.drawImage(bgBitmap, 0, 0, canvas.width, canvas.height);
               bgBitmap.close();
            } else {
               ctx.fillStyle = '#000';
               ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Draw each chunked blob into its respective slot
            for (let j = 0; j < chunk.length; j++) {
               let bmp = await createImageBitmap(chunk[j]);
               const ph = placeholders[j];
               
               // In case a slot does not exist (robustness against broken templates)
               if (!ph) {
                   bmp.close();
                   continue;
               }
               
               const cellQuad = ph.points.map(pt => ({
                   x: pt.x * canvas.width,
                   y: pt.y * canvas.height
               }));

               const fitMode = ph.fitMode || 'stretch';
               
               if (fitMode !== 'stretch') {
                   // Calculate target quad bounds (approximate aspect ratio)
                   const [TL, TR, BR, BL] = cellQuad;
                   const dist = (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y);
                   const tw = (dist(TL, TR) + dist(BL, BR)) / 2;
                   const th = (dist(TL, BL) + dist(TR, BR)) / 2;
                   const targetAspect = tw / th;

                   let tmpCtx = document.createElement('canvas').getContext('2d');
                   tmpCtx.canvas.width = bmp.width; tmpCtx.canvas.height = bmp.height;
                   tmpCtx.drawImage(bmp, 0, 0);

                   if (fitMode === 'smart-crop' || fitMode === 'face-crop') {
                       const { registry } = await import('./registry.js');
                       if (fitMode === 'smart-crop') {
                           const def = registry.get('geo-smart-crop');
                           await def.apply(tmpCtx, { aspectRatio: `${targetAspect}:1`, strategy: 'Entropy' });
                       } else if (fitMode === 'face-crop') {
                           try {
                               const def = registry.get('geo-face-crop');
                               await def.apply(tmpCtx, { padding: 30, faceIndex: 0, confidence: 30 }, {});
                           } catch (err) {
                               onLog('warn', `Face crop failed (${err.message}) — falling back to manual cover`);
                           }
                       }
                   }
                   
                   // After face-crop or if normal cover/contain, do manual ratio matching
                   if (fitMode === 'cover' || fitMode === 'face-crop') {
                       const W = tmpCtx.canvas.width, H = tmpCtx.canvas.height;
                       let cw, ch;
                       if (W / H > targetAspect) { ch = H; cw = ch * targetAspect; }
                       else { cw = W; ch = cw / targetAspect; }
                       const cx = (W - cw) / 2, cy = (H - ch) / 2;
                       
                       const outCanvas = document.createElement('canvas');
                       outCanvas.width = cw; outCanvas.height = ch;
                       outCanvas.getContext('2d').drawImage(tmpCtx.canvas, cx, cy, cw, ch, 0, 0, cw, ch);
                       tmpCtx = outCanvas.getContext('2d');
                   } else if (fitMode === 'contain') {
                       const W = tmpCtx.canvas.width, H = tmpCtx.canvas.height;
                       let cw, ch;
                       if (W / H > targetAspect) { cw = W; ch = cw / targetAspect; }
                       else { ch = H; cw = ch * targetAspect; }
                       
                       const outCanvas = document.createElement('canvas');
                       outCanvas.width = cw; outCanvas.height = ch;
                       const oCtx = outCanvas.getContext('2d');
                       oCtx.clearRect(0, 0, cw, ch);
                       const cx = (cw - W) / 2, cy = (ch - H) / 2;
                       oCtx.drawImage(tmpCtx.canvas, cx, cy, W, H);
                       tmpCtx = outCanvas.getContext('2d');
                   }
                   
                   // Update the bitmap source to the manipulated temporary canvas
                   const oldBmp = bmp;
                   bmp = await createImageBitmap(tmpCtx.canvas);
                   oldBmp.close();
               }

               // Per-slot subject isolation — bakes the saliency matte into
               // alpha so the perspective cell shows a cut-out silhouette
               // instead of a rectangle. Runs after fitMode so the matte
               // matches the final on-screen pixels. Falls back to the
               // original bitmap if the model isn't downloaded.
               let drawable = bmp;
               if (p.isolateSubject) {
                 const { isolateSubjectBitmap } = await import('./ai/inspyrenet.js');
                 const iso = await isolateSubjectBitmap(bmp, { log: onLog });
                 if (iso) drawable = iso;
               }

               drawPerspectiveCell(ctx, drawable, cellQuad, 12);
               bmp.close();
            }

            const outBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', (p.quality || 90) / 100));
            
            // Output name handling, apply index suffix if multiple outputs
            let outName = p.filename || 'render';
            if (!outName.toLowerCase().endsWith('.jpg') && !outName.toLowerCase().endsWith('.jpeg')) {
                outName += '.jpg';
            }
            if (numOutputs > 1) {
                outName = outName.replace(/\.jpg$/i, `-${outputCount + 1}.jpg`);
            }
            
            await writeFile(subHandle, outName, outBlob);
            outputCount++;
        }
      }
      aggCount++;
      onProgress(total, total, `Finished ${agg.node.name || agg.node.transformId}`, Math.round(((total + aggCount) / totalSteps) * 100));
    } catch (err) {
      onLog('error', `Aggregation failed (${agg.node.transformId}): ${err.message}`);
    }
  }

  onLog('ok', `Batch complete. ✓ ${successCount} succeeded  ✗ ${failCount} failed`);

  run.finishedAt   = Date.now();
  run.status       = 'completed';
  run.successCount = successCount;
  run.failCount    = failCount;
  // Record the exact filenames this run produced so the History screen
  // (and any other consumer) can correlate outputs to this run by id,
  // not by mtime or lexical order. Safe here because no other batch is
  // writing to the folder concurrently.
  await captureRunOutputFiles(run, outputHandle);
  await updateRun(run);
  onComplete(run);

  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('PicMachina Batch Complete', {
      body: `Processed ${successCount} files successfully. ${failCount > 0 ? failCount + ' failed.' : ''}`.trim(),
    });
  }
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
export async function startBatch({ recipe, files, inputHandle, outputHandle, subfolder = 'output', runParams = {}, onProgress, onLog, onComplete, onError }) {
  const allBlocks  = await getAllBlocks();
  const blocksById = Object.fromEntries(allBlocks.map(b => [b.id, b]));

  const run = await createRun({
    recipeId:     recipe.id,
    recipeName:   recipe.name,
    inputFolder:  '',
    outputFolder: subfolder,
    imageCount:   files.length,
    outputHandleObj: outputHandle
  });

  // Wrap callbacks to also persist log entries to the run record
  const wrappedLog = async (level, msg) => {
    await appendLog(run, level, msg);
    onLog?.(level, msg);
  };
  const wrappedProgress = (p, t, fn, overridePct) => onProgress?.(p, t, fn, overridePct);
  const wrappedComplete  = (r) => onComplete?.(r);

  // ── Route: AI transforms need the main thread ────────────
  const needsMain = recipeNeedsMainThread(recipe, files);
  await wrappedLog('info', `Routing: ${needsMain ? 'main thread' : 'worker'}`);
  if (needsMain) {
    // Fire the batch as an async task so we can return { runId, cancel } immediately
    runMainThreadBatch({
      recipe, files, inputHandle, outputHandle, subfolder, blocksById, runParams, run,
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
      wrappedProgress(payload.processed, payload.total, payload.filename, payload.overridePct);
    }

    if (type === 'LOG') {
      await appendLog(run, payload.level, payload.msg);
      onLog?.(payload.level, payload.msg);
    }

    if (type === 'FILE_DONE') {
      try {
        let folder;
        if (payload.subfolder === '.PicMachina') {
          // Sidecar JSON lives inside the recipe output subfolder, not the root
          folder = await getOrCreateOutputSubfolder(subHandle, '.PicMachina');
        } else {
          folder = payload.subfolder ? await getOrCreateOutputSubfolder(outputHandle, payload.subfolder) : subHandle;
        }
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
      // Record the exact filenames this run produced (see main-thread
      // path for rationale).
      await captureRunOutputFiles(run, outputHandle);
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

  // Ingest files into the asset store on the main thread (IDB unavailable in workers).
  // Runs concurrently with the worker — does not block batch start.
  Promise.allSettled(files.map(f => ingestFile(f))).catch(() => {});

  worker.postMessage({
    type: 'START',
    payload: {
      recipe,
      files,
      outputConfig: { subfolder, blocks: blocksById, runParams },
      runId: run.id,
      inputHandle,
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
