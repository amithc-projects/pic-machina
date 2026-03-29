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
