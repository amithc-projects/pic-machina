import { isModelDownloaded } from '../data/models.js';
import { createProject, openProject, saveProject, resolveMediaUrl, revokeMediaUrl, addRecentProject, getRecentProjects, openProjectFromHandle, getWorkspaceRoot, setWorkspaceRoot, scanWorkspaceProjects, createProjectInWorkspace, verifyPermission } from '../utils/project-io.js';

function showDialog(options) {
  return new Promise((resolve) => {
    const { title, message, type = 'confirm', defaultValue = '' } = options;
    const dialog = document.createElement('div');
    dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;color:#fff;backdrop-filter:blur(4px);';
    
    let inputHtml = '';
    if (type === 'prompt') {
      inputHtml = `<input type="text" id="aud-dialog-input" class="ic-input" value="${defaultValue}" style="width:100%;margin-bottom:16px;">`;
    }
    
    dialog.innerHTML = `
      <div style="background:var(--ps-bg-surface);border:1px solid var(--ps-border);border-radius:8px;padding:20px;width:320px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
        <h3 style="margin-top:0;margin-bottom:8px;color:var(--ps-text);font-size:16px;">${title}</h3>
        <p style="margin-bottom:16px;color:var(--ps-text-muted);font-size:13px;line-height:1.4;">${message}</p>
        ${inputHtml}
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button id="aud-btn-dialog-cancel" class="btn-ghost">Cancel</button>
          <button id="aud-btn-dialog-confirm" class="${type === 'confirm' ? 'btn-danger' : 'btn-primary'}">OK</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    const btnCancel = dialog.querySelector('#aud-btn-dialog-cancel');
    const btnConfirm = dialog.querySelector('#aud-btn-dialog-confirm');
    const inputEl = dialog.querySelector('#aud-dialog-input');
    
    if (inputEl) {
       inputEl.focus();
       inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') btnConfirm.click();
          if (e.key === 'Escape') btnCancel.click();
       });
    }
    
    const close = () => { document.body.removeChild(dialog); };
    
    btnCancel.addEventListener('click', () => { close(); resolve(false); });
    btnConfirm.addEventListener('click', () => { close(); resolve(type === 'prompt' ? (inputEl.value || null) : true); });
  });
}

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

let currentAudioProjectDirHandle = null;
let currentAudioProject = null;
let customVoices = [];
let audioHistory = [];

export async function render(container, hash) {
  if (!currentAudioProject || !currentAudioProjectDirHandle) {
    container.innerHTML = `
      <div class="screen" style="display:flex; flex-direction:column; align-items:center; padding: 48px; gap: 24px; overflow-y:auto; height:100%;">
        <div style="text-align:center;">
           <h2 style="font-size:24px; margin-bottom:8px;">Speech Studio</h2>
           <p class="text-muted" style="font-size:14px;">Select or create an audio project to get started.</p>
        </div>
        <div id="aud-workspace-root" style="width:100%; max-width:800px; display:flex; flex-direction:column; gap:16px;"></div>
      </div>
    `;

    const renderWorkspace = async () => {
       const rootEl = container.querySelector('#aud-workspace-root');
       let workspaceHandle = await getWorkspaceRoot();
       
       if (!workspaceHandle) {
          rootEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; padding:48px; border:2px dashed var(--ps-border); border-radius:12px; background:var(--ps-surface);">
               <span class="material-symbols-outlined text-muted" style="font-size:48px; margin-bottom:16px;">folder_open</span>
               <h3 style="margin-bottom:8px;">No Workspace Selected</h3>
               <p class="text-muted" style="margin-bottom:24px; text-align:center;">A workspace is a local folder on your computer where all your audio projects will be stored.</p>
               <button class="btn-primary" id="aud-btn-set-workspace">Select Workspace Folder</button>
            </div>
          `;
          rootEl.querySelector('#aud-btn-set-workspace').onclick = async () => {
             try {
                workspaceHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                await setWorkspaceRoot(workspaceHandle);
                renderWorkspace();
             } catch(e) { if(e.name !== 'AbortError') alert(e.message); }
          };
          return;
       }
       
       if (!(await verifyPermission(workspaceHandle, true))) {
          rootEl.innerHTML = `<div style="text-align:center; padding:24px;"><p class="text-[var(--ps-orange)] mb-4">Permission required to access Workspace.</p><button class="btn-primary" id="aud-btn-grant">Grant Permission</button></div>`;
          rootEl.querySelector('#aud-btn-grant').onclick = async () => {
             if (await verifyPermission(workspaceHandle, true)) renderWorkspace();
          };
          return;
       }
       
       rootEl.innerHTML = `<div style="text-align:center; padding:24px;"><span class="material-symbols-outlined spin">autorenew</span> Scanning workspace...</div>`;
       const projects = await scanWorkspaceProjects(workspaceHandle);
       
       projects.sort((a,b) => (b.projectData.title || b.projectData.name || '').localeCompare(a.projectData.title || a.projectData.name || ''));
       
       let gridHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
         <div class="text-sm text-muted flex flex-items-center gap-2"><span class="material-symbols-outlined text-[16px]">snippet_folder</span> Workspace: <b>${workspaceHandle.name}</b></div>
         <button class="btn-ghost btn-sm" id="aud-btn-change-workspace" title="Change Workspace"><span class="material-symbols-outlined text-[16px]">edit</span></button>
       </div>`;
       
       gridHtml += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:16px;">`;
       
       // New Project Card
       gridHtml += `
         <button id="aud-btn-new-project" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; background:rgba(255,255,255,0.02); border:2px dashed var(--ps-border); border-radius:12px; cursor:pointer; color:var(--ps-text-muted); transition:0.2s;" onmouseover="this.style.color='var(--ps-blue)'; this.style.borderColor='var(--ps-blue)';" onmouseout="this.style.color='var(--ps-text-muted)'; this.style.borderColor='var(--ps-border)';">
           <span class="material-symbols-outlined" style="font-size:32px; margin-bottom:8px;">add_circle</span>
           <span style="font-size:14px; font-weight:600;">New Audio Project</span>
         </button>
       `;
       
       // Project Cards
       projects.forEach((p, i) => {
         // Filter to audio projects, assume it's audio if it has script or voices, or we can just try to open it
         const isAudio = p.projectData.voices || p.projectData.script !== undefined;
         if (!isAudio) return; // Skip video projects

         const title = p.projectData.title || p.projectData.name || 'Untitled';
         const thumb = `<div style="width:100%; height:120px; background:var(--ps-surface); border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;"><span class="material-symbols-outlined text-muted text-[32px]">record_voice_over</span></div>`;
         
         gridHtml += `
           <div class="aud-project-card" data-index="${i}" style="display:flex; flex-direction:column; padding:12px; background:var(--ps-surface); border:1px solid var(--ps-border); border-radius:12px; cursor:pointer; transition:0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='var(--ps-blue)';" onmouseout="this.style.background='var(--ps-surface)'; this.style.borderColor='var(--ps-border)';">
              ${thumb}
              <span style="font-size:14px; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${title}</span>
              <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px;">${(p.projectData.history || []).length} items</span>
           </div>
         `;
       });
       
       gridHtml += `</div>`;
       rootEl.innerHTML = gridHtml;
       
       rootEl.querySelector('#aud-btn-change-workspace').onclick = async () => {
          try {
             const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
             await setWorkspaceRoot(handle);
             renderWorkspace();
          } catch(e) {}
       };
       
       rootEl.querySelector('#aud-btn-new-project').onclick = async () => {
          const name = await showDialog({ type: 'prompt', title: 'New Project', message: 'Project Name:' });
          if (!name) return;
          try {
             const initialData = {
               title: name,
               script: '',
               voices: [],
               history: []
             };
             const dirHandle = await createProjectInWorkspace(workspaceHandle, name, initialData);
             const fileHandle = await dirHandle.getFileHandle('project.json');
             const file = await fileHandle.getFile();
             currentAudioProject = JSON.parse(await file.text());
             currentAudioProjectDirHandle = dirHandle;
             render(container, hash);
          } catch(e) { alert(e.message); }
       };
       
       rootEl.querySelectorAll('.aud-project-card').forEach(card => {
          card.onclick = async () => {
             const p = projects[card.dataset.index];
             try {
               const projectData = await openProjectFromHandle(p.dirHandle);
               currentAudioProjectDirHandle = p.dirHandle;
               currentAudioProject = projectData;
               
               if (!currentAudioProject.voices) currentAudioProject.voices = [];
               if (!currentAudioProject.history) currentAudioProject.history = [];
               if (!currentAudioProject.script) currentAudioProject.script = '';
               
               // Re-hydrate media handles if needed in future
               render(container, hash);
             } catch(e) { alert('Could not open project.\nError: ' + e.message); }
          };
       });
    };
    
    renderWorkspace();
    return;
  }

  container.innerHTML = `
    <div class="screen aud-screen">
      <div class="screen-header shrink-0">
        <div class="screen-title">
          <span class="material-symbols-outlined">record_voice_over</span>
          Speech Studio
        </div>
        <div class="flex gap-2">
          <button id="aud-tab-dialogue" class="btn-primary">Dialogue Studio</button>
          <button id="aud-tab-voicecraft" class="btn-secondary">VoiceCraft (Custom Voices)</button>
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
              <label class="ic-label">Project Title</label>
              <input type="text" id="aud-input-title" class="ic-input" placeholder="e.g. Explainer Video Voiceover">
            </div>

            <div class="mb-4">
              <label class="ic-label">Engines</label>
              <div class="flex flex-col gap-2 mt-1">
                <label class="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" id="aud-check-kokoro" class="accent-[var(--ps-blue)]">
                  <span>Kokoro TTS (Fast, standard voices)</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" id="aud-check-cb" class="accent-[var(--ps-blue)]">
                  <span>Chatterbox VoiceCraft (Zero-shot cloning)</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" id="aud-check-pt" class="accent-[var(--ps-blue)]">
                  <span>Pocket TTS (Fast voice cloning, ~100 MB)</span>
                </label>
              </div>
              <div id="aud-engine-status" class="text-xs text-[var(--ps-blue)] mt-2 h-4"></div>
              <progress id="aud-engine-progress" class="w-full hidden mt-1 h-1.5 rounded overflow-hidden" value="0" max="100"></progress>
            </div>

            <div class="flex-1 flex flex-col min-h-0">
              <div class="flex justify-between items-end mb-1 shrink-0">
                <label class="ic-label">Script (Text or SRT/VTT)</label>
                <div class="flex gap-2">
                  <button id="aud-btn-load-sample" class="btn-ghost" style="padding: 2px 6px; font-size: 12px;">Load Sample</button>
                  <button id="aud-btn-upload-script" class="btn-secondary" style="padding: 2px 6px; font-size: 12px; display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px;">upload_file</span> Import Captions</button>
                </div>
                <input type="file" id="aud-input-upload-script" style="display: none" accept=".txt,.srt,.vtt,.md">
              </div>
              <textarea id="aud-input" class="ic-input" style="flex: 1; resize: none; font-family: monospace; padding: 12px;" placeholder="[Narrator]: Welcome to Speech Studio.&#10;[Dwight]: You can paste multiple speakers here!"></textarea>
            </div>
            
            <button id="aud-btn-parse" class="btn-primary mt-4 w-full" style="justify-content: center;">Parse Speakers</button>
            </div>
          </div>

          <!-- Section 2: Speaker Mapping & Generate -->
          <div id="aud-section-mapping" class="opacity-50 pointer-events-none transition-opacity duration-300" style="flex: 1; background-color: var(--ps-bg-surface, #1e1e1e); border: 1px solid var(--ps-border, #333); border-radius: 0.5rem; padding: 1.5rem; display: flex; flex-direction: column; min-height: 0;">
            <h2 class="text-lg font-bold mb-4 shrink-0">2. Speaker Mapping</h2>
            
            <div id="aud-speaker-list" class="flex-1 flex flex-col gap-3 mb-6 overflow-y-auto min-h-[50px]" style="padding-right: 0.5rem;">
              <div class="text-sm text-muted">Click 'Parse Speakers' to detect speakers.</div>
            </div>

            <div class="shrink-0 pt-4 border-t border-[var(--ps-border)]">
              <button id="aud-btn-generate" class="btn-primary w-full" style="justify-content: center;" disabled title="Waiting for models...">Generate Audio</button>
              <div id="aud-generate-status" class="text-xs text-muted mt-2 text-center h-4"></div>
              <progress id="aud-generate-progress" class="w-full hidden mt-2 h-1.5 rounded overflow-hidden" value="0" max="100"></progress>
            </div>
          </div>

          <!-- Section 3: Output History -->
          <div id="aud-section-output" class="opacity-50 pointer-events-none transition-opacity duration-300" style="flex: 1; background-color: var(--ps-bg-surface, #1e1e1e); border: 1px solid var(--ps-border, #333); border-radius: 0.5rem; padding: 1.5rem; display: flex; flex-direction: column; min-height: 0;">
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
          <button id="aud-btn-add-voice" class="btn-primary"><span class="material-symbols-outlined text-sm mr-2">add</span>Add Character</button>
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
  
  // Set initial project values
  const inputTitleElDef = container.querySelector('#aud-input-title');
  if (inputTitleElDef && currentAudioProject.title) inputTitleElDef.value = currentAudioProject.title;
  const inputElDef = container.querySelector('#aud-input');
  if (inputElDef && currentAudioProject.script) inputElDef.value = currentAudioProject.script;
  
  if (currentAudioProject.voices) customVoices = currentAudioProject.voices;
  if (currentAudioProject.history) audioHistory = currentAudioProject.history;
  renderHistory();
  
  // Auto-save script changes
  if (inputElDef) {
    inputElDef.addEventListener('input', async () => {
      currentAudioProject.script = inputElDef.value;
      await saveProject(currentAudioProjectDirHandle, currentAudioProject);
    });
  }
  if (inputTitleElDef) {
    inputTitleElDef.addEventListener('input', async () => {
      currentAudioProject.title = inputTitleElDef.value;
      await saveProject(currentAudioProjectDirHandle, currentAudioProject);
    });
  }
  const viewDialogue = container.querySelector('#aud-view-dialogue');
  const viewVoicecraft = container.querySelector('#aud-view-voicecraft');

  const inputTitleEl = container.querySelector('#aud-input-title');
  const checkKokoro = container.querySelector('#aud-check-kokoro');
  const checkCb = container.querySelector('#aud-check-cb');
  const checkPt = container.querySelector('#aud-check-pt');
  const engineStatusEl = container.querySelector('#aud-engine-status');
  const engineProgressEl = container.querySelector('#aud-engine-progress');

  const inputEl = container.querySelector('#aud-input');
  const btnLoadSample = container.querySelector('#aud-btn-load-sample');
  const btnUploadScript = container.querySelector('#aud-btn-upload-script');
  const inputUploadScript = container.querySelector('#aud-input-upload-script');
  const parseBtn = container.querySelector('#aud-btn-parse');
  const speakerListEl = container.querySelector('#aud-speaker-list');
  const generateBtn = container.querySelector('#aud-btn-generate');
  const genStatusEl = container.querySelector('#aud-generate-status');
  const genProgressEl = container.querySelector('#aud-generate-progress');
  
  const sectionMappingEl = container.querySelector('#aud-section-mapping');
  const sectionOutputEl = container.querySelector('#aud-section-output');
  const historyListEl = container.querySelector('#aud-history-list');
  const historyEmptyEl = container.querySelector('#aud-history-empty');

  const btnAddVoice = container.querySelector('#aud-btn-add-voice');
  const customVoicesGrid = container.querySelector('#aud-custom-voices-grid');

  // --- State ---
  customVoices = currentAudioProject?.voices ? [...currentAudioProject.voices] : [];
  audioHistory = currentAudioProject?.history ? [...currentAudioProject.history] : [];
  let detectedSpeakers = [];
  let parsedSegments = [];
  
  // Model Caching
  let kokoroTts = null;
  let kokoroReady = false;
  let cbWorker = null;
  let cbReady = false;
  let ptWorker = null;
  let ptReady = false;

  async function renderHistory() {
     if (!audioHistory || audioHistory.length === 0) {
        if(historyListEl) historyListEl.innerHTML = '<div class="text-sm text-muted" id="aud-history-empty">No audio generated in this session yet.</div>';
        return;
     }
     
     let html = '';
     for (const hist of audioHistory) {
         let wavUrl = '';
         let mp3Url = '';
         if (hist.wavFile) wavUrl = await resolveMediaUrl(hist.wavFile, currentAudioProjectDirHandle) || '';
         if (hist.mp3File) mp3Url = await resolveMediaUrl(hist.mp3File, currentAudioProjectDirHandle) || '';
         
         html += `
           <div class="p-4 border border-[var(--ps-border)] rounded-lg bg-[var(--ps-bg)] flex flex-col gap-3" id="aud-hist-${hist.id}">
             <div class="flex justify-between items-center">
               <span class="font-bold text-[var(--ps-text)]">${hist.title}</span>
               <span class="text-xs text-muted">${hist.durationSecs}s • ${hist.speakerCount} speaker(s)</span>
             </div>
             ${wavUrl ? `<audio controls class="w-full h-10 outline-none" src="${wavUrl}"></audio>` : '<div class="text-xs text-danger">Missing file</div>'}
             <div class="flex gap-2 mt-1">
               ${wavUrl ? `<a href="${wavUrl}" download="${hist.title}.wav" class="btn btn-secondary flex-1 justify-center text-center text-xs">Download .wav</a>` : ''}
               ${mp3Url ? `<a href="${mp3Url}" download="${hist.title}.mp3" class="btn btn-secondary flex-1 justify-center text-center text-xs">Download .mp3</a>` : ''}
             </div>
           </div>
         `;
     }
     if(historyListEl) historyListEl.innerHTML = html;
  }

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
                      if (progressEl) {
                          progressEl.classList.remove('hidden');
                          progressEl.removeAttribute('value');
                      }
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

  /**
   * Built-in reference voices for Pocket TTS, sourced from kyutai/tts-voices.
   * Prefixed pp_ (pocket preset) in the voiceId scheme.
   *
   * Licensing:
   *   CC0 (voice-zero) — public domain, no attribution required.
   *   CC BY 4.0 (alba-mackenna) — attribution: "Alba Mackenna / Kyutai".
   */
  const HF_VOICES = 'https://huggingface.co/kyutai/tts-voices/resolve/main';
  const POCKET_TTS_PRESETS = [
    // ── CC0 — voice-zero (LibriVox sourced) ─────────────────────
    { id: 'bill_boerst',    label: 'Bill (Male)',       url: `${HF_VOICES}/voice-zero/bill_boerst.wav`,    license: 'CC0' },
    { id: 'caro_davy',     label: 'Caro (Female)',     url: `${HF_VOICES}/voice-zero/caro_davy.wav`,     license: 'CC0' },
    { id: 'peter_yearsley',label: 'Peter (Male)',      url: `${HF_VOICES}/voice-zero/peter_yearsley.wav`,license: 'CC0' },
    { id: 'stuart_bell',   label: 'Stuart (Male)',     url: `${HF_VOICES}/voice-zero/stuart_bell.wav`,   license: 'CC0' },
    // ── CC BY 4.0 — alba-mackenna character styles ───────────────
    { id: 'alba_casual',    label: 'Alba — Casual',     url: `${HF_VOICES}/alba-mackenna/casual.wav`,     license: 'CC BY 4.0' },
    { id: 'alba_merchant',  label: 'Alba — Merchant',   url: `${HF_VOICES}/alba-mackenna/merchant.wav`,   license: 'CC BY 4.0' },
    { id: 'alba_announcer', label: 'Alba — Announcer',  url: `${HF_VOICES}/alba-mackenna/announcer.wav`,  license: 'CC BY 4.0' },
  ];

  /** In-memory cache of decoded Float32 reference clips (keyed by preset id). */
  const _ptPresetCache = new Map();

  /**
   * Fetch a preset voice WAV, decode to Float32 at 24 kHz, and cache it.
   * The raw WAV bytes are stored in the browser's Cache API so repeat visits
   * don't re-download.
   */
  async function getPocketTtsPreset(presetId) {
    if (_ptPresetCache.has(presetId)) return _ptPresetCache.get(presetId);

    const preset = POCKET_TTS_PRESETS.find(p => p.id === presetId);
    if (!preset) throw new Error(`Unknown Pocket TTS preset: ${presetId}`);

    // Check browser Cache API first; fall back to network
    const cacheName = 'pocket-tts-voices-v1';
    const cache = await caches.open(cacheName);
    let response = await cache.match(preset.url);
    if (!response) {
      response = await fetch(preset.url);
      if (!response.ok) throw new Error(`Failed to fetch voice "${preset.label}": HTTP ${response.status}`);
      await cache.put(preset.url, response.clone());
    }

    const arrayBuf = await response.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
    const float32 = audioBuf.getChannelData(0);
    await audioCtx.close();

    _ptPresetCache.set(presetId, float32);
    return float32;
  }

  tabDialogue.addEventListener('click', () => {
    tabDialogue.className = 'btn-primary';
    tabVoicecraft.className = 'btn-secondary';
    viewDialogue.style.display = 'flex';
    viewVoicecraft.style.display = 'none';
    renderSpeakerList(); // Refresh dropdowns in case voices changed
  });

  tabVoicecraft.addEventListener('click', () => {
    tabVoicecraft.className = 'btn-primary';
    tabDialogue.className = 'btn-secondary';
    viewVoicecraft.style.display = 'flex';
    viewDialogue.style.display = 'none';
    loadCustomVoices();
  });

  // --- VoiceCraft Logic ---
  async function loadCustomVoices() {
    customVoices = currentAudioProject.voices || [];
    await renderCustomVoices();
  }

  async function renderCustomVoices() {
    let html = '';
    for (const v of customVoices) {
      const blobUrl = await resolveMediaUrl(v.filename, currentAudioProjectDirHandle);
      html += `
      <div class="flex flex-col bg-[var(--ps-bg)] border border-[var(--ps-border)] rounded p-4">
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[var(--ps-blue)]"></div>
            <span class="font-bold text-sm">${v.name}</span>
          </div>
          <button class="material-symbols-outlined text-muted hover:text-danger cursor-pointer text-sm" data-delete-id="${v.id}">close</button>
        </div>
        <div class="text-xs text-muted mb-2">Voice Sample</div>
        <audio controls class="w-full h-8 outline-none rounded" src="${blobUrl}"></audio>
      </div>`;
    }
    customVoicesGrid.innerHTML = html;

    customVoicesGrid.querySelectorAll('button[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-delete-id');
        if (await showDialog({ title: 'Delete Voice', message: 'Delete this custom voice?' })) {
          currentAudioProject.voices = currentAudioProject.voices.filter(v => v.id !== id);
          await saveProject(currentAudioProjectDirHandle, currentAudioProject);
          loadCustomVoices();
        }
      });
    });
  }

  btnAddVoice.addEventListener('click', async () => {
    try {
      const handles = await window.showOpenFilePicker({
        id: 'aud_voice_picker',
        types: [{ description: 'Audio Files', accept: {'audio/*': ['.wav', '.mp3', '.mpeg']} }],
        multiple: false
      });
      if (!handles || handles.length === 0) return;
      const file = await handles[0].getFile();
      
      const name = await showDialog({ type: 'prompt', title: 'New Voice', message: 'Enter a name for this Character/Voice:' });
      if (!name) return;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const float32Data = audioBuffer.getChannelData(0);
      await audioCtx.close();

      const wavBlob = audioBufferToWav(float32Data, 24000);
      const wavBuffer = await wavBlob.arrayBuffer();

      const newId = generateId();
      const voicesDirHandle = await currentAudioProjectDirHandle.getDirectoryHandle('voices', { create: true });
      const cleanName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const targetFileName = `${cleanName}_${newId}.wav`;
      const targetFileHandle = await voicesDirHandle.getFileHandle(targetFileName, { create: true });
      const writable = await targetFileHandle.createWritable();
      await writable.write(wavBuffer);
      await writable.close();
      
      currentAudioProject.voices.push({ id: newId, name, filename: 'voices/' + targetFileName });
      await saveProject(currentAudioProjectDirHandle, currentAudioProject);
      loadCustomVoices();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        await showDialog({ title: 'Error', message: 'Failed to process audio file: ' + err.message, type: 'confirm' });
      }
    }
  });

  // --- Script Upload Logic ---
  btnUploadScript.addEventListener('click', async () => {
    try {
      const handles = await window.showOpenFilePicker({
        id: 'aud_script_picker',
        types: [{ description: 'Text Files', accept: {'text/plain': ['.txt', '.srt', '.vtt']} }],
        multiple: false
      });
      if (!handles || handles.length === 0) return;
      const file = await handles[0].getFile();
      let content = await file.text();

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
      inputEl.dispatchEvent(new Event('input'));
    } catch(e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  });
  
  btnLoadSample.addEventListener('click', () => {
    inputEl.value = `[Interviewer]: Thank you for joining us today! Can you tell us a bit about your new project?
[Guest]: Of course! It's an AI-powered voice generation tool that makes creating dialogue incredibly easy.
[Interviewer]: That sounds amazing. How fast is it?
[Guest]: It generates high-quality speech in real-time.`;
    inputEl.dispatchEvent(new Event('input'));
  });

  inputEl.addEventListener('input', () => {
    sectionMappingEl.classList.add('opacity-50', 'pointer-events-none');
    generateBtn.disabled = true;
  });

  // --- Dialogue Studio Logic ---
  function updateGenerateButtonState() {
    const isKokoroChecked = checkKokoro.checked;
    const isCbChecked = checkCb.checked;
    const isPtChecked = checkPt.checked;

    if (!isKokoroChecked && !isCbChecked && !isPtChecked) {
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
    if (isPtChecked && !ptReady) isWaiting = true;

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
      } else if (type === 'pt') {
        if (!(await isModelDownloaded('pocket-tts'))) throw new Error('Pocket TTS model not downloaded. Go to Models to download it (~110 MB).');
        if (!ptWorker) {
          ptWorker = new Worker(new URL('../workers/pocket-tts.worker.js', import.meta.url), { type: 'module' });
          ptWorker.modelLoaded = false;
        }
        if (!ptWorker.modelLoaded) {
          const hasWebGPU = await checkWebGPU();
          await executeWorkerTask(ptWorker, 'load', { useWebGPU: hasWebGPU }, engineStatusEl, engineProgressEl);
          ptWorker.modelLoaded = true;
        }
        ptReady = true;
      }

      engineStatusEl.textContent = '';
      engineProgressEl.classList.add('hidden');
    } catch (err) {
      engineStatusEl.textContent = `Error loading ${type}: ${err.message}`;
      engineProgressEl.classList.add('hidden');
      if (type === 'kokoro') checkKokoro.checked = false;
      if (type === 'cb') checkCb.checked = false;
      if (type === 'pt') checkPt.checked = false;
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

  checkPt.addEventListener('change', () => {
    if (checkPt.checked && !ptReady) loadEngine('pt');
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
      else if (checkPt.checked) defaultSelection = `pp_${POCKET_TTS_PRESETS[i % POCKET_TTS_PRESETS.length].id}`;

      let customOptionsHtml = '';
      if (checkCb.checked && customVoices.length > 0) {
        customOptionsHtml += `<optgroup label="Custom (Chatterbox)">${customVoices.map(v => `<option value="cb_${v.id}" ${defaultSelection === `cb_${v.id}` ? 'selected' : ''}>${v.name}</option>`).join('')}</optgroup>`;
      }
      if (checkPt.checked && customVoices.length > 0) {
        customOptionsHtml += `<optgroup label="Custom (Pocket TTS)">${customVoices.map(v => `<option value="pt_${v.id}" ${defaultSelection === `pt_${v.id}` ? 'selected' : ''}>${v.name}</option>`).join('')}</optgroup>`;
      }
      if (checkPt.checked) {
        customOptionsHtml += `<optgroup label="Preset (Pocket TTS)">${POCKET_TTS_PRESETS.map(p => `<option value="pp_${p.id}" ${defaultSelection === `pp_${p.id}` ? 'selected' : ''}>${p.label}${p.license !== 'CC0' ? ' ★' : ''}</option>`).join('')}</optgroup>`;
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
    if (customVoices.length === 0) customVoices = currentAudioProject.voices || [];

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

    sectionMappingEl.classList.remove('opacity-50', 'pointer-events-none');
    renderSpeakerList();
    updateGenerateButtonState();
  });

  generateBtn.addEventListener('click', async () => {
    try {
      generateBtn.disabled = true;
      generateBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm mr-2">refresh</span> Generating...';
      genProgressEl.classList.add('hidden');
      genStatusEl.textContent = 'Preparing generation...';
      
      // Un-gray section 3
      sectionOutputEl.classList.remove('opacity-50', 'pointer-events-none');

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
          const refBlobUrl = await resolveMediaUrl(customRec.filename, currentAudioProjectDirHandle);
          const refResp = await fetch(refBlobUrl);
          const refAudioBuffer = await audioCtx.decodeAudioData(await refResp.arrayBuffer());
          revokeMediaUrl(refBlobUrl);
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
        } else if (voiceId.startsWith('pt_')) {
          if (!ptReady) throw new Error('Pocket TTS engine is not ready.');
          const dbId = voiceId.substring(3);
          const customRec = customVoices.find(c => c.id === dbId);
          if (!customRec) throw new Error('Custom voice missing for Pocket TTS');

          // Decode reference audio at 24 kHz (same store as Chatterbox custom voices)
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
          const refBlobUrl = await resolveMediaUrl(customRec.filename, currentAudioProjectDirHandle);
          const refResp = await fetch(refBlobUrl);
          const refAudioBuffer = await audioCtx.decodeAudioData(await refResp.arrayBuffer());
          revokeMediaUrl(refBlobUrl);
          const refFloat32 = refAudioBuffer.getChannelData(0);
          await audioCtx.close();

          genStatusEl.textContent = `Generating segment ${i + 1} of ${parsedSegments.length} (Pocket TTS)...`;

          const { waveform } = await executeWorkerTask(ptWorker, 'generate', {
            text: seg.text,
            refFloat32Array: refFloat32,
            speakerId: dbId,
            sampleRate: 24000,
          }, genStatusEl, genProgressEl);

          audioData = new Float32Array(waveform);
        } else if (voiceId.startsWith('pp_')) {
          if (!ptReady) throw new Error('Pocket TTS engine is not ready.');
          const presetId = voiceId.substring(3);

          genStatusEl.textContent = `Loading preset voice "${presetId}"...`;
          const refFloat32 = await getPocketTtsPreset(presetId);

          genStatusEl.textContent = `Generating segment ${i + 1} of ${parsedSegments.length} (Pocket TTS preset)...`;

          const { waveform } = await executeWorkerTask(ptWorker, 'generate', {
            text: seg.text,
            refFloat32Array: refFloat32,
            speakerId: `preset_${presetId}`,
            sampleRate: 24000,
          }, genStatusEl, genProgressEl);

          audioData = new Float32Array(waveform);
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
      const outputsDirHandle = await currentAudioProjectDirHandle.getDirectoryHandle('outputs', { create: true });
      const cleanTitle = inputTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const baseName = `${cleanTitle}_${historyId}`;
      
      const wavFh = await outputsDirHandle.getFileHandle(baseName + '.wav', { create: true });
      const wavWritable = await wavFh.createWritable();
      await wavWritable.write(wavBlob);
      await wavWritable.close();
      
      genStatusEl.textContent = 'Encoding MP3...';
      const mp3Blob = await encodeMp3(combinedAudio, SAMPLE_RATE);
      const mp3Fh = await outputsDirHandle.getFileHandle(baseName + '.mp3', { create: true });
      const mp3Writable = await mp3Fh.createWritable();
      await mp3Writable.write(mp3Blob);
      await mp3Writable.close();
      
      const wavUrl = URL.createObjectURL(wavBlob);
      const mp3Url = URL.createObjectURL(mp3Blob);
      
      currentAudioProject.history.unshift({
         id: historyId,
         title: inputTitle,
         durationSecs,
         speakerCount: detectedSpeakers.length,
         wavFile: 'outputs/' + baseName + '.wav',
         mp3File: 'outputs/' + baseName + '.mp3'
      });
      await saveProject(currentAudioProjectDirHandle, currentAudioProject);

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
    if (checkKokoro.checked || checkCb.checked || checkPt.checked || kokoroReady || cbReady || ptReady) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  const handleNavClick = async (e) => {
    if (checkKokoro.checked || checkCb.checked || checkPt.checked || kokoroReady || cbReady || ptReady) {
      e.preventDefault();
      e.stopPropagation();
      if (await showDialog({ title: 'Leave Page?', message: "Warning: You have loaded TTS engines. If you leave this page, you will need to re-compile them again later (which can take 60+ seconds). Are you sure you want to leave?" })) {
         window.removeEventListener('beforeunload', handleBeforeUnload);
         navItems.forEach(item => item.removeEventListener('click', handleNavClick, true));
         window.location.hash = e.currentTarget.getAttribute('href');
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
