import { describe, test, expect } from 'vitest';
import {
  createEmptySidecar,
  migrateSidecar,
  flattenSidecarVars,
  buildSidecarPatch,
  CURRENT_SIDECAR_VERSION,
  SIDECAR_SCHEMA_KEYS,
  SIDECAR_SCHEMA_GROUPS,
} from '../../../src/data/sidecar.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const v1Sidecar = {
  $version: 1,
  source: { filename: 'portrait.jpg', sizeBytes: 102400 },
  exif: { cameraMake: 'Canon', dateTaken: '2023-06-15' },
  geo: { city: 'London', country: 'UK', countryCode: 'GB', region: 'England' },
  annotation: { rating: 4, flag: 'pick', tags: ['travel', 'portrait'], caption: 'London bridge' },
  computed: {},
  processing: [],
};

// ── createEmptySidecar ────────────────────────────────────────────────────────

describe('createEmptySidecar', () => {
  test('stamps current schema version', () => {
    expect(createEmptySidecar().$version).toBe(CURRENT_SIDECAR_VERSION);
  });

  test('all required top-level sections present', () => {
    const s = createEmptySidecar();
    for (const key of ['source', 'exif', 'geo', 'annotation', 'asset', 'computed', 'processing']) {
      expect(s).toHaveProperty(key);
    }
  });

  test('annotation.tags is an empty array', () => {
    expect(createEmptySidecar().annotation.tags).toEqual([]);
  });

  test('annotation.usageScenarios is an empty array', () => {
    expect(createEmptySidecar().annotation.usageScenarios).toEqual([]);
  });

  test('processing is an empty array', () => {
    expect(createEmptySidecar().processing).toEqual([]);
  });

  test('asset.contentRating defaults to "general"', () => {
    expect(createEmptySidecar().asset.contentRating).toBe('general');
  });
});

// ── migrateSidecar ────────────────────────────────────────────────────────────

describe('migrateSidecar', () => {
  test('null input returns fully-defaulted sidecar without throwing', () => {
    expect(() => migrateSidecar(null)).not.toThrow();
    const result = migrateSidecar(null);
    expect(result.$version).toBe(CURRENT_SIDECAR_VERSION);
    expect(result.annotation.tags).toEqual([]);
  });

  test('non-object string input returns default sidecar', () => {
    const result = migrateSidecar('bad-input');
    expect(result.$version).toBe(CURRENT_SIDECAR_VERSION);
  });

  test('v1 sidecar gains annotation.usageScenarios', () => {
    const result = migrateSidecar(v1Sidecar);
    expect(result.annotation.usageScenarios).toEqual([]);
  });

  test('v1 sidecar gains asset.title and asset.contentRating', () => {
    const result = migrateSidecar(v1Sidecar);
    expect(result.asset.title).toBe('');
    expect(result.asset.contentRating).toBe('general');
  });

  test('existing annotation values are preserved during migration', () => {
    const result = migrateSidecar(v1Sidecar);
    expect(result.annotation.rating).toBe(4);
    expect(result.annotation.tags).toEqual(['travel', 'portrait']);
    expect(result.annotation.caption).toBe('London bridge');
  });

  test('existing geo values are preserved', () => {
    const result = migrateSidecar(v1Sidecar);
    expect(result.geo.city).toBe('London');
    expect(result.geo.countryCode).toBe('GB');
  });

  test('unknown top-level keys are preserved (no data loss)', () => {
    const data = { ...v1Sidecar, customKey: 'keep-me' };
    const result = migrateSidecar(data);
    expect(result.customKey).toBe('keep-me');
  });

  test('is idempotent — running twice produces the same result', () => {
    const once = migrateSidecar(v1Sidecar);
    const twice = migrateSidecar(once);
    expect(twice).toEqual(once);
  });

  test('$version is stamped to current version on output', () => {
    expect(migrateSidecar(v1Sidecar).$version).toBe(CURRENT_SIDECAR_VERSION);
  });

  test('empty object returns fully defaulted sidecar', () => {
    const result = migrateSidecar({});
    expect(result.$version).toBe(CURRENT_SIDECAR_VERSION);
    expect(result.annotation.tags).toEqual([]);
  });
});

// ── flattenSidecarVars ────────────────────────────────────────────────────────

describe('flattenSidecarVars', () => {
  test('city field available as sidecar.geo.city', () => {
    const vars = flattenSidecarVars({ geo: { city: 'Tokyo', country: 'Japan' } });
    expect(vars.get('sidecar.geo.city')).toBe('Tokyo');
  });

  test('tags array is joined with comma-space', () => {
    const vars = flattenSidecarVars({ annotation: { tags: ['nature', 'wildlife'] } });
    expect(vars.get('sidecar.annotation.tags')).toBe('nature, wildlife');
  });

  test('null values are omitted from the map', () => {
    const vars = flattenSidecarVars({ exif: { cameraMake: null, cameraModel: 'EOS 90D' } });
    expect(vars.has('sidecar.exif.cameraMake')).toBe(false);
    expect(vars.get('sidecar.exif.cameraModel')).toBe('EOS 90D');
  });

  test('$version meta field is skipped', () => {
    const vars = flattenSidecarVars({ $version: 2, geo: { city: 'X' } });
    for (const key of vars.keys()) {
      expect(key).not.toContain('$version');
    }
  });

  test('null input returns empty Map without throwing', () => {
    expect(() => flattenSidecarVars(null)).not.toThrow();
    expect(flattenSidecarVars(null).size).toBe(0);
  });

  test('numeric values are coerced to strings', () => {
    const vars = flattenSidecarVars({ annotation: { rating: 4 } });
    expect(vars.get('sidecar.annotation.rating')).toBe('4');
  });
});

// ── buildSidecarPatch ─────────────────────────────────────────────────────────

describe('buildSidecarPatch', () => {
  test('formValues override existing geo fields', () => {
    const existing = migrateSidecar({ ...v1Sidecar });
    const result = buildSidecarPatch(existing, { city: 'Paris' });
    expect(result.geo.city).toBe('Paris');
  });

  test('missing formValues fall back to existing sidecar values', () => {
    const existing = migrateSidecar(v1Sidecar);
    const result = buildSidecarPatch(existing, {});
    expect(result.annotation.rating).toBe(4);
  });

  test('null existing sidecar is handled gracefully', () => {
    expect(() => buildSidecarPatch(null, { rating: 3 })).not.toThrow();
  });
});

// ── SIDECAR_SCHEMA_KEYS / SIDECAR_SCHEMA_GROUPS consistency ──────────────────

describe('SIDECAR_SCHEMA_KEYS', () => {
  test('contains core required keys', () => {
    expect(SIDECAR_SCHEMA_KEYS).toContain('sidecar.annotation.rating');
    expect(SIDECAR_SCHEMA_KEYS).toContain('sidecar.geo.city');
    expect(SIDECAR_SCHEMA_KEYS).toContain('sidecar.exif.cameraMake');
    expect(SIDECAR_SCHEMA_KEYS).toContain('sidecar.source.filename');
  });
});

describe('SIDECAR_SCHEMA_GROUPS consistency', () => {
  test('every key in groups also appears in SIDECAR_SCHEMA_KEYS', () => {
    for (const group of SIDECAR_SCHEMA_GROUPS) {
      for (const { key } of group.keys) {
        expect(SIDECAR_SCHEMA_KEYS).toContain(key);
      }
    }
  });

  test('all groups have a title and at least one key', () => {
    for (const group of SIDECAR_SCHEMA_GROUPS) {
      expect(group.title).toBeTruthy();
      expect(group.keys.length).toBeGreaterThan(0);
    }
  });
});
