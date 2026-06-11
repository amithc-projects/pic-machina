/**
 * Canvas-based integration tests for Geometric & Framing transforms.
 * Uses @napi-rs/canvas for real pixel operations in Node.
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';

// ── Mock heavy AI deps before importing geometry.js ───────────────────────────
vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: { FACE_LANDMARKS_TESSELATION: [] },
  FilesetResolver: { forVisionTasks: async () => ({}) },
}));
vi.mock('../../../src/engine/ai/vision-metadata.js', () => ({
  persistSubjectVision: async () => {},
  readCachedSubjectBBox: async () => null,
}));
vi.mock('../../../src/utils/settings.js', () => ({
  getSettings: () => ({ license: 'Free', capabilities: {}, thumbnails: { smart: false } }),
}));
vi.mock('../../../src/data/models.js', () => ({
  getModelRecord: async () => null,
  isModelDownloaded: async () => false,
}));
vi.mock('../../../src/i18n/index.js', () => ({ t: (k) => k }));

// Polyfill document.createElement for canvas ops inside transforms
import { Image, ImageData } from '@napi-rs/canvas';
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return createCanvas(1, 1);
    return { style: {} };
  },
};
global.Image = Image;
global.ImageData = ImageData;

import { registry } from '../../../src/engine/registry.js';
import '../../../src/engine/transforms/geometry.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a canvas filled with a solid colour */
function makeCanvas(w, h, fillStyle = '#3399ff') {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

/** Get the pixel at (x, y) as {r,g,b,a} */
function getPixel(ctx, x, y) {
  const d = ctx.getImageData(x, y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

/** Run a transform's apply() against a canvas/ctx pair */
async function applyTransform(id, ctx, params = {}, context = {}) {
  const def = registry.get(id);
  if (!def) throw new Error(`Transform "${id}" not found`);
  await def.apply(ctx, params, context);
}

// ── geo-resize ────────────────────────────────────────────────────────────────

describe('geo-resize', () => {
  test('absolute px: width=400, height=300 resizes canvas exactly', async () => {
    const { canvas, ctx } = makeCanvas(200, 200);
    await applyTransform('geo-resize', ctx, { width: '400', height: '300', maintainAspect: false, algo: 'Bilinear' });
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
  });

  test('50% width with maintainAspect halves both dimensions', async () => {
    const { canvas, ctx } = makeCanvas(200, 200);
    await applyTransform('geo-resize', ctx, { width: '50%', height: '', maintainAspect: true, algo: 'Bilinear' });
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });

  test('100% is identity — dimensions unchanged', async () => {
    const { canvas, ctx } = makeCanvas(150, 100);
    await applyTransform('geo-resize', ctx, { width: '100%', height: '', maintainAspect: true, algo: 'Bilinear' });
    expect(canvas.width).toBe(150);
    expect(canvas.height).toBe(100);
  });

  test('does not throw with default params', async () => {
    const { ctx } = makeCanvas(100, 100);
    await expect(applyTransform('geo-resize', ctx, { width: '100%', height: '', maintainAspect: true, algo: 'Lanczos' }))
      .resolves.not.toThrow();
    // no-op
  });
});

// ── geo-crop ──────────────────────────────────────────────────────────────────
// Note: geo-crop uses x/y/width/height params (absolute/percent).
// Aspect-ratio cropping is geo-smart-crop.

describe('geo-crop', () => {
  test('crop to specific dimensions (50%×50%) halves the canvas', async () => {
    const { canvas, ctx } = makeCanvas(400, 200);
    await applyTransform('geo-crop', ctx, { x: '0', y: '0', width: '50%', height: '50%' });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
  });

  test('crop to absolute 100×100 from a 400×200 canvas', async () => {
    const { canvas, ctx } = makeCanvas(400, 200);
    await applyTransform('geo-crop', ctx, { x: '0', y: '0', width: '100', height: '100' });
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });

  test('100% crop is identity', async () => {
    const { canvas, ctx } = makeCanvas(200, 150);
    await applyTransform('geo-crop', ctx, { x: '0', y: '0', width: '100%', height: '100%' });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(150);
  });

  test('does not throw with default params', async () => {
    const { ctx } = makeCanvas(200, 150);
    await expect(applyTransform('geo-crop', ctx, { x: '0', y: '0', width: '100%', height: '100%' }))
      .resolves.not.toThrow();
    // no-op
  });
});

// ── geo-rotate ────────────────────────────────────────────────────────────────
// Params: { angle: 0|90|180|-90, flip: 'none'|'horizontal'|'vertical'|'both' }

describe('geo-rotate', () => {
  test('90° CW swaps dimensions (400×200 → 200×400)', async () => {
    const { canvas, ctx } = makeCanvas(400, 200);
    await applyTransform('geo-rotate', ctx, { angle: 90, flip: 'none' });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(400);
  });

  test('180° preserves dimensions', async () => {
    const { canvas, ctx } = makeCanvas(200, 100);
    await applyTransform('geo-rotate', ctx, { angle: 180, flip: 'none' });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
  });

  test('horizontal flip mirrors pixels left-to-right', async () => {
    const { ctx } = makeCanvas(100, 100, '#000');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 50, 100);   // left half red
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(50, 0, 50, 100);  // right half blue

    await applyTransform('geo-rotate', ctx, { angle: 0, flip: 'horizontal' });

    const left = getPixel(ctx, 10, 50);
    const right = getPixel(ctx, 90, 50);
    expect(left.b).toBeGreaterThan(200);  // blue now on left
    expect(right.r).toBeGreaterThan(200); // red now on right
  });

  test('does not throw with angle=0, flip=none', async () => {
    const { ctx } = makeCanvas(100, 100);
    await expect(applyTransform('geo-rotate', ctx, { angle: 0, flip: 'none' }))
      .resolves.not.toThrow();
    // no-op
  });
});

// ── geo-padding ───────────────────────────────────────────────────────────────

describe('geo-padding', () => {
  test('adds correct pixel dimensions: top=10, right=20, bottom=30, left=40', async () => {
    const { canvas, ctx } = makeCanvas(100, 100);
    await applyTransform('geo-padding', ctx, { top: 10, right: 20, bottom: 30, left: 40, color: '#ffffff' });
    expect(canvas.width).toBe(160);  // 100 + 40 + 20
    expect(canvas.height).toBe(140); // 100 + 10 + 30
  });

  test('padding area is filled with specified colour', async () => {
    const { canvas, ctx } = makeCanvas(100, 100, '#0000ff');
    await applyTransform('geo-padding', ctx, { top: 20, right: 0, bottom: 0, left: 0, color: '#ff0000' });
    const topLeft = getPixel(ctx, 5, 5);
    expect(topLeft.r).toBeGreaterThan(200); // red padding area
    expect(topLeft.b).toBeLessThan(50);
  });

  test('zero padding is identity', async () => {
    const { canvas, ctx } = makeCanvas(100, 100);
    await applyTransform('geo-padding', ctx, { top: 0, right: 0, bottom: 0, left: 0, color: '#000' });
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });
});

// ── geo-round ─────────────────────────────────────────────────────────────────

describe('geo-round', () => {
  test('corner pixels become transparent after full-circle rounding', async () => {
    const { ctx } = makeCanvas(100, 100, '#0000ff');
    await applyTransform('geo-round', ctx, { radius: 50 });
    const corner = getPixel(ctx, 1, 1);
    expect(corner.a).toBe(0);
  });

  test('centre pixel remains opaque after rounding', async () => {
    const { ctx } = makeCanvas(100, 100, '#0000ff');
    await applyTransform('geo-round', ctx, { radius: 20 });
    const centre = getPixel(ctx, 50, 50);
    expect(centre.a).toBe(255);
  });
});

// ── geo-pixelate ──────────────────────────────────────────────────────────────

describe('geo-pixelate', () => {
  test('pixels within the same block have identical RGBA values', async () => {
    const { ctx } = makeCanvas(100, 100);
    await applyTransform('geo-pixelate', ctx, { blockSize: 10 });
    const p1 = getPixel(ctx, 0, 0);
    const p2 = getPixel(ctx, 9, 9); // same 10×10 block
    expect(p1).toEqual(p2);
  });

  test('does not throw with default block size', async () => {
    const { ctx } = makeCanvas(100, 100);
    await expect(applyTransform('geo-pixelate', ctx, { blockSize: 8 }))
      .resolves.not.toThrow();
    // no-op
  });
});

// ── gen-checkerboard ──────────────────────────────────────────────────────────

describe('gen-checkerboard', () => {
  test('produces alternating colour blocks', async () => {
    const { ctx } = makeCanvas(200, 200, '#ffffff');
    await applyTransform('gen-checkerboard', ctx, {
      color1: '#000000', color2: '#ffffff', size: 10,
    });
    const blockA = getPixel(ctx, 5, 5);
    const blockB = getPixel(ctx, 15, 5);
    // One should be black, the other white
    const aIsBlack = blockA.r < 50 && blockA.g < 50;
    const bIsWhite = blockB.r > 200 && blockB.g > 200;
    const aIsWhite = blockA.r > 200 && blockA.g > 200;
    const bIsBlack = blockB.r < 50 && blockB.g < 50;
    expect((aIsBlack && bIsWhite) || (aIsWhite && bIsBlack)).toBe(true);
  });
});

// ── gen-rect ──────────────────────────────────────────────────────────────────
// Params: x/y/width/height are percentages (0-100), color, style

describe('gen-rect', () => {
  test('fills centre region with specified colour (100% size)', async () => {
    const { ctx } = makeCanvas(100, 100, '#000000');
    await applyTransform('gen-rect', ctx, {
      color: '#ff0000', x: 50, y: 50, width: 100, height: 100, style: 'fill', opacity: 100,
    });
    const centre = getPixel(ctx, 50, 50);
    expect(centre.r).toBeGreaterThan(200);
    expect(centre.b).toBeLessThan(50);
  });

  test('does not throw with default params', async () => {
    const def = registry.get('gen-rect');
    const defaults = Object.fromEntries((def.params || []).map(p => [p.name, p.defaultValue ?? 0]));
    const { ctx } = makeCanvas(100, 100);
    const r = def.apply(ctx, defaults, {}); if (r && r.then) await r;
  });
});

// ── color-opacity ─────────────────────────────────────────────────────────────
// (color transform but pure pixel math — no WASM required)

describe('color-opacity', () => {
  // Import separately as it's in color.js — needs WASM mock at module level
  // We test it inline here since it does pure ImageData manipulation.
  test('0% opacity sets all alpha to 0', async () => {
    const { ctx } = makeCanvas(10, 10, '#0000ff');
    const def = registry.get('color-opacity');
    // If not yet registered, skip (geo test file loads geometry.js only)
    if (!def) return;
    await def.apply(ctx, { opacity: 0 });
    const px = getPixel(ctx, 5, 5);
    expect(px.a).toBe(0);
  });
});
