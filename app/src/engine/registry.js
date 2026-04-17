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

  /**
   * Dumps current state of all nodes (excluding the apply functions)
   * into a JSON format for use with the Claude Skill prompt.
   * Can be run via console: `await import('./src/engine/registry.js').then(m => m.registry.dumpMetadata())`
   */
  dumpMetadata() {
    const data = this.getAll().map(def => {
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        category: def.category,
        icon: def.icon,
        params: (def.params || []).map(p => {
          const pData = {
            name: p.name,
            label: p.label,
            type: p.type
          };
          if ('defaultValue' in p) pData.defaultValue = p.defaultValue;
          if ('options' in p) pData.options = p.options.map(o => ({ label: o.label, value: o.value }));
          return pData;
        })
      };
    });
    const str = JSON.stringify(data, null, 2);
    console.log(`Dumping ${data.length} nodes to console...`);
    console.log(str);
    return str;
  }
}

export const registry = new Registry();
