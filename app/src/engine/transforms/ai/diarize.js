import { registry } from '../../registry.js';

const PYANNOTE_REQ = {
  type:       'model',
  id:         'pyannote-segmentation',
  label:      'Speaker Diarization (Pyannote)',
  actionHref: '#mdl',
};

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
  id: 'flow-ai-diarize', name: 'Speaker Diarize (Pyannote)', category: 'Audio & Video', categoryKey: 'flow',
  icon: 'record_voice_over',
  requires: [PYANNOTE_REQ],
  description: 'Identifies different speakers in the audio track and prefixes the auto-generated SRT captions with speaker labels (e.g., [Speaker 1]:).',
  params: [
    { name: 'inputVariable', label: 'Input SRT Variable', type: 'text', defaultValue: 'autoCaptions' },
    { name: 'outputVariable', label: 'Output Variable Name', type: 'text', defaultValue: 'autoCaptions' },
    { name: 'maxSpeakers', label: 'Max Speakers', type: 'number', defaultValue: 2 },
  ],
  async apply(ctx, p, context) {
    if (typeof WorkerGlobalScope !== 'undefined') {
      console.warn('[flow-ai-diarize] Skipping — transformers.js requires the main thread.');
      return;
    }

    const { originalFile, variables, log } = context;
    if (!originalFile) {
        log?.('warn', '[flow-ai-diarize] No source video/audio file found.');
        return;
    }

    const inputVar = p.inputVariable || 'autoCaptions';
    const srtData = variables.get(inputVar);
    if (!srtData || !srtData.includes('-->')) {
        log?.('warn', `[flow-ai-diarize] Input variable {{${inputVar}}} does not contain valid SRT data.`);
        return;
    }

    try {
      // 1. Verify model is cached
      const { isModelDownloaded } = await import('../../../data/models.js');
      if (!(await isModelDownloaded('pyannote-segmentation'))) {
          log?.('warn', '[flow-ai-diarize] Pyannote model not downloaded. Open the Models screen (#mdl).');
          return;
      }

      const t0 = performance.now();
      log?.('info', '[flow-ai-diarize] Extracting audio track...');

      // 2. Extract Audio (Pyannote requires 16kHz mono)
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const arrayBuffer = await originalFile.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const audioData = audioBuffer.getChannelData(0);
      await audioCtx.close();

      log?.('info', `[flow-ai-diarize] Audio decoded (${Math.round(audioData.length / 16000)}s length). Booting Pyannote...`);

      // 3. Load Transformers Pipeline
      const { AutoProcessor, AutoModelForAudioFrameClassification, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      
      const model_id = 'onnx-community/pyannote-segmentation-3.0';
      const processor = await AutoProcessor.from_pretrained(model_id);
      const model = await AutoModelForAudioFrameClassification.from_pretrained(model_id);

      log?.('info', '[flow-ai-diarize] Running inference... (this may take a moment for long videos)');

      // Process in 30s chunks to prevent OOM
      const SAMPLE_RATE = 16000;
      const CHUNK_LEN_SEC = 30;
      const CHUNK_LEN = CHUNK_LEN_SEC * SAMPLE_RATE;
      const allSegments = [];
      const numSpeakers = parseInt(p.maxSpeakers) || 2;

      for (let offset = 0; offset < audioData.length; offset += CHUNK_LEN) {
          const chunk = audioData.slice(offset, offset + CHUNK_LEN);
          const inputs = await processor(chunk);
          const { logits } = await model(inputs);
          
          // Post-process requires length of the original chunk
          const result = processor.post_process_speaker_diarization(logits, chunk.length)[0];
          
          // Adjust timestamps by chunk offset
          const offsetSec = offset / SAMPLE_RATE;
          for (const seg of result) {
              allSegments.push({
                  start: seg.start + offsetSec,
                  end: seg.end + offsetSec,
                  id: seg.id
              });
          }
          
          const pct = Math.round((Math.min(audioData.length, offset + CHUNK_LEN) / audioData.length) * 100);
          log?.('info', `[flow-ai-diarize] Analyzed ${pct}%...`);
      }

      // Simple pseudo-clustering mapping based on frequency of occurrence to fit into maxSpeakers
      // In a real pipeline, we'd use embeddings. Here we just map by temporal overlap or just raw ID mapped to max 2.
      const speakerMap = {};
      let speakerCount = 1;
      
      const getMappedSpeaker = (id) => {
          if (!speakerMap[id]) {
              speakerMap[id] = speakerCount;
              speakerCount++;
          }
          return speakerMap[id] > numSpeakers ? (speakerMap[id] % numSpeakers) + 1 : speakerMap[id];
      };

      // 4. Fuse with SRT
      const blocks = srtData.split('\n\n');
      let newSrtContent = '';
      
      for (const block of blocks) {
          const lines = block.split('\n');
          if (lines.length >= 3) {
              const idLine = lines[0];
              const timeLine = lines[1];
              const textLine = lines.slice(2).join('\n');
              
              if (timeLine.includes('-->')) {
                  const startSec = parseSrtTime(timeLine.split('-->')[0]);
                  const endSec = parseSrtTime(timeLine.split('-->')[1]);
                  const midSec = startSec + (endSec - startSec) / 2;
                  
                  // Find the speaker segment that covers the midpoint of this SRT block
                  let bestSpeaker = null;
                  for (const seg of allSegments) {
                      if (midSec >= seg.start && midSec <= seg.end) {
                          bestSpeaker = seg.id;
                          break;
                      }
                  }
                  
                  // Fallback: find nearest segment if midpoint doesn't fall cleanly inside one
                  if (!bestSpeaker && allSegments.length > 0) {
                      let minDiff = Infinity;
                      for (const seg of allSegments) {
                          const diff = Math.min(Math.abs(midSec - seg.start), Math.abs(midSec - seg.end));
                          if (diff < minDiff) {
                              minDiff = diff;
                              bestSpeaker = seg.id;
                          }
                      }
                  }
                  
                  const label = bestSpeaker ? `[Speaker ${getMappedSpeaker(bestSpeaker)}]: ` : '';
                  newSrtContent += `${idLine}\n${timeLine}\n${label}${textLine}\n\n`;
              }
          }
      }

      const outVar = p.outputVariable || 'autoCaptions';
      variables.set(outVar, newSrtContent.trim());
      log?.('ok', `[flow-ai-diarize] Finished. Overwrote {{${outVar}}} with speaker labels in ${Math.round(performance.now() - t0)}ms.`);

    } catch (err) {
      console.error('[flow-ai-diarize] Failed:', err);
      log?.('warn', `[flow-ai-diarize] Failed: ${err.message || err}`);
    }
  }
});
