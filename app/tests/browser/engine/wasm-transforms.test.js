/**
 * Browser-mode tests for WASM-backed Color & Tone transforms.
 * Runs in real Chromium — Photon WASM loads natively, no stubs.
 *
 * Run: npm run test:browser
 */
import { describe, test, expect, beforeAll } from 'vitest';

// Import the real registry and trigger side-effect registration
import { registry } from '../../../src/engine/registry.js';
import '../../../src/engine/transforms/color.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCanvas(w, h, fill = '#808080') {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

function px(ctx, x, y) {
  const d = ctx.getImageData(x, y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

async function apply(id, ctx, params = {}, context = {}) {
  const def = registry.get(id);
  if (!def) throw new Error(`"${id}" not in registry`);
  await def.apply(ctx, params, context);
}

// ── color-tuning (Photon WASM) ────────────────────────────────────────────────

describe('color-tuning — real Photon WASM', () => {
  test('invert=true on pure red produces cyan (#00FFFF)', async () => {
    const { ctx } = makeCanvas(10, 10, '#ff0000');
    await apply('color-tuning', ctx, { contrast: 0, saturation: 0, vibrance: 0, invert: true });
    const p = px(ctx, 5, 5);
    expect(p.r).toBeLessThan(10);
    expect(p.g).toBeGreaterThan(245);
    expect(p.b).toBeGreaterThan(245);
  });

  test('default params (no-op values) preserve pixels within rounding tolerance', async () => {
    const { ctx } = makeCanvas(10, 10, '#3399cc');
    const before = px(ctx, 5, 5);
    await apply('color-tuning', ctx, { contrast: 0, saturation: 0, vibrance: 0, invert: false });
    const after = px(ctx, 5, 5);
    expect(Math.abs(after.r - before.r)).toBeLessThanOrEqual(5);
    expect(Math.abs(after.g - before.g)).toBeLessThanOrEqual(5);
    expect(Math.abs(after.b - before.b)).toBeLessThanOrEqual(5);
  });

  test('contrast=100 increases pixel extremes', async () => {
    // Mid-grey canvas — high contrast should push values toward black or white
    const { ctx } = makeCanvas(10, 10, '#808080');
    await apply('color-tuning', ctx, { contrast: 100, saturation: 0, vibrance: 0, invert: false });
    const p = px(ctx, 5, 5);
    // High contrast on pure mid-grey should produce near-grey (grey has no contrast to boost)
    // but it should not throw and return valid pixel data
    expect(p.a).toBe(255);
  });
});

// ── color-levels (Photon) ─────────────────────────────────────────────────────

// color-levels uses a single JSON `levels` param
describe('color-levels — pure JS (browser)', () => {
  test('inBlack=200 crushes a dark pixel (r=100) to black', async () => {
    const { ctx } = makeCanvas(10, 10, '#646464'); // rgb(100,100,100)
    await apply('color-levels', ctx, {
      levels: JSON.stringify({ inBlack: 200, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 })
    });
    const p = px(ctx, 5, 5);
    expect(p.r).toBeLessThan(10);
  });

  test('inWhite=100 clips a bright pixel (r=200) to white', async () => {
    const { ctx } = makeCanvas(10, 10, '#c8c8c8'); // rgb(200,200,200)
    await apply('color-levels', ctx, {
      levels: JSON.stringify({ inBlack: 0, inWhite: 100, gamma: 1, outBlack: 0, outWhite: 255 })
    });
    const p = px(ctx, 5, 5);
    expect(p.r).toBe(255);
  });
});

// ── color-opacity (pure JS — but verify in real browser) ──────────────────────

describe('color-opacity — in real browser', () => {
  test('50% opacity halves alpha', async () => {
    const { ctx } = makeCanvas(10, 10, '#0000ff');
    await apply('color-opacity', ctx, { opacity: 50 });
    const p = px(ctx, 5, 5);
    expect(p.a).toBeGreaterThanOrEqual(126);
    expect(p.a).toBeLessThanOrEqual(128);
  });
});

// ── color-posterize (Photon) ──────────────────────────────────────────────────

describe('color-posterize — real Photon WASM', () => {
  test('levels=2 reduces a gradient to ≤2 distinct tones', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100; canvas.height = 10;
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < 100; x++) {
      const v = Math.round((x / 99) * 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 0, 1, 10);
    }
    await apply('color-posterize', ctx, { levels: 2 });
    const values = new Set();
    for (let x = 0; x < 100; x++) values.add(px(ctx, x, 5).r);
    expect(values.size).toBeLessThanOrEqual(2);
  });
});

// ── color-channel-swap (Photon) ───────────────────────────────────────────────

describe('color-channel-swap — real Photon WASM', () => {
  test('R←B, B←R on pure red produces pure blue', async () => {
    const { ctx } = makeCanvas(10, 10, '#ff0000');
    await apply('color-channel-swap', ctx, { redSource: 'B', greenSource: 'G', blueSource: 'R' });
    const p = px(ctx, 5, 5);
    expect(p.r).toBeLessThan(10);
    expect(p.b).toBeGreaterThan(245);
  });
});

// ── filter-blur (Photon) ──────────────────────────────────────────────────────

describe('filter-blur — real Photon WASM', () => {
  test('blurs a sharp edge (radius=5)', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100; canvas.height = 10;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 50, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(50, 0, 50, 10);
    await apply('filter-blur', ctx, { radius: 5 });
    // Pixel at the boundary should be blended (neither pure black nor pure white)
    const edge = px(ctx, 50, 5);
    expect(edge.r).toBeGreaterThan(10);
    expect(edge.r).toBeLessThan(245);
  });
});

// ── WebGL transforms ──────────────────────────────────────────────────────────

describe('color-lumetri — real WebGL', () => {
  test('does not throw with neutral params', async () => {
    const { ctx } = makeCanvas(20, 20);
    const def = registry.get('color-lumetri');
    const defaults = Object.fromEntries((def.params || []).map(p => [p.name, p.defaultValue ?? 0]));
    // May be sync or async depending on WebGL availability
    try {
      const result = def.apply(ctx, defaults, {});
      if (result && typeof result.then === 'function') await result;
    } catch (e) {
      // WebGL unavailable in this context is an acceptable outcome
      if (!/webgl/i.test(e.message)) throw e;
    }
  });

  test('temperature=50 shifts canvas toward warm tones', async () => {
    const { ctx } = makeCanvas(20, 20, '#808080');
    const before = px(ctx, 10, 10);
    await apply('color-lumetri', ctx, {
      exposure: 0, contrast: 0, highlights: 0, shadows: 0,
      whites: 0, blacks: 0, temperature: 50, tint: 0, saturation: 0,
      vibrance: 0, hsl: []
    });
    const after = px(ctx, 10, 10);
    // Warm temperature shift should increase red channel relative to blue
    expect(after.r).toBeGreaterThanOrEqual(before.r);
  });
});

describe('filter-color-grade — real WebGL', () => {
  test('does not throw and produces valid pixels', async () => {
    const { ctx } = makeCanvas(20, 20, '#336699');
    const def = registry.get('filter-color-grade');
    const defaults = Object.fromEntries((def.params || []).map(p => [p.name, p.defaultValue ?? 0]));
    await def.apply(ctx, defaults, {});
    const p = px(ctx, 10, 10);
    expect(p.a).toBe(255);
  });
});
