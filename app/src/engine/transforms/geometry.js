/**
 * ImageChef — Geometric & Framing transforms
 */

import { registry } from '../registry.js';
import { clamp } from '../../utils/misc.js';
import { persistSubjectVision, readCachedSubjectBBox } from '../ai/vision-metadata.js';

function parseVal(val, ref) {
  const s = String(val);
  return s.endsWith('%') ? (parseFloat(s) / 100) * ref : parseFloat(s);
}

// Map the `aspectRatio` param to a numeric target. Returns null for 'original'.
function resolveAspectRatio(aspectRatio, customRatio, W, H) {
  if (!aspectRatio || aspectRatio === 'original') return W / H;
  if (aspectRatio === 'custom') {
    const n = parseFloat(customRatio);
    return Number.isFinite(n) && n > 0 ? n : W / H;
  }
  const [rw, rh] = aspectRatio.split(':').map(Number);
  if (!rw || !rh) return W / H;
  return rw / rh;
}

/**
 * Compute the largest rectangle of aspect ratio `target` that:
 *   1. contains the inflated subject bbox `bb` if possible,
 *   2. fits inside [0..W]×[0..H],
 *   3. is positioned so the subject `centroid` lands on the requested anchor point
 *      (thirds, center, top, bottom).
 *
 * Returns { cx, cy, cw, ch } in source pixels.
 */
function placeCropRect({ bb, centroid, W, H, targetAspect, anchor }) {
  // Minimum size that contains the inflated bbox at the target aspect.
  let cw = Math.max(bb.w, bb.h * targetAspect);
  let ch = cw / targetAspect;

  // Clamp to image bounds — if the aspect can't fit the subject, the clamp
  // will shrink below the bbox; downstream will crop into the subject edges
  // rather than fail outright.
  if (cw > W) { cw = W; ch = cw / targetAspect; }
  if (ch > H) { ch = H; cw = ch * targetAspect; }
  cw = Math.round(cw);
  ch = Math.round(ch);

  // Anchor-relative target position of the centroid inside the crop.
  // e.g. center → (0.5, 0.5); thirds-tl → (1/3, 1/3).
  const A = {
    'center':    [0.5,  0.5],
    'top':       [0.5,  1 / 3],
    'bottom':    [0.5,  2 / 3],
    'thirds-tl': [1 / 3, 1 / 3],
    'thirds-tr': [2 / 3, 1 / 3],
    'thirds-bl': [1 / 3, 2 / 3],
    'thirds-br': [2 / 3, 2 / 3],
  }[anchor] || [0.5, 0.5];

  let cx = centroid.x - cw * A[0];
  let cy = centroid.y - ch * A[1];

  // Clamp to image bounds.
  cx = Math.round(clamp(cx, 0, W - cw));
  cy = Math.round(clamp(cy, 0, H - ch));

  return { cx, cy, cw, ch };
}

function applyCropRect(ctx, cx, cy, cw, ch) {
  const tmp = document.createElement('canvas');
  tmp.width = cw; tmp.height = ch;
  tmp.getContext('2d').drawImage(ctx.canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  ctx.canvas.width = cw; ctx.canvas.height = ch;
  ctx.drawImage(tmp, 0, 0);
}

function tempCopy(canvas) {
  const t = document.createElement('canvas');
  t.width = canvas.width; t.height = canvas.height;
  t.getContext('2d').drawImage(canvas, 0, 0);
  return t;
}

// ─── Resize ───────────────────────────────────────────────
registry.register({
  id: 'geo-resize', name: 'Resize', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'aspect_ratio',
  description: 'Scale image to target dimensions.',
  params: [
    { name: 'width',         label: 'Width (px or %)',      type: 'text',    defaultValue: '100%' },
    { name: 'height',        label: 'Height (px or %)',     type: 'text',    defaultValue: '' },
    { name: 'maintainAspect',label: 'Maintain Aspect',      type: 'boolean', defaultValue: true },
    { name: 'algo',          label: 'Algorithm',            type: 'select',
      options: [{ label: 'Lanczos (quality)', value: 'Lanczos' }, { label: 'Bilinear', value: 'Bilinear' }],
      defaultValue: 'Lanczos' },
  ],
  apply(ctx, p) {
    let w = p.width  ? parseVal(p.width,  ctx.canvas.width)  : ctx.canvas.width;
    let h = p.height ? parseVal(p.height, ctx.canvas.height) : ctx.canvas.height;
    if (p.maintainAspect) {
      const asp = ctx.canvas.width / ctx.canvas.height;
      if (p.width && !p.height)  h = w / asp;
      if (p.height && !p.width)  w = h * asp;
    }
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(ctx.canvas, 0, 0, w, h);
    ctx.canvas.width = w; ctx.canvas.height = h;
    ctx.drawImage(tmp, 0, 0);
  }
});

// ─── Crop ─────────────────────────────────────────────────
registry.register({
  id: 'geo-crop', name: 'Crop', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'crop',
  description: 'Trim to specified region.',
  params: [
    { name: 'x',      label: 'X (px or %)',      type: 'text', defaultValue: '0' },
    { name: 'y',      label: 'Y (px or %)',      type: 'text', defaultValue: '0' },
    { name: 'width',  label: 'Width (px or %)',  type: 'text', defaultValue: '100%' },
    { name: 'height', label: 'Height (px or %)', type: 'text', defaultValue: '100%' },
  ],
  apply(ctx, p) {
    const x = parseVal(p.x || 0, ctx.canvas.width);
    const y = parseVal(p.y || 0, ctx.canvas.height);
    const w = parseVal(p.width  || ctx.canvas.width,  ctx.canvas.width);
    const h = parseVal(p.height || ctx.canvas.height, ctx.canvas.height);
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
    ctx.canvas.width = w; ctx.canvas.height = h;
    ctx.drawImage(tmp, 0, 0);
  }
});

// ─── Smart Crop ───────────────────────────────────────────
registry.register({
  id: 'geo-smart-crop', name: 'Smart Crop', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'auto_fix_high',
  description: 'Content-aware crop to a target aspect ratio.',
  params: [
    { name: 'aspectRatio', label: 'Aspect Ratio', type: 'select',
      options: [{ label: '1:1', value: '1:1' }, { label: '4:5', value: '4:5' }, { label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' }, { label: '4:3', value: '4:3' }, { label: '3:2', value: '3:2' }],
      defaultValue: '1:1' },
    { name: 'strategy', label: 'Strategy', type: 'select',
      options: [{ label: 'Entropy (busy areas)', value: 'Entropy' }, { label: 'Attention (centre)', value: 'Attention' }],
      defaultValue: 'Entropy' },
  ],
  async apply(ctx, p) {
    const [rw, rh] = (p.aspectRatio || '1:1').split(':').map(Number);
    const targetAspect = rw / rh;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    let cw, ch;
    if (W / H > targetAspect) { ch = H; cw = Math.round(ch * targetAspect); }
    else { cw = W; ch = Math.round(cw / targetAspect); }

    let cx = Math.round((W - cw) / 2), cy = Math.round((H - ch) / 2);

    // Use smartcrop if available and strategy is Entropy
    if (p.strategy === 'Entropy') {
      try {
        const smartcrop = (await import('smartcrop')).default;
        const result = await smartcrop.crop(ctx.canvas, { width: cw, height: ch });
        cx = result.topCrop.x; cy = result.topCrop.y;
      } catch { /* fallback to centre */ }
    }

    const tmp = document.createElement('canvas');
    tmp.width = cw; tmp.height = ch;
    tmp.getContext('2d').drawImage(ctx.canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    ctx.canvas.width = cw; ctx.canvas.height = ch;
    ctx.drawImage(tmp, 0, 0);
  }
});

// ─── Rotate / Flip ────────────────────────────────────────
registry.register({
  id: 'geo-rotate', name: 'Rotate/Flip', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'rotate_right',
  description: 'Rotate 90/180/270° or flip the image.',
  params: [
    { name: 'angle', label: 'Rotate', type: 'select',
      options: [{ label: 'None', value: 0 }, { label: '90° CW', value: 90 }, { label: '180°', value: 180 }, { label: '90° CCW', value: -90 }],
      defaultValue: 0 },
    { name: 'flip', label: 'Flip', type: 'select',
      options: [{ label: 'None', value: 'none' }, { label: 'Horizontal', value: 'horizontal' }, { label: 'Vertical', value: 'vertical' }, { label: 'Both', value: 'both' }],
      defaultValue: 'none' },
  ],
  apply(ctx, p) {
    const angle = Number(p.angle) || 0;
    const flip  = p.flip || 'none';
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const tmp = tempCopy(ctx.canvas);
    const newW = Math.abs(angle) === 90 ? H : W;
    const newH = Math.abs(angle) === 90 ? W : H;
    ctx.canvas.width = newW; ctx.canvas.height = newH;
    ctx.save();
    ctx.translate(newW / 2, newH / 2);
    if (angle) ctx.rotate((angle * Math.PI) / 180);
    if (flip === 'horizontal' || flip === 'both') ctx.scale(-1, 1);
    if (flip === 'vertical'   || flip === 'both') ctx.scale(1, -1);
    ctx.drawImage(tmp, -W / 2, -H / 2);
    ctx.restore();
  }
});

// ─── Round Corners ────────────────────────────────────────
registry.register({
  id: 'geo-round', name: 'Round Corners', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'rounded_corner',
  description: 'Round image corners or make circular.',
  params: [
    { name: 'radius',   label: 'Radius (px or %)', type: 'text',    defaultValue: '5%' },
    { name: 'circular', label: 'Make Circular',     type: 'boolean', defaultValue: false },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const r = parseVal(p.radius || '5%', Math.min(W, H));
    const tmp = tempCopy(ctx.canvas);
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.beginPath();
    if (p.circular) {
      ctx.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2);
    } else {
      ctx.roundRect(0, 0, W, H, r);
    }
    ctx.clip(); ctx.drawImage(tmp, 0, 0); ctx.restore();
  }
});

// ─── Canvas Padding ───────────────────────────────────────
registry.register({
  id: 'geo-padding', name: 'Canvas Padding', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'padding',
  description: 'Add coloured margins around the image.',
  params: [
    { name: 'top',    label: 'Top (px or %)',    type: 'text',  defaultValue: '5%' },
    { name: 'right',  label: 'Right (px or %)',  type: 'text',  defaultValue: '5%' },
    { name: 'bottom', label: 'Bottom (px or %)', type: 'text',  defaultValue: '5%' },
    { name: 'left',   label: 'Left (px or %)',   type: 'text',  defaultValue: '5%' },
    { name: 'color',  label: 'Background Color', type: 'color', defaultValue: '#ffffff' },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const t = parseVal(p.top    || 0, H);
    const r = parseVal(p.right  || 0, W);
    const b = parseVal(p.bottom || 0, H);
    const l = parseVal(p.left   || 0, W);
    const tmp = tempCopy(ctx.canvas);
    const nW = W + l + r, nH = H + t + b;
    ctx.canvas.width = nW; ctx.canvas.height = nH;
    ctx.fillStyle = p.color || '#ffffff';
    ctx.fillRect(0, 0, nW, nH);
    ctx.drawImage(tmp, l, t);
  }
});

// ─── Trim ─────────────────────────────────────────────────
registry.register({
  id: 'geo-trim', name: 'Trim', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'content_cut',
  description: 'Remove solid-colour edges.',
  params: [
    { name: 'tolerance', label: 'Tolerance (0-100)', type: 'range', min: 0, max: 100, defaultValue: 15 },
    { name: 'bgSource',  label: 'Background Source', type: 'select',
      options: [{ label: 'Top-Left Pixel', value: 'Pixel' }, { label: 'Transparent (Alpha)', value: 'Alpha' }],
      defaultValue: 'Pixel' },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const data = ctx.getImageData(0, 0, W, H).data;
    const tol = (p.tolerance || 15) * 2.55;
    const useAlpha = p.bgSource === 'Alpha';

    const bgR = data[0], bgG = data[1], bgB = data[2];

    const isBg = (i) => {
      if (useAlpha) return data[i + 3] < 10;
      return Math.abs(data[i] - bgR) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bgB) <= tol;
    };

    let top = 0, bottom = H, left = 0, right = W;

    outer: for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) { if (!isBg((y * W + x) * 4)) { top = y; break outer; } }
    }
    outer: for (let y = H - 1; y >= top; y--) {
      for (let x = 0; x < W; x++) { if (!isBg((y * W + x) * 4)) { bottom = y + 1; break outer; } }
    }
    outer: for (let x = 0; x < W; x++) {
      for (let y = top; y < bottom; y++) { if (!isBg((y * W + x) * 4)) { left = x; break outer; } }
    }
    outer: for (let x = W - 1; x >= left; x--) {
      for (let y = top; y < bottom; y++) { if (!isBg((y * W + x) * 4)) { right = x + 1; break outer; } }
    }

    const cw = right - left, ch = bottom - top;
    if (cw <= 0 || ch <= 0) return;
    const tmp = document.createElement('canvas');
    tmp.width = cw; tmp.height = ch;
    tmp.getContext('2d').drawImage(ctx.canvas, left, top, cw, ch, 0, 0, cw, ch);
    ctx.canvas.width = cw; ctx.canvas.height = ch;
    ctx.drawImage(tmp, 0, 0);
  }
});

// ─── Face Crop ────────────────────────────────────────────
registry.register({
  id: 'geo-face-crop', name: 'Face Crop', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'face',
  description: 'Centre-crop around detected faces. Works best with portrait/close-up shots; lower confidence for group shots or full-body images.',
  params: [
    { name: 'padding',    label: 'Padding (%)',        type: 'range',  min: 0, max: 100, defaultValue: 20 },
    { name: 'faceIndex',  label: 'Face Index',          type: 'number', min: 0, defaultValue: 0 },
    { name: 'confidence', label: 'Min confidence (%)',  type: 'range',  min: 10, max: 90, defaultValue: 30 },
  ],
  async apply(ctx, p, context) {
    const { FaceDetector, PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );
    
    // 1. Try Face Detector
    const detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      minDetectionConfidence: (p.confidence ?? 30) / 100,
    });
    const result = detector.detect(ctx.canvas);
    detector.close();

    let bb = null;

    if (result.detections.length > 0) {
      const fi = Math.min(p.faceIndex || 0, result.detections.length - 1);
      bb = result.detections[fi].boundingBox;
    } else {
      // 2. Fallback to Pose Detection
      const pose = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE'
      });
      const poseResult = pose.detect(ctx.canvas);
      pose.close();

      if (poseResult.landmarks && poseResult.landmarks.length > 0) {
        // Use landmarks 0-10 (nose, eyes, ears) for head bounding box
        const headPoints = poseResult.landmarks[0].slice(0, 11);
        const xs = headPoints.map(l => l.x * ctx.canvas.width);
        const ys = headPoints.map(l => l.y * ctx.canvas.height);
        const xmin = Math.min(...xs), xmax = Math.max(...xs);
        const ymin = Math.min(...ys), ymax = Math.max(...ys);
        bb = { originX: xmin, originY: ymin, width: xmax - xmin, height: ymax - ymin };
      }
    }

    if (!bb) throw new Error('No faces or people detected in the image.');

    const W = ctx.canvas.width, H = ctx.canvas.height;
    const padX = bb.width  * (p.padding || 20) / 100;
    const padY = bb.height * (p.padding || 20) / 100;
    const cx = Math.max(0, bb.originX - padX);
    const cy = Math.max(0, bb.originY - padY);
    const cw = Math.min(W - cx, bb.width  + padX * 2);
    const ch = Math.min(H - cy, bb.height + padY * 2);

    const tmp = document.createElement('canvas');
    tmp.width = cw; tmp.height = ch;
    tmp.getContext('2d').drawImage(ctx.canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    ctx.canvas.width = cw; ctx.canvas.height = ch;
    ctx.drawImage(tmp, 0, 0);
  }
});

// ─── Body Crop ─────────────────────────────────────────────
registry.register({
  id: 'geo-body-crop', name: 'Body Crop', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'accessibility_new',
  description: 'Logic-based framing for full body or portraits using Pose detection.',
  params: [
    { name: 'mode', label: 'Mode', type: 'select',
      options: [{ label: 'Full Body', value: 'Full' }, { label: 'Head and Shoulders', value: 'Portrait' }],
      defaultValue: 'Full' },
    { name: 'padding', label: 'Padding (%)', type: 'range', min: 0, max: 100, defaultValue: 15 },
  ],
  async apply(ctx, p) {
    const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');
    const pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task' },
      runningMode: 'IMAGE'
    });
    const result = pose.detect(ctx.canvas);
    pose.close();

    if (!result.landmarks?.length) throw new Error('No people detected.');
    const lm = result.landmarks[0];
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const pad = (p.padding || 15) / 100;

    let cx, cy, cw, ch;

    if (p.mode === 'Portrait') {
      // Head and Shoulders logic:
      // Width is 2x shoulder distance
      // Top is Nose - offset, Bottom is Chest level
      const nose = lm[0], sl = lm[11], sr = lm[12];
      const sDist = Math.abs(sl.x - sr.x) * W;
      cw = sDist * 2.2;
      ch = cw * 1.25; // 4:5 aspect roughly
      cx = (nose.x * W) - (cw / 2);
      cy = (nose.y * H) - (ch * 0.4);
    } else {
      // Full Body logic: Bounding box of all landmarks
      const xs = lm.map(l => l.x * W), ys = lm.map(l => l.y * H);
      const xmin = Math.min(...xs), xmax = Math.max(...xs);
      const ymin = Math.min(...ys), ymax = Math.max(...ys);
      const bw = xmax - xmin, bh = ymax - ymin;
      cw = bw * (1 + pad * 2);
      ch = bh * (1 + pad * 2);
      cx = xmin - (bw * pad);
      cy = ymin - (bh * pad);
    }

    cx = Math.max(0, cx); cy = Math.max(0, cy);
    cw = Math.min(W - cx, cw); ch = Math.min(H - cy, ch);

    const tmp = document.createElement('canvas');
    tmp.width = cw; tmp.height = ch;
    tmp.getContext('2d').drawImage(ctx.canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    ctx.canvas.width = cw; ctx.canvas.height = ch;
    ctx.drawImage(tmp, 0, 0);
  }
});

// ─── Face Align ────────────────────────────────────────────
registry.register({
  id: 'geo-face-align', name: 'Face Align', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'face_retouching_natural',
  description: 'Normalize face position by leveling eyes and centering on nose.',
  params: [
    { name: 'eyeLevel',   label: 'Horizontalize Eyes', type: 'boolean', defaultValue: true },
    { name: 'centerNose', label: 'Center on Nose',    type: 'boolean', defaultValue: true },
    { name: 'standardizeEyes', label: 'Standardize Eye Distance (Best for Morph)', type: 'boolean', defaultValue: false },
    { name: 'targetScale',label: 'Face Scale (%)',     type: 'range',   min: 10, max: 200, defaultValue: 100 },
  ],
  async apply(ctx, p) {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');
    const fl = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task' },
      runningMode: 'IMAGE', outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false
    });
    const result = fl.detect(ctx.canvas);
    fl.close();

    if (!result.faceLandmarks?.length) throw new Error('No faces detected.');
    const lm = result.faceLandmarks[0];
    const W = ctx.canvas.width, H = ctx.canvas.height;

    // Landmarks 468/473 are irises (requires iris model, but we use geometric centers of eyes)
    // Left eye center: avg of 33, 133, 159, 145
    const le = { 
      x: (lm[33].x + lm[133].x + lm[159].x + lm[145].x) / 4,
      y: (lm[33].y + lm[133].y + lm[159].y + lm[145].y) / 4
    };
    const re = {
      x: (lm[362].x + lm[263].x + lm[386].x + lm[374].x) / 4,
      y: (lm[362].y + lm[263].y + lm[386].y + lm[374].y) / 4
    };
    const nose = lm[4]; // nose tip

    const tmp = tempCopy(ctx.canvas);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    
    if (p.standardizeEyes) {
      const midX = (le.x + re.x) / 2 * W;
      const midY = (le.y + re.y) / 2 * H;
      const eyeDist = Math.hypot((re.x - le.x) * W, (re.y - le.y) * H);

      const targetEyeDist = W * 0.25; // Eyes take up 25% of image width
      let scale = (targetEyeDist / eyeDist);
      scale *= (p.targetScale || 100) / 100;

      const targetX = W / 2;
      const targetY = H * 0.45; // Place eyes 45% down from top

      ctx.translate(targetX, targetY);
      
      if (p.eyeLevel) {
        const angle = Math.atan2((re.y - le.y) * H, (re.x - le.x) * W);
        ctx.rotate(-angle);
      }

      ctx.scale(scale, scale);
      ctx.drawImage(tmp, -midX, -midY);
      ctx.restore();
      return;
    }

    let tx = W/2, ty = H/2;
    if (p.centerNose) {
      tx = nose.x * W; ty = nose.y * H;
    }

    ctx.translate(W/2, H/2);

    if (p.eyeLevel) {
      const angle = Math.atan2((re.y - le.y) * H, (re.x - le.x) * W);
      ctx.rotate(-angle);
    }

    const scale = (p.targetScale || 100) / 100;
    if (scale !== 1) ctx.scale(scale, scale);

    ctx.drawImage(tmp, -(tx), -(ty));
    ctx.restore();
  }
});

// ─── Subject-Aware Crop (InSPyReNet saliency) ─────────────
registry.register({
  id: 'ai-subject-crop', name: 'Subject Crop', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'center_focus_strong',
  requires: [{ type: 'model', id: 'inspyrenet-swinb-fp16', label: 'InSPyReNet model (~200 MB)', actionHref: '#mdl' }],
  description: 'Crop to a target aspect ratio while keeping the detected subject composed correctly. Uses InSPyReNet saliency (requires the model — see #mdl). Falls back to centre-crop if the model is unavailable.',
  params: [
    { name: 'aspectRatio', label: 'Aspect Ratio', type: 'select',
      options: [
        { label: 'Original',     value: 'original' },
        { label: '1:1 (Square)', value: '1:1' },
        { label: '4:5 (Portrait)', value: '4:5' },
        { label: '3:4 (Portrait)', value: '3:4' },
        { label: '4:3 (Landscape)', value: '4:3' },
        { label: '16:9 (Wide)',  value: '16:9' },
        { label: '9:16 (Tall)',  value: '9:16' },
        { label: 'Custom…',      value: 'custom' },
      ],
      defaultValue: '1:1' },
    { name: 'customRatio', label: 'Custom ratio (w/h, e.g. 1.618)', type: 'text', defaultValue: '1.618' },
    { name: 'padding',     label: 'Padding (% of subject)',          type: 'range', min: 0, max: 50, defaultValue: 10 },
    { name: 'anchor',      label: 'Anchor', type: 'select',
      options: [
        { label: 'Centre',         value: 'center' },
        { label: 'Top',            value: 'top' },
        { label: 'Bottom',         value: 'bottom' },
        { label: 'Thirds — Top-Left',    value: 'thirds-tl' },
        { label: 'Thirds — Top-Right',   value: 'thirds-tr' },
        { label: 'Thirds — Bottom-Left', value: 'thirds-bl' },
        { label: 'Thirds — Bottom-Right',value: 'thirds-br' },
      ],
      defaultValue: 'center' },
    { name: 'threshold',   label: 'Matte Threshold (%)', type: 'range', min: 10, max: 90, defaultValue: 50 },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-subject-crop] Skipping — onnxruntime-web requires the main thread.');
      return;
    }

    const W = ctx.canvas.width, H = ctx.canvas.height;
    const targetAspect = resolveAspectRatio(p.aspectRatio, p.customRatio, W, H);
    const padPct       = clamp(Number(p.padding) || 0, 0, 50) / 100;
    const anchor       = p.anchor || 'center';
    const threshold    = clamp(Number(p.threshold) || 50, 10, 90) / 100;

    // Fallback used when we can't run (or don't need to run) inference.
    const centreCropFallback = (reason) => {
      if (reason) context?.log?.('warn', `[ai-subject-crop] ${reason} — falling back to centre crop.`);
      let cw, ch;
      if (W / H > targetAspect) { ch = H; cw = Math.round(ch * targetAspect); }
      else                      { cw = W; ch = Math.round(cw / targetAspect); }
      cw = Math.min(cw, W); ch = Math.min(ch, H);
      const cx = Math.round((W - cw) / 2);
      const cy = Math.round((H - ch) / 2);
      applyCropRect(ctx, cx, cy, cw, ch);
    };

    try {
      let bbox = null;
      let maskObj = null;  // only set when we actually run inference (for metadata)

      // 1) Prefer a previously-cached bbox from the asset record — lets a
      //    recipe re-crop at a different aspect without re-running the model.
      const cached = await readCachedSubjectBBox(context?.assetHash);
      if (cached && cached.w > 0 && cached.h > 0) {
        bbox = cached;
        context?.log?.('info', '[ai-subject-crop] using cached subject bbox from asset vision metadata');
      }

      // 2) Otherwise, run inference (model must be downloaded).
      if (!bbox) {
        const { isModelReady, getSaliencyMask, computeSubjectBBox } =
          await import('../ai/inspyrenet.js');
        const ready = await isModelReady();
        if (!ready) {
          centreCropFallback('InSPyReNet model not downloaded (visit #mdl)');
          return;
        }
        const t0 = performance.now();
        maskObj = await getSaliencyMask(ctx.canvas, { log: context?.log });
        bbox = computeSubjectBBox(maskObj.mask, maskObj.width, maskObj.height, { threshold });
        context?.log?.('info', `[ai-subject-crop] saliency ${Math.round(performance.now() - t0)}ms`);
      }

      if (!bbox) {
        centreCropFallback('no subject found above threshold');
        return;
      }

      // 3) Inflate bbox by padding% of its own dimensions.
      const padX = bbox.w * padPct;
      const padY = bbox.h * padPct;
      const inflated = {
        x: Math.max(0, bbox.x - padX),
        y: Math.max(0, bbox.y - padY),
        w: Math.min(W, bbox.w + padX * 2),
        h: Math.min(H, bbox.h + padY * 2),
      };

      // 4) Compute the crop rectangle and apply it.
      const { cx, cy, cw, ch } = placeCropRect({
        bb: inflated,
        centroid: bbox.centroid,
        W, H, targetAspect, anchor,
      });

      if (cw <= 0 || ch <= 0) {
        centreCropFallback('computed crop rectangle was empty');
        return;
      }

      applyCropRect(ctx, cx, cy, cw, ch);

      // 5) Persist vision metadata only if we actually ran inference.
      if (maskObj) {
        await persistSubjectVision(context?.assetHash, maskObj, {
          subjectCrop: { aspectRatio: p.aspectRatio, anchor, padding: p.padding, at: Date.now() }
        });
      }
    } catch (err) {
      console.warn('[ai-subject-crop] failed:', err);
      context?.log?.('warn', `[ai-subject-crop] failed: ${err.message || err}`);
      centreCropFallback('transform errored');
    }
  }
});

// ─── Pixelate ─────────────────────────────────────────────
registry.register({
  id: 'geo-pixelate', name: 'Pixelate', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'compatible',
  icon: 'grid_3x3',
  description: 'Downsample then upsample with nearest-neighbour for a retro pixel-block effect.',
  params: [
    { name: 'blockSize', label: 'Block Size (px)', type: 'range', min: 2, max: 32, defaultValue: 8 },
  ],
  apply(ctx, p) {
    const W  = ctx.canvas.width, H = ctx.canvas.height;
    const bs = Math.max(2, Math.round(p.blockSize ?? 8));
    const sw = Math.max(1, Math.ceil(W / bs));
    const sh = Math.max(1, Math.ceil(H / bs));

    const small = document.createElement('canvas');
    small.width = sw; small.height = sh;
    const sCtx = small.getContext('2d');
    sCtx.imageSmoothingEnabled = false;
    sCtx.drawImage(ctx.canvas, 0, 0, sw, sh);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
  }
});

// ─── Checkerboard ─────────────────────────────────────────
registry.register({
  id: 'gen-checkerboard', name: 'Checkerboard', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'grid_on',
  description: 'Generate a checkerboard pattern. Can be used as a background or overlay.',
  params: [
    { name: 'size', label: 'Square Size (px)', type: 'range', min: 4, max: 200, defaultValue: 20 },
    { name: 'color1', label: 'Color 1', type: 'color', defaultValue: '#000000' },
    { name: 'color2', label: 'Color 2', type: 'color', defaultValue: '#ffffff' },
    { name: 'opacity', label: 'Opacity (%)', type: 'range', min: 0, max: 100, defaultValue: 100 },
    { name: 'blendMode', label: 'Blend Mode', type: 'select', options: [{label:'Normal', value:'source-over'}, {label:'Multiply', value:'multiply'}, {label:'Screen', value:'screen'}, {label:'Overlay', value:'overlay'}], defaultValue: 'source-over' }
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const size = Math.max(1, p.size ?? 20);
    const c1 = p.color1 || '#000000';
    const c2 = p.color2 || '#ffffff';
    
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    const tctx = tmp.getContext('2d');
    
    for (let y = 0; y < H; y += size) {
      for (let x = 0; x < W; x += size) {
        const isC1 = ((x / size) % 2 === 0) ^ ((y / size) % 2 === 0);
        tctx.fillStyle = isC1 ? c1 : c2;
        tctx.fillRect(x, y, size, size);
      }
    }
    
    ctx.save();
    ctx.globalAlpha = (p.opacity ?? 100) / 100;
    ctx.globalCompositeOperation = p.blendMode || 'source-over';
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  }
});

// ─── Circle Generator ─────────────────────────────────────────
registry.register({
  id: 'gen-circle', name: 'Circle', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'unsupported',
  icon: 'radio_button_unchecked',
  description: 'Generate a solid or stroked circle.',
  params: [
    { name: 'x', label: 'Center X (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'y', label: 'Center Y (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'radius', label: 'Radius (%)', type: 'range', min: 1, max: 100, defaultValue: 25 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: '#ff0000' },
    { name: 'style', label: 'Style', type: 'select', options: [{label:'Fill', value:'fill'}, {label:'Stroke', value:'stroke'}], defaultValue: 'fill' },
    { name: 'thickness', label: 'Stroke Thickness (px)', type: 'range', min: 1, max: 50, defaultValue: 5 },
    { name: 'opacity', label: 'Opacity (%)', type: 'range', min: 0, max: 100, defaultValue: 100 },
    { name: 'blendMode', label: 'Blend Mode', type: 'select', options: [{label:'Normal', value:'source-over'}, {label:'Multiply', value:'multiply'}, {label:'Screen', value:'screen'}, {label:'Overlay', value:'overlay'}], defaultValue: 'source-over' }
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const diag = Math.sqrt(W*W + H*H);
    const cx = W * (p.x ?? 50) / 100;
    const cy = H * (p.y ?? 50) / 100;
    const r = diag * (p.radius ?? 25) / 100;
    
    ctx.save();
    ctx.globalAlpha = (p.opacity ?? 100) / 100;
    ctx.globalCompositeOperation = p.blendMode || 'source-over';
    
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    
    if (p.style === 'stroke') {
      ctx.strokeStyle = p.color || '#ff0000';
      ctx.lineWidth = p.thickness ?? 5;
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color || '#ff0000';
      ctx.fill();
    }
    
    ctx.restore();
  }
});

// ─── Magnify ─────────────────────────────────────────
registry.register({
  id: 'geo-magnify', name: 'Magnify', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'compatible',
  icon: 'zoom_in',
  description: 'Creates a flat magnifying glass effect.',
  params: [
    { name: 'x', label: 'Center X (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'y', label: 'Center Y (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'radius', label: 'Radius (%)', type: 'range', min: 5, max: 100, defaultValue: 25 },
    { name: 'magnification', label: 'Magnification', type: 'range', min: 1, max: 5, step: 0.1, defaultValue: 2 }
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const cx = W * (p.x ?? 50) / 100;
    const cy = H * (p.y ?? 50) / 100;
    const maxR = Math.min(W, H) * (p.radius ?? 25) / 100;
    const mag = p.magnification ?? 2;
    
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    tmp.getContext('2d').drawImage(ctx.canvas, 0, 0);
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.clip();
    
    ctx.translate(cx, cy);
    ctx.scale(mag, mag);
    ctx.translate(-cx, -cy);
    ctx.drawImage(tmp, 0, 0);
    
    ctx.restore();
  }
});

// ─── Lens Distortion (Sphere) ─────────────────────────────────────────
registry.register({
  id: 'geo-lens', name: 'Lens Distortion', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'compatible',
  icon: 'lens',
  description: 'Spherical bulge/pinch distortion (CC Lens effect).',
  params: [
    { name: 'x', label: 'Center X (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'y', label: 'Center Y (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'radius', label: 'Radius (%)', type: 'range', min: 5, max: 150, defaultValue: 50 },
    { name: 'strength', label: 'Strength', type: 'range', min: -100, max: 100, defaultValue: 50 }
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const cx = Math.round(W * (p.x ?? 50) / 100);
    const cy = Math.round(H * (p.y ?? 50) / 100);
    const R = Math.max(1, Math.min(W, H) * (p.radius ?? 50) / 100);
    const strength = (p.strength ?? 50) / 100; // -1 to 1
    
    if (strength === 0) return;
    
    const idIn = ctx.getImageData(0, 0, W, H);
    const src = idIn.data;
    
    const idOut = ctx.createImageData(W, H);
    const dst = idOut.data;
    
    dst.set(src); // Base copy
    
    const R2 = R * R;
    const minX = Math.max(0, Math.floor(cx - R));
    const maxX = Math.min(W - 1, Math.ceil(cx + R));
    const minY = Math.max(0, Math.floor(cy - R));
    const maxY = Math.min(H - 1, Math.ceil(cy + R));
    
    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const dy2 = dy * dy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dy2;
        if (d2 < R2 && d2 > 0) {
          const dist = Math.sqrt(d2);
          const rNorm = dist / R; 
          
          let bind;
          if (strength > 0) {
            bind = Math.pow(rNorm, 1.0 - strength); // Bulge
          } else {
            bind = Math.pow(rNorm, 1.0 - strength); // Pinch
          }
          
          const srcDist = bind * R;
          const sx = Math.round(cx + (dx / dist) * srcDist);
          const sy = Math.round(cy + (dy / dist) * srcDist);
          
          if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
            const dstIdx = (y * W + x) * 4;
            const srcIdx = (sy * W + sx) * 4;
            dst[dstIdx] = src[srcIdx];
            dst[dstIdx + 1] = src[srcIdx + 1];
            dst[dstIdx + 2] = src[srcIdx + 2];
            dst[dstIdx + 3] = src[srcIdx + 3];
          }
        }
      }
    }
    
    ctx.putImageData(idOut, 0, 0);
  }
});

// ─── Turbulent Displace & Simplex Noise ──────────────────
const permTable = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
const permMod12 = new Uint8Array(512);
const perm = new Uint8Array(512);
for(let i=0; i<512; i++) {
  perm[i] = permTable[i & 255];
  permMod12[i] = (perm[i] % 12) * 3;
}
const grad3 = new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]);
function noise2D(xin, yin) {
  const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
  let n0, n1, n2; 
  const s = (xin+yin)*F2;
  const i = Math.floor(xin+s);
  const j = Math.floor(yin+s);
  const t = (i+j)*G2;
  const X0 = i-t, Y0 = j-t;
  const x0 = xin-X0, y0 = yin-Y0;
  let i1, j1;
  if(x0>y0) {i1=1; j1=0;} else {i1=0; j1=1;}
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
  const ii = i & 255, jj = j & 255;
  let t0 = 0.5 - x0*x0-y0*y0;
  if(t0<0) n0 = 0.0;
  else {
    const gi = permMod12[ii+perm[jj]];
    t0 *= t0; n0 = t0 * t0 * (grad3[gi]*x0 + grad3[gi+1]*y0);
  }
  let t1 = 0.5 - x1*x1-y1*y1;
  if(t1<0) n1 = 0.0;
  else {
    const gi = permMod12[ii+i1+perm[jj+j1]];
    t1 *= t1; n1 = t1 * t1 * (grad3[gi]*x1 + grad3[gi+1]*y1);
  }
  let t2 = 0.5 - x2*x2-y2*y2;
  if(t2<0) n2 = 0.0;
  else {
    const gi = permMod12[ii+1+perm[jj+1]];
    t2 *= t2; n2 = t2 * t2 * (grad3[gi]*x2 + grad3[gi+1]*y2);
  }
  return 70.0 * (n0 + n1 + n2);
}

registry.register({
  id: 'geo-turbulent-displace', name: 'Turbulent Displace', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'compatible',
  icon: 'waves',
  description: 'Organic displacement using Simplex noise. Great for water, heat distortion, or glitch effects.',
  params: [
    { name: 'amount', label: 'Amount (px)', type: 'range', min: 0, max: 200, defaultValue: 50 },
    { name: 'size', label: 'Size', type: 'range', min: 1, max: 200, defaultValue: 100 },
    { name: 'evolution', label: 'Evolution (Phase)', type: 'range', min: 0, max: 360, defaultValue: 0 },
    { name: 'complexity', label: 'Complexity (Octaves)', type: 'range', min: 1, max: 5, defaultValue: 1 }
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const amount = p.amount ?? 50;
    if (amount === 0) return;
    const size = Math.max(1, p.size ?? 100);
    const phase = (p.evolution ?? 0);
    const octaves = p.complexity ?? 1;

    const idIn = ctx.getImageData(0, 0, W, H);
    const src = idIn.data;
    const idOut = ctx.createImageData(W, H);
    const dst = idOut.data;
    dst.set(src); // Ensure alpha matches if we skip bounds

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let dx = 0, dy = 0;
        let amp = amount;
        let freq = 1.0 / size;
        
        for (let o = 0; o < octaves; o++) {
          const nx = noise2D(x * freq, y * freq + phase);
          const ny = noise2D(x * freq + 1000, y * freq + 1000 + phase);
          dx += nx * amp;
          dy += ny * amp;
          amp *= 0.5;
          freq *= 2.0;
        }

        const sx = Math.round(x + dx);
        const sy = Math.round(y + dy);

        if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
          const dIdx = (y * W + x) * 4;
          const sIdx = (sy * W + sx) * 4;
          dst[dIdx] = src[sIdx];
          dst[dIdx + 1] = src[sIdx + 1];
          dst[dIdx + 2] = src[sIdx + 2];
          dst[dIdx + 3] = src[sIdx + 3];
        } else {
          // Transparent edge behavior (or clamp, but transparent is safer for distortion)
          const dIdx = (y * W + x) * 4;
          dst[dIdx+3] = 0;
        }
      }
    }
    ctx.putImageData(idOut, 0, 0);
  }
});

// ─── Liquify (Pinch/Bloat/Swirl) ──────────────────────────
registry.register({
  id: 'geo-liquify', name: 'Liquify (Pinch/Swirl)', category: 'Geometric & Framing', categoryKey: 'geo',
  timeline: 'compatible',
  icon: 'waves',
  description: 'Apply pinch, bloat, or swirl distortions to an area.',
  params: [
    { name: 'mode', label: 'Mode', type: 'select', options: [{label:'Pinch', value:'pinch'}, {label:'Bloat', value:'bloat'}, {label:'Swirl', value:'swirl'}], defaultValue: 'swirl' },
    { name: 'x', label: 'Center X (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'y', label: 'Center Y (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'radius', label: 'Radius (%)', type: 'range', min: 5, max: 150, defaultValue: 25 },
    { name: 'strength', label: 'Strength', type: 'range', min: -100, max: 100, defaultValue: 50 }
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const cx = Math.round(W * (p.x ?? 50) / 100);
    const cy = Math.round(H * (p.y ?? 50) / 100);
    const R = Math.max(1, Math.min(W, H) * (p.radius ?? 25) / 100);
    let strength = (p.strength ?? 50) / 100;
    const mode = p.mode || 'swirl';
    
    if (strength === 0) return;
    
    const idIn = ctx.getImageData(0, 0, W, H);
    const src = idIn.data;
    const idOut = ctx.createImageData(W, H);
    const dst = idOut.data;
    dst.set(src);
    
    const R2 = R * R;
    const minX = Math.max(0, Math.floor(cx - R));
    const maxX = Math.min(W - 1, Math.ceil(cx + R));
    const minY = Math.max(0, Math.floor(cy - R));
    const maxY = Math.min(H - 1, Math.ceil(cy + R));
    
    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const dy2 = dy * dy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dy2;
        if (d2 < R2 && d2 > 0) {
          const dist = Math.sqrt(d2);
          const rNorm = dist / R; 
          
          let sx = x, sy = y;
          
          if (mode === 'swirl') {
            const angle = Math.atan2(dy, dx);
            // Twirl amount falls off towards the edge
            const twist = strength * Math.PI * (1.0 - rNorm) * (1.0 - rNorm);
            sx = cx + Math.cos(angle + twist) * dist;
            sy = cy + Math.sin(angle + twist) * dist;
          } else {
             // Pinch/Bloat 
             const bind = mode === 'bloat' 
                ? Math.pow(rNorm, 1.0 - strength)
                : Math.pow(rNorm, 1.0 + strength);
                
             const srcDist = bind * R;
             sx = cx + (dx / dist) * srcDist;
             sy = cy + (dy / dist) * srcDist;
          }
          
          sx = Math.round(sx);
          sy = Math.round(sy);
          
          if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
            const dstIdx = (y * W + x) * 4;
            const srcIdx = (sy * W + sx) * 4;
            dst[dstIdx] = src[srcIdx];
            dst[dstIdx + 1] = src[srcIdx + 1];
            dst[dstIdx + 2] = src[srcIdx + 2];
            dst[dstIdx + 3] = src[srcIdx + 3];
          }
        }
      }
    }
    ctx.putImageData(idOut, 0, 0);
  }
});
