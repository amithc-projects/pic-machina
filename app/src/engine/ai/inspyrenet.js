/**
 * PicMachina — InSPyReNet inference wrapper
 *
 * Runs the SwinB-Plus-Ultra saliency segmentation model via onnxruntime-web.
 * Prefers the WebGPU execution provider, falls back to WASM (SIMD + threads).
 *
 * The session is created lazily on first use and cached at module scope.
 * Call disposeSession() when the underlying model is deleted/reloaded.
 *
 * ─── Public API ─────────────────────────────────────────────────────────
 *   isModelReady()         → model bytes present in IDB?
 *   getSaliencyMask(canvas, opts)
 *                           → { mask, width, height }  (mask at source res)
 *   applyMaskAsAlpha(ctx, mask, opts)
 *                           → mutate ctx canvas: alpha or silhouette
 *   computeSubjectBBox(mask, width, height, opts)
 *                           → { x, y, w, h, centroid, area } | null
 *   runInspyrenet(ctx, opts, log)   (legacy — wraps getMask + applyAlpha)
 *   invalidateMaskCache()  → drop cached last-mask (call on canvas mutation)
 *   disposeSession()       → release ORT session (call on model delete)
 *   isSessionLoaded()      → session created?
 *   getActiveBackend()     → 'webgpu' | 'wasm' | null
 */

import { getModelBytes, isModelDownloaded, getModelMeta } from '../../data/models.js';

const MODEL_ID = 'inspyrenet-swinb-fp16';
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD  = [0.229, 0.224, 0.225];

let _ort = null;
let _session = null;
let _inputName = null;
let _sessionPromise = null;
let _activeEP = null;

// ── Last-mask cache (size 1, keyed by canvas signature) ──────────────────
let _cacheKey = null;
let _cacheValue = null;  // { mask: Uint8ClampedArray, width, height }

async function loadOrt() {
  if (_ort) return _ort;
  const mod = await import('onnxruntime-web');
  // Use the CDN-hosted WASM artefacts to sidestep Vite copy complexity.
  // Matches the installed runtime version so binaries align with the loader.
  try {
    mod.env.wasm.wasmPaths =
      `https://cdn.jsdelivr.net/npm/onnxruntime-web@${mod.env?.versions?.web || '1.19.0'}/dist/`;
  } catch { /* non-fatal */ }
  _ort = mod;
  return mod;
}

export async function isModelReady() {
  return isModelDownloaded(MODEL_ID);
}

export function isSessionLoaded() {
  return !!_session;
}

export function getActiveBackend() {
  return _activeEP;
}

export function invalidateMaskCache() {
  _cacheKey = null;
  _cacheValue = null;
}

export async function disposeSession() {
  if (_session) {
    try { await _session.release(); } catch { /* ignore */ }
  }
  _session = null;
  _inputName = null;
  _sessionPromise = null;
  _activeEP = null;
  invalidateMaskCache();
}

async function getOrCreateSession(log) {
  if (_session) return _session;
  if (_sessionPromise) return _sessionPromise;

  _sessionPromise = (async () => {
    const bytes = await getModelBytes(MODEL_ID);
    if (!bytes) throw new Error('InSPyReNet model not downloaded.');

    const ort = await loadOrt();
    const tryEPs = (typeof navigator !== 'undefined' && navigator.gpu)
      ? ['webgpu', 'wasm']
      : ['wasm'];

    let lastErr = null;
    for (const ep of tryEPs) {
      try {
        const session = await ort.InferenceSession.create(bytes, {
          executionProviders: [ep],
          graphOptimizationLevel: 'all',
        });
        _session = session;
        _inputName = session.inputNames[0];
        _activeEP = ep;
        log?.('info', `[inspyrenet] Session ready on ${ep} EP`);
        return session;
      } catch (err) {
        lastErr = err;
        log?.('warn', `[inspyrenet] ${ep} EP failed: ${err.message || err}`);
      }
    }
    throw lastErr || new Error('No execution provider could load the model.');
  })();

  try {
    return await _sessionPromise;
  } catch (err) {
    _sessionPromise = null;
    throw err;
  }
}

// ─── Preprocessing / postprocessing helpers ───────────────────────────────

/**
 * Preprocess an HTMLCanvasElement into an ImageNet-normalized NCHW Float32Array
 * at inputSize × inputSize.
 */
function preprocess(canvas, inputSize) {
  const tmp = document.createElement('canvas');
  tmp.width = inputSize;
  tmp.height = inputSize;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, 0, 0, inputSize, inputSize);
  const { data } = tctx.getImageData(0, 0, inputSize, inputSize);

  const plane = inputSize * inputSize;
  const tensor = new Float32Array(3 * plane);
  for (let i = 0, px = 0; i < data.length; i += 4, px++) {
    const r = (data[i    ] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    const g = (data[i + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    const b = (data[i + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
    tensor[px]             = r;
    tensor[px + plane]     = g;
    tensor[px + 2 * plane] = b;
  }
  return tensor;
}

/**
 * Upscale a raw single-channel mask (inputSize × inputSize, Float32 0..1) to
 * (W × H), returning a Uint8ClampedArray of length W*H with 0..255 values.
 * Uses canvas bilinear drawImage for quality.
 */
function upscaleMaskToSource(rawMask, inputSize, W, H) {
  // Stage the raw mask into the alpha channel of an RGBA ImageData at input res
  const lo = new ImageData(inputSize, inputSize);
  for (let i = 0, j = 0; i < rawMask.length; i++, j += 4) {
    const v = Math.max(0, Math.min(1, rawMask[i]));
    const a = Math.round(v * 255);
    lo.data[j]     = 255;
    lo.data[j + 1] = 255;
    lo.data[j + 2] = 255;
    lo.data[j + 3] = a;
  }
  const loCanvas = document.createElement('canvas');
  loCanvas.width = inputSize;
  loCanvas.height = inputSize;
  loCanvas.getContext('2d').putImageData(lo, 0, 0);

  const hiCanvas = document.createElement('canvas');
  hiCanvas.width = W;
  hiCanvas.height = H;
  const hc = hiCanvas.getContext('2d');
  hc.imageSmoothingEnabled = true;
  hc.imageSmoothingQuality = 'high';
  hc.drawImage(loCanvas, 0, 0, W, H);
  const rgba = hc.getImageData(0, 0, W, H).data;

  // Pull just the alpha plane into a flat Uint8ClampedArray.
  const out = new Uint8ClampedArray(W * H);
  for (let i = 3, o = 0; i < rgba.length; i += 4, o++) out[o] = rgba[i];
  return out;
}

/**
 * Cheap, collision-resistant canvas content signature. Samples a sparse grid
 * of RGB values and combines them into a short string. Typical cost: <0.3ms.
 */
function canvasSignature(canvas) {
  const W = canvas.width, H = canvas.height;
  if (!W || !H) return null;
  // Downscale to 8×8 grey sample — cheap and reasonably unique.
  const tmp = document.createElement('canvas');
  tmp.width = 8; tmp.height = 8;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, 0, 0, 8, 8);
  const { data } = tctx.getImageData(0, 0, 8, 8);
  let sig = `${W}x${H}:`;
  // 64 pixels × 3 channels = 192 values, but we only need a hash-grade digest.
  // Build a short string by taking every 4th channel.
  for (let i = 0; i < data.length; i += 4) {
    const g = (data[i] + data[i + 1] + data[i + 2]) | 0;
    sig += g.toString(16);
  }
  return sig;
}

// ─── Public: saliency primitive ──────────────────────────────────────────

/**
 * Run InSPyReNet on a canvas and return the saliency mask upscaled to the
 * canvas's source resolution. Result is cached until the canvas content
 * (signature) changes, so multiple downstream transforms share one pass.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @param {{log?: (lvl:string,msg:string)=>void, bypassCache?: boolean}} [opts]
 * @returns {Promise<{mask: Uint8ClampedArray, width: number, height: number}>}
 */
export async function getSaliencyMask(canvas, opts = {}) {
  const log = opts.log;
  const sig = opts.bypassCache ? null : canvasSignature(canvas);
  if (sig && _cacheKey === sig && _cacheValue) {
    log?.('info', '[inspyrenet] mask cache hit');
    return _cacheValue;
  }

  const meta = getModelMeta(MODEL_ID);
  const inputSize = meta?.inputSize || 1024;

  const session = await getOrCreateSession(log);
  const ort = await loadOrt();

  const W = canvas.width, H = canvas.height;
  const t0 = performance.now();

  const input = preprocess(canvas, inputSize);
  const tensor = new ort.Tensor('float32', input, [1, 3, inputSize, inputSize]);

  const feeds = {};
  feeds[_inputName] = tensor;

  const outputs = await session.run(feeds);
  const outKey = Object.keys(outputs)[0];
  const rawMask = outputs[outKey].data;   // Float32Array, inputSize²
  const mask = upscaleMaskToSource(rawMask, inputSize, W, H);

  const result = { mask, width: W, height: H };
  if (sig) {
    _cacheKey = sig;
    _cacheValue = result;
  }

  log?.('info', `[inspyrenet] Inference ${Math.round(performance.now() - t0)}ms (${_activeEP})`);
  return result;
}

/**
 * Apply a previously-computed saliency mask to a canvas as either alpha
 * (transparent BG) or silhouette (black subject). Mask dimensions must
 * match the context's canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{mask: Uint8ClampedArray, width: number, height: number}} maskObj
 * @param {{mode?: 'Transparent'|'Silhouette', edgeSmoothing?: number}} [opts]
 */
export function applyMaskAsAlpha(ctx, maskObj, opts = {}) {
  const { mask, width: mW, height: mH } = maskObj;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  if (mW !== W || mH !== H) {
    throw new Error(`Mask ${mW}×${mH} does not match canvas ${W}×${H}.`);
  }

  const mode = opts.mode || 'Transparent';
  const smoothing = ((opts.edgeSmoothing ?? 50) / 100);
  const lo = 0.5 - smoothing * 0.4;
  const hi = 0.5 + smoothing * 0.4;
  const span = Math.max(1e-6, hi - lo);

  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;

  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    const conf = mask[i] / 255;

    if (mode === 'Transparent') {
      const alpha = conf < lo ? 0
                  : conf > hi ? 255
                  : Math.round(((conf - lo) / span) * 255);
      data[p + 3] = alpha;
    } else if (mode === 'Silhouette') {
      if (conf > 0.5) {
        data[p]     = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Compute the subject bounding box and summary stats from a saliency mask.
 * Returns null if no pixel exceeds the threshold (flat/abstract scene).
 *
 * @param {Uint8ClampedArray} mask     Flat 0..255 mask, length W*H
 * @param {number} W
 * @param {number} H
 * @param {{threshold?: number}} [opts]  threshold is 0..1 (default 0.5)
 * @returns {{x:number,y:number,w:number,h:number,centroid:{x:number,y:number},area:number}|null}
 */
export function computeSubjectBBox(mask, W, H, opts = {}) {
  const t = Math.round((opts.threshold ?? 0.5) * 255);
  let minX = W, minY = H, maxX = -1, maxY = -1;
  let sumX = 0, sumY = 0, count = 0;

  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      if (mask[i] >= t) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  if (count === 0 || maxX < 0) return null;
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    centroid: { x: sumX / count, y: sumY / count },
    area: count / (W * H),   // fraction of frame
  };
}

// ─── Legacy entry point (wraps the split API for backward compat) ────────

/**
 * Run InSPyReNet on the given 2D canvas context. Mutates ctx's canvas with the
 * new alpha (or silhouette) output.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{mode?: string, edgeSmoothing?: number}} opts
 * @param {(lvl: string, msg: string) => void} [log]
 */
export async function runInspyrenet(ctx, opts = {}, log) {
  const maskObj = await getSaliencyMask(ctx.canvas, { log });
  applyMaskAsAlpha(ctx, maskObj, opts);
}

/**
 * Produce a new canvas the same size as the given ImageBitmap with the
 * subject matte baked in as alpha. Background pixels become transparent.
 * Used by the aggregating flow transforms (photo-stack, animate-stack,
 * template-aggregator) when their `isolateSubject` per-layer flag is set —
 * so compositing draws a cut-out silhouette instead of a full rectangle.
 *
 * Returns `null` if the InSPyReNet model isn't downloaded, so the caller can
 * gracefully fall back to drawing the original bitmap.
 *
 * The returned canvas is drawable via `ctx.drawImage(canvas, …)` just like
 * an ImageBitmap; the caller owns it (no explicit close needed).
 *
 * @param {ImageBitmap}  bitmap
 * @param {{edgeSmoothing?: number, log?: (lvl:string,msg:string)=>void, bypassCache?: boolean}} [opts]
 * @returns {Promise<HTMLCanvasElement|null>}
 */
export async function isolateSubjectBitmap(bitmap, opts = {}) {
  const ready = await isModelReady();
  if (!ready) {
    opts.log?.('warn', '[inspyrenet] isolateSubjectBitmap: model not downloaded; falling back to rectangular compositing.');
    return null;
  }

  // Stage the bitmap on a temporary canvas — getSaliencyMask needs a canvas,
  // and applyMaskAsAlpha writes back into a 2D context.
  const tmp = document.createElement('canvas');
  tmp.width  = bitmap.width;
  tmp.height = bitmap.height;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(bitmap, 0, 0);

  try {
    // bypassCache defaults to true here — each source bitmap is a different
    // image, so the module-level cache would just thrash.
    const maskObj = await getSaliencyMask(tmp, {
      log: opts.log,
      bypassCache: opts.bypassCache !== false,
    });
    applyMaskAsAlpha(tctx, maskObj, {
      mode: 'Transparent',
      edgeSmoothing: opts.edgeSmoothing ?? 50,
    });
    return tmp;
  } catch (err) {
    opts.log?.('warn', `[inspyrenet] isolateSubjectBitmap failed: ${err.message || err}`);
    console.warn('[inspyrenet] isolateSubjectBitmap failed:', err);
    return null;
  }
}
