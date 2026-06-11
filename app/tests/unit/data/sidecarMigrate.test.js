import { describe, test, expect } from 'vitest';
import { migrateSidecarFiles } from '../../../src/data/sidecarMigrate.js';

/**
 * Creates a minimal in-memory mock of FileSystemDirectoryHandle.
 * files: { [name]: string } — initial file contents
 */
function makeMockDir(files = {}) {
  const store = { ...files }; // name → content

  return {
    async getFileHandle(name, opts = {}) {
      if (!store[name] && !opts.create) {
        throw new DOMException(`File not found: ${name}`, 'NotFoundError');
      }
      if (!store[name]) store[name] = '';

      return {
        async getFile() {
          return { async text() { return store[name]; } };
        },
        async createWritable() {
          return {
            async write(data) { store[name] = data; },
            async close() {},
          };
        },
      };
    },
    async removeEntry(name) {
      delete store[name];
    },
    async *entries() {
      for (const [name] of Object.entries(store)) {
        yield [name, { kind: 'file', name }];
      }
    },
    _store: store, // for assertions
  };
}

describe('migrateSidecarFiles', () => {
  test('null dirHandle returns empty result without throwing', async () => {
    const result = await migrateSidecarFiles(null);
    expect(result).toEqual({ renamed: [], skipped: [], errors: [] });
  });

  test('renames photo.jpg.json to .photo.jpg (strips .json, adds dot-prefix)', async () => {
    // sidecarMigrate converts old suffix format: photo.jpg.json → .photo.jpg
    const dir = makeMockDir({ 'photo.jpg.json': '{"$version":1}' });
    const result = await migrateSidecarFiles(dir);
    expect(result.renamed).toHaveLength(1);
    expect(result.renamed[0]).toBe('photo.jpg.json → .photo.jpg');
    expect(dir._store['.photo.jpg']).toBe('{"$version":1}');
    expect(dir._store['photo.jpg.json']).toBeUndefined();
  });

  test('skips when dot-prefix version already exists', async () => {
    const dir = makeMockDir({
      'photo.jpg.json': '{"$version":1}',
      '.photo.jpg': '{"$version":2}',  // dot-prefix already present
    });
    const result = await migrateSidecarFiles(dir);
    expect(result.skipped).toContain('photo.jpg.json');
    expect(result.renamed).toHaveLength(0);
    expect(dir._store['.photo.jpg']).toBe('{"$version":2}');
  });

  test('does not rename plain config.json (no media extension in base)', async () => {
    const dir = makeMockDir({ 'config.json': '{}' });
    const result = await migrateSidecarFiles(dir);
    expect(result.renamed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  test('handles multiple files in one pass', async () => {
    const dir = makeMockDir({
      'a.jpg.json': '{}',
      'b.png.json': '{}',
      '.c.mp4': '{}', // already dot-prefix — should be untouched
      'config.json': '{}', // plain JSON — should be untouched
    });
    const result = await migrateSidecarFiles(dir);
    expect(result.renamed).toHaveLength(2);
    expect(dir._store['.a.jpg']).toBeDefined();
    expect(dir._store['.b.png']).toBeDefined();
    expect(dir._store['.c.mp4']).toBe('{}'); // unchanged
    expect(dir._store['config.json']).toBe('{}'); // unchanged
  });

  test('preserves file content during rename', async () => {
    const content = '{"$version":1,"annotation":{"rating":5}}';
    const dir = makeMockDir({ 'test.jpg.json': content });
    await migrateSidecarFiles(dir);
    expect(dir._store['.test.jpg']).toBe(content);
  });
});
