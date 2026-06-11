/**
 * Integration tests for Flow Control and Metadata transforms.
 * These transforms don't modify pixels directly — they set context flags,
 * save/restore state, or produce output blobs.
 */
import { describe, test, expect, vi } from 'vitest';
import { createCanvas, ImageData } from '@napi-rs/canvas';
global.ImageData = ImageData;

vi.mock('../../../src/i18n/index.js', () => ({ t: (k) => k }));
vi.mock('../../../src/utils/settings.js', () => ({
  getSettings: () => ({ license: 'Free', capabilities: {} }),
}));
vi.mock('../../../src/data/models.js', () => ({
  getModelRecord: async () => null,
  isModelDownloaded: async () => false,
}));
vi.mock('../../../src/engine/ai/vision-metadata.js', () => ({
  persistSubjectVision: async () => {},
  readCachedSubjectBBox: async () => null,
}));
vi.mock('../../../src/utils/thumbnails.js', () => ({
  generateBaselineThumbnail: async () => null,
}));
vi.mock('jspdf', () => ({ jsPDF: class { addImage() {} save() {} output() { return new Blob(); } } }));
vi.mock('jszip', () => ({ default: class { file() {} generateAsync() { return Promise.resolve(new Blob()); } } }));
vi.mock('pptxgenjs', () => ({ default: class {} }));
vi.mock('gif.js', () => ({
  default: class {
    addFrame() {}
    on(e, cb) { if (e === 'finished') setTimeout(() => cb(new Blob()), 0); }
    render() {}
  },
}));
vi.mock('mp4-muxer', () => ({ Muxer: class { addVideoChunk() {} finalize() { return new ArrayBuffer(0); } }, ArrayBufferTarget: class {} }));
vi.mock('../../../src/engine/utils/map-tiles.js', () => ({ fetchRenderedMap: async () => null }));

global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return createCanvas(1, 1);
    return { style: {} };
  },
};

import { registry } from '../../../src/engine/registry.js';
import '../../../src/engine/transforms/metadata.js';
import '../../../src/engine/transforms/flow.js';

function makeCanvas(w = 100, h = 100, fill = '#3399ff') {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

function getPixel(ctx, x, y) {
  const d = ctx.getImageData(x, y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

function makeContext(extra = {}) {
  return {
    variables: new Map(),
    log: () => {},
    exif: {},
    sidecar: {},
    filename: 'test',
    ext: 'jpg',
    ...extra,
  };
}

// ── meta-strip ────────────────────────────────────────────────────────────────

describe('meta-strip', () => {
  test('sets context._stripMetadata to the selected level', async () => {
    const { ctx } = makeCanvas();
    const ctx2 = makeContext();
    await registry.get('meta-strip').apply(ctx, { level: 'GPS Only' }, ctx2);
    expect(ctx2._stripMetadata).toBe('GPS Only');
  });

  test('default level is "All"', async () => {
    const { ctx } = makeCanvas();
    const ctx2 = makeContext();
    await registry.get('meta-strip').apply(ctx, {}, ctx2);
    expect(ctx2._stripMetadata).toBe('All');
  });

  test('does not modify canvas pixels', async () => {
    const { ctx } = makeCanvas(10, 10, '#ff0000');
    const before = getPixel(ctx, 5, 5);
    const ctx2 = makeContext();
    await registry.get('meta-strip').apply(ctx, { level: 'All' }, ctx2);
    expect(getPixel(ctx, 5, 5)).toEqual(before);
  });
});

// ── meta-set-exif ─────────────────────────────────────────────────────────────

describe('meta-set-exif', () => {
  test('writes to context._exifWrites with correct field key', async () => {
    const { ctx } = makeCanvas();
    const ctx2 = makeContext();
    await registry.get('meta-set-exif').apply(ctx, { field: 'copyright', value: '© Test 2024' }, ctx2);
    expect(ctx2._exifWrites.copyright).toBe('© Test 2024');
  });

  test('multiple nodes accumulate into _exifWrites', async () => {
    const { ctx } = makeCanvas();
    const ctx2 = makeContext();
    const def = registry.get('meta-set-exif');
    await def.apply(ctx, { field: 'copyright', value: 'C' }, ctx2);
    await def.apply(ctx, { field: 'artist', value: 'A' }, ctx2);
    expect(ctx2._exifWrites.copyright).toBe('C');
    expect(ctx2._exifWrites.artist).toBe('A');
  });

  test('resolves {{vars}} in value before writing', async () => {
    const { ctx } = makeCanvas();
    const ctx2 = makeContext({ exif: { author: 'Alice' } });
    await registry.get('meta-set-exif').apply(
      ctx, { field: 'copyright', value: '© {{exif.author | "Owner"}}' }, ctx2
    );
    expect(ctx2._exifWrites.copyright).toBe('© Alice');
  });

  test('does not modify canvas pixels', async () => {
    const { ctx } = makeCanvas(10, 10, '#ff0000');
    const before = getPixel(ctx, 5, 5);
    const ctx2 = makeContext();
    await registry.get('meta-set-exif').apply(ctx, { field: 'artist', value: 'Test' }, ctx2);
    expect(getPixel(ctx, 5, 5)).toEqual(before);
  });
});

// ── meta-dominant-color ───────────────────────────────────────────────────────

describe('meta-dominant-color', () => {
  test('sets dominantHex.0 variable with a hex colour string', async () => {
    const { ctx } = makeCanvas(10, 10, '#ff0000'); // pure red canvas
    const ctx2 = makeContext();
    await registry.get('meta-dominant-color').apply(ctx, { ignoreNeutral: false, minAlpha: 0 }, ctx2);
    const val = ctx2.variables.get('dominantHex.0');
    expect(val).toBeTruthy();
    expect(val).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test('does not modify canvas pixels', async () => {
    const { ctx } = makeCanvas(10, 10, '#ff0000');
    const before = getPixel(ctx, 5, 5);
    const ctx2 = makeContext();
    await registry.get('meta-dominant-color').apply(ctx, { variable: 'dc' }, ctx2);
    expect(getPixel(ctx, 5, 5)).toEqual(before);
  });
});

// ── flow-save / flow-load ─────────────────────────────────────────────────────

describe('flow-save / flow-load', () => {
  test('flow-save stores canvas ImageData under the given label', async () => {
    const { ctx } = makeCanvas(100, 100);
    const ctx2 = makeContext();
    await registry.get('flow-save').apply(ctx, { label: 'my-state' }, ctx2);
    const saved = ctx2.variables.get('my-state');
    expect(saved).toBeTruthy();
    expect(saved.width).toBe(100);
    expect(saved.height).toBe(100);
  });

  test('flow-load restores canvas from saved state', async () => {
    // Save a red canvas
    const { canvas, ctx } = makeCanvas(100, 100, '#ff0000');
    const ctx2 = makeContext();
    await registry.get('flow-save').apply(ctx, { label: 'red-state' }, ctx2);

    // Paint canvas blue
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(0, 0, 100, 100);
    expect(getPixel(ctx, 50, 50).b).toBeGreaterThan(200);

    // Restore red state
    await registry.get('flow-load').apply(ctx, { label: 'red-state', blendMode: 'replace' }, ctx2);
    expect(getPixel(ctx, 50, 50).r).toBeGreaterThan(200);
    expect(getPixel(ctx, 50, 50).b).toBeLessThan(50);
  });

  test('flow-load does not crash when label missing', () => {
    const { ctx } = makeCanvas(100, 100);
    const ctx2 = makeContext();
    expect(() =>
      registry.get('flow-load').apply(ctx, { label: 'nonexistent', blendMode: 'replace' }, ctx2)
    ).not.toThrow();
  });
});

// ── Flow transforms — no-crash with default params ───────────────────────────
// Only include transforms that have a real apply() body (not Processor stubs).
// Processor-handled stubs (flow-export, flow-create-gif, etc.) return void
// immediately, which is fine — they're covered by registration tests.

const FLOW_NO_CRASH = [
  'flow-save',   // has real apply — saves ImageData
  'flow-load',   // has real apply — restores ImageData (tested above separately)
];

describe('Flow transforms — no-crash with defaults', () => {
  for (const id of FLOW_NO_CRASH) {
    test(id, () => {
      const def = registry.get(id);
      expect(def, `"${id}" not registered`).not.toBeNull();
      const { ctx } = makeCanvas();
      const ctx2 = makeContext();
      const defaults = Object.fromEntries(
        (def.params || []).map(p => [p.name, p.defaultValue ?? ''])
      );
      expect(() => def.apply(ctx, defaults, ctx2)).not.toThrow();
    });
  }
});
