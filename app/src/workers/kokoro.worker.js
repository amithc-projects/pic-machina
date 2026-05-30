/**
 * Kokoro TTS Web Worker
 *
 * Runs kokoro-js (ONNX via transformers.js / onnxruntime-web) off the main
 * thread so long scripts don't freeze the page / trigger "page unresponsive".
 *
 * Message protocol (matches chatterbox.worker.js / pocket-tts.worker.js):
 *   IN  { type:'load',     payload:{} }
 *   IN  { type:'generate', payload:{ text, voice } }
 *   OUT { type:'load:complete',     payload:{ device } }
 *   OUT { type:'generate:complete', payload:{ waveform:ArrayBuffer, sampleRate } }  (transferable)
 *   OUT { type:'progress',          payload:{ status, name?, loaded?, total? } }
 *   OUT { type:'error',             payload:string }
 */

import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';

let tts = null;

self.addEventListener('message', async (e) => {
  const { type, payload } = e.data;
  try {
    if (type === 'load') {
      tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        progress_callback: (p) => {
          if (!p) return;
          if (p.status === 'progress' || p.status === 'download' || p.status === 'downloading') {
            self.postMessage({
              type: 'progress',
              payload: { status: 'download', name: p.file || 'Kokoro-82M', loaded: p.loaded, total: p.total },
            });
          }
        },
      });
      self.postMessage({ type: 'load:complete', payload: { device: 'wasm' } });
    } else if (type === 'generate') {
      if (!tts) throw new Error('Kokoro model not loaded');
      self.postMessage({ type: 'progress', payload: { status: 'synthesizing' } });
      const out = await tts.generate(payload.text, { voice: payload.voice });
      const audio = out.audio instanceof Float32Array ? out.audio : new Float32Array(out.audio);
      // Copy into a standalone buffer so it can be transferred.
      const copy = new Float32Array(audio.length);
      copy.set(audio);
      self.postMessage(
        { type: 'generate:complete', payload: { waveform: copy.buffer, sampleRate: out.sampling_rate || 24000 } },
        [copy.buffer]
      );
    }
  } catch (err) {
    self.postMessage({ type: 'error', payload: err && err.message ? err.message : String(err) });
  }
});
