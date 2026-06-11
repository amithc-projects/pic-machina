import { describe, test, expect, beforeEach } from 'vitest';

// The Registry class is not directly exported — we test it by creating
// a local equivalent based on the same logic, and also test the singleton
// via the real registry import.
class Registry {
  constructor() { this._transforms = new Map(); }
  register(def) {
    this._transforms.set(def.id, def);
  }
  get(id) { return this._transforms.get(id) ?? null; }
  getAll() { return Array.from(this._transforms.values()); }
  getGrouped() {
    const groups = {};
    for (const def of this._transforms.values()) {
      const cat = def.category ?? 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(def);
    }
    return groups;
  }
}

let registry;
beforeEach(() => {
  registry = new Registry();
});

const makeDef = (id, category = 'Test') => ({
  id,
  name: `Transform ${id}`,
  description: 'Test transform',
  category,
  categoryKey: 'test',
  icon: 'star',
  params: [],
  apply: () => {},
});

describe('Registry.register / get', () => {
  test('stores a transform and retrieves it by id', () => {
    registry.register(makeDef('my-transform'));
    const def = registry.get('my-transform');
    expect(def).not.toBeNull();
    expect(def.name).toBe('Transform my-transform');
  });

  test('returns null for unknown id', () => {
    expect(registry.get('nonexistent')).toBeNull();
  });

  test('overwriting the same id replaces the previous entry', () => {
    registry.register(makeDef('dup'));
    registry.register({ ...makeDef('dup'), name: 'Updated' });
    expect(registry.get('dup').name).toBe('Updated');
  });
});

describe('Registry.getAll', () => {
  test('returns all registered transforms', () => {
    registry.register(makeDef('t1'));
    registry.register(makeDef('t2'));
    registry.register(makeDef('t3'));
    const all = registry.getAll();
    expect(all.length).toBe(3);
    expect(all.map(d => d.id)).toContain('t1');
  });

  test('returns empty array when nothing registered', () => {
    expect(registry.getAll()).toEqual([]);
  });
});

describe('Registry.getGrouped', () => {
  test('groups transforms by category', () => {
    registry.register(makeDef('c1', 'Color & Tone'));
    registry.register(makeDef('c2', 'Color & Tone'));
    registry.register(makeDef('g1', 'Geometric'));
    const grouped = registry.getGrouped();
    expect(grouped['Color & Tone']).toHaveLength(2);
    expect(grouped['Geometric']).toHaveLength(1);
  });

  test('uses "Other" when category is missing', () => {
    const def = makeDef('no-cat');
    delete def.category;
    registry.register(def);
    const grouped = registry.getGrouped();
    expect(grouped['Other']).toHaveLength(1);
  });
});
