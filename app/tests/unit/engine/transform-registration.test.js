/**
 * Transform Registration Tests
 *
 * For every registered transform we verify:
 *  1. It can be retrieved by id
 *  2. It has required metadata (name, category, params array)
 *  3. Every param has a name, label, and type
 *  4. apply is a function
 *
 * These tests import side-effect modules to trigger registration.
 * Heavy dependencies (WASM, MediaPipe, ONNX, workers) are mocked
 * via vitest.config.js aliases.
 */
import { describe, test, expect, beforeAll, vi } from 'vitest';

// ── Mock heavy dependencies that can't run in Node ────────────────────────────

// mediapipe/tasks-vision
vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: { FACE_LANDMARKS_TESSELATION: [] },
  FilesetResolver: { forVisionTasks: async () => ({}) },
}));

// ONNX runtime
vi.mock('onnxruntime-web', () => ({ InferenceSession: { create: async () => ({}) } }));

// @imgly/background-removal
vi.mock('@imgly/background-removal', () => ({
  removeBackground: async (blob) => blob,
}));

// tesseract.js OCR
vi.mock('tesseract.js', () => ({
  createWorker: async () => ({ recognize: async () => ({ data: { text: '' } }), terminate: async () => {} }),
}));

// qrcode
vi.mock('qrcode', () => ({ toDataURL: async () => 'data:image/png;base64,' }));

// smartcrop
vi.mock('smartcrop', () => ({ crop: async () => ({ topCrop: { x: 0, y: 0, width: 100, height: 100 } }) }));

// leaflet (overlay-map)
vi.mock('leaflet', () => ({}));

// piexifjs
vi.mock('piexifjs', () => ({ dump: () => '', insert: (e, b) => b, GPSIFD: {}, ImageIFD: {}, ExifIFD: {} }));

// mp4-muxer
vi.mock('mp4-muxer', () => ({ Muxer: class {}, ArrayBufferTarget: class {} }));

// pptxgenjs
vi.mock('pptxgenjs', () => ({ default: class {} }));

// jspdf
vi.mock('jspdf', () => ({ jsPDF: class { addPage() {} addImage() {} save() {} output() { return new Blob(); } } }));

// jszip
vi.mock('jszip', () => ({ default: class { file() {} generateAsync() { return Promise.resolve(new Blob()); } } }));

// i18n
vi.mock('../../../src/i18n/index.js', () => ({ t: (k) => k }));

// settings
vi.mock('../../../src/utils/settings.js', () => ({
  getSettings: () => ({ license: 'Free', capabilities: {}, thumbnails: { smart: false } }),
  saveSettings: () => {},
}));

// models
vi.mock('../../../src/data/models.js', () => ({
  getModelRecord: async () => null,
  isModelDownloaded: async () => false,
}));

// video-frame / thumbnails (heavy canvas ops)
vi.mock('../../../src/utils/video-frame.js', () => ({ extractVideoFilmstrip: async () => ({ urls: [], duration: 10 }) }));
vi.mock('../../../src/utils/thumbnails.js', () => ({ generateBaselineThumbnail: async () => null, generateSmartThumbnail: async () => null }));

// map-tiles
vi.mock('../../../src/engine/utils/map-tiles.js', () => ({ fetchRenderedMap: async () => null }));

// matte-ops / vision-metadata (AI helpers)
vi.mock('../../../src/engine/ai/matte-ops.js', () => ({ featherMaskChannel: () => {} }));
vi.mock('../../../src/engine/ai/vision-metadata.js', () => ({
  persistSubjectVision: async () => {},
  readCachedSubjectBBox: async () => null,
}));

// ── Import registry + all transform side-effect modules ───────────────────────

import { registry } from '../../../src/engine/registry.js';
import '../../../src/engine/transforms/geometry.js';
import '../../../src/engine/transforms/color.js';
import '../../../src/engine/transforms/overlays.js';
import '../../../src/engine/transforms/metadata.js';
import '../../../src/engine/transforms/flow.js';
import '../../../src/engine/transforms/audio.js';
import '../../../src/engine/transforms/ai.js';
import '../../../src/engine/transforms/video.js';

// ── Known transform IDs by category ──────────────────────────────────────────

const GEO_IDS = [
  'geo-resize', 'geo-crop', 'geo-smart-crop', 'geo-rotate', 'geo-round',
  'geo-padding', 'geo-trim', 'geo-face-crop', 'geo-body-crop', 'geo-face-align',
  'ai-subject-crop', 'geo-pixelate', 'gen-checkerboard', 'gen-circle', 'gen-rect',
  'gen-ellipse', 'gen-path', 'gen-paint', 'geo-magnify', 'geo-lens',
  'geo-turbulent-displace', 'geo-liquify',
];

const COLOR_IDS = [
  'color-tuning', 'color-curves', 'color-levels', 'color-hsl', 'color-auto-levels',
  'color-opacity', 'color-tint', 'color-duotone', 'color-vignette', 'filter-advanced',
  'color-posterize', 'filter-edge-detect', 'filter-relight', 'filter-halftone',
  'filter-blur', 'filter-directional-blur', 'filter-radial-blur', 'filter-gradient-ramp',
  'filter-bloom', 'filter-chromatic-aberration', 'filter-color-grade', 'filter-kuwahara',
  'filter-tilt-shift', 'color-channel-swap', 'filter-pixel-sort', 'filter-dither',
  'ai-selective-grade', 'color-lumetri', 'filter-rain',
];

const OVERLAY_IDS = [
  'overlay-rich-text', 'overlay-watermark', 'overlay-ribbon', 'overlay-qrcode',
  'overlay-grid', 'overlay-map', 'overlay-light-leak', 'overlay-canvas-texture',
  'overlay-polaroid-frame', 'overlay-scanlines', 'overlay-template', 'overlay-device-mockup',
  'overlay-timer', 'overlay-html-block', 'overlay-subtitles', 'overlay-craquelure',
  'overlay-draw-mask',
];

const META_IDS = [
  'meta-strip', 'meta-set-exif', 'meta-geocode', 'meta-dominant-color',
  'meta-blur-detect', 'meta-sidecar-write',
];

const FLOW_IDS = [
  'flow-export', 'flow-export-variable', 'flow-save', 'flow-load',
  'flow-create-gif', 'flow-create-video', 'flow-video-stitcher', 'flow-video-fast-stitcher',
  'flow-geo-timeline', 'flow-title-slide', 'flow-contact-sheet', 'flow-photo-stack',
  'flow-compose-grid', 'video-extract-frame', 'flow-gif-from-states', 'flow-video-wall',
  'flow-video-pip', 'flow-template-aggregator', 'flow-animate-stack', 'flow-create-pdf',
  'flow-create-pptx', 'flow-bg-swap', 'flow-face-morph', 'flow-create-zip',
  'flow-video-convert', 'flow-video-trim', 'flow-video-compress', 'flow-video-speed',
  'flow-video-change-fps', 'flow-video-strip-audio', 'flow-video-extract-audio',
  'flow-video-remix-audio', 'flow-video-concat', 'flow-video-scroll',
  'flow-video-replace-audio', 'flow-video-to-gif',
];

const AI_IDS = [
  'ai-face-privacy', 'ai-remove-bg', 'ai-remove-bg-hq', 'ai-portrait-bokeh',
  'ai-drop-shadow', 'ai-sticker-outline', 'ai-subject-vignette', 'ai-subject-sharpen',
  'ai-silhouette', 'ai-smart-redact', 'ai-ocr-tag', 'ai-analyse-people',
  'ai-glow-eyes', 'ai-subject-glow', 'ai-export-matte', 'ai-clipping-mask',
  'ai-chroma-key', 'ai-magic-eraser', 'ai-selective-grade',
];

const AUDIO_IDS = ['ai-transcribe', 'flow-audio-tts'];

const VIDEO_IDS = [
  'video-tuning', 'video-duotone', 'video-tint', 'video-vignette',
  'video-advanced-effects', 'video-bloom', 'video-color-grade',
  'video-chromatic-aberration', 'video-posterize', 'video-auto-levels',
  'video-channel-swap', 'video-halftone', 'video-tilt-shift', 'video-dither',
  'video-kuwahara', 'video-pixel-sort', 'video-mesh-warp', 'video-pose-landmarks',
  'video-watermark', 'video-caption', 'flow-video-replace-audio',
];

const ALL_IDS = [
  ...GEO_IDS, ...COLOR_IDS, ...OVERLAY_IDS, ...META_IDS,
  ...FLOW_IDS, ...AI_IDS, ...AUDIO_IDS, ...VIDEO_IDS,
];

// ── Shared assertion helper ───────────────────────────────────────────────────

function assertTransform(id) {
  const def = registry.get(id);
  expect(def, `Transform "${id}" not found in registry`).not.toBeNull();
  expect(typeof def.name, `"${id}".name must be a string`).toBe('string');
  expect(def.name.length, `"${id}".name must not be empty`).toBeGreaterThan(0);
  expect(typeof def.category, `"${id}".category must be a string`).toBe('string');
  expect(Array.isArray(def.params), `"${id}".params must be an array`).toBe(true);
  // Some transforms use applyPerFrame instead of apply (video-effect categoryKey)
  const hasApply = typeof def.apply === 'function' || typeof def.applyPerFrame === 'function';
  expect(hasApply, `"${id}" must have apply or applyPerFrame function`).toBe(true);

  for (const param of def.params) {
    expect(param.name,  `param in "${id}" missing .name`).toBeTruthy();
    expect(param.label, `param "${param.name}" in "${id}" missing .label`).toBeTruthy();
    expect(param.type,  `param "${param.name}" in "${id}" missing .type`).toBeTruthy();
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Geometric & Framing transforms — registration', () => {
  for (const id of GEO_IDS) {
    test(id, () => assertTransform(id));
  }
});

describe('Color & Tone transforms — registration', () => {
  for (const id of COLOR_IDS) {
    test(id, () => assertTransform(id));
  }
});

describe('Overlay & Typography transforms — registration', () => {
  for (const id of OVERLAY_IDS) {
    test(id, () => assertTransform(id));
  }
});

describe('Metadata transforms — registration', () => {
  for (const id of META_IDS) {
    test(id, () => assertTransform(id));
  }
});

describe('Flow Control transforms — registration', () => {
  for (const id of FLOW_IDS) {
    test(id, () => assertTransform(id));
  }
});

describe('AI & Composition transforms — registration', () => {
  for (const id of AI_IDS) {
    test(id, () => assertTransform(id));
  }
});

describe('Audio AI transforms — registration', () => {
  for (const id of AUDIO_IDS) {
    test(id, () => assertTransform(id));
  }
});

describe('Video transforms — registration', () => {
  for (const id of VIDEO_IDS) {
    test(id, () => assertTransform(id));
  }
});

describe('Registry totals', () => {
  test('all expected transforms are registered (no missing IDs)', () => {
    const missing = ALL_IDS.filter(id => registry.get(id) === null);
    expect(missing, `Missing transforms: ${missing.join(', ')}`).toHaveLength(0);
  });
});
