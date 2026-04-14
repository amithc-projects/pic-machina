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
  const ownUrl = typeof source !== 'string'; // we created it, so we revoke it

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
