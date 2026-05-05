/**
 * ImageChef — Color, Tone & Filter transforms
 */

import { registry } from '../registry.js';
import { clamp } from '../../utils/misc.js';
import initPhoton, * as photon from '../vendor/photon/photon_rs.js';
import photonWasmUrl from '../vendor/photon/photon_rs_bg.wasm?url';
import { featherMaskChannel } from '../ai/matte-ops.js';
import { persistSubjectVision } from '../ai/vision-metadata.js';

let _photonInitialized = false;
async function ensurePhoton() {
  if (!_photonInitialized) {
    await initPhoton(photonWasmUrl);
    _photonInitialized = true;
  }
}

// ─── Standard Tuning ─────────────────────────────────────
registry.register({
  id: 'color-tuning', name: 'Standard Tuning', category: 'Color & Tone', categoryKey: 'color',
  icon: 'tune',
  description: 'Adjust contrast, saturation, vibrance and invert.',
  params: [
    { name: 'contrast',   label: 'Contrast',   type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'saturation', label: 'Saturation', type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'vibrance',   label: 'Vibrance',   type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'invert',     label: 'Invert',     type: 'boolean', defaultValue: false },
  ],
  async apply(ctx, p) {
    await ensurePhoton();
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const contrast   = p.contrast || 0;
    const saturation = p.saturation || 0;
    const vibrance   = p.vibrance || 0;
    
    // Pass canvas data straight into WASM memory via raw bridge (Worker safe)
    const idIn = ctx.getImageData(0, 0, W, H);
    const pimg = new photon.PhotonImage(new Uint8Array(idIn.data), W, H);

    if (p.invert) {
      photon.invert(pimg);
    }

    if (contrast !== 0) {
      // Photon contrast parameter scales [-255(grey) to 255]
      photon.adjust_contrast(pimg, (contrast / 100) * 255);
    }

    if (saturation > 0) {
      photon.saturate_hsl(pimg, saturation / 100);
    } else if (saturation < 0) {
      photon.desaturate_hsl(pimg, Math.abs(saturation) / 100);
    }

    // Dump WASM array back into native Canvas
    const outPixels = pimg.get_raw_pixels();
    const newId = new ImageData(new Uint8ClampedArray(outPixels), W, H);
    ctx.putImageData(newId, 0, 0);
    pimg.free();

    // ── Vibrance (If enabled, fallback to JS loop since Photon doesn't have native vibrance) ──
    if (vibrance !== 0) {
      const W = ctx.canvas.width, H = ctx.canvas.height;
      const id = ctx.getImageData(0, 0, W, H);
      const d = id.data;
      const vibAmt = vibrance / 100;
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i+1], b = d[i+2];
        const max = Math.max(r, g, b);
        const avg = (r + g + b) / 3;
        const amt = (1 - (max - avg) / 128) * vibAmt;
        const vf  = 1 + amt;
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        d[i]   = clamp(gray + (r - gray) * vf, 0, 255);
        d[i+1] = clamp(gray + (g - gray) * vf, 0, 255);
        d[i+2] = clamp(gray + (b - gray) * vf, 0, 255);
      }
      ctx.putImageData(id, 0, 0);
    }
  }
});

// ─── Auto Levels ─────────────────────────────────────────
registry.register({
  id: 'color-auto-levels', name: 'Auto Levels', category: 'Color & Tone', categoryKey: 'color',
  icon: 'brightness_auto',
  description: 'Normalise exposure by stretching the histogram.',
  params: [
    { name: 'tolerance', label: 'Clipping Tolerance (%)', type: 'range', min: 0, max: 10, step: 0.1, defaultValue: 0.5 }
  ],
  apply(ctx, p) {
    const tol = (p.tolerance || 0.5) / 100;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const id = ctx.getImageData(0, 0, W, H);
    const d = id.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
      hist[Math.round(0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2])]++;
    }
    const clip = W * H * tol;
    let mn = 0, cnt = 0;
    while (mn < 255 && cnt < clip) cnt += hist[mn++];
    let mx = 255; cnt = 0;
    while (mx > 0 && cnt < clip) cnt += hist[mx--];
    if (mx <= mn) { mn = 0; mx = 255; }
    const scale = 255 / (mx - mn);
    for (let i = 0; i < d.length; i += 4) {
      for (let j = 0; j < 3; j++) d[i+j] = clamp((d[i+j] - mn) * scale, 0, 255);
    }
    ctx.putImageData(id, 0, 0);
  }
});

// ─── Opacity ──────────────────────────────────────────────
registry.register({
  id: 'color-opacity', name: 'Opacity', category: 'Color & Tone', categoryKey: 'color',
  icon: 'opacity',
  description: 'Set global transparency.',
  params: [{ name: 'opacity', label: 'Opacity (%)', type: 'range', min: 0, max: 100, defaultValue: 100 }],
  apply(ctx, p) {
    const op = (p.opacity ?? 100) / 100;
    const id = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const d = id.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] * op;
    ctx.putImageData(id, 0, 0);
  }
});

// ─── Color Tint ───────────────────────────────────────────
registry.register({
  id: 'color-tint', name: 'Color Tint', category: 'Color & Tone', categoryKey: 'color',
  icon: 'format_color_fill',
  description: 'Overlay a hue over the image.',
  params: [
    { name: 'color',     label: 'Tint Color',   type: 'color',  defaultValue: '#ff8800' },
    { name: 'strength',  label: 'Strength (%)', type: 'range',  min: 0, max: 100, defaultValue: 20 },
    { name: 'blendMode', label: 'Blend Mode',   type: 'select',
      options: [
        { label: 'Normal',   value: 'source-over' },
        { label: 'Multiply', value: 'multiply' },
        { label: 'Screen',   value: 'screen' },
        { label: 'Overlay',  value: 'overlay' },
        { label: 'Soft Light', value: 'soft-light' },
      ],
      defaultValue: 'source-over' },
  ],
  apply(ctx, p) {
    ctx.save();
    ctx.globalAlpha = (p.strength || 20) / 100;
    ctx.globalCompositeOperation = p.blendMode || 'source-over';
    ctx.fillStyle = p.color || '#ff8800';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
});

// ─── Duotone ──────────────────────────────────────────────
registry.register({
  id: 'color-duotone', name: 'Duotone', category: 'Color & Tone', categoryKey: 'color',
  icon: 'tonality',
  description: 'Replace tones with two colours.',
  params: [
    { name: 'darkColor',  label: 'Shadow Color',    type: 'color', defaultValue: '#1a0533' },
    { name: 'lightColor', label: 'Highlight Color', type: 'color', defaultValue: '#e8f4d4' },
  ],
  async apply(ctx, p) {
    await ensurePhoton();
    const parseHex = hex => {
      const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
      return [r, g, b];
    };
    
    // Parse hex -> Photon RGB objects
    const [dr, dg, db] = parseHex(p.darkColor  || '#000000');
    const [lr, lg, lb] = parseHex(p.lightColor || '#ffffff');
    const c1 = new photon.Rgb(dr, dg, db);
    const c2 = new photon.Rgb(lr, lg, lb);

    // Direct memory execution
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const idIn = ctx.getImageData(0, 0, W, H);
    const pimg = new photon.PhotonImage(new Uint8Array(idIn.data), W, H);
    
    photon.duotone(pimg, c1, c2);
    
    const outPixels = pimg.get_raw_pixels();
    const newId = new ImageData(new Uint8ClampedArray(outPixels), W, H);
    ctx.putImageData(newId, 0, 0);
    
    // Clean up
    pimg.free();
  }
});

// ─── Vignette ─────────────────────────────────────────────
registry.register({
  id: 'color-vignette', name: 'Vignette', category: 'Color & Tone', categoryKey: 'color',
  icon: 'vignette',
  description: 'Darken or soften image edges.',
  params: [
    { name: 'amount', label: 'Strength (%)', type: 'range', min: 0, max: 100, defaultValue: 40 },
    { name: 'radius', label: 'Inner Radius (%)', type: 'range', min: 0, max: 100, defaultValue: 65 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const cx = W / 2, cy = H / 2;
    const outerR = Math.sqrt(cx * cx + cy * cy);
    const innerR = outerR * (p.radius || 65) / 100;
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    const alpha = (p.amount || 40) / 100;
    grad.addColorStop(0,   'rgba(0,0,0,0)');
    grad.addColorStop(1,   `rgba(0,0,0,${alpha})`);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
});

// ─── Advanced Effects ─────────────────────────────────────
registry.register({
  id: 'filter-advanced', name: 'Advanced Effects', category: 'Color & Tone', categoryKey: 'color',
  icon: 'filter_vintage',
  description: 'Blur, sharpen, noise, and pixelation.',
  params: [
    { name: 'blurRadius',    label: 'Blur Radius (px)',   type: 'range', min: 0, max: 40, defaultValue: 0 },
    { name: 'sharpenAmount', label: 'Sharpen Amount (%)', type: 'range', min: 0, max: 100, defaultValue: 0 },
    { name: 'noiseLevel',    label: 'Noise Level (%)',    type: 'range', min: 0, max: 50, defaultValue: 0 },
    { name: 'pixelSize',     label: 'Pixel Size (px)',    type: 'range', min: 1, max: 40, defaultValue: 1 },
  ],
  async apply(ctx, p) {
    await ensurePhoton();
    const W = ctx.canvas.width, H = ctx.canvas.height;
    
    // Send to WASM
    const idIn = ctx.getImageData(0, 0, W, H);
    const pimg = new photon.PhotonImage(new Uint8Array(idIn.data), W, H);

    // Filter Convolutions
    if (p.blurRadius > 0) {
      photon.gaussian_blur(pimg, Math.round(p.blurRadius));
    }
    
    if (p.sharpenAmount > 0) {
      // We run standard sharpen. The amount could dictate multiple passes or blend, 
      // but photon.sharpen() executes an optimized 3x3 kernel instantly.
      // E.g., multiple passes for intense sharpening, max 3.
      const passes = Math.ceil(p.sharpenAmount / 33);
      for (let i = 0; i < passes; i++) photon.sharpen(pimg);
    }

    // Sync WASM back to canvas
    const outPixels = pimg.get_raw_pixels();
    const newId = new ImageData(new Uint8ClampedArray(outPixels), W, H);
    ctx.putImageData(newId, 0, 0);
    pimg.free();

    // ── Noise (Native JS to prevent WASM RNG panic) ──
    if (p.noiseLevel > 0) {
      const id = ctx.getImageData(0, 0, W, H);
      const d = id.data;
      const noiseAmt = p.noiseLevel * 2.55; 
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 2 * noiseAmt;
        d[i]   = Math.max(0, Math.min(255, d[i]   + n));
        d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
        d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
      }
      ctx.putImageData(id, 0, 0);
    }

    // ── Pixelate (Keep as JS loop, since photon doesn't have block-pixelate natively) ──
    if (p.pixelSize > 1) {
      const ps = Math.round(p.pixelSize);
      const id = ctx.getImageData(0, 0, W, H); const d = id.data;
      for (let y = 0; y < H; y += ps) {
        for (let x = 0; x < W; x += ps) {
          const i = (y * W + x) * 4;
          const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
          for (let dy = 0; dy < ps && y + dy < H; dy++) {
            for (let dx = 0; dx < ps && x + dx < W; dx++) {
              const j = ((y + dy) * W + (x + dx)) * 4;
              d[j] = r; d[j+1] = g; d[j+2] = b; d[j+3] = a;
            }
          }
        }
      }
      ctx.putImageData(id, 0, 0);
    }
  }
});

// ─── Posterize ────────────────────────────────────────────
registry.register({
  id: 'color-posterize', name: 'Posterize', category: 'Color & Tone', categoryKey: 'color',
  icon: 'gradient',
  description: 'Quantise each colour channel to a fixed number of levels for a flat, silkscreen look.',
  params: [
    { name: 'levels', label: 'Levels', type: 'range', min: 2, max: 8, defaultValue: 4 },
  ],
  apply(ctx, p) {
    const levels = Math.max(2, Math.min(8, Math.round(p.levels ?? 4)));
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const id = ctx.getImageData(0, 0, W, H);
    const d  = id.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = Math.round(Math.round(d[i]   / 255 * (levels - 1)) / (levels - 1) * 255);
      d[i+1] = Math.round(Math.round(d[i+1] / 255 * (levels - 1)) / (levels - 1) * 255);
      d[i+2] = Math.round(Math.round(d[i+2] / 255 * (levels - 1)) / (levels - 1) * 255);
      // alpha untouched
    }
    ctx.putImageData(id, 0, 0);
  }
});

// ─── Edge Detection ──────────────────────────────────────
registry.register({
  id: 'filter-edge-detect', name: 'Edge Detection', category: 'Color & Tone', categoryKey: 'color',
  icon: 'filter_center_focus',
  description: 'Sobel edge detection — extracts outlines as white lines on a black background.',
  params: [
    { name: 'threshold',    label: 'Edge Threshold (%)', type: 'range',   min: 0, max: 100, defaultValue: 15 },
    { name: 'softEdges',    label: 'Soft Edges',          type: 'boolean', defaultValue: false },
    { name: 'blurBefore',   label: 'Pre-blur (px)',        type: 'range',   min: 0, max: 5, step: 0.5, defaultValue: 0 },
    { name: 'blendMode',    label: 'Blend Mode',           type: 'select',
      options: [
        { label: 'Replace (Edge Map)',   value: 'none' },
        { label: 'Multiply (Ink Lines)', value: 'multiply' },
        { label: 'Darken (Overlay)',     value: 'darken' },
      ],
      defaultValue: 'none' },
    { name: 'invertEdges',  label: 'Invert (dark lines on light)', type: 'boolean', defaultValue: false },
    { name: 'edgeStrength', label: 'Edge Strength (%)',    type: 'range',   min: 0, max: 100, defaultValue: 100 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const blendMode = p.blendMode || 'none';

    // Snapshot original if we need to composite edges over it
    let origSnapshot = null;
    if (blendMode !== 'none') {
      origSnapshot = document.createElement('canvas');
      origSnapshot.width = W; origSnapshot.height = H;
      origSnapshot.getContext('2d').drawImage(ctx.canvas, 0, 0);
    }

    // Optional pre-blur to reduce noise before edge detection
    if (p.blurBefore > 0) {
      const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
      const tc = tmp.getContext('2d'); tc.filter = `blur(${p.blurBefore}px)`; tc.drawImage(ctx.canvas, 0, 0);
      ctx.clearRect(0, 0, W, H); ctx.drawImage(tmp, 0, 0);
    }

    const id   = ctx.getImageData(0, 0, W, H);
    const d    = id.data;
    const orig = new Uint8ClampedArray(d);

    // Sobel kernels (flat, indexed by (ky+1)*3+(kx+1))
    const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    const thresh      = (p.threshold ?? 15) / 100 * 255;
    const softEdges   = p.softEdges || false;
    const invertEdges = p.invertEdges || false;

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        let gx = 0, gy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const ni  = ((y + ky) * W + (x + kx)) * 4;
            const lum = 0.299 * orig[ni] + 0.587 * orig[ni + 1] + 0.114 * orig[ni + 2];
            const ki  = (ky + 1) * 3 + (kx + 1);
            gx += lum * Gx[ki];
            gy += lum * Gy[ki];
          }
        }
        // L1 magnitude — faster than sqrt, visually equivalent for thresholding
        const mag = Math.min(Math.abs(gx) + Math.abs(gy), 255);
        let val = mag < thresh ? 0 : softEdges ? clamp(mag, 0, 255) : 255;
        if (invertEdges) val = 255 - val;
        const idx = (y * W + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = val;
        d[idx + 3] = 255; // ensure fully opaque for correct multiply
      }
    }

    if (blendMode === 'none') {
      ctx.putImageData(id, 0, 0);
    } else {
      // Build edge canvas then composite over the original image
      const edgeCanvas = document.createElement('canvas');
      edgeCanvas.width = W; edgeCanvas.height = H;
      edgeCanvas.getContext('2d').putImageData(id, 0, 0);

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(origSnapshot, 0, 0);
      ctx.save();
      ctx.globalAlpha = (p.edgeStrength ?? 100) / 100;
      ctx.globalCompositeOperation = blendMode;
      ctx.drawImage(edgeCanvas, 0, 0);
      ctx.restore();
    }
  }
});

// ─── Relight ──────────────────────────────────────────────
registry.register({
  id: 'filter-relight', name: 'Relight', category: 'Color & Tone', categoryKey: 'color',
  icon: 'wb_incandescent',
  description: 'Simulate repositionable point lights. Darken ambient light then add up to 3 independent colour lights using screen compositing.',
  params: [
    { name: 'ambient',     label: 'Ambient Light (%)',      type: 'range', min: 0, max: 100, defaultValue: 15 },
    // Light 1
    { name: 'l1On',        label: 'Light 1 Enabled',        type: 'boolean', defaultValue: true },
    { name: 'l1X',         label: 'Light 1 — X (%)',        type: 'range', min: 0, max: 100, defaultValue: 35 },
    { name: 'l1Y',         label: 'Light 1 — Y (%)',        type: 'range', min: 0, max: 100, defaultValue: 25 },
    { name: 'l1Color',     label: 'Light 1 — Color',        type: 'color', defaultValue: '#ffffff' },
    { name: 'l1Intensity', label: 'Light 1 — Intensity (%)',type: 'range', min: 0, max: 100, defaultValue: 85 },
    { name: 'l1Radius',    label: 'Light 1 — Radius (%)',   type: 'range', min: 5, max: 150, defaultValue: 65 },
    // Light 2
    { name: 'l2On',        label: 'Light 2 Enabled',        type: 'boolean', defaultValue: false },
    { name: 'l2X',         label: 'Light 2 — X (%)',        type: 'range', min: 0, max: 100, defaultValue: 70 },
    { name: 'l2Y',         label: 'Light 2 — Y (%)',        type: 'range', min: 0, max: 100, defaultValue: 55 },
    { name: 'l2Color',     label: 'Light 2 — Color',        type: 'color', defaultValue: '#ffe4a0' },
    { name: 'l2Intensity', label: 'Light 2 — Intensity (%)',type: 'range', min: 0, max: 100, defaultValue: 60 },
    { name: 'l2Radius',    label: 'Light 2 — Radius (%)',   type: 'range', min: 5, max: 150, defaultValue: 50 },
    // Light 3
    { name: 'l3On',        label: 'Light 3 Enabled',        type: 'boolean', defaultValue: false },
    { name: 'l3X',         label: 'Light 3 — X (%)',        type: 'range', min: 0, max: 100, defaultValue: 20 },
    { name: 'l3Y',         label: 'Light 3 — Y (%)',        type: 'range', min: 0, max: 100, defaultValue: 75 },
    { name: 'l3Color',     label: 'Light 3 — Color',        type: 'color', defaultValue: '#a0c8ff' },
    { name: 'l3Intensity', label: 'Light 3 — Intensity (%)',type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'l3Radius',    label: 'Light 3 — Radius (%)',   type: 'range', min: 5, max: 150, defaultValue: 45 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const diagonal = Math.sqrt(W * W + H * H);

    // Step 1: Darken entire image to ambient level
    const ambient = (p.ambient ?? 15) / 100;
    const id = ctx.getImageData(0, 0, W, H);
    const d  = id.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i]   = d[i]   * ambient;
      d[i+1] = d[i+1] * ambient;
      d[i+2] = d[i+2] * ambient;
    }
    ctx.putImageData(id, 0, 0);

    function hexToRgb(hex) {
      const h = hex.replace('#', '');
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }

    // Step 2: Add each enabled light via screen blend
    const lights = [
      { on: p.l1On !== false, x: p.l1X ?? 35, y: p.l1Y ?? 25, color: p.l1Color || '#ffffff', intensity: p.l1Intensity ?? 85, radius: p.l1Radius ?? 65 },
      { on: p.l2On === true,  x: p.l2X ?? 70, y: p.l2Y ?? 55, color: p.l2Color || '#ffe4a0', intensity: p.l2Intensity ?? 60, radius: p.l2Radius ?? 50 },
      { on: p.l3On === true,  x: p.l3X ?? 20, y: p.l3Y ?? 75, color: p.l3Color || '#a0c8ff', intensity: p.l3Intensity ?? 50, radius: p.l3Radius ?? 45 },
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const light of lights) {
      if (!light.on || light.intensity === 0) continue;
      const lx = (light.x / 100) * W;
      const ly = (light.y / 100) * H;
      const r  = (light.radius / 100) * diagonal;
      const { r: cr, g: cg, b: cb } = hexToRgb(light.color);
      const alpha = light.intensity / 100;

      const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      grad.addColorStop(0,   `rgba(${cr},${cg},${cb},${alpha})`);
      grad.addColorStop(0.4, `rgba(${cr},${cg},${cb},${alpha * 0.45})`);
      grad.addColorStop(1,   `rgba(0,0,0,0)`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }
});

// ─── Halftone ─────────────────────────────────────────────
registry.register({
  id: 'filter-halftone', name: 'Halftone', category: 'Color & Tone', categoryKey: 'color',
  icon: 'blur_on',
  description: 'Overlay a halftone dot screen — dot size varies with image brightness.',
  params: [
    { name: 'dotSpacing', label: 'Dot Spacing (px)', type: 'range',   min: 4, max: 40, defaultValue: 10 },
    { name: 'dotColor',   label: 'Dot Color',        type: 'color',   defaultValue: '#000000' },
    { name: 'opacity',    label: 'Opacity (%)',       type: 'range',   min: 5, max: 100, defaultValue: 40 },
    { name: 'invert',     label: 'Invert (bright = big dots)', type: 'boolean', defaultValue: false },
  ],
  apply(ctx, p) {
    const spacing = Math.max(4, Math.round(p.dotSpacing ?? 10));
    const opacity = (p.opacity ?? 40) / 100;
    const invert  = p.invert || false;
    const W = ctx.canvas.width, H = ctx.canvas.height;

    // Sample brightness of the current image
    const imageData = ctx.getImageData(0, 0, W, H);
    const d = imageData.data;

    // Draw dots on an overlay canvas
    const overlay = document.createElement('canvas');
    overlay.width = W; overlay.height = H;
    const octx = overlay.getContext('2d');
    octx.fillStyle = p.dotColor || '#000000';

    const maxRadius = spacing * 0.5 * 0.95; // dot just fits inside its grid cell

    for (let cy = spacing / 2; cy < H + spacing; cy += spacing) {
      for (let cx = spacing / 2; cx < W + spacing; cx += spacing) {
        const px = clamp(Math.round(cx), 0, W - 1);
        const py = clamp(Math.round(cy), 0, H - 1);
        const i  = (py * W + px) * 4;
        const brightness = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
        const t      = invert ? brightness : (1 - brightness);
        const radius = t * maxRadius;
        if (radius > 0.5) {
          octx.beginPath();
          octx.arc(cx, cy, radius, 0, Math.PI * 2);
          octx.fill();
        }
      }
    }

    // Multiply-blend the dot layer so the duotone colour shows through
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(overlay, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
});

// ─── Gaussian Blur ────────────────────────────────────────
// Plain whole-image Gaussian blur. Photon already exposes the kernel —
// other transforms (Bloom, Tilt-Shift) call it internally — but until
// now there was no top-level transform that just blurs. Useful for
// sfumato-style softening, motion-blur stand-ins, and as a base for
// recipe-level looks.
registry.register({
  id: 'filter-blur', name: 'Gaussian Blur', category: 'Color & Tone', categoryKey: 'color',
  icon: 'blur_on',
  description: 'Whole-image Gaussian blur with a controllable radius. Subtle radii (1–3px) soften skin and edges (sfumato); larger radii produce dreamy / out-of-focus looks.',
  params: [
    { name: 'radius', label: 'Radius (px)', type: 'range', min: 0, max: 60, defaultValue: 4 },
  ],
  async apply(ctx, p) {
    const radius = Math.round(p.radius ?? 4);
    if (radius <= 0) return;
    await ensurePhoton();
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const idIn = ctx.getImageData(0, 0, W, H);
    const pimg = new photon.PhotonImage(new Uint8Array(idIn.data), W, H);
    photon.gaussian_blur(pimg, radius);
    const out = pimg.get_raw_pixels();
    ctx.putImageData(new ImageData(new Uint8ClampedArray(out), W, H), 0, 0);
    pimg.free();
  }
});

// ─── Directional Blur ──────────────────────────────────────
registry.register({
  id: 'filter-directional-blur', name: 'Directional Blur', category: 'Color & Tone', categoryKey: 'color',
  icon: 'motion_blur',
  description: 'Applies a linear motion blur along a specific angle.',
  params: [
    { name: 'length', label: 'Blur Length (px)', type: 'range', min: 1, max: 200, defaultValue: 30 },
    { name: 'angle',  label: 'Angle (degrees)',  type: 'range', min: 0, max: 360, defaultValue: 45 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const length = p.length ?? 30;
    const angle = ((p.angle ?? 45) * Math.PI) / 180;
    if (length <= 1) return;
    
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    tmp.getContext('2d').drawImage(ctx.canvas, 0, 0);
    
    ctx.clearRect(0, 0, W, H);
    
    const half = length / 2;
    for (let i = 0; i < length; i++) {
      ctx.globalAlpha = 1.0 / (i + 1);
      const offset = i - half;
      ctx.drawImage(tmp, offset * dx, offset * dy);
    }
    ctx.globalAlpha = 1.0;
  }
});

// ─── Radial Blur ──────────────────────────────────────
registry.register({
  id: 'filter-radial-blur', name: 'Radial Blur', category: 'Color & Tone', categoryKey: 'color',
  icon: 'motion_blur',
  description: 'Zoom blur radiating from a center point.',
  params: [
    { name: 'amount', label: 'Amount (%)', type: 'range', min: 1, max: 100, defaultValue: 20 },
    { name: 'centerX', label: 'Center X (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'centerY', label: 'Center Y (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const amount = (p.amount ?? 20) / 100;
    const cx = W * (p.centerX ?? 50) / 100;
    const cy = H * (p.centerY ?? 50) / 100;
    if (amount <= 0) return;

    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    tmp.getContext('2d').drawImage(ctx.canvas, 0, 0);
    
    ctx.clearRect(0, 0, W, H);
    
    const steps = 30; // fixed steps for performance
    for (let i = 0; i < steps; i++) {
      const scale = 1.0 + (i / steps) * amount;
      ctx.globalAlpha = 1.0 / (i + 1);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1.0;
  }
});

// ─── Gradient Ramp ──────────────────────────────────────
registry.register({
  id: 'filter-gradient-ramp', name: 'Gradient Ramp', category: 'Color & Tone', categoryKey: 'color',
  icon: 'gradient',
  description: 'Overlay a linear or radial gradient over the image.',
  params: [
    { name: 'color1', label: 'Start Color', type: 'color', defaultValue: '#000000' },
    { name: 'color2', label: 'End Color', type: 'color', defaultValue: '#ffffff' },
    { name: 'type', label: 'Ramp Shape', type: 'select', options: [{label:'Linear', value:'linear'}, {label:'Radial', value:'radial'}], defaultValue: 'linear' },
    { name: 'angle', label: 'Linear Angle', type: 'range', min: 0, max: 360, defaultValue: 90 },
    { name: 'blendMode', label: 'Blend Mode', type: 'select', options: [{label:'Normal', value:'source-over'}, {label:'Multiply', value:'multiply'}, {label:'Screen', value:'screen'}, {label:'Overlay', value:'overlay'}], defaultValue: 'source-over' },
    { name: 'opacity', label: 'Opacity (%)', type: 'range', min: 0, max: 100, defaultValue: 100 }
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const c1 = p.color1 || '#000000';
    const c2 = p.color2 || '#ffffff';
    const type = p.type || 'linear';
    const angle = ((p.angle ?? 90) * Math.PI) / 180;
    
    let grad;
    if (type === 'linear') {
      const cx = W/2, cy = H/2;
      const r = Math.sqrt(cx*cx + cy*cy);
      const x1 = cx - Math.cos(angle) * r;
      const y1 = cy - Math.sin(angle) * r;
      const x2 = cx + Math.cos(angle) * r;
      const y2 = cy + Math.sin(angle) * r;
      grad = ctx.createLinearGradient(x1, y1, x2, y2);
    } else {
      const cx = W/2, cy = H/2;
      const r = Math.sqrt(cx*cx + cy*cy);
      grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    }
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    
    ctx.save();
    ctx.globalAlpha = (p.opacity ?? 100) / 100;
    ctx.globalCompositeOperation = p.blendMode || 'source-over';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
});

// ─── Bloom / Glow ─────────────────────────────────────────
registry.register({
  id: 'filter-bloom', name: 'Bloom / Glow', category: 'Color & Tone', categoryKey: 'color',
  icon: 'flare',
  description: 'Extracts bright highlights, blurs them, and screen-blends back for a glow effect.',
  params: [
    { name: 'threshold',  label: 'Highlight Threshold (%)', type: 'range', min: 0, max: 100, defaultValue: 75 },
    { name: 'blurRadius', label: 'Blur Radius (px)',         type: 'range', min: 2, max: 60,  defaultValue: 20 },
    { name: 'strength',   label: 'Strength (%)',             type: 'range', min: 0, max: 100, defaultValue: 70 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const thresh = (p.threshold ?? 75) / 100 * 255;

    // Extract bright pixels to a separate layer
    const id = ctx.getImageData(0, 0, W, H);
    const d  = id.data;
    const brightData = new Uint8ClampedArray(d.length);
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (lum >= thresh) {
        brightData[i] = d[i]; brightData[i + 1] = d[i + 1];
        brightData[i + 2] = d[i + 2]; brightData[i + 3] = d[i + 3];
      }
    }

    const brightCanvas = document.createElement('canvas');
    brightCanvas.width = W; brightCanvas.height = H;
    brightCanvas.getContext('2d').putImageData(new ImageData(brightData, W, H), 0, 0);

    // Blur the bright layer
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = W; blurCanvas.height = H;
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.filter = `blur(${p.blurRadius ?? 20}px)`;
    blurCtx.drawImage(brightCanvas, 0, 0);

    // Screen-blend the blurred glow back onto the image
    ctx.save();
    ctx.globalAlpha = (p.strength ?? 70) / 100;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.restore();
  }
});

// ─── Chromatic Aberration ─────────────────────────────────
registry.register({
  id: 'filter-chromatic-aberration', name: 'Chromatic Aberration', category: 'Color & Tone', categoryKey: 'color',
  icon: 'lens_blur',
  description: 'Splits R and B channels to simulate lens chromatic aberration.',
  params: [
    { name: 'offset',    label: 'Channel Offset (px)', type: 'range', min: 1, max: 30, defaultValue: 8 },
    { name: 'direction', label: 'Direction',            type: 'select',
      options: [
        { label: 'Horizontal', value: 'horizontal' },
        { label: 'Vertical',   value: 'vertical' },
        { label: 'Diagonal',   value: 'diagonal' },
      ], defaultValue: 'horizontal' },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const offset = Math.round(p.offset ?? 8);
    const dir    = p.direction || 'horizontal';

    const id  = ctx.getImageData(0, 0, W, H);
    const src = new Uint8ClampedArray(id.data);
    const d   = id.data;

    let dxR = 0, dyR = 0, dxB = 0, dyB = 0;
    if      (dir === 'horizontal') { dxR = -offset; dxB =  offset; }
    else if (dir === 'vertical')   { dyR = -offset; dyB =  offset; }
    else                           { dxR = -offset; dyR = -offset; dxB = offset; dyB = offset; }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dst = (y * W + x) * 4;

        const rxR = clamp(x + dxR, 0, W - 1), ryR = clamp(y + dyR, 0, H - 1);
        d[dst]     = src[(ryR * W + rxR) * 4];         // R channel shifted one way

        const rxB = clamp(x + dxB, 0, W - 1), ryB = clamp(y + dyB, 0, H - 1);
        d[dst + 2] = src[(ryB * W + rxB) * 4 + 2];    // B channel shifted other way
        // G channel stays in place (d already has original values from src copy)
      }
    }

    ctx.putImageData(id, 0, 0);
  }
});

// ─── Color Grade ──────────────────────────────────────────
registry.register({
  id: 'filter-color-grade', name: 'Color Grade', category: 'Color & Tone', categoryKey: 'color',
  icon: 'palette',
  description: 'Cinematic colour grading — lift (black point), shadow tint, and highlight tint.',
  params: [
    { name: 'lift',              label: 'Lift (Black Point)',    type: 'range', min: 0, max: 50,  defaultValue: 0 },
    { name: 'shadowColor',       label: 'Shadow Tint',           type: 'color', defaultValue: '#000000' },
    { name: 'shadowStrength',    label: 'Shadow Tint (%)',        type: 'range', min: 0, max: 100, defaultValue: 0 },
    { name: 'highlightColor',    label: 'Highlight Tint',         type: 'color', defaultValue: '#ffffff' },
    { name: 'highlightStrength', label: 'Highlight Tint (%)',     type: 'range', min: 0, max: 100, defaultValue: 0 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const id = ctx.getImageData(0, 0, W, H);
    const d  = id.data;

    const lift = (p.lift || 0) / 100;

    const sh   = p.shadowColor    || '#000000';
    const shR  = parseInt(sh.slice(1, 3), 16), shG  = parseInt(sh.slice(3, 5), 16), shB  = parseInt(sh.slice(5, 7), 16);
    const shStr = (p.shadowStrength || 0) / 100;

    const hi   = p.highlightColor || '#ffffff';
    const hiR  = parseInt(hi.slice(1, 3), 16), hiG  = parseInt(hi.slice(3, 5), 16), hiB  = parseInt(hi.slice(5, 7), 16);
    const hiStr = (p.highlightStrength || 0) / 100;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;

      // Lift: raise the black point
      r = r + lift * (1 - r);
      g = g + lift * (1 - g);
      b = b + lift * (1 - b);

      // Split-tone blend weights based on luminosity
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const shadowW    = (1 - lum) * shStr;
      const highlightW =      lum  * hiStr;

      r = r + shadowW * (shR / 255 - r) + highlightW * (hiR / 255 - r);
      g = g + shadowW * (shG / 255 - g) + highlightW * (hiG / 255 - g);
      b = b + shadowW * (shB / 255 - b) + highlightW * (hiB / 255 - b);

      d[i]     = clamp(Math.round(r * 255), 0, 255);
      d[i + 1] = clamp(Math.round(g * 255), 0, 255);
      d[i + 2] = clamp(Math.round(b * 255), 0, 255);
    }

    ctx.putImageData(id, 0, 0);
  }
});

// ─── Kuwahara (Oil Paint) ─────────────────────────────────
registry.register({
  id: 'filter-kuwahara', name: 'Kuwahara (Oil Paint)', category: 'Color & Tone', categoryKey: 'color',
  icon: 'brush',
  description: 'Kuwahara filter — non-linear edge-preserving smoothing that creates a painterly oil effect. Very intensive, optimized parameters applied.',
  params: [
    { name: 'radius', label: 'Radius (stroke size)',  type: 'range', min: 1, max: 5, defaultValue: 3 },
    { name: 'passes', label: 'Passes (intensity)',     type: 'range', min: 1, max: 2, defaultValue: 1 },
  ],
  async apply(ctx, p) {
    await ensurePhoton();
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const radius = Math.round(p.radius ?? 3);
    const passes = Math.round(p.passes ?? 1);

    const id = ctx.getImageData(0, 0, W, H);
    const pimg = new photon.PhotonImage(new Uint8Array(id.data), W, H);

    for (let pass = 0; pass < passes; pass++) {
        photon.oil(pimg, radius, 55.0);
    }

    const outPixels = pimg.get_raw_pixels();
    const newId = new ImageData(new Uint8ClampedArray(outPixels), W, H);
    ctx.putImageData(newId, 0, 0);
    pimg.free();
  }
});

// ─── Tilt-Shift ───────────────────────────────────────────
registry.register({
  id: 'filter-tilt-shift', name: 'Tilt-Shift', category: 'Color & Tone', categoryKey: 'color',
  icon: 'filter_center_focus',
  description: 'Miniature/tilt-shift effect — leaves a sharp horizontal band, blurs top and bottom.',
  params: [
    { name: 'centerY',    label: 'Focus Centre (%)',  type: 'range', min: 10, max: 90, defaultValue: 50 },
    { name: 'bandWidth',  label: 'Sharp Band (%)',     type: 'range', min: 5,  max: 80, defaultValue: 25 },
    { name: 'blurAmount', label: 'Blur Amount (px)',   type: 'range', min: 2,  max: 40, defaultValue: 12 },
    { name: 'feather',    label: 'Feather (%)',         type: 'range', min: 0,  max: 50, defaultValue: 30 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const centerY_px = ((p.centerY  ?? 50) / 100) * H;
    const halfBand   = ((p.bandWidth ?? 25) / 100) * H / 2;
    const blurAmt    = p.blurAmount ?? 12;
    const featherPx  = ((p.feather  ?? 30) / 100) * H;

    // Snapshot sharp original
    const sharpCanvas = document.createElement('canvas');
    sharpCanvas.width = W; sharpCanvas.height = H;
    const sc = sharpCanvas.getContext('2d');
    sc.drawImage(ctx.canvas, 0, 0);

    // Create fully-blurred version of the original
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = W; blurCanvas.height = H;
    const bc = blurCanvas.getContext('2d');
    bc.filter = `blur(${blurAmt}px)`;
    bc.drawImage(ctx.canvas, 0, 0);

    // Carve a gradient-alpha mask into the sharp canvas so only the focus band is opaque
    const sd = sc.getImageData(0, 0, W, H);
    const d  = sd.data;
    for (let y = 0; y < H; y++) {
      const dist = Math.abs(y - centerY_px) - halfBand; // negative inside band
      const alpha = dist <= 0
        ? 255
        : featherPx > 0
          ? clamp(Math.round((1 - dist / featherPx) * 255), 0, 255)
          : 0;
      for (let x = 0; x < W; x++) {
        d[(y * W + x) * 4 + 3] = alpha;
      }
    }
    sc.putImageData(sd, 0, 0);

    // Composite: blurred base, then sharp centre on top
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.drawImage(sharpCanvas, 0, 0);
  }
});

// ─── Channel Swap (Aerochrome / Infrared) ─────────────────
registry.register({
  id: 'color-channel-swap', name: 'Channel Swap', category: 'Color & Tone', categoryKey: 'color',
  icon: 'swap_horiz',
  description: 'Reassign RGB channels. Swap R↔G to simulate Kodak Aerochrome infrared film.',
  params: [
    { name: 'redSource',   label: 'Red ← Source',   type: 'select',
      options: [{ label: 'Red', value: 'R' }, { label: 'Green', value: 'G' }, { label: 'Blue', value: 'B' }],
      defaultValue: 'G' },
    { name: 'greenSource', label: 'Green ← Source', type: 'select',
      options: [{ label: 'Red', value: 'R' }, { label: 'Green', value: 'G' }, { label: 'Blue', value: 'B' }],
      defaultValue: 'R' },
    { name: 'blueSource',  label: 'Blue ← Source',  type: 'select',
      options: [{ label: 'Red', value: 'R' }, { label: 'Green', value: 'G' }, { label: 'Blue', value: 'B' }],
      defaultValue: 'B' },
  ],
  async apply(ctx, p) {
    await ensurePhoton();
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const idIn = ctx.getImageData(0, 0, W, H);
    const pimg = new photon.PhotonImage(new Uint8Array(idIn.data), W, H);

    // Map channels to Photon index
    const CH = { R: 0, G: 1, B: 2 };
    const rSrc = CH[p.redSource   ?? 'G'];
    const gSrc = CH[p.greenSource ?? 'R'];
    const bSrc = CH[p.blueSource  ?? 'B'];

    // Photon swap function modifies in place.
    // e.g., swap R and B.
    // If user says Red <- Green, Green <- Red: swap(0, 1).
    const swaps = [];
    if (rSrc === 1 && gSrc === 0) swaps.push([0, 1]);
    if (rSrc === 2 && bSrc === 0) swaps.push([0, 2]);
    if (gSrc === 2 && bSrc === 1) swaps.push([1, 2]);
    
    // Execute combinations
    swaps.forEach(([a, b]) => photon.swap_channels(pimg, a, b));
    
    const outPixels = pimg.get_raw_pixels();
    const newId = new ImageData(new Uint8ClampedArray(outPixels), W, H);
    ctx.putImageData(newId, 0, 0);
    pimg.free();
  }
});

// ─── Pixel Sort ───────────────────────────────────────────
registry.register({
  id: 'filter-pixel-sort', name: 'Pixel Sort', category: 'Color & Tone', categoryKey: 'color',
  icon: 'sort',
  description: 'Sorts pixels within horizontal strips by luminance — digital glitch aesthetic.',
  params: [
    { name: 'threshold',   label: 'Threshold (0-255)', type: 'range',  min: 0, max: 255, defaultValue: 80 },
    { name: 'direction',   label: 'Sort Direction',     type: 'select',
      options: [{ label: 'Light to Dark', value: 'light-to-dark' }, { label: 'Dark to Light', value: 'dark-to-light' }],
      defaultValue: 'light-to-dark' },
    { name: 'stripHeight', label: 'Strip Height (px)',  type: 'number', defaultValue: 1 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const id        = ctx.getImageData(0, 0, W, H);
    const d         = id.data;
    const threshold = p.threshold ?? 80;
    const darkFirst = (p.direction || 'light-to-dark') === 'dark-to-light';
    const strip     = Math.max(1, Math.round(p.stripHeight ?? 1));

    for (let y = 0; y < H; y += strip) {
      let runStart = -1;

      for (let x = 0; x <= W; x++) {
        const bx   = Math.min(x, W - 1);
        const base = (y * W + bx) * 4;
        const lum  = 0.299 * d[base] + 0.587 * d[base + 1] + 0.114 * d[base + 2];
        const inRun = x < W && lum >= threshold;

        if (inRun && runStart === -1) {
          runStart = x;
        } else if (!inRun && runStart !== -1) {
          const runLen = x - runStart;
          if (runLen > 1) {
            const endRow = Math.min(y + strip, H);
            for (let row = y; row < endRow; row++) {
              const pixels = [];
              for (let px = runStart; px < x; px++) {
                const idx = (row * W + px) * 4;
                const lv  = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
                pixels.push({ lv, r: d[idx], g: d[idx + 1], b: d[idx + 2], a: d[idx + 3] });
              }
              pixels.sort((a, b) => darkFirst ? a.lv - b.lv : b.lv - a.lv);
              for (let k = 0; k < pixels.length; k++) {
                const idx = (row * W + runStart + k) * 4;
                d[idx] = pixels[k].r; d[idx + 1] = pixels[k].g;
                d[idx + 2] = pixels[k].b; d[idx + 3] = pixels[k].a;
              }
            }
          }
          runStart = -1;
        }
      }
    }
    ctx.putImageData(id, 0, 0);
  }
});

// ─── Dither ───────────────────────────────────────────────
const _PALETTES = {
  mono:    [[0,0,0],[255,255,255]],
  gameboy: [[15,56,15],[48,98,48],[139,172,15],[155,188,15]],
  cga: [
    [0,0,0],[0,0,170],[0,170,0],[0,170,170],
    [170,0,0],[170,0,170],[170,85,0],[170,170,170],
    [85,85,85],[85,85,255],[85,255,85],[85,255,255],
    [255,85,85],[255,85,255],[255,255,85],[255,255,255]
  ],
  c64: [
    [0,0,0],[255,255,255],[136,0,0],[170,255,238],
    [204,68,204],[0,204,85],[0,0,170],[238,238,119],
    [221,136,85],[102,68,0],[255,119,119],[51,51,51],
    [119,119,119],[170,255,102],[0,136,255],[187,187,187]
  ],
};

function _nearestColor(r, g, b, palette) {
  let bestDist = Infinity, bestIdx = 0;
  for (let k = 0; k < palette.length; k++) {
    const dr = r - palette[k][0], dg = g - palette[k][1], db = b - palette[k][2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; bestIdx = k; }
  }
  return palette[bestIdx];
}

registry.register({
  id: 'filter-dither', name: 'Dither', category: 'Color & Tone', categoryKey: 'color',
  icon: 'grain',
  description: 'Palette reduction with Floyd-Steinberg dithering — retro 8-bit look.',
  params: [
    { name: 'palette',   label: 'Palette',                   type: 'select',
      options: [
        { label: 'Mono (2 colors)',     value: 'mono'    },
        { label: 'CGA (16 colors)',     value: 'cga'     },
        { label: 'Game Boy (4 greens)', value: 'gameboy' },
        { label: 'C64 (16 colors)',     value: 'c64'     },
      ], defaultValue: 'cga' },
    { name: 'dithering', label: 'Floyd-Steinberg Dithering', type: 'boolean', defaultValue: true },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const id  = ctx.getImageData(0, 0, W, H);
    const src = id.data;

    const palette   = _PALETTES[p.palette || 'cga'] || _PALETTES.cga;
    const useDither = p.dithering !== false;

    // Float buffer for error accumulation (R,G,B per pixel — no alpha)
    const buf = new Float32Array(W * H * 3);
    for (let i = 0, j = 0; i < src.length; i += 4, j += 3) {
      buf[j] = src[i]; buf[j + 1] = src[i + 1]; buf[j + 2] = src[i + 2];
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const j    = (y * W + x) * 3;
        const oldR = Math.max(0, Math.min(255, buf[j]));
        const oldG = Math.max(0, Math.min(255, buf[j + 1]));
        const oldB = Math.max(0, Math.min(255, buf[j + 2]));

        const [newR, newG, newB] = _nearestColor(oldR, oldG, oldB, palette);

        const di = (y * W + x) * 4;
        src[di] = newR; src[di + 1] = newG; src[di + 2] = newB;

        if (!useDither) continue;

        const eR = oldR - newR, eG = oldG - newG, eB = oldB - newB;

        function spread(tx, ty, w) {
          if (tx < 0 || tx >= W || ty >= H) return;
          const tj = (ty * W + tx) * 3;
          buf[tj] += eR * w; buf[tj + 1] += eG * w; buf[tj + 2] += eB * w;
        }
        spread(x + 1, y,     7 / 16);
        spread(x - 1, y + 1, 3 / 16);
        spread(x,     y + 1, 5 / 16);
        spread(x + 1, y + 1, 1 / 16);
      }
    }
    ctx.putImageData(id, 0, 0);
  }
});

// ─── Selective Color Grade (InSPyReNet + Photon) ────────
// Grade the subject and background independently. Typical uses:
//   • Subject: +saturation, +exposure, warmer temperature
//   • Background: -saturation, -exposure, cooler temperature
// The matte is feathered with `edgeFeather` so the transition is smooth.
//
// Photon has no native "temperature" primitive; we approximate by
// simultaneously pushing the red and blue channels in opposite directions:
//   warm (+)  => more red, less blue
//   cool (-)  => less red, more blue
// Mapping: temp ∈ [-100..100]  →  ±60 on the 8-bit channel.
//
// Exposure uses adjust_brightness in the range [-127..127].
registry.register({
  id: 'ai-selective-grade', name: 'Selective Color Grade', category: 'AI & Composition', categoryKey: 'ai',
  icon: 'palette',
  requires: [{ type: 'model', id: 'inspyrenet-swinb-fp16', label: 'InSPyReNet model (~200 MB)', actionHref: '#mdl' }],
  description: 'Grade the subject and background independently — saturation, temperature and exposure per scope. Requires the InSPyReNet model (#mdl).',
  params: [
    { name: 'subjectSaturation',    label: 'Subject Saturation',   type: 'range', min: -100, max: 100, defaultValue:  20 },
    { name: 'subjectTemperature',   label: 'Subject Temperature',  type: 'range', min: -100, max: 100, defaultValue:  10 },
    { name: 'subjectExposure',      label: 'Subject Exposure',     type: 'range', min: -100, max: 100, defaultValue:   5 },
    { name: 'backgroundSaturation', label: 'Background Saturation',  type: 'range', min: -100, max: 100, defaultValue: -30 },
    { name: 'backgroundTemperature', label: 'Background Temperature', type: 'range', min: -100, max: 100, defaultValue: -15 },
    { name: 'backgroundExposure',   label: 'Background Exposure',   type: 'range', min: -100, max: 100, defaultValue: -10 },
    { name: 'edgeFeather',          label: 'Edge Feather',         type: 'range', min:   0, max:  30, defaultValue:   6 },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-selective-grade] Skipping — onnxruntime-web requires the main thread.');
      return;
    }

    try {
      const sSat = clamp(Math.round(p.subjectSaturation ?? 20), -100, 100);
      const sTmp = clamp(Math.round(p.subjectTemperature ?? 10), -100, 100);
      const sExp = clamp(Math.round(p.subjectExposure ?? 5), -100, 100);
      const bSat = clamp(Math.round(p.backgroundSaturation ?? -30), -100, 100);
      const bTmp = clamp(Math.round(p.backgroundTemperature ?? -15), -100, 100);
      const bExp = clamp(Math.round(p.backgroundExposure ?? -10), -100, 100);
      const edge = clamp(Math.round(p.edgeFeather ?? 6), 0, 30);

      // Fast exit if all six dials are 0 — nothing to do.
      if (!sSat && !sTmp && !sExp && !bSat && !bTmp && !bExp) return;

      const { isModelReady, getSaliencyMask } = await import('../ai/inspyrenet.js');
      const ready = await isModelReady();
      if (!ready) {
        const msg = 'InSPyReNet model not downloaded. Open the Models screen (#mdl) to download it.';
        context?.log?.('warn', `[ai-selective-grade] ${msg}`);
        console.warn(`[ai-selective-grade] ${msg}`);
        return;
      }

      await ensurePhoton();
      const W = ctx.canvas.width, H = ctx.canvas.height;
      const t0 = performance.now();

      const maskObj = await getSaliencyMask(ctx.canvas, { log: context?.log });
      const matte = await featherMaskChannel(maskObj.mask, W, H, edge);

      const idIn = ctx.getImageData(0, 0, W, H);
      const srcBytes = new Uint8Array(idIn.data);

      // Helper: produce a graded full-image Uint8Array by applying the supplied
      // saturation / temperature / exposure to a fresh clone of the source.
      const gradeOne = (sat, tmp, exp) => {
        const pimg = new photon.PhotonImage(new Uint8Array(srcBytes), W, H);
        if (sat > 0)      photon.saturate_hsl(pimg, sat / 100);
        else if (sat < 0) photon.desaturate_hsl(pimg, Math.abs(sat) / 100);
        if (tmp !== 0) {
          const shift = Math.round((tmp / 100) * 60);
          photon.alter_red_channel(pimg,  shift);
          photon.alter_blue_channel(pimg, -shift);
        }
        if (exp !== 0) {
          photon.adjust_brightness(pimg, Math.round((exp / 100) * 127));
        }
        const out = pimg.get_raw_pixels();
        pimg.free();
        return out;
      };

      const subjBytes = gradeOne(sSat, sTmp, sExp);
      const bgBytes   = gradeOne(bSat, bTmp, bExp);

      // Composite: mask=1 → subject grade, mask=0 → background grade.
      const out = idIn.data;
      for (let i = 0, j = 0; i < matte.length; i++, j += 4) {
        const m = matte[i] / 255;
        const inv = 1 - m;
        out[j]     = subjBytes[j]     * m + bgBytes[j]     * inv;
        out[j + 1] = subjBytes[j + 1] * m + bgBytes[j + 1] * inv;
        out[j + 2] = subjBytes[j + 2] * m + bgBytes[j + 2] * inv;
        // alpha preserved from source
      }
      ctx.putImageData(idIn, 0, 0);

      await persistSubjectVision(context?.assetHash, maskObj, {
        selectiveGrade: {
          subject: { saturation: sSat, temperature: sTmp, exposure: sExp },
          background: { saturation: bSat, temperature: bTmp, exposure: bExp },
          edgeFeather: edge,
          at: Date.now(),
        }
      });

      context?.log?.('info', `[ai-selective-grade] ${Math.round(performance.now() - t0)}ms`);
    } catch (err) {
      console.warn('[ai-selective-grade] failed:', err);
      context?.log?.('warn', `[ai-selective-grade] failed: ${err.message || err}`);
    }
  }
});

// ─── Cinematic Grade (Lumetri) ─────────────────────────────
registry.register({
  id: 'color-lumetri', name: 'Cinematic Grade', category: 'Color & Tone', categoryKey: 'color',
  icon: 'camera',
  description: 'Pro-level color grading engine. Adjust exposure, contrast, temperature, and shadows using a WebGL shader pipeline for maximum performance.',
  params: [
    { name: 'exposure',    label: 'Exposure (f-stops)', type: 'range', min: -3, max: 3, step: 0.1, defaultValue: 0 },
    { name: 'contrast',    label: 'Contrast',           type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'highlights',  label: 'Highlights',         type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'shadows',     label: 'Shadows',            type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'temperature', label: 'Temperature',        type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'tint',        label: 'Tint',               type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'saturation',  label: 'Saturation (%)',     type: 'range', min: 0, max: 200, defaultValue: 100 },
    { name: 'vibrance',    label: 'Vibrance',           type: 'range', min: -100, max: 100, defaultValue: 0 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    
    // Normalise parameters
    const exposure = p.exposure || 0;
    const contrast = (p.contrast || 0) / 100.0;
    const highlights = (p.highlights || 0) / 100.0;
    const shadows = (p.shadows || 0) / 100.0;
    const temp = (p.temperature || 0) / 100.0;
    const tint = (p.tint || 0) / 100.0;
    const sat = (p.saturation ?? 100) / 100.0;
    const vibrance = (p.vibrance || 0) / 100.0;

    // Fast exit if no-op
    if (exposure === 0 && contrast === 0 && highlights === 0 && shadows === 0 && temp === 0 && tint === 0 && sat === 1 && vibrance === 0) return;

    const glCanvas = document.createElement('canvas');
    glCanvas.width = W;
    glCanvas.height = H;
    // We use webgl2 if available for better float precision, else webgl
    const gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
    if (!gl) {
      console.warn('[color-lumetri] WebGL not supported, skipping effect');
      return;
    }

    const vsSource = `
      attribute vec2 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        vTexCoord = aTexCoord;
        // Flip Y for WebGL texture so we don't have to use UNPACK_FLIP_Y_WEBGL which can be slow
        vTexCoord.y = 1.0 - vTexCoord.y; 
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec2 vTexCoord;
      uniform sampler2D uImage;
      
      uniform float uExposure;
      uniform float uContrast;
      uniform float uHighlights;
      uniform float uShadows;
      uniform float uTemperature;
      uniform float uTint;
      uniform float uSaturation;
      uniform float uVibrance;

      void main() {
          vec4 texColor = texture2D(uImage, vTexCoord);
          vec3 color = texColor.rgb;

          // 1. Exposure (f-stop curve)
          color *= pow(2.0, uExposure);

          // 2. Temperature & Tint
          color.r += uTemperature * 0.15;
          color.b -= uTemperature * 0.15;
          color.g += uTint * 0.15;

          // 3. Contrast (Pivot at 0.5)
          float c = (uContrast > 0.0) ? (1.0 / (1.0 - uContrast)) : (1.0 + uContrast);
          color = (color - 0.5) * c + 0.5;

          // 4. Highlights & Shadows
          float luma = dot(color, vec3(0.299, 0.587, 0.114));
          float shadowMask = clamp(1.0 - (luma * 2.0), 0.0, 1.0);
          float highlightMask = clamp((luma - 0.5) * 2.0, 0.0, 1.0);
          color += uShadows * 0.5 * shadowMask;
          color += uHighlights * 0.5 * highlightMask;

          // 5. Saturation & Vibrance
          float luma2 = dot(color, vec3(0.299, 0.587, 0.114));
          color = mix(vec3(luma2), color, uSaturation);

          float maxC = max(color.r, max(color.g, color.b));
          float minC = min(color.r, min(color.g, color.b));
          float satAmount = maxC - minC;
          // Vibrance targets less saturated pixels
          float vib = uVibrance * (1.0 - satAmount);
          color = mix(color, mix(vec3(luma2), color, 2.0), vib);

          gl_FragColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
      }
    `;

    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const info = gl.getShaderInfoLog(shader);
          gl.deleteShader(shader);
          throw new Error('Shader compilation failed: ' + info);
      }
      return shader;
    }

    let program;
    try {
        program = gl.createProgram();
        gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource));
        gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program linking failed: ' + gl.getProgramInfoLog(program));
        }
        gl.useProgram(program);
    } catch (e) {
        console.error('[color-lumetri]', e);
        return;
    }

    // Set uniforms
    gl.uniform1f(gl.getUniformLocation(program, "uExposure"), exposure);
    gl.uniform1f(gl.getUniformLocation(program, "uContrast"), contrast);
    gl.uniform1f(gl.getUniformLocation(program, "uHighlights"), highlights);
    gl.uniform1f(gl.getUniformLocation(program, "uShadows"), shadows);
    gl.uniform1f(gl.getUniformLocation(program, "uTemperature"), temp);
    gl.uniform1f(gl.getUniformLocation(program, "uTint"), tint);
    gl.uniform1f(gl.getUniformLocation(program, "uSaturation"), sat);
    gl.uniform1f(gl.getUniformLocation(program, "uVibrance"), vibrance);

    // Quad geometry (2 triangles)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,   1.0, -1.0,   -1.0,  1.0,
      -1.0,  1.0,   1.0, -1.0,    1.0,  1.0
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0, 0.0,   1.0, 0.0,   0.0, 1.0,
      0.0, 1.0,   1.0, 0.0,   1.0, 1.0
    ]), gl.STATIC_DRAW);
    const aTex = gl.getAttribLocation(program, "aTexCoord");
    gl.enableVertexAttribArray(aTex);
    gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

    // Upload canvas to texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);

    // Draw
    gl.viewport(0, 0, W, H);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Copy webgl canvas back to 2d canvas
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(glCanvas, 0, 0);
    
    // Clean up
    gl.deleteTexture(texture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(texCoordBuffer);
    gl.deleteProgram(program);
  }
});

// ─── Rain on Lens ─────────────────────────────────────────────
registry.register({
  id: 'filter-rain', name: 'Rain on Lens', category: 'Color & Tone', categoryKey: 'color',
  icon: 'water_drop',
  description: 'Procedural hardware-accelerated Rain on Lens effect. Includes physical refraction, trails, and clearing fog.',
  params: [
    { name: 'density', label: 'Rain Intensity', type: 'range', min: 1, max: 30, step: 1, defaultValue: 10 },
    { name: 'sizeMin', label: 'Min Drop Size',  type: 'range', min: 0.1, max: 2.0, step: 0.1, defaultValue: 0.5 },
    { name: 'sizeMax', label: 'Max Drop Size',  type: 'range', min: 0.1, max: 3.0, step: 0.1, defaultValue: 1.5 },
    { name: 'fogging', label: 'Lens Fogging',   type: 'range', min: 0, max: 100, step: 1, defaultValue: 50 },
    { name: 'speed',   label: 'Drip Velocity',  type: 'range', min: 0.1, max: 5, step: 0.1, defaultValue: 1.0 },
    { name: 'offset',  label: 'Time Offset (s)',type: 'number', defaultValue: 0 },
  ],
  apply(ctx, p, context) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    
    // Normalise parameters
    const density = parseFloat(p.density ?? 10);
    const sizeMin = parseFloat(p.sizeMin ?? 0.5);
    const sizeMax = Math.max(sizeMin, parseFloat(p.sizeMax ?? 1.5));
    const fogging = parseFloat(p.fogging ?? 50) / 100.0;
    const speed = parseFloat(p.speed ?? 1.0);
    const timeOffset = parseFloat(p.offset ?? 0);
    const uTime = (context?.timestampSec ?? 0) + timeOffset;

    // Fast exit if no rain and no fog
    if (density === 0 && fogging === 0) return;

    const glCanvas = document.createElement('canvas');
    glCanvas.width = W;
    glCanvas.height = H;
    // We use webgl2 if available for better float precision, else webgl
    const gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
    if (!gl) {
      console.warn('[filter-rain] WebGL not supported, skipping effect');
      return;
    }

    const vsSource = `
      attribute vec2 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        vTexCoord = aTexCoord;
        // Flip Y for WebGL texture
        vTexCoord.y = 1.0 - vTexCoord.y; 
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec2 vTexCoord;
      uniform sampler2D uImage;
      
      uniform float uTime;
      uniform float uDensity;
      uniform float uSizeMin;
      uniform float uSizeMax;
      uniform float uFog;
      uniform float uSpeed;

      // Organic hash functions for randomness
      float hash12(vec2 p) {
          vec3 p3  = fract(vec3(p.xyx) * .1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
      }
      
      vec2 hash22(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
          p3 += dot(p3, p3.yzx+33.33);
          return fract((p3.xx+p3.yz)*p3.zy);
      }

      // 3x3 Neighborhood Rain Layer
      vec4 rainLayer(vec2 uv, float t, float aspect, float layerOffset) {
          vec2 UV = uv;
          
          // The grid slowly slides down the glass over time
          uv.y -= t * 0.3 * uSpeed;
          
          // Calculate grid bounds safely based on absolute max drop size
          float minRadius = uSizeMin * 0.03;
          float maxRadius = uSizeMax * 0.03;
          
          // Grid cells are dynamically sized so the max drop always safely fits inside a 3x3 search area
          float gridY = 0.8 / maxRadius;
          vec2 grid = vec2(gridY * aspect, gridY); // Perfectly square physical cells
          
          vec2 st = uv * grid;
          vec2 id = floor(st);
          vec2 f = fract(st);
          
          vec4 result = vec4(0.0);
          
          // Density acts purely as a spawn probability gate, not a size modifier
          float densityProb = clamp(uDensity / 30.0, 0.01, 1.0);
          
          for(int y=-1; y<=1; y++) {
              for(int x=-1; x<=1; x++) {
                  vec2 offset = vec2(float(x), float(y));
                  vec2 cellID = id + offset;
                  vec2 cellST = f - offset;
                  
                  vec2 h = hash22(cellID + layerOffset);
                  
                  // Respect density limits
                  if (h.x > densityProb) continue;
                  
                  // Physical radius in cell space
                  float dropRadiusUV = mix(minRadius, maxRadius, h.y);
                  float r = dropRadiusUV * grid.y;
                  
                  // Position inside cell
                  vec2 hashPos = hash22(cellID * 1.5);
                  float posX = 0.5 + (hashPos.x - 0.5) * 0.6;
                  
                  // Larger drops slide much faster
                  float dropSpeed = mix(0.5, 2.0, h.y) * uSpeed;
                  float cycleT = fract(t * dropSpeed + hashPos.y * 10.0);
                  
                  // Sliding physics
                  float slide = smoothstep(0.1, 0.85, cycleT);
                  float posY = 0.2 + slide * 0.6;
                  
                  vec2 p = cellST - vec2(posX, posY);
                  
                  // Teardrop shape taper
                  float shape = r;
                  if (p.y < 0.0) {
                      shape *= max(0.0, 1.0 + p.y * 3.0 / r);
                  }
                  
                  float dist = length(p);
                  float dropMask = smoothstep(0.05, -0.05, dist - shape);
                  
                  // Streaming Wipe Trail
                  float trailWidth = r * mix(0.2, 0.5, smoothstep(0.0, posY, cellST.y));
                  float trailDist = abs(cellST.x - posX);
                  float trailMask = smoothstep(trailWidth, trailWidth * 0.2, trailDist);
                  
                  trailMask *= smoothstep(-0.2, 0.1, cellST.y); // Fade above cell
                  trailMask *= smoothstep(posY + 0.1, posY - 0.1, cellST.y); // Connect to drop
                  trailMask *= smoothstep(1.0, 0.8, cycleT); // Fade over cycle
                  
                  // Pinned micro-droplets in the trail
                  float microDrops = smoothstep(0.7, 1.0, hash12(floor(UV * vec2(grid.x, grid.y * 5.0))));
                  float trailDrops = trailMask * microDrops;
                  
                  if (dropMask > 0.0) {
                      result.xy = p / r; // Spherical normal
                      result.z = dropMask;
                      result.w = 1.0;
                  } else if (trailDrops > 0.0 && result.z == 0.0) {
                      result.xy = vec2(sign(cellST.x - posX) * trailMask, 0.0) * 0.6;
                      result.z = 0.5;
                      result.w = 0.8;
                  }
                  
                  float wipe = trailMask * smoothstep(0.1, 0.2, cycleT);
                  result.w = max(result.w, wipe * 0.7);
              }
          }
          
          return result;
      }

      vec4 staticDrops(vec2 uv, float aspect) {
          float maxRadius = 0.015;
          float gridY = 0.8 / maxRadius;
          vec2 grid = vec2(gridY * aspect, gridY);
          
          vec2 st = uv * grid;
          vec2 id = floor(st);
          vec2 f = fract(st);
          
          vec4 result = vec4(0.0);
          float densityProb = clamp(uDensity / 30.0, 0.01, 1.0);
          
          for(int y=-1; y<=1; y++) {
              for(int x=-1; x<=1; x++) {
                  vec2 offset = vec2(float(x), float(y));
                  vec2 cellID = id + offset;
                  vec2 cellST = f - offset;
                  
                  vec2 h = hash22(cellID + 123.45);
                  if (h.x > densityProb * 1.5) continue;
                  
                  float r = mix(0.005, maxRadius, h.y) * grid.y;
                  vec2 pos = vec2(0.5) + (hash22(cellID * 2.0) - 0.5) * 0.6;
                  vec2 p = cellST - pos;
                  
                  float dist = length(p);
                  float mask = smoothstep(0.05, -0.05, dist - r);
                  
                  if (mask > 0.0) {
                      result.xy = p / r;
                      result.z = mask;
                      result.w = mask;
                  }
              }
          }
          return result;
      }

      void main() {
          vec2 uv = vTexCoord;
          float t = uTime;
          float aspect = 16.0 / 9.0;
          
          // 2 Dynamic Layers (offset to prevent overlap)
          vec4 layer1 = rainLayer(uv, t, aspect, 0.0);
          vec4 layer2 = rainLayer(uv + vec2(0.345, 0.678), t * 1.3, aspect, 10.0);
          
          // 1 Static Condensation Layer
          vec4 statics = staticDrops(uv, aspect);
          
          // Combine layers
          vec4 combined = vec4(0.0);
          
          // Layer precedence (closest/biggest first)
          if (layer1.z > 0.0) combined = layer1;
          else if (layer2.z > 0.0) combined = layer2;
          else {
              // Statics only where there is no wipe
              float totalWipe = max(layer1.w, layer2.w);
              if (totalWipe == 0.0 && statics.z > 0.0) combined = statics;
              else combined.w = totalWipe; // Pass the wipe mask through
          }
          
          // Lensing effect: we invert and scale the normal to sample behind the drop
          vec2 dropUV = uv - combined.xy * 0.03;
          dropUV = clamp(dropUV, 0.0, 1.0);
          
          vec4 col = texture2D(uImage, dropUV);
          
          // Lens Fogging / Blurring
          if (uFog > 0.0) {
              // Fog the glass, but keep droplets and wipe trails clear
              float fogFactor = uFog * (1.0 - combined.w);
              
              if (fogFactor > 0.0) {
                  float fAmt = fogFactor * 0.015;
                  vec4 blur = texture2D(uImage, clamp(dropUV + vec2(fAmt, fAmt), 0.0, 1.0)) +
                              texture2D(uImage, clamp(dropUV + vec2(-fAmt, fAmt), 0.0, 1.0)) +
                              texture2D(uImage, clamp(dropUV + vec2(fAmt, -fAmt), 0.0, 1.0)) +
                              texture2D(uImage, clamp(dropUV + vec2(-fAmt, -fAmt), 0.0, 1.0));
                  blur *= 0.25;
                  col = mix(col, blur, fogFactor);
                  col.rgb += vec3(0.15 * fogFactor); // Frosted glass brightening
              }
          }
          
          // Volumetric specular highlight
          if (combined.z > 0.0) {
              // Light from top left
              vec2 lightDir = normalize(vec2(-1.0, -1.0));
              // The normal of the sphere is effectively combined.xy
              float spec = max(0.0, dot(combined.xy, lightDir));
              spec = pow(spec, 6.0); // Sharp highlight
              
              // Internal reflection (bottom right)
              float internal = max(0.0, dot(combined.xy, -lightDir));
              internal = pow(internal, 2.0) * 0.4;
              
              col.rgb += vec3(spec + internal);
              
              // Darken the droplet edge for physical contrast
              float edgeDarken = smoothstep(0.8, 1.0, length(combined.xy));
              col.rgb *= (1.0 - edgeDarken * 0.3);
          }
          
          gl_FragColor = vec4(col.rgb, 1.0);
      }
    `;

    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const info = gl.getShaderInfoLog(shader);
          gl.deleteShader(shader);
          throw new Error('Shader compilation failed: ' + info);
      }
      return shader;
    }

    let program;
    try {
        program = gl.createProgram();
        gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource));
        gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program linking failed: ' + gl.getProgramInfoLog(program));
        }
        gl.useProgram(program);
    } catch (e) {
        console.error('[filter-rain]', e);
        return;
    }

    // Set uniforms
    gl.uniform1f(gl.getUniformLocation(program, "uTime"), uTime);
    gl.uniform1f(gl.getUniformLocation(program, "uDensity"), density);
    gl.uniform1f(gl.getUniformLocation(program, "uSizeMin"), sizeMin);
    gl.uniform1f(gl.getUniformLocation(program, "uSizeMax"), sizeMax);
    gl.uniform1f(gl.getUniformLocation(program, "uFog"), fogging);
    gl.uniform1f(gl.getUniformLocation(program, "uSpeed"), speed);

    // Quad geometry (2 triangles)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,   1.0, -1.0,   -1.0,  1.0,
      -1.0,  1.0,   1.0, -1.0,    1.0,  1.0
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0, 0.0,   1.0, 0.0,   0.0, 1.0,
      0.0, 1.0,   1.0, 0.0,   1.0, 1.0
    ]), gl.STATIC_DRAW);
    const aTex = gl.getAttribLocation(program, "aTexCoord");
    gl.enableVertexAttribArray(aTex);
    gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

    // Upload canvas to texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);

    // Draw
    gl.viewport(0, 0, W, H);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Copy webgl canvas back to 2d canvas
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(glCanvas, 0, 0);
    
    // Clean up
    gl.deleteTexture(texture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(texCoordBuffer);
    gl.deleteProgram(program);
  }
});

