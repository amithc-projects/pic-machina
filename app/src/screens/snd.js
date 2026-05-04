import * as Tone from 'https://cdn.jsdelivr.net/npm/tone@14.7.77/+esm';

// Helper to export AudioBuffer to WAV
function audioBufferToWav(buffer, opt_channel) {
  const numChannels = opt_channel !== undefined ? 1 : buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
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
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  const channels = [];
  if (opt_channel !== undefined) {
    channels.push(buffer.getChannelData(opt_channel));
  } else {
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
  }
  
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  
  return new Blob([view], { type: 'audio/wav' });
}

export async function render(container) {
  container.innerHTML = `
    <div class="screen h-full flex flex-col bg-[var(--ps-bg)]">
      <div class="border-b border-[var(--ps-border)] p-4 flex items-center shrink-0">
        <h1 class="text-xl font-bold flex-1">Audio Studio</h1>
      </div>
      
      <div class="p-6 flex flex-col gap-6 max-w-3xl mx-auto w-full">
        <div class="bg-[var(--ps-surface)] border border-[var(--ps-border)] rounded-lg p-6">
          <h2 class="text-lg font-bold mb-4">Upload Audio File</h2>
          <div class="flex gap-4 items-center">
            <label class="btn btn-primary cursor-pointer flex items-center gap-2">
              <span class="material-symbols-outlined">upload_file</span> Choose Audio
              <input type="file" id="snd-upload" accept="audio/*" class="hidden">
            </label>
            <span id="snd-filename" class="text-sm text-[var(--ps-text-muted)]">No file selected</span>
          </div>
        </div>

        <div class="bg-[var(--ps-surface)] border border-[var(--ps-border)] rounded-lg p-6 flex flex-col gap-4">
          <h2 class="text-lg font-bold">Playback & Effects (Tone.js)</h2>
          
          <div class="flex items-center gap-4 border-b border-[var(--ps-border)] pb-4">
            <button id="snd-play" class="btn btn-primary" disabled><span class="material-symbols-outlined">play_arrow</span> Play</button>
            <button id="snd-stop" class="btn btn-secondary" disabled><span class="material-symbols-outlined">stop</span> Stop</button>
          </div>
          
          <div class="flex flex-col gap-4 pt-2">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-bold flex justify-between">
                <span>Playback Rate (Speed)</span>
                <span id="snd-rate-val">1.0x</span>
              </label>
              <input type="range" id="snd-rate" class="ic-range" min="0.5" max="2" step="0.1" value="1" disabled>
            </div>
            
            <div class="flex flex-col gap-2">
              <label class="text-sm font-bold flex justify-between">
                <span>Pitch Shift</span>
                <span id="snd-pitch-val">0 semitones</span>
              </label>
              <input type="range" id="snd-pitch" class="ic-range" min="-12" max="12" step="1" value="0" disabled>
            </div>
            
            <div class="flex flex-col gap-2">
              <label class="text-sm font-bold flex justify-between">
                <span>Reverb</span>
                <span id="snd-reverb-val">0%</span>
              </label>
              <input type="range" id="snd-reverb" class="ic-range" min="0" max="1" step="0.05" value="0" disabled>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  let player = null;
  let pitchShift = null;
  let reverb = null;
  
  const uploadInput = container.querySelector('#snd-upload');
  const filenameEl = container.querySelector('#snd-filename');
  const playBtn = container.querySelector('#snd-play');
  const stopBtn = container.querySelector('#snd-stop');
  
  const rateInput = container.querySelector('#snd-rate');
  const rateVal = container.querySelector('#snd-rate-val');
  
  const pitchInput = container.querySelector('#snd-pitch');
  const pitchVal = container.querySelector('#snd-pitch-val');
  
  const reverbInput = container.querySelector('#snd-reverb');
  const reverbVal = container.querySelector('#snd-reverb-val');

  const effectsHtml = `
            <div class="flex flex-col gap-2 pt-2 border-t border-[var(--ps-border)] mt-2">
              <label class="text-sm font-bold flex justify-between">
                <span>Pan (Left/Right)</span>
                <span id="snd-pan-val">Center</span>
              </label>
              <input type="range" id="snd-pan" class="ic-range" min="-1" max="1" step="0.1" value="0" disabled>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-bold flex justify-between">
                <span>Delay (Feedback)</span>
                <span id="snd-delay-val">0%</span>
              </label>
              <input type="range" id="snd-delay" class="ic-range" min="0" max="1" step="0.05" value="0" disabled>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-bold flex justify-between">
                <span>Distortion</span>
                <span id="snd-dist-val">0</span>
              </label>
              <input type="range" id="snd-dist" class="ic-range" min="0" max="1" step="0.05" value="0" disabled>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-bold flex justify-between">
                <span>Chorus (Depth)</span>
                <span id="snd-chorus-val">0%</span>
              </label>
              <input type="range" id="snd-chorus" class="ic-range" min="0" max="1" step="0.05" value="0" disabled>
            </div>
  `;
  container.querySelector('#snd-reverb').parentElement.insertAdjacentHTML('afterend', effectsHtml);

  // Add the Splitter container at the end of the main view
  const splitterHtml = `
        <div class="bg-[var(--ps-surface)] border border-[var(--ps-border)] rounded-lg p-6 hidden" id="snd-split-container">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold">Smart Split & Diarization</h2>
            <div class="flex gap-2">
              <button id="snd-btn-diarize" class="btn btn-secondary text-sm"><span class="material-symbols-outlined text-[18px]">group</span> Diarize & Pan L/R</button>
              <button id="snd-btn-split" class="btn btn-secondary text-sm"><span class="material-symbols-outlined text-[18px]">content_cut</span> Auto-Split</button>
            </div>
          </div>
          
          <div class="flex flex-col gap-4 mb-6 p-4 bg-[var(--ps-bg)] rounded border border-[var(--ps-border)]">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-bold flex justify-between">
                <span>Silence Threshold (Sensitivity)</span>
                <span id="snd-split-thresh-val">1.5%</span>
              </label>
              <input type="range" id="snd-split-thresh" class="ic-range" min="0.001" max="0.1" step="0.001" value="0.015">
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-bold flex justify-between">
                <span>Minimum Silence Duration</span>
                <span id="snd-split-dur-val">0.4s</span>
              </label>
              <input type="range" id="snd-split-dur" class="ic-range" min="0.1" max="2.0" step="0.1" value="0.4">
            </div>
          </div>

          <div id="snd-split-results" class="flex flex-col gap-2">
            <div class="text-sm text-[var(--ps-text-muted)] text-center py-4">Click Auto-Split to detect speech segments...</div>
          </div>
        </div>
  `;
  container.querySelector('.max-w-3xl').insertAdjacentHTML('beforeend', splitterHtml);

  const delayInput = container.querySelector('#snd-delay');
  const delayVal = container.querySelector('#snd-delay-val');
  const distInput = container.querySelector('#snd-dist');
  const distVal = container.querySelector('#snd-dist-val');
  const chorusInput = container.querySelector('#snd-chorus');
  const chorusVal = container.querySelector('#snd-chorus-val');
  const panInput = container.querySelector('#snd-pan');
  const panVal = container.querySelector('#snd-pan-val');
  
  const splitContainer = container.querySelector('#snd-split-container');
  const splitBtn = container.querySelector('#snd-btn-split');
  const diarizeBtn = container.querySelector('#snd-btn-diarize');
  const splitResults = container.querySelector('#snd-split-results');
  
  const threshInput = container.querySelector('#snd-split-thresh');
  const threshVal = container.querySelector('#snd-split-thresh-val');
  const durInput = container.querySelector('#snd-split-dur');
  const durVal = container.querySelector('#snd-split-dur-val');

  threshInput.addEventListener('input', e => threshVal.textContent = (parseFloat(e.target.value) * 100).toFixed(1) + '%');
  durInput.addEventListener('input', e => durVal.textContent = parseFloat(e.target.value).toFixed(1) + 's');
  
  const enableControls = () => {
    [playBtn, stopBtn, rateInput, pitchInput, reverbInput, delayInput, distInput, chorusInput, panInput].forEach(el => el.disabled = false);
    splitContainer.classList.remove('hidden');
    splitResults.innerHTML = '<div class="text-sm text-[var(--ps-text-muted)] text-center py-4">Click Auto-Split to detect speech segments...</div>';
  };

  let delay = null;
  let dist = null;
  let chorus = null;
  let panner = null;
  
  uploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    filenameEl.textContent = file.name;
    
    if (player) {
      player.stop();
      player.dispose();
      pitchShift.dispose();
      reverb.dispose();
      if(delay) delay.dispose();
      if(dist) dist.dispose();
      if(chorus) chorus.dispose();
    }
    
    // Initialize Tone context
    await Tone.start();
    
    const url = URL.createObjectURL(file);
    
    // Set up processing chain
    pitchShift = new Tone.PitchShift({ pitch: 0 });
    chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0 }).start();
    dist = new Tone.Distortion({ distortion: 0 });
    delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0 });
    panner = new Tone.Panner(0);
    reverb = new Tone.Reverb({ decay: 2, wet: 0 }).toDestination();
    
    pitchShift.chain(chorus, dist, delay, panner, reverb);
    
    player = new Tone.Player({
      url: url,
      loop: false,
      onload: () => {
        enableControls();
      }
    }).connect(pitchShift);
  });
  
  playBtn.addEventListener('click', async () => {
    if (!player) return;
    await Tone.start();
    if (player.state === 'started') {
      player.stop();
      playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span> Play';
    } else {
      player.start();
      playBtn.innerHTML = '<span class="material-symbols-outlined">pause</span> Pause';
    }
  });
  
  stopBtn.addEventListener('click', () => {
    if (player) {
      player.stop();
      playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span> Play';
    }
  });

  splitBtn.addEventListener('click', () => {
    if (!player || !player.buffer) return;
    
    splitBtn.disabled = true;
    splitBtn.innerHTML = 'Detecting...';
    
    setTimeout(() => {
      // Very basic silence detection
      const buffer = player.buffer.getChannelData(0);
      const sampleRate = player.buffer.sampleRate;
      
      const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
      const threshold = parseFloat(threshInput.value); 
      const minSilenceDur = parseFloat(durInput.value); 
      
      let segments = [];
      let currentStart = null;
      let silentFrames = 0;
      
      for (let i = 0; i < buffer.length; i += windowSize) {
        let sum = 0;
        const end = Math.min(i + windowSize, buffer.length);
        for (let j = i; j < end; j++) {
          sum += buffer[j] * buffer[j];
        }
        const rms = Math.sqrt(sum / (end - i));
        
        if (rms < threshold) {
          silentFrames++;
          const silenceDur = (silentFrames * windowSize) / sampleRate;
          if (silenceDur >= minSilenceDur && currentStart !== null) {
            // End of a speech segment
            segments.push({ start: currentStart, end: (i / sampleRate) - silenceDur + 0.1 }); // pad tail slightly
            currentStart = null;
          }
        } else {
          silentFrames = 0;
          if (currentStart === null) {
            currentStart = Math.max(0, (i / sampleRate) - 0.1); // pad head slightly
          }
        }
      }
      
      if (currentStart !== null) {
        segments.push({ start: currentStart, end: buffer.length / sampleRate });
      }
      
      splitBtn.disabled = false;
      splitBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">content_cut</span> Auto-Split';
      
      if (segments.length === 0) {
        splitResults.innerHTML = '<div class="text-sm text-[var(--ps-text-muted)] text-center py-4">No distinct speech segments found (audio too quiet or constant).</div>';
        return;
      }
      
      splitResults.innerHTML = segments.map((seg, idx) => {
        const dur = (seg.end - seg.start).toFixed(2);
        return `
          <div class="flex items-center justify-between bg-[var(--ps-bg)] p-2 rounded border border-[var(--ps-border)] text-sm">
            <div class="font-mono text-[var(--ps-text-muted)]">Segment ${idx + 1}</div>
            <div class="text-xs">Start: ${seg.start.toFixed(2)}s | Dur: ${dur}s</div>
            <button class="btn btn-primary text-xs py-1 px-2 segment-play" data-start="${seg.start}" data-end="${seg.end}">
              <span class="material-symbols-outlined text-[16px]">play_arrow</span> Preview
            </button>
          </div>
        `;
      }).join('');
      
      // Wire up segment play buttons
      splitResults.querySelectorAll('.segment-play').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!player) return;
          await Tone.start();
          player.stop();
          const start = parseFloat(btn.dataset.start);
          const dur = parseFloat(btn.dataset.end) - start;
          player.start(0, start, dur);
          playBtn.innerHTML = '<span class="material-symbols-outlined">pause</span> Pause';
        });
      });
      
    }, 50); // slight delay to allow UI to update to 'Detecting...'
  });

  diarizeBtn.addEventListener('click', async () => {
    if (!player || !player.buffer) return;
    
    diarizeBtn.disabled = true;
    diarizeBtn.innerHTML = 'Loading AI...';
    splitResults.innerHTML = '<div class="text-sm text-[var(--ps-text-muted)] text-center py-4">Loading Pyannote Diarization Model...</div>';

    try {
      const { isModelDownloaded } = await import('../data/models.js');
      if (!(await isModelDownloaded('pyannote-segmentation'))) {
          splitResults.innerHTML = '<div class="text-sm text-red-400 text-center py-4">Pyannote model not downloaded. Please download it from the Models screen first.</div>';
          diarizeBtn.disabled = false;
          diarizeBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">group</span> Diarize & Pan L/R';
          return;
      }

      // 1. Resample to 16000Hz for Pyannote
      splitResults.innerHTML = '<div class="text-sm text-[var(--ps-text-muted)] text-center py-4">Downsampling audio for analysis...</div>';
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const offlineCtx = new OfflineAudioContext(1, player.buffer.duration * 16000, 16000);
      const source = offlineCtx.createBufferSource();
      source.buffer = player.buffer.get();
      source.connect(offlineCtx.destination);
      source.start();
      const resampledBuffer = await offlineCtx.startRendering();
      const audioData = resampledBuffer.getChannelData(0);

      // 2. Load Model
      splitResults.innerHTML = '<div class="text-sm text-[var(--ps-text-muted)] text-center py-4">Running Inference (may take a moment)...</div>';
      const { AutoProcessor, AutoModelForAudioFrameClassification, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      
      const model_id = 'onnx-community/pyannote-segmentation-3.0';
      const processor = await AutoProcessor.from_pretrained(model_id);
      const model = await AutoModelForAudioFrameClassification.from_pretrained(model_id);

      // 3. Process in chunks
      const SAMPLE_RATE = 16000;
      const CHUNK_LEN_SEC = 30;
      const CHUNK_LEN = CHUNK_LEN_SEC * SAMPLE_RATE;
      const allSegments = [];

      for (let offset = 0; offset < audioData.length; offset += CHUNK_LEN) {
          const chunk = audioData.slice(offset, offset + CHUNK_LEN);
          const inputs = await processor(chunk);
          const { logits } = await model(inputs);
          
          const result = processor.post_process_speaker_diarization(logits, chunk.length)[0];
          const offsetSec = offset / SAMPLE_RATE;
          for (const seg of result) {
              allSegments.push({ start: seg.start + offsetSec, end: seg.end + offsetSec, id: seg.id });
          }
          const pct = Math.round((Math.min(audioData.length, offset + CHUNK_LEN) / audioData.length) * 100);
          splitResults.innerHTML = `<div class="text-sm text-[var(--ps-text-muted)] text-center py-4">Running Inference (${pct}%)...</div>`;
      }

      // Map speakers to L (Speaker 1) and R (Speaker 2)
      const speakerMap = {};
      let speakerCount = 1;
      const getMappedSpeaker = (id) => {
          if (!speakerMap[id]) { speakerMap[id] = speakerCount++; }
          return speakerMap[id] > 2 ? (speakerMap[id] % 2) + 1 : speakerMap[id];
      };

      // 4. Create new Stereo Buffer
      splitResults.innerHTML = '<div class="text-sm text-[var(--ps-text-muted)] text-center py-4">Generating Stereo Mix...</div>';
      const origBuffer = player.buffer.get();
      const stereoBuffer = audioCtx.createBuffer(2, origBuffer.length, origBuffer.sampleRate);
      const leftChannel = stereoBuffer.getChannelData(0);
      const rightChannel = stereoBuffer.getChannelData(1);
      const monoData = origBuffer.getChannelData(0); // Assuming original is mono or taking first channel

      for (let i = 0; i < monoData.length; i++) {
        const timeSec = i / origBuffer.sampleRate;
        let speaker = 0; // 0=center, 1=left, 2=right
        
        // Find if this sample is inside a speaker segment
        for (const seg of allSegments) {
          if (timeSec >= seg.start && timeSec <= seg.end) {
            speaker = getMappedSpeaker(seg.id);
            break;
          }
        }

        if (speaker === 1) {
          leftChannel[i] = monoData[i];
          rightChannel[i] = 0;
        } else if (speaker === 2) {
          leftChannel[i] = 0;
          rightChannel[i] = monoData[i];
        } else {
          leftChannel[i] = monoData[i];
          rightChannel[i] = monoData[i];
        }
      }

      // 5. Replace Player Buffer
      player.stop();
      playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span> Play';
      player.buffer = new Tone.ToneAudioBuffer(stereoBuffer);
      panner.pan.value = 0; // reset global panner
      container.querySelector('#snd-pan').value = 0;
      container.querySelector('#snd-pan-val').textContent = 'Center';

      splitResults.innerHTML = `
        <div class="text-sm text-green-400 text-center py-4">Success! Replaced audio with Stereo Mix (Speaker 1 Left, Speaker 2 Right). Press Play to listen!</div>
        <div class="flex gap-2 justify-center pb-4">
            <button id="snd-dl-spk1" class="btn btn-secondary text-xs"><span class="material-symbols-outlined text-[16px]">download</span> Download Speaker 1</button>
            <button id="snd-dl-spk2" class="btn btn-secondary text-xs"><span class="material-symbols-outlined text-[16px]">download</span> Download Speaker 2</button>
        </div>
      `;
      container.querySelector('#snd-dl-spk1').onclick = () => {
         const blob = audioBufferToWav(stereoBuffer, 0); // Left channel (Speaker 1)
         const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'speaker1.wav'; a.click();
      };
      container.querySelector('#snd-dl-spk2').onclick = () => {
         const blob = audioBufferToWav(stereoBuffer, 1); // Right channel (Speaker 2)
         const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'speaker2.wav'; a.click();
      };

    } catch (err) {
      console.error(err);
      splitResults.innerHTML = `<div class="text-sm text-red-400 text-center py-4">Failed: ${err.message}</div>`;
    } finally {
      diarizeBtn.disabled = false;
      diarizeBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">group</span> Diarize & Pan L/R';
    }
  });
  
  rateInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    rateVal.textContent = val.toFixed(1) + 'x';
    if (player) player.playbackRate = val;
  });
  
  pitchInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    pitchVal.textContent = val + ' semitones';
    if (pitchShift) pitchShift.pitch = val;
  });
  
  reverbInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    reverbVal.textContent = Math.round(val * 100) + '%';
    if (reverb) reverb.wet.value = val;
  });

  delayInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    delayVal.textContent = Math.round(val * 100) + '%';
    if (delay) { delay.feedback.value = val; delay.wet.value = val > 0 ? 0.5 : 0; }
  });

  distInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    distVal.textContent = val.toFixed(2);
    if (dist) dist.distortion = val;
  });

  chorusInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    chorusVal.textContent = Math.round(val * 100) + '%';
    if (chorus) chorus.depth = val;
  });

  panInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    panVal.textContent = val === 0 ? 'Center' : (val < 0 ? `L ${Math.round(Math.abs(val)*100)}%` : `R ${Math.round(val*100)}%`);
    if (panner) panner.pan.value = val;
  });
}
