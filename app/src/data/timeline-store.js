import { saveProject } from '../utils/project-io.js';

export function createEmptyTimeline(name = 'Untitled Project') {
  return {
    id: 'tme_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name,
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

export async function saveTimeline(timeline, dirHandle) {
  if (!dirHandle) throw new Error('Cannot save timeline without a project directory handle.');
  timeline.updatedAt = Date.now();
  await saveProject(dirHandle, timeline);
  return timeline;
}
