/**
 * Shared video-frame utilities for preview/thumbnail rendering.
 */

const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);

export function isVideoFile(file) {
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  return VIDEO_EXTS.has(ext);
}

/**
 * Seek a video to ~3 s (or 40% of its duration, whichever is smaller) and
 * return an HTMLCanvasElement with that frame drawn onto it.
 *
 * @param {string|File} source  A blob URL string or a File object.
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function extractVideoFrame(source) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const ownUrl = typeof source !== 'string';

  const video = document.createElement('video');
  video.muted   = true;
  video.preload = 'metadata';
  video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px';
  document.body.appendChild(video);

  try {
    await new Promise((res, rej) => {
      video.onloadedmetadata = res;
      video.onerror = () => rej(new Error('Video metadata load failed'));
      video.src = url;
      video.load();
    });

    const seekTo = Math.min(3, video.duration * 0.4);
    await new Promise((res, rej) => {
      video.onseeked = res;
      video.onerror  = () => rej(new Error('Video seek failed'));
      video.currentTime = seekTo;
    });

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas;
  } finally {
    document.body.removeChild(video);
    if (ownUrl) URL.revokeObjectURL(url);
  }
}

/**
 * Get the duration (seconds) and dimensions of a video file.
 * @param {File} file
 * @returns {Promise<{duration:number, width:number, height:number}>}
 */
export async function getVideoDuration(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'metadata';
  video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px';
  document.body.appendChild(video);
  try {
    await new Promise((res, rej) => {
      video.onloadedmetadata = res;
      video.onerror = () => rej(new Error('Video metadata load failed'));
      video.src = url;
      video.load();
    });
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  } finally {
    document.body.removeChild(video);
    URL.revokeObjectURL(url);
  }
}

/**
 * Extract a filmstrip: N small thumbnail frames at evenly-spaced timestamps.
 * Returns an array of blob URL strings (JPEG, low quality) for use as CSS
 * background images.
 *
 * @param {File} file       Video file
 * @param {number} count    Number of thumbnails (default 8)
 * @param {number} height   Thumbnail height in px (width is proportional)
 * @returns {Promise<{urls: string[], duration: number}>}
 */
export async function extractVideoFilmstrip(file, count = 8, height = 48) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted   = true;
  video.preload = 'metadata';
  video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px';
  document.body.appendChild(video);

  try {
    await new Promise((res, rej) => {
      video.onloadedmetadata = res;
      video.onerror = () => rej(new Error('Video metadata load failed'));
      video.src = url;
      video.load();
    });

    const dur = video.duration;
    const aspect = video.videoWidth / video.videoHeight;
    const thumbW = Math.round(height * aspect);
    const thumbH = height;

    const canvas = document.createElement('canvas');
    canvas.width = thumbW; canvas.height = thumbH;
    const ctx = canvas.getContext('2d');
    const urls = [];

    for (let i = 0; i < count; i++) {
      const seekTo = (dur / count) * (i + 0.5); // centre of each bucket
      await new Promise((res, rej) => {
        video.onseeked = res;
        video.onerror  = () => rej(new Error('Seek failed'));
        video.currentTime = seekTo;
      });
      ctx.drawImage(video, 0, 0, thumbW, thumbH);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.5));
      urls.push(URL.createObjectURL(blob));
    }

    return { urls, duration: dur };
  } finally {
    document.body.removeChild(video);
    URL.revokeObjectURL(url);
  }
}
