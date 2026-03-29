/**
 * ImageChef — Block CRUD
 *
 * A Block is a reusable sub-recipe. Shape:
 * {
 *   id:          string,
 *   name:        string,
 *   description: string,
 *   category:    string,    // user-defined tag e.g. "Color", "Privacy"
 *   nodes:       RecipeNode[],
 *   createdAt:   number,
 *   updatedAt:   number,
 * }
 */

import { dbGet, dbGetAll, dbPut, dbDelete } from './db.js';
import { uuid, now } from '../utils/misc.js';

export function getAllBlocks()    { return dbGetAll('blocks'); }
export function getBlock(id)     { return dbGet('blocks', id); }

export async function saveBlock(block) {
  if (!block.id) block.id = uuid();
  block.updatedAt = now();
  if (!block.createdAt) block.createdAt = block.updatedAt;
  await dbPut('blocks', block);
  return block;
}

export function deleteBlock(id) { return dbDelete('blocks', id); }

export async function cloneBlock(id, newName) {
  const src = await getBlock(id);
  if (!src) throw new Error(`Block ${id} not found`);
  const clone = {
    ...JSON.parse(JSON.stringify(src)),
    id:        uuid(),
    name:      newName ?? `${src.name} (copy)`,
    createdAt: now(),
    updatedAt: now(),
  };
  await dbPut('blocks', clone);
  return clone;
}
