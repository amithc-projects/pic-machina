/**
 * ImageChef — Recipe CRUD
 *
 * A Recipe has the shape:
 * {
 *   id:          string (uuid),
 *   name:        string,
 *   description: string,
 *   isSystem:    boolean,
 *   coverId:     string | null,   // blob key in 'assets' store (future) or null
 *   coverColor:  string,          // fallback gradient colour
 *   tags:        string[],
 *   nodes:       RecipeNode[],    // ordered tree of nodes
 *   createdAt:   number,          // epoch ms
 *   updatedAt:   number,
 * }
 *
 * RecipeNode: see engine/types.js
 */

import { dbGet, dbGetAll, dbPut, dbDelete } from './db.js';
import { uuid, now } from '../utils/misc.js';

// ─── Read ─────────────────────────────────────────────────

export function getAllRecipes() {
  return dbGetAll('recipes');
}

export function getRecipe(id) {
  return dbGet('recipes', id);
}

export async function getSystemRecipes() {
  const all = await dbGetAll('recipes');
  return all.filter(r => r.isSystem);
}

export async function getUserRecipes() {
  const all = await dbGetAll('recipes');
  return all.filter(r => !r.isSystem);
}

// ─── Write ────────────────────────────────────────────────

export async function saveRecipe(recipe) {
  if (!recipe.id) recipe.id = uuid();
  recipe.updatedAt = now();
  if (!recipe.createdAt) recipe.createdAt = recipe.updatedAt;
  await dbPut('recipes', recipe);
  return recipe;
}

export function deleteRecipe(id) {
  return dbDelete('recipes', id);
}

export async function cloneRecipe(id, newName) {
  const src = await getRecipe(id);
  if (!src) throw new Error(`Recipe ${id} not found`);
  const clone = {
    ...JSON.parse(JSON.stringify(src)),
    id:       uuid(),
    name:     newName ?? `${src.name} (copy)`,
    isSystem: false,
    createdAt: now(),
    updatedAt: now(),
  };
  await dbPut('recipes', clone);
  return clone;
}

// ─── Auto-save debouncer ─────────────────────────────────
let _autosaveTimer = null;
export function scheduleAutosave(recipe, callback) {
  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(async () => {
    await saveRecipe(recipe);
    callback?.();
  }, 5000);
}

export function flushAutosave(recipe) {
  clearTimeout(_autosaveTimer);
  return saveRecipe(recipe);
}

// ─── Bundling (Export/Import) ───────────────────────────

/**
 * Creates a self-contained bundle for a recipe, including all nested blocks.
 */
export async function getRecipeBundle(recipeId) {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return null;

  const blockIds = new Set();
  const collectBlocks = (nodes) => {
    if (!nodes) return;
    nodes.forEach(n => {
      if (n.type === 'block-ref' && n.blockId) blockIds.add(n.blockId);
      if (n.branches) n.branches.forEach(b => collectBlocks(b.nodes));
      if (n.thenNodes) collectBlocks(n.thenNodes);
      if (n.elseNodes) collectBlocks(n.elseNodes);
    });
  };
  collectBlocks(recipe.nodes);

  const { getBlock } = await import('./blocks.js');
  const blocks = {};
  for (const id of blockIds) {
    const b = await getBlock(id);
    if (b) blocks[id] = b;
  }

  return {
    type: 'PicMachinaRecipeBundle',
    version: 1,
    recipe,
    blocks
  };
}

/**
 * Imports a recipe bundle, saving blocks first then the recipe.
 */
export async function saveRecipeBundle(bundle) {
  if (bundle.type !== 'PicMachinaRecipeBundle') throw new Error('Invalid recipe bundle format');

  const { saveBlock } = await import('./blocks.js');

  // Save blocks first
  if (bundle.blocks) {
    for (const id in bundle.blocks) {
      await saveBlock(bundle.blocks[id]);
    }
  }

  // Save recipe
  return saveRecipe(bundle.recipe);
}
