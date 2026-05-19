/**
 * IME — Image Editor entry point.
 *
 * Reuses an existing transient recipe across sessions so state is preserved
 * when navigating away and back. Creates one on first visit.
 */

import { navigate } from '../main.js';
import { getAllRecipes, saveRecipe } from '../data/recipes.js';
import { uuid, now } from '../utils/misc.js';

export async function render(_container, _hash) {
  const all = await getAllRecipes();
  let transient = all.find(r => r._transient);
  if (!transient) {
    const ts = now();
    transient = { id: uuid(), name: 'Image Editor', nodes: [], _transient: true, createdAt: ts, updatedAt: ts };
    await saveRecipe(transient);
  }
  navigate(`#bld?id=${transient.id}&transient=1`);
}
