/**
 * Shared video-frame utilities for preview/thumbnail rendering.
 */

const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);

const _durationCache = new Map();
const _frameCache = new Map();
const _filmstripCache = new Map();

function getCacheKey(source) {
  if (source instanceof File || source instanceof Blob) {
    return `${source.name || 'blob'}|${source.size}|${source.lastModified || 0}`;
  }
  return String(source);
}

export function isVideoFile(file) {
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  return VIDEO_EXTS.has(ext);
}

/**
 * Seek a video to the specified time (or ~3 s / 40% of duration by default)
 * and return an HTMLCanvasElement with that frame drawn onto it.
 *
 * @param {string|File} source   A blob URL string or a File object.
 * @param {number|null} seekTime Optional seek time in seconds. Defaults to
 *                               Math.min(3, duration * 0.4) when null/undefined.
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function extractVideoFrame(source, seekTime = null) {
  const baseKey = getCacheKey(source);
  const cacheKey = `${baseKey}|${seekTime}`;

  if (_frameCache.has(cacheKey)) {
    const cached = _frameCache.get(cacheKey);
    const canvas = document.createElement('canvas');
    canvas.width = cached.width;
    canvas.height = cached.height;
    canvas.getContext('2d').drawImage(cached, 0, 0);
    return canvas;
  }

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

    const seekTo = seekTime !== null && isFinite(seekTime)
      ? Math.max(0, Math.min(seekTime, video.duration))
      : Math.min(3, video.duration * 0.4);
    await new Promise((res, rej) => {
      video.onseeked = res;
      video.onerror  = () => rej(new Error('Video seek failed'));
      video.currentTime = seekTo;
    });

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const clone = document.createElement('canvas');
    clone.width = canvas.width;
    clone.height = canvas.height;
    clone.getContext('2d').drawImage(canvas, 0, 0);
    _frameCache.set(cacheKey, clone);

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
  const cacheKey = getCacheKey(file);
  if (_durationCache.has(cacheKey)) {
    return _durationCache.get(cacheKey);
  }

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
    const result = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
    _durationCache.set(cacheKey, result);
    return result;
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
  const cacheKey = `${getCacheKey(file)}|${count}|${height}`;
  if (_filmstripCache.has(cacheKey)) {
    return _filmstripCache.get(cacheKey);
  }

  const url = URL.createObjectURL(file);
  const metaVideo = document.createElement('video');
  metaVideo.muted   = true;
  metaVideo.preload = 'metadata';
  metaVideo.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px';
  document.body.appendChild(metaVideo);

  try {
    await new Promise((res, rej) => {
      metaVideo.onloadedmetadata = res;
      metaVideo.onerror = () => rej(new Error('Video metadata load failed'));
      metaVideo.src = url;
      metaVideo.load();
    });

    const dur = metaVideo.duration;
    const aspect = metaVideo.videoWidth / metaVideo.videoHeight;
    const thumbW = Math.round(height * aspect);
    const thumbH = height;

    const canvas = document.createElement('canvas');
    canvas.width = thumbW; canvas.height = thumbH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Concurrently seek all frames
    const extractFrame = async (i) => {
      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'auto'; // Load video data for frame extraction
      v.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px';
      document.body.appendChild(v);
      
      try {
        const seekTo = (dur / count) * (i + 0.5);
        await new Promise((res, rej) => {
           v.onloadedmetadata = () => { v.currentTime = seekTo; };
           v.onseeked = res;
           v.onerror = rej;
           v.src = url;
           v.load();
        });
        return v;
      } catch (err) {
        if (v.parentNode) document.body.removeChild(v);
        throw err;
      }
    };

    // Spin up all decoders concurrently (desktop browsers easily handle 8+ decoders)
    const videos = await Promise.all(Array.from({ length: count }, (_, i) => extractFrame(i)));

    const urls = [];
    // Sequentially render to the single canvas and get Data URL
    for (let i = 0; i < count; i++) {
      const v = videos[i];
      ctx.drawImage(v, 0, 0, thumbW, thumbH);
      urls.push(canvas.toDataURL('image/jpeg', 0.5));
      document.body.removeChild(v);
    }

    const result = { urls, duration: dur };
    _filmstripCache.set(cacheKey, result);
    return result;
  } finally {
    if (metaVideo.parentNode) document.body.removeChild(metaVideo);
    URL.revokeObjectURL(url);
  }
}
