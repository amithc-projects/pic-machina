/**
 * ImageChef — Flow Control & Export nodes
 * Save/Load state, Export File, Create Video, Create GIF, Contact Sheet.
 * These are handled specially by the Processor — registered here for param definitions only.
 */

import { registry } from '../registry.js';

// ─── Export File ──────────────────────────────────────────
registry.register({
  id: 'flow-export', name: 'Export File', category: 'Flow Control', categoryKey: 'flow',
  icon: 'file_download',
  description: 'Save a snapshot of the current canvas as an image file.',
  params: [
    { name: 'suffix',  label: 'Filename Suffix', type: 'text',   defaultValue: '' },
    { name: 'format',  label: 'Format',          type: 'select',
      options: [
        { label: 'JPEG',  value: 'image/jpeg' },
        { label: 'PNG',   value: 'image/png'  },
        { label: 'WebP',  value: 'image/webp' },
      ],
      defaultValue: 'image/jpeg' },
    { name: 'quality', label: 'Quality (0-100)',  type: 'range', min: 1, max: 100, defaultValue: 90 },
  ],
  apply() { /* handled by Processor */ }
});

// ─── Save/Load State ──────────────────────────────────────
registry.register({
  id: 'flow-save', name: 'Save State', category: 'Flow Control', categoryKey: 'flow',
  icon: 'save',
  description: 'Store the current canvas pixel state for later use.',
  params: [{ name: 'label', label: 'Label', type: 'text', defaultValue: 'state-1' }],
  apply(ctx, p, context) {
    const key = p.label || 'state-1';
    context.variables.set(key, ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
    context.log?.('info', `Saved state "${key}" (${ctx.canvas.width}×${ctx.canvas.height})`);
  }
});

registry.register({
  id: 'flow-load', name: 'Load State', category: 'Flow Control', categoryKey: 'flow',
  icon: 'restore',
  description: 'Restore a previously saved canvas state.',
  params: [{ name: 'label', label: 'Label', type: 'text', defaultValue: 'state-1' }],
  apply(ctx, p, context) {
    const key = p.label || 'state-1';
    const saved = context.variables.get(key);
    if (saved) {
      ctx.canvas.width  = saved.width;
      ctx.canvas.height = saved.height;
      ctx.putImageData(saved, 0, 0);
    }
  }
});

// ─── Create GIF ───────────────────────────────────────────
registry.register({
  id: 'flow-create-gif', name: 'Create GIF', category: 'Flow Control', categoryKey: 'flow',
  icon: 'gif',
  description: 'Collect frames and render an animated GIF at the end of the batch.',
  params: [
    { name: 'filename', label: 'Output Filename', type: 'text',   defaultValue: 'animation.gif' },
    { name: 'delay',    label: 'Frame Delay (ms)', type: 'number', defaultValue: 200 },
    { name: 'loop',     label: 'Loop',             type: 'boolean', defaultValue: true },
  ],
  apply() { /* handled by Processor as aggregation node */ }
});

// ─── Create Video ─────────────────────────────────────────
registry.register({
  id: 'flow-create-video', name: 'Create Video', category: 'Flow Control', categoryKey: 'flow',
  icon: 'movie',
  description: 'Render images as an MP4 slideshow.',
  params: [
    { name: 'filename',         label: 'Output Filename',     type: 'text',   defaultValue: 'slideshow.mp4' },
    { name: 'width',            label: 'Output Width (px)',   type: 'number', defaultValue: 1920 },
    { name: 'height',           label: 'Output Height (px)',  type: 'number', defaultValue: 1080 },
    { name: 'durationPerSlide', label: 'Duration/Slide (sec)', type: 'number', defaultValue: 2 },
    { name: 'fps',              label: 'FPS',                  type: 'number', defaultValue: 30 },
  ],
  apply() { /* handled by Processor as aggregation node */ }
});

// ─── WebGL Video Stitcher ─────────────────────────────────
registry.register({
  id: 'flow-video-stitcher', name: 'WebGL Video Stitcher', category: 'Flow Control', categoryKey: 'flow',
  icon: 'animation',
  description: 'Combine processed images/videos into an advanced timeline using GPU crossfades, wipes, and cinematic motion.',
  params: [
    { name: 'filename',           label: 'Output Filename',           type: 'text',   defaultValue: 'stitcher.mp4' },
    { name: 'width',              label: 'Output Width (px)',         type: 'number', defaultValue: 1920 },
    { name: 'height',             label: 'Output Height (px)',        type: 'number', defaultValue: 1080 },
    { name: 'fps',                label: 'FPS',                       type: 'number', defaultValue: 30 },
    { name: 'durationPerSlide',   label: 'Duration/Slide (sec)',      type: 'number', defaultValue: 3 },
    { name: 'transitionDuration', label: 'Transition Duration (sec)', type: 'number', defaultValue: 1 },
    { name: 'transitionMode',     label: 'Transition Effect',         type: 'select',
      options: [
        { label: 'Crossfade',        value: 'crossfade'  },
        { label: 'Wipe Right',       value: 'wipeRight'  },
        { label: 'Circle Crop Wipe', value: 'circleCrop' },
        { label: 'Pixelize / Glitch',value: 'pixelize'   },
        { label: 'Random Shuffle',   value: 'random'     }
      ],
      defaultValue: 'crossfade' },
    { name: 'motionMode',         label: 'Ken Burns Motion',          type: 'select',
      options: [
        { label: 'None',           value: 'none' },
        { label: 'Zoom In',        value: 'zoom-in'  },
        { label: 'Zoom Out',       value: 'zoom-out' },
        { label: 'Pan Left',       value: 'pan-left' },
        { label: 'Pan Right',      value: 'pan-right' },
        { label: 'Random Mix',     value: 'random'   }
      ],
      defaultValue: 'random' },
  ],
  apply() { /* handled by Processor as aggregation node */ }
});

// ─── Inject Title Slide ───────────────────────────────────
registry.register({
  id: 'flow-title-slide', name: 'Inject Title Slide', category: 'Flow Control', categoryKey: 'flow',
  icon: 'title',
  description: 'Automatically injects a generated title slide into the aggregator stream when a structural variable (like City or Date) changes.',
  params: [
    { name: 'triggerField', label: 'Trigger Field', type: 'text', defaultValue: '{{sidecar.city}}' },
    { name: 'titleTemplate',label: 'Title Text',    type: 'text', defaultValue: '{{sidecar.city}}' },
    { name: 'bgColor',      label: 'Background Color',type: 'color',defaultValue: '#111111' },
    { name: 'bgImage',      label: 'Background File (Optional)', type: 'file', defaultValue: '' },
    { name: 'fontFamily',   label: 'Font Family',   type: 'text', defaultValue: 'Inter' },
    { name: 'fontSize',     label: 'Font Size (px)',type: 'number', defaultValue: 120 },
    { name: 'textColor',    label: 'Text Color',    type: 'color',defaultValue: '#ffffff' },
  ],
  apply() { /* logic handled natively in processor.js eval loop */ }
});

// ─── Contact Sheet ────────────────────────────────────────
registry.register({
  id: 'flow-contact-sheet', name: 'Contact Sheet', category: 'Flow Control', categoryKey: 'flow',
  icon: 'grid_view',
  description: 'Combine images into a single grid sheet.',
  params: [
    { name: 'columns',  label: 'Columns',          type: 'number', defaultValue: 4 },
    { name: 'gap',      label: 'Gap (px)',          type: 'number', defaultValue: 8 },
    { name: 'filename', label: 'Output Filename',   type: 'text',   defaultValue: 'contact-sheet.jpg' },
  ],
  apply() { /* handled by Processor as aggregation node */ }
});

// ─── Photo Stack Animation ────────────────────────────────
registry.register({
  id: 'flow-photo-stack', name: 'Photo Stack Animation', category: 'Flow Control', categoryKey: 'flow',
  icon: 'photo_library',
  description: 'Collect all photos and compose an animated polaroid stack — each photo appears on a desk in sequence. Outputs GIF or MP4.',
  params: [
    { name: 'filename',     label: 'Output Filename',       type: 'text',    defaultValue: 'photo-stack' },
    { name: 'format',       label: 'Output Format',         type: 'select',
      options: [{ label: 'Animated GIF', value: 'gif' }, { label: 'MP4 Video', value: 'mp4' }],
      defaultValue: 'gif' },
    { name: 'width',        label: 'Canvas Width (px)',      type: 'number',  defaultValue: 1920 },
    { name: 'height',       label: 'Canvas Height (px)',     type: 'number',  defaultValue: 1080 },
    { name: 'deskColor',    label: 'Desk Color',             type: 'color',   defaultValue: '#3d2b1a' },
    { name: 'frameDelay',   label: 'Appear Delay (ms)',      type: 'number',  defaultValue: 800 },
    { name: 'maxRotation',  label: 'Max Rotation (°)',       type: 'range',   min: 0, max: 45, defaultValue: 35 },
    { name: 'borderColor',  label: 'Polaroid Frame Color',   type: 'color',   defaultValue: '#f5f5f0' },
    { name: 'borderBottom', label: 'Caption Border (px)',    type: 'number',  defaultValue: 60 },
    { name: 'caption',      label: 'Caption ({{vars}} supported)', type: 'text', defaultValue: '{{filename | sanitized}}' },
    { name: 'overlap',      label: 'Overlap (%)',                  type: 'range', min: 0, max: 90, defaultValue: 0 },
  ],
  apply() { /* handled by Processor as aggregation node */ }
});

// ─── Compose Grid ─────────────────────────────────────────
registry.register({
  id: 'flow-compose-grid', name: 'Compose Grid', category: 'Flow Control', categoryKey: 'flow',
  icon: 'grid_on',
  description: 'Assemble saved canvas states into a grid. Works within a single image — not a batch aggregator.',
  params: [
    { name: 'panels',  label: 'Panel Labels (comma-separated)', type: 'text',   defaultValue: 'panel-1,panel-2,panel-3,panel-4' },
    { name: 'columns', label: 'Columns',                        type: 'number', defaultValue: 2 },
    { name: 'gap',     label: 'Gap (px)',                       type: 'number', defaultValue: 0 },
    { name: 'bgColor', label: 'Background Color',               type: 'color',  defaultValue: '#000000' },
  ],
  apply(ctx, p, context) {
    const labels  = (p.panels || 'panel-1,panel-2,panel-3,panel-4').split(',').map(s => s.trim()).filter(Boolean);
    const columns = Math.max(1, Math.round(p.columns ?? 2));
    const gap     = Math.max(0, Math.round(p.gap ?? 0));
    const bgColor = p.bgColor || '#000000';

    const frames = labels.map(lbl => context.variables.get(lbl)).filter(Boolean);
    if (!frames.length) {
      console.warn('[flow-compose-grid] No panels found in context.variables for labels:', labels);
      return;
    }

    const cellW = frames[0].width;
    const cellH = frames[0].height;
    const rows   = Math.ceil(frames.length / columns);
    const totalW = columns * cellW + (columns - 1) * gap;
    const totalH = rows    * cellH + (rows    - 1) * gap;

    const grid  = document.createElement('canvas');
    grid.width  = totalW;
    grid.height = totalH;
    const gctx  = grid.getContext('2d');
    gctx.fillStyle = bgColor;
    gctx.fillRect(0, 0, totalW, totalH);

    frames.forEach((imageData, idx) => {
      const col = idx % columns;
      const row = Math.floor(idx / columns);
      const x   = col * (cellW + gap);
      const y   = row * (cellH + gap);

      if (imageData.width !== cellW || imageData.height !== cellH) {
        const tmp = document.createElement('canvas');
        tmp.width = imageData.width; tmp.height = imageData.height;
        tmp.getContext('2d').putImageData(imageData, 0, 0);
        gctx.drawImage(tmp, x, y, cellW, cellH);
      } else {
        gctx.putImageData(imageData, x, y);
      }
    });

    ctx.canvas.width  = totalW;
    ctx.canvas.height = totalH;
    ctx.drawImage(grid, 0, 0);
  }
});

// ─── Video Extract Frame ──────────────────────────────────
registry.register({
  id: 'video-extract-frame', name: 'Extract Video Frame', category: 'Flow Control', categoryKey: 'flow',
  icon: 'movie_filter',
  description: 'Seek the input video to a position and draw that frame onto the canvas. Use resize/crop steps after to shape the frame.',
  params: [
    { name: 'atPercent', label: 'Position (%)', type: 'range', min: 0, max: 100, defaultValue: 0 },
  ],
  async apply(ctx, p, context) {
    const file = context.originalFile;
    if (!file) { console.warn('[video-extract-frame] No originalFile in context'); return; }

    const url   = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted   = true;
    video.preload = 'metadata';
    // Must be in DOM for blob URL loading to work reliably in all browsers
    video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px';
    document.body.appendChild(video);

    const withTimeout = (promise, ms, label) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out: ${label}`)), ms)),
    ]);

    try {
      await withTimeout(new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => {
          const code = video.error?.code;
          const msg  = video.error?.message || 'unknown';
          reject(new Error(`Video load failed (code ${code}): ${msg}`));
        };
        video.src = url;
        video.load();
      }), 10_000, 'loadedmetadata');

      const pct  = Math.max(0, Math.min(100, p.atPercent ?? 0));
      const time = pct >= 100
        ? Math.max(0, video.duration - 0.033)
        : (pct / 100) * video.duration;

      await withTimeout(new Promise((resolve, reject) => {
        video.onseeked = resolve;
        video.onerror  = () => reject(new Error(`Seek failed at ${pct}%`));
        video.currentTime = time;
      }), 10_000, `seek to ${pct}%`);

      ctx.canvas.width  = video.videoWidth;
      ctx.canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      context.log?.('info', `Extracted frame at ${p.atPercent ?? 0}% — ${video.videoWidth}×${video.videoHeight} (t=${time.toFixed(2)}s / ${video.duration.toFixed(2)}s)`);
    } finally {
      document.body.removeChild(video);
      URL.revokeObjectURL(url);
    }
  }
});

// ─── GIF from States ──────────────────────────────────────
registry.register({
  id: 'flow-gif-from-states', name: 'GIF from States', category: 'Flow Control', categoryKey: 'flow',
  icon: 'gif_box',
  description: 'Assemble saved canvas states into an animated GIF. Use after a series of Extract Frame → Process → Save State steps.',
  params: [
    { name: 'panels',   label: 'State Labels (comma-separated)', type: 'text',    defaultValue: 'frame-0,frame-25,frame-50,frame-75,frame-100' },
    { name: 'delay',    label: 'Frame Delay (ms)',               type: 'number',  defaultValue: 500 },
    { name: 'loop',     label: 'Loop',                           type: 'boolean', defaultValue: true },
    { name: 'suffix',   label: 'Filename Suffix',                type: 'text',    defaultValue: '_preview' },
  ],
  apply() { /* handled specially by processor.js */ }
});

// ─── Video Wall ───────────────────────────────────────────
registry.register({
  id: 'flow-video-wall', name: 'Video Wall', category: 'Flow Control', categoryKey: 'flow',
  icon: 'view_comfy',
  description: 'Composite multiple input videos into a single grid-layout MP4 (security camera wall style). Inputs are sorted by filename.',
  params: [
    { name: 'filename',         label: 'Output Filename',             type: 'text',   defaultValue: 'video-wall.mp4' },
    { name: 'layout',           label: 'Layout',                      type: 'video-layout-select',
      options: [
        { label: '2×2 Grid (4 videos)',          value: 'grid-2x2'  },
        { label: '3×3 Grid (9 videos)',          value: 'grid-3x3'  },
        { label: '4×4 Grid (16 videos)',         value: 'grid-4x4'  },
        { label: 'Side by Side (2 videos)',      value: 'split-1x2' },
        { label: 'TV Room — Perspective (1 video)', value: 'custom-tv' },
      ],
      defaultValue: 'grid-2x2' },
    { name: 'outputWidth',      label: 'Output Width (px)',           type: 'number', defaultValue: 1920 },
    { name: 'outputHeight',     label: 'Output Height (px)',          type: 'number', defaultValue: 1080 },
    { name: 'fps',              label: 'FPS',                         type: 'number', defaultValue: 30 },
    { name: 'bitrate',          label: 'Bitrate (bps)',               type: 'number', defaultValue: 8000000 },
    { name: 'endOfVideo',       label: 'End-of-Video Behaviour',      type: 'select',
      options: [
        { label: 'Black Frame',    value: 'black' },
        { label: 'Static Image',   value: 'image' },
        { label: 'Text Overlay',   value: 'text'  },
      ],
      defaultValue: 'black' },
    { name: 'endText',          label: 'End-of-Video Text',           type: 'text',   defaultValue: 'No Signal Detected' },
    { name: 'fallbackImageUrl', label: 'Fallback Image URL',          type: 'text',   defaultValue: '' },
    { name: 'captions',         label: 'Cell Captions (comma-separated, ordered by filename)', type: 'text', defaultValue: '' },
  ],
  apply() { /* handled by batch.js as aggregation node */ }
});

// ─── Template Aggregator ──────────────────────────────────
registry.register({
  id: 'flow-template-aggregator', name: 'Template Render', category: 'Flow Control', categoryKey: 'flow',
  icon: 'wallpaper',
  description: 'Composite multiple input images into a pre-defined Perspective Template.',
  params: [
    { name: 'filename',   label: 'Output Filename', type: 'text', defaultValue: 'render.jpg' },
    { name: 'templateId', label: 'Template',        type: 'template-select', defaultValue: '' },
    { name: 'quality',    label: 'Quality (0-100)', type: 'range', min: 1, max: 100, defaultValue: 90 },
  ],
  apply() { /* handled by batch.js as aggregation node */ }
});

// ─── Animate Stack ────────────────────────────────────────
registry.register({
  id: 'flow-animate-stack', name: 'Animate Stack', category: 'Flow Control', categoryKey: 'flow',
  icon: 'layers',
  description: 'Collect frames and animate them appearing on a desk surface one by one. Add overlay-polaroid-frame upstream to get polaroid borders.',
  params: [
    { name: 'filename',    label: 'Output Filename',    type: 'text',   defaultValue: 'stack' },
    { name: 'format',      label: 'Output Format',      type: 'select',
      options: [{ label: 'Animated GIF', value: 'gif' }, { label: 'MP4 Video', value: 'mp4' }],
      defaultValue: 'gif' },
    { name: 'width',       label: 'Canvas Width (px)',  type: 'number', defaultValue: 1920 },
    { name: 'height',      label: 'Canvas Height (px)', type: 'number', defaultValue: 1080 },
    { name: 'deskColor',   label: 'Desk Color',          type: 'color',  defaultValue: '#3d2b1a' },
    { name: 'frameDelay',  label: 'Appear Delay (ms)',   type: 'number', defaultValue: 800 },
    { name: 'maxRotation', label: 'Max Rotation (°)',    type: 'range',  min: 0, max: 45, defaultValue: 35 },
    { name: 'overlap',     label: 'Overlap (%)',          type: 'range',  min: 0, max: 90, defaultValue: 0 },
  ],
  apply() { /* handled by Processor as aggregation node */ }
});
