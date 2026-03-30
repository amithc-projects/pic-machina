/**
 * ImageChef — AI & Composition transforms
 * Heavy WASM dependencies loaded lazily.
 */

import { registry } from '../registry.js';
import { clamp } from '../../utils/misc.js';

// ─── Face Privacy ─────────────────────────────────────────
registry.register({
  id: 'ai-face-privacy', name: 'Face Privacy', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'hide_source',
  description: 'Detect and obscure faces (blur, pixelate, or black bar).',
  params: [
    { name: 'mode', label: 'Mode', type: 'select',
      options: [{ label: 'Blur', value: 'Blur' }, { label: 'Pixelate', value: 'Pixelate' }, { label: 'Black Bar', value: 'Bar' }],
      defaultValue: 'Blur' },
    { name: 'confidence', label: 'Min Confidence (%)', type: 'range', min: 0, max: 100, defaultValue: 70 },
    { name: 'padding', label: 'Face Padding (%)', type: 'range', min: 0, max: 100, defaultValue: 20 },
  ],
  async apply(ctx, p) {
    try {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: (p.confidence || 70) / 100,
      });

      const result = detector.detect(ctx.canvas);
      detector.close();

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
        } else if (mode === 'Blur' || mode === 'Pixelate') {
          const tmp = document.createElement('canvas');
          tmp.width = bw; tmp.height = bh;
          const tc = tmp.getContext('2d');
          tc.drawImage(ctx.canvas, x, y, bw, bh, 0, 0, bw, bh);
          if (mode === 'Blur') {
            const blurCtx = document.createElement('canvas');
            blurCtx.width = bw; blurCtx.height = bh;
            const bc = blurCtx.getContext('2d');
            bc.filter = `blur(${Math.round(bw / 8)}px)`;
            bc.drawImage(tmp, 0, 0);
            ctx.drawImage(blurCtx, x, y);
          } else {
            // Pixelate
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
            ctx.drawImage(tmp, x, y);
          }
        }
      }
    } catch (err) {
      console.warn('[ai-face-privacy] failed:', err);
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
  ],
  async apply(ctx, p) {
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
    } catch (err) {
      console.warn('[ai-remove-bg] failed:', err);
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
  description: 'Detect and blur licence plates, text, or faces using OCR.',
  params: [
    { name: 'targets', label: 'Targets', type: 'select',
      options: [{ label: 'Text (OCR)', value: 'Text' }, { label: 'All Faces', value: 'Face' }],
      defaultValue: 'Text' },
    { name: 'method', label: 'Method', type: 'select',
      options: [{ label: 'Blur', value: 'Blur' }, { label: 'Black Bar', value: 'Bar' }],
      defaultValue: 'Blur' },
  ],
  async apply(ctx, p) {
    if (p.targets === 'Text') {
      try {
        const Tesseract = (await import('tesseract.js'));
        const worker = await Tesseract.createWorker('eng');
        const blob = await new Promise(res => ctx.canvas.toBlob(res, 'image/png'));
        const url = URL.createObjectURL(blob);
        const { data } = await worker.recognize(url);
        URL.revokeObjectURL(url);
        await worker.terminate();

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
        console.warn('[ai-smart-redact] OCR failed:', err);
      }
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
