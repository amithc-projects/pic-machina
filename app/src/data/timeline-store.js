import { dbGet, dbGetAll, dbPut, dbDelete } from './db.js';

/**
 * Timeline Project Data Model
 * 
 * TimelineProject {
 *   id: string,
 *   name: string,
 *   fps: number,
 *   width: number,
 *   height: number,
 *   updatedAt: number,
 *   
 *   mediaPool: Array<{
 *     id: string,       // unique id for pool item
 *     fileHandle: any,  // File System Access API handle
 *     type: 'image' | 'video',
 *     thumbnail: string // base64 data uri or object url
 *   }>,
 *   
 *   videoTrack: Array<{
 *     id: string,
 *     poolId: string,   // ref to mediaPool item
 *     startTime: number, // time in timeline (seconds)
 *     duration: number,  // duration of clip (seconds)
 *     sourceStart: number, // trim start
 *     transitionOut: { type: string, duration: number } | null
 *   }>,
 *   
 *   effectTracks: Array<{
 *     id: string,
 *     name: string,
 *     blocks: Array<{
 *       id: string,
 *       transformId: string, // ref to registry transform
 *       startTime: number,
 *       duration: number,
 *       params: Record<string, any>,
 *       keyframes: Record<string, Array<{time: number, value: any}>> // Phase 2
 *     }>
 *   }>,
 *   
 *   audioTracks: Array<{
 *     id: string,
 *     name: string,
 *     blocks: Array<any>
 *   }>
 * }
 */

export function createEmptyTimeline() {
  return {
    id: 'tme_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name: 'Untitled Project',
    fps: 30,
    width: 1920,
    height: 1080,
    updatedAt: Date.now(),
    mediaPool: [],
    videoTrack: [],
    effectTracks: [
      { id: 'fx1', name: 'FX 1', blocks: [] }
    ],
    audioTracks: [
      { id: 'a1', name: 'A1', blocks: [] }
    ]
  };
}

export async function saveTimeline(timeline) {
  timeline.updatedAt = Date.now();
  await dbPut('timelines', timeline);
  return timeline;
}

export async function getTimeline(id) {
  return await dbGet('timelines', id);
}

export async function getAllTimelines() {
  return await dbGetAll('timelines');
}

export async function deleteTimeline(id) {
  return await dbDelete('timelines', id);
}
