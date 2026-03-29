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
