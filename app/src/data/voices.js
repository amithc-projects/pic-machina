import { dbGetAll, dbPut, dbDelete } from './db.js';

export async function getCustomVoices() {
  try {
    return await dbGetAll('voices');
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function saveCustomVoice(id, name, audioBuffer) {
  const record = {
    id,
    name,
    bytes: audioBuffer, // Float32Array or ArrayBuffer
    createdAt: Date.now()
  };
  await dbPut('voices', record);
  return record;
}

export async function deleteCustomVoice(id) {
  await dbDelete('voices', id);
}
