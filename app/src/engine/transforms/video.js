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
