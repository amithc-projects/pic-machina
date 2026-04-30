/**
 * ImageChef — Creative Overlays & Typography transforms
 */

import { registry } from '../registry.js';
import { interpolate } from '../../utils/variables.js';
// Top level subtitle cache for overlay-subtitles
const _sharedSubtitleCache = new Map();

// ─── Rich Text ────────────────────────────────────────────
registry.register({
  id: 'overlay-rich-text', name: 'Rich Text', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'text_fields',
  description: 'Render styled text over the image. Supports {{variable}} injection.',
  params: [
    { name: 'content',     label: 'Text ({{vars}} supported)', type: 'textarea',    defaultValue: '{{filename}}' },
    { name: 'textStyle',   label: 'Text Style',   type: 'text-style-select', defaultValue: 'none' },
    { name: 'font',        label: 'Font Family',  type: 'font-select', textStyleOverride: true, defaultValue: 'Inter' },
    { name: 'sizeMode',    label: 'Size Mode',    type: 'select', textStyleOverride: true,
      options: [
        { label: 'Fixed (px)',       value: 'px' },
        { label: '% of image width', value: 'pct-width' },
        { label: '% of image height',value: 'pct-height' },
      ], defaultValue: 'px' },
    { name: 'size',        label: 'Font Size',    type: 'number', defaultValue: 32, textStyleOverride: true },
    { name: 'color',       label: 'Text Color',   type: 'color',  defaultValue: '#ffffff', textStyleOverride: true },
    { name: 'weight',      label: 'Font Weight',  type: 'select', textStyleOverride: true,
      options: [{ label: 'Normal', value: '400' }, { label: 'Bold', value: '700' }, { label: 'Light', value: '300' }],
      defaultValue: '400' },
    { name: 'shadow',      label: 'Text Shadow',  type: 'boolean', defaultValue: true, textStyleOverride: true },
    { name: 'shadowColor', label: 'Shadow Color', type: 'color',   defaultValue: '#000000', textStyleOverride: true },
    { name: 'bgBox',       label: 'Background Box', type: 'select', textStyleOverride: true,
      options: [
        { label: 'None',       value: 'none' },
        { label: 'Wrap text',  value: 'wrap' },
        { label: 'Full width', value: 'full-width' },
      ], defaultValue: 'none' },
    { name: 'bgColor',     label: 'Box Color',      type: 'color',   defaultValue: '#000000', textStyleOverride: true },
    { name: 'bgOpacity',   label: 'Box Opacity (%)',type: 'range',   min: 0, max: 100, defaultValue: 60, textStyleOverride: true },
    { name: 'bgPadding',   label: 'Box Padding (px)',type: 'number', defaultValue: 8, textStyleOverride: true },
    
    { name: 'opacity',     label: 'Overlay Opacity (%)',  type: 'range',  min: 0, max: 100, defaultValue: 100 },
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
    { name: 'blendMode',   label: 'Blend Mode / Mask', type: 'select',
      options: [
        { label: 'Normal', value: 'source-over' },
        { label: 'Multiply', value: 'multiply' },
        { label: 'Screen', value: 'screen' },
        { label: 'Overlay', value: 'overlay' },
        { label: 'Difference', value: 'difference' },
        { label: 'Mask: Cut In', value: 'destination-in' },
        { label: 'Mask: Cut Out', value: 'destination-out' }
      ],
      defaultValue: 'source-over' },
  ],
  apply(ctx, rawP, context) {
    let p = { ...rawP };
    if (p.textStyle && p.textStyle !== 'none') {
        try {
            const settingsStr = localStorage.getItem('ic-global-settings');
            if (settingsStr) {
                const settings = JSON.parse(settingsStr);
                const ts = (settings.textStyles || []).find(s => s.id === p.textStyle);
                if (ts) {
                    p = {
                        font: ts.fontFamily,
                        sizeMode: ts.sizeMode,
                        size: ts.size,
                        color: ts.color,
                        weight: ts.weight,
                        bgBox: ts.bgBox,
                        bgColor: ts.bgColor,
                        bgOpacity: ts.bgOpacity,
                        bgPadding: ts.bgPadding,
                        shadow: ts.shadow,
                        shadowColor: ts.shadowColor,
                        ...rawP
                    };
                }
            }
        } catch(e) {}
    }

    const text = interpolate(p.content || '{{filename}}', context);
    const W = ctx.canvas.width, H = ctx.canvas.height;

    // Resolve base font size
    let size;
    if (p.sizeMode === 'pct-width')  size = Math.max(1, Math.round(W * (p.size || 3) / 100));
    else if (p.sizeMode === 'pct-height') size = Math.max(1, Math.round(H * (p.size || 3) / 100));
    else size = p.size || 32;

    const ox     = p.offsetX ?? 20;
    const oy     = p.offsetY ?? 20;
    const maxW   = W - (ox * 2); // Keep padding on both edges

    ctx.save();
    ctx.globalAlpha = (p.opacity ?? 100) / 100;
    ctx.globalCompositeOperation = p.blendMode || 'source-over';
    
    let currentSize = size;
    ctx.font = `${p.weight || 400} ${currentSize}px ${p.font || 'Inter'}, sans-serif`;
    ctx.textBaseline = 'alphabetic';

    const paragraphs = text.split('\n');
    
    // Scale Down: Ensure the longest unbroken word fits within maxW
    let longestWordW = 0;
    for (const pText of paragraphs) {
      const words = pText.split(' ');
      for (const w of words) {
        const wWidth = ctx.measureText(w).width;
        if (wWidth > longestWordW) longestWordW = wWidth;
      }
    }
    
    if (longestWordW > maxW && maxW > 0) {
      const scaleBy = maxW / longestWordW;
      currentSize = Math.floor(currentSize * scaleBy);
      ctx.font = `${p.weight || 400} ${currentSize}px ${p.font || 'Inter'}, sans-serif`;
    }

    // Wrap into lines
    const lines = [];
    for (const pText of paragraphs) {
      const words = pText.split(' ');
      let currentLine = words[0] || '';
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + ' ' + word;
        if (ctx.measureText(testLine).width > maxW) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);
    }

    const metrics = ctx.measureText('M');
    const ascent  = metrics.actualBoundingBoxAscent  || currentSize;
    const descent = metrics.actualBoundingBoxDescent || currentSize * 0.2;
    const lineHeight = ascent + descent + (currentSize * 0.2);
    
    const blockHeight = (lines.length * lineHeight) - (currentSize * 0.2);
    
    let tw = 0;
    const lineMetrics = [];
    for (const line of lines) {
      const lw = ctx.measureText(line).width;
      if (lw > tw) tw = lw;
      lineMetrics.push({ text: line, width: lw });
    }

    const anchor = p.anchor || 'bottom-right';
    const [va, ha]   = anchor.split('-');
    const hPart      = ha || va;

    // Horizontal block origin
    let blockX;
    if (anchor === 'center' || hPart === 'center') blockX = (W - tw) / 2;
    else if (hPart === 'right') blockX = W - tw - ox;
    else blockX = ox;

    // Vertical block origin
    let blockY;
    if (anchor === 'center' || va === 'center') blockY = (H - blockHeight) / 2;
    else if (va === 'bottom') blockY = H - blockHeight - oy;
    else blockY = oy;

    // -- Setup rendering target --
    const isMask = p.blendMode === 'destination-in' || p.blendMode === 'destination-out';
    let targetCtx = ctx;
    let tmpCanvas = null;
    
    if (isMask) {
      // Render text to an offscreen buffer first so the mask applies simultaneously
      tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = W; 
      tmpCanvas.height = H;
      targetCtx = tmpCanvas.getContext('2d');
      targetCtx.font = ctx.font;
      targetCtx.textBaseline = ctx.textBaseline;
    }

    // ── Background box ──────────────────────────────────
    const bgBox = p.bgBox || 'none';
    const pad   = p.bgPadding ?? 8;
    if (bgBox !== 'none' && p.bgColor) {
      targetCtx.save();
      targetCtx.globalAlpha    = (p.bgOpacity ?? 60) / 100;
      targetCtx.globalCompositeOperation = 'source-over';
      targetCtx.shadowColor    = 'transparent';
      targetCtx.fillStyle      = p.bgColor;

      const boxY = blockY - pad;
      const boxH = blockHeight + pad * 2;
      if (bgBox === 'full-width') {
        targetCtx.fillRect(0, boxY, W, boxH);
      } else {
        targetCtx.fillRect(blockX - pad, boxY, tw + pad * 2, boxH);
      }
      targetCtx.restore();
    }

    // ── Text ────────────────────────────────────────────
    targetCtx.fillStyle = p.color || '#ffffff';
    if (p.shadow && !isMask) {
      targetCtx.shadowColor   = p.shadowColor || 'rgba(0,0,0,0.6)';
      targetCtx.shadowBlur    = currentSize * 0.3;
      targetCtx.shadowOffsetX = 1;
      targetCtx.shadowOffsetY = 1;
    }
    
    let currentY = blockY + ascent;
    for (const lm of lineMetrics) {
      let lineX;
      if (anchor === 'center' || hPart === 'center') lineX = blockX + (tw - lm.width) / 2;
      else if (hPart === 'right') lineX = blockX + (tw - lm.width);
      else lineX = blockX;
      
      targetCtx.fillText(lm.text, lineX, currentY);
      currentY += lineHeight;
    }
    
    if (isMask) {
      // Apply the composited text layer as a single mask to the original canvas
      ctx.globalCompositeOperation = p.blendMode;
      ctx.drawImage(tmpCanvas, 0, 0);
    }

    ctx.restore();
  }
});

// ─── Watermark ────────────────────────────────────────────
registry.register({
  id: 'overlay-watermark', name: 'Watermark', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'branding_watermark',
  description: 'Repeat a text watermark diagonally across the image.',
  params: [
    { name: 'type',    label: 'Watermark Type', type: 'select',
      options: [{label:'Text', value:'text'}, {label:'Image', value:'image'}], defaultValue: 'text' },
    { name: 'imageUrl',label: 'Image File',  type: 'file',   defaultValue: '' },
    { name: 'repeat',  label: 'Repeat Pattern', type: 'boolean', defaultValue: true },
    { name: 'text',    label: 'Text',        type: 'text',   defaultValue: '© {{filename}}' },
    { name: 'font',    label: 'Font',        type: 'font-select',   defaultValue: 'Inter' },
    { name: 'size',    label: 'Size (px)',   type: 'number', defaultValue: 28 },
    { name: 'color',   label: 'Color',       type: 'color',  defaultValue: '#ffffff' },
    { name: 'opacity', label: 'Opacity (%)', type: 'range',  min: 0, max: 100, defaultValue: 25 },
    { name: 'angle',   label: 'Angle (°)',   type: 'range',  min: -90, max: 90, defaultValue: -35 },
  ],
  async apply(ctx, p, context) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const angle = ((p.angle ?? -35) * Math.PI) / 180;
    ctx.save();
    ctx.globalAlpha = (p.opacity || 25) / 100;
    
    if (p.type === 'image' && p.imageUrl) {
      try {
        const { getAssetUrl } = await import('../../data/assets.js');
        const url = await getAssetUrl(p.imageUrl, context);
        if (url) {
          await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const aspect = img.width / img.height;
              const drawH = p.size || 28;
              const drawW = drawH * aspect;
              const stepX = drawW * 1.5;
              const stepY = drawH * 2.5;
              ctx.translate(W / 2, H / 2);
              ctx.rotate(angle);
              if (p.repeat !== false) {
                 const diagLen = Math.sqrt(W * W + H * H);
                 const countX = Math.ceil(diagLen / stepX) + 2;
                 const countY = Math.ceil(diagLen / stepY) + 2;
                 for (let i = -countX; i <= countX; i++) {
                   for (let j = -countY; j <= countY; j++) {
                     ctx.drawImage(img, i * stepX - drawW / 2, j * stepY - drawH / 2, drawW, drawH);
                   }
                 }
              } else {
                 ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
              }
              resolve();
            };
            img.onerror = resolve;
            img.src = url;
          });
        }
      } catch (e) {
        console.warn('[overlay-watermark] image failed', e);
      }
    } else {
      const text = interpolate(p.text || '© owner', context);
      const size = p.size || 28;
      ctx.font = `${size}px ${p.font || 'Inter'}, sans-serif`;
      ctx.fillStyle = p.color || '#ffffff';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(text).width;
      
      ctx.translate(W / 2, H / 2);
      ctx.rotate(angle);
      if (p.repeat !== false) {
        const step = tw + size * 3;
        const diagLen = Math.sqrt(W * W + H * H);
        const count = Math.ceil(diagLen / step) + 2;
        for (let i = -count; i <= count; i++) {
          for (let j = -count; j <= count; j++) {
            ctx.fillText(text, i * step - tw / 2, j * step);
          }
        }
      } else {
        ctx.fillText(text, -tw / 2, 0);
      }
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
    // Offset translation inwards by sz/2 so rotation keeps it in viewport
    if (pos === 'TR') { ctx.translate(W - sz/2, sz/2); ctx.rotate(Math.PI / 4); }
    else if (pos === 'TL') { ctx.translate(sz/2, sz/2); ctx.rotate(-Math.PI / 4); }
    else if (pos === 'BR') { ctx.translate(W - sz/2, H - sz/2); ctx.rotate(-Math.PI / 4); }
    else { ctx.translate(sz/2, H - sz/2); ctx.rotate(Math.PI / 4); }
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
    { name: 'spacingX',  label: 'Spacing X (px or %)', type: 'text',   defaultValue: '10%' },
    { name: 'spacingY',  label: 'Spacing Y (px or %)', type: 'text',   defaultValue: '10%' },
    { name: 'color',     label: 'Line Color',          type: 'color',  defaultValue: '#ffffff' },
    { name: 'opacity',   label: 'Opacity (%)',         type: 'range',  min: 0, max: 100, defaultValue: 50 },
    { name: 'lineWidth', label: 'Line Width (px)',     type: 'number', defaultValue: 1 },
  ],
  apply(ctx, p) {
    const W       = ctx.canvas.width;
    const H       = ctx.canvas.height;
    
    // Parse px vs % strings
    const parseDim = (val, max) => {
      const s = String(val || '').trim();
      if (s.endsWith('%')) return Math.max(1, Math.round(max * parseFloat(s) / 100));
      return Math.max(1, Math.round(parseFloat(s) || 50));
    };
    const spacingX = parseDim(p.spacingX ?? '10%', W);
    const spacingY = parseDim(p.spacingY ?? '10%', H);

    ctx.save();
    ctx.globalAlpha              = (p.opacity ?? 50) / 100;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle              = p.color || '#ffffff';
    ctx.lineWidth                = Math.max(0.5, p.lineWidth ?? 1);

    ctx.beginPath();
    for (let x = spacingX; x < W; x += spacingX) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = spacingY; y < H; y += spacingY) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
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
    { name: 'size',     label: 'Size (px or %)', type: 'text', defaultValue: '25%' },
    { name: 'opacity',  label: 'Opacity (%)',   type: 'range', min: 0, max: 100, defaultValue: 85 },
    { name: 'anchor',   label: 'Anchor',        type: 'select',
      options: [
        { label: 'Bottom Right (Inside)', value: 'bottom-right' }, 
        { label: 'Bottom Left (Inside)', value: 'bottom-left' },
        { label: 'Top Right (Inside)', value: 'top-right' }, 
        { label: 'Top Left (Inside)', value: 'top-left' },
        { label: 'Outside Bounds - Left', value: 'outside-left' },
        { label: 'Outside Bounds - Right', value: 'outside-right' },
        { label: 'Outside Bounds - Top', value: 'outside-top' },
        { label: 'Outside Bounds - Bottom', value: 'outside-bottom' },
      ],
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
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const margin = p.margin ?? 16;
    const anchor = p.anchor || 'bottom-right';

    const parseBlockDim = (val, originalSize, isOutside) => {
      const s = String(val || '').trim();
      if (s.endsWith('%')) {
        let p = parseFloat(s) / 100;
        if (isOutside) {
          p = Math.max(0.01, Math.min(0.95, p)); // Cap at 95%
          // If we want the block to be p% of the FINAL size, block = original * (p / (1 - p))
          return Math.max(1, Math.round(originalSize * (p / (1 - p))));
        } else {
          return Math.max(1, Math.round(originalSize * p));
        }
      }
      // Fixed px value
      const valNum = parseFloat(s) || 256;
      // For fixed pixels, we treat it as map size (so add margins for block size)
      return isOutside ? valNum + margin * 2 : valNum;
    };

    let mapW, mapH;
    let blockW = 0, blockH = 0;

    if (anchor === 'outside-left' || anchor === 'outside-right') {
      blockW = parseBlockDim(p.size ?? '25%', W, true);
      mapW = Math.max(1, blockW - margin * 2);
      mapH = Math.max(1, H - margin * 2);
      blockH = H;
    } else if (anchor === 'outside-top' || anchor === 'outside-bottom') {
      blockH = parseBlockDim(p.size ?? '25%', H, true);
      mapH = Math.max(1, blockH - margin * 2);
      mapW = Math.max(1, W - margin * 2);
      blockW = W;
    } else {
      const minDim = Math.min(W, H);
      mapW = mapH = parseBlockDim(p.size ?? '25%', minDim, false);
    }

    // Extrude canvas for outside anchors
    let drawX = 0, drawY = 0;
    if (anchor.startsWith('outside-')) {
      const orig = document.createElement('canvas');
      orig.width = W; orig.height = H;
      orig.getContext('2d').drawImage(ctx.canvas, 0, 0);

      if (anchor === 'outside-left') {
        ctx.canvas.width = W + blockW;
        ctx.canvas.height = H;
        drawX = blockW;
      } else if (anchor === 'outside-right') {
        ctx.canvas.width = W + blockW;
        ctx.canvas.height = H;
      } else if (anchor === 'outside-top') {
        ctx.canvas.width = W;
        ctx.canvas.height = H + blockH;
        drawY = blockH;
      } else if (anchor === 'outside-bottom') {
        ctx.canvas.width = W;
        ctx.canvas.height = H + blockH;
      }
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(orig, drawX, drawY);
    }

    // Map & Stitching logic
    const exactTileX = (lng + 180) / 360 * Math.pow(2, zoom);
    const exactTileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
    
    const centerPxX = exactTileX * 256;
    const centerPxY = exactTileY * 256;

    const minPxX = centerPxX - mapW / 2;
    const minPxY = centerPxY - mapH / 2;
    const maxPxX = centerPxX + mapW / 2;
    const maxPxY = centerPxY + mapH / 2;

    const minTileX = Math.floor(minPxX / 256);
    const maxTileX = Math.floor(maxPxX / 256);
    const minTileY = Math.floor(minPxY / 256);
    const maxTileY = Math.floor(maxPxY / 256);

    const numTiles = (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);
    if (numTiles > 100) {
      console.warn(`[overlay-map] Refusing to fetch ${numTiles} tiles (too large or zoomed in too much).`);
      return;
    }

    try {
      const mapCanvas = document.createElement('canvas');
      mapCanvas.width = mapW;
      mapCanvas.height = mapH;
      const mCtx = mapCanvas.getContext('2d');
      mCtx.fillStyle = '#f0eedf'; // Default OSM land color
      mCtx.fillRect(0, 0, mapW, mapH);

      const fetchTile = async (tx, ty) => {
        const url = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
        try {
          const resp = await fetch(url, { headers: { 'User-Agent': 'ImageChef/1.0' } });
          if (!resp.ok) return null;
          const blob = await resp.blob();
          const img = await createImageBitmap(blob);
          return { tx, ty, img };
        } catch { return null; }
      };

      const tasks = [];
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        for (let ty = minTileY; ty <= maxTileY; ty++) {
          tasks.push(fetchTile(tx, ty));
        }
      }

      const results = await Promise.all(tasks);
      for (const res of results) {
        if (!res) continue;
        const tileDrawX = (res.tx * 256) - minPxX;
        const tileDrawY = (res.ty * 256) - minPxY;
        mCtx.drawImage(res.img, tileDrawX, tileDrawY, 256, 256);
        if (res.img.close) res.img.close();
      }

      // Draw map pin at the exact center
      const pinX = mapW / 2;
      const pinY = mapH / 2;
      
      const pinScale = Math.max(0.5, Math.min(mapW, mapH) / 256);
      mCtx.save();
      mCtx.translate(pinX, pinY);
      mCtx.scale(pinScale, pinScale);
      
      mCtx.beginPath();
      mCtx.moveTo(0, 0); // bottom tip
      mCtx.bezierCurveTo(-10, -10, -15, -20, -15, -30);
      mCtx.arc(0, -30, 15, Math.PI, 0);
      mCtx.bezierCurveTo(15, -20, 10, -10, 0, 0);
      
      mCtx.shadowColor = 'rgba(0,0,0,0.5)';
      mCtx.shadowBlur = 4;
      mCtx.shadowOffsetX = 0;
      mCtx.shadowOffsetY = 2;
      mCtx.fillStyle = '#ea4335';
      mCtx.fill();
      
      mCtx.shadowColor = 'transparent';
      mCtx.lineWidth = 2;
      mCtx.strokeStyle = '#ffffff';
      mCtx.stroke();
      
      mCtx.beginPath();
      mCtx.arc(0, -30, 6, 0, Math.PI * 2);
      mCtx.fillStyle = '#5c100b';
      mCtx.fill();
      mCtx.restore();

      // Composite map onto the main canvas
      let x, y;
      if (anchor === 'outside-left') {
         x = margin; y = margin;
      } else if (anchor === 'outside-right') {
         x = W + margin; y = margin;
      } else if (anchor === 'outside-top') {
         x = margin; y = margin;
      } else if (anchor === 'outside-bottom') {
         x = margin; y = H + margin;
      } else {
         x = anchor.includes('right') ? W - mapW - margin : margin;
         y = anchor.includes('bottom') ? H - mapH - margin : margin;
      }

      ctx.save();
      ctx.globalAlpha = (p.opacity ?? 85) / 100;
      ctx.drawImage(mapCanvas, x, y, mapW, mapH);
      ctx.restore();

    } catch (err) {
      console.warn('[overlay-map] map generation failed:', err);
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

// ─── Polaroid Frame ───────────────────────────────────────
registry.register({
  id: 'overlay-polaroid-frame', name: 'Polaroid Frame',
  category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'photo_camera',
  description: 'Adds a polaroid-style white border with optional handwritten caption in the bottom margin.',
  params: [
    { name: 'borderColor',  label: 'Border Color',       type: 'color',  defaultValue: '#f5f5f0' },
    { name: 'borderSide',   label: 'Side Border (px)',   type: 'number', defaultValue: 20 },
    { name: 'borderBottom', label: 'Bottom Border (px)', type: 'number', defaultValue: 60 },
    { name: 'caption',      label: 'Caption ({{vars}} supported)', type: 'text', defaultValue: '{{filename | sanitized}}' },
  ],
  async apply(ctx, p, context) {
    const W           = ctx.canvas.width, H = ctx.canvas.height;
    const side        = Math.max(0, Math.round(p.borderSide   ?? 20));
    const bottom      = Math.max(0, Math.round(p.borderBottom ?? 60));
    const borderColor = p.borderColor || '#f5f5f0';
    const captionText = interpolate(p.caption ?? '{{filename | sanitized}}', context);

    // Snapshot original image
    const orig = document.createElement('canvas');
    orig.width = W; orig.height = H;
    orig.getContext('2d').drawImage(ctx.canvas, 0, 0);

    const newW = W + side * 2;
    const newH = H + side + bottom;

    ctx.canvas.width  = newW;
    ctx.canvas.height = newH;
    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, newW, newH);
    ctx.drawImage(orig, side, side);

    if (captionText) {
      // Load Dancing Script (same guard as compositor.js)
      let fontName = 'cursive';
      if (typeof document !== 'undefined' && document.fonts) {
        try {
          if (!document.querySelector('link[data-gfont="dancing-script"]')) {
            const link = document.createElement('link');
            link.rel  = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap';
            link.dataset.gfont = 'dancing-script';
            document.head.appendChild(link);
          }
          await document.fonts.load('600 16px "Dancing Script"');
          fontName = 'Dancing Script';
        } catch { /* fall back to cursive */ }
      }

      const captionY = H + side + bottom / 2;
      const maxW     = newW - side * 2;
      let size       = Math.round(Math.min(bottom * 0.42, (bottom - 8) * 0.8));

      ctx.save();
      ctx.fillStyle    = '#2a2a2a';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      while (size >= 8) {
        ctx.font = `600 ${size}px "${fontName}", cursive`;
        if (ctx.measureText(captionText).width <= maxW) break;
        size--;
      }
      ctx.fillText(captionText, newW / 2, captionY);
      ctx.restore();
    }
  }
});

// ─── Scanlines ────────────────────────────────────────────
registry.register({
  id: 'overlay-scanlines', name: 'Scanlines',
  category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'horizontal_rule',
  description: 'Draw horizontal scanlines at regular intervals — CRT monitor / video effect.',
  params: [
    { name: 'spacing', label: 'Line Spacing (px)', type: 'number', defaultValue: 3 },
    { name: 'opacity', label: 'Opacity (%)',        type: 'range',  min: 0, max: 100, defaultValue: 20 },
    { name: 'color',   label: 'Line Color',         type: 'color',  defaultValue: '#000000' },
  ],
  apply(ctx, p) {
    const W       = ctx.canvas.width, H = ctx.canvas.height;
    const spacing = Math.max(1, Math.round(p.spacing ?? 3));
    const opacity = (p.opacity ?? 20) / 100;

    ctx.save();
    ctx.globalAlpha              = opacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle                = p.color || '#000000';
    for (let y = 0; y < H; y += spacing) ctx.fillRect(0, y, W, 1);
    ctx.restore();
  }
});

// ─── Template Frame ───────────────────────────────────────
registry.register({
  id: 'overlay-template', name: 'Template Frame',
  category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'wallpaper',
  description: 'Draw a Template around the current image. The image is seamlessly warped to fit the primary slot.',
  params: [
    { name: 'templateId', label: 'Template', type: 'template-select', defaultValue: '' }
  ],
  async apply(ctx, p) {
    if (!p.templateId) return;
    
    let storedTpl;
    try {
      const { getTemplate } = await import('../../data/templates.js');
      storedTpl = await getTemplate(p.templateId);
    } catch { /* ignore if not in worker with DB or template missing */ }
    if (!storedTpl) {
      console.warn(`[overlay-template] Template ${p.templateId} not found`);
      return;
    }

    let bgBitmap = null;
    if (storedTpl.backgroundBlob) {
      bgBitmap = await createImageBitmap(storedTpl.backgroundBlob);
    }

    const w = storedTpl.width || 1920;
    const h = storedTpl.height || 1080;

    // Save the input image (ctx is the current canvas)
    let sourceWidth = ctx.canvas.width;
    let sourceHeight = ctx.canvas.height;
    
    const tmp = document.createElement('canvas');
    tmp.width = sourceWidth;
    tmp.height = sourceHeight;
    tmp.getContext('2d').drawImage(ctx.canvas, 0, 0);

    // Expand canvas to template size
    ctx.canvas.width = w;
    ctx.canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    // Draw Background
    if (bgBitmap) {
      ctx.drawImage(bgBitmap, 0, 0, w, h);
      bgBitmap.close?.();
    }

    // Get the first slot (primary photo hole)
    const slots = storedTpl.placeholders || [];
    if (slots.length > 0) {
      const slot = slots.sort((a,b) => (a.zIndex||0) - (b.zIndex||0))[0];
      
      const quad = slot.points.map(pt => ({
        x: pt.x * w,
        y: pt.y * h
      }));

      const { drawPerspectiveCell } = await import('../utils/perspective.js');
      drawPerspectiveCell(ctx, tmp, quad, 12);
    }
  }
});

// ─── Device Mockup ──────────────────────────────────────────
registry.register({
  id: 'overlay-device-mockup', name: 'Device Mockup',
  category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'devices',
  description: 'Wrap your image realistically inside a physical device frame with dynamic bezels and glare.',
  params: [
    { name: 'family', label: 'Device Family', type: 'device-family-select', defaultValue: '' },
    { name: 'model', label: 'Device Model', type: 'device-model-select', defaultValue: '' },
    { name: 'variant', label: 'Color Variant', type: 'device-variant-select', defaultValue: '' },
  ],
  async apply(ctx, p, context) {
    if (!p.family || !p.model || !p.variant) return;

    let deviceData = null;
    try {
      const MASTER_URL = 'https://raw.githubusercontent.com/jonnyjackson26/device-frames-media/main/device-frames-output/index.json';
      const resp = await fetch(MASTER_URL);
      const data = await resp.json();
      deviceData = data?.[p.family]?.[p.model]?.[p.variant];
    } catch(e) {
      context?.log?.('warn', `Failed to load device index.json: ${e.message}`);
    }

    if (!deviceData) {
      context?.log?.('warn', `Could not locate mockup metadata for ${p.family} > ${p.model} > ${p.variant}`);
      return;
    }

    const { frameSize, screen, frame, mask } = deviceData;

    try {
      // Fetch the frame and mask images concurrently using createImageBitmap (safe for Web Workers)
      const [imgFrame, imgMask] = await Promise.all([
        fetch(frame).then(r => r.blob()).then(createImageBitmap),
        fetch(mask).then(r => r.blob()).then(createImageBitmap)
      ]);

      // Save user's source image to a temporary canvas
      const srcW = ctx.canvas.width;
      const srcH = ctx.canvas.height;
      const tmpSrc = document.createElement('canvas');
      tmpSrc.width = srcW;
      tmpSrc.height = srcH;
      tmpSrc.getContext('2d').drawImage(ctx.canvas, 0, 0);

      // Resize main canvas to the device frame size
      ctx.canvas.width = frameSize.width;
      ctx.canvas.height = frameSize.height;
      ctx.clearRect(0, 0, frameSize.width, frameSize.height);

      // Offscreen compositing buffer
      const buffer = document.createElement('canvas');
      buffer.width = frameSize.width;
      buffer.height = frameSize.height;
      const bCtx = buffer.getContext('2d');

      // 1. Draw source image scaled 'cover' fit into the screen bounds
      const scale = Math.max(screen.width / srcW, screen.height / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;

      const offsetDrawX = screen.x + (screen.width - drawW) / 2;
      const offsetDrawY = screen.y + (screen.height - drawH) / 2;
      bCtx.drawImage(tmpSrc, offsetDrawX, offsetDrawY, drawW, drawH);

      // 2. Process Mask (handles both Alpha-channel masks and Luma/B&W masks)
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = frameSize.width;
      maskCanvas.height = frameSize.height;
      const mCtx = maskCanvas.getContext('2d');
      mCtx.drawImage(imgMask, 0, 0, frameSize.width, frameSize.height);
      const maskData = mCtx.getImageData(0, 0, frameSize.width, frameSize.height);
      
      let hasAlpha = false;
      for (let i = 0; i < maskData.data.length; i += 40) {
        if (maskData.data[i + 3] < 255) { hasAlpha = true; break; }
      }
      if (!hasAlpha) {
        // Convert Luma (grayscale) to Alpha: assumes white=keep, black=drop
        for (let i = 0; i < maskData.data.length; i += 4) {
           maskData.data[i + 3] = maskData.data[i]; 
        }
        mCtx.putImageData(maskData, 0, 0);
      }

      // Clip the screenshot using the processed mask
      bCtx.globalCompositeOperation = 'destination-in';
      bCtx.drawImage(maskCanvas, 0, 0, frameSize.width, frameSize.height);

      // 3. Reset composite and overlay the phone frame on top
      bCtx.globalCompositeOperation = 'source-over';
      bCtx.drawImage(imgFrame, 0, 0, frameSize.width, frameSize.height);

      // Finally, paint the buffer to the main canvas
      ctx.drawImage(buffer, 0, 0);

      // Free bitmaps
      imgFrame.close?.();
      imgMask.close?.();

    } catch (err) {
      context?.log?.('error', `Error compositing images: ${err.message}`);
    }
  }
});

// ─── Native HTML Timer (SVG ForeignObject) ────────────────
registry.register({
  id: 'overlay-timer', name: 'Animated Timer (HTML)', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'timer',
  description: 'Render a buttery-smooth live countdown or countup timer using DOM-to-Canvas via SVG foreignObject.',
  params: [
     { name: 'mode',          label: 'Mode',     type: 'select', options: [ { label: 'Countdown', value: 'countdown' }, { label: 'Count Up', value: 'countup' } ], defaultValue: 'countdown' },
     { name: 'duration',      label: 'Duration (sec)',  type: 'number', defaultValue: 30 },
     { name: 'startOffset',   label: 'Video Start Time',type: 'number', defaultValue: 0 },
     { name: 'visualization', label: 'Visualization',   type: 'select', options: [ { label: 'Text Only', value: 'text' }, { label: 'Circle Progress', value: 'circle' } ], defaultValue: 'circle' },
     { name: 'anchor',        label: 'Anchor',          type: 'select', options: [ { label: 'Top Left', value: 'top-left' }, { label: 'Top Right', value: 'top-right' }, { label: 'Bottom Left', value: 'bottom-left' }, { label: 'Bottom Right', value: 'bottom-right' }, { label: 'Center', value: 'center' } ], defaultValue: 'bottom-right' },
     { name: 'offsetX',       label: 'Offset X (px)',   type: 'number', defaultValue: 60 },
     { name: 'offsetY',       label: 'Offset Y (px)',   type: 'number', defaultValue: 60 },
     { name: 'size',          label: 'Timer Size (px)', type: 'number', defaultValue: 120 },
     { name: 'color',         label: 'Accent Color',    type: 'color',  defaultValue: '#ff3366' },
     { name: 'bgColor',       label: 'Background',      type: 'color',  defaultValue: 'rgba(0,0,0,0.5)' },
  ],
  async apply(ctx, p, context) {
     const W = ctx.canvas.width;
     const H = ctx.canvas.height;
     
     const ts = context.timestampSec || 0;
     const timerStartSec = p.startOffset || 0;
     const dur = p.duration || 30;
     
     const elapsed = Math.max(0, ts - timerStartSec);
     let MathTimeLeft = dur - elapsed;
     let displayTime = p.mode === 'countup' ? elapsed : MathTimeLeft;
     displayTime = Math.max(0, Math.min(dur, displayTime));
     
     const m = Math.floor(displayTime / 60);
     const s = Math.floor(displayTime % 60);
     const str = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
     
     let progress = p.mode === 'countdown' ? (Math.max(0, MathTimeLeft) / dur) : (Math.min(elapsed, dur) / dur);
     
     // Layout mapping
     const anchor = p.anchor || 'bottom-right';
     let alignItems = 'flex-end', justifyContent = 'flex-end';
     if (anchor === 'top-left')     { alignItems = 'flex-start'; justifyContent = 'flex-start'; }
     else if (anchor === 'top-right')    { alignItems = 'flex-start'; justifyContent = 'flex-end'; }
     else if (anchor === 'bottom-left')  { alignItems = 'flex-end';   justifyContent = 'flex-start'; }
     else if (anchor === 'center')       { alignItems = 'center';     justifyContent = 'center'; }
     
     const ox = p.offsetX ?? 60;
     const oy = p.offsetY ?? 60;
     const sz = p.size ?? 120;
     const color = p.color || '#ff3366';
     const bg = p.bgColor || 'rgba(0,0,0,0.5)';
     
     let innerHtml = '';
     
     if (p.visualization === 'text') {
         // Text pill visualization
         innerHtml = `
            <div style="background-color: ${bg}; color: ${color}; font-family: 'Inter', monospace; font-size: ${sz * 0.4}px; font-weight: bold; padding: ${sz * 0.15}px ${sz * 0.3}px; border-radius: ${sz * 0.1}px; border: 2px solid ${color};">
              ${str}
            </div>
         `;
     } else {
         // Circle progress visualization
         const circPerimeter = 2 * Math.PI * 40;
         const dashOffset = circPerimeter * (1 - progress);
         innerHtml = `
           <div style="position: relative; width: ${sz}px; height: ${sz}px; border-radius: 50%; background-color: ${bg}; display: flex; align-items: center; justify-content: center;">
             <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: rotate(-90deg);" viewBox="0 0 100 100">
               <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="8"></circle>
               <circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="8" stroke-dasharray="${circPerimeter}" stroke-dashoffset="${dashOffset}" stroke-linecap="round"></circle>
             </svg>
             <span style="font-family: 'Inter', monospace; font-size: ${sz * 0.25}px; font-weight: bold; color: #ffffff; z-index: 2; margin-left: 2px;">${str}</span>
           </div>
         `;
     }
     
     const svg = `
       <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
         <foreignObject width="100%" height="100%">
           <div xmlns="http://www.w3.org/1999/xhtml" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: ${alignItems}; justify-content: ${justifyContent}; box-sizing: border-box; padding: ${oy}px ${ox}px;">
             ${innerHtml}
           </div>
         </foreignObject>
       </svg>
     `;
     
     const dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.trim())));
     
     await new Promise((resolve) => {
         const img = new Image();
         img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); };
         img.onerror = () => resolve();
         img.src = dataUri;
     });
  }
});

// ─── Native HTML Rich Block (SVG ForeignObject) ─────────────
registry.register({
  id: 'overlay-html-block', name: 'Raw HTML & Styles', category: 'Overlays & Typography', categoryKey: 'video-effect',
  icon: 'html',
  description: 'Inject direct HTML strings with inline CSS styling directly onto the visual canvas. Supports multiple paragraphs, layout tags, and absolute positioning constraints. Natively leverages timeRange to act as an insertable title card when Freeze logic is enabled.',
  params: [
     { name: 'htmlContent',    label: 'HTML Content',     type: 'textarea', defaultValue: '<div style="color: white; font-size: 64px; text-align: center; margin-top: 100px;">\\n  Hello <b>World</b>\\n</div>' },
     { name: 'fontFamily',     label: 'Base Font Family', type: 'font-select', defaultValue: 'Inter' },
     { name: 'globalScale',    label: 'Global Font Scale',type: 'range', min: 0.5, max: 4, step: 0.1, defaultValue: 1 },
     { name: 'justifyLayout',  label: 'Box Justification',type: 'select', options: [ { label: 'Top Left', value: 'flex-start,flex-start' }, { label: 'Center', value: 'center,center' }, { label: 'Stretch', value: 'stretch,stretch' } ], defaultValue: 'flex-start,flex-start' },
  ],
  async applyPerFrame(ctx, p, context) {
     const W = ctx.canvas.width;
     const H = ctx.canvas.height;
     
     const interpolatedHTML = interpolate(p.htmlContent || '', context);
     if (!interpolatedHTML) return; // Silent skip if empty
     
     const [alignItems, justifyContent] = (p.justifyLayout || 'flex-start,flex-start').split(',');
     
     const svg = `
       <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
         <foreignObject width="100%" height="100%">
           <div xmlns="http://www.w3.org/1999/xhtml" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: ${alignItems}; justify-content: ${justifyContent}; box-sizing: border-box; font-family: ${p.fontFamily || 'Inter'}; transform: scale(${p.globalScale || 1}); transform-origin: top left; padding: 20px;">
             ${interpolatedHTML}
           </div>
         </foreignObject>
       </svg>
     `;
     
     const dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.trim())));
     
     await new Promise((resolve) => {
         const img = new Image();
         img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); };
         img.onerror = () => resolve();
         img.src = dataUri;
     });
  }
});

// ─── Native Subtitles (SRT/VTT to SVG) ───────────────────────
registry.register({
  id: 'overlay-subtitles', name: 'Add Subtitles (.SRT)', category: 'Overlays & Typography', categoryKey: 'video-effect',
  icon: 'subtitles',
  description: 'Dynamically parses external SRT or WEBVTT subtitle tracks and stamps active captions over the video at their specified timestamps.',
  params: [
     { name: 'subtitleFile',   label: 'Subtitle Track (.srt / .vtt)', type: 'file-text', accept: '.srt,.vtt,.txt' },
     { name: 'fontFamily',     label: 'Font Family',      type: 'font-select', defaultValue: 'Inter' },
     { name: 'fontSize',       label: 'Base Font Size',   type: 'range', min: 16, max: 200, step: 2, defaultValue: 48 },
     { name: 'textColor',      label: 'Default Text Color',type: 'color', defaultValue: '#ffffff' },
     { name: 'speaker1Color',  label: '[Speaker 1] Color',type: 'color', defaultValue: '#3b82f6' },
     { name: 'speaker2Color',  label: '[Speaker 2] Color',type: 'color', defaultValue: '#f472b6' },
     { name: 'speaker3Color',  label: '[Speaker 3] Color',type: 'color', defaultValue: '#22c55e' },
     { name: 'outlineColor',   label: 'Outline / Shadow Color', type: 'color', defaultValue: '#000000' },
     { name: 'boxBgColor',     label: 'Box Background Color', type: 'color', defaultValue: '#000000' },
     { name: 'boxBgOpacity',   label: 'Box Opacity',      type: 'range', min: 0, max: 1, step: 0.1, defaultValue: 0 },
     { name: 'bottomOffset',   label: 'Bottom Padding (px)', type: 'range', min: 0, max: 300, step: 10, defaultValue: 60 },
  ],
  async applyPerFrame(ctx, p, context) {
     const rawSubtitleParam = interpolate(p.subtitleFile || '', context);
     if (!rawSubtitleParam) return;
     
     let subs = _sharedSubtitleCache.get(rawSubtitleParam);
     if (!subs) {
         try {
             let rawText = rawSubtitleParam;
             if (rawText.trim().startsWith('http://') || rawText.trim().startsWith('https://')) {
                  rawText = await fetch(rawText.trim()).then(r => r.text());
             }
             const { parseSubtitles } = await import('../../utils/subtitles.js');
             subs = parseSubtitles(rawText);
             _sharedSubtitleCache.set(rawSubtitleParam, subs);
         } catch (err) {
             console.error('[overlay-subtitles] Failed to fetch or parse subtitles:', err);
             _sharedSubtitleCache.set(rawSubtitleParam, []); 
             return;
         }
     }
     
     if (subs.length === 0) return;
     
     // Find the subtitle that is currently active for this timestamp
     // Note: video-convert passes timestampSec exactly on each frame.
     const ts = context.timestampSec || 0;
     const activeSubs = subs.filter(sub => ts >= sub.start && ts <= sub.end);
     
     if (activeSubs.length === 0) return;
     
     const W = ctx.canvas.width;
     const H = ctx.canvas.height;
     
     // Build stacked string if multiple overlaps exist in SRT
     let escapedText = activeSubs.map(s => s.text.replace(/&/g, '&amp;').replace(/\\n/g, '<br/>').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('<br/>');
     
     // Detect Speaker Tags and adjust color
     let textCol = p.textColor || '#ffffff';
     const speakerMatch = escapedText.match(/^\[Speaker\s*(\d+)\]/i);
     if (speakerMatch) {
         // Trim the label from the start of the visible text
         escapedText = escapedText.replace(/^\[Speaker\s*\d+\]\s*:?\s*/i, '');
         const num = speakerMatch[1];
         if (num === '1') textCol = p.speaker1Color || '#3b82f6';
         else if (num === '2') textCol = p.speaker2Color || '#f472b6';
         else if (num === '3') textCol = p.speaker3Color || '#22c55e';
     }
     
     // Native Netflix-style text shadow dropshadow rendering
     const shadowCol = p.outlineColor || '#000000';
     const fSize     = p.fontSize || 48;
     
     // Box Background
     let bgCSS = '';
     if ((p.boxBgOpacity ?? 0) > 0) {
         const hex = (p.boxBgColor || '#000000').replace('#', '');
         const bigint = parseInt(hex.length === 3 ? hex.split('').map(x=>x+x).join('') : hex, 16);
         const r = (bigint >> 16) & 255;
         const g = (bigint >> 8) & 255;
         const b = bigint & 255;
         bgCSS = `background-color: rgba(${r}, ${g}, ${b}, ${p.boxBgOpacity}); padding: 12px 24px; border-radius: 8px;`;
     }
     
     // We use multiple hard shadows to mimic a stroke
     const shadowCSS = `
       2px 2px 0 ${shadowCol}, -1px -1px 0 ${shadowCol},
       1px -1px 0 ${shadowCol}, -1px 1px 0 ${shadowCol},
       1px 1px 0 ${shadowCol}, 0 2px 0 ${shadowCol},
       2px 0 0 ${shadowCol}, 0 -1px 0 ${shadowCol},
       -1px 0 0 ${shadowCol}, 0 3px 6px rgba(0,0,0,0.5)
     `.trim();
     
     const svg = `
       <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
         <foreignObject width="100%" height="100%">
           <div xmlns="http://www.w3.org/1999/xhtml" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; box-sizing: border-box; padding-bottom: ${p.bottomOffset ?? 60}px;">
             <div style="font-family: ${p.fontFamily || 'Inter'}; font-size: ${fSize}px; font-weight: 700; color: ${textCol}; text-shadow: ${shadowCSS}; text-align: center; max-width: 80%; line-height: 1.3; ${bgCSS}">
               ${escapedText}
             </div>
           </div>
         </foreignObject>
       </svg>
     `;

     const cacheKey = btoa(unescape(encodeURIComponent(escapedText + W + H + textCol + fSize + (p.bottomOffset ?? 60))));
     if (!context._subtitleImageCache) context._subtitleImageCache = new Map();
     
     let img = context._subtitleImageCache.get(cacheKey);
     if (!img) {
         const dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.trim())));
         img = new Image();
         await new Promise((resolve) => {
             img.onload = resolve;
             img.onerror = resolve;
             img.src = dataUri;
         });
         context._subtitleImageCache.set(cacheKey, img);
     }
     
     if (img.width > 0) {
         ctx.drawImage(img, 0, 0);
     }
  }
});

// ─── Craquelure (paint crack network) ─────────────────────
// Procedural craquelure mask built from a low-resolution Voronoi /
// distance-to-second-nearest-seed pattern. The thin ridges produced by
// `|d2 - d1| < ε` give the brittle, organic crack network you see on
// aged paintings. The mask is upscaled with smoothing and composited
// over the image with the chosen blend mode (multiply by default) for
// the right "dark veins on top of pigment" effect.
//
// Density controls the average cell size (smaller = finer cracks);
// thickness widens the ridge band; intensity is the overlay opacity.
registry.register({
  id: 'overlay-craquelure', name: 'Craquelure', category: 'Overlays & Typography', categoryKey: 'overlay',
  icon: 'shatter',
  description: 'Procedural fine-crack network. Mimics the surface texture of an aged oil painting (cracked varnish / paint layer).',
  params: [
    { name: 'intensity',  label: 'Intensity (%)',        type: 'range',   min: 0,  max: 100, defaultValue: 35 },
    { name: 'density',    label: 'Density',              type: 'range',   min: 30, max: 600, defaultValue: 220 },
    { name: 'thickness',  label: 'Crack Thickness',      type: 'range',   min: 1,  max: 8,   defaultValue: 2 },
    { name: 'darkness',   label: 'Crack Darkness (%)',   type: 'range',   min: 0,  max: 100, defaultValue: 70 },
    { name: 'seed',       label: 'Seed (0 = random)',    type: 'number',  defaultValue: 0 },
    { name: 'blendMode',  label: 'Blend Mode',           type: 'select',
      options: [
        { label: 'Multiply',   value: 'multiply' },
        { label: 'Overlay',    value: 'overlay' },
        { label: 'Soft Light', value: 'soft-light' },
      ], defaultValue: 'multiply' },
  ],
  apply(ctx, p) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const intensity = Math.max(0, Math.min(1, (p.intensity ?? 35) / 100));
    if (intensity === 0) return;

    const density   = Math.max(10, Math.round(p.density ?? 220));
    const thickness = Math.max(1, Math.min(12, Math.round(p.thickness ?? 2)));
    const darkness  = Math.max(0, Math.min(1, (p.darkness ?? 70) / 100));
    const blendMode = p.blendMode || 'multiply';

    // Deterministic PRNG so a fixed seed reproduces the same crack
    // pattern across renders.
    const seedParam = (p.seed | 0) || ((Math.random() * 0x7fffffff) | 0);
    let s = seedParam >>> 0;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };

    // Render the Voronoi-edge mask at a smaller resolution then upscale —
    // O(W*H*N) at full size would be brutally slow for ~200 seeds.
    // 384px is a sweet spot: detail survives, cost stays bounded.
    const maskMax = 384;
    const sf      = Math.min(1, maskMax / Math.max(W, H));
    const mw      = Math.max(64, Math.round(W * sf));
    const mh      = Math.max(64, Math.round(H * sf));

    // Scatter seeds over a slightly oversized area so cracks reach the
    // edges. Density is "seeds per million mask pixels".
    const seedCount = Math.max(20, Math.round(density * (mw * mh) / 1_000_000));
    const xs = new Float32Array(seedCount);
    const ys = new Float32Array(seedCount);
    for (let i = 0; i < seedCount; i++) {
      xs[i] = rand() * (mw + 40) - 20;
      ys[i] = rand() * (mh + 40) - 20;
    }

    // Spatial bucket so each pixel only checks nearby seeds.
    const bucket = Math.max(8, Math.round(Math.sqrt((mw * mh) / seedCount)));
    const bw = Math.ceil((mw + 40) / bucket);
    const bh = Math.ceil((mh + 40) / bucket);
    const buckets = Array.from({ length: bw * bh }, () => []);
    for (let i = 0; i < seedCount; i++) {
      const bx = Math.min(bw - 1, Math.max(0, Math.floor((xs[i] + 20) / bucket)));
      const by = Math.min(bh - 1, Math.max(0, Math.floor((ys[i] + 20) / bucket)));
      buckets[by * bw + bx].push(i);
    }

    // Build the mask: alpha = how strongly this pixel should darken.
    // The ridge is where the closest two seeds are nearly equidistant
    // (|d2 - d1| < epsilon), tapering smoothly across `thickness`.
    const mask = new Uint8ClampedArray(mw * mh * 4);
    const eps  = thickness;
    for (let y = 0; y < mh; y++) {
      const by = Math.min(bh - 1, Math.max(0, Math.floor((y + 20) / bucket)));
      for (let x = 0; x < mw; x++) {
        const bx = Math.min(bw - 1, Math.max(0, Math.floor((x + 20) / bucket)));

        let d1 = Infinity, d2 = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = by + dy; if (yy < 0 || yy >= bh) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = bx + dx; if (xx < 0 || xx >= bw) continue;
            const list = buckets[yy * bw + xx];
            for (let k = 0; k < list.length; k++) {
              const i = list[k];
              const ddx = xs[i] - x, ddy = ys[i] - y;
              const d = ddx * ddx + ddy * ddy;
              if (d < d1)      { d2 = d1; d1 = d; }
              else if (d < d2) { d2 = d;          }
            }
          }
        }
        const ridge = Math.sqrt(d2) - Math.sqrt(d1);
        // Smoothstep: 1 at ridge=0, 0 at ridge=eps.
        const t = Math.max(0, 1 - ridge / eps);
        const a = (t * t * (3 - 2 * t)) * darkness * 255;
        const o = (y * mw + x) * 4;
        mask[o]     = 0;
        mask[o + 1] = 0;
        mask[o + 2] = 0;
        mask[o + 3] = a;
      }
    }

    // Upscale the mask to the full canvas. Smoothing softens the ridge,
    // which actually helps the crack feel painterly rather than crisp.
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = mw; maskCanvas.height = mh;
    maskCanvas.getContext('2d').putImageData(new ImageData(mask, mw, mh), 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = intensity;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(maskCanvas, 0, 0, W, H);
    ctx.restore();
  }
});

