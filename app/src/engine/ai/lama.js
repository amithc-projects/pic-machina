/**
 * PicMachina — LaMa Inpainting inference wrapper
 */

import { getModelBytes, isModelDownloaded } from '../../data/models.js';

const MODEL_ID = 'lama-fp32';

let _ort = null;
let _session = null;
let _sessionPromise = null;
let _activeEP = null;

async function loadOrt() {
  if (_ort) return _ort;
  const mod = await import('onnxruntime-web');
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

export async function disposeSession() {
  if (_session) {
    try { await _session.release(); } catch { /* ignore */ }
  }
  _session = null;
  _sessionPromise = null;
  _activeEP = null;
}

async function getOrCreateSession(log) {
  if (_session) return _session;
  if (_sessionPromise) return _sessionPromise;

  _sessionPromise = (async () => {
    const bytes = await getModelBytes(MODEL_ID);
    if (!bytes) throw new Error('LaMa model not downloaded.');

    const ort = await loadOrt();
    
    // Note: WebGPU often struggles with LaMa's Fast Fourier Convolutions (FFC).
    // Force WASM provider to ensure compatibility and prevent binary op tensor crashes.
    const tryEPs = ['wasm'];

    let lastErr = null;
    for (const ep of tryEPs) {
      try {
        const session = await ort.InferenceSession.create(bytes, {
          executionProviders: [ep],
          graphOptimizationLevel: 'all',
        });
        _session = session;
        _activeEP = ep;
        log?.('info', `[lama] Session ready on ${ep} EP`);
        return session;
      } catch (err) {
        lastErr = err;
        log?.('warn', `[lama] ${ep} EP failed: ${err.message || err}`);
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

function preprocess(imageCanvas, maskCanvas, size) {
  const tImg = document.createElement('canvas');
  tImg.width = size;
  tImg.height = size;
  tImg.getContext('2d').drawImage(imageCanvas, 0, 0, size, size);
  const imgData = tImg.getContext('2d').getImageData(0, 0, size, size).data;

  const tMsk = document.createElement('canvas');
  tMsk.width = size;
  tMsk.height = size;
  tMsk.getContext('2d').drawImage(maskCanvas, 0, 0, size, size);
  const mskData = tMsk.getContext('2d').getImageData(0, 0, size, size).data;

  const plane = size * size;
  const imgTensor = new Float32Array(3 * plane);
  const mskTensor = new Float32Array(1 * plane);

  for (let i = 0, px = 0; i < imgData.length; i += 4, px++) {
    // Mask is active if red channel > threshold
    const maskVal = mskData[i] > 127 ? 1.0 : 0.0;
    mskTensor[px] = maskVal;

    // CRITICAL: LaMa expects the image to be zeroed out under the mask!
    const retain = 1.0 - maskVal;
    
    imgTensor[px]             = (imgData[i] / 255.0) * retain;
    imgTensor[px + plane]     = (imgData[i + 1] / 255.0) * retain;
    imgTensor[px + 2 * plane] = (imgData[i + 2] / 255.0) * retain;
  }
  return { imgTensor, mskTensor };
}

/**
 * Runs LaMa inpainting to remove masked objects from an image.
 * 
 * @param {HTMLCanvasElement} imageCanvas The original full-res image
 * @param {HTMLCanvasElement} maskCanvas A canvas of same dimensions where white pixels = remove
 * @param {Object} opts { log: function }
 * @returns {Promise<HTMLCanvasElement>} The inpainted canvas
 */
export async function runLama(imageCanvas, maskCanvas, opts = {}) {
  const log = opts.log;
  const session = await getOrCreateSession(log);
  const ort = await loadOrt();

  const t0 = performance.now();
  
  // The Carve/LaMa-ONNX model expects exactly 512x512
  const inputSize = 512; 

  const { imgTensor, mskTensor } = preprocess(imageCanvas, maskCanvas, inputSize);

  // Dynamically match input names (usually 'image' and 'mask')
  const imageInputName = session.inputNames.find(n => n.includes('image') || n === 'x') || session.inputNames[0];
  const maskInputName = session.inputNames.find(n => n.includes('mask')) || session.inputNames[1];

  const feeds = {};
  feeds[imageInputName] = new ort.Tensor('float32', imgTensor, [1, 3, inputSize, inputSize]);
  feeds[maskInputName]  = new ort.Tensor('float32', mskTensor, [1, 1, inputSize, inputSize]);

  log?.('info', `[lama] Running inference...`);
  const outputs = await session.run(feeds);
  const outKey = session.outputNames[0];
  const outputData = outputs[outKey].data;

  // Detect output scale (some models return 0-1, some 0-255)
  let maxVal = 0;
  for (let i = 0; i < 1000; i += 10) {
    if (outputData[i] > maxVal) maxVal = outputData[i];
  }
  const isNormalized = maxVal <= 1.0;

  // Postprocess: Resize back to original
  const tmpOut = document.createElement('canvas');
  tmpOut.width = inputSize;
  tmpOut.height = inputSize;
  const tctx = tmpOut.getContext('2d');
  const outImgData = tctx.createImageData(inputSize, inputSize);
  
  const plane = inputSize * inputSize;
  for (let i = 0, px = 0; i < outImgData.data.length; i += 4, px++) {
    let r = outputData[px];
    let g = outputData[px + plane];
    let b = outputData[px + 2 * plane];

    if (isNormalized) {
      r *= 255.0;
      g *= 255.0;
      b *= 255.0;
    }

    outImgData.data[i]     = Math.max(0, Math.min(255, r));
    outImgData.data[i + 1] = Math.max(0, Math.min(255, g));
    outImgData.data[i + 2] = Math.max(0, Math.min(255, b));
    outImgData.data[i + 3] = 255;
  }
  tctx.putImageData(outImgData, 0, 0);

  // Composite: Draw the inpainted result back onto the original canvas
  // ONLY where the mask is active.
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = imageCanvas.width;
  resultCanvas.height = imageCanvas.height;
  const rctx = resultCanvas.getContext('2d');
  
  // 1. Draw original
  rctx.drawImage(imageCanvas, 0, 0);
  const origData = rctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
  
  // 2. Scale LaMa output up to original size
  const scaledInpaintCanvas = document.createElement('canvas');
  scaledInpaintCanvas.width = imageCanvas.width;
  scaledInpaintCanvas.height = imageCanvas.height;
  const sicCtx = scaledInpaintCanvas.getContext('2d');
  sicCtx.drawImage(tmpOut, 0, 0, imageCanvas.width, imageCanvas.height);
  const inpaintData = sicCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);

  // 3. Get the mask data
  const mCtx = maskCanvas.getContext('2d');
  const maskData = mCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);

  // 4. Per-pixel composite
  for (let i = 0; i < origData.data.length; i += 4) {
    if (maskData.data[i] > 127) { // If mask is active (white)
      origData.data[i]     = inpaintData.data[i];
      origData.data[i + 1] = inpaintData.data[i + 1];
      origData.data[i + 2] = inpaintData.data[i + 2];
      origData.data[i + 3] = 255;
    }
  }
  
  rctx.putImageData(origData, 0, 0);

  log?.('info', `[lama] Inference complete in ${Math.round(performance.now() - t0)}ms`);
  
  return resultCanvas;
}
