/**
 * PicMachina — Face Swap Engine (Machina-Swap)
 *
 * Cross-mesh affine face warping between a source and a target image.
 *
 * Two seam-blending modes are supported via params.blendMode:
 *   • 'feather' (default — backward-compatible)
 *       Blur the alpha mask of the warped face to feather the edge,
 *       then alpha-composite over the target. Fast and predictable but
 *       leaves a visible boundary when source and target differ in
 *       lighting / palette (e.g. modern photo on aged painting).
 *
 *   • 'poisson'
 *       Gradient-domain seamless cloning (Pérez et al. 2003). The
 *       warped face contributes its *gradients* only — boundary pixels
 *       are anchored to the target image, and interior pixels are
 *       reconstructed by solving ∇²f = ∇²source with f = target on the
 *       mask boundary. Colour and lighting transfer automatically from
 *       the surrounding painting, so a face dropped onto Mona Lisa
 *       comes out with Mona Lisa's skin tone, varnish hue, and shading
 *       — no visible seam.
 *
 *       Solver: Gauss-Seidel with Successive Over-Relaxation
 *       (omega ≈ 1.85), restricted to the mask's bounding box. Iterates
 *       until per-channel max delta < tolerance or maxIters reached.
 */

import { getFaceMeshTriangles } from './utils/delaunay.js';
import { drawAffineTriangle }   from './utils/perspective.js';

let _landmarker = null;

async function extractHeadLandmarks(bmp) {
  if (!_landmarker) {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');
    _landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task' },
      runningMode: 'IMAGE',
      numFaces: 1
    });
  }
  const result = _landmarker.detect(bmp);
  return result.faceLandmarks?.[0] || null;
}

export async function createFaceSwap(sourceBlob, targetBlob, params = {}) {
  // Three blendModes:
  //   'feather'        — alpha-feathered overlay (legacy)
  //   'poisson'        — gradient-domain seamless cloning, source gradients only
  //   'poisson-mixed'  — Poisson with mixed gradients (Pérez 2003 §5):
  //                      at each pixel pick whichever of |∇S| or |∇T| is
  //                      larger as the guidance gradient, so the warped
  //                      face keeps its strong features (eyes / nose /
  //                      cheek shading) AND the target keeps its strong
  //                      features (lip line, jaw shadow). Best for
  //                      character-on-painting swaps where both faces
  //                      have meaningful detail at the same locations.
  const requested = params.blendMode;
  const blendMode = requested === 'poisson-mixed' ? 'poisson-mixed'
                  : requested === 'poisson'       ? 'poisson'
                  :                                  'feather';

  const [sourceBmp, targetBmp] = await Promise.all([
    createImageBitmap(sourceBlob),
    createImageBitmap(targetBlob)
  ]);

  const [sourceMarks, targetMarks] = await Promise.all([
    extractHeadLandmarks(sourceBmp),
    extractHeadLandmarks(targetBmp)
  ]);

  if (!sourceMarks) throw new Error('No face detected in source image.');
  if (!targetMarks) throw new Error('No face detected in target image.');

  const canvas = document.createElement('canvas');
  canvas.width  = targetBmp.width;
  canvas.height = targetBmp.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(targetBmp, 0, 0);

  // ── Mesh-warp the source face into target landmark positions ────
  const faceLayer = document.createElement('canvas');
  faceLayer.width  = targetBmp.width;
  faceLayer.height = targetBmp.height;
  const faceCtx = faceLayer.getContext('2d');

  const triangles = await getFaceMeshTriangles();
  for (const [i, j, k] of triangles) {
    const s0 = sourceMarks[i], s1 = sourceMarks[j], s2 = sourceMarks[k];
    const t0 = targetMarks[i], t1 = targetMarks[j], t2 = targetMarks[k];
    const sw = sourceBmp.width, sh = sourceBmp.height;
    const tw = targetBmp.width, th = targetBmp.height;
    drawAffineTriangle(
      faceCtx, sourceBmp, sw, sh,
      { x: s0.x * sw, y: s0.y * sh }, { x: s1.x * sw, y: s1.y * sh }, { x: s2.x * sw, y: s2.y * sh },
      { x: t0.x * tw, y: t0.y * th }, { x: t1.x * tw, y: t1.y * th }, { x: t2.x * tw, y: t2.y * th }
    );
  }

  // ── Build a solid (binary) mask from the same target triangles ──
  const maskLayer = document.createElement('canvas');
  maskLayer.width  = targetBmp.width;
  maskLayer.height = targetBmp.height;
  const maskCtx = maskLayer.getContext('2d');
  maskCtx.fillStyle   = 'white';
  maskCtx.strokeStyle = 'white';
  maskCtx.lineWidth   = 1.0;
  maskCtx.lineJoin    = 'round';
  for (const [i, j, k] of triangles) {
    const t0 = targetMarks[i], t1 = targetMarks[j], t2 = targetMarks[k];
    const tw = targetBmp.width, th = targetBmp.height;
    maskCtx.beginPath();
    maskCtx.moveTo(t0.x * tw, t0.y * th);
    maskCtx.lineTo(t1.x * tw, t1.y * th);
    maskCtx.lineTo(t2.x * tw, t2.y * th);
    maskCtx.closePath();
    maskCtx.fill();
    maskCtx.stroke();
  }

  if (blendMode === 'poisson' || blendMode === 'poisson-mixed') {
    // Gradient-domain seamless cloning. The warped face contributes
    // only its Laplacian; boundary pixels anchor to the target image.
    // In 'poisson-mixed' mode the per-neighbour guidance gradient is
    // the larger-magnitude of source and target, so strong target
    // features (lip line, jaw shadow) survive under the warped source.
    const W = targetBmp.width, H = targetBmp.height;
    const targetData = ctx.getImageData(0, 0, W, H);
    const sourceData = faceCtx.getImageData(0, 0, W, H);
    const maskData   = maskCtx.getImageData(0, 0, W, H);
    const blended    = poissonClone(targetData, sourceData, maskData, {
      mixed: blendMode === 'poisson-mixed',
    });
    ctx.putImageData(blended, 0, 0);
  } else {
    // Feather path (current behaviour): blur the mask alpha and
    // alpha-composite the warped face over the target.
    const blurRadius = Math.max(1, Math.round(targetBmp.width * 0.015));
    faceCtx.filter = `blur(${blurRadius}px)`;
    faceCtx.globalCompositeOperation = 'destination-in';
    faceCtx.drawImage(maskLayer, 0, 0);
    faceCtx.filter = 'none';
    faceCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(faceLayer, 0, 0);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
  });
}

/**
 * Poisson seamless cloning (Pérez, Gangnet, Blake 2003).
 *
 * Solves ∇²f = guide over the mask region, with f = T on the boundary,
 * where `guide` is either ∇²S (pure source gradients) or the per-edge
 * mixed gradient (max-magnitude of source vs target, see `opts.mixed`).
 *
 * Pure mode: the inserted face contributes its gradients only — strong
 * source features (eyes, nose, cheek shading) survive; absolute colour
 * is dictated by the surrounding target.
 *
 * Mixed mode: at each (pixel, neighbour) edge we pick whichever of
 * (S(p)-S(q)) or (T(p)-T(q)) has the larger magnitude. This preserves
 * strong features from BOTH images at the same time — the swapped face
 * keeps its identity-defining gradients, and the target keeps its
 * structural ones (e.g. Mona Lisa's lip line, jaw shadow). Removes the
 * faint colour-cast streaks pure Poisson can leave at the mask boundary
 * where source has weak gradient but target is changing fast.
 *
 * Solver: Gauss-Seidel with Successive Over-Relaxation, restricted to
 * the mask's bounding box. Three independent solves per channel. Values
 * clamped to [0, 255] inside the loop to prevent SOR overshoot from
 * propagating through Gauss-Seidel.
 *
 * @param {ImageData} targetData  Target image (full canvas).
 * @param {ImageData} sourceData  Warped source face on full canvas; need
 *                                only have valid pixel data inside the
 *                                mask region.
 * @param {ImageData} maskData    Binary mask — alpha > 128 = inside.
 * @param {{mixed?: boolean}} [opts]
 * @returns {ImageData}            Blended image, same size as target.
 */
function poissonClone(targetData, sourceData, maskData, opts = {}) {
  const mixed = !!opts.mixed;
  const W = targetData.width, H = targetData.height;
  const tgt  = targetData.data;
  const src  = sourceData.data;
  const mask = new Uint8Array(W * H);

  // Bounding box of the mask, plus interior pixel list.
  let minX = W, minY = H, maxX = -1, maxY = -1;
  const md = maskData.data;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      if (md[(row + x) * 4 + 3] > 128) {
        mask[row + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Empty mask → nothing to do.
  if (maxX < 0) {
    return new ImageData(new Uint8ClampedArray(tgt), W, H);
  }

  // Pad bbox by 1 so we can read neighbours without OOB checks.
  minX = Math.max(1, minX); minY = Math.max(1, minY);
  maxX = Math.min(W - 2, maxX); maxY = Math.min(H - 2, maxY);

  // Per-channel Float32 working buffers, initialised to target.
  const fR = new Float32Array(W * H);
  const fG = new Float32Array(W * H);
  const fB = new Float32Array(W * H);
  for (let i = 0, o = 0; i < W * H; i++, o += 4) {
    fR[i] = tgt[o];
    fG[i] = tgt[o + 1];
    fB[i] = tgt[o + 2];
  }

  // Pre-compute the guidance "Laplacian" at every interior pixel.
  // Stored by parallel arrays indexed by `interior[idx]`.
  //
  // Pure Poisson:  lap = 4·S(p) − ΣS(q) over neighbours q.
  //                Equivalent to Σ (S(p) − S(q)) over q.
  //
  // Mixed Poisson: per-neighbour we pick whichever of (S(p) − S(q))
  //                or (T(p) − T(q)) has the larger magnitude. The
  //                guidance is then Σ of those picked values.
  //                Effect: at each *edge* (centre-to-neighbour) we
  //                follow whichever image is changing faster there.
  //
  // Edge-case guard: a neighbour pixel just outside the warped
  // triangles is fully transparent (alpha 0), so reading its RGB
  // returns 0/0/0. Fall back to the centre pixel value at those
  // edges so the source contribution is 0; in mixed mode this
  // automatically lets the target gradient win at the boundary.
  const interior = [];
  const lapR = [];
  const lapG = [];
  const lapB = [];
  for (let y = minY; y <= maxY; y++) {
    const row = y * W;
    for (let x = minX; x <= maxX; x++) {
      const p = row + x;
      if (!mask[p]) continue;
      interior.push(p);
      const o = p * 4, oL = o - 4, oR = o + 4, oU = o - W * 4, oD = o + W * 4;
      const cR = src[o], cG = src[o + 1], cB = src[o + 2];
      const sLr = src[oL + 3] > 0 ? src[oL]     : cR;
      const sRr = src[oR + 3] > 0 ? src[oR]     : cR;
      const sUr = src[oU + 3] > 0 ? src[oU]     : cR;
      const sDr = src[oD + 3] > 0 ? src[oD]     : cR;
      const sLg = src[oL + 3] > 0 ? src[oL + 1] : cG;
      const sRg = src[oR + 3] > 0 ? src[oR + 1] : cG;
      const sUg = src[oU + 3] > 0 ? src[oU + 1] : cG;
      const sDg = src[oD + 3] > 0 ? src[oD + 1] : cG;
      const sLb = src[oL + 3] > 0 ? src[oL + 2] : cB;
      const sRb = src[oR + 3] > 0 ? src[oR + 2] : cB;
      const sUb = src[oU + 3] > 0 ? src[oU + 2] : cB;
      const sDb = src[oD + 3] > 0 ? src[oD + 2] : cB;

      if (!mixed) {
        // Pure Poisson — source-only guidance.
        lapR.push(4 * cR - sLr - sRr - sUr - sDr);
        lapG.push(4 * cG - sLg - sRg - sUg - sDg);
        lapB.push(4 * cB - sLb - sRb - sUb - sDb);
      } else {
        // Mixed Poisson — per-edge max-magnitude of source vs target.
        // For each neighbour direction we compute both differences
        // (S(p) − S(q)) and (T(p) − T(q)) per channel and keep the
        // larger-magnitude one. Sum these picked differences across
        // the four neighbours to get the guidance value at p.
        const tR = tgt[o], tG = tgt[o + 1], tB = tgt[o + 2];
        const tLr = tgt[oL], tRr_ = tgt[oR], tUr = tgt[oU], tDr = tgt[oD];
        const tLg = tgt[oL + 1], tRg = tgt[oR + 1], tUg = tgt[oU + 1], tDg = tgt[oD + 1];
        const tLb = tgt[oL + 2], tRb = tgt[oR + 2], tUb = tgt[oU + 2], tDb = tgt[oD + 2];

        const pick = (sd, td) => (Math.abs(sd) >= Math.abs(td) ? sd : td);

        const gR = pick(cR - sLr, tR - tLr) + pick(cR - sRr, tR - tRr_)
                 + pick(cR - sUr, tR - tUr) + pick(cR - sDr, tR - tDr);
        const gG = pick(cG - sLg, tG - tLg) + pick(cG - sRg, tG - tRg)
                 + pick(cG - sUg, tG - tUg) + pick(cG - sDg, tG - tDg);
        const gB = pick(cB - sLb, tB - tLb) + pick(cB - sRb, tB - tRb)
                 + pick(cB - sUb, tB - tUb) + pick(cB - sDb, tB - tDb);

        lapR.push(gR);
        lapG.push(gG);
        lapB.push(gB);
      }
    }
  }

  // Iterate. SOR (omega > 1) accelerates convergence over plain
  // Gauss-Seidel, but it can overshoot in high-gradient regions
  // (sharp dark/light edges like teeth-against-lips). Without
  // clamping, an overshoot drives a channel below 0 or above 255;
  // those out-of-range values then propagate to neighbours through
  // the very next iteration of Gauss-Seidel, eventually collapsing
  // a whole region (e.g. mouth) to a single channel pinned colour.
  //
  // Two-part guard:
  //   1. omega = 1.5 (was 1.85) — still gives a useful speedup
  //      but with less overshoot energy.
  //   2. Clamp f to [0, 255] inside the loop — bounds the values
  //      so no runaway can propagate. The true Poisson solution
  //      is bounded by the source/target value range anyway, so
  //      clamping doesn't lose valid solution data.
  const omega     = 1.5;
  const maxIters  = 400;
  const tolerance = 0.5; // per-channel max delta
  for (let iter = 0; iter < maxIters; iter++) {
    let maxDelta = 0;
    for (let idx = 0; idx < interior.length; idx++) {
      const p  = interior[idx];
      const pL = p - 1, pR = p + 1, pU = p - W, pD = p + W;

      // Neighbour value: take f if neighbour is inside the mask (still
      // being solved), otherwise take the target image (Dirichlet
      // boundary condition).
      const nLR = mask[pL] ? fR[pL] : tgt[pL * 4];
      const nRR = mask[pR] ? fR[pR] : tgt[pR * 4];
      const nUR = mask[pU] ? fR[pU] : tgt[pU * 4];
      const nDR = mask[pD] ? fR[pD] : tgt[pD * 4];

      const nLG = mask[pL] ? fG[pL] : tgt[pL * 4 + 1];
      const nRG = mask[pR] ? fG[pR] : tgt[pR * 4 + 1];
      const nUG = mask[pU] ? fG[pU] : tgt[pU * 4 + 1];
      const nDG = mask[pD] ? fG[pD] : tgt[pD * 4 + 1];

      const nLB = mask[pL] ? fB[pL] : tgt[pL * 4 + 2];
      const nRB = mask[pR] ? fB[pR] : tgt[pR * 4 + 2];
      const nUB = mask[pU] ? fB[pU] : tgt[pU * 4 + 2];
      const nDB = mask[pD] ? fB[pD] : tgt[pD * 4 + 2];

      const newR = (lapR[idx] + nLR + nRR + nUR + nDR) * 0.25;
      const newG = (lapG[idx] + nLG + nRG + nUG + nDG) * 0.25;
      const newB = (lapB[idx] + nLB + nRB + nUB + nDB) * 0.25;

      const oldR = fR[p], oldG = fG[p], oldB = fB[p];
      let updR = oldR + omega * (newR - oldR);
      let updG = oldG + omega * (newG - oldG);
      let updB = oldB + omega * (newB - oldB);
      if (updR < 0) updR = 0; else if (updR > 255) updR = 255;
      if (updG < 0) updG = 0; else if (updG > 255) updG = 255;
      if (updB < 0) updB = 0; else if (updB > 255) updB = 255;
      fR[p] = updR;
      fG[p] = updG;
      fB[p] = updB;

      const dR = Math.abs(updR - oldR);
      const dG = Math.abs(updG - oldG);
      const dB = Math.abs(updB - oldB);
      const d  = dR > dG ? (dR > dB ? dR : dB) : (dG > dB ? dG : dB);
      if (d > maxDelta) maxDelta = d;
    }
    if (maxDelta < tolerance) break;
  }

  // Compose the solved interior over the target image.
  const out = new Uint8ClampedArray(tgt.length);
  out.set(tgt);
  for (let idx = 0; idx < interior.length; idx++) {
    const p = interior[idx], o = p * 4;
    let r = fR[p], g = fG[p], b = fB[p];
    if (r < 0) r = 0; else if (r > 255) r = 255;
    if (g < 0) g = 0; else if (g > 255) g = 255;
    if (b < 0) b = 0; else if (b > 255) b = 255;
    out[o]     = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return new ImageData(out, W, H);
}
