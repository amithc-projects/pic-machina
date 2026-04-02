/**
 * ImageChef — Color, Tone & Filter transforms
 */

import { registry } from '../registry.js';
import { clamp } from '../../utils/misc.js';

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
  apply(ctx, p) {
    const contrast   = (p.contrast   || 0) / 100;
    const saturation = (p.saturation || 0) / 100;
    const vibrance   = (p.vibrance   || 0) / 100;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const id = ctx.getImageData(0, 0, W, H);
    const d = id.data;
    const cf = contrast + 1;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i+1], b = d[i+2];

      if (p.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }

      if (contrast !== 0) {
        r = ((r / 255 - 0.5) * cf + 0.5) * 255;
        g = ((g / 255 - 0.5) * cf + 0.5) * 255;
        b = ((b / 255 - 0.5) * cf + 0.5) * 255;
      }

      if (saturation !== 0) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const sf = 1 + saturation;
        r = gray + (r - gray) * sf;
        g = gray + (g - gray) * sf;
        b = gray + (b - gray) * sf;
      }

      // Vibrance: boost under-saturated pixels more
      if (vibrance !== 0) {
        const max = Math.max(r, g, b);
        const avg = (r + g + b) / 3;
        const amt = (1 - (max - avg) / 128) * vibrance;
        const vf  = 1 + amt;
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + (r - gray) * vf;
        g = gray + (g - gray) * vf;
        b = gray + (b - gray) * vf;
      }

      d[i]   = clamp(r, 0, 255);
      d[i+1] = clamp(g, 0, 255);
      d[i+2] = clamp(b, 0, 255);
    }
    ctx.putImageData(id, 0, 0);
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
  apply(ctx, p) {
    const parseHex = hex => {
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return [r,g,b];
    };
    const [dr,dg,db] = parseHex(p.darkColor  || '#000000');
    const [lr,lg,lb] = parseHex(p.lightColor || '#ffffff');
    const id = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]) / 255;
      d[i]   = Math.round(dr + (lr - dr) * lum);
      d[i+1] = Math.round(dg + (lg - dg) * lum);
      d[i+2] = Math.round(db + (lb - db) * lum);
    }
    ctx.putImageData(id, 0, 0);
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
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;

    // Blur
    if (p.blurRadius > 0) {
      const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
      const tc = tmp.getContext('2d'); tc.filter = `blur(${p.blurRadius}px)`; tc.drawImage(ctx.canvas, 0, 0);
      ctx.clearRect(0, 0, W, H); ctx.drawImage(tmp, 0, 0);
    }

    // Sharpen (unsharp mask via convolution)
    if (p.sharpenAmount > 0) {
      const amount = p.sharpenAmount / 100;
      const id = ctx.getImageData(0, 0, W, H); const d = id.data;
      const orig = new Uint8ClampedArray(d);
      // 3x3 Laplacian sharpening kernel
      const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const idx = (y * W + x) * 4;
          for (let c = 0; c < 3; c++) {
            let v = 0;
            for (let ky = -1; ky <= 1; ky++)
              for (let kx = -1; kx <= 1; kx++)
                v += orig[((y + ky) * W + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
            d[idx + c] = clamp(orig[idx + c] + (v - orig[idx + c]) * amount, 0, 255);
          }
        }
      }
      ctx.putImageData(id, 0, 0);
    }

    // Noise
    if (p.noiseLevel > 0) {
      const id = ctx.getImageData(0, 0, W, H); const d = id.data;
      const n = p.noiseLevel * 2.55;
      for (let i = 0; i < d.length; i += 4) {
        const noise = (Math.random() - 0.5) * n * 2;
        for (let j = 0; j < 3; j++) d[i+j] = clamp(d[i+j] + noise, 0, 255);
      }
      ctx.putImageData(id, 0, 0);
    }

    // Pixelate
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
      options: [{ label: 'Replace (Edge Map)', value: 'none' }, { label: 'Darken (Overlay)', value: 'darken' }],
      defaultValue: 'none' },
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

    const thresh    = (p.threshold ?? 15) / 100 * 255;
    const softEdges = p.softEdges || false;

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
        const val = mag < thresh ? 0 : softEdges ? clamp(mag, 0, 255) : 255;
        const idx = (y * W + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = val;
        // alpha untouched
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
      ctx.globalCompositeOperation = 'darken';
      ctx.drawImage(edgeCanvas, 0, 0);
      ctx.restore();
    }
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
  description: 'Kuwahara filter — non-linear edge-preserving smoothing that creates a painterly oil effect.',
  params: [
    { name: 'radius', label: 'Radius (stroke size)',  type: 'range', min: 1, max: 8, defaultValue: 3 },
    { name: 'passes', label: 'Passes (intensity)',     type: 'range', min: 1, max: 3, defaultValue: 1 },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const radius = Math.round(p.radius ?? 3);
    const passes = Math.round(p.passes ?? 1);

    for (let pass = 0; pass < passes; pass++) {
      const id  = ctx.getImageData(0, 0, W, H);
      const src = new Uint8ClampedArray(id.data);
      const dst = id.data;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let bestR = 0, bestG = 0, bestB = 0, bestVar = Infinity;

          // Test 4 overlapping quadrants (corners at ±radius from pixel)
          for (let qy = -1; qy <= 0; qy++) {
            for (let qx = -1; qx <= 0; qx++) {
              let sumR = 0, sumG = 0, sumB = 0, sumR2 = 0, sumG2 = 0, sumB2 = 0, count = 0;
              for (let dy = 0; dy <= radius; dy++) {
                for (let dx = 0; dx <= radius; dx++) {
                  const sx  = clamp(x + qx * radius + dx, 0, W - 1);
                  const sy  = clamp(y + qy * radius + dy, 0, H - 1);
                  const idx = (sy * W + sx) * 4;
                  const r = src[idx], g = src[idx + 1], b = src[idx + 2];
                  sumR += r; sumG += g; sumB += b;
                  sumR2 += r * r; sumG2 += g * g; sumB2 += b * b;
                  count++;
                }
              }
              const mR = sumR / count, mG = sumG / count, mB = sumB / count;
              const variance = (sumR2 / count - mR * mR) + (sumG2 / count - mG * mG) + (sumB2 / count - mB * mB);
              if (variance < bestVar) {
                bestVar = variance; bestR = mR; bestG = mG; bestB = mB;
              }
            }
          }

          const di = (y * W + x) * 4;
          dst[di] = Math.round(bestR); dst[di + 1] = Math.round(bestG); dst[di + 2] = Math.round(bestB);
        }
      }
      ctx.putImageData(id, 0, 0);
    }
  }
});
