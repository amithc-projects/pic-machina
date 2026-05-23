/**
 * Zumilabs Studio — Capabilities & Requirements
 *
 * Centralises the logic for checking whether a transform's prerequisites are
 * met (e.g. a model has been downloaded, a Chrome flag is enabled).
 *
 * Each transform can declare a `requires` array in its registry.register()
 * call. This module evaluates those requirements asynchronously and caches
 * the results for the session, invalidating on known state changes.
 *
 * Requirement shape:
 *   { type: 'model'|'chrome-ai'|'flag'|'premium', id: string,
 *     label: string, actionHref: string }
 *
 * Adding a new requirement type: add one entry to RESOLVERS — nothing else.
 */

import { registry }       from './registry.js';
import { getModelRecord } from '../data/models.js';
import { flattenNodes }   from '../utils/nodes.js';

// ─── Session cache ────────────────────────────────────────
// Key: "type:id"  Value: boolean (met or not)
// Populated lazily on first check. Cleared selectively on known state changes
// (e.g. model downloaded / deleted in mdl.js).
const _cache = new Map();

// ─── Resolvers ────────────────────────────────────────────
// One async function per requirement type.  Returns true if the requirement
// is currently met, false otherwise.
const RESOLVERS = {
  /** Model downloaded to IndexedDB via the Model Manager */
  'model': async (req) => {
    const rec = await getModelRecord(req.id);
    return !!(rec?.bytes);
  },

  /** Chrome Built-in AI API (window.ai — experimental, Canary/Dev only) */
  'chrome-ai': async (_req) => {
    return typeof window !== 'undefined' && !!window.ai;
  },

  /** Chrome experimental flag enabled — no automatic detection possible;
   *  always returns false until the user confirms manually. */
  'flag': async (_req) => false,

  /** WICG experimental html-in-canvas capability.
   *
   *  Chrome's drawElement is only present on context instances created from a
   *  canvas that is attached to the DOM — it does NOT appear on
   *  CanvasRenderingContext2D.prototype.  We must do a live probe:
   *  create a minimal in-DOM canvas, get its 2D context, and test for the
   *  method there.  Clean up immediately afterwards. */
  'html-in-canvas': async (_req) => {
    try {
      // Manual override: user confirmed the flag is enabled via Settings
      const { getSettings } = await import('../utils/settings.js');
      if (getSettings().capabilities?.htmlInCanvasConfirmed) return true;

      // Use typeof rather than 'in' — Chrome exposes drawElement as a
      // non-enumerable own property on context instances, so the 'in'
      // operator may miss it.  Also avoid opacity:0 — hyperframe.js notes
      // that opacity on the canvas corrupts drawElement output, suggesting
      // the browser gates the method behind compositing state.
      const canvas = document.createElement('canvas');
      canvas.width  = 4;
      canvas.height = 4;
      // Off-screen, not opacity:0 — matches how hyperframe.js sets up its canvas
      canvas.style.cssText = 'position:fixed;top:-20px;left:-20px;pointer-events:none';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const supported = !!(ctx &&
        (typeof ctx.drawElement === 'function' ||
         typeof ctx.drawHTML    === 'function'));
      document.body.removeChild(canvas);
      return supported;
    } catch (_) {
      return false;
    }
  },

  /** Zumilabs Studio Pro licence (mocked via settings for now) */
  'premium': async (req) => {
    const { getSettings } = await import('../utils/settings.js');
    const s = getSettings();
    if (req.id === 'enterprise') return s.license === 'Enterprise';
    // 'pro' level gives access to Pro and Enterprise features
    return s.license === 'Pro' || s.license === 'Enterprise';
  },
};

// ─── Core check ──────────────────────────────────────────

/**
 * Check a single requirement, using the session cache where available.
 * @param {{ type: string, id: string, label: string, actionHref: string }} req
 * @returns {Promise<{ met: boolean, req: object }>}
 */
export async function checkRequirement(req) {
  const key = `${req.type}:${req.id}`;
  if (_cache.has(key)) return { met: _cache.get(key), req };

  const resolver = RESOLVERS[req.type];
  const met = resolver ? await resolver(req) : false;
  _cache.set(key, met);
  return { met, req };
}

/**
 * Check all requirements for a single transform.
 * @param {string} transformId
 * @returns {Promise<{ available: boolean, unmet: object[] }>}
 */
export async function checkTransformAvailability(transformId) {
  const def = registry.get(transformId);
  if (!def?.requires?.length) return { available: true, unmet: [] };

  const results = await Promise.all(def.requires.map(checkRequirement));
  const unmet   = results.filter(r => !r.met).map(r => r.req);
  return { available: unmet.length === 0, unmet };
}

/**
 * Check all requirements across every transform in a recipe's node tree,
 * plus any explicit recipe-level requirements.
 * Walks branches, conditionals, thenNodes, and elseNodes recursively via
 * flattenNodes(). Deduplicates unmet requirements by "type:id".
 * @param {{ nodes: object[], requires?: object[] }} recipe
 * @returns {Promise<{ available: boolean, unmet: object[] }>}
 */
export async function checkRecipeAvailability(recipe) {
  if (!recipe) return { available: true, unmet: [] };

  // Collect unique transformIds from the full node tree
  const flatItems  = recipe.nodes ? flattenNodes(recipe.nodes) : [];
  const seen       = new Set();
  const transformIds = [];
  for (const { node } of flatItems) {
    if (node.type === 'transform' && node.transformId && !seen.has(node.transformId)) {
      seen.add(node.transformId);
      transformIds.push(node.transformId);
    }
  }

  const checks = await Promise.all(transformIds.map(checkTransformAvailability));

  // Deduplicate unmet requirements across transforms by "type:id"
  const unmetMap = new Map();
  for (const { unmet } of checks) {
    for (const req of unmet) {
      unmetMap.set(`${req.type}:${req.id}`, req);
    }
  }

  // Also check top-level recipe requirements
  if (recipe.requires && Array.isArray(recipe.requires)) {
    const recipeResults = await Promise.all(recipe.requires.map(checkRequirement));
    for (const res of recipeResults) {
      if (!res.met) unmetMap.set(`${res.req.type}:${res.req.id}`, res.req);
    }
  }
  const unmet = [...unmetMap.values()];
  return { available: unmet.length === 0, unmet };
}

// ─── Startup: invalidate html-in-canvas so the live probe always runs fresh ──
// The prototype check returns false in current Chrome (drawElement only exists
// on DOM-attached context instances), so we must never serve a stale cached
// false across page loads.  Clearing it here costs one tiny DOM probe per
// session instead of silently showing a false warning forever.
_cache.delete('html-in-canvas:wicg-drawhtml');

// ─── Cache invalidation ───────────────────────────────────

/**
 * Invalidate the cached result for one specific requirement.
 * Call from mdl.js after a model is downloaded or deleted.
 * @param {string} type  e.g. 'model'
 * @param {string} id    e.g. 'inspyrenet-swinb-fp16'
 */
export function invalidate(type, id) {
  _cache.delete(`${type}:${id}`);
}

/**
 * Invalidate all cached model entries.
 * Belt-and-braces: call when entering/leaving #mdl to guarantee freshness.
 */
export function invalidateAllModels() {
  for (const key of _cache.keys()) {
    if (key.startsWith('model:')) _cache.delete(key);
  }
}
