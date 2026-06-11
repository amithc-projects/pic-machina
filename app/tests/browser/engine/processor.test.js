/**
 * Browser-mode tests for the Processor pipeline.
 * Tests the full processRecipe() flow with real canvas, real transforms,
 * and real WASM — no mocks anywhere.
 *
 * Run: npm run test:browser
 */
import { describe, test, expect } from 'vitest';
import { registry } from '../../../src/engine/registry.js';

// Import all transform bundles to populate the registry
import '../../../src/engine/transforms/geometry.js';
import '../../../src/engine/transforms/color.js';
import '../../../src/engine/transforms/metadata.js';
import '../../../src/engine/transforms/flow.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCanvas(w = 100, h = 100, fill = '#3399ff') {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

function px(ctx, x, y) {
  const d = ctx.getImageData(x, y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

function makeCtx(extras = {}) {
  return { variables: new Map(), log: () => {}, exif: {}, sidecar: {}, filename: 'test', ext: 'jpg', ...extras };
}

// ── Sequential transform pipeline ────────────────────────────────────────────

describe('Transform pipeline — sequential application', () => {
  test('resize → crop produces the correct final dimensions', async () => {
    const { canvas, ctx } = makeCanvas(400, 200);
    const context = makeCtx();

    // Step 1: resize to 200×100
    await registry.get('geo-resize').apply(ctx, { width: '200', height: '100', maintainAspect: false, algo: 'Bilinear' }, context);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);

    // Step 2: crop top-left 100×100
    await registry.get('geo-crop').apply(ctx, { x: '0', y: '0', width: '100', height: '100' }, context);
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });

  test('color-opacity(0) then flow-save preserves transparent state', async () => {
    const { ctx } = makeCanvas(50, 50, '#ff0000');
    const context = makeCtx();

    await registry.get('color-opacity').apply(ctx, { opacity: 0 }, context);
    expect(px(ctx, 25, 25).a).toBe(0);

    registry.get('flow-save').apply(ctx, { label: 'transparent' }, context);
    const saved = context.variables.get('transparent');
    expect(saved).toBeTruthy();
    // The saved ImageData should have alpha=0 too
    expect(saved.data[3]).toBe(0);
  });

  test('flow-save + flow-load round-trip restores original pixels', async () => {
    const { ctx } = makeCanvas(50, 50, '#ff6600');
    const context = makeCtx();
    const orangeBefore = px(ctx, 25, 25);

    registry.get('flow-save').apply(ctx, { label: 'orange' }, context);

    // Overwrite with blue
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(0, 0, 50, 50);
    expect(px(ctx, 25, 25).b).toBeGreaterThan(200);

    registry.get('flow-load').apply(ctx, { label: 'orange', blendMode: 'replace' }, context);
    const orangeAfter = px(ctx, 25, 25);

    expect(Math.abs(orangeAfter.r - orangeBefore.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(orangeAfter.g - orangeBefore.g)).toBeLessThanOrEqual(2);
  });
});

// ── Metadata pipeline ─────────────────────────────────────────────────────────

describe('Metadata transform pipeline', () => {
  test('meta-strip + meta-set-exif both affect context without touching canvas', async () => {
    const { ctx } = makeCanvas(50, 50, '#ff0000');
    const context = makeCtx();
    const before = px(ctx, 25, 25);

    registry.get('meta-strip').apply(ctx, { level: 'GPS Only' }, context);
    await registry.get('meta-set-exif').apply(ctx, { field: 'copyright', value: '© Test' }, context);

    // Canvas unchanged
    expect(px(ctx, 25, 25)).toEqual(before);

    // Context modified
    expect(context._stripMetadata).toBe('GPS Only');
    expect(context._exifWrites.copyright).toBe('© Test');
  });

  test('meta-dominant-color extracts a valid hex from a red canvas', async () => {
    const { ctx } = makeCanvas(50, 50, '#ff0000');
    const context = makeCtx();
    await registry.get('meta-dominant-color').apply(ctx, { ignoreNeutral: false, minAlpha: 0 }, context);
    const hex = context.variables.get('dominantHex.0');
    expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    // The dominant colour of a pure-red canvas should be reddish
    const r = parseInt(hex.slice(1, 3), 16);
    expect(r).toBeGreaterThan(200);
  });
});

// ── All transforms registered & callable ─────────────────────────────────────

describe('Registry completeness in browser context', () => {
  const EXPECTED_IDS = [
    'geo-resize', 'geo-crop', 'geo-rotate', 'geo-padding', 'geo-round', 'geo-pixelate',
    'color-tuning', 'color-opacity', 'color-tint', 'color-vignette', 'color-lumetri',
    'filter-blur', 'filter-color-grade', 'color-channel-swap', 'color-posterize',
    'meta-strip', 'meta-set-exif', 'meta-dominant-color',
    'flow-save', 'flow-load', 'flow-export',
  ];

  for (const id of EXPECTED_IDS) {
    test(`"${id}" is registered`, () => {
      expect(registry.get(id), `"${id}" not found`).not.toBeNull();
    });
  }
});
