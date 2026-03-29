/**
 * ImageChef — Transformation Registry
 * Central store for all available transform definitions.
 */

class Registry {
  constructor() {
    this._transforms = new Map();
  }

  register(def) {
    if (this._transforms.has(def.id)) {
      console.warn(`[registry] Overwriting transform "${def.id}"`);
    }
    this._transforms.set(def.id, def);
  }

  get(id) { return this._transforms.get(id) ?? null; }

  getAll() { return Array.from(this._transforms.values()); }

  /** Returns transforms grouped by category for the chooser sidebar. */
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

export const registry = new Registry();
