/**
 * Shared helpers for saliency-using transforms. Kept in its own module so
 * transforms in different categories (ai.js, geometry.js, …) can share the
 * same subject-metadata persistence logic without creating circular imports.
 */

/**
 * Persist subject metadata on an asset record after a saliency-using
 * transform so downstream transforms (smart crop, thumbnails, filters)
 * can skip the inference step.
 *
 * `patchAsset` replaces nested objects wholesale, so we merge `vision`
 * manually to preserve prior fields like `faceCount`, `poseDetected`, etc.
 *
 * @param {string|undefined} assetHash
 * @param {{mask: Uint8ClampedArray, width: number, height: number}} maskObj
 * @param {Record<string, any>} [extraFields]  extra fields to merge into vision
 */
export async function persistSubjectVision(assetHash, maskObj, extraFields = {}) {
  if (!assetHash) return;
  try {
    const { computeSubjectBBox } = await import('./inspyrenet.js');
    const bbox = computeSubjectBBox(maskObj.mask, maskObj.width, maskObj.height);
    const { getAsset, patchAsset } = await import('../../data/assets.js');
    const existing = await getAsset(assetHash);
    const nextVision = {
      ...(existing?.vision ?? {}),
      ...extraFields,
      ...(bbox ? {
        subjectBBox:     { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h },
        subjectCentroid: bbox.centroid,
        subjectArea:     bbox.area,
        matteAt:         Date.now(),
      } : {})
    };
    await patchAsset(assetHash, { vision: nextVision });
  } catch { /* non-fatal */ }
}

/**
 * Read a previously-persisted subject bbox from the asset record. Lets a
 * subject-using transform skip inference entirely when a cached bbox is
 * still valid (same image, same model version).
 *
 * @param {string|undefined} assetHash
 * @returns {Promise<{x:number,y:number,w:number,h:number,centroid:{x:number,y:number},area:number}|null>}
 */
export async function readCachedSubjectBBox(assetHash) {
  if (!assetHash) return null;
  try {
    const { getAsset } = await import('../../data/assets.js');
    const asset = await getAsset(assetHash);
    const v = asset?.vision;
    if (!v?.subjectBBox || !v?.subjectCentroid) return null;
    return {
      x: v.subjectBBox.x,
      y: v.subjectBBox.y,
      w: v.subjectBBox.w,
      h: v.subjectBBox.h,
      centroid: v.subjectCentroid,
      area: v.subjectArea ?? 0,
    };
  } catch {
    return null;
  }
}
