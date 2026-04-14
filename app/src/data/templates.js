import { dbGet, dbGetAll, dbPut, dbDelete } from './db.js';
import { uuid, now } from '../utils/misc.js';
import { shadowWrite } from '../utils/backup.js';

export async function getTemplate(id) {
  return dbGet('templates', id);
}

export async function getAllTemplates() {
  const templates = await dbGetAll('templates');
  return templates.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function saveTemplate(template) {
  template.updatedAt = now();
  if (!template.createdAt) template.createdAt = template.updatedAt;
  await dbPut('templates', template);
  shadowWrite('templates'); // fire-and-forget
  return template;
}

export async function deleteTemplate(id) {
  await dbDelete('templates', id);
  shadowWrite('templates'); // fire-and-forget
}

export function createEmptyTemplate() {
  return {
    id: uuid(),
    name: 'Untitled Template',
    width: 1920,
    height: 1080,
    backgroundBlob: null,
    placeholders: [], // Array of { id, zIndex, fitMode, points: [{x,y}, {x,y}, {x,y}, {x,y}] }
    createdAt: now(),
    updatedAt: now()
  };
}
