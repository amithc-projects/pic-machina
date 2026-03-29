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
    { name: 'durationPerSlide', label: 'Duration/Slide (sec)', type: 'number', defaultValue: 2 },
    { name: 'fps',              label: 'FPS',                  type: 'number', defaultValue: 30 },
  ],
  apply() { /* handled by Processor as aggregation node */ }
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
