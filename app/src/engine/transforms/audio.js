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
