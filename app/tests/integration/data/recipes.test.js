import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/data/system-recipes.js', () => ({ SYSTEM_RECIPES: [] }));
vi.mock('../../../src/data/system-blocks.js',  () => ({ SYSTEM_BLOCKS: [] }));
vi.mock('../../../src/utils/backup.js', () => ({
  shadowWrite: vi.fn(() => Promise.resolve()),
  shadowRestore: () => Promise.resolve(false),
}));
vi.mock('../../../src/utils/settings.js', () => ({
  getSettings: () => ({ license: 'Free', thumbnails: { smart: false } }),
}));
vi.mock('../../../src/utils/thumbnails.js', () => ({
  generateBaselineThumbnail: async () => null,
  generateSmartThumbnail: async () => null,
}));

import { initDB } from '../../../src/data/db.js';
import {
  saveRecipe, getRecipe, getAllRecipes, getUserRecipes, getSystemRecipes,
  cloneRecipe, deleteRecipe, scheduleAutosave, cancelAutosave, flushAutosave,
} from '../../../src/data/recipes.js';

beforeEach(async () => {
  await initDB();
});

const baseRecipe = () => ({
  name: 'Test Recipe',
  nodes: [{ id: 'n1', type: 'transform', transformId: 'color-tuning', params: {} }],
  tags: [],
  isSystem: false,
});

describe('saveRecipe', () => {
  test('auto-assigns id, createdAt, updatedAt on first save', async () => {
    const recipe = await saveRecipe(baseRecipe());
    expect(recipe.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(recipe.createdAt).toBeGreaterThan(0);
    expect(recipe.updatedAt).toBeGreaterThan(0);
  });

  test('preserves createdAt on re-save, updates updatedAt', async () => {
    const recipe = await saveRecipe(baseRecipe());
    const originalCreatedAt = recipe.createdAt;
    await new Promise(r => setTimeout(r, 2));
    recipe.name = 'Updated';
    await saveRecipe(recipe);
    const reloaded = await getRecipe(recipe.id);
    expect(reloaded.createdAt).toBe(originalCreatedAt);
    expect(reloaded.updatedAt).toBeGreaterThanOrEqual(reloaded.createdAt);
  });

  test('overwrites existing record on re-save with same id', async () => {
    const recipe = await saveRecipe(baseRecipe());
    recipe.name = 'Renamed';
    await saveRecipe(recipe);
    const loaded = await getRecipe(recipe.id);
    expect(loaded.name).toBe('Renamed');
  });
});

describe('getRecipe', () => {
  test('returns null for non-existent id', async () => {
    expect(await getRecipe('no-such-id')).toBeNull();
  });

  test('returns the saved recipe', async () => {
    const saved = await saveRecipe(baseRecipe());
    const loaded = await getRecipe(saved.id);
    expect(loaded.name).toBe('Test Recipe');
  });
});

describe('getUserRecipes / getSystemRecipes', () => {
  test('getUserRecipes returns only non-system recipes', async () => {
    await saveRecipe({ ...baseRecipe(), isSystem: false });
    await saveRecipe({ id: 'sys-1', ...baseRecipe(), isSystem: true, updatedAt: Date.now(), createdAt: Date.now() });
    const user = await getUserRecipes();
    expect(user.every(r => !r.isSystem)).toBe(true);
    expect(user.length).toBeGreaterThanOrEqual(1);
  });

  test('getSystemRecipes returns only system recipes', async () => {
    await saveRecipe({ id: 'sys-2', ...baseRecipe(), isSystem: true, updatedAt: Date.now(), createdAt: Date.now() });
    const system = await getSystemRecipes();
    expect(system.every(r => r.isSystem)).toBe(true);
  });
});

describe('cloneRecipe', () => {
  test('creates a deep copy with new id and specified name', async () => {
    const original = await saveRecipe(baseRecipe());
    const clone = await cloneRecipe(original.id, 'My Clone');
    expect(clone.id).not.toBe(original.id);
    expect(clone.name).toBe('My Clone');
    expect(clone.isSystem).toBe(false);
  });

  test('modifying clone nodes does not affect original', async () => {
    const original = await saveRecipe(baseRecipe());
    const clone = await cloneRecipe(original.id, 'Clone');
    clone.nodes.push({ id: 'new-node', type: 'transform', transformId: 'geo-resize', params: {} });
    await saveRecipe(clone);
    const reloaded = await getRecipe(original.id);
    expect(reloaded.nodes).toHaveLength(1); // original unchanged
  });

  test('throws when source recipe not found', async () => {
    await expect(cloneRecipe('nonexistent-id', 'Copy')).rejects.toThrow();
  });
});

describe('deleteRecipe', () => {
  test('removes recipe from DB', async () => {
    const recipe = await saveRecipe(baseRecipe());
    await deleteRecipe(recipe.id);
    expect(await getRecipe(recipe.id)).toBeNull();
  });
});

describe('scheduleAutosave / cancelAutosave', () => {
  test('cancelAutosave prevents callback from firing', () => {
    // Fully synchronous timer test — cancel immediately, callback never fires.
    vi.useFakeTimers();
    const callback = vi.fn();
    const recipe = { id: 'as-cancel', name: 'R', nodes: [], isSystem: false, createdAt: 1, updatedAt: 1 };
    scheduleAutosave(recipe, callback);
    cancelAutosave();
    vi.advanceTimersByTime(6000);
    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  test('flushAutosave immediately persists a pending autosave', async () => {
    const r = await saveRecipe({ ...baseRecipe(), name: 'Flush Target' });
    r.name = 'After Flush';
    scheduleAutosave(r, () => {}); // schedules a 5s save
    await flushAutosave(r);         // immediately flushes it
    const loaded = await getRecipe(r.id);
    expect(loaded.name).toBe('After Flush');
  });
});
