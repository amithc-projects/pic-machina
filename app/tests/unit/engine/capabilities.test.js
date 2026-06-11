import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock models.js before importing capabilities
vi.mock('../../../src/data/models.js', () => ({
  getModelRecord: vi.fn(async () => null),
}));

vi.mock('../../../src/utils/settings.js', () => ({
  getSettings: vi.fn(() => ({ license: 'Free', capabilities: {} })),
}));

import {
  checkRequirement,
  checkTransformAvailability,
  checkRecipeAvailability,
  invalidate,
  invalidateAllModels,
} from '../../../src/engine/capabilities.js';

import { getModelRecord } from '../../../src/data/models.js';
import { registry } from '../../../src/engine/registry.js';

beforeEach(() => {
  // Clear module-level cache between tests by invalidating all known keys
  invalidateAllModels();
  vi.clearAllMocks();
});

describe('checkRequirement — model type', () => {
  test('returns false when getModelRecord returns null (not downloaded)', async () => {
    getModelRecord.mockResolvedValue(null);
    const result = await checkRequirement({ type: 'model', id: 'test-model', label: 'Test', actionHref: '#' });
    expect(result.met).toBe(false);
  });

  test('returns true when model record has bytes', async () => {
    getModelRecord.mockResolvedValue({ id: 'test-model', bytes: new ArrayBuffer(100) });
    const result = await checkRequirement({ type: 'model', id: 'test-model', label: 'Test', actionHref: '#' });
    expect(result.met).toBe(true);
  });

  test('result is cached on second call', async () => {
    getModelRecord.mockResolvedValue(null);
    const req = { type: 'model', id: 'cached-model', label: 'X', actionHref: '#' };
    await checkRequirement(req);
    await checkRequirement(req);
    expect(getModelRecord).toHaveBeenCalledTimes(1);
  });
});

describe('checkRequirement — flag type', () => {
  test('always returns false (cannot auto-detect)', async () => {
    const result = await checkRequirement({ type: 'flag', id: 'some-flag' });
    expect(result.met).toBe(false);
  });
});

describe('checkRequirement — unknown type', () => {
  test('returns false gracefully without throwing', async () => {
    const result = await checkRequirement({ type: 'unknown-type', id: 'x' });
    expect(result.met).toBe(false);
  });
});

describe('invalidate', () => {
  test('clears cache so resolver runs again on next call', async () => {
    getModelRecord.mockResolvedValue(null);
    const req = { type: 'model', id: 'inv-model', label: 'X', actionHref: '#' };

    await checkRequirement(req); // caches false
    expect(getModelRecord).toHaveBeenCalledTimes(1);

    getModelRecord.mockResolvedValue({ id: 'inv-model', bytes: new ArrayBuffer(1) });
    invalidate('model', 'inv-model');

    const result = await checkRequirement(req); // should re-run resolver
    expect(result.met).toBe(true);
    expect(getModelRecord).toHaveBeenCalledTimes(2);
  });
});

describe('checkTransformAvailability', () => {
  test('available: true when transform has no requires array', async () => {
    registry.register({ id: 'no-reqs-test', name: 'No Reqs', category: 'Test',
      categoryKey: 'test', icon: 'x', params: [], apply: () => {} });
    const result = await checkTransformAvailability('no-reqs-test');
    expect(result.available).toBe(true);
    expect(result.unmet).toHaveLength(0);
  });

  test('available: false when required model is missing', async () => {
    getModelRecord.mockResolvedValue(null);
    registry.register({
      id: 'needs-model-test', name: 'Needs Model', category: 'Test',
      categoryKey: 'test', icon: 'x', params: [], apply: () => {},
      requires: [{ type: 'model', id: 'some-model-x', label: 'Some Model', actionHref: '#' }],
    });
    const result = await checkTransformAvailability('needs-model-test');
    expect(result.available).toBe(false);
    expect(result.unmet).toHaveLength(1);
  });

  test('returns available: true for unknown transform id', async () => {
    const result = await checkTransformAvailability('totally-nonexistent');
    expect(result.available).toBe(true);
  });
});

describe('checkRecipeAvailability', () => {
  test('null recipe returns available: true', async () => {
    const result = await checkRecipeAvailability(null);
    expect(result.available).toBe(true);
    expect(result.unmet).toHaveLength(0);
  });

  test('recipe with no nodes returns available: true', async () => {
    const result = await checkRecipeAvailability({ nodes: [] });
    expect(result.available).toBe(true);
  });

  test('deduplicates same unmet requirement across multiple nodes', async () => {
    getModelRecord.mockResolvedValue(null);
    const req = { type: 'model', id: 'shared-model', label: 'Shared', actionHref: '#' };
    registry.register({ id: 'tr-shared-1', name: 'T1', category: 'Test', categoryKey: 'test',
      icon: 'x', params: [], apply: () => {}, requires: [req] });
    registry.register({ id: 'tr-shared-2', name: 'T2', category: 'Test', categoryKey: 'test',
      icon: 'x', params: [], apply: () => {}, requires: [req] });

    const recipe = {
      nodes: [
        { id: 'n1', type: 'transform', transformId: 'tr-shared-1' },
        { id: 'n2', type: 'transform', transformId: 'tr-shared-2' },
      ],
    };
    invalidate('model', 'shared-model');
    const result = await checkRecipeAvailability(recipe);
    expect(result.available).toBe(false);
    expect(result.unmet).toHaveLength(1); // deduplicated
  });
});
