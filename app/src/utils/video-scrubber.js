/**
 * Video frame scrubber component.
 *
 * Renders a filmstrip + draggable playhead so users can choose which
 * frame of a video is used for the recipe-builder / node-editor preview.
 * The chosen time is persisted to localStorage so it survives navigation.
 *
 * Usage:
 *   const scrubber = await mountVideoScrubber(hostEl, file, {
 *     initialTime: 2.5,          // seconds (optional)
 *     onSeek: (t) => { ... }     // called when the user moves the playhead
 *   });
 *   scrubber.destroy();          // remove when done
 */

import { extractVideoFilmstrip, getVideoDuration } from './video-frame.js';

const STRIP_FRAME_COUNT = 16;
const STORAGE_KEY = (filename) => `ic-seek:${filename}`;

/** Load or return the persisted seek time for a file (null if none). */
export function getStoredSeekTime(filename) {
  const v = localStorage.getItem(STORAGE_KEY(filename));
  return v !== null ? parseFloat(v) : null;
}

/** Persist a seek time for a file. */
export function setStoredSeekTime(filename, t) {
  localStorage.setItem(STORAGE_KEY(filename), String(t));
}

function fmtTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Mount a scrubber into hostEl for the given video File.
 * @returns {{ destroy: () => void, getCurrentTime: () => number }}
 */
export async function mountVideoScrubber(hostEl, file, { initialTime = null, onSeek } = {}) {
  hostEl.innerHTML = `
    <div class="vs-root">
      <div class="vs-bar">
        <span class="material-symbols-outlined vs-icon">movie</span>
        <span class="vs-label">Preview frame: ${file.name}</span>
        <span class="vs-time" id="vs-time">—</span>
        <span class="vs-dur" id="vs-dur"></span>
      </div>
      <div class="vs-strip-wrap" id="vs-strip-wrap">
        <div class="vs-strip-loading">
          <div class="spinner"></div>
        </div>
        <div class="vs-head" id="vs-head" style="display:none"></div>
      </div>
    </div>
    <style>
      .vs-root { display:flex; flex-direction:column; padding:6px 12px 8px; border-top:1px solid var(--ps-border); background:var(--ps-bg-surface); user-select:none; }
      .vs-bar { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
      .vs-icon { font-size:14px; color:var(--ps-text-muted); }
      .vs-label { font-size:11px; color:var(--ps-text-muted); font-weight:500; text-transform:uppercase; letter-spacing:.04em; flex:1; }
      .vs-time { font-size:12px; font-family:var(--font-mono); color:var(--ps-blue); font-weight:600; }
      .vs-dur { font-size:11px; font-family:var(--font-mono); color:var(--ps-text-faint); }
      .vs-strip-wrap { position:relative; height:52px; border-radius:6px; overflow:hidden; background:var(--ps-bg-app); cursor:crosshair; }
      .vs-strip-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
      .vs-strip-imgs { display:flex; height:100%; width:100%; }
      .vs-strip-imgs img { flex:1; height:100%; object-fit:cover; display:block; min-width:0; }
      .vs-head {
        position:absolute; top:0; bottom:0; width:3px; background:var(--ps-blue);
        margin-left:-1px; pointer-events:none; border-radius:2px;
        box-shadow:0 0 6px rgba(0,119,255,0.7);
      }
      .vs-head::before {
        content:''; position:absolute; top:-1px; left:50%; transform:translateX(-50%);
        width:11px; height:11px; background:var(--ps-blue); border-radius:50%;
        box-shadow:0 0 0 2px rgba(255,255,255,0.25);
      }
      .vs-head::after {
        content:''; position:absolute; bottom:-1px; left:50%; transform:translateX(-50%);
        width:11px; height:11px; background:var(--ps-blue); border-radius:50%;
        box-shadow:0 0 0 2px rgba(255,255,255,0.25);
      }
    </style>`;

  const stripWrap = hostEl.querySelector('#vs-strip-wrap');
  const head      = hostEl.querySelector('#vs-head');
  const timeEl    = hostEl.querySelector('#vs-time');
  const durEl     = hostEl.querySelector('#vs-dur');

  let duration = 0;
  let currentT = initialTime ?? 0;

  const setHead = (t) => {
    currentT = Math.max(0, Math.min(t, duration));
    timeEl.textContent = fmtTime(currentT);
    if (duration > 0) {
      head.style.left = `${(currentT / duration) * 100}%`;
    }
  };

  const posToTime = (clientX) => {
    const rect = stripWrap.getBoundingClientRect();
    const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    return ratio * duration;
  };

  const emit = (t) => {
    setHead(t);
    setStoredSeekTime(file.name, currentT);
    onSeek?.(currentT);
  };

  // Pointer drag handling
  let dragging = false;
  stripWrap.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragging = true;
    stripWrap.setPointerCapture(e.pointerId);
    emit(posToTime(e.clientX));
  });
  stripWrap.addEventListener('pointermove', e => {
    if (!dragging) return;
    emit(posToTime(e.clientX));
  });
  stripWrap.addEventListener('pointerup', () => { dragging = false; });
  stripWrap.addEventListener('pointercancel', () => { dragging = false; });

  // Load filmstrip and duration asynchronously
  try {
    const [{ duration: dur }, { urls }] = await Promise.all([
      getVideoDuration(file),
      extractVideoFilmstrip(file, STRIP_FRAME_COUNT, 52),
    ]);
    duration = dur;
    durEl.textContent = `/ ${fmtTime(dur)}`;

    // Replace loading spinner with thumbnails
    const loadingEl = hostEl.querySelector('.vs-strip-loading');
    const imgWrap = document.createElement('div');
    imgWrap.className = 'vs-strip-imgs';
    urls.forEach(u => {
      const img = document.createElement('img');
      img.src = u;
      img.draggable = false;
      imgWrap.appendChild(img);
    });
    loadingEl.replaceWith(imgWrap);

    // Position playhead at initial/saved time
    const savedT = initialTime !== null ? initialTime : (getStoredSeekTime(file.name) ?? Math.min(3, dur * 0.4));
    head.style.display = '';
    setHead(savedT);
  } catch (err) {
    console.warn('[VideoScrubber] Failed to load filmstrip:', err.message);
    const loadingEl = hostEl.querySelector('.vs-strip-loading');
    if (loadingEl) loadingEl.innerHTML = '<span style="font-size:11px;color:var(--ps-text-muted);padding:4px">Preview unavailable</span>';
  }

  return {
    destroy: () => { hostEl.innerHTML = ''; },
    getCurrentTime: () => currentT,
  };
}
