/**
 * ImageChef — Image Processor
 *
 * Executes a recipe's node tree against a single image.
 * Supports:
 *   - transform nodes (canvas operations)
 *   - branch nodes (parallel variant paths)
 *   - conditional nodes (if/then/else)
 *   - block-ref nodes (resolved externally before calling processRecipe)
 *   - flow-export nodes (captured as ProcessResult)
 *   - aggregation nodes: flow-create-gif, flow-create-video, flow-contact-sheet
 */

import { registry } from './registry.js';
import { interpolate, resolveParams } from '../utils/variables.js';

// ─── EXIF helpers ─────────────────────────────────────────
async function injectExif(blob, context) {
  if (blob.type !== 'image/jpeg') return blob;
  if (context._stripMetadata === 'All') return blob; // stripped — skip inject
  try {
    const piexif = await import('piexifjs');
    const buf = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);

    const exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, thumbnail: null };

    const gps = context.exif?.gps;
    if (gps && context._stripMetadata !== 'GPS Only') {
      const toRat = dec => {
        const d = Math.floor(Math.abs(dec));
        const mFull = (Math.abs(dec) - d) * 60;
        const m = Math.floor(mFull);
        const s = Math.round((mFull - m) * 60 * 100);
        return [[d, 1], [m, 1], [s, 100]];
      };
      exifObj['GPS'][piexif.GPSIFD.GPSLatitudeRef]  = gps.lat >= 0 ? 'N' : 'S';
      exifObj['GPS'][piexif.GPSIFD.GPSLatitude]     = toRat(gps.lat);
      exifObj['GPS'][piexif.GPSIFD.GPSLongitudeRef] = gps.lng >= 0 ? 'E' : 'W';
      exifObj['GPS'][piexif.GPSIFD.GPSLongitude]    = toRat(gps.lng);
    }

    if (context.exif?.date && context._stripMetadata !== 'EXIF Only') {
      exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = context.exif.date;
    }

    const writes = context._exifWrites || {};
    if (writes.artist)      exifObj['0th'][piexif.ImageIFD.Artist]           = writes.artist;
    if (writes.copyright)   exifObj['0th'][piexif.ImageIFD.Copyright]        = writes.copyright;
    if (writes.description) exifObj['0th'][piexif.ImageIFD.ImageDescription] = writes.description;
    if (writes.software)    exifObj['0th'][piexif.ImageIFD.Software]         = writes.software;
    if (writes.comment)     exifObj['Exif'][piexif.ExifIFD.UserComment]      = writes.comment;

    const exifBytes = piexif.dump(exifObj);
    const newBinary = piexif.insert(exifBytes, binary);
    const newBytes  = new Uint8Array(newBinary.length);
    for (let i = 0; i < newBinary.length; i++) newBytes[i] = newBinary.charCodeAt(i);
    return new Blob([newBytes], { type: 'image/jpeg' });
  } catch (err) {
    console.warn('[processor] EXIF inject failed:', err);
    return blob;
  }
}

// ─── Condition evaluator ──────────────────────────────────
function evalCondition(condition, ctx, canvas) {
  const { field, operator, value } = condition;
  let actual;

  if (field === 'width')       actual = canvas.width;
  else if (field === 'height') actual = canvas.height;
  else if (field === 'aspectRatio') actual = canvas.width / canvas.height;
  else if (field === 'HasGPS')  return !!(ctx.exif?.gps);
  else if (field === 'IsPortrait') return canvas.height > canvas.width;
  else if (field === 'fileIndex')  actual = ctx.fileIndex ?? 0;
  else if (field === 'MetaExists') return field in (ctx.exif || {}) || field in (ctx.meta || {});
  else if (field.startsWith('exif.')) actual = ctx.exif?.[field.slice(5)];
  else if (field.startsWith('meta.')) actual = ctx.meta?.[field.slice(5)];
  else return false;

  if (operator === 'exists')   return actual != null;
  if (operator === 'eq')       return actual == value;
  if (operator === 'neq')      return actual != value;
  if (operator === 'gt')       return actual > value;
  if (operator === 'lt')       return actual < value;
  if (operator === 'gte')      return actual >= value;
  if (operator === 'lte')      return actual <= value;
  if (operator === 'contains') return String(actual ?? '').includes(String(value));
  return false;
}

// ─── Canvas snapshot helpers ──────────────────────────────
function snapshotCanvas(canvas) {
  const t = document.createElement('canvas');
  t.width = canvas.width; t.height = canvas.height;
  t.getContext('2d').drawImage(canvas, 0, 0);
  return t;
}

function restoreSnapshot(ctx, snapshot) {
  ctx.canvas.width  = snapshot.width;
  ctx.canvas.height = snapshot.height;
  ctx.drawImage(snapshot, 0, 0);
}

// ─── Main processor class ─────────────────────────────────
export class ImageProcessor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx    = this.canvas.getContext('2d');
  }

  /**
   * Process a single image through a recipe node tree.
   *
   * @param {HTMLImageElement} image
   * @param {RecipeNode[]}     nodes
   * @param {TransformContext} context
   * @param {string}           [targetNodeId]  — for preview mode
   * @returns {Promise<ProcessResult[]>}
   */
  async process(image, nodes, context, targetNodeId) {
    // Accept both HTMLImageElement (.naturalWidth) and ImageBitmap (.width)
    this.canvas.width  = image.naturalWidth  ?? image.width;
    this.canvas.height = image.naturalHeight ?? image.height;
    this.ctx.drawImage(image, 0, 0);

    if (!context.variables) context.variables = new Map();
    context._isFinished = false;

    const results = [];
    await this._runNodes(nodes, this.ctx, context, results, targetNodeId);

    // If recipe has no explicit export nodes, auto-export at end.
    // flow-gif-from-states also produces file output — treat it as an export node.
    const EXPORT_IDS = new Set([
        'flow-export', 'flow-gif-from-states', 'flow-video-wall',
        'flow-create-gif', 'flow-create-video', 'flow-video-stitcher', 'flow-contact-sheet',
        'flow-photo-stack', 'flow-animate-stack', 'flow-template-aggregator', 'flow-face-swap', 'flow-bg-swap',
        'flow-create-pdf', 'flow-create-pptx', 'flow-create-zip',
        'flow-video-convert', 'flow-video-trim', 'flow-video-compress', 'flow-video-change-fps', 'flow-video-concat',
        'flow-video-strip-audio', 'flow-video-extract-audio', 'flow-video-remix-audio',
    ]);
    const nodeTreeHasExport = (ns) => ns.some(n => {
      if (n.type === 'transform') {
        if (EXPORT_IDS.has(n.transformId)) return true;
        // video-effect transforms produce their own output — suppress auto-export
        return registry.get(n.transformId)?.categoryKey === 'video-effect';
      }
      if (n.type === 'branch')   return (n.branches || []).some(b => nodeTreeHasExport(b.nodes || []));
      if (n.type === 'conditional') return nodeTreeHasExport(n.thenNodes || []) || nodeTreeHasExport(n.elseNodes || []);
      return false;
    });
    const hasExports = nodeTreeHasExport(nodes);

    if (!hasExports && targetNodeId === undefined) {
      if (context._videoTransformQueue?.length > 0) {
        // Flush video queue as auto-export
        try {
          const { processVideoEffect } = await import('./video-convert.js');
          const queue = context._videoTransformQueue;
          context._videoTransformQueue = [];
          const blob = await processVideoEffect(context.originalFile, queue, {}, { bitrate: 8_000_000, onLog: context.log });
          results.push({ blob, filename: context.filename.replace(/\.[^.]+$/, '.mp4'), subfolder: context.outputSubfolder });
        } catch (err) {
          context.log?.('error', `Auto-export video failed: ${err.message}`);
        }
      } else {
        const blob = await this._exportCanvas(this.ctx, 'image/jpeg', 0.92);
        const injected = await injectExif(blob, context);
        results.push({ blob: injected, filename: context.filename, subfolder: context.outputSubfolder });
      }
    }

    return results;
  }

  /** Run nodes sequentially, mutating the canvas. */
  async _runNodes(nodes, ctx, context, results, targetNodeId) {
    for (let i = 0; i < nodes.length; i++) {
      if (context._isFinished) break;

      const node = nodes[i];
      if (node.disabled) continue;

      if (node.condition && !evalCondition(node.condition, context, ctx.canvas)) continue;

      if (node.type === 'transform') {
        await this._runTransformNode(node, ctx, context, results);
      } else if (node.type === 'branch') {
        await this._runBranchNode(node, ctx, context, results, targetNodeId);
      } else if (node.type === 'conditional') {
        await this._runConditionalNode(node, ctx, context, results, targetNodeId);
      }

      if (node.id === targetNodeId) {
        context._isFinished = true;
        break;
      }
    }
  }

  async _runTransformNode(node, ctx, context, results) {
    const id = node.transformId;

    // ── Export ────
    if (id === 'flow-export') {
      // If canvas transforms were queued for a video file, flush them now
      if (context._videoTransformQueue?.length > 0 && !context._previewMode) {
        try {
          const { processVideoEffect } = await import('./video-convert.js');
          const queue = context._videoTransformQueue;
          context._videoTransformQueue = [];
          const blob = await processVideoEffect(context.originalFile, queue, {}, { bitrate: 8_000_000, onLog: context.log });
          const suffix = interpolate(node.params?.suffix || '', context);
          const base   = context.filename.replace(/\.[^.]+$/, '');
          results.push({ blob, filename: `${base}${suffix}.mp4`, subfolder: context.outputSubfolder });
          context.log?.('ok', `Exported processed video → ${base}${suffix}.mp4`);
        } catch (err) {
          context.log?.('error', `Video export failed: ${err.message}`);
        }
        return;
      }

      const fmt     = node.params?.format  || 'image/jpeg';
      const quality = (node.params?.quality ?? 90) / 100;
      const suffix  = interpolate(node.params?.suffix || '', context);
      const nodeSubfolder = node.params?.subfolder ? interpolate(node.params.subfolder, context) : null;
      const effectiveSubfolder = nodeSubfolder
        ? `${context.outputSubfolder}/${nodeSubfolder}`
        : context.outputSubfolder;

      let blob = await this._exportCanvas(ctx, fmt, quality);
      if (fmt === 'image/jpeg') blob = await injectExif(blob, context);

      const base = context.filename.replace(/\.[^.]+$/, '');
      const ext  = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[fmt] || 'jpg';
      results.push({ blob, filename: `${base}${suffix}.${ext}`, subfolder: effectiveSubfolder });
      return;
    }

    // ── GIF from saved states ──
    if (id === 'flow-gif-from-states') {
      const labels = (node.params?.panels || '').split(',').map(s => s.trim()).filter(Boolean);
      const states = labels.map(l => context.variables.get(l)).filter(Boolean);
      context.log?.('info', `GIF assembly: found ${states.length}/${labels.length} states (looking for: ${labels.join(', ')})`);
      if (!states.length) { context.log?.('warn', 'GIF assembly skipped — no saved states found'); return; }

      const GIF = (await import('gif.js')).default;
      const blob = await new Promise((resolve, reject) => {
        const gif = new GIF({
          workers: 2, quality: 10,
          workerScript: '/gif.worker.js',
          repeat: node.params?.loop !== false ? 0 : -1,
        });
        for (const imageData of states) {
          const tmp = document.createElement('canvas');
          tmp.width = imageData.width; tmp.height = imageData.height;
          tmp.getContext('2d').putImageData(imageData, 0, 0);
          gif.addFrame(tmp, { delay: node.params?.delay ?? 500 });
        }
        gif.on('finished', resolve);
        gif.on('error',    reject);
        gif.render();
      });

      const suffix = node.params?.suffix ?? '_preview';
      const base   = context.filename.replace(/\.[^.]+$/, '');
      const outName = `${base}${suffix}.gif`;
      context.log?.('ok', `GIF rendered (${(blob.size / 1024).toFixed(1)} KB) → ${context.outputSubfolder}/${outName}`);
      results.push({ blob, filename: outName, subfolder: context.outputSubfolder });
      return;
    }

    // ── Inject Title Slide ──
    if (id === 'flow-title-slide') {
      if (!context.runState) return;
      const triggerExpr = node.params?.triggerField || '';
      const triggerVal  = interpolate(triggerExpr, context);

      const fieldState = context.runState.triggerStates[node.id] || { lastVal: null };

      if (triggerVal && triggerVal !== fieldState.lastVal) {
        context.log?.('info', `Title Slide trigger detected change ("${fieldState.lastVal}" -> "${triggerVal}"). Generating Title Slide...`);
        fieldState.lastVal = triggerVal;

        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = cw; tmpCanvas.height = ch;
        const tCtx = tmpCanvas.getContext('2d');

        // Background
        tCtx.fillStyle = node.params?.bgColor || '#111111';
        tCtx.fillRect(0, 0, cw, ch);

        if (node.params?.bgImage) {
          try {
            const resp = await fetch(node.params.bgImage);
            const bitmap = await createImageBitmap(await resp.blob());
            const scale = Math.max(cw / bitmap.width, ch / bitmap.height);
            const sw = bitmap.width * scale, sh = bitmap.height * scale;
            tCtx.drawImage(bitmap, (cw-sw)/2, (ch-sh)/2, sw, sh);
            bitmap.close?.();
          } catch (err) { context.log?.('warn', `Failed to load Title Slide bgImage: ${err.message}`); }
        }

        // Text
        const titleText = interpolate(node.params?.titleTemplate || '', context);
        if (titleText) {
          const fontSize = node.params?.fontSize || 120;
          tCtx.fillStyle = node.params?.textColor || '#ffffff';
          tCtx.font = `bold ${fontSize}px "${node.params?.fontFamily || 'Inter'}"`;
          tCtx.textAlign = 'center';
          tCtx.textBaseline = 'middle';

          // Basic multiline support just wrapping on newlines
          const lines = titleText.split('\\n');
          const lineHeight = fontSize * 1.2;
          const startY = (ch / 2) - ((lines.length - 1) * lineHeight) / 2;
          for (let i = 0; i < lines.length; i++) {
            tCtx.fillText(lines[i], cw / 2, startY + (i * lineHeight));
          }
        }

        const blob = await this._exportCanvas(tCtx, 'image/jpeg', 0.9);
        context.runState.injectedSlides.push(blob);
        context.runState.triggerStates[node.id] = fieldState;
      }
      return; // Never modifies the master canvas
    }

    // ── Per-file video operations (mediabunny) ──
    const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);
    if (['flow-video-convert', 'flow-video-trim', 'flow-video-compress', 'flow-video-change-fps',
         'flow-video-strip-audio', 'flow-video-extract-audio', 'flow-video-remix-audio'].includes(id)) {
      if (context._previewMode) return; // full conversion not run during preview
      const file = context.originalFile;
      if (!file) { context.log?.('warn', `${id}: no source file available — skipping`); return; }
      const ext  = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) {
        context.log?.('warn', `${id}: skipping non-video file "${file.name}"`);
        return;
      }
      try {
        const { convertVideo, trimVideo, compressVideo, changeFPS,
                stripAudio, extractAudio, remixAudio } = await import('./video-convert.js');
        const p = node.params || {};
        let blob;
        if      (id === 'flow-video-convert')       blob = await convertVideo(file, p);
        else if (id === 'flow-video-trim')          blob = await trimVideo(file, p);
        else if (id === 'flow-video-compress')      blob = await compressVideo(file, p);
        else if (id === 'flow-video-change-fps')    blob = await changeFPS(file, p);
        else if (id === 'flow-video-strip-audio')   blob = await stripAudio(file, p);
        else if (id === 'flow-video-extract-audio') blob = await extractAudio(file, p);
        else if (id === 'flow-video-remix-audio')   blob = await remixAudio(file, p);

        const suffix  = interpolate(p.suffix || '', context);
        const base    = context.filename.replace(/\.[^.]+$/, '');
        // For audio extracts, use the chosen format extension; otherwise derive from MIME
        const outExt  = id === 'flow-video-extract-audio'
                      ? ({ mp3: 'mp3', wav: 'wav', flac: 'flac', ogg: 'ogg', aac: 'm4a' }[p.format] || 'mp3')
                      : blob.type.includes('webm') ? 'webm'
                      : blob.type.includes('ogg')  ? 'ogg'
                      : blob.type.includes('matroska') ? 'mkv'
                      : blob.type.includes('quicktime') ? 'mov'
                      : blob.type.includes('mpeg') || blob.type.includes('mp3') ? 'mp3'
                      : blob.type.includes('flac') ? 'flac'
                      : blob.type.includes('wav')  ? 'wav'
                      : 'mp4';
        results.push({ blob, filename: `${base}${suffix}.${outExt}`, subfolder: context.outputSubfolder });
        context.log?.('ok', `${id}: produced ${(blob.size / 1024 / 1024).toFixed(1)} MB → ${base}${suffix}.${outExt}`);
      } catch (err) {
        context.log?.('error', `${id} failed for "${file.name}": ${err.message}`);
      }
      return;
    }

    // ── video-effect transforms: per-frame mediabunny effects ──
    // These apply a canvas image effect to every decoded video frame and re-encode.
    const _videoEffectDef = registry.get(id);
    if (_videoEffectDef?.categoryKey === 'video-effect') {
      if (context._previewMode) return; // preview already shows a frame; skip full re-encode
      const file = context.originalFile;
      if (!file) { context.log?.('warn', `${id}: no source file — skipping`); return; }
      const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) { context.log?.('warn', `${id}: skipping non-video file "${file.name}"`); return; }
      const sourceDef = registry.get(_videoEffectDef.sourceTransformId);
      if (!sourceDef) { context.log?.('warn', `${id}: source transform "${_videoEffectDef.sourceTransformId}" not found`); return; }
      try {
        const { processVideoEffect } = await import('./video-convert.js');
        const p = node.params || {};
        const blob = await processVideoEffect(
          file,
          sourceDef.apply.bind(sourceDef),
          p,
          { bitrate: p.bitrate || 8_000_000, onLog: context.log }
        );
        const suffix = interpolate(p.suffix || '', context);
        const base   = context.filename.replace(/\.[^.]+$/, '');
        results.push({ blob, filename: `${base}${suffix}.mp4`, subfolder: context.outputSubfolder });
        context.log?.('ok', `${id}: produced ${(blob.size / 1024 / 1024).toFixed(1)} MB → ${base}${suffix}.mp4`);
      } catch (err) {
        context.log?.('error', `${id} failed for "${file.name}": ${err.message}`);
      }
      return;
    }

    // ── Canvas transforms on video files → queue for single-pass per-frame processing ──
    // Any geo-*, color-*, or overlay-* transform applied to a video file is queued here.
    // The queue is flushed (in one mediabunny encode pass) when flow-export or
    // flow-video-wall is reached, so chained transforms cost only one encode, not N.
    const CANVAS_CATEGORY_KEYS = new Set(['geo', 'color', 'overlay']);
    const def_canvas = registry.get(id);
    const _file = context.originalFile;
    const _ext  = _file?.name.slice(_file.name.lastIndexOf('.') + 1).toLowerCase();
    if (_file && VIDEO_EXTS.has(_ext) && def_canvas && CANVAS_CATEGORY_KEYS.has(def_canvas.categoryKey)) {
      // Preview mode: canvas already holds a video frame — run transform directly on it
      if (context._previewMode) {
        try { await def_canvas.apply(ctx, node.params || {}, context); } catch { /* ignore */ }
        return;
      }
      // Batch mode: accumulate into queue
      if (!context._videoTransformQueue) context._videoTransformQueue = [];
      context._videoTransformQueue.push({ fn: def_canvas.apply.bind(def_canvas), params: node.params || {} });
      return;
    }

    // ── Video concat aggregation capture ──
    if (id === 'flow-video-concat') {
      if (context._previewMode) return;
      const file = context.originalFile;
      if (!file) { context.log?.('warn', 'flow-video-concat: no source file — skipping'); return; }
      const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) {
        context.log?.('warn', `flow-video-concat: skipping non-video file "${file.name}"`);
        return;
      }
      context.log?.('info', `flow-video-concat: queued "${file.name}"`);
      results.push({ file, filename: `_videocapture_${node.id}`, aggregationId: node.id, subfolder: context.outputSubfolder });
      return;
    }

    // ── Aggregation captures ──
    if (id === 'flow-video-wall') {
      if (context._previewMode) return;
      let captureFile = context.originalFile;
      // Flush any queued canvas transforms — produce a pre-processed video for the wall
      if (context._videoTransformQueue?.length > 0) {
        try {
          const { processVideoEffect } = await import('./video-convert.js');
          const queue = context._videoTransformQueue;
          context._videoTransformQueue = [];
          const blob = await processVideoEffect(context.originalFile, queue, {}, { bitrate: 8_000_000, onLog: context.log });
          captureFile = new File([blob], context.filename.replace(/\.[^.]+$/, '.mp4'), { type: 'video/mp4' });
        } catch (err) {
          context.log?.('error', `Pre-processing for video wall failed: ${err.message}`);
        }
      }
      context.log?.('info', `Video extracted — routing to aggregator ${node.id}`);
      results.push({ file: captureFile, filename: `_videocapture_${node.id}`, aggregationId: node.id, subfolder: context.outputSubfolder, metadata: { exif: context.exif, sidecar: context.sidecar } });
      return;
    }

    if (['flow-create-gif', 'flow-create-video', 'flow-create-pdf', 'flow-create-pptx', 'flow-create-zip', 'flow-video-stitcher', 'flow-geo-timeline', 'flow-contact-sheet', 'flow-photo-stack', 'flow-animate-stack', 'flow-template-aggregator', 'flow-face-swap', 'flow-bg-swap'].includes(id)) {
      if (context.runState?.injectedSlides?.length > 0) {
        for (const slideBlob of context.runState.injectedSlides) {
          results.push({ blob: slideBlob, filename: `_injected_${node.id}.jpg`, aggregationId: node.id, subfolder: context.outputSubfolder, caption: '', metadata: { exif: context.exif, sidecar: context.sidecar } });
        }
        context.runState.injectedSlides = [];
      }

      const _file = context.originalFile;
      const _ext  = _file?.name?.slice(_file.name.lastIndexOf('.') + 1).toLowerCase() ?? '';
      const VIDEO_EXTS_AGG = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);

      let blob;
      if (_file && VIDEO_EXTS_AGG.has(_ext)) {
        // Video file — extract a representative frame instead of the dummy 1×1 canvas
        try {
          const { extractVideoFrame } = await import('../utils/video-frame.js');
          const frameCanvas = await extractVideoFrame(_file);
          blob = await new Promise((res, rej) => frameCanvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.9));
        } catch (err) {
          context.log?.('warn', `Video frame extract failed for "${_file.name}": ${err.message} — using blank frame`);
          const fallback = document.createElement('canvas');
          fallback.width = 1280; fallback.height = 720;
          fallback.getContext('2d').fillRect(0, 0, 1280, 720);
          blob = await new Promise(res => fallback.toBlob(res, 'image/jpeg', 0.9));
        }
      } else {
        // flow-bg-swap subject (fileIndex 0) must be PNG to preserve alpha from ai-remove-bg
        const isTransparentSubject = (id === 'flow-bg-swap' && (context.fileIndex ?? 0) === 0);
        blob = await this._exportCanvas(
          ctx,
          isTransparentSubject ? 'image/png' : 'image/jpeg',
          isTransparentSubject ? 1.0 : 0.9
        );
      }

      const caption = interpolate(node.params?.caption || '', context);
      results.push({ blob, filename: `_capture_${node.id}.jpg`, aggregationId: node.id, subfolder: context.outputSubfolder, caption, metadata: { exif: context.exif, sidecar: context.sidecar } });
      return;
    }

    // ── Regular transform ──
    const def = registry.get(id);
    if (def) {
      try {
        const resolvedParams = resolveParams(node.params || {}, context);
        await def.apply(ctx, resolvedParams, context);
      } catch (err) {
        const msg = `Transform "${id}" failed — skipping step: ${err.message}`;
        console.warn('[processor]', msg);
        context.log?.('warn', msg);
      }
    } else {
      console.warn(`[processor] Unknown transform: ${id}`);
    }
  }

  /**
   * Branch node: run each variant on a COPY of the current canvas state.
   * Results from all branches are collected.
   */
  async _runBranchNode(node, ctx, context, results, targetNodeId) {
    const snapshot = snapshotCanvas(ctx.canvas);
    let targetFoundInBranch = false;

    for (const branch of node.branches || []) {
      if (context._isFinished) break;

      // Work on a fresh canvas copy for each branch
      const branchCanvas = document.createElement('canvas');
      branchCanvas.width  = snapshot.width;
      branchCanvas.height = snapshot.height;
      const branchCtx = branchCanvas.getContext('2d');
      branchCtx.drawImage(snapshot, 0, 0);

      const branchContext = {
        ...context,
        variables: new Map(context.variables),
        outputSubfolder: context.outputSubfolder,
      };

      await this._runNodes(branch.nodes || [], branchCtx, branchContext, results, targetNodeId);
      if (branchContext._isFinished) {
        // Target was inside this branch — promote its canvas to the main canvas for preview
        ctx.canvas.width  = branchCtx.canvas.width;
        ctx.canvas.height = branchCtx.canvas.height;
        ctx.drawImage(branchCtx.canvas, 0, 0);
        context._isFinished = true;
        targetFoundInBranch = true;
        break;
      }
    }

    // Restore original canvas state only when the target was NOT inside a branch
    if (!targetFoundInBranch) {
      restoreSnapshot(ctx, snapshot);
    }
  }

  /** Conditional node: if condition is met run thenNodes, else elseNodes. */
  async _runConditionalNode(node, ctx, context, results, targetNodeId) {
    const cond = node.condition;
    const pass = cond ? evalCondition(cond, context, ctx.canvas) : true;
    const targetNodes = pass ? (node.thenNodes || []) : (node.elseNodes || []);
    await this._runNodes(targetNodes, ctx, context, results, targetNodeId);
  }

  /** Canvas → Blob helper. */
  _exportCanvas(ctx, format, quality) {
    return new Promise((resolve, reject) => {
      ctx.canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), format, quality);
    });
  }

  /** Process to data URL (for preview). */
  async previewDataUrl(image, nodes, context, targetNodeId) {
    await this.process(image, nodes, context, targetNodeId);
    return new Promise(resolve => {
      this.canvas.toBlob(b => resolve(b ? URL.createObjectURL(b) : ''), 'image/jpeg', 0.9);
    });
  }
}

// Only instantiate singleton on the main thread — workers have no document at import time.
export const imageProcessor = typeof document !== 'undefined' ? new ImageProcessor() : null;
