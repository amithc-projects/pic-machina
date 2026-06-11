/**
 * Integration tests for src/data/db.js
 * Uses fake-indexeddb to intercept IndexedDB calls — no real browser needed.
 */
import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock heavy side-effect imports that db.js triggers at init time
vi.mock('../../../src/data/system-recipes.js', () => ({ SYSTEM_RECIPES: [] }));
vi.mock('../../../src/data/system-blocks.js',  () => ({ SYSTEM_BLOCKS: [] }));
vi.mock('../../../src/utils/backup.js', () => ({
  shadowWrite: () => Promise.resolve(),
  shadowRestore: () => Promise.resolve(false),
}));
vi.mock('../../../src/utils/settings.js', () => ({
  getSettings: () => ({ license: 'Free', thumbnails: { smart: false } }),
}));
vi.mock('../../../src/utils/thumbnails.js', () => ({
  generateBaselineThumbnail: async () => null,
  generateSmartThumbnail: async () => null,
}));

import {
  initDB,
  dbGet,
  dbGetAll,
  dbPut,
  dbDelete,
  dbGetAllByIndex,
  dbSaveFolderHistory,
  dbGetFolderHistory,
} from '../../../src/data/db.js';

// Re-open a fresh DB per test by resetting the module singleton
beforeEach(async () => {
  // fake-indexeddb auto-resets between module re-imports; we re-init each time
  await initDB();
});

describe('initDB', () => {
  test('completes without throwing', async () => {
    await expect(initDB()).resolves.not.toThrow();
  });
});

describe('dbPut + dbGet', () => {
  test('round-trips a recipe record', async () => {
    const recipe = { id: 'r1', name: 'My Recipe', nodes: [], createdAt: 1000, updatedAt: 1000 };
    await dbPut('recipes', recipe);
    const retrieved = await dbGet('recipes', 'r1');
    expect(retrieved).toMatchObject({ id: 'r1', name: 'My Recipe' });
  });

  test('dbGet returns null for non-existent key', async () => {
    const result = await dbGet('recipes', 'does-not-exist');
    expect(result).toBeNull();
  });

  test('round-trips an asset record', async () => {
    const asset = { hash: 'abc123', filename: 'photo.jpg', ingestedAt: Date.now() };
    await dbPut('assets', asset);
    const retrieved = await dbGet('assets', 'abc123');
    expect(retrieved.filename).toBe('photo.jpg');
  });
});

describe('dbGetAll', () => {
  test('returns all records from a store', async () => {
    await dbPut('assets', { hash: 'h1', filename: 'a.jpg', ingestedAt: 1 });
    await dbPut('assets', { hash: 'h2', filename: 'b.jpg', ingestedAt: 2 });
    const all = await dbGetAll('assets');
    const ids = all.map(r => r.hash);
    expect(ids).toContain('h1');
    expect(ids).toContain('h2');
  });
});

describe('dbDelete', () => {
  test('removes record; subsequent get returns null', async () => {
    await dbPut('assets', { hash: 'del-me', filename: 'x.jpg', ingestedAt: 1 });
    await dbDelete('assets', 'del-me');
    expect(await dbGet('assets', 'del-me')).toBeNull();
  });
});

describe('dbGetAllByIndex', () => {
  test('retrieves records by index value', async () => {
    await dbPut('runs', { id: 'run-1', recipeId: 'rec-1', startedAt: 1 });
    await dbPut('runs', { id: 'run-2', recipeId: 'rec-1', startedAt: 2 });
    await dbPut('runs', { id: 'run-3', recipeId: 'rec-2', startedAt: 3 });
    const runs = await dbGetAllByIndex('runs', 'recipeId', 'rec-1');
    expect(runs).toHaveLength(2);
    expect(runs.map(r => r.id)).toContain('run-1');
    expect(runs.map(r => r.id)).toContain('run-2');
  });
});

describe('dbSaveFolderHistory / dbGetFolderHistory', () => {
  const makeHandle = (name) => ({ name, kind: 'directory' });

  test('saves a handle and retrieves it', async () => {
    await dbSaveFolderHistory('input', makeHandle('MyFolder'));
    const history = await dbGetFolderHistory('input');
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].name).toBe('MyFolder');
  });

  test('caps history at 5 entries', async () => {
    for (let i = 0; i < 6; i++) {
      await dbSaveFolderHistory('input', makeHandle(`Folder${i}`));
    }
    const history = await dbGetFolderHistory('input');
    expect(history).toHaveLength(5);
  });

  test('bubbles a repeated handle to the top', async () => {
    await dbSaveFolderHistory('input', makeHandle('A'));
    await dbSaveFolderHistory('input', makeHandle('B'));
    await dbSaveFolderHistory('input', makeHandle('C'));
    await dbSaveFolderHistory('input', makeHandle('A')); // re-add A
    const history = await dbGetFolderHistory('input');
    expect(history[0].name).toBe('A');
  });

  test('empty history returns empty array', async () => {
    const history = await dbGetFolderHistory('output');
    expect(history).toEqual([]);
  });
});
