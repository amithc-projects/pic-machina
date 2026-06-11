/**
 * Canvas-based integration tests for Color & Tone transforms.
 * WASM (Photon) is stubbed via vitest.config.js alias — transforms that use
 * Photon run no-ops, which means we test registration + no-crash only for
 * those. Pure JS transforms (opacity, channel-swap, vignette) are pixel-tested.
 */
import { describe, test, expect, vi } from 'vitest';
import { createCanvas, Image, ImageData } from '@napi-rs/canvas';

// Polyfills for Node environment
global.Image = Image;
global.ImageData = ImageData;
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return createCanvas(1, 1);
    return { style: {} };
  },
};

vi.mock('../../../src/engine/ai/vision-metadata.js', () => ({
  persistSubjectVision: async () => {},
  readCachedSubjectBBox: async () => null,
}));
vi.mock('../../../src/engine/ai/matte-ops.js', () => ({
  featherMaskChannel: () => {},
}));
vi.mock('../../../src/utils/settings.js', () => ({
  getSettings: () => ({ license: 'Free', capabilities: {}, thumbnails: { smart: false } }),
}));
vi.mock('../../../src/data/models.js', () => ({
  getModelRecord: async () => null,
  isModelDownloaded: async () => false,
}));
vi.mock('../../../src/i18n/index.js', () => ({ t: (k) => k }));

import { registry } from '../../../src/engine/registry.js';
import '../../../src/engine/transforms/color.js';

function makeCanvas(w, h, fillStyle = '#808080') {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

function getPixel(ctx, x, y) {
  const d = ctx.getImageData(x, y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

async function applyTransform(id, ctx, params = {}) {
  const def = registry.get(id);
  expect(def, `Transform "${id}" not found`).not.toBeNull();
  await def.apply(ctx, params, {});
}

// ── color-opacity ─────────────────────────────────────────────────────────────

describe('color-opacity', () => {
  test('0% sets all alpha to 0', async () => {
    const { ctx } = makeCanvas(10, 10, '#0000ff');
    await applyTransform('color-opacity', ctx, { opacity: 0 });
    expect(getPixel(ctx, 5, 5).a).toBe(0);
  });

  test('50% halves alpha values', async () => {
    const { ctx } = makeCanvas(10, 10, '#0000ff');
    await applyTransform('color-opacity', ctx, { opacity: 50 });
    const a = getPixel(ctx, 5, 5).a;
    expect(a).toBeGreaterThanOrEqual(126);
    expect(a).toBeLessThanOrEqual(128);
  });

  test('100% leaves alpha unchanged', async () => {
    const { ctx } = makeCanvas(10, 10, '#0000ff');
    await applyTransform('color-opacity', ctx, { opacity: 100 });
    expect(getPixel(ctx, 5, 5).a).toBe(255);
  });
});

// ── color-channel-swap ────────────────────────────────────────────────────────

describe('color-channel-swap', () => {
  // Params use 'R','G','B' uppercase values
  test('swapping R←B, B←R on pure red produces pure blue', async () => {
    const { ctx } = makeCanvas(10, 10, '#ff0000');
    const def = registry.get('color-channel-swap');
    // Get the third param (blueSource)
    const blueParam = def.params.find(p => p.name === 'blueSource');
    if (!blueParam) {
      // Only 2 params (redSource + greenSource) — check the actual structure
      await applyTransform('color-channel-swap', ctx, { redSource: 'B', greenSource: 'G' });
    } else {
      await applyTransform('color-channel-swap', ctx, { redSource: 'B', greenSource: 'G', blueSource: 'R' });
    }
    const px = getPixel(ctx, 5, 5);
    expect(px.r).toBeLessThan(10);
    expect(px.b).toBeGreaterThan(240);
  });
});

// ── color-posterize ───────────────────────────────────────────────────────────

describe('color-posterize', () => {
  test('levels=2 produces only 2 distinct luminance values', async () => {
    // Create a gradient: left=0, right=255
    const canvas = createCanvas(100, 10);
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < 100; x++) {
      const v = Math.round((x / 99) * 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 0, 1, 10);
    }

    await applyTransform('color-posterize', ctx, { levels: 2 });

    const redValues = new Set();
    for (let x = 0; x < 100; x++) {
      redValues.add(getPixel(ctx, x, 5).r);
    }
    expect(redValues.size).toBeLessThanOrEqual(2);
  });
});

// ── color-tint — no-crash ─────────────────────────────────────────────────────

describe('color-tint', () => {
  test('applies a visible colour tint at full strength', async () => {
    const { ctx } = makeCanvas(10, 10, '#808080');
    const before = getPixel(ctx, 5, 5);
    await applyTransform('color-tint', ctx, { color: '#ff0000', strength: 100, blendMode: 'source-over' });
    const after = getPixel(ctx, 5, 5);
    // Canvas should now be more red than before
    expect(after.r).toBeGreaterThan(before.r);
  });

  test('does not throw with default params', async () => {
    const { ctx } = makeCanvas(10, 10);
    await expect(applyTransform('color-tint', ctx, { color: '#ff8800', strength: 20, blendMode: 'source-over' }))
      .resolves.not.toThrow();
  });
});

// ── color-vignette ────────────────────────────────────────────────────────────

describe('color-vignette', () => {
  test('corner pixels are darker than centre after vignette', async () => {
    const { ctx } = makeCanvas(200, 200, '#ffffff');
    await applyTransform('color-vignette', ctx, { strength: 80, color: '#000000', feather: 50 });
    const corner = getPixel(ctx, 2, 2);
    const centre = getPixel(ctx, 100, 100);
    // Vignette darkens corners — corner luminance < centre luminance
    const cornerLum = (corner.r + corner.g + corner.b) / 3;
    const centreLum = (centre.r + centre.g + centre.b) / 3;
    expect(cornerLum).toBeLessThan(centreLum);
  });
});

// ── Photon-backed transforms: no-crash only (WASM is stubbed) ────────────────

// WebGL transforms need a real browser (no WebGL in Node) — excluded from this list
const WEBGL_TRANSFORMS = new Set(['color-lumetri', 'filter-color-grade']);

const PHOTON_TRANSFORMS = [
  'color-tuning', 'color-curves', 'color-levels', 'color-hsl', 'color-auto-levels',
  'color-duotone', 'filter-advanced', 'filter-edge-detect', 'filter-relight',
  'filter-halftone', 'filter-blur', 'filter-directional-blur', 'filter-radial-blur',
  'filter-bloom', 'filter-chromatic-aberration',
  'filter-kuwahara', 'filter-tilt-shift', 'filter-pixel-sort', 'filter-dither',
  'ai-selective-grade', 'filter-rain', 'filter-gradient-ramp',
];

describe('WASM-backed color transforms — no-crash with default params', () => {
  for (const id of PHOTON_TRANSFORMS) {
    test(id, async () => {
      const { ctx } = makeCanvas(20, 20);
      const def = registry.get(id);
      expect(def).not.toBeNull();
      const defaults = Object.fromEntries(
        (def.params || []).map(p => [p.name, p.defaultValue ?? ''])
      );
      // Handle both sync and async apply functions
      try {
        const result = def.apply(ctx, defaults, {});
        if (result && typeof result.then === 'function') await result;
      } catch (e) {
        // WebGL "not supported" errors are expected in Node — skip gracefully
        if (e.message && e.message.includes('webgl')) return;
        throw e;
      }
    });
  }
});
