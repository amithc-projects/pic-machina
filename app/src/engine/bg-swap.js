/**
 * PicMachina — Background Swap compositor
 *
 * Called from batch.js after the per-image pipeline has already run ai-remove-bg
 * on the subject images. This module just handles the compositing:
 *
 *   bgBlob  — original background image (image 1, unprocessed)
 *   fgBlob  — subject image that has already had its background removed
 *             (transparent PNG produced by ai-remove-bg in the recipe pipeline)
 *
 * Steps:
 *   1. Decode both images to ImageBitmap
 *   2. Draw background onto output canvas (sized to match background)
 *   3. Scale/position the subject according to `scale` param
 *   4. Draw subject on top (source-over, transparency preserved)
 *   5. Return output Blob
 *
 * No MediaPipe required here — segmentation happens in the upstream ai-remove-bg step.
 */

export async function createBgSwap(bgBlob, fgBlob, params = {}) {
  const scale   = params.scale   || 'fit';
  const format  = params.format  || 'image/jpeg';
  const quality = (params.quality ?? 92) / 100;

  // 1. Decode
  const [bgBitmap, fgBitmap] = await Promise.all([
    createImageBitmap(bgBlob),
    createImageBitmap(fgBlob),
  ]);

  // 2. Set up output canvas at background dimensions
  const canvas = document.createElement('canvas');
  canvas.width  = bgBitmap.width;
  canvas.height = bgBitmap.height;
  const ctx = canvas.getContext('2d');

  // 3. Draw background
  ctx.drawImage(bgBitmap, 0, 0, canvas.width, canvas.height);

  // 4. Compute destination rect for subject and draw
  const dst = computeDestRect(
    fgBitmap.width, fgBitmap.height,
    canvas.width,   canvas.height,
    scale
  );
  ctx.drawImage(fgBitmap, dst.x, dst.y, dst.w, dst.h);

  // 5. Encode
  bgBitmap.close();
  fgBitmap.close();

  return canvasToBlob(canvas, format, quality);
}

// ── Helpers ───────────────────────────────────────────────

function computeDestRect(srcW, srcH, dstW, dstH, mode) {
  if (mode === 'none') {
    // Place at original pixel size, centred
    return {
      x: Math.round((dstW - srcW) / 2),
      y: Math.round((dstH - srcH) / 2),
      w: srcW, h: srcH,
    };
  }

  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  let w, h;

  if (mode === 'fill') {
    // Cover: scale up to fill background completely (may overflow edges)
    if (srcAspect > dstAspect) { h = dstH; w = h * srcAspect; }
    else                        { w = dstW; h = w / srcAspect; }
  } else {
    // Fit (default): scale down so entire subject is visible inside background
    if (srcAspect > dstAspect) { w = dstW; h = w / srcAspect; }
    else                        { h = dstH; w = h * srcAspect; }
  }

  return {
    x: Math.round((dstW - w) / 2),
    y: Math.round((dstH - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
  };
}

function canvasToBlob(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null')),
      format,
      quality
    );
  });
}
