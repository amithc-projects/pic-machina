/**
 * PicMachina — Thumbnail generation (baseline + subject-aware "smart")
 *
 * Two exports:
 *   generateBaselineThumbnail(source, opts)  — fast, no inference. Cover-crop.
 *   generateSmartThumbnail(source, opts)     — subject-aware crop via InSPyReNet
 *                                              saliency; returns null if the
 *                                              model isn't downloaded or no
 *                                              subject is found (caller should
 *                                              fall back to the baseline).
 *
 * Both accept File | Blob | HTMLCanvasElement | ImageBitmap as `source` and
 * return `{ dataUrl, blob, bbox? }` (blob = JPEG). The smart version also
 * returns the detected bbox in source pixels for callers that want to persist
 * it.
 *
 * See `.ai-enhancenments.md` §2 — Content-Aware Thumbnails.
 */

/**
 * Internal: rasterise any supported source type onto a fresh 2D canvas at
 * native resolution.
 *
 * @param {File|Blob|HTMLCanvasElement|ImageBitmap} source
 * @returns {Promise<HTMLCanvasElement>}
 */
async function rasterise(source) {
  let bitmap = null;
  let canvas = null;

  if (source instanceof HTMLCanvasElement) {
    canvas = document.createElement('canvas');
    canvas.width  = source.width;
    canvas.height = source.height;
    canvas.getContext('2d').drawImage(source, 0, 0);
    return canvas;
  }

  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    bitmap = source;
  } else {
    // File / Blob
    bitmap = await createImageBitmap(source);
  }

  canvas = document.createElement('canvas');
  canvas.width  = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  if (source !== bitmap) bitmap.close?.();
  return canvas;
}

/**
 * Internal: cover-crop from `src` to a destination of (dstW, dstH), centred
 * on (cx, cy) in source pixels. Returns `{ dataUrl, blob }` JPEG encoded.
 *
 * @param {HTMLCanvasElement} src
 * @param {number} dstW
 * @param {number} dstH
 * @param {{x:number,y:number}|null} centroid  null → image centre
 * @param {number} quality
 */
async function coverCropToJpeg(src, dstW, dstH, centroid, quality) {
  const sW = src.width, sH = src.height;
  const srcAspect = sW / sH;
  const dstAspect = dstW / dstH;

  // Determine crop rect in source pixels (largest rect of dstAspect inside src).
  let cw, ch;
  if (srcAspect > dstAspect) {
    // source wider than target → crop sides
    ch = sH;
    cw = Math.round(ch * dstAspect);
  } else {
    cw = sW;
    ch = Math.round(cw / dstAspect);
  }

  const cx0 = centroid ? (centroid.x - cw / 2) : (sW - cw) / 2;
  const cy0 = centroid ? (centroid.y - ch / 2) : (sH - ch) / 2;
  const cx = Math.max(0, Math.min(sW - cw, Math.round(cx0)));
  const cy = Math.max(0, Math.min(sH - ch, Math.round(cy0)));

  const out = document.createElement('canvas');
  out.width  = dstW;
  out.height = dstH;
  const octx = out.getContext('2d');
  octx.fillStyle = '#ffffff'; // in case source has alpha
  octx.fillRect(0, 0, dstW, dstH);
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(src, cx, cy, cw, ch, 0, 0, dstW, dstH);

  const dataUrl = out.toDataURL('image/jpeg', quality);
  const blob = await new Promise(resolve => out.toBlob(resolve, 'image/jpeg', quality));
  return { dataUrl, blob };
}

/**
 * Fast, subject-agnostic cover-crop thumbnail. Always succeeds.
 *
 * @param {File|Blob|HTMLCanvasElement|ImageBitmap} source
 * @param {{width?: number, height?: number, quality?: number}} [opts]
 * @returns {Promise<{dataUrl: string, blob: Blob}>}
 */
export async function generateBaselineThumbnail(source, opts = {}) {
  const width   = opts.width   || 480;
  const height  = opts.height  || 300;
  const quality = opts.quality ?? 0.82;

  const src = await rasterise(source);
  return coverCropToJpeg(src, width, height, null, quality);
}

/**
 * Subject-aware cover-crop thumbnail. Runs InSPyReNet to locate the subject
 * then centres the crop on the subject centroid. Returns `null` if:
 *   - the model is not downloaded,
 *   - no subject pixel exceeds the threshold (flat/abstract scene),
 *   - inference throws.
 * In all of those cases the caller should fall back to `generateBaselineThumbnail`.
 *
 * @param {File|Blob|HTMLCanvasElement|ImageBitmap} source
 * @param {{
 *   width?: number, height?: number, quality?: number,
 *   threshold?: number,                 // 0..1 matte confidence, default 0.5
 *   padding?: number,                   // percent of bbox to inflate, default 0.15
 *   log?: (lvl:string, msg:string)=>void
 * }} [opts]
 * @returns {Promise<{dataUrl: string, blob: Blob, bbox: {x:number,y:number,w:number,h:number,centroid:{x:number,y:number},area:number}} | null>}
 */
export async function generateSmartThumbnail(source, opts = {}) {
  const width     = opts.width     || 480;
  const height    = opts.height    || 300;
  const quality   = opts.quality   ?? 0.85;
  const threshold = opts.threshold ?? 0.5;
  const padding   = opts.padding   ?? 0.15;
  const log       = opts.log;

  let mod;
  try {
    mod = await import('../engine/ai/inspyrenet.js');
  } catch (err) {
    log?.('warn', `[thumbnails] failed to load inspyrenet: ${err.message || err}`);
    return null;
  }

  const { isModelReady, getSaliencyMask, computeSubjectBBox } = mod;

  try {
    if (!(await isModelReady())) {
      log?.('info', '[thumbnails] smart thumbnail skipped — model not downloaded');
      return null;
    }

    const src = await rasterise(source);

    // Saliency + bbox. Bypass cache: each thumbnail source is a different image.
    const maskObj = await getSaliencyMask(src, { log, bypassCache: true });
    const bbox = computeSubjectBBox(maskObj.mask, maskObj.width, maskObj.height, { threshold });
    if (!bbox) {
      log?.('info', '[thumbnails] smart thumbnail skipped — no subject above threshold');
      return null;
    }

    // Inflate bbox by padding% of its own dims so we don't crop tight to edges.
    const pw = bbox.w * padding;
    const ph = bbox.h * padding;
    const inflated = {
      x: Math.max(0, bbox.x - pw),
      y: Math.max(0, bbox.y - ph),
      w: Math.min(src.width,  bbox.w + pw * 2),
      h: Math.min(src.height, bbox.h + ph * 2),
    };

    // Crop rect of target aspect that contains the inflated bbox, centred on
    // the subject centroid and clamped to image bounds.
    const dstAspect = width / height;
    let cw = Math.max(inflated.w, inflated.h * dstAspect);
    let ch = cw / dstAspect;
    if (cw > src.width)  { cw = src.width;  ch = cw / dstAspect; }
    if (ch > src.height) { ch = src.height; cw = ch * dstAspect; }
    cw = Math.round(cw);
    ch = Math.round(ch);

    // Position centroid at the centre of the crop rect, then clamp.
    const { x: cxC, y: cyC } = bbox.centroid;
    const x0 = Math.max(0, Math.min(src.width  - cw, Math.round(cxC - cw / 2)));
    const y0 = Math.max(0, Math.min(src.height - ch, Math.round(cyC - ch / 2)));

    // Render to final output.
    const out = document.createElement('canvas');
    out.width  = width;
    out.height = height;
    const octx = out.getContext('2d');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, width, height);
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(src, x0, y0, cw, ch, 0, 0, width, height);

    const dataUrl = out.toDataURL('image/jpeg', quality);
    const blob = await new Promise(resolve => out.toBlob(resolve, 'image/jpeg', quality));
    return { dataUrl, blob, bbox };
  } catch (err) {
    log?.('warn', `[thumbnails] smart thumbnail failed: ${err.message || err}`);
    console.warn('[thumbnails] smart thumbnail failed:', err);
    return null;
  }
}

/**
 * Convert a data: URL (as stored on recipe.thumbnail) back into a Blob so it
 * can be fed into `generateSmartThumbnail` for the Rebuild-thumbnails flow.
 *
 * @param {string} dataUrl
 * @returns {Promise<Blob>}
 */
export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}
