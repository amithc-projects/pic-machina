/** Tiny UUID v4 generator (no dependency). */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Current epoch ms. */
export function now() { return Date.now(); }

/** Clamp a number between min and max. */
export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/** Deep-clone a JSON-serialisable object. */
export function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

/** Format bytes to human-readable string. */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Debounce a function. */
export function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/** Format epoch ms to locale date string. */
export function formatDate(epochMs) {
  return new Date(epochMs).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Format epoch ms to locale date+time string. */
export function formatDateTime(epochMs) {
  return new Date(epochMs).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
