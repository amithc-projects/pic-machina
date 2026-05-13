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
    category: 'Imaging',
  },
  {
    id: 'whisper-tiny-en',
    name: 'Auto-Transcription (Whisper Tiny)',
    description: 'Lightning-fast on-device speech transcription. Evaluates video audio locally to generate precisely timed closed captions (SRT) without any cloud costs.',
    url: 'Xenova/whisper-tiny.en',
    sizeBytes: 42_000_000,
    backend: 'transformers',
    category: 'Audio',
  },
  {
    id: 'kokoro-82m',
    name: 'Kokoro TTS (82M)',
    description: 'Extremely high-quality, lightweight multi-speaker Text-to-Speech. Used for auto-dubbing and voiceover generation directly in the browser.',
    url: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    sizeBytes: 85_000_000,
    backend: 'transformers',
    category: 'Audio',
  },
  {
    id: 'pyannote-segmentation',
    name: 'Speaker Diarization (Pyannote)',
    description: 'Identifies different speakers in an audio track. Used to prefix auto-generated captions with speaker labels (e.g., Speaker 1, Speaker 2).',
    url: 'onnx-community/pyannote-segmentation-3.0',
    sizeBytes: 15_000_000,
    backend: 'transformers',
    category: 'Audio',
  },
  {
    id: 'chatterbox-tts',
    name: 'VoiceCraft (Chatterbox)',
    description: 'Advanced zero-shot voice cloning. Upload custom voice samples to synthesize text using dynamic characters and emotions.',
    url: 'onnx-community/chatterbox-ONNX',
    sizeBytes: 1_500_000_000,
    backend: 'transformers',
    category: 'Audio',
  },
  {
    id: 'pocket-tts',
    name: 'Pocket TTS (Kyutai)',
    description: 'Lightweight, fast zero-shot voice cloning by Kyutai. Runs entirely in the browser via ONNX (~147 MB). Clones any voice from a short reference clip. MIT licensed; CC-BY 4.0 model weights (attribution required).',
    // ONNX export by KevinAHM: https://huggingface.co/KevinAHM/pocket-tts-onnx
    url: 'KevinAHM/pocket-tts-onnx',
    sizeBytes: 147_000_000,   // ~147 MB int8 (5 ONNX files + tokenizer + config)
    backend: 'onnx-direct',   // loaded by pocket-tts.worker.js, not transformers.js
    category: 'Audio',
  },
  {
    id: 'sam2-hiera-tiny',
    name: 'Segment Anything 2 (Tiny)',
    description: 'Fast, high-quality object segmentation for images and video tracking. Used for auto-selecting objects for removal.',
    url: 'https://huggingface.co/SharpAI/sam2-hiera-tiny-onnx/resolve/main/encoder.onnx',
    sizeBytes: 150_000_000,
    backend: 'onnx',
    category: 'Imaging',
  },
  {
    id: 'lama-fp32',
    name: 'LaMa Image Inpainting',
    description: 'Large Mask Inpainting for "Magic Eraser" object removal.',
    url: 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx', // Placeholder URL
    sizeBytes: 200_000_000,
    backend: 'onnx',
    category: 'Imaging',
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

  // ── Pocket TTS: pre-fetch ONNX files into browser Cache API ──────────────
  if (meta.backend === 'onnx-direct') {
    const HF_BASE = 'https://huggingface.co/KevinAHM/pocket-tts-onnx/resolve/main/onnx/english_2026-04';
    const files = [
      `${HF_BASE}/text_conditioner_int8.onnx`,
      `${HF_BASE}/mimi_encoder_int8.onnx`,
      `${HF_BASE}/flow_lm_flow_int8.onnx`,
      `${HF_BASE}/flow_lm_main_int8.onnx`,
      `${HF_BASE}/mimi_decoder_int8.onnx`,
      `${HF_BASE}/tokenizer.model`,
      `${HF_BASE}/bos_before_voice.npy`,
      `${HF_BASE}/bundle.json`,
    ];
    const cache = await caches.open('pocket-tts-v1');
    let loaded = 0;
    for (const url of files) {
      const existing = await cache.match(url);
      if (!existing) {
        const resp = await fetch(url, { signal });
        if (!resp.ok) throw new Error(`Failed to fetch ${url}: HTTP ${resp.status}`);
        const buf = await resp.clone().arrayBuffer();
        loaded += buf.byteLength;
        await cache.put(url, resp);
      } else {
        const buf = await existing.clone().arrayBuffer();
        loaded += buf.byteLength;
      }
      if (onProgress) onProgress({ loaded, total: meta.sizeBytes });
    }
    if (onProgress) onProgress({ loaded: meta.sizeBytes, total: meta.sizeBytes });
    const record = {
      id,
      name: meta.name,
      downloadedAt: Date.now(),
      sizeBytes: meta.sizeBytes,
      bytes: new ArrayBuffer(1), // placeholder — real files live in Cache API
    };
    await dbPut('models', record);
    return record;
  }

  if (meta.backend === 'transformers') {
      let totalSize = meta.sizeBytes;

      if (meta.id === 'kokoro-82m') {
          const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
          // Kokoro-JS uses Cache API implicitly. 
          // We can't easily hook into its fetch progress, but we can await the load.
          if (onProgress) onProgress({ loaded: totalSize * 0.5, total: totalSize }); // Fake intermediate
          await KokoroTTS.from_pretrained(meta.url, { dtype: 'q8' });
          if (onProgress) onProgress({ loaded: totalSize, total: totalSize });
          
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

      // For Whisper
      let pipelineTask = 'automatic-speech-recognition';
      let hf;
      
      if (meta.id === 'whisper-tiny-en') {
          hf = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      } else if (meta.id === 'pyannote-segmentation') {
          hf = await import('@huggingface/transformers');
          // Pyannote uses AutoModel, not a standard pipeline, but we can cache it by calling from_pretrained
          hf.env.allowLocalModels = false;
          hf.env.useBrowserCache = true;
          
          if (onProgress) onProgress({ loaded: totalSize * 0.5, total: totalSize });
          await hf.AutoProcessor.from_pretrained(meta.url);
          await hf.AutoModelForAudioFrameClassification.from_pretrained(meta.url);
          if (onProgress) onProgress({ loaded: totalSize, total: totalSize });
          
          const record = {
            id,
            name: meta.name,
            downloadedAt: Date.now(),
            sizeBytes: meta.sizeBytes,
            bytes: new ArrayBuffer(1) // Placeholder to satisfy IDB UI checker
          };
          await dbPut('models', record);
          return record;
      } else if (meta.id === 'chatterbox-tts') {
          hf = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.2');
          hf.env.allowLocalModels = false;
          hf.env.useBrowserCache = true;
          
          if (hf.env.backends?.onnx?.wasm) {
              hf.env.backends.onnx.wasm.numThreads = 1;
          }
          
          const useDevice = navigator.gpu ? 'webgpu' : 'wasm';
          
          if (onProgress) onProgress({ loaded: totalSize * 0.5, total: totalSize });
          // Note: Full download handles internally by transformers.js during pipeline load.
          await hf.AutoProcessor.from_pretrained(meta.url);
          await hf.ChatterboxModel.from_pretrained(meta.url, {
              device: useDevice,
              dtype: {
                embed_tokens: 'fp32',
                speech_encoder: 'fp32',
                language_model: useDevice === 'webgpu' ? 'q4f16' : 'q4',
                conditional_decoder: 'fp32',
              }
          });
          if (onProgress) onProgress({ loaded: totalSize, total: totalSize });
          
          const record = {
            id,
            name: meta.name,
            downloadedAt: Date.now(),
            sizeBytes: meta.sizeBytes,
            bytes: new ArrayBuffer(1)
          };
          await dbPut('models', record);
          return record;
      }

      const pipeline = hf.pipeline;
      const env = hf.env;

      env.allowLocalModels = false;
      env.useBrowserCache = true;
      
      const fileProgress = new Map();
      let totalLoaded = 0;
      
      await pipeline(pipelineTask, meta.url, {
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
