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
    { name: 'content',     label: 'Text ({{vars}} supported)', type: 'text',   defaultValue: '{{filename}}' },
    { name: 'font',        label: 'Font Family',  type: 'text',   defaultValue: 'Inter' },
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
    { name: 'offsetX',     label: 'Offset X (px)', type: 'number', defaultValue: 20 },
    { name: 'offsetY',     label: 'Offset Y (px)', type: 'number', defaultValue: 20 },
    { name: 'shadow',      label: 'Text Shadow',   type: 'boolean', defaultValue: true },
    { name: 'shadowColor', label: 'Shadow Color',  type: 'color',  defaultValue: '#000000' },
    { name: 'weight',      label: 'Font Weight',   type: 'select',
      options: [{ label: 'Normal', value: '400' }, { label: 'Bold', value: '700' }, { label: 'Light', value: '300' }],
      defaultValue: '400' },
    { name: 'blendMode',   label: 'Blend Mode',   type: 'select',
      options: [{ label: 'Normal', value: 'source-over' }, { label: 'Multiply', value: 'multiply' }, { label: 'Screen', value: 'screen' }],
      defaultValue: 'source-over' },
  ],
  apply(ctx, p, context) {
    const text = interpolate(p.content || '{{filename}}', context);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const size = p.size || 32;

    ctx.save();
    ctx.globalAlpha = (p.opacity ?? 100) / 100;
    ctx.globalCompositeOperation = p.blendMode || 'source-over';
    ctx.font = `${p.weight || 400} ${size}px ${p.font || 'Inter'}, sans-serif`;
    ctx.fillStyle = p.color || '#ffffff';
    ctx.textBaseline = 'alphabetic';

    if (p.shadow) {
      ctx.shadowColor   = p.shadowColor || 'rgba(0,0,0,0.6)';
      ctx.shadowBlur    = size * 0.3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }

    const anchor = p.anchor || 'bottom-right';
    const ox = p.offsetX ?? 20;
    const oy = p.offsetY ?? 20;
    const metrics = ctx.measureText(text);
    const tw = metrics.width;
    const th = size;

    let x, y;
    const [va, ha] = anchor.split('-');
    const horizontalPart = ha || va; // handles single-word anchors like 'center'

    // Horizontal
    if (anchor === 'center' || horizontalPart === 'center') x = (W - tw) / 2;
    else if (horizontalPart === 'right') x = W - tw - ox;
    else x = ox; // left

    // Vertical
    if (anchor === 'center' || va === 'center') y = (H + th) / 2;
    else if (va === 'bottom') y = H - oy;
    else y = th + oy; // top

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
