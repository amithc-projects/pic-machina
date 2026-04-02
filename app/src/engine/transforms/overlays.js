/**
 * ImageChef — Creative Overlays & Typography transforms
 */

import { registry } from '../registry.js';
import { interpolate } from '../../utils/variables.js';

// ─── Rich Text ────────────────────────────────────────────
registry.register({
  id: 'overlay-rich-text', name: 'Rich Text', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'text_fields',
  description: 'Render styled text over the image. Supports {{variable}} injection.',
  params: [
    { name: 'content',     label: 'Text ({{vars}} supported)', type: 'text',    defaultValue: '{{filename}}' },
    { name: 'font',        label: 'Font Family',  type: 'text',    defaultValue: 'Inter' },
    { name: 'sizeMode',    label: 'Size Mode',    type: 'select',
      options: [
        { label: 'Fixed (px)',       value: 'px' },
        { label: '% of image width', value: 'pct-width' },
        { label: '% of image height',value: 'pct-height' },
      ], defaultValue: 'px' },
    { name: 'size',        label: 'Font Size',    type: 'number', defaultValue: 32 },
    { name: 'color',       label: 'Text Color',   type: 'color',  defaultValue: '#ffffff' },
    { name: 'opacity',     label: 'Opacity (%)',  type: 'range',  min: 0, max: 100, defaultValue: 100 },
    { name: 'anchor',      label: 'Anchor',       type: 'select',
      options: [
        { label: 'Top Left',      value: 'top-left' },
        { label: 'Top Centre',    value: 'top-center' },
        { label: 'Top Right',     value: 'top-right' },
        { label: 'Centre Left',   value: 'center-left' },
        { label: 'Centre',        value: 'center' },
        { label: 'Centre Right',  value: 'center-right' },
        { label: 'Bottom Left',   value: 'bottom-left' },
        { label: 'Bottom Centre', value: 'bottom-center' },
        { label: 'Bottom Right',  value: 'bottom-right' },
      ], defaultValue: 'bottom-right' },
    { name: 'offsetX',     label: 'Offset X (px)',  type: 'number',  defaultValue: 20 },
    { name: 'offsetY',     label: 'Offset Y (px)',  type: 'number',  defaultValue: 20 },
    // ── Background box ────────────────────────────────────
    { name: 'bgBox',       label: 'Background Box', type: 'select',
      options: [
        { label: 'None',       value: 'none' },
        { label: 'Wrap text',  value: 'wrap' },
        { label: 'Full width', value: 'full-width' },
      ], defaultValue: 'none' },
    { name: 'bgColor',     label: 'Box Color',      type: 'color',   defaultValue: '#000000' },
    { name: 'bgOpacity',   label: 'Box Opacity (%)',type: 'range',   min: 0, max: 100, defaultValue: 60 },
    { name: 'bgPadding',   label: 'Box Padding (px)',type: 'number', defaultValue: 8 },
    // ── Text style ────────────────────────────────────────
    { name: 'shadow',      label: 'Text Shadow',    type: 'boolean', defaultValue: true },
    { name: 'shadowColor', label: 'Shadow Color',   type: 'color',   defaultValue: '#000000' },
    { name: 'weight',      label: 'Font Weight',    type: 'select',
      options: [{ label: 'Normal', value: '400' }, { label: 'Bold', value: '700' }, { label: 'Light', value: '300' }],
      defaultValue: '400' },
    { name: 'blendMode',   label: 'Blend Mode',     type: 'select',
      options: [{ label: 'Normal', value: 'source-over' }, { label: 'Multiply', value: 'multiply' }, { label: 'Screen', value: 'screen' }],
      defaultValue: 'source-over' },
  ],
  apply(ctx, p, context) {
    const text = interpolate(p.content || '{{filename}}', context);
    const W = ctx.canvas.width, H = ctx.canvas.height;

    // Resolve font size — fixed px or relative to image dimension
    let size;
    if (p.sizeMode === 'pct-width')  size = Math.max(1, Math.round(W * (p.size || 3) / 100));
    else if (p.sizeMode === 'pct-height') size = Math.max(1, Math.round(H * (p.size || 3) / 100));
    else size = p.size || 32;

    ctx.save();
    ctx.globalAlpha = (p.opacity ?? 100) / 100;
    ctx.globalCompositeOperation = p.blendMode || 'source-over';
    ctx.font = `${p.weight || 400} ${size}px ${p.font || 'Inter'}, sans-serif`;
    ctx.textBaseline = 'alphabetic';

    // Measure text before positioning
    const metrics = ctx.measureText(text);
    const tw      = metrics.width;
    const ascent  = metrics.actualBoundingBoxAscent  || size;
    const descent = metrics.actualBoundingBoxDescent || size * 0.2;

    const anchor = p.anchor || 'bottom-right';
    const ox     = p.offsetX ?? 20;
    const oy     = p.offsetY ?? 20;
    const pad    = p.bgPadding ?? 8;

    let x, y;
    const [va, ha]   = anchor.split('-');
    const hPart      = ha || va;

    // Horizontal text origin
    if (anchor === 'center' || hPart === 'center') x = (W - tw) / 2;
    else if (hPart === 'right') x = W - tw - ox;
    else x = ox;

    // Vertical baseline
    if (anchor === 'center' || va === 'center') y = (H + ascent) / 2;
    else if (va === 'bottom') y = H - oy;
    else y = ascent + oy;

    // ── Background box ──────────────────────────────────
    const bgBox = p.bgBox || 'none';
    if (bgBox !== 'none' && p.bgColor) {
      ctx.save();
      ctx.globalAlpha    = (p.bgOpacity ?? 60) / 100;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowColor    = 'transparent';
      ctx.shadowBlur     = 0;
      ctx.shadowOffsetX  = 0;
      ctx.shadowOffsetY  = 0;
      ctx.fillStyle      = p.bgColor;

      const boxY = y - ascent - pad;
      const boxH = ascent + descent + pad * 2;
      if (bgBox === 'full-width') {
        ctx.fillRect(0, boxY, W, boxH);
      } else {
        ctx.fillRect(x - pad, boxY, tw + pad * 2, boxH);
      }
      ctx.restore();
    }

    // ── Text ────────────────────────────────────────────
    ctx.fillStyle = p.color || '#ffffff';
    if (p.shadow) {
      ctx.shadowColor   = p.shadowColor || 'rgba(0,0,0,0.6)';
      ctx.shadowBlur    = size * 0.3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }
    ctx.fillText(text, x, y);
    ctx.restore();
  }
});

// ─── Watermark ────────────────────────────────────────────
registry.register({
  id: 'overlay-watermark', name: 'Watermark', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'branding_watermark',
  description: 'Repeat a text watermark diagonally across the image.',
  params: [
    { name: 'text',    label: 'Text',        type: 'text',   defaultValue: '© {{filename}}' },
    { name: 'font',    label: 'Font',        type: 'text',   defaultValue: 'Inter' },
    { name: 'size',    label: 'Size (px)',   type: 'number', defaultValue: 28 },
    { name: 'color',   label: 'Color',       type: 'color',  defaultValue: '#ffffff' },
    { name: 'opacity', label: 'Opacity (%)', type: 'range',  min: 0, max: 100, defaultValue: 25 },
    { name: 'angle',   label: 'Angle (°)',   type: 'range',  min: -90, max: 90, defaultValue: -35 },
  ],
  apply(ctx, p, context) {
    const text = interpolate(p.text || '© owner', context);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const size = p.size || 28;
    ctx.save();
    ctx.globalAlpha = (p.opacity || 25) / 100;
    ctx.font = `${size}px ${p.font || 'Inter'}, sans-serif`;
    ctx.fillStyle = p.color || '#ffffff';
    ctx.textBaseline = 'middle';
    const angle = ((p.angle ?? -35) * Math.PI) / 180;
    const tw = ctx.measureText(text).width;
    const step = tw + size * 3;
    const diagLen = Math.sqrt(W * W + H * H);
    const count = Math.ceil(diagLen / step) + 2;
    for (let i = -count; i <= count; i++) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(angle);
      ctx.fillText(text, i * step - tw / 2, 0);
      for (let j = 1; j <= count; j++) {
        ctx.fillText(text, i * step - tw / 2, -j * step);
        ctx.fillText(text, i * step - tw / 2,  j * step);
      }
      ctx.restore();
    }
    ctx.restore();
  }
});

// ─── Ribbon / Badge ───────────────────────────────────────
registry.register({
  id: 'overlay-ribbon', name: 'Ribbon/Badge', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'bookmark',
  description: 'Add a corner ribbon or badge.',
  params: [
    { name: 'text',      label: 'Text',           type: 'text',  defaultValue: 'NEW' },
    { name: 'position',  label: 'Position',       type: 'select',
      options: [{ label: 'Top Left', value: 'TL' }, { label: 'Top Right', value: 'TR' }, { label: 'Bottom Left', value: 'BL' }, { label: 'Bottom Right', value: 'BR' }],
      defaultValue: 'TR' },
    { name: 'bgColor',   label: 'Background',     type: 'color', defaultValue: '#0077ff' },
    { name: 'textColor', label: 'Text Color',     type: 'color', defaultValue: '#ffffff' },
    { name: 'size',      label: 'Ribbon Size (px)', type: 'number', defaultValue: 80 },
  ],
  apply(ctx, p, context) {
    const text = interpolate(p.text || 'NEW', context);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const sz = p.size || 80;
    const pos = p.position || 'TR';
    ctx.save();
    if (pos === 'TR') { ctx.translate(W, 0); ctx.rotate(Math.PI / 4); }
    else if (pos === 'TL') { ctx.rotate(-Math.PI / 4); }
    else if (pos === 'BR') { ctx.translate(W, H); ctx.rotate(-Math.PI / 4); }
    else { ctx.translate(0, H); ctx.rotate(Math.PI / 4); }
    ctx.fillStyle = p.bgColor || '#0077ff';
    ctx.fillRect(-sz * 1.5, -sz / 4, sz * 3, sz / 2);
    ctx.fillStyle = p.textColor || '#ffffff';
    ctx.font = `bold ${sz * 0.3}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
});

// ─── QR Code ─────────────────────────────────────────────
registry.register({
  id: 'overlay-qrcode', name: 'QR Code', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'qr_code_2',
  description: 'Generate and stamp a QR code onto the image.',
  params: [
    { name: 'content',         label: 'Content ({{vars}} ok)', type: 'text',   defaultValue: 'https://example.com' },
    { name: 'size',            label: 'Size (px)',              type: 'number', defaultValue: 150 },
    { name: 'anchor',          label: 'Anchor',                 type: 'select',
      options: [{ label: 'Bottom Right', value: 'bottom-right' }, { label: 'Bottom Left', value: 'bottom-left' }, { label: 'Top Right', value: 'top-right' }, { label: 'Top Left', value: 'top-left' }],
      defaultValue: 'bottom-right' },
    { name: 'margin',          label: 'Margin (px)',            type: 'number', defaultValue: 16 },
    { name: 'errorCorrection', label: 'Error Correction',       type: 'select',
      options: [{ label: 'L (7%)', value: 'L' }, { label: 'M (15%)', value: 'M' }, { label: 'Q (25%)', value: 'Q' }, { label: 'H (30%)', value: 'H' }],
      defaultValue: 'M' },
  ],
  async apply(ctx, p, context) {
    const content = interpolate(p.content || 'https://example.com', context);
    const sz = p.size || 150;
    const margin = p.margin ?? 16;
    const W = ctx.canvas.width, H = ctx.canvas.height;

    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(content, {
        width: sz, margin: 1, errorCorrectionLevel: p.errorCorrection || 'M',
        color: { dark: '#000000', light: '#ffffff' }
      });

      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          let x, y;
          const anchor = p.anchor || 'bottom-right';
          if (anchor.includes('right'))  x = W - sz - margin;
          else                           x = margin;
          if (anchor.includes('bottom')) y = H - sz - margin;
          else                           y = margin;
          ctx.drawImage(img, x, y, sz, sz);
          resolve();
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    } catch (err) {
      console.warn('[overlay-qrcode] failed:', err);
    }
  }
});

// ─── Grid Overlay ─────────────────────────────────────────
registry.register({
  id: 'overlay-grid', name: 'Grid Overlay', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'grid_4x4',
  description: 'Draw an evenly-spaced grid of lines over the image.',
  params: [
    { name: 'spacing',   label: 'Grid Spacing (px)', type: 'number', defaultValue: 50 },
    { name: 'color',     label: 'Line Color',         type: 'color',  defaultValue: '#ffffff' },
    { name: 'opacity',   label: 'Opacity (%)',         type: 'range',  min: 0, max: 100, defaultValue: 50 },
    { name: 'lineWidth', label: 'Line Width (px)',      type: 'number', defaultValue: 1 },
  ],
  apply(ctx, p) {
    const W       = ctx.canvas.width;
    const H       = ctx.canvas.height;
    const spacing = Math.max(1, Math.round(p.spacing ?? 50));

    ctx.save();
    ctx.globalAlpha              = (p.opacity ?? 50) / 100;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle              = p.color || '#ffffff';
    ctx.lineWidth                = Math.max(0.5, p.lineWidth ?? 1);

    ctx.beginPath();
    for (let x = spacing; x < W; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = spacing; y < H; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    ctx.restore();
  }
});

// ─── Map View ─────────────────────────────────────────────
registry.register({
  id: 'overlay-map', name: 'Map View', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'map',
  description: 'Render an OpenStreetMap tile from GPS EXIF data and overlay it on the image.',
  params: [
    { name: 'zoom',     label: 'Zoom Level', type: 'range', min: 5, max: 18, defaultValue: 14 },
    { name: 'style',    label: 'Map Style',  type: 'select',
      options: [{ label: 'Street', value: 'street' }], defaultValue: 'street' },
    { name: 'size',     label: 'Map Size (px)', type: 'number', defaultValue: 256 },
    { name: 'opacity',  label: 'Opacity (%)',   type: 'range', min: 0, max: 100, defaultValue: 85 },
    { name: 'anchor',   label: 'Anchor',        type: 'select',
      options: [{ label: 'Bottom Right', value: 'bottom-right' }, { label: 'Bottom Left', value: 'bottom-left' }],
      defaultValue: 'bottom-right' },
    { name: 'margin',   label: 'Margin (px)', type: 'number', defaultValue: 16 },
  ],
  async apply(ctx, p, context) {
    const gps = context.exif?.gps || context.meta?.gps;
    if (!gps?.lat || !gps?.lng) {
      console.warn('[overlay-map] No GPS data in EXIF — skipping Map View node');
      return;
    }
    const { lat, lng } = gps;
    const zoom = p.zoom || 14;
    const sz   = p.size || 256;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const margin = p.margin ?? 16;

    // Tile maths
    const tileX = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const tileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

    try {
      const resp = await fetch(tileUrl, { headers: { 'User-Agent': 'ImageChef/1.0' } });
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          let x = (p.anchor || 'bottom-right').includes('right') ? W - sz - margin : margin;
          let y = (p.anchor || 'bottom-right').includes('bottom') ? H - sz - margin : margin;
          ctx.save();
          ctx.globalAlpha = (p.opacity ?? 85) / 100;
          ctx.drawImage(img, x, y, sz, sz);
          ctx.restore();
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(); };
        img.src = url;
      });
    } catch (err) {
      console.warn('[overlay-map] tile fetch failed:', err);
    }
  }
});

// ─── Light Leak ───────────────────────────────────────────
registry.register({
  id: 'overlay-light-leak', name: 'Light Leak', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'light_mode',
  description: 'Warm or cool light leak gradient from an edge — classic analog film effect.',
  params: [
    { name: 'edge',      label: 'Edge',         type: 'select',
      options: [
        { label: 'Left',   value: 'left' },
        { label: 'Right',  value: 'right' },
        { label: 'Top',    value: 'top' },
        { label: 'Bottom', value: 'bottom' },
      ], defaultValue: 'right' },
    { name: 'color',     label: 'Color',        type: 'color',  defaultValue: '#ff6600' },
    { name: 'opacity',   label: 'Opacity (%)',  type: 'range',  min: 0, max: 100, defaultValue: 35 },
    { name: 'spread',    label: 'Spread (%)',   type: 'range',  min: 10, max: 100, defaultValue: 65 },
    { name: 'blendMode', label: 'Blend Mode',   type: 'select',
      options: [
        { label: 'Screen',  value: 'screen' },
        { label: 'Add',     value: 'lighter' },
        { label: 'Overlay', value: 'overlay' },
      ], defaultValue: 'screen' },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const edge    = p.edge    || 'right';
    const spread  = (p.spread  ?? 65) / 100;
    const opacity = (p.opacity ?? 35) / 100;
    const color   = p.color   || '#ff6600';

    // Gradient origin at the edge, fading inward by spread amount
    let x0, y0, x1, y1;
    if      (edge === 'right')  { x0 = W;   y0 = H / 2; x1 = W * (1 - spread); y1 = H / 2; }
    else if (edge === 'left')   { x0 = 0;   y0 = H / 2; x1 = W * spread;       y1 = H / 2; }
    else if (edge === 'top')    { x0 = W/2; y0 = 0;     x1 = W / 2; y1 = H * spread; }
    else                        { x0 = W/2; y0 = H;     x1 = W / 2; y1 = H * (1 - spread); }

    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(${r},${g},${b},${opacity})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.save();
    ctx.globalCompositeOperation = p.blendMode || 'screen';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
});

// ─── Canvas Texture ───────────────────────────────────────
registry.register({
  id: 'overlay-canvas-texture', name: 'Canvas Texture', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'texture',
  description: 'Procedural woven-fiber texture overlay — adds the look of painting on canvas or linen.',
  params: [
    { name: 'intensity', label: 'Intensity (%)',    type: 'range', min: 0, max: 100, defaultValue: 18 },
    { name: 'scale',     label: 'Fiber Scale (px)', type: 'range', min: 1, max: 16,  defaultValue: 4 },
    { name: 'blendMode', label: 'Blend Mode',       type: 'select',
      options: [
        { label: 'Overlay',    value: 'overlay' },
        { label: 'Soft Light', value: 'soft-light' },
        { label: 'Multiply',   value: 'multiply' },
      ], defaultValue: 'overlay' },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const scale     = Math.max(1, Math.round(p.scale ?? 4));
    const intensity = (p.intensity ?? 18) / 100;

    // Build a small procedural weave tile
    const tileSize = scale * 8;
    const tile     = document.createElement('canvas');
    tile.width = tileSize; tile.height = tileSize;
    const tc  = tile.getContext('2d');
    const tid = tc.createImageData(tileSize, tileSize);
    const td  = tid.data;

    for (let ty = 0; ty < tileSize; ty++) {
      for (let tx = 0; tx < tileSize; tx++) {
        const hFiber = Math.sin((tx / scale) * Math.PI) * 0.5 + 0.5;
        const vFiber = Math.sin((ty / scale) * Math.PI) * 0.5 + 0.5;
        // Alternating over/under weave pattern
        const weave  = (Math.floor(tx / scale) + Math.floor(ty / scale)) % 2 === 0 ? hFiber : vFiber;
        const val    = Math.round(weave * 255);
        const ti     = (ty * tileSize + tx) * 4;
        td[ti] = td[ti + 1] = td[ti + 2] = val; td[ti + 3] = 255;
      }
    }
    tc.putImageData(tid, 0, 0);

    // Tile across a full-size canvas
    const texCanvas = document.createElement('canvas');
    texCanvas.width = W; texCanvas.height = H;
    const texCtx = texCanvas.getContext('2d');
    texCtx.fillStyle = texCtx.createPattern(tile, 'repeat');
    texCtx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.globalCompositeOperation = p.blendMode || 'overlay';
    ctx.drawImage(texCanvas, 0, 0);
    ctx.restore();
  }
});
