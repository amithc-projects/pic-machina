/**
 * ImageChef — Face Swap Engine (Machina-Swap)
 * 
 * Performs cross-mesh affine face warping between a source and a target image.
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
  canvas.width = targetBmp.width;
  canvas.height = targetBmp.height;
  const ctx = canvas.getContext('2d');

  // Draw original target base
  ctx.drawImage(targetBmp, 0, 0);

  // Generate face layer canvas
  const faceLayer = document.createElement('canvas');
  faceLayer.width = targetBmp.width;
  faceLayer.height = targetBmp.height;
  const faceCtx = faceLayer.getContext('2d');

  const triangles = await getFaceMeshTriangles();

  // Warp sequence
  for (const [i, j, k] of triangles) {
    const s0 = sourceMarks[i], s1 = sourceMarks[j], s2 = sourceMarks[k];
    const t0 = targetMarks[i], t1 = targetMarks[j], t2 = targetMarks[k];

    const sw = sourceBmp.width, sh = sourceBmp.height;
    const sP0 = { x: s0.x * sw, y: s0.y * sh };
    const sP1 = { x: s1.x * sw, y: s1.y * sh };
    const sP2 = { x: s2.x * sw, y: s2.y * sh };

    const tw = targetBmp.width, th = targetBmp.height;
    const tP0 = { x: t0.x * tw, y: t0.y * th };
    const tP1 = { x: t1.x * tw, y: t1.y * th };
    const tP2 = { x: t2.x * tw, y: t2.y * th };

    // We pad destination to prevent sub-pixel gaping between triangles
    drawAffineTriangle(faceCtx, sourceBmp, sw, sh, sP0, sP1, sP2, tP0, tP1, tP2);
  }

  // Draw face mask to feather edges (so it blends cleanly into target skin)
  const maskLayer = document.createElement('canvas');
  maskLayer.width = targetBmp.width;
  maskLayer.height = targetBmp.height;
  const maskCtx = maskLayer.getContext('2d');
  
  // Use a solid white brush on the mask over the target mesh triangles
  maskCtx.fillStyle = 'white';
  maskCtx.strokeStyle = 'white';
  maskCtx.lineWidth = 1.0;
  maskCtx.lineJoin = 'round';
  
  // We use the FACE_OVAL bounds or just draw the triangles again to build a solid mask
  for (const [i, j, k] of triangles) {
    const t0 = targetMarks[i], t1 = targetMarks[j], t2 = targetMarks[k];
    const tw = targetBmp.width, th = targetBmp.height;
    maskCtx.beginPath();
    maskCtx.moveTo(t0.x * tw, t0.y * th);
    maskCtx.lineTo(t1.x * tw, t1.y * th);
    maskCtx.lineTo(t2.x * tw, t2.y * th);
    maskCtx.closePath();
    maskCtx.fill();
    maskCtx.stroke(); // Fills internal gaps
  }

  // Apply mask to face layer with a blur to feather the edges
  const blurRadius = Math.max(1, Math.round(targetBmp.width * 0.015)); // 1.5% of width
  faceCtx.filter = `blur(${blurRadius}px)`;
  faceCtx.globalCompositeOperation = 'destination-in';
  faceCtx.drawImage(maskLayer, 0, 0);
  faceCtx.filter = 'none';

  // Final composite: Overlay the feathered face layer onto the original target image
  ctx.drawImage(faceLayer, 0, 0);

  // Create output blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
  });
}
