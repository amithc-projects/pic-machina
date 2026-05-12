/**
 * pocket-tts Web Worker  (KevinAHM/pocket-tts-onnx, english_2026-04 bundle)
 *
 * Architecture — 5 ONNX sessions:
 *   1. text_conditioner  — token_ids (int64 [1,N])  → text_embeddings [1,N,1024]
 *   2. mimi_encoder      — audio float32 [1,1,T]    → voice embeddings [1,1,S,32]
 *   3. flow_lm_main      — stateful transformer      → conditioning + EOS logit + state
 *   4. flow_lm_flow      — ODE Euler step            → flow vector [1,32]
 *   5. mimi_decoder      — latents [1,C,32] + state  → audio samples + state
 *
 * State management:
 *   flow_lm_main and mimi_decoder carry state tensors between calls defined
 *   in bundle.json (flow_state_manifest / mimi_state_manifest).
 *
 * Tokenizer:
 *   SentencePiece (.model binary). Loaded via sentencepiece-js WASM from CDN.
 *   Falls back to a character-level stub if the library is unavailable.
 *
 * Message protocol (matches chatterbox.worker.js):
 *   IN  { type:'load',     payload:{ useWebGPU:bool } }
 *   IN  { type:'generate', payload:{ text, refFloat32Array, speakerId, sampleRate } }
 *   OUT { type:'load:complete',      payload:{ device } }
 *   OUT { type:'generate:complete',  payload:{ waveform:ArrayBuffer } }  (transferable)
 *   OUT { type:'progress',           payload:{ status, loaded?, total? } }
 *   OUT { type:'error',              payload:string }
 */

import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.mjs';

const BUNDLE_BASE = 'https://huggingface.co/KevinAHM/pocket-tts-onnx/resolve/main/onnx/english_2026-04';
const CACHE_NAME  = 'pocket-tts-v1';

const FILE_URLS = {
  textConditioner : `${BUNDLE_BASE}/text_conditioner_int8.onnx`,
  mimiEncoder     : `${BUNDLE_BASE}/mimi_encoder_int8.onnx`,
  flowLmFlow      : `${BUNDLE_BASE}/flow_lm_flow_int8.onnx`,
  flowLmMain      : `${BUNDLE_BASE}/flow_lm_main_int8.onnx`,
  mimiDecoder     : `${BUNDLE_BASE}/mimi_decoder_int8.onnx`,
  tokenizerModel  : `${BUNDLE_BASE}/tokenizer.model`,
  bosBeforeVoice  : `${BUNDLE_BASE}/bos_before_voice.npy`,
  bundleJson      : `${BUNDLE_BASE}/bundle.json`,
};

// ── Module-level singletons ────────────────────────────────────────────────
let sessions = {};        // { textConditioner, mimiEncoder, flowLmFlow, flowLmMain, mimiDecoder }
let bundleConfig = null;  // parsed bundle.json
let tokenizer = null;     // { encode(text): number[] }
let bosBeforeVoice = null;// Float32Array [1, 1, N, 32] — bos embedding prepended to voice

/** Cache of voice states keyed by speakerId to avoid re-encoding. */
const voiceStateCache = new Map();

// ── Message handler ────────────────────────────────────────────────────────
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
  const device = (useWebGPU && ort.env?.webgpu?.isSupported) ? 'webgpu' : 'cpu';
  const sessionOpts = {
    executionProviders: device === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'],
    graphOptimizationLevel: 'all',
  };

  // 2. Fetch bundle.json and support files from Cache API
  self.postMessage({ type: 'progress', payload: { status: 'loading_config' } });
  const cache = await caches.open(CACHE_NAME);

  const bundleResp = await getCached(cache, FILE_URLS.bundleJson);
  bundleConfig = await bundleResp.json();

  // 3. Load SentencePiece tokenizer
  self.postMessage({ type: 'progress', payload: { status: 'loading_tokenizer' } });
  const tokBuf = await (await getCached(cache, FILE_URLS.tokenizerModel)).arrayBuffer();
  tokenizer = await buildTokenizer(tokBuf);

  // 4. Load bos_before_voice.npy → ort.Tensor [1, S, 32]
  self.postMessage({ type: 'progress', payload: { status: 'loading_bos' } });
  const bosBuf = await (await getCached(cache, FILE_URLS.bosBeforeVoice)).arrayBuffer();
  const { data: bosData, shape: bosShape } = parseNpy(bosBuf);
  // Ensure 3-D: squeeze any leading dims > 3
  const condDim = bundleConfig.conditioning_dim ?? 1024;
  const bosSeqLen = bosData.length / condDim;
  bosBeforeVoice = new ort.Tensor('float32', bosData, [1, bosSeqLen, condDim]);

  // 5. Load ONNX sessions from Cache API
  const sessionDefs = [
    ['textConditioner', FILE_URLS.textConditioner],
    ['mimiEncoder',     FILE_URLS.mimiEncoder],
    ['flowLmFlow',      FILE_URLS.flowLmFlow],
    ['flowLmMain',      FILE_URLS.flowLmMain],
    ['mimiDecoder',     FILE_URLS.mimiDecoder],
  ];

  for (let i = 0; i < sessionDefs.length; i++) {
    const [key, url] = sessionDefs[i];
    self.postMessage({ type: 'progress', payload: {
      status: 'loading_model', file: key, loaded: i, total: sessionDefs.length,
    }});
    const resp = await getCached(cache, url);
    const buf  = await resp.arrayBuffer();
    sessions[key] = await ort.InferenceSession.create(buf, sessionOpts);
  }

  self.postMessage({ type: 'load:complete', payload: { device } });
}

// ── Generate ───────────────────────────────────────────────────────────────

async function generateAudio({ text, refFloat32Array, speakerId, sampleRate = 24000 }) {
  if (!sessions.flowLmMain) throw new Error('Model not loaded');

  const cfg = bundleConfig;
  const latentDim    = cfg.latent_dim;       // 32
  const lsdSteps    = 1;    // ODE Euler steps per frame (default from pocket_tts_onnx.py)
  const temperature = 0.7;  // default from pocket_tts_onnx.py
  const eosThreshold = -4.0;
  const framesAfterEos = cfg.model_recommended_frames_after_eos ?? 8;
  const maxFrames = 1000;
  const decoderChunkSize = 15;

  // ── 1. Tokenise text ────────────────────────────────────────────────────
  self.postMessage({ type: 'progress', payload: { status: 'tokenizing' } });
  const tokenIds = tokenizer.encode(normalizeText(text));
  const inputIdsTensor = new ort.Tensor('int64',
    BigInt64Array.from(tokenIds.map(BigInt)), [1, tokenIds.length]);

  // ── 2. Text conditioning ────────────────────────────────────────────────
  self.postMessage({ type: 'progress', payload: { status: 'encoding_text' } });
  const textResult = await sessions.textConditioner.run({ token_ids: inputIdsTensor });
  const textEmbeddings = textResult[Object.keys(textResult)[0]]; // [1, N, 1024]

  // ── 3. Voice conditioning state ─────────────────────────────────────────
  let voiceState = voiceStateCache.get(speakerId);
  if (!voiceState) {
    self.postMessage({ type: 'progress', payload: { status: 'encoding_voice' } });

    // mimi_encoder: audio [1,1,T] → embeddings (possibly 4-D, squeeze to 3-D [1,S,32])
    const audioTensor = new ort.Tensor('float32', refFloat32Array, [1, 1, refFloat32Array.length]);
    const encResult = await sessions.mimiEncoder.run({ audio: audioTensor });
    const rawEmb = encResult[Object.keys(encResult)[0]];
    // Squeeze to 3-D [1, S, D] — same logic as Python _prepare_voice_embeddings.
    // Use the tensor's own last dimension (1024, not latentDim=32).
    const embD = rawEmb.dims[rawEmb.dims.length - 1];
    const voiceSeqLen = rawEmb.data.length / embD;
    let voiceEmb = new ort.Tensor('float32', rawEmb.data, [1, voiceSeqLen, embD]);

    // Prepend bos_before_voice if configured (concat along axis 1)
    if (cfg.insert_bos_before_voice && bosBeforeVoice) {
      voiceEmb = concat3DAxis1(bosBeforeVoice, voiceEmb);
    }

    // Run flow_lm_main with voice embeddings to initialise voice state
    const flowState = initState(cfg.flow_lm_state_manifest);
    const emptySeq  = new ort.Tensor('float32', new Float32Array(0), [1, 0, latentDim]);
    const vInputs   = { sequence: emptySeq, text_embeddings: voiceEmb, ...stateToInputs(flowState) };
    const vResult   = await sessions.flowLmMain.run(vInputs);
    updateState(flowState, vResult, cfg.flow_lm_state_manifest, 2);

    voiceState = flowState;
    voiceStateCache.set(speakerId, cloneState(flowState));
  } else {
    voiceState = cloneState(voiceState);
  }

  // ── 4. Autoregressive latent generation ────────────────────────────────
  self.postMessage({ type: 'progress', payload: { status: 'synthesizing' } });

  // Pre-compute (s, t) pairs for ODE Euler integration
  const stPairs = buildStPairs(lsdSteps);

  const condDim   = cfg.conditioning_dim ?? 1024;
  const emptyText = new ort.Tensor('float32', new Float32Array(0), [1, 0, condDim]);
  const latentFrames = [];
  let eosStep = null;

  // ── Text conditioning pass: feed text embeddings into flow_lm_main once
  //    to load the text context into the state. The conditioning output from
  //    this call is discarded — the loop re-queries at each step.
  const genState  = cloneState(voiceState);
  const emptySeq  = new ort.Tensor('float32', new Float32Array(0), [1, 0, latentDim]);
  const textPass  = await sessions.flowLmMain.run({
    sequence: emptySeq, text_embeddings: textEmbeddings, ...stateToInputs(genState),
  });
  updateState(genState, textPass, cfg.flow_lm_state_manifest, 2);

  // ── Autoregressive loop — matches Python _run_flow_lm_chunk exactly:
  //    1. Feed curr latent → get conditioning + EOS logit (updates state)
  //    2. Check EOS, break if done
  //    3. Sample noise, run ODE flow steps → new latent frame
  //    4. curr = new latent frame; repeat
  //
  // curr starts as NaN (sentinel for "start of sequence", same as Python).
  let currData = new Float32Array(latentDim).fill(NaN);

  for (let step = 0; step < maxFrames; step++) {
    // Step 1: query flow_lm_main with previous latent to get this step's conditioning
    const currTensor = new ort.Tensor('float32', currData, [1, 1, latentDim]);
    const stepResult = await sessions.flowLmMain.run({
      sequence: currTensor, text_embeddings: emptyText, ...stateToInputs(genState),
    });
    const stepVals   = Object.values(stepResult);
    const conditioning = stepVals[0];   // [1, condDim]
    const eosLogit     = stepVals[1];   // [1, 1]
    updateState(genState, stepResult, cfg.flow_lm_state_manifest, 2);

    // Step 2: EOS check
    if (eosLogit?.data[0] > eosThreshold && eosStep === null) eosStep = step;
    if (eosStep !== null && step >= eosStep + framesAfterEos) break;

    // Step 3: sample noise, Euler ODE integration
    const x  = temperature > 0 ? sampleGaussian(latentDim, temperature) : new Float32Array(latentDim);
    const dt = 1.0 / lsdSteps;
    for (const [sVal, tVal] of stPairs) {
      const flowOut = await sessions.flowLmFlow.run({
        c: new ort.Tensor('float32', conditioning.data, [...conditioning.dims]),
        s: new ort.Tensor('float32', new Float32Array([sVal]), [1, 1]),
        t: new ort.Tensor('float32', new Float32Array([tVal]), [1, 1]),
        x: new ort.Tensor('float32', x, [1, latentDim]),
      });
      const flow = Object.values(flowOut)[0].data;
      for (let j = 0; j < latentDim; j++) x[j] += flow[j] * dt;
    }

    // Step 4: latent frame produced; becomes curr for next iteration
    latentFrames.push(x);
    currData = x;
  }

  // ── 5. Decode latents → audio ───────────────────────────────────────────
  self.postMessage({ type: 'progress', payload: { status: 'decoding' } });

  const mimiState = initState(cfg.mimi_state_manifest);
  const audioChunks = [];

  for (let i = 0; i < latentFrames.length; i += decoderChunkSize) {
    const chunk = latentFrames.slice(i, i + decoderChunkSize);
    const chunkLen = chunk.length;
    // Build [1, chunkLen, latentDim] tensor
    const chunkData = new Float32Array(chunkLen * latentDim);
    for (let r = 0; r < chunkLen; r++) {
      chunkData.set(chunk[r], r * latentDim);
    }
    const latentTensor = new ort.Tensor('float32', chunkData, [1, chunkLen, latentDim]);
    const decInputs = { latent: latentTensor, ...stateToInputs(mimiState) };
    const decResult = await sessions.mimiDecoder.run(decInputs);
    const audio = Object.values(decResult)[0].data; // Float32Array
    audioChunks.push(new Float32Array(audio));
    updateState(mimiState, decResult, cfg.mimi_state_manifest, 1);
  }

  // Concatenate all audio chunks
  const totalLen = audioChunks.reduce((s, c) => s + c.length, 0);
  const waveform = new Float32Array(totalLen);
  let off = 0;
  for (const chunk of audioChunks) { waveform.set(chunk, off); off += chunk.length; }

  const outBuffer = waveform.buffer.slice(waveform.byteOffset, waveform.byteOffset + waveform.byteLength);
  self.postMessage({ type: 'generate:complete', payload: { waveform: outBuffer } }, [outBuffer]);
}

// ── State helpers ──────────────────────────────────────────────────────────

function initState(manifest) {
  const state = {};
  for (const entry of manifest) {
    const shape = entry.shape;
    const dtype = entry.dtype;
    const totalElements = shape.reduce((a, b) => a * b, 1);
    let data;
    if      (dtype === 'float32') data = new Float32Array(totalElements);
    else if (dtype === 'int64')   data = new BigInt64Array(totalElements);
    else if (dtype === 'bool')    data = new Uint8Array(totalElements);
    else                          data = new Float32Array(totalElements);

    const ortDtype = dtype === 'bool' ? 'bool' : dtype;
    // Always use the exact shape from the manifest — preserve rank even for zero-size dims
    const ortShape = shape.length > 0 ? shape : [0];
    state[entry.input_name] = new ort.Tensor(ortDtype, data, ortShape);
  }
  return state;
}

function cloneState(state) {
  const clone = {};
  for (const [k, t] of Object.entries(state)) {
    const dataCopy = t.data.slice();
    clone[k] = new ort.Tensor(t.type, dataCopy, [...t.dims]);
  }
  return clone;
}

function stateToInputs(state) {
  return state; // already keyed by input_name
}

function updateState(state, results, manifest, outputOffset) {
  const outputValues = Object.values(results);
  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    const tensor = outputValues[outputOffset + i];
    if (tensor) state[entry.input_name] = tensor;
  }
}

// ── Maths helpers ──────────────────────────────────────────────────────────

function sampleGaussian(n, temperature) {
  const arr = new Float32Array(n);
  const std = Math.sqrt(temperature);
  for (let i = 0; i < n; i++) {
    // Box-Muller
    const u1 = Math.random() || 1e-10;
    const u2 = Math.random();
    arr[i] = std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  return arr;
}

function buildStPairs(lsdSteps) {
  const pairs = [];
  for (let i = 0; i < lsdSteps; i++) {
    const s = i / lsdSteps;
    const t = (i + 1) / lsdSteps;
    pairs.push([s, t]);
  }
  return pairs;
}

/**
 * Concatenate two 3-D ort.Tensors along axis 1 (sequence axis).
 * Both must be shape [1, S, D]; result is [1, S1+S2, D].
 */
function concat3DAxis1(a, b) {
  const merged = new Float32Array(a.data.length + b.data.length);
  merged.set(a.data, 0);
  merged.set(b.data, a.data.length);
  const D = a.dims[2];
  const S = (a.data.length + b.data.length) / D;
  return new ort.Tensor('float32', merged, [1, S, D]);
}

// ── Text normalisation ─────────────────────────────────────────────────────

function normalizeText(text) {
  let t = text.trim().replace(/\n/g, ' ').replace(/  +/g, ' ');
  if (t.length === 0) return t;
  if (!t[0].match(/[A-Z]/)) t = t[0].toUpperCase() + t.slice(1);
  if (t[t.length - 1].match(/[a-zA-Z0-9]/)) t = t + '.';
  return t;
}

// ── Tokenizer — pure-JS SentencePiece from .model protobuf ────────────────

/**
 * Parse a SentencePiece .model (protobuf) binary and return a tokenizer
 * that encodes text to token-ID arrays using greedy longest-match.
 *
 * Handles the ▁ (U+2581) word-boundary convention used by SentencePiece.
 * No external dependencies — reads the protobuf wire format directly.
 */
async function buildTokenizer(modelBytes) {
  const bytes = new Uint8Array(modelBytes);
  const pieces = parseSpModelProto(bytes);

  // Build piece → id lookup
  const vocab = new Map();
  for (let i = 0; i < pieces.length; i++) {
    vocab.set(pieces[i].text, i);
  }

  const unkId = pieces.findIndex(p => p.type === 2);  // UNKNOWN type = 2
  const bosId = pieces.findIndex(p => p.type === 3 && (p.text === '<s>'  || p.text === '<bos>'));
  const eosId = pieces.findIndex(p => p.type === 3 && (p.text === '</s>' || p.text === '<eos>'));

  return {
    encode(rawText) {
      // SentencePiece prepends ▁ to mark word-initial position; spaces → ▁
      const text = '▁' + rawText.trim().replace(/ +/g, '▁');
      const ids = [];
      if (bosId >= 0) ids.push(bosId);

      let pos = 0;
      while (pos < text.length) {
        // Greedy longest-match scan
        let matchLen = 0;
        let matchId  = unkId >= 0 ? unkId : 0;
        for (let end = text.length; end > pos; end--) {
          const sub = text.slice(pos, end);
          if (vocab.has(sub)) { matchLen = end - pos; matchId = vocab.get(sub); break; }
        }
        ids.push(matchId);
        pos += matchLen > 0 ? matchLen : 1;  // advance at least 1 char on UNK
      }

      if (eosId >= 0) ids.push(eosId);
      return ids;
    },
  };
}

// ── Protobuf parser for SentencePiece ModelProto ──────────────────────────

function parseSpModelProto(bytes) {
  const pieces = [];
  let pos = 0;

  while (pos < bytes.length) {
    const [tag, tl] = pbVarint(bytes, pos); pos += tl;
    const field    = tag >>> 3;
    const wire     = tag & 0x7;

    if (field === 1 && wire === 2) {
      // ModelProto.pieces — repeated embedded SentencePiece message
      const [msgLen, ml] = pbVarint(bytes, pos); pos += ml;
      const msgEnd = pos + msgLen;
      const piece = { text: '', score: 0.0, type: 1 };

      while (pos < msgEnd) {
        const [itag, il] = pbVarint(bytes, pos); pos += il;
        const ifield = itag >>> 3;
        const iwire  = itag & 0x7;

        if (ifield === 1 && iwire === 2) {
          // piece.piece — UTF-8 string
          const [slen, sl] = pbVarint(bytes, pos); pos += sl;
          piece.text = new TextDecoder().decode(bytes.subarray(pos, pos + slen));
          pos += slen;
        } else if (ifield === 2 && iwire === 5) {
          // piece.score — float32 little-endian
          piece.score = new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getFloat32(0, true);
          pos += 4;
        } else if (ifield === 3 && iwire === 0) {
          const [v, vl] = pbVarint(bytes, pos); pos += vl;
          piece.type = v;
        } else {
          pos = pbSkip(bytes, pos, iwire);
        }
      }
      pieces.push(piece);
    } else {
      pos = pbSkip(bytes, pos, wire);
    }
  }
  return pieces;
}

/** Read a protobuf varint; returns [value, bytesConsumed]. */
function pbVarint(bytes, pos) {
  let val = 0, shift = 0, len = 0;
  do {
    const b = bytes[pos + len];
    val |= (b & 0x7f) << shift;
    shift += 7; len++;
    if (!(b & 0x80)) break;
  } while (len < 10);
  return [val >>> 0, len];
}

/** Skip one protobuf field value given its wire type. */
function pbSkip(bytes, pos, wire) {
  switch (wire) {
    case 0: { let p = pos; while (bytes[p++] & 0x80) {} return p; }
    case 1: return pos + 8;
    case 2: { const [l, ll] = pbVarint(bytes, pos); return pos + ll + l; }
    case 5: return pos + 4;
    default: throw new Error(`pbSkip: unknown wire type ${wire}`);
  }
}

// ── Numpy .npy parser ──────────────────────────────────────────────────────

/**
 * Parse a numpy .npy file (v1 or v2) and return a Float32Array of its data.
 * Only handles float32 / float64 / int32 dtypes; others are coerced to float32.
 */
/** Parse a numpy .npy file → { data: Float32Array, shape: number[] } */
function parseNpy(buffer) {
  const view = new DataView(buffer);
  const major = view.getUint8(6);
  const headerLen = major >= 2
    ? view.getUint32(8, true)
    : view.getUint16(8, true);
  const dataOffset = 10 + headerLen;

  const headerStr = new TextDecoder().decode(new Uint8Array(buffer, 10, headerLen));
  const dtypeMatch = headerStr.match(/'descr'\s*:\s*'([^']+)'/);
  const dtype = dtypeMatch ? dtypeMatch[1] : '<f4';
  const shapeMatch = headerStr.match(/'shape'\s*:\s*\(([^)]*)\)/);
  const shape = shapeMatch
    ? shapeMatch[1].split(',').filter(s => s.trim()).map(Number)
    : [];
  const numElements = shape.reduce((a, b) => a * b, 1) || 1;

  let data;
  if (dtype === '<f4' || dtype === 'float32') {
    data = new Float32Array(buffer.slice(dataOffset, dataOffset + numElements * 4));
  } else if (dtype === '<f8' || dtype === 'float64') {
    data = Float32Array.from(new Float64Array(buffer.slice(dataOffset, dataOffset + numElements * 8)));
  } else if (dtype === '<i4' || dtype === 'int32') {
    data = Float32Array.from(new Int32Array(buffer.slice(dataOffset, dataOffset + numElements * 4)));
  } else {
    data = new Float32Array(buffer.slice(dataOffset, dataOffset + numElements * 4));
  }
  return { data, shape };
}

// ── Cache helper ───────────────────────────────────────────────────────────

async function getCached(cache, url) {
  const cached = await cache.match(url);
  if (cached) return cached;
  // Not in cache — fetch live (shouldn't happen if downloadModel ran first)
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: HTTP ${resp.status}`);
  await cache.put(url, resp.clone());
  return resp;
}
