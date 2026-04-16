/**
 * PicMachina — InSPyReNet inference wrapper
 *
 * Runs the SwinB-Plus-Ultra saliency segmentation model via onnxruntime-web.
 * Prefers the WebGPU execution provider, falls back to WASM (SIMD + threads).
 *
 * The session is created lazily on first use and cached at module scope.
 * Call disposeSession() when the underlying model is deleted/reloaded.
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

export async function disposeSession() {
  if (_session) {
    try { await _session.release(); } catch { /* ignore */ }
  }
  _session = null;
  _inputName = null;
  _sessionPromise = null;
  _activeEP = null;
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
 * Upscale a raw single-channel mask (inputSize × inputSize) to (W × H),
 * returning an ImageData whose alpha channel carries the mask and RGB is white.
 * Uses canvas bilinear drawImage for quality.
 */
function maskToImageData(mask, inputSize, W, H) {
  const lo = new ImageData(inputSize, inputSize);
  for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
    const v = Math.max(0, Math.min(1, mask[i]));
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
  return hc.getImageData(0, 0, W, H);
}

/**
 * Run InSPyReNet on the given 2D canvas context. Mutates ctx's canvas with the
 * new alpha (or silhouette) output.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{mode?: string, edgeSmoothing?: number}} opts
 * @param {(lvl: string, msg: string) => void} [log]
 */
export async function runInspyrenet(ctx, opts = {}, log) {
  const meta = getModelMeta(MODEL_ID);
  const inputSize = meta?.inputSize || 1024;
  const mode = opts.mode || 'Transparent';
  const smoothing = ((opts.edgeSmoothing ?? 50) / 100);

  const session = await getOrCreateSession(log);
  const ort = await loadOrt();

  const W = ctx.canvas.width, H = ctx.canvas.height;
  const t0 = performance.now();

  const input = preprocess(ctx.canvas, inputSize);
  const tensor = new ort.Tensor('float32', input, [1, 3, inputSize, inputSize]);

  const feeds = {};
  feeds[_inputName] = tensor;

  const outputs = await session.run(feeds);
  const outKey = Object.keys(outputs)[0];
  const maskTensor = outputs[outKey];
  const mask = maskTensor.data; // Float32Array, length inputSize*inputSize

  const maskImg = maskToImageData(mask, inputSize, W, H);

  // Apply to main canvas
  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;
  const m = maskImg.data;

  // Threshold edges using the smoothing control.
  // smoothing = 0   -> sharp binary cutoff at 0.5
  // smoothing = 1   -> soft ramp uses full 0.1..0.9 range
  const lo = 0.5 - smoothing * 0.4;
  const hi = 0.5 + smoothing * 0.4;
  const span = Math.max(1e-6, hi - lo);

  for (let i = 0, j = 3; i < m.length; i += 4, j += 4) {
    const conf = m[i + 3] / 255;

    if (mode === 'Transparent') {
      const alpha = conf < lo ? 0
                  : conf > hi ? 255
                  : Math.round(((conf - lo) / span) * 255);
      data[j] = alpha;
    } else if (mode === 'Silhouette') {
      if (conf > 0.5) {
        data[i]     = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  log?.('info', `[inspyrenet] Inference ${Math.round(performance.now() - t0)}ms (${_activeEP})`);
}
