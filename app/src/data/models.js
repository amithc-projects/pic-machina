/**
 * PicMachina — Model Blob Storage
 *
 * Persists large ONNX model weights in IndexedDB so the user doesn't need to
 * re-download 100s of MB on every visit. Survives Cache-API eviction.
 *
 * Store: 'models'  keyPath: 'id'
 *   { id, name, sizeBytes, downloadedAt, bytes: ArrayBuffer }
 */

import { dbGet, dbPut, dbDelete } from './db.js';

/** Registry of available models the user can download. */
export const MODEL_REGISTRY = [
  {
    id: 'inspyrenet-swinb-fp16',
    name: 'InSPyReNet SwinB (FP16)',
    description:
      'High-quality salient-object segmentation. Produces pixel-accurate alpha mattes for general imagery — superior to the fast MediaPipe model for non-selfie subjects, complex hair, fur, and intricate edges.',
    url: 'https://huggingface.co/OS-Software/InSPyReNet-SwinB-Plus-Ultra-ONNX/resolve/main/onnx/model_fp16.onnx',
    sizeBytes: 199_000_000,
    backend: 'onnx',
    precision: 'fp16',
    inputSize: 1024,
  },
  {
    id: 'whisper-tiny-en',
    name: 'Auto-Transcription (Whisper Tiny)',
    description: 'Lightning-fast on-device speech transcription. Evaluates video audio locally to generate precisely timed closed captions (SRT) without any cloud costs.',
    url: 'Xenova/whisper-tiny.en',
    sizeBytes: 42_000_000,
    backend: 'transformers',
  }
];

export function getModelMeta(id) {
  return MODEL_REGISTRY.find(m => m.id === id) || null;
}

/** Returns the full record including bytes, or null if not downloaded. */
export async function getModelRecord(id) {
  return (await dbGet('models', id)) || null;
}

/** Returns just the ArrayBuffer, or null. */
export async function getModelBytes(id) {
  const rec = await getModelRecord(id);
  return rec?.bytes || null;
}

/** Returns true if bytes are stored. */
export async function isModelDownloaded(id) {
  const rec = await dbGet('models', id);
  return !!(rec && rec.bytes);
}

/** Lightweight listing (no bytes) for UI. */
export async function listDownloadedModels() {
  const out = [];
  for (const meta of MODEL_REGISTRY) {
    const rec = await dbGet('models', meta.id);
    if (rec && rec.bytes) {
      out.push({
        id: rec.id,
        downloadedAt: rec.downloadedAt,
        sizeBytes: rec.sizeBytes ?? rec.bytes.byteLength,
      });
    }
  }
  return out;
}

/**
 * Stream-download a model with progress callbacks and persist to IDB.
 *
 * @param {string} id
 * @param {(p: {loaded:number,total:number}) => void} [onProgress]
 * @param {AbortSignal} [signal]
 */
export async function downloadModel(id, onProgress, signal) {
  const meta = getModelMeta(id);
  if (!meta) throw new Error(`Unknown model: ${id}`);

  if (meta.backend === 'transformers') {
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      
      const fileProgress = new Map();
      let totalLoaded = 0;
      let totalSize = meta.sizeBytes;
      
      await pipeline('automatic-speech-recognition', meta.url, {
          progress_callback: (prog) => {
              if (prog.status === 'progress' && onProgress) {
                  fileProgress.set(prog.file, prog.loaded);
                  let currentLoaded = 0;
                  for (const val of fileProgress.values()) currentLoaded += val;
                  onProgress({ loaded: currentLoaded, total: totalSize });
              }
          }
      });
      
      const record = {
        id,
        name: meta.name,
        downloadedAt: Date.now(),
        sizeBytes: meta.sizeBytes,
        bytes: new ArrayBuffer(1) // Placeholder to satisfy IDB UI checker
      };
      await dbPut('models', record);
      return record;
  }

  const resp = await fetch(meta.url, { signal });
  if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status}`);

  const contentLength = Number(resp.headers.get('content-length')) || meta.sizeBytes || 0;
  const reader = resp.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    if (onProgress) onProgress({ loaded, total: contentLength });
  }

  // Coalesce into one ArrayBuffer
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }

  const record = {
    id,
    name: meta.name,
    downloadedAt: Date.now(),
    sizeBytes: buf.byteLength,
    bytes: buf.buffer,
  };
  await dbPut('models', record);
  return record;
}

export async function deleteModel(id) {
  await dbDelete('models', id);
}
