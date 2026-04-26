import { registry } from '../registry.js';

// Requires Whisper Tiny EN from the Models screen
const WHISPER_REQ = {
  type:       'model',
  id:         'whisper-tiny-en',
  label:      'Whisper AI Transcriber (~42 MB)',
  actionHref: '#mdl',
};

function formatTimeToken(seconds) {
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

registry.register({
  id: 'ai-transcribe', name: 'Auto-Transcribe (Whisper)', category: 'Audio & Video', categoryKey: 'flow',
  icon: 'graphic_eq',
  requires: [WHISPER_REQ],
  description: 'Evaluates the primary audio track natively using WebAssembly & Transformers.js. Generates perfectly timed SRT captions and outputs them to a recipe variable.',
  params: [
    { name: 'outputVariable', label: 'Output Variable Name', type: 'text', defaultValue: 'autoCaptions' },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[ai-transcribe] Skipping — transformers.js requires the main thread.');
      return;
    }

    const { originalFile, variables, log } = context;
    if (!originalFile) {
        log?.('warn', '[ai-transcribe] No source file found to transcribe.');
        return;
    }

    try {
      // 1. Verify model is cached
      const { isModelDownloaded } = await import('../../data/models.js');
      if (!(await isModelDownloaded('whisper-tiny-en'))) {
          log?.('warn', '[ai-transcribe] Whisper-tiny model not downloaded. Open the Models screen (#mdl).');
          return;
      }

      const t0 = performance.now();
      log?.('info', '[ai-transcribe] Extracting audio track...');

      // 2. Extract Audio
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const arrayBuffer = await originalFile.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const audioData = audioBuffer.getChannelData(0); // Whisper expects 16kHz Mono Float32Array
      await audioCtx.close();

      log?.('info', `[ai-transcribe] Audio decoded successfully (${Math.round(audioData.length / 16000)}s length). Booting Whisper...`);

      // 3. Load Transformers Pipeline
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      
      const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');

      log?.('info', '[ai-transcribe] Whisper running... (this may take a moment)');

      // 4. Evaluate
      const output = await transcriber(audioData, { 
          chunk_length_s: 30, 
          stride_length_s: 5,
          return_timestamps: true 
      });

      // 5. Format to SRT
      const chunks = output.chunks || [];
      let srtContent = '';
      
      for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const start = chunk.timestamp[0];
          const end = chunk.timestamp[1] || (start + 2); // Handle trailing edge case
          
          srtContent += `${i + 1}\n`;
          srtContent += `${formatTimeToken(start)} --> ${formatTimeToken(end)}\n`;
          srtContent += `${chunk.text.trim()}\n\n`;
      }

      // 6. Write to Variable
      const varName = p.outputVariable || 'autoCaptions';
      variables.set(varName, srtContent);
      log?.('ok', `[ai-transcribe] Extracted ${chunks.length} blocks in ${Math.round(performance.now() - t0)}ms -> stored in {{${varName}}}`);

    } catch (err) {
      console.error('[ai-transcribe] Failed:', err);
      log?.('warn', `[ai-transcribe] Failed: ${err.message || err}`);
    }
  }
});

const KOKORO_REQ = {
  type:       'model',
  id:         'kokoro-82m',
  label:      'Kokoro TTS (82M)',
  actionHref: '#mdl',
};

// Helper to convert SRT timestamp "00:00:02,500" to seconds (2.5)
function parseSrtTime(timeStr) {
  const parts = timeStr.trim().split(':');
  if (parts.length < 3) return 0;
  const secParts = parts[2].split(',');
  const h = parseInt(parts[0], 10) * 3600;
  const m = parseInt(parts[1], 10) * 60;
  const s = parseInt(secParts[0], 10);
  const ms = secParts[1] ? parseInt(secParts[1], 10) / 1000 : 0;
  return h + m + s + ms;
}

registry.register({
  id: 'flow-audio-tts', name: 'Generate Audio (Kokoro TTS)', category: 'Audio & Video', categoryKey: 'flow',
  icon: 'record_voice_over',
  requires: [KOKORO_REQ],
  description: 'Translates text or precisely timed SRT captions into lifelike speech audio. Outputs to a variable that can be injected via the Replace Audio step.',
  params: [
    { name: 'inputVariable', label: 'Input Text/SRT Variable', type: 'text', defaultValue: 'autoCaptions' },
    { name: 'voice', label: 'Voice Profile', type: 'select', options: [
      { label: 'af_heart (American Female)', value: 'af_heart' },
      { label: 'af_alloy (American Female)', value: 'af_alloy' },
      { label: 'am_echo (American Male)', value: 'am_echo' },
      { label: 'am_fenrir (American Male)', value: 'am_fenrir' },
      { label: 'bf_emma (British Female)', value: 'bf_emma' },
      { label: 'bm_george (British Male)', value: 'bm_george' }
    ], defaultValue: 'af_heart' },
    { name: 'outputVariable', label: 'Output Variable Name', type: 'text', defaultValue: 'ttsAudio' },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[flow-audio-tts] Skipping — transformers.js requires the main thread.');
      return;
    }

    const { variables, log } = context;
    const textData = variables.get(p.inputVariable || 'autoCaptions');
    if (!textData || typeof textData !== 'string' || !textData.trim()) {
        log?.('warn', `[flow-audio-tts] Input variable '{{${p.inputVariable || 'autoCaptions'}}}' is empty or not found.`);
        return;
    }

    try {
      const { isModelDownloaded } = await import('../../data/models.js');
      if (!(await isModelDownloaded('kokoro-82m'))) {
          log?.('warn', '[flow-audio-tts] Kokoro model not downloaded. Open the Models screen (#mdl).');
          return;
      }

      log?.('info', '[flow-audio-tts] Booting Kokoro-82M TTS...');
      const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
      const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8' });
      const voiceId = p.voice || 'af_heart';

      // Parse SRT or plain text
      const segments = [];
      let maxDuration = 10; // Default buffer size 10s if raw text
      const isSrt = textData.includes('-->');

      if (isSrt) {
        const blocks = textData.split('\n\n');
        for (const block of blocks) {
          const lines = block.split('\n');
          if (lines.length >= 3) {
            const timeLine = lines[1];
            const textLine = lines.slice(2).join(' ').trim();
            if (textLine && timeLine.includes('-->')) {
              const startStr = timeLine.split('-->')[0];
              const startSec = parseSrtTime(startStr);
              segments.push({ text: textLine, start: startSec });
              maxDuration = Math.max(maxDuration, startSec + 30); // Pre-allocate room
            }
          }
        }
      } else {
        segments.push({ text: textData.trim(), start: 0 });
      }

      log?.('info', `[flow-audio-tts] Generating audio for ${segments.length} segment(s)...`);

      // Kokoro operates at 24kHz natively.
      const SAMPLE_RATE = 24000;
      const t0 = performance.now();
      
      // Store generated audio buffers temporarily
      const generatedAudio = [];
      let lastAudioEnd = 0;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        log?.('info', `[flow-audio-tts] Processing (${i+1}/${segments.length}): "${seg.text.substring(0, 30)}..."`);
        
        const output = await tts.generate(seg.text, { voice: voiceId });
        generatedAudio.push({
          audioData: output.audio, // Float32Array
          start: seg.start
        });
        lastAudioEnd = Math.max(lastAudioEnd, seg.start + (output.audio.length / SAMPLE_RATE));
      }

      // Mix all segments onto a master OfflineAudioContext
      // Note: OfflineAudioContext expects exact duration.
      const totalSamples = Math.ceil(lastAudioEnd * SAMPLE_RATE) + SAMPLE_RATE; // 1s padding
      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, totalSamples, SAMPLE_RATE);

      for (const gen of generatedAudio) {
        const buffer = offlineCtx.createBuffer(1, gen.audioData.length, SAMPLE_RATE);
        buffer.copyToChannel(gen.audioData, 0);
        
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineCtx.destination);
        source.start(gen.start);
      }

      const renderedBuffer = await offlineCtx.startRendering();

      // Convert AudioBuffer to WAV Blob
      function audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        const result = new Float32Array(buffer.length);
        buffer.copyFromChannel(result, 0);
        
        const dataLength = result.length * 2; // 16-bit
        const bufferLen = 44 + dataLength;
        const view = new DataView(new ArrayBuffer(bufferLen));
        
        const writeString = (view, offset, string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };
        
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        let offset = 44;
        for (let i = 0; i < result.length; i++) {
          let s = Math.max(-1, Math.min(1, result[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
          offset += 2;
        }
        
        return new Blob([view], { type: 'audio/wav' });
      }

      const wavBlob = audioBufferToWav(renderedBuffer);
      
      const varName = p.outputVariable || 'ttsAudio';
      // Store as a File object mimicking standard file uploads
      const audioFile = new File([wavBlob], 'tts_output.wav', { type: 'audio/wav' });
      variables.set(varName, audioFile);
      
      log?.('ok', `[flow-audio-tts] Generated ${lastAudioEnd.toFixed(1)}s of audio in ${Math.round(performance.now() - t0)}ms -> stored in {{${varName}}}`);

    } catch (err) {
      console.error('[flow-audio-tts] Failed:', err);
      log?.('error', `[flow-audio-tts] Failed: ${err.message || err}`);
    }
  }
});
