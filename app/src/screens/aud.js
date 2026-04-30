import { isModelDownloaded } from '../data/models.js';
import { getCustomVoices, saveCustomVoice, deleteCustomVoice } from '../data/voices.js';

async function checkWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export async function render(container, hash) {
  container.innerHTML = `
    <div class="h-full flex flex-col bg-[var(--ps-bg)]">
      <div class="border-b border-[var(--ps-border)] p-4 flex items-center shrink-0">
        <h1 class="text-xl font-bold flex-1">Audio Studio</h1>
        <div class="flex gap-2">
          <button id="aud-tab-dialogue" class="btn btn-primary">Dialogue Studio</button>
          <button id="aud-tab-voicecraft" class="btn btn-secondary">VoiceCraft (Custom Voices)</button>
        </div>
      </div>
      
      <!-- Dialogue Studio Tab -->
      <div id="aud-view-dialogue" class="flex-1 p-6" style="display: flex; flex-direction: column; min-height: 0;">
        <div style="display: flex; gap: 1.5rem; flex: 1; min-height: 0;">
          
          <!-- Section 1: Input & Model Choice -->
          <div style="flex: 1; background-color: var(--ps-bg-surface, #1e1e1e); border: 1px solid var(--ps-border, #333); border-radius: 0.5rem; padding: 1.5rem; display: flex; flex-direction: column; min-height: 0;">
            <div class="flex flex-col h-full overflow-y-auto" style="padding-right: 0.5rem;">
            <h2 class="text-lg font-bold mb-4">1. Script & Engine</h2>
            
            <div class="mb-4">
              <label class="text-sm font-bold text-muted mb-1 block">Project Title</label>
              <input type="text" id="aud-input-title" class="w-full bg-[var(--ps-bg)] text-[var(--ps-text)] border border-[var(--ps-border)] rounded p-2 text-sm focus:outline-none focus:border-[var(--ps-blue)]" placeholder="e.g. Explainer Video Voiceover">
            </div>

            <div class="mb-4">
              <label class="text-sm font-bold text-muted mb-1 block">Engines</label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="aud-check-kokoro" class="accent-[var(--ps-blue)]">
                  <span class="text-sm">Kokoro TTS (Fast, standard voices)</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="aud-check-cb" class="accent-[var(--ps-blue)]">
                  <span class="text-sm">Chatterbox VoiceCraft (Zero-shot cloning)</span>
                </label>
              </div>
              <div id="aud-engine-status" class="text-xs text-[var(--ps-blue)] mt-2 h-4"></div>
              <progress id="aud-engine-progress" class="w-full hidden mt-1 h-1.5 rounded overflow-hidden" value="0" max="100"></progress>
            </div>

            <div class="flex-1 flex flex-col min-h-0">
              <div class="flex justify-between items-end mb-1 shrink-0">
                <label class="text-sm font-bold text-muted block">Script (Text or SRT/VTT)</label>
                <button id="aud-btn-upload-script" class="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">upload_file</span> Load File</button>
                <input type="file" id="aud-input-upload-script" class="hidden" accept=".txt,.srt,.vtt,.md">
              </div>
              <textarea id="aud-input" class="w-full flex-1 bg-[var(--ps-bg)] text-[var(--ps-text)] border border-[var(--ps-border)] rounded p-3 font-mono text-sm resize-none focus:outline-none focus:border-[var(--ps-blue)]" placeholder="[Narrator]: Welcome to Audio Studio.&#10;[Dwight]: You can paste multiple speakers here!"></textarea>
            </div>
            
            <button id="aud-btn-parse" class="btn btn-primary mt-4 w-full justify-center shrink-0">Parse Speakers</button>
            </div>
          </div>

          <!-- Section 2: Speaker Mapping & Generate -->
          <div style="flex: 1; background-color: var(--ps-bg-surface, #1e1e1e); border: 1px solid var(--ps-border, #333); border-radius: 0.5rem; padding: 1.5rem; display: flex; flex-direction: column; min-height: 0;">
            <h2 class="text-lg font-bold mb-4 shrink-0">2. Speaker Mapping</h2>
            
            <div id="aud-speaker-list" class="flex-1 flex flex-col gap-3 mb-6 overflow-y-auto min-h-[50px]" style="padding-right: 0.5rem;">
              <div class="text-sm text-muted">Click 'Parse Speakers' to detect speakers.</div>
            </div>

            <div class="shrink-0 pt-4 border-t border-[var(--ps-border)]">
              <button id="aud-btn-generate" class="btn btn-primary w-full justify-center" disabled title="Waiting for models...">Generate Audio</button>
              <div id="aud-generate-status" class="text-xs text-muted mt-2 text-center h-4"></div>
              <progress id="aud-generate-progress" class="w-full hidden mt-2 h-1.5 rounded overflow-hidden" value="0" max="100"></progress>
            </div>
          </div>

          <!-- Section 3: Output History -->
          <div id="aud-section-output" class="transition-opacity" style="flex: 1; background-color: var(--ps-bg-surface, #1e1e1e); border: 1px solid var(--ps-border, #333); border-radius: 0.5rem; padding: 1.5rem; display: flex; flex-direction: column; min-height: 0;">
            <h2 class="text-lg font-bold mb-4 shrink-0">3. Output History</h2>
            <div id="aud-history-list" class="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0" style="padding-right: 0.5rem;">
              <div class="text-sm text-muted" id="aud-history-empty">No audio generated in this session yet.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- VoiceCraft Tab -->
      <div id="aud-view-voicecraft" class="p-6" style="display: none; flex: 1; flex-direction: column; overflow-y: auto; min-height: 0; background-color: var(--ps-bg-surface, #1e1e1e);">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-xl font-bold mb-1">VoiceCraft</h2>
            <div class="text-sm text-muted">Create custom zero-shot voices for the Chatterbox TTS engine. Upload clean, 10-15s samples (.wav or .mp3).</div>
          </div>
          <button id="aud-btn-add-voice" class="btn btn-primary"><span class="material-symbols-outlined text-sm mr-2">add</span>Add Character</button>
        </div>
        
        <div id="aud-custom-voices-grid" class="grid grid-cols-2 gap-4">
          <!-- Voice cards render here -->
        </div>
      </div>
    </div>
  `;

  // --- Element Refs ---
  const tabDialogue = container.querySelector('#aud-tab-dialogue');
  const tabVoicecraft = container.querySelector('#aud-tab-voicecraft');
  const viewDialogue = container.querySelector('#aud-view-dialogue');
  const viewVoicecraft = container.querySelector('#aud-view-voicecraft');

  const inputTitleEl = container.querySelector('#aud-input-title');
  const checkKokoro = container.querySelector('#aud-check-kokoro');
  const checkCb = container.querySelector('#aud-check-cb');
  const engineStatusEl = container.querySelector('#aud-engine-status');
  const engineProgressEl = container.querySelector('#aud-engine-progress');

  const inputEl = container.querySelector('#aud-input');
  const btnUploadScript = container.querySelector('#aud-btn-upload-script');
  const inputUploadScript = container.querySelector('#aud-input-upload-script');
  const parseBtn = container.querySelector('#aud-btn-parse');
  const speakerListEl = container.querySelector('#aud-speaker-list');
  const generateBtn = container.querySelector('#aud-btn-generate');
  const genStatusEl = container.querySelector('#aud-generate-status');
  const genProgressEl = container.querySelector('#aud-generate-progress');
  
  const sectionOutputEl = container.querySelector('#aud-section-output');
  const historyListEl = container.querySelector('#aud-history-list');
  const historyEmptyEl = container.querySelector('#aud-history-empty');

  const btnAddVoice = container.querySelector('#aud-btn-add-voice');
  const customVoicesGrid = container.querySelector('#aud-custom-voices-grid');

  // --- State ---
  let customVoices = [];
  let detectedSpeakers = [];
  let parsedSegments = [];
  
  // Model Caching
  let kokoroTts = null;
  let kokoroReady = false;
  let cbWorker = null;
  let cbReady = false;

  let audioHistory = [];

  function executeWorkerTask(worker, type, payload, statusEl, progressEl) {
      return new Promise((resolve, reject) => {
          const handler = (e) => {
              const res = e.data;
              if (res.type === 'error') {
                  worker.removeEventListener('message', handler);
                  reject(new Error(res.payload));
              } else if (res.type === 'progress') {
                  const prog = res.payload;
                  if (prog.status === 'download') {
                      if (statusEl) statusEl.textContent = `Downloading ${prog.name}...`;
                      if (progressEl && prog.total) {
                          progressEl.classList.remove('hidden');
                          progressEl.value = (prog.loaded / prog.total) * 100;
                      }
                  } else if (prog.status === 'done') {
                      if (statusEl) statusEl.innerHTML = `<span class="animate-pulse" style="display: inline-block; background-color: #fbbf24; color: #000; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 0.75rem;">Loaded ${prog.name}. Compiling sessions...</span>`;
                      if (progressEl) progressEl.classList.add('hidden');
                  } else if (prog.status === 'encoding_speaker') {
                      if (statusEl) statusEl.textContent = `Encoding speaker...`;
                  } else if (prog.status === 'generating') {
                      if (statusEl) statusEl.textContent = `Generating audio...`;
                  }
              } else if (res.type === `${type}:complete`) {
                  worker.removeEventListener('message', handler);
                  resolve(res.payload);
              }
          };
          worker.addEventListener('message', handler);
          worker.postMessage({ type, payload });
      });
  }

  const KOKORO_OPTIONS = [
    { label: 'af_heart (American Female)', value: 'af_heart' },
    { label: 'am_echo (American Male)', value: 'am_echo' },
    { label: 'bf_emma (British Female)', value: 'bf_emma' },
    { label: 'bm_george (British Male)', value: 'bm_george' },
  ];

  tabDialogue.addEventListener('click', () => {
    tabDialogue.className = 'btn btn-primary';
    tabVoicecraft.className = 'btn btn-secondary';
    viewDialogue.style.display = 'flex';
    viewVoicecraft.style.display = 'none';
    renderSpeakerList(); // Refresh dropdowns in case voices changed
  });

  tabVoicecraft.addEventListener('click', () => {
    tabVoicecraft.className = 'btn btn-primary';
    tabDialogue.className = 'btn btn-secondary';
    viewVoicecraft.style.display = 'flex';
    viewDialogue.style.display = 'none';
    loadCustomVoices();
  });

  // --- VoiceCraft Logic ---
  async function loadCustomVoices() {
    customVoices = await getCustomVoices();
    renderCustomVoices();
  }

  function renderCustomVoices() {
    customVoicesGrid.innerHTML = customVoices.map(v => `
      <div class="flex flex-col bg-[var(--ps-bg)] border border-[var(--ps-border)] rounded p-4">
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[var(--ps-blue)]"></div>
            <span class="font-bold text-sm">${v.name}</span>
          </div>
          <button class="material-symbols-outlined text-muted hover:text-danger cursor-pointer text-sm" data-delete-id="${v.id}">close</button>
        </div>
        <div class="text-xs text-muted mb-2">Voice Sample</div>
        <audio controls class="w-full h-8 outline-none rounded" src="${URL.createObjectURL(new Blob([v.bytes], { type: 'audio/wav' }))}"></audio>
      </div>
    `).join('');

    customVoicesGrid.querySelectorAll('button[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-delete-id');
        if (confirm('Delete this custom voice?')) {
          await deleteCustomVoice(id);
          loadCustomVoices();
        }
      });
    });
  }

  btnAddVoice.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/wav, audio/mpeg, audio/mp3';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const name = prompt('Enter a name for this Character/Voice:');
      if (!name) return;

      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const float32Data = audioBuffer.getChannelData(0);
        await audioCtx.close();

        // Convert to WAV buffer for IDB storage (simpler than storing raw arrays and reconstructing)
        const wavBlob = audioBufferToWav(float32Data, 24000);
        const wavBuffer = await wavBlob.arrayBuffer();

        await saveCustomVoice(generateId(), name, wavBuffer);
        loadCustomVoices();
      } catch (err) {
        console.error(err);
        alert('Failed to process audio file: ' + err.message);
      }
    };
    input.click();
  });

  // --- Script Upload Logic ---
  btnUploadScript.addEventListener('click', () => {
    inputUploadScript.click();
  });

  inputUploadScript.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let content = event.target.result;
      
      if (file.name.toLowerCase().endsWith('.srt')) {
        const blocks = content.trim().split(/\n\s*\n/);
        const textLines = [];
        for (const block of blocks) {
            const lines = block.split('\n');
            const dialogueLines = lines.filter(line => !/^\d+$/.test(line.trim()) && !/-->/.test(line));
            if (dialogueLines.length > 0) textLines.push(dialogueLines.join(' '));
        }
        content = textLines.join('\n\n');
      } else if (file.name.toLowerCase().endsWith('.vtt')) {
        const blocks = content.trim().split(/\n\s*\n/);
        const textLines = [];
        for (const block of blocks) {
            if (block.startsWith('WEBVTT')) continue;
            const lines = block.split('\n');
            const dialogueLines = lines.filter(line => !/-->/.test(line));
            if (dialogueLines.length > 0) textLines.push(dialogueLines.join(' '));
        }
        content = textLines.join('\n\n');
      }

      inputEl.value = content;
      inputUploadScript.value = ''; // Reset for next upload
    };
    reader.readAsText(file);
  });

  // --- Dialogue Studio Logic ---
  function updateGenerateButtonState() {
    const isKokoroChecked = checkKokoro.checked;
    const isCbChecked = checkCb.checked;

    if (!isKokoroChecked && !isCbChecked) {
      generateBtn.disabled = true;
      generateBtn.title = "Select at least one engine above.";
      return;
    }
    if (parsedSegments.length === 0) {
      generateBtn.disabled = true;
      generateBtn.title = "Parse some text first.";
      return;
    }

    let isWaiting = false;
    if (isKokoroChecked && !kokoroReady) isWaiting = true;
    if (isCbChecked && !cbReady) isWaiting = true;

    if (isWaiting) {
      generateBtn.disabled = true;
      generateBtn.title = "Waiting for engines to finish compiling...";
      generateBtn.textContent = "Waiting for model...";
    } else {
      generateBtn.disabled = false;
      generateBtn.title = "";
      generateBtn.textContent = "Generate Audio";
    }
  }

  async function loadEngine(type) {
    try {
      engineProgressEl.classList.remove('hidden');
      engineStatusEl.textContent = `Initializing ${type}...`;
      
      if (type === 'kokoro') {
        if (!(await isModelDownloaded('kokoro-82m'))) throw new Error('Kokoro TTS model not downloaded.');
        const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
        kokoroTts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8' });
        kokoroReady = true;
      } else if (type === 'cb') {
        if (!(await isModelDownloaded('chatterbox-tts'))) throw new Error('Chatterbox TTS model not downloaded.');
        if (!cbWorker) {
            cbWorker = new Worker(new URL('../workers/chatterbox.worker.js', import.meta.url), { type: 'module' });
            cbWorker.modelLoaded = false;
        }
        if (!cbWorker.modelLoaded) {
            const hasWebGPU = await checkWebGPU();
            await executeWorkerTask(cbWorker, 'load', { useWebGPU: hasWebGPU }, engineStatusEl, engineProgressEl);
            cbWorker.modelLoaded = true;
        }
        cbReady = true;
      }

      engineStatusEl.textContent = '';
      engineProgressEl.classList.add('hidden');
    } catch (err) {
      engineStatusEl.textContent = `Error loading ${type}: ${err.message}`;
      engineProgressEl.classList.add('hidden');
      if (type === 'kokoro') checkKokoro.checked = false;
      if (type === 'cb') checkCb.checked = false;
    }
    updateGenerateButtonState();
    renderSpeakerList();
  }

  checkKokoro.addEventListener('change', () => {
    if (checkKokoro.checked && !kokoroReady) loadEngine('kokoro');
    else { updateGenerateButtonState(); renderSpeakerList(); }
  });

  checkCb.addEventListener('change', () => {
    if (checkCb.checked && !cbReady) loadEngine('cb');
    else { updateGenerateButtonState(); renderSpeakerList(); }
  });

  function renderSpeakerList() {
    if (detectedSpeakers.length === 0) return;

    speakerListEl.innerHTML = detectedSpeakers.map((spk, i) => {
      const spkLower = spk.toLowerCase();
      
      // Auto-match VoiceCraft (Chatterbox) Custom Voices First
      let autoMatchedCb = null;
      if (checkCb.checked && customVoices.length > 0) {
        autoMatchedCb = customVoices.find(v => v.name.toLowerCase().includes(spkLower) || spkLower.includes(v.name.toLowerCase()));
      }
      
      // If no CB match, Auto-match Kokoro Standard Voices
      let autoMatchedKk = null;
      if (!autoMatchedCb && checkKokoro.checked) {
        autoMatchedKk = KOKORO_OPTIONS.find(opt => opt.label.toLowerCase().includes(spkLower) || spkLower.includes(opt.label.toLowerCase()));
      }

      // Determine default
      let defaultSelection = '';
      if (autoMatchedCb) defaultSelection = `cb_${autoMatchedCb.id}`;
      else if (autoMatchedKk) defaultSelection = `kk_${autoMatchedKk.value}`;
      else if (checkKokoro.checked) defaultSelection = `kk_${KOKORO_OPTIONS[i % KOKORO_OPTIONS.length].value}`;
      else if (checkCb.checked && customVoices.length > 0) defaultSelection = `cb_${customVoices[0].id}`;

      let customOptionsHtml = '';
      if (checkCb.checked && customVoices.length > 0) {
        customOptionsHtml = `<optgroup label="Custom (Chatterbox)">${customVoices.map(v => `<option value="cb_${v.id}" ${defaultSelection === `cb_${v.id}` ? 'selected' : ''}>${v.name}</option>`).join('')}</optgroup>`;
      }
        
      let kokoroOptionsHtml = '';
      if (checkKokoro.checked) {
        kokoroOptionsHtml = `<optgroup label="Standard (Kokoro)">${KOKORO_OPTIONS.map(opt => `<option value="kk_${opt.value}" ${defaultSelection === `kk_${opt.value}` ? 'selected' : ''}>${opt.label}</option>`).join('')}</optgroup>`;
      }

      if (!customOptionsHtml && !kokoroOptionsHtml) {
        return `<div class="p-3 bg-[var(--ps-bg)] border border-[var(--ps-border)] rounded text-sm text-muted">Please select an engine above to map speaker: <b>${spk}</b></div>`;
      }

      return `
        <div class="flex flex-col gap-2 p-3 bg-[var(--ps-bg)] border border-[var(--ps-border)] rounded">
          <div class="flex items-center justify-between">
            <span class="font-bold text-sm text-[var(--ps-text)]">${spk}</span>
            <select class="aud-voice-select bg-[var(--ps-bg-surface)] border border-[var(--ps-border)] rounded text-xs px-2 py-1 outline-none" data-speaker="${spk}">
              ${customOptionsHtml}
              ${kokoroOptionsHtml}
            </select>
          </div>
          <div class="flex items-center gap-2 mt-1">
             <span class="text-xs text-muted w-14">Emotion:</span>
             <input type="range" class="aud-emotion-select flex-1" data-speaker="${spk}" min="0" max="1" step="0.05" value="0.5">
          </div>
        </div>
      `;
    }).join('');
  }

  parseBtn.addEventListener('click', async () => {
    const text = inputEl.value.trim();
    if (!text) {
        speakerListEl.innerHTML = '<div class="text-sm text-danger">Please enter some text first.</div>';
        generateBtn.disabled = true;
        return;
    }

    // Pre-load voices if we haven't
    if (customVoices.length === 0) customVoices = await getCustomVoices();

    const lines = text.split('\n');
    detectedSpeakers = [];
    parsedSegments = [];
    let currentSpeaker = 'Default';
    
    for (const line of lines) {
       const tLine = line.trim();
       if (!tLine) continue;
       if (tLine.includes('-->') || /^\d+$/.test(tLine)) continue;
       
       const speakerMatch = tLine.match(/^\[?([A-Za-z0-9 _-]+)\]?\s*:/);
       let content = tLine;
       if (speakerMatch) {
         currentSpeaker = speakerMatch[1].trim();
         content = tLine.substring(speakerMatch[0].length).trim();
       }
       
       if (content) {
         if (!detectedSpeakers.includes(currentSpeaker)) detectedSpeakers.push(currentSpeaker);
         parsedSegments.push({ speaker: currentSpeaker, text: content });
       }
    }

    if (parsedSegments.length === 0) {
       speakerListEl.innerHTML = '<div class="text-sm text-danger">No speakable text found.</div>';
       updateGenerateButtonState();
       return;
    }

    renderSpeakerList();
    updateGenerateButtonState();
  });

  generateBtn.addEventListener('click', async () => {
    try {
      generateBtn.disabled = true;
      generateBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm mr-2">refresh</span> Generating...';
      genProgressEl.classList.add('hidden');
      genStatusEl.textContent = 'Preparing generation...';
      sectionOutputEl.classList.add('opacity-50', 'pointer-events-none');

      const speakerVoiceMap = {};
      const speakerEmotionMap = {};
      container.querySelectorAll('.aud-voice-select').forEach(sel => { speakerVoiceMap[sel.dataset.speaker] = sel.value; });
      container.querySelectorAll('.aud-emotion-select').forEach(sel => { speakerEmotionMap[sel.dataset.speaker] = parseFloat(sel.value); });

      const inputTitle = inputTitleEl.value.trim() || 'Audio_Studio_Output';
      
      if (audioHistory.length === 0) historyListEl.innerHTML = ''; // clear empty message
      const historyId = generateId();
      
      // Insert placeholder immediately
      const placeholderHtml = `
        <div id="aud-hist-${historyId}" class="p-4 rounded-lg flex flex-col gap-3 animate-pulse" style="background-color: #1e3a8a; color: #fff;">
          <div class="flex justify-between items-center">
            <span class="font-bold">${inputTitle}</span>
            <span class="text-xs font-bold uppercase tracking-wider" style="color: #93c5fd;">Generating...</span>
          </div>
        </div>
      `;
      historyListEl.insertAdjacentHTML('afterbegin', placeholderHtml);
      
      // Force DOM repaint before starting heavy processing
      await new Promise(r => setTimeout(r, 50));

      const generatedAudio = [];
      const SAMPLE_RATE = 24000; // Final alignment rate
      let totalSamples = 0;

      for (let i = 0; i < parsedSegments.length; i++) {
        const seg = parsedSegments[i];
        genStatusEl.textContent = `Generating segment ${i + 1} of ${parsedSegments.length}...`;
        
        const voiceId = speakerVoiceMap[seg.speaker] || 'kk_af_heart';
        const emotionVal = speakerEmotionMap[seg.speaker] || 0.5;

        let audioData = null;

        if (voiceId.startsWith('kk_')) {
          if (!kokoroReady) throw new Error('Kokoro TTS engine is not ready.');
          const v = voiceId.substring(3);
          const out = await kokoroTts.generate(seg.text, { voice: v });
          audioData = out.audio; // Float32Array at 24kHz natively usually
        } else if (voiceId.startsWith('cb_')) {
          if (!cbReady) throw new Error('Chatterbox VoiceCraft engine is not ready.');
          const dbId = voiceId.substring(3);
          const customRec = customVoices.find(c => c.id === dbId);
          if (!customRec) throw new Error('Custom voice missing');
          
          // Decode the reference WAV stored in DB at 24000Hz for Chatterbox
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
          const refAudioBuffer = await audioCtx.decodeAudioData(customRec.bytes.slice(0)); // clone buffer
          const refFloat32 = refAudioBuffer.getChannelData(0);
          await audioCtx.close();
          
          genStatusEl.textContent = `Generating segment ${i + 1} of ${parsedSegments.length} (Chatterbox)...`;
          
          const { waveform } = await executeWorkerTask(cbWorker, 'generate', {
              text: seg.text,
              refFloat32Array: refFloat32,
              speakerId: dbId,
              emotionVal: emotionVal
          }, genStatusEl, genProgressEl);
          
          audioData = new Float32Array(waveform);

          // Resample if for some reason the output is not 24kHz
          const CB_RATE = 24000;
          if (CB_RATE !== SAMPLE_RATE) {
             audioData = await resampleFloat32(audioData, CB_RATE, SAMPLE_RATE);
          }
        }

        if (audioData) {
          generatedAudio.push(audioData);
          totalSamples += audioData.length;
        }
      }

      genStatusEl.textContent = 'Compiling final audio...';

      const combinedAudio = new Float32Array(totalSamples);
      let offset = 0;
      for (const audio of generatedAudio) {
        combinedAudio.set(audio, offset);
        offset += audio.length;
      }

      const durationSecs = (totalSamples / SAMPLE_RATE).toFixed(1);

      // Convert to WAV
      const wavBlob = audioBufferToWav(combinedAudio, SAMPLE_RATE);
      const wavUrl = URL.createObjectURL(wavBlob);
      
      // Convert to MP3
      genStatusEl.textContent = 'Encoding MP3...';
      const mp3Blob = await encodeMp3(combinedAudio, SAMPLE_RATE);
      const mp3Url = URL.createObjectURL(mp3Blob);

      // Replace History Placeholder
      const finalHtml = `
        <div class="flex justify-between items-center">
          <span class="font-bold text-[var(--ps-text)]">${inputTitle}</span>
          <span class="text-xs text-muted">${durationSecs}s • ${detectedSpeakers.length} speaker(s)</span>
        </div>
        <audio controls class="w-full h-10 outline-none" src="${wavUrl}"></audio>
        <div class="flex gap-2 mt-1">
          <a href="${wavUrl}" download="${inputTitle}.wav" class="btn btn-secondary flex-1 justify-center text-center text-xs">Download .wav</a>
          <a href="${mp3Url}" download="${inputTitle}.mp3" class="btn btn-secondary flex-1 justify-center text-center text-xs">Download .mp3</a>
        </div>
      `;
      
      const placeholderEl = container.querySelector(`#aud-hist-${historyId}`);
      if (placeholderEl) {
        placeholderEl.className = "p-4 border border-[var(--ps-border)] rounded-lg bg-[var(--ps-bg)] flex flex-col gap-3";
        placeholderEl.innerHTML = finalHtml;
      }
      
      audioHistory.push({ id: historyId });

      genStatusEl.textContent = 'Done!';
    } catch (e) {
      console.error(e);
      alert('Generation failed: ' + e.message);
      genStatusEl.textContent = 'Error occurred.';
      
      // Remove or mark the placeholder as failed
      if (historyId) {
        const placeholderEl = container.querySelector(`#aud-hist-${historyId}`);
        if (placeholderEl) {
          placeholderEl.className = "p-4 border border-[var(--ps-red)] rounded-lg bg-[var(--ps-bg)] flex flex-col gap-3 opacity-50";
          placeholderEl.innerHTML = `<div class="text-xs text-danger">Failed to generate</div>`;
        }
      }
    } finally {
      sectionOutputEl.classList.remove('opacity-50', 'pointer-events-none');
      updateGenerateButtonState();
    }
  });

  // --- Helpers ---
  function audioBufferToWav(float32Array, sampleRate) {
    const numChannels = 1;
    const format = 1;
    const bitDepth = 16;
    const dataLength = float32Array.length * 2;
    const bufferLen = 44 + dataLength;
    const view = new DataView(new ArrayBuffer(bufferLen));
    
    const writeString = (view, offset, string) => { for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); };
    
    writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + dataLength, true); writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, format, true); view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * numChannels * 2, true); view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, bitDepth, true); writeString(view, 36, 'data'); view.setUint32(40, dataLength, true);
    
    let offset = 44;
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  async function encodeMp3(float32Array, sampleRate) {
    // Dynamically load lamejs via script tag (legacy UMD module)
    if (!window.lamejs) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    
    const Mp3Encoder = window.lamejs.Mp3Encoder;
    if (!Mp3Encoder) throw new Error('Failed to load MP3 Encoder');
    
    const mp3encoder = new Mp3Encoder(1, sampleRate, 128); // mono, 128kbps
    const samples = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    const mp3Data = [];
    const sampleBlockSize = 1152; // multiple of 576
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
        const sampleChunk = samples.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
    
    return new Blob(mp3Data, { type: 'audio/mp3' });
  }

  async function resampleFloat32(float32Array, oldRate, newRate) {
    if (oldRate === newRate) return float32Array;
    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, Math.ceil(float32Array.length * newRate / oldRate), newRate);
    const buffer = offlineCtx.createBuffer(1, float32Array.length, oldRate);
    buffer.copyToChannel(float32Array, 0);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  }

  // --- Navigation Protection ---
  const handleBeforeUnload = (e) => {
    if (checkKokoro.checked || checkCb.checked || kokoroReady || cbReady) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  const handleNavClick = (e) => {
    if (checkKokoro.checked || checkCb.checked || kokoroReady || cbReady) {
      if (!confirm("Warning: You have loaded TTS engines. If you leave this page, you will need to re-compile them again later (which can take 60+ seconds). Are you sure you want to leave?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };
  
  // Intercept sidebar clicks in the capture phase to stop hash change if canceled
  const navItems = document.querySelectorAll('a[href^="#"]');
  navItems.forEach(item => item.addEventListener('click', handleNavClick, true));

  // Init
  loadCustomVoices();

  return () => {
     container.querySelectorAll('#aud-history-list audio[src]').forEach(el => URL.revokeObjectURL(el.src));
     container.querySelectorAll('#aud-history-list a[href]').forEach(el => URL.revokeObjectURL(el.href));
     
     window.removeEventListener('beforeunload', handleBeforeUnload);
     navItems.forEach(item => item.removeEventListener('click', handleNavClick, true));
  };
}
