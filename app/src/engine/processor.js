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
import { interpolate } from '../utils/variables.js';

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
        'flow-photo-stack', 'flow-animate-stack', 'flow-template-aggregator'
    ]);
    const hasExports = nodes.some(n => n.type === 'transform' && EXPORT_IDS.has(n.transformId))
      || nodes.some(n => n.type === 'branch' && n.branches?.some(b => b.nodes.some(bn => EXPORT_IDS.has(bn.transformId))));

    if (!hasExports && targetNodeId === undefined) {
      const blob = await this._exportCanvas(this.ctx, 'image/jpeg', 0.92);
      const injected = await injectExif(blob, context);
      results.push({ blob: injected, filename: context.filename, subfolder: context.outputSubfolder });
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
      const fmt     = node.params?.format  || 'image/jpeg';
      const quality = (node.params?.quality ?? 90) / 100;
      const suffix  = interpolate(node.params?.suffix || '', context);

      let blob = await this._exportCanvas(ctx, fmt, quality);
      if (fmt === 'image/jpeg') blob = await injectExif(blob, context);

      const base = context.filename.replace(/\.[^.]+$/, '');
      const ext  = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[fmt] || 'jpg';
      results.push({ blob, filename: `${base}${suffix}.${ext}`, subfolder: context.outputSubfolder });
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

    // ── Aggregation captures ──
    if (id === 'flow-video-wall') {
      // Capture the raw File object — no canvas export needed
      results.push({ file: context.originalFile, filename: `_videocapture_${node.id}`, aggregationId: node.id, subfolder: context.outputSubfolder });
      return;
    }

    if (['flow-create-gif', 'flow-create-video', 'flow-video-stitcher', 'flow-contact-sheet', 'flow-photo-stack', 'flow-animate-stack', 'flow-template-aggregator'].includes(id)) {
      if (context.runState?.injectedSlides?.length > 0) {
        for (const slideBlob of context.runState.injectedSlides) {
          results.push({ blob: slideBlob, filename: `_injected_${node.id}.jpg`, aggregationId: node.id, subfolder: context.outputSubfolder, caption: '' });
        }
        context.runState.injectedSlides = [];
      }

      const blob    = await this._exportCanvas(ctx, 'image/jpeg', 0.9);
      const caption = node.params?.caption != null
        ? interpolate(String(node.params.caption), context)
        : '';
      results.push({ blob, filename: `_capture_${node.id}.jpg`, aggregationId: node.id, subfolder: context.outputSubfolder, caption });
      return;
    }

    // ── Regular transform ──
    const def = registry.get(id);
    if (def) {
      try {
        await def.apply(ctx, node.params || {}, context);
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
