/**
 * ImageChef — AI & Composition transforms
 * Heavy WASM dependencies loaded lazily.
 */

import { registry } from '../registry.js';
import { clamp } from '../../utils/misc.js';
import { persistSubjectVision } from '../ai/vision-metadata.js';

import photonWasmUrl from '../vendor/photon/photon_rs_bg.wasm?url';

let photonLib = null;
async function ensurePhoton() {
  if (photonLib) return photonLib;
  const initPhoton = (await import('../vendor/photon/photon_rs.js')).default;
  await initPhoton(photonWasmUrl);
  photonLib = await import('../vendor/photon/photon_rs.js');
  return photonLib;
}

// ─── Shared helpers for saliency-using transforms ────────
// `persistSubjectVision` lives in ../ai/vision-metadata.js so geometry
// transforms (ai-subject-crop) can share it without circular imports.

/**
 * Blur a single-channel mask using Photon's gaussian_blur. Staged through an
 * RGBA buffer because Photon operates on RGBA images; the red channel of the
 * result is read back as the new mask.
 *
 * @param {Uint8ClampedArray} mask
 * @param {number} W
 * @param {number} H
 * @param {number} radius  blur radius in pixels (0 returns a copy)
 * @returns {Promise<Uint8ClampedArray>}
 */
async function featherMaskChannel(mask, W, H, radius) {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return mask.slice();
  const photon = await ensurePhoton();
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
    rgba[j]     = mask[i];
    rgba[j + 1] = mask[i];
    rgba[j + 2] = mask[i];
    rgba[j + 3] = 255;
  }
  const img = new photon.PhotonImage(rgba, W, H);
  photon.gaussian_blur(img, r);
  const out = img.get_raw_pixels();
  img.free();
  const result = new Uint8ClampedArray(W * H);
  for (let i = 0, j = 0; i < result.length; i++, j += 4) {
    result[i] = out[j];
  }
  return result;
}

/**
 * Gaussian-blur the entire RGBA buffer of an ImageData and return the raw
 * pixel bytes. Caller owns the returned Uint8Array.
 */
async function blurImageDataPixels(imageData, radius) {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return new Uint8Array(imageData.data);
  const photon = await ensurePhoton();
  const img = new photon.PhotonImage(new Uint8Array(imageData.data), imageData.width, imageData.height);
  photon.gaussian_blur(img, r);
  const out = img.get_raw_pixels();
  img.free();
  return out;
}

// ─── Face Privacy ─────────────────────────────────────────
registry.register({
  id: 'ai-face-privacy', name: 'Face Privacy', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'hide_source',
  description: 'Detect and obscure faces (blur, pixelate, or black bar).',
  params: [
    { name: 'mode', label: 'Mode', type: 'select',
      options: [{ label: 'Blur', value: 'Blur' }, { label: 'Pixelate', value: 'Pixelate' }, { label: 'Black Bar', value: 'Bar' }],
      defaultValue: 'Blur' },
    { name: 'confidence', label: 'Min Confidence (%)', type: 'range', min: 0, max: 100, defaultValue: 30 },
    { name: 'padding', label: 'Face Padding (%)', type: 'range', min: 0, max: 100, defaultValue: 20 },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-face-privacy] Skipping — MediaPipe requires the main thread.');
      return;
    }
    try {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: (p.confidence || 30) / 100,
      });

      const result = detector.detect(ctx.canvas);
      detector.close();

      // Store face count in asset store
      if (context?.assetHash) {
        try {
          const { patchAsset } = await import('../../data/assets.js');
          await patchAsset(context.assetHash, {
            vision: { faceCount: result.detections.length, detectedAt: Date.now() }
          });
        } catch { /* non-fatal */ }
      }

      const mode = p.mode || 'Blur';
      const pad  = (p.padding || 20) / 100;
      const W = ctx.canvas.width, H = ctx.canvas.height;

      for (const detection of result.detections) {
        const bb = detection.boundingBox;
        const px = Math.round(bb.width * pad), py = Math.round(bb.height * pad);
        const x  = Math.max(0, bb.originX - px);
        const y  = Math.max(0, bb.originY - py);
        const bw = Math.min(W - x, bb.width + px * 2);
        const bh = Math.min(H - y, bb.height + py * 2);

        if (mode === 'Bar') {
          ctx.fillStyle = '#000000';
          ctx.fillRect(x, y, bw, bh);
        } else if (mode === 'Blur') {
          const photon = await ensurePhoton();
          const id = ctx.getImageData(x, y, bw, bh);
          const pimg = new photon.PhotonImage(new Uint8Array(id.data), bw, bh);
          
          let rad = Math.max(5, Math.round(bw / 10));
          // Apply blur multiple times for stronger privacy effect
          photon.gaussian_blur(pimg, rad);
          photon.gaussian_blur(pimg, rad);
          
          const outPixels = pimg.get_raw_pixels();
          const newId = new ImageData(new Uint8ClampedArray(outPixels), bw, bh);
          ctx.putImageData(newId, x, y);
          pimg.free();
        } else if (mode === 'Pixelate') {
          const tmp = document.createElement('canvas');
          tmp.width = bw; tmp.height = bh;
          const tc = tmp.getContext('2d');
          tc.drawImage(ctx.canvas, x, y, bw, bh, 0, 0, bw, bh);
          
          const ps = Math.max(4, Math.round(bw / 12));
          const id = tc.getImageData(0, 0, bw, bh); const d = id.data;
          for (let py2 = 0; py2 < bh; py2 += ps) {
            for (let px2 = 0; px2 < bw; px2 += ps) {
              const i = (py2 * bw + px2) * 4;
              const [r, g, b, a] = [d[i], d[i+1], d[i+2], d[i+3]];
              for (let dy = 0; dy < ps && py2 + dy < bh; dy++)
                for (let dx = 0; dx < ps && px2 + dx < bw; dx++) {
                  const j = ((py2 + dy) * bw + (px2 + dx)) * 4;
                  d[j] = r; d[j+1] = g; d[j+2] = b; d[j+3] = a;
                }
            }
          }
          tc.putImageData(id, 0, 0);
          // putImageData prevents alpha mixing issues just like the blur approach
          ctx.putImageData(id, x, y);
        }
      }
    } catch (err) {
      // MediaPipe requires dynamic WASM imports that are unavailable in the batch worker.
      // AI transforms are skipped during batch processing but work in the builder preview.
      if (err.message?.includes('self.import') || err.message?.includes('import is not a function')) {
        console.warn('[ai-face-privacy] AI transforms are not supported in the batch worker — step skipped.');
      } else {
        console.warn('[ai-face-privacy] failed:', err);
      }
    }
  }
});

// ─── Remove Background ────────────────────────────────────
registry.register({
  id: 'ai-remove-bg', name: 'Remove BG', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'layers_clear',
  description: 'AI-powered background removal.',
  params: [
    { name: 'mode', label: 'Mode', type: 'select',
      options: [{ label: 'Transparent BG', value: 'Transparent' }, { label: 'Silhouette (Black Subject)', value: 'Silhouette' }],
      defaultValue: 'Transparent' },
    { name: 'edgeSmoothing', label: 'Edge Smoothing (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'bgFill', label: 'Background Fill', type: 'select',
      options: [
        { label: 'None (Transparent)', value: 'none' },
        { label: 'Solid Colour',       value: 'color' },
        { label: 'Image File',         value: 'image' },
      ],
      defaultValue: 'none' },
    { name: 'bgColor', label: 'Fill Colour', type: 'color', defaultValue: '#ffffff' },
    { name: 'bgImage', label: 'Background Image', type: 'file', defaultValue: '' },
  ],
  async apply(ctx, p, context) {
    // batch.js routes AI recipes to the main thread, so this guard should never fire in normal
    // use. It's kept as a safety net in case the transform is somehow called from a worker.
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-remove-bg] Skipping — MediaPipe requires the main thread.');
      return;
    }

    try {
      const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );

      const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
          delegate: 'CPU'
        },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false
      });

      const result = segmenter.segment(ctx.canvas);
      const mask = result.confidenceMasks[0].getAsFloat32Array();
      const { width, height } = result.confidenceMasks[0];

      const mode = p.mode || 'Transparent';
      const smoothing = (p.edgeSmoothing || 50) / 100;

      // We'll work on a temporary buffer to avoid mid-drawing artifacts
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      for (let i = 0; i < mask.length; i++) {
        const conf = mask[i]; // 0.0 (bg) to 1.0 (subject)

        if (mode === 'Transparent') {
          // Adjust alpha based on confidence
          // We can apply a threshold or a smooth ramp
          const alpha = conf < (0.5 - smoothing * 0.4) ? 0 :
                        conf > (0.5 + smoothing * 0.4) ? 255 :
                        Math.round(((conf - (0.5 - smoothing * 0.4)) / (smoothing * 0.8)) * 255);
          data[i * 4 + 3] = alpha;
        } else if (mode === 'Silhouette') {
          // Keep original pixels, but if it's the subject, make it black
          if (conf > 0.5) {
            data[i * 4] = 0;
            data[i * 4 + 1] = 0;
            data[i * 4 + 2] = 0;
            // Optionally apply smoothing to the silhouette edge
            if (conf < (0.5 + smoothing * 0.2)) {
               const mix = (conf - 0.5) / (smoothing * 0.2);
               data[i*4] = Math.round(data[i*4] * mix);
               data[i*4+1] = Math.round(data[i*4+1] * mix);
               data[i*4+2] = Math.round(data[i*4+2] * mix);
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      segmenter.close();

      // Store pose/segmentation signal in asset store
      if (context?.assetHash) {
        try {
          const { patchAsset } = await import('../../data/assets.js');
          await patchAsset(context.assetHash, {
            vision: { poseDetected: true, detectedAt: Date.now() }
          });
        } catch { /* non-fatal */ }
      }

      // ── Background fill ──────────────────────────────────
      const bgFill = p.bgFill || 'none';
      if (bgFill !== 'none') {
        const W = ctx.canvas.width, H = ctx.canvas.height;

        // Snapshot the masked subject so we can composite it over the new background
        const subjectCanvas = document.createElement('canvas');
        subjectCanvas.width = W; subjectCanvas.height = H;
        const sc = subjectCanvas.getContext('2d');
        sc.drawImage(ctx.canvas, 0, 0);

        ctx.clearRect(0, 0, W, H);

        if (bgFill === 'color') {
          ctx.fillStyle = p.bgColor || '#ffffff';
          ctx.fillRect(0, 0, W, H);
        } else if (bgFill === 'image' && p.bgImage) {
          try {
            // Load via fetch + createImageBitmap so it works on both main thread and (future) workers
            const resp = await fetch(p.bgImage);
            const blob = await resp.blob();
            const bitmap = await createImageBitmap(blob);
            const scale = Math.max(W / bitmap.width, H / bitmap.height);
            const dw = bitmap.width  * scale;
            const dh = bitmap.height * scale;
            ctx.drawImage(bitmap, (W - dw) / 2, (H - dh) / 2, dw, dh);
            bitmap.close?.();
          } catch (imgErr) {
            console.warn('[ai-remove-bg] Could not load background image:', p.bgImage, imgErr);
          }
        }

        // Draw the subject back on top
        ctx.drawImage(subjectCanvas, 0, 0);
      }

    } catch (err) {
      console.warn('[ai-remove-bg] failed:', err);
    }
  }
});

// ─── Remove Background (High Quality / InSPyReNet) ───────
registry.register({
  id: 'ai-remove-bg-hq', name: 'Remove BG (High Quality)', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'auto_awesome_motion',
  description: 'High-quality background removal using InSPyReNet (SwinB). Requires a one-time ~200 MB model download (see #mdl).',
  params: [
    { name: 'mode', label: 'Mode', type: 'select',
      options: [{ label: 'Transparent BG', value: 'Transparent' }, { label: 'Silhouette (Black Subject)', value: 'Silhouette' }],
      defaultValue: 'Transparent' },
    { name: 'edgeSmoothing', label: 'Edge Smoothing (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'bgFill', label: 'Background Fill', type: 'select',
      options: [
        { label: 'None (Transparent)', value: 'none' },
        { label: 'Solid Colour',       value: 'color' },
        { label: 'Image File',         value: 'image' },
      ],
      defaultValue: 'none' },
    { name: 'bgColor', label: 'Fill Colour', type: 'color', defaultValue: '#ffffff' },
    { name: 'bgImage', label: 'Background Image', type: 'file', defaultValue: '' },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-remove-bg-hq] Skipping — onnxruntime-web requires the main thread.');
      return;
    }

    try {
      const {
        isModelReady, getSaliencyMask, applyMaskAsAlpha
      } = await import('../ai/inspyrenet.js');
      const ready = await isModelReady();
      if (!ready) {
        const msg = 'InSPyReNet model not downloaded. Open the Models screen (#mdl) to download it.';
        context?.log?.('warn', `[ai-remove-bg-hq] ${msg}`);
        console.warn(`[ai-remove-bg-hq] ${msg}`);
        return;
      }

      // One saliency pass — cached internally by canvas signature, so other
      // saliency-consuming transforms in the same recipe share this result.
      const maskObj = await getSaliencyMask(ctx.canvas, { log: context?.log });

      applyMaskAsAlpha(ctx, maskObj, {
        mode: p.mode || 'Transparent',
        edgeSmoothing: p.edgeSmoothing ?? 50,
      });

      await persistSubjectVision(context?.assetHash, maskObj, {
        bgRemoved: { model: 'inspyrenet-swinb-fp16', at: Date.now() }
      });

      // ── Background fill (shares behaviour with ai-remove-bg) ─
      const bgFill = p.bgFill || 'none';
      if (bgFill !== 'none') {
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const subjectCanvas = document.createElement('canvas');
        subjectCanvas.width = W; subjectCanvas.height = H;
        subjectCanvas.getContext('2d').drawImage(ctx.canvas, 0, 0);

        ctx.clearRect(0, 0, W, H);

        if (bgFill === 'color') {
          ctx.fillStyle = p.bgColor || '#ffffff';
          ctx.fillRect(0, 0, W, H);
        } else if (bgFill === 'image' && p.bgImage) {
          try {
            const resp = await fetch(p.bgImage);
            const blob = await resp.blob();
            const bitmap = await createImageBitmap(blob);
            const scale = Math.max(W / bitmap.width, H / bitmap.height);
            const dw = bitmap.width  * scale;
            const dh = bitmap.height * scale;
            ctx.drawImage(bitmap, (W - dw) / 2, (H - dh) / 2, dw, dh);
            bitmap.close?.();
          } catch (imgErr) {
            console.warn('[ai-remove-bg-hq] Could not load background image:', p.bgImage, imgErr);
          }
        }

        ctx.drawImage(subjectCanvas, 0, 0);
      }

    } catch (err) {
      console.warn('[ai-remove-bg-hq] failed:', err);
      context?.log?.('warn', `[ai-remove-bg-hq] failed: ${err.message || err}`);
    }
  }
});

// ─── Portrait Bokeh (InSPyReNet + Photon) ─────────────────
registry.register({
  id: 'ai-portrait-bokeh', name: 'Portrait Bokeh', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'blur_circular',
  description: 'Large-aperture lens simulation: keeps the subject sharp and blurs the background. Requires the InSPyReNet model (#mdl).',
  params: [
    { name: 'blurRadius',   label: 'Blur Strength',   type: 'range', min: 0, max: 60, defaultValue: 15 },
    { name: 'edgeFeather',  label: 'Edge Feather',    type: 'range', min: 0, max: 30, defaultValue: 8 },
    { name: 'falloff',      label: 'Depth Falloff',   type: 'select',
      options: [
        { label: 'Flat (single blur)',        value: 'flat' },
        { label: 'Graduated (two-band depth)', value: 'graduated' },
      ],
      defaultValue: 'flat' },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-portrait-bokeh] Skipping — onnxruntime-web requires the main thread.');
      return;
    }

    try {
      const blurRadius  = clamp(Math.round(p.blurRadius  ?? 15), 0, 60);
      const edgeFeather = clamp(Math.round(p.edgeFeather ?? 8),  0, 30);
      const falloff     = p.falloff || 'flat';

      if (blurRadius === 0) return;  // no-op

      const { isModelReady, getSaliencyMask } = await import('../ai/inspyrenet.js');
      const ready = await isModelReady();
      if (!ready) {
        const msg = 'InSPyReNet model not downloaded. Open the Models screen (#mdl) to download it.';
        context?.log?.('warn', `[ai-portrait-bokeh] ${msg}`);
        console.warn(`[ai-portrait-bokeh] ${msg}`);
        return;
      }

      const W = ctx.canvas.width, H = ctx.canvas.height;
      const t0 = performance.now();

      // 1) Shared saliency pass (cached by canvas signature)
      const maskObj = await getSaliencyMask(ctx.canvas, { log: context?.log });

      // 2) Feather the matte so subject→background transition isn't harsh
      const tightMask = await featherMaskChannel(maskObj.mask, W, H, edgeFeather);

      // 3) Blur the full image at the chosen radius
      const sharpImageData = ctx.getImageData(0, 0, W, H);
      const sharp = sharpImageData.data;
      const fullBlur = await blurImageDataPixels(sharpImageData, blurRadius);

      // 4) For graduated mode, compute a second half-radius blur + wider mask
      let medBlur = null, wideMask = null;
      if (falloff === 'graduated' && blurRadius >= 4) {
        medBlur  = await blurImageDataPixels(sharpImageData, Math.max(1, Math.round(blurRadius / 2)));
        wideMask = await featherMaskChannel(maskObj.mask, W, H, edgeFeather * 2);
      }

      // 5) Composite per-pixel: subject→sharp, background→blurred
      const out = sharp;  // write back into the same buffer (no cross-pixel deps)
      for (let i = 0, j = 0; i < tightMask.length; i++, j += 4) {
        const mT = tightMask[i] / 255;

        if (medBlur && wideMask) {
          const mW = wideMask[i] / 255;
          const near = mT;
          const mid  = Math.max(0, mW - mT);
          const far  = Math.max(0, 1 - mW);
          out[j]     = sharp[j]     * near + medBlur[j]     * mid + fullBlur[j]     * far;
          out[j + 1] = sharp[j + 1] * near + medBlur[j + 1] * mid + fullBlur[j + 1] * far;
          out[j + 2] = sharp[j + 2] * near + medBlur[j + 2] * mid + fullBlur[j + 2] * far;
        } else {
          const m = mT, inv = 1 - mT;
          out[j]     = sharp[j]     * m + fullBlur[j]     * inv;
          out[j + 1] = sharp[j + 1] * m + fullBlur[j + 1] * inv;
          out[j + 2] = sharp[j + 2] * m + fullBlur[j + 2] * inv;
        }
        // alpha (j+3) preserved
      }

      ctx.putImageData(sharpImageData, 0, 0);

      await persistSubjectVision(context?.assetHash, maskObj, {
        portraitBokeh: { blurRadius, edgeFeather, falloff, at: Date.now() }
      });

      context?.log?.('info', `[ai-portrait-bokeh] ${Math.round(performance.now() - t0)}ms (${falloff})`);

    } catch (err) {
      console.warn('[ai-portrait-bokeh] failed:', err);
      context?.log?.('warn', `[ai-portrait-bokeh] failed: ${err.message || err}`);
    }
  }
});

// ─── Subject Drop Shadow (InSPyReNet + Photon) ───────────
registry.register({
  id: 'ai-drop-shadow', name: 'Subject Drop Shadow', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'filter_drama',
  description: 'Cast a soft shadow behind the detected subject. Works on both transparent cut-outs and photos (shadow darkens visible background). Requires the InSPyReNet model (#mdl).',
  params: [
    { name: 'offsetX', label: 'Offset X (px)',  type: 'range', min: -100, max: 100, defaultValue: 12 },
    { name: 'offsetY', label: 'Offset Y (px)',  type: 'range', min: -100, max: 100, defaultValue: 18 },
    { name: 'blur',    label: 'Shadow Blur',    type: 'range', min: 0,    max: 80,  defaultValue: 20 },
    { name: 'opacity', label: 'Opacity (%)',    type: 'range', min: 0,    max: 100, defaultValue: 55 },
    { name: 'color',   label: 'Shadow Color',   type: 'color', defaultValue: '#000000' },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-drop-shadow] Skipping — onnxruntime-web requires the main thread.');
      return;
    }

    try {
      const offX    = clamp(Math.round(p.offsetX ?? 12), -100, 100);
      const offY    = clamp(Math.round(p.offsetY ?? 18), -100, 100);
      const blur    = clamp(Math.round(p.blur    ?? 20),  0,   80);
      const opacity = clamp(Math.round(p.opacity ?? 55),  0,  100) / 100;
      const color   = p.color || '#000000';

      if (opacity === 0) return;  // nothing to draw

      const { isModelReady, getSaliencyMask } = await import('../ai/inspyrenet.js');
      const ready = await isModelReady();
      if (!ready) {
        const msg = 'InSPyReNet model not downloaded. Open the Models screen (#mdl) to download it.';
        context?.log?.('warn', `[ai-drop-shadow] ${msg}`);
        console.warn(`[ai-drop-shadow] ${msg}`);
        return;
      }

      const W = ctx.canvas.width, H = ctx.canvas.height;
      const t0 = performance.now();

      const maskObj = await getSaliencyMask(ctx.canvas, { log: context?.log });
      const shadowMask = await featherMaskChannel(maskObj.mask, W, H, blur);
      const origMask = maskObj.mask;

      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // Per-pixel: shadow shows where the offset matte exists AND the subject
      // does NOT. We darken existing pixels toward shadow color, and for
      // transparent pixels (cut-outs) we also write alpha so the shadow is
      // visible.
      const imageData = ctx.getImageData(0, 0, W, H);
      const data = imageData.data;

      for (let y = 0; y < H; y++) {
        const sy = y - offY;
        if (sy < 0 || sy >= H) {
          // Whole row has no shadow contribution; still need to skip subject
          continue;
        }
        for (let x = 0; x < W; x++) {
          const sx = x - offX;
          if (sx < 0 || sx >= W) continue;
          const i  = y * W + x;
          const si = sy * W + sx;
          const subj = origMask[i] / 255;
          const shadowCoverage = (shadowMask[si] / 255) * opacity * (1 - subj);
          if (shadowCoverage <= 0) continue;

          const p4  = i * 4;
          const inv = 1 - shadowCoverage;
          data[p4]     = data[p4]     * inv + r * shadowCoverage;
          data[p4 + 1] = data[p4 + 1] * inv + g * shadowCoverage;
          data[p4 + 2] = data[p4 + 2] * inv + b * shadowCoverage;
          // For transparent backgrounds the shadow also needs to WRITE alpha.
          // For opaque photos the max() leaves alpha=255 untouched.
          const newA = Math.round(shadowCoverage * 255);
          if (newA > data[p4 + 3]) data[p4 + 3] = newA;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      await persistSubjectVision(context?.assetHash, maskObj, {
        dropShadow: { offX, offY, blur, opacity, color, at: Date.now() }
      });

      context?.log?.('info', `[ai-drop-shadow] ${Math.round(performance.now() - t0)}ms`);

    } catch (err) {
      console.warn('[ai-drop-shadow] failed:', err);
      context?.log?.('warn', `[ai-drop-shadow] failed: ${err.message || err}`);
    }
  }
});

// ─── Sticker Outline (InSPyReNet + Photon) ───────────────
registry.register({
  id: 'ai-sticker-outline', name: 'Sticker Outline', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'filter_frames',
  description: 'Cut out the detected subject with a solid border, like a sticker. Optional second ring for a double-outline look. Requires the InSPyReNet model (#mdl).',
  params: [
    { name: 'thickness',     label: 'Outline Thickness (px)', type: 'range',   min: 1, max: 40, defaultValue: 8 },
    { name: 'color',         label: 'Outline Color',          type: 'color',   defaultValue: '#ffffff' },
    { name: 'doubleOutline', label: 'Double Outline',         type: 'boolean', defaultValue: false },
    { name: 'secondColor',   label: 'Second Outline Color',   type: 'color',   defaultValue: '#000000' },
    { name: 'bgMode',        label: 'Background', type: 'select',
      options: [
        { label: 'Transparent',   value: 'transparent' },
        { label: 'Keep original', value: 'keep' },
      ],
      defaultValue: 'transparent' },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-sticker-outline] Skipping — onnxruntime-web requires the main thread.');
      return;
    }

    try {
      const thickness = clamp(Math.round(p.thickness ?? 8), 1, 40);
      const color1    = p.color        || '#ffffff';
      const double    = !!p.doubleOutline;
      const color2    = p.secondColor  || '#000000';
      const bgMode    = p.bgMode       || 'transparent';

      const { isModelReady, getSaliencyMask } = await import('../ai/inspyrenet.js');
      const ready = await isModelReady();
      if (!ready) {
        const msg = 'InSPyReNet model not downloaded. Open the Models screen (#mdl) to download it.';
        context?.log?.('warn', `[ai-sticker-outline] ${msg}`);
        console.warn(`[ai-sticker-outline] ${msg}`);
        return;
      }

      const W = ctx.canvas.width, H = ctx.canvas.height;
      const t0 = performance.now();

      const maskObj = await getSaliencyMask(ctx.canvas, { log: context?.log });
      const origMask = maskObj.mask;

      // Blur-then-threshold approximates morphological dilation. Blur radius
      // ≈ thickness px means any pixel within ~thickness of the subject gets
      // a non-trivial contribution.
      const dil1 = await featherMaskChannel(origMask, W, H, thickness);
      const dil2 = double ? await featherMaskChannel(origMask, W, H, thickness * 2) : null;

      const parseHex = (hex) => ({
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
      });
      const c1 = parseHex(color1);
      const c2 = parseHex(color2);

      // Threshold for "is in the dilated region" — low value gives a wider,
      // softer reach of the outline; higher gives a tighter ring. 40/255 is a
      // good balance for thickness-sized blur kernels.
      const DILATE_T = 40;
      const SUBJ_T   = 127;  // 50% matte confidence

      const imageData = ctx.getImageData(0, 0, W, H);
      const data = imageData.data;

      for (let i = 0, p4 = 0; i < origMask.length; i++, p4 += 4) {
        const subj  = origMask[i];
        const d1    = dil1[i];
        const d2    = dil2 ? dil2[i] : 0;

        if (subj > SUBJ_T) {
          // Inside subject — keep original pixels, force opaque
          data[p4 + 3] = 255;
        } else if (d1 > DILATE_T) {
          // First outline ring
          data[p4]     = c1.r;
          data[p4 + 1] = c1.g;
          data[p4 + 2] = c1.b;
          data[p4 + 3] = 255;
        } else if (double && d2 > DILATE_T) {
          // Second outline ring
          data[p4]     = c2.r;
          data[p4 + 1] = c2.g;
          data[p4 + 2] = c2.b;
          data[p4 + 3] = 255;
        } else if (bgMode === 'transparent') {
          data[p4 + 3] = 0;
        }
        // bgMode 'keep' → leave original pixel untouched
      }

      ctx.putImageData(imageData, 0, 0);

      await persistSubjectVision(context?.assetHash, maskObj, {
        stickerOutline: {
          thickness, color: color1,
          double, secondColor: double ? color2 : null,
          bgMode, at: Date.now(),
        }
      });

      context?.log?.('info', `[ai-sticker-outline] ${Math.round(performance.now() - t0)}ms (${double ? 'double' : 'single'})`);

    } catch (err) {
      console.warn('[ai-sticker-outline] failed:', err);
      context?.log?.('warn', `[ai-sticker-outline] failed: ${err.message || err}`);
    }
  }
});

// ─── Silhouette ───────────────────────────────────────────
registry.register({
  id: 'ai-silhouette', name: 'Silhouette', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'person_off',
  description: 'Black out subjects while keeping background.',
  params: [
    { name: 'color', label: 'Color', type: 'color', defaultValue: '#000000' },
    { name: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 100, defaultValue: 100 },
  ],
  async apply(ctx, p) {
    // Re-use remove-bg logic but forced to Silhouette mode
    const node = registry.get('ai-remove-bg');
    await node.apply(ctx, { mode: 'Silhouette', edgeSmoothing: 20 });
    
    if (p.color !== '#000000') {
       // Optional: tint the silhouette if needed, but for now simple black is requested
    }
  }
});

// ─── Smart Redact ─────────────────────────────────────────
registry.register({
  id: 'ai-smart-redact', name: 'Smart Redact', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'shield_lock',
  description: 'Detect and blur licence plates, text, or faces using OCR. Use Extract mode to store OCR text without modifying the image.',
  params: [
    { name: 'mode', label: 'Mode', type: 'select',
      options: [{ label: 'Redact (blur/bar)', value: 'redact' }, { label: 'Extract (store only)', value: 'extract' }],
      defaultValue: 'redact' },
    { name: 'targets', label: 'Targets', type: 'select',
      options: [{ label: 'Text (OCR)', value: 'Text' }, { label: 'All Faces', value: 'Face' }],
      defaultValue: 'Text' },
    { name: 'method', label: 'Method', type: 'select',
      options: [{ label: 'Blur', value: 'Blur' }, { label: 'Black Bar', value: 'Bar' }],
      defaultValue: 'Blur' },
  ],
  async apply(ctx, p, context) {
    if (p.targets === 'Text') {
      try {
        context?.log?.('info', '[OCR] Starting Tesseract…');
        const Tesseract = (await import('tesseract.js'));
        const worker = await Tesseract.createWorker('eng');
        const blob = await new Promise(res => ctx.canvas.toBlob(res, 'image/png'));
        const url = URL.createObjectURL(blob);
        const { data } = await worker.recognize(url);
        URL.revokeObjectURL(url);
        await worker.terminate();

        const wordCount = (data.words || []).length;
        context?.log?.('info', `[OCR] Recognised ${wordCount} word(s). Text: "${(data.text || '').slice(0, 80).replace(/\n/g, ' ')}…"`);

        const extractMode = (p.mode || 'redact') === 'extract';

        // Store OCR results in asset store
        if (context?.assetHash && data.text?.trim()) {
          try {
            const { patchAsset } = await import('../../data/assets.js');
            const words = (data.words || []).map(w => ({
              text: w.text,
              confidence: w.confidence,
              bbox: [w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1],
            }));
            await patchAsset(context.assetHash, {
              ocr: { text: data.text.trim(), words, tags: [], ocrAt: Date.now() }
            });
            // Also expose in context so {{sidecar.ocrText}} works downstream
            if (!context.sidecar) context.sidecar = {};
            context.sidecar.ocrText = data.text.trim();
            context?.log?.('info', `[OCR] Stored to asset store. ${extractMode ? 'Extract mode — image unchanged.' : ''}`);
          } catch (storeErr) {
            context?.log?.('warn', `[OCR] Failed to write to asset store: ${storeErr.message}`);
          }
        } else if (!data.text?.trim()) {
          context?.log?.('warn', '[OCR] No text detected in image.');
        }

        if (extractMode) return;  // don't modify the image

        for (const word of data.words || []) {
          const { x0, y0, x1, y1 } = word.bbox;
          const bw = x1 - x0, bh = y1 - y0;
          if (p.method === 'Bar') {
            ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, bw, bh);
          } else {
            const tmp = document.createElement('canvas');
            tmp.width = bw; tmp.height = bh;
            const tc = tmp.getContext('2d'); tc.drawImage(ctx.canvas, x0, y0, bw, bh, 0, 0, bw, bh);
            const bc = document.createElement('canvas');
            bc.width = bw; bc.height = bh;
            const bcc = bc.getContext('2d');
            bcc.filter = `blur(${Math.max(4, Math.round(bh / 3))}px)`;
            bcc.drawImage(tmp, 0, 0);
            ctx.drawImage(bc, x0, y0);
          }
        }
      } catch (err) {
        context?.log?.('error', `[OCR] Tesseract failed: ${err.message}`);
        console.warn('[ai-smart-redact] OCR failed:', err);
      }
    }
  }
});

// ─── OCR Tag Extractor ────────────────────────────────────
registry.register({
  id: 'ai-ocr-tag', name: 'OCR Tag Extractor', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'label',
  description: 'Extract tags from stored OCR text (dates, prices, proper nouns). Requires Smart Redact (Extract mode) to have run first.',
  params: [
    { name: 'minLength', label: 'Min word length', type: 'range', min: 2, max: 10, defaultValue: 3 },
  ],
  async apply(ctx, p, context) {
    let rawText = context?.sidecar?.ocrText || '';

    // Fall back to previously-stored OCR text so tags work without re-running OCR
    if (!rawText && context?.assetHash) {
      try {
        const { getAsset } = await import('../../data/assets.js');
        const asset = await getAsset(context.assetHash);
        rawText = asset?.ocr?.text || '';
      } catch { /* non-fatal */ }
    }

    if (!rawText || !context?.assetHash) return;

    const min = p.minLength || 3;
    const STOP_WORDS = new Set(['the','and','for','are','but','not','you','all','can','her','was','one','our','out','had','him','his','has','its','now','who','did','get','may','that','this','with','have','from','they','will','been','said','each','which','she','how','their','time','if','then','about','many','some','would','make','like','into','him','could','when','than','more','very','just','know','take','people','year','your','good','much','come']);

    // Simple tag extraction: meaningful words + date patterns + currency
    const tags = new Set();

    // Dates: DD/MM/YYYY, YYYY-MM-DD, Month Day Year
    const dateRe = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/g;
    for (const m of rawText.matchAll(dateRe)) tags.add(m[0]);

    // Prices: $123.45, €99, £50
    const priceRe = /[$€£]\s*\d[\d,]*(?:\.\d{1,2})?/g;
    for (const m of rawText.matchAll(priceRe)) tags.add(m[0].trim());

    // Meaningful words (capitalised = likely proper noun; long words = likely meaningful)
    for (const word of rawText.split(/\s+/)) {
      const clean = word.replace(/[^a-zA-Z]/g, '');
      if (clean.length < min) continue;
      if (STOP_WORDS.has(clean.toLowerCase())) continue;
      if (/^[A-Z][a-z]/.test(clean)) tags.add(clean);  // proper nouns
    }

    const tagArray = [...tags].slice(0, 30);  // cap at 30 tags
    context?.log?.('info', `[OCR Tags] Extracted ${tagArray.length} tag(s): ${tagArray.join(', ')}`);

    try {
      const { patchAsset, getAsset } = await import('../../data/assets.js');
      const asset = await getAsset(context.assetHash);
      await patchAsset(context.assetHash, {
        ocr: { ...(asset?.ocr ?? {}), tags: tagArray }
      });
      if (!context.sidecar) context.sidecar = {};
      context.sidecar.ocrTags = tagArray.join(', ');
    } catch (err) {
      context?.log?.('warn', `[OCR Tags] Failed to store tags: ${err.message}`);
    }
  }
});

// ─── Analyse People ───────────────────────────────────────
registry.register({
  id: 'ai-analyse-people', name: 'Analyse People', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'group',
  description: 'Detect and classify people using body pose landmarks and face detection. Stores results to asset metadata without modifying the image. Exposes {{sidecar.faceCount}}, {{sidecar.personCount}}, {{sidecar.poseLabel}}, {{sidecar.peopleLabel}}.',
  params: [
    { name: 'faceConfidence', label: 'Min Face Confidence (%)', type: 'range', min: 0, max: 100, defaultValue: 60 },
    { name: 'poseConfidence', label: 'Min Pose Confidence (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'maxPoses',       label: 'Max people to detect',   type: 'range', min: 1, max: 10,  defaultValue: 5 },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-analyse-people] Skipping — MediaPipe requires the main thread.');
      return;
    }

    const { FilesetResolver } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );

    let faceCount  = 0;
    let personCount = 0;
    let poseLabels  = [];   // per-person: 'standing' | 'sitting' | 'unknown'

    // ── Pose landmarker — person count + standing/sitting ──
    try {
      const { PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        numPoses: p.maxPoses || 5,
        minPoseDetectionConfidence: (p.poseConfidence || 50) / 100,
        minPosePresenceConfidence:  (p.poseConfidence || 50) / 100,
        minTrackingConfidence:      0.5,
      });

      const result = landmarker.detect(ctx.canvas);
      landmarker.close();

      personCount = result.landmarks.length;

      // Classify each person's pose via knee angle (hip → knee → ankle)
      for (const landmarks of result.landmarks) {
        // MediaPipe pose landmark indices:
        //   23/24 = left/right hip, 25/26 = left/right knee, 27/28 = left/right ankle
        const lm = landmarks;
        const hip   = avgLandmark(lm[23], lm[24]);
        const knee  = avgLandmark(lm[25], lm[26]);
        const ankle = avgLandmark(lm[27], lm[28]);

        const minVis = Math.min(hip.vis, knee.vis, ankle.vis);
        if (minVis < 0.4) {
          poseLabels.push('unknown');
          continue;
        }

        // Angle at knee between vectors knee→hip and knee→ankle
        const v1 = { x: hip.x - knee.x,   y: hip.y - knee.y };
        const v2 = { x: ankle.x - knee.x, y: ankle.y - knee.y };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2);
        const angleDeg = mag > 0 ? Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI) : 0;

        // Straight leg ≈ 160°+ = standing; bent leg < 130° = sitting
        poseLabels.push(angleDeg >= 150 ? 'standing' : angleDeg <= 130 ? 'sitting' : 'unknown');
      }

      context?.log?.('info', `[Analyse People] ${personCount} person(s) detected. Poses: ${poseLabels.join(', ') || 'none'}`);
    } catch (err) {
      context?.log?.('warn', `[Analyse People] Pose landmarker failed: ${err.message}`);
    }

    // ── Face detector — visible frontal face count ─────────
    try {
      const { FaceDetector } = await import('@mediapipe/tasks-vision');
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: (p.faceConfidence || 60) / 100,
      });
      const result = detector.detect(ctx.canvas);
      detector.close();
      faceCount = result.detections.length;
      context?.log?.('info', `[Analyse People] ${faceCount} face(s) visible.`);
    } catch (err) {
      context?.log?.('warn', `[Analyse People] Face detection failed: ${err.message}`);
    }

    // ── Summarise pose across all detected people ──────────
    const standingCount = poseLabels.filter(l => l === 'standing').length;
    const sittingCount  = poseLabels.filter(l => l === 'sitting').length;
    let poseLabel = 'unknown';
    if (personCount > 0) {
      if (standingCount > 0 && sittingCount === 0) poseLabel = 'standing';
      else if (sittingCount > 0 && standingCount === 0) poseLabel = 'sitting';
      else if (standingCount > 0 && sittingCount > 0) poseLabel = 'mixed';
    }

    // ── Human-readable summary ─────────────────────────────
    const countWord = n => n === 0 ? 'no' : n === 1 ? 'one' : n === 2 ? 'two' : String(n);
    let peopleLabel = personCount === 0 ? 'no people'
      : `${countWord(personCount)} ${personCount === 1 ? 'person' : 'people'}${poseLabel !== 'unknown' ? ` (${poseLabel})` : ''}`;

    // ── Write to asset store ────────────────────────────────
    if (context?.assetHash) {
      try {
        const { patchAsset } = await import('../../data/assets.js');
        await patchAsset(context.assetHash, {
          vision: { faceCount, personCount, poseLabel, poseLabels, peopleLabel, detectedAt: Date.now() },
        });
      } catch { /* non-fatal */ }
    }

    // ── Expose via sidecar for downstream interpolation ────
    if (!context.sidecar) context.sidecar = {};
    context.sidecar.faceCount   = String(faceCount);
    context.sidecar.personCount = String(personCount);
    context.sidecar.poseLabel   = poseLabel;        // 'standing' | 'sitting' | 'mixed' | 'unknown'
    context.sidecar.peopleLabel = peopleLabel;      // 'two people (sitting)'
  }
});

/** Average two landmarks, returning { x, y, vis } */
function avgLandmark(a, b) {
  return {
    x:   (a.x + b.x) / 2,
    y:   (a.y + b.y) / 2,
    vis: ((a.visibility ?? 1) + (b.visibility ?? 1)) / 2,
  };
}

// ─── Glowing Eyes ─────────────────────────────────────────
registry.register({
  id: 'ai-glow-eyes', name: 'Glowing Eyes', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'visibility',
  description: 'Detect faces and replace irises with supernatural glowing eyes. Uses FaceLandmarker iris landmarks (468/473) for pixel-accurate iris centre and radius.',
  params: [
    { name: 'color',      label: 'Glow Color',                  type: 'color',   defaultValue: '#ff2200' },
    { name: 'intensity',  label: 'Intensity (%)',                type: 'range',   min: 10, max: 100, defaultValue: 88 },
    { name: 'irisScale',  label: 'Iris Size (%)',                type: 'range',   min: 60, max: 200, defaultValue: 110 },
    { name: 'glowSpread', label: 'Glow Spread (× iris radius)', type: 'range',   min: 150, max: 600, defaultValue: 320 },
    { name: 'darkPupil',  label: 'Dark Pupil',                  type: 'boolean', defaultValue: true },
    { name: 'confidence', label: 'Min Detection Confidence (%)', type: 'range',   min: 10, max: 100, defaultValue: 50 },
  ],
  async apply(ctx, p) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-glow-eyes] Skipping — MediaPipe requires the main thread.');
      return;
    }
    try {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        numFaces: 5,
        minFaceDetectionConfidence: (p.confidence || 50) / 100,
        minFacePresenceConfidence:  0.5,
        minTrackingConfidence:      0.5,
        outputFaceBlendshapes:               false,
        outputFacialTransformationMatrixes:  false,
      });

      const result = landmarker.detect(ctx.canvas);
      landmarker.close();

      const W = ctx.canvas.width, H = ctx.canvas.height;
      const intensity   = (p.intensity  ?? 88)  / 100;
      const irisScale   = (p.irisScale  ?? 110) / 100;
      const glowSpread  = (p.glowSpread ?? 320) / 100;
      const color       = p.color || '#ff2200';
      const darkPupil   = p.darkPupil !== false;

      function hexToRgb(hex) {
        const h = hex.replace('#', '');
        return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
      }
      const { r, g, b } = hexToRgb(color);

      // MediaPipe FaceLandmarker iris landmark indices (normalised 0–1):
      //   468 = left iris centre,  469–472 = left iris boundary
      //   473 = right iris centre, 474–477 = right iris boundary
      for (const landmarks of result.faceLandmarks) {
        const irisGroups = [
          { centre: landmarks[468], boundary: landmarks[469] },  // left iris
          { centre: landmarks[473], boundary: landmarks[474] },  // right iris
        ];

        ctx.save();

        for (const { centre, boundary } of irisGroups) {
          if (!centre || !boundary) continue;

          const cx = centre.x   * W;
          const cy = centre.y   * H;
          const bx = boundary.x * W;
          const by = boundary.y * H;

          // Pixel-accurate iris radius from landmark geometry
          const irisR  = Math.hypot(bx - cx, by - cy) * irisScale;
          const glowR  = irisR * glowSpread;

          // 1. Subtle multiply darkening — deepens existing shadows without pasting black
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = '#000000';
          ctx.beginPath(); ctx.arc(cx, cy, irisR * 1.1, 0, Math.PI * 2); ctx.fill();

          // 2. Screen-mode iris color fill — luminous, additive, blends with underlying texture
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = intensity * 0.85;
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(cx, cy, irisR * 0.95, 0, Math.PI * 2); ctx.fill();

          // 3. Hot bright core — radial gradient bright center fading to color (screen)
          const irisGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, irisR);
          irisGrad.addColorStop(0,   `rgba(255,255,255,${intensity * 0.7})`); // hot white centre
          irisGrad.addColorStop(0.4, `rgba(${r},${g},${b},${intensity * 0.8})`);
          irisGrad.addColorStop(1,   `rgba(0,0,0,0)`);
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 1;
          ctx.fillStyle = irisGrad;
          ctx.beginPath(); ctx.arc(cx, cy, irisR, 0, Math.PI * 2); ctx.fill();

          // 4. Dark pupil (source-over — physical black centre)
          if (darkPupil) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = '#000000';
            ctx.beginPath(); ctx.arc(cx, cy, irisR * 0.28, 0, Math.PI * 2); ctx.fill();
          }

          // 5. Specular highlight — tiny white catch-light top-right
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(cx + irisR * 0.22, cy - irisR * 0.28, irisR * 0.10, 0, Math.PI * 2); ctx.fill();

          // 6. Inner tight glow — screen, wraps just beyond iris edge
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 1;
          const innerGrad = ctx.createRadialGradient(cx, cy, irisR * 0.3, cx, cy, irisR * 1.8);
          innerGrad.addColorStop(0,   `rgba(${r},${g},${b},${intensity * 0.9})`);
          innerGrad.addColorStop(0.5, `rgba(${r},${g},${b},${intensity * 0.5})`);
          innerGrad.addColorStop(1,   `rgba(0,0,0,0)`);
          ctx.fillStyle = innerGrad;
          ctx.beginPath(); ctx.arc(cx, cy, irisR * 1.8, 0, Math.PI * 2); ctx.fill();

          // 7. Outer diffuse glow — screen, large radius, illuminates surrounding skin
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.75;
          const outerGrad = ctx.createRadialGradient(cx, cy, irisR, cx, cy, glowR);
          outerGrad.addColorStop(0,   `rgba(${r},${g},${b},${intensity * 0.5})`);
          outerGrad.addColorStop(0.35, `rgba(${r},${g},${b},${intensity * 0.2})`);
          outerGrad.addColorStop(0.7,  `rgba(${r},${g},${b},${intensity * 0.06})`);
          outerGrad.addColorStop(1,    `rgba(0,0,0,0)`);
          ctx.fillStyle = outerGrad;
          ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
      }
    } catch (err) {
      console.warn('[ai-glow-eyes] failed:', err);
    }
  }
});

// ─── Clipping Mask ────────────────────────────────────────
registry.register({
  id: 'ai-clipping-mask', name: 'Clipping Mask', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'crop_free',
  description: 'Apply a shape-based clipping mask.',
  params: [
    { name: 'shape', label: 'Shape', type: 'select',
      options: [{ label: 'Circle', value: 'Circle' }, { label: 'Rounded Rectangle', value: 'RoundedRect' }, { label: 'Diamond', value: 'Diamond' }],
      defaultValue: 'Circle' },
    { name: 'feathering', label: 'Feathering (%)', type: 'range', min: 0, max: 50, defaultValue: 0 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    const tc = tmp.getContext('2d'); tc.drawImage(ctx.canvas, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.beginPath();
    if (p.shape === 'Circle') {
      ctx.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2);
    } else if (p.shape === 'RoundedRect') {
      ctx.roundRect(0, 0, W, H, Math.min(W, H) * 0.1);
    } else { // Diamond
      ctx.moveTo(W / 2, 0); ctx.lineTo(W, H / 2); ctx.lineTo(W / 2, H); ctx.lineTo(0, H / 2);
    }
    ctx.clip(); ctx.drawImage(tmp, 0, 0); ctx.restore();
  }
});
