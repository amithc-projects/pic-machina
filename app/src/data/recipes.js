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
import { shadowWrite } from '../utils/backup.js';
import { generateBaselineThumbnail, generateSmartThumbnail } from '../utils/thumbnails.js';
import { getSettings } from '../utils/settings.js';

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
  shadowWrite('recipes'); // fire-and-forget
  return recipe;
}

export async function deleteRecipe(id) {
  await dbDelete('recipes', id);
  shadowWrite('recipes'); // fire-and-forget
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

// ─── Thumbnail ────────────────────────────────────────────

/**
 * Resize a File to a small JPEG and store it.
 * If a 'project_root' folder handle is available, it saves to samples/ or user-samples/.
 * Otherwise falls back to base64 in IndexedDB.
 * @param {string} recipeId
 * @param {File} file
 */
export async function setRecipeThumbnail(recipeId, file, opts = {}) {
  const recipe = await getRecipe(recipeId);
  if (!recipe) throw new Error(`Recipe ${recipeId} not found`);

  // GIFs must be stored as-is — running them through a canvas crop converts
  // them to a static JPEG and destroys the animation.
  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
  let dataUrl, blob, smart = false;

  if (isGif) {
    dataUrl = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    blob = file;
    try { opts.onBaseline?.(dataUrl); } catch { /* non-fatal */ }
  } else {
    // 1. Baseline cover-crop thumbnail (fast, no inference).
    ({ dataUrl, blob } = await generateBaselineThumbnail(file, { width: 480, height: 300 }));

    // Progressive-render hook: caller can update the DOM with this baseline
    // data URL immediately, then swap to the smart version when the smart
    // rebuild lands in IDB.
    try { opts.onBaseline?.(dataUrl); } catch { /* non-fatal */ }

    // 2. Optionally replace with a content-aware crop. Silently falls back if
    //    the model isn't downloaded or no subject is found.
    if (getSettings()?.thumbnails?.smart) {
      const smartResult = await generateSmartThumbnail(file, { width: 480, height: 300 });
      if (smartResult) {
        dataUrl = smartResult.dataUrl;
        blob    = smartResult.blob;
        smart   = true;
      }
    }
  }

  // 3. Always store as base64 data URL for reliable in-app display
  recipe.thumbnail = dataUrl;

  // 3. Also write to filesystem if project root is linked (for project organisation)
  try {
    const rootRecord = await dbGet('folders', 'project_root');
    if (rootRecord && rootRecord.handle) {
      const rootHandle = rootRecord.handle;
      const subDirType = recipe.isSystem ? 'samples' : 'user-samples';

      // Ensure we have permission
      if ((await rootHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        await rootHandle.requestPermission({ mode: 'readwrite' });
      }

      // Navigate to public then to the specific subfolder
      const publicHandle = await rootHandle.getDirectoryHandle('public', { create: true });
      const dirHandle = await publicHandle.getDirectoryHandle(subDirType, { create: true });

      const fileName = `${recipe.id}.jpg`;
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    }
  } catch (err) {
    console.warn('Failed to save thumbnail to filesystem:', err);
  }

  await saveRecipe(recipe);
  return { dataUrl, smart };
}

export async function clearRecipeThumbnail(recipeId) {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return;
  delete recipe.thumbnail;
  await saveRecipe(recipe);
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
