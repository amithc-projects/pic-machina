/**
 * PicMachina — Per-Frame Video Effect Transforms (Phase 3)
 *
 * Each transform here wraps an existing image effect transform and applies it
 * to every frame of a video via mediabunny's process callback.
 *
 * The `sourceTransformId` field tells processor.js which image transform's
 * apply() function to call per frame. Params are passed through unchanged, so
 * each video transform uses the same param definitions as its source transform.
 *
 * Handled by Processor._runTransformNode (main-thread only — WebCodecs + DOM).
 */

import { registry } from '../registry.js';
import { interpolate } from '../../utils/variables.js';

const COMMON_PARAMS = [
  { name: 'suffix',  label: 'Filename Suffix', type: 'text',   defaultValue: '' },
  { name: 'bitrate', label: 'Bitrate (bps)',   type: 'number', defaultValue: 8000000 },
];

// ─── Colour & Tone Effects ────────────────────────────────

registry.register({
  id: 'video-tuning',
  name: 'Video Tuning',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'tune',
  sourceTransformId: 'color-tuning',
  description: 'Adjust contrast, saturation, vibrance and invert — applied to every video frame.',
  params: [
    { name: 'contrast',   label: 'Contrast',   type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'saturation', label: 'Saturation', type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'vibrance',   label: 'Vibrance',   type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'invert',     label: 'Invert',     type: 'boolean', defaultValue: false },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-duotone',
  name: 'Video Duotone',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'tonality',
  sourceTransformId: 'color-duotone',
  description: 'Replace tones with two colours — applied to every video frame.',
  params: [
    { name: 'darkColor',  label: 'Shadow Color',    type: 'color', defaultValue: '#1a0533' },
    { name: 'lightColor', label: 'Highlight Color', type: 'color', defaultValue: '#e8f4d4' },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-tint',
  name: 'Video Tint',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'format_color_fill',
  sourceTransformId: 'color-tint',
  description: 'Overlay a colour tint over every video frame.',
  params: [
    { name: 'color',     label: 'Tint Color',   type: 'color',  defaultValue: '#ff8800' },
    { name: 'strength',  label: 'Strength (%)', type: 'range',  min: 0, max: 100, defaultValue: 20 },
    { name: 'blendMode', label: 'Blend Mode',   type: 'select',
      options: [
        { label: 'Normal',     value: 'source-over' },
        { label: 'Multiply',   value: 'multiply'    },
        { label: 'Screen',     value: 'screen'      },
        { label: 'Overlay',    value: 'overlay'     },
        { label: 'Soft Light', value: 'soft-light'  },
      ],
      defaultValue: 'source-over' },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-vignette',
  name: 'Video Vignette',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'vignette',
  sourceTransformId: 'color-vignette',
  description: 'Darken the edges of every video frame for a cinematic look.',
  params: [
    { name: 'amount', label: 'Strength (%)',    type: 'range', min: 0, max: 100, defaultValue: 40 },
    { name: 'radius', label: 'Inner Radius (%)', type: 'range', min: 0, max: 100, defaultValue: 65 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

// ─── Filter & Creative Effects ────────────────────────────

registry.register({
  id: 'video-advanced-effects',
  name: 'Video Advanced Effects',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'filter_vintage',
  sourceTransformId: 'filter-advanced',
  description: 'Apply blur, sharpen, film grain, or pixelation to every video frame.',
  params: [
    { name: 'blurRadius',    label: 'Blur Radius (px)',   type: 'range', min: 0, max: 40, defaultValue: 0 },
    { name: 'sharpenAmount', label: 'Sharpen Amount (%)', type: 'range', min: 0, max: 100, defaultValue: 0 },
    { name: 'noiseLevel',    label: 'Noise / Grain (%)',  type: 'range', min: 0, max: 50, defaultValue: 0 },
    { name: 'pixelSize',     label: 'Pixel Size (px)',    type: 'range', min: 1, max: 40, defaultValue: 1 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-bloom',
  name: 'Video Bloom / Glow',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'flare',
  sourceTransformId: 'filter-bloom',
  description: 'Add a cinematic glow by blooming the bright highlights of every frame.',
  params: [
    { name: 'threshold',  label: 'Highlight Threshold (%)', type: 'range', min: 0, max: 100, defaultValue: 75 },
    { name: 'blurRadius', label: 'Blur Radius (px)',         type: 'range', min: 2, max: 60,  defaultValue: 20 },
    { name: 'strength',   label: 'Strength (%)',             type: 'range', min: 0, max: 100, defaultValue: 70 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-color-grade',
  name: 'Video Color Grade',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'palette',
  sourceTransformId: 'filter-color-grade',
  description: 'Cinematic colour grading — lift, shadow tint, and highlight tint — on every frame.',
  params: [
    { name: 'lift',              label: 'Lift (Black Point)',    type: 'range', min: 0, max: 50,  defaultValue: 0 },
    { name: 'shadowColor',       label: 'Shadow Tint',           type: 'color', defaultValue: '#000000' },
    { name: 'shadowStrength',    label: 'Shadow Tint (%)',        type: 'range', min: 0, max: 100, defaultValue: 0 },
    { name: 'highlightColor',    label: 'Highlight Tint',         type: 'color', defaultValue: '#ffffff' },
    { name: 'highlightStrength', label: 'Highlight Tint (%)',     type: 'range', min: 0, max: 100, defaultValue: 0 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-chromatic-aberration',
  name: 'Video Chromatic Aberration',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'lens_blur',
  sourceTransformId: 'filter-chromatic-aberration',
  description: 'Split R/B channels to simulate lens chromatic aberration on every frame.',
  params: [
    { name: 'offset',    label: 'Channel Offset (px)', type: 'range', min: 1, max: 30, defaultValue: 8 },
    { name: 'direction', label: 'Direction',            type: 'select',
      options: [
        { label: 'Horizontal', value: 'horizontal' },
        { label: 'Vertical',   value: 'vertical' },
        { label: 'Diagonal',   value: 'diagonal' },
      ], defaultValue: 'horizontal' },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-posterize',
  name: 'Video Posterize',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'gradient',
  sourceTransformId: 'color-posterize',
  description: 'Quantise each colour channel to a fixed number of levels — applied to every frame.',
  params: [
    { name: 'levels', label: 'Levels', type: 'range', min: 2, max: 8, defaultValue: 4 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-auto-levels',
  name: 'Video Auto Levels',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'brightness_auto',
  sourceTransformId: 'color-auto-levels',
  description: 'Normalise exposure by stretching the histogram — applied to every frame.',
  params: [
    { name: 'tolerance', label: 'Clipping Tolerance (%)', type: 'range', min: 0, max: 10, step: 0.1, defaultValue: 0.5 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-channel-swap',
  name: 'Video Channel Swap',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'swap_horiz',
  sourceTransformId: 'color-channel-swap',
  description: 'Reassign RGB channels on every frame. Swap R↔G to simulate infrared film.',
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
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-halftone',
  name: 'Video Halftone',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'blur_on',
  sourceTransformId: 'filter-halftone',
  description: 'Overlay a halftone dot screen on every frame — dot size varies with brightness.',
  params: [
    { name: 'dotSpacing', label: 'Dot Spacing (px)', type: 'range',   min: 4, max: 40, defaultValue: 10 },
    { name: 'dotColor',   label: 'Dot Color',        type: 'color',   defaultValue: '#000000' },
    { name: 'opacity',    label: 'Opacity (%)',       type: 'range',   min: 5, max: 100, defaultValue: 40 },
    { name: 'invert',     label: 'Invert (bright = big dots)', type: 'boolean', defaultValue: false },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-tilt-shift',
  name: 'Video Tilt-Shift',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'filter_center_focus',
  sourceTransformId: 'filter-tilt-shift',
  description: 'Miniature/tilt-shift effect — sharp horizontal band, blurred top and bottom.',
  params: [
    { name: 'centerY',    label: 'Focus Centre (%)',  type: 'range', min: 10, max: 90, defaultValue: 50 },
    { name: 'bandWidth',  label: 'Sharp Band (%)',     type: 'range', min: 5,  max: 80, defaultValue: 25 },
    { name: 'blurAmount', label: 'Blur Amount (px)',   type: 'range', min: 2,  max: 40, defaultValue: 12 },
    { name: 'feather',    label: 'Feather (%)',        type: 'range', min: 0,  max: 50, defaultValue: 30 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-dither',
  name: 'Video Dither',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'grain',
  sourceTransformId: 'filter-dither',
  description: 'Floyd-Steinberg palette dithering on every frame — retro 8-bit look.',
  params: [
    { name: 'palette', label: 'Palette', type: 'select',
      options: [
        { label: 'Mono (2 colors)',     value: 'mono'    },
        { label: 'CGA (16 colors)',     value: 'cga'     },
        { label: 'Game Boy (4 greens)', value: 'gameboy' },
        { label: 'C64 (16 colors)',     value: 'c64'     },
      ], defaultValue: 'mono' },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-kuwahara',
  name: 'Video Oil Paint (Kuwahara)',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'brush',
  sourceTransformId: 'filter-kuwahara',
  description: 'Kuwahara filter — painterly oil effect — applied to every frame. Intensive.',
  params: [
    { name: 'radius', label: 'Radius (stroke size)', type: 'range', min: 1, max: 5, defaultValue: 3 },
    { name: 'passes', label: 'Passes (intensity)',    type: 'range', min: 1, max: 2, defaultValue: 1 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-pixel-sort',
  name: 'Video Pixel Sort',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'sort',
  sourceTransformId: 'filter-pixel-sort',
  description: 'Sort pixels by luminance within horizontal strips — digital glitch aesthetic.',
  params: [
    { name: 'threshold',   label: 'Threshold (0–255)', type: 'range',  min: 0, max: 255, defaultValue: 80 },
    { name: 'direction',   label: 'Sort Direction',     type: 'select',
      options: [{ label: 'Light to Dark', value: 'light-to-dark' }, { label: 'Dark to Light', value: 'dark-to-light' }],
      defaultValue: 'light-to-dark' },
    { name: 'stripHeight', label: 'Strip Height (px)',  type: 'number', defaultValue: 1 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

// ─── Overlay / Compositing Effects ───────────────────────────────────────────

registry.register({
  id: 'video-watermark',
  name: 'Video Watermark',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'branding_watermark',
  sourceTransformId: 'overlay-watermark',
  description: 'Burn a watermark onto every frame of a video.',
  params: [
    { name: 'type',    label: 'Watermark Type', type: 'select',
      options: [{ label: 'Text', value: 'text' }, { label: 'Image', value: 'image' }], defaultValue: 'text' },
    { name: 'imageUrl', label: 'Image File',    type: 'file',    defaultValue: '' },
    { name: 'repeat',  label: 'Repeat Pattern', type: 'boolean', defaultValue: true },
    { name: 'text',    label: 'Text',           type: 'text',    defaultValue: '© PicMachina' },
    { name: 'font',    label: 'Font',           type: 'text',    defaultValue: 'Inter' },
    { name: 'size',    label: 'Size (px)',       type: 'number',  defaultValue: 28 },
    { name: 'color',   label: 'Color',          type: 'color',   defaultValue: '#ffffff' },
    { name: 'opacity', label: 'Opacity (%)',     type: 'range',   min: 0, max: 100, defaultValue: 25 },
    { name: 'angle',   label: 'Angle (°)',       type: 'range',   min: -90, max: 90, defaultValue: -35 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-caption',
  name: 'Video Caption / Text',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  icon: 'closed_caption',
  description: 'Burn styled text onto every frame — supports {{variable}} injection.',
  params: [
    { name: 'content',   label: 'Text ({{vars}} supported)', type: 'text',   defaultValue: '{{filename}}' },
    { name: 'font',      label: 'Font Family', type: 'select',
      options: [
        { label: 'Inter',           value: 'Inter' },
        { label: 'Arial',           value: 'Arial' },
        { label: 'Times New Roman', value: '"Times New Roman"' },
        { label: 'Courier New',     value: '"Courier New"' },
        { label: 'Georgia',         value: 'Georgia' },
        { label: 'Verdana',         value: 'Verdana' },
        { label: 'Impact',          value: 'Impact' },
      ], defaultValue: 'Inter' },
    { name: 'size',    label: 'Font Size (px)', type: 'number', defaultValue: 48 },
    { name: 'color',   label: 'Text Color',     type: 'color',  defaultValue: '#ffffff' },
    { name: 'weight',  label: 'Font Weight', type: 'select',
      options: [{ label: 'Normal', value: '400' }, { label: 'Bold', value: '700' }, { label: 'Light', value: '300' }],
      defaultValue: '400' },
    { name: 'anchor',  label: 'Position', type: 'select',
      options: [
        { label: 'Bottom Centre', value: 'bottom-center' },
        { label: 'Bottom Left',   value: 'bottom-left' },
        { label: 'Bottom Right',  value: 'bottom-right' },
        { label: 'Top Centre',    value: 'top-center' },
        { label: 'Top Left',      value: 'top-left' },
        { label: 'Top Right',     value: 'top-right' },
        { label: 'Centre',        value: 'center' },
      ], defaultValue: 'bottom-center' },
    { name: 'offsetX', label: 'Offset X (px)', type: 'number', defaultValue: 20 },
    { name: 'offsetY', label: 'Offset Y (px)', type: 'number', defaultValue: 20 },
    { name: 'bgBox',   label: 'Background Box', type: 'select',
      options: [
        { label: 'None',       value: 'none' },
        { label: 'Wrap text',  value: 'wrap' },
        { label: 'Full width', value: 'full-width' },
      ], defaultValue: 'none' },
    { name: 'bgColor',   label: 'Box Color',       type: 'color',  defaultValue: '#000000' },
    { name: 'bgOpacity', label: 'Box Opacity (%)', type: 'range',  min: 0, max: 100, defaultValue: 60 },
    { name: 'bgPadding', label: 'Box Padding (px)', type: 'number', defaultValue: 8 },
    { name: 'shadow',      label: 'Text Shadow',  type: 'boolean', defaultValue: true },
    { name: 'shadowColor', label: 'Shadow Color', type: 'color',   defaultValue: '#000000' },
    ...COMMON_PARAMS,
  ],
  // Direct per-frame rendering — avoids any indirect overlay-rich-text delegation issues.
  applyPerFrame(ctx, p, context) {
    const text = interpolate(p.content || '{{filename}}', context);
    if (!text) return;

    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const size = p.size || 48;
    const font = p.font || 'Inter';
    const weight = p.weight || '400';

    ctx.save();
    ctx.font = `${weight} ${size}px ${font}, sans-serif`;
    ctx.textBaseline = 'alphabetic';

    const metrics = ctx.measureText(text);
    const tw      = metrics.width;
    const ascent  = metrics.actualBoundingBoxAscent  || size * 0.8;
    const descent = metrics.actualBoundingBoxDescent || size * 0.2;

    const anchor = p.anchor || 'bottom-center';
    const ox     = Number(p.offsetX) || 20;
    const oy     = Number(p.offsetY) || 20;
    const pad    = Number(p.bgPadding) || 8;

    // Horizontal origin
    let x;
    if (anchor === 'center' || anchor.endsWith('-center')) {
      x = (W - tw) / 2;
    } else if (anchor.endsWith('-right')) {
      x = W - tw - ox;
    } else {
      x = ox;
    }

    // Vertical baseline
    let y;
    if (anchor === 'center') {
      y = (H + ascent) / 2;
    } else if (anchor.startsWith('bottom')) {
      y = H - oy;
    } else {
      y = ascent + oy;
    }

    // Background box
    const bgBox = p.bgBox || 'none';
    if (bgBox !== 'none' && p.bgColor) {
      ctx.save();
      ctx.globalAlpha = (Number(p.bgOpacity) || 60) / 100;
      ctx.fillStyle   = p.bgColor;
      const boxY = y - ascent - pad;
      const boxH = ascent + descent + pad * 2;
      if (bgBox === 'full-width') {
        ctx.fillRect(0, boxY, W, boxH);
      } else {
        ctx.fillRect(x - pad, boxY, tw + pad * 2, boxH);
      }
      ctx.restore();
    }

    // Shadow
    if (p.shadow) {
      ctx.shadowColor   = p.shadowColor || '#000000';
      ctx.shadowBlur    = size * 0.3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }

    ctx.fillStyle = p.color || '#ffffff';
    ctx.fillText(text, x, y);
    ctx.restore();
  },
  apply() { /* handled by Processor */ },
});
