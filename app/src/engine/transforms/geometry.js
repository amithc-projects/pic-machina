/**
 * ImageChef — Geometric & Framing transforms
 */

import { registry } from '../registry.js';

function parseVal(val, ref) {
  const s = String(val);
  return s.endsWith('%') ? (parseFloat(s) / 100) * ref : parseFloat(s);
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
  icon: 'auto_fix_high',
  description: 'Content-aware crop to a target aspect ratio.',
  params: [
    { name: 'aspectRatio', label: 'Aspect Ratio', type: 'select',
      options: [{ label: '1:1', value: '1:1' }, { label: '4:5', value: '4:5' }, { label: '16:9', value: '16:9' }, { label: '4:3', value: '4:3' }, { label: '3:2', value: '3:2' }],
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
  icon: 'face_retouching_natural',
  description: 'Normalize face position by leveling eyes and centering on nose.',
  params: [
    { name: 'eyeLevel',   label: 'Horizontalize Eyes', type: 'boolean', defaultValue: true },
    { name: 'centerNose', label: 'Center on Nose',    type: 'boolean', defaultValue: true },
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
