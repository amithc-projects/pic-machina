/**
 * pocket-tts Web Worker
 *
 * Runs the Kyutai pocket-tts model in a WebWorker via ONNX Runtime Web.
 * Uses the ONNX export from KevinAHM/pocket-tts-onnx-export.
 *
 * Message protocol (same shape as chatterbox.worker.js):
 *   IN  { type: 'load',     payload: { useWebGPU: bool } }
 *   IN  { type: 'generate', payload: { text, refFloat32Array, speakerId, sampleRate } }
 *   OUT { type: 'load:complete',    payload: { device } }
 *   OUT { type: 'generate:complete', payload: { waveform: ArrayBuffer } }  (transferable)
 *   OUT { type: 'progress', payload: { status, loaded?, total? } }
 *   OUT { type: 'error',    payload: string }
 *
 * Pocket-TTS architecture (flow-based, ~100 MB quantized):
 *   1. text_encoder   — tokenises text → hidden states
 *   2. voice_encoder  — encodes reference audio clip → voice embedding
 *   3. flow_decoder   — flow-matching synthesis conditioned on text + voice
 *
 * Model source: https://huggingface.co/KevinAHM/pocket-tts-onnx-export
 * (quantised fp16/int8 variants available — we use int8 for max compatibility)
 *
 * Output sample rate: 24 000 Hz (matches the rest of the stack).
 */

// ONNX Runtime Web — loaded from CDN so the worker doesn't need a bundler step.
// Pin the version to keep inference deterministic across deploys.
const ONNX_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js';

// HuggingFace raw URLs for the three ONNX model files.
// TODO: confirm exact filenames once KevinAHM repo stabilises.
const HF_BASE = 'https://huggingface.co/KevinAHM/pocket-tts-onnx-export/resolve/main/onnx';
const MODEL_FILES = {
  textEncoder: `${HF_BASE}/text_encoder_quantized.onnx`,
  voiceEncoder: `${HF_BASE}/voice_encoder_quantized.onnx`,
  flowDecoder:  `${HF_BASE}/flow_decoder_quantized.onnx`,
};

/** Token vocabulary (BPE / SentencePiece byte-level fallback).
 *  TODO: replace with actual vocab once confirmed from the export repo. */
const VOCAB_URL = `${HF_BASE}/tokenizer.json`;

let ort = null;             // onnxruntime-web namespace
let sessions = {};          // { textEncoder, voiceEncoder, flowDecoder }
let tokenizer = null;       // { encode(text): number[] }

/** Speaker-embedding cache — avoids re-encoding the same reference clip. */
const speakerCache = new Map();

// ── Bootstrap ──────────────────────────────────────────────────────────────

self.addEventListener('message', async (e) => {
  const { type, payload } = e.data;
  try {
    switch (type) {
      case 'load':     await loadModel(payload);    break;
      case 'generate': await generateAudio(payload); break;
      default:
        self.postMessage({ type: 'error', payload: `Unknown message type: ${type}` });
    }
  } catch (err) {
    self.postMessage({ type: 'error', payload: err.message, stack: err.stack });
  }
});

// ── Load ───────────────────────────────────────────────────────────────────

async function loadModel({ useWebGPU }) {
  // 1. Bring in ONNX Runtime Web
  self.postMessage({ type: 'progress', payload: { status: 'loading_runtime' } });
  importScripts(ONNX_CDN);
  // After importScripts, `ort` is available as a global (onnxruntime-web IIFE)
  ort = self.ort;

  const device = (useWebGPU && ort.env.webgpu?.isSupported) ? 'webgpu' : 'cpu';
  const sessionOpts = {
    executionProviders: device === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'],
    graphOptimizationLevel: 'all',
  };

  // 2. Load tokenizer
  self.postMessage({ type: 'progress', payload: { status: 'loading_tokenizer' } });
  const tokResp = await fetch(VOCAB_URL);
  const tokJson  = await tokResp.json();
  tokenizer = buildTokenizer(tokJson);

  // 3. Load ONNX sessions sequentially (each is ~25–40 MB)
  const modelKeys = Object.keys(MODEL_FILES);
  for (let i = 0; i < modelKeys.length; i++) {
    const key = modelKeys[i];
    self.postMessage({ type: 'progress', payload: {
      status: 'loading_model',
      file: key,
      loaded: i,
      total: modelKeys.length,
    }});
    sessions[key] = await ort.InferenceSession.create(MODEL_FILES[key], sessionOpts);
  }

  self.postMessage({ type: 'load:complete', payload: { device } });
}

// ── Generate ───────────────────────────────────────────────────────────────

async function generateAudio({ text, refFloat32Array, speakerId, sampleRate = 24000 }) {
  if (!sessions.textEncoder) throw new Error('Model not loaded');

  // 1. Tokenise text
  const tokenIds = tokenizer.encode(text);
  const inputIds = new ort.Tensor('int64',
    BigInt64Array.from(tokenIds.map(BigInt)),
    [1, tokenIds.length]
  );

  // 2. Encode text → hidden states
  self.postMessage({ type: 'progress', payload: { status: 'encoding_text' } });
  const { hidden_states: textHidden, attention_mask } =
    await sessions.textEncoder.run({ input_ids: inputIds });

  // 3. Encode reference voice (cache per speakerId)
  let voiceEmbedding = speakerCache.get(speakerId);
  if (!voiceEmbedding) {
    self.postMessage({ type: 'progress', payload: { status: 'encoding_voice' } });
    // pocket-tts voice encoder expects float32 at 24 kHz, shape [1, T]
    const refTensor = new ort.Tensor('float32', refFloat32Array, [1, refFloat32Array.length]);
    const encResult = await sessions.voiceEncoder.run({ audio: refTensor });
    voiceEmbedding = encResult.voice_embedding;  // shape [1, D]
    speakerCache.set(speakerId, voiceEmbedding);
  }

  // 4. Flow-matching decode → waveform
  self.postMessage({ type: 'progress', payload: { status: 'synthesizing' } });
  const flowResult = await sessions.flowDecoder.run({
    hidden_states:   textHidden,
    attention_mask:  attention_mask,
    voice_embedding: voiceEmbedding,
  });

  // flowDecoder outputs waveform at 24 kHz, shape [1, T] or [T]
  const waveformTensor = flowResult.waveform ?? flowResult.audio;
  const waveformF32 = new Float32Array(
    waveformTensor.data.buffer,
    waveformTensor.data.byteOffset,
    waveformTensor.data.length
  );

  // Transfer ownership of the buffer to the main thread
  const outBuffer = waveformF32.buffer.slice(
    waveformF32.byteOffset,
    waveformF32.byteOffset + waveformF32.byteLength
  );

  self.postMessage(
    { type: 'generate:complete', payload: { waveform: outBuffer } },
    [outBuffer]
  );
}

// ── Tokenizer ──────────────────────────────────────────────────────────────

/**
 * Minimal BPE tokenizer from a tokenizers.json vocab blob.
 * Handles the small vocabulary that pocket-tts uses.
 * TODO: replace with a proper BPE merge-rules implementation once the exact
 *       tokenizer format from the ONNX export is confirmed.
 */
function buildTokenizer(tokJson) {
  // tokenizers.json has `model.vocab` (token → id) and `model.merges`
  const vocab = tokJson?.model?.vocab ?? {};
  const idToToken = Object.fromEntries(Object.entries(vocab).map(([t, id]) => [id, t]));

  // Very simple char-level fallback — replace with BPE merge engine as needed
  return {
    encode(text) {
      // Pre-tokenise: lowercase, basic punctuation handling
      const normalised = text.trim();
      const ids = [];
      for (const char of normalised) {
        const id = vocab[char] ?? vocab['<unk>'] ?? 0;
        ids.push(id);
      }
      // Wrap with BOS/EOS if present in vocab
      const bos = vocab['<s>'] ?? vocab['<bos>'];
      const eos = vocab['</s>'] ?? vocab['<eos>'];
      if (bos !== undefined) ids.unshift(bos);
      if (eos !== undefined) ids.push(eos);
      return ids;
    }
  };
}
