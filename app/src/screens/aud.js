import { dbGet, dbPut } from '../data/db.js';
import { isModelDownloaded } from '../data/models.js';
import { t as i18n } from '../i18n/index.js';
import { trackEvent } from '../utils/telemetry.js';
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
          <button id="aud-btn-dialog-cancel" class="btn-ghost">${i18n('common.cancel')}</button>
          <button id="aud-btn-dialog-confirm" class="${type === 'confirm' ? 'btn-danger' : 'btn-primary'}">${i18n('aud.dialogOk')}</button>
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

// Module-level model caches (persisting across screen re-renders)
let kokoroReady = false;
let kokoroWorker = null;
let cbWorker = null;
let cbReady = false;
let ptWorker = null;
let ptReady = false;
let elReady = false;
let elevenLabsVoices = [];
let localReady = false;
let localTtsVoices = [];
let previewAudio = null;

export async function render(container, hash) {
  if (!currentAudioProject || !currentAudioProjectDirHandle) {
    try {
      const activeRec = await dbGet('folders', 'active_audio_project');
      if (activeRec && activeRec.handle) {
        const dirHandle = activeRec.handle;
        if (await verifyPermission(dirHandle)) {
          const projectData = await openProjectFromHandle(dirHandle);
          currentAudioProjectDirHandle = dirHandle;
          currentAudioProject = projectData;
          if (!currentAudioProject.voices) currentAudioProject.voices = [];
          if (!currentAudioProject.history) currentAudioProject.history = [];
          if (!currentAudioProject.script) currentAudioProject.script = '';
        }
      }
    } catch (e) {
      console.warn('Failed to auto-restore active audio project:', e);
    }
  }

  if (!currentAudioProject || !currentAudioProjectDirHandle) {
    container.innerHTML = `
      <div class="screen" style="display:flex; flex-direction:column; align-items:center; padding: 48px; gap: 24px; overflow-y:auto; height:100%;">
        <div style="text-align:center;">
           <h2 style="font-size:24px; margin-bottom:8px;">${i18n('aud.title')}</h2>
           <p class="text-muted" style="font-size:14px;">${i18n('aud.selectOrCreate')}</p>
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
               <h3 style="margin-bottom:8px;">${i18n('aud.noWorkspace')}</h3>
               <p class="text-muted" style="margin-bottom:24px; text-align:center;">${i18n('aud.workspaceDesc')}</p>
               <button class="btn-primary" id="aud-btn-set-workspace">${i18n('aud.selectWorkspaceFolder')}</button>
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
          rootEl.innerHTML = `<div style="text-align:center; padding:24px;"><p class="text-[var(--ps-orange)] mb-4">${i18n('aud.permissionRequired')}</p><button class="btn-primary" id="aud-btn-grant">${i18n('aud.grantPermission')}</button></div>`;
          rootEl.querySelector('#aud-btn-grant').onclick = async () => {
             if (await verifyPermission(workspaceHandle, true)) renderWorkspace();
          };
          return;
       }
       
       rootEl.innerHTML = `<div style="text-align:center; padding:24px;"><span class="material-symbols-outlined spin">autorenew</span> ${i18n('aud.scanningWorkspace')}</div>`;
       const projects = await scanWorkspaceProjects(workspaceHandle);
       
       projects.sort((a,b) => (b.projectData.title || b.projectData.name || '').localeCompare(a.projectData.title || a.projectData.name || ''));
       
       let gridHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
         <div class="text-sm text-muted flex flex-items-center gap-2"><span class="material-symbols-outlined text-[16px]">snippet_folder</span> ${i18n('aud.workspaceLabel')} <b>${workspaceHandle.name}</b></div>
         <button class="btn-ghost btn-sm" id="aud-btn-change-workspace" title="${i18n('aud.changeWorkspace')}"><span class="material-symbols-outlined text-[16px]">edit</span></button>
       </div>`;
       
       gridHtml += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:16px;">`;
       
       // New Project Card
       gridHtml += `
         <button id="aud-btn-new-project" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; background:rgba(255,255,255,0.02); border:2px dashed var(--ps-border); border-radius:12px; cursor:pointer; color:var(--ps-text-muted); transition:0.2s;" onmouseover="this.style.color='var(--ps-blue)'; this.style.borderColor='var(--ps-blue)';" onmouseout="this.style.color='var(--ps-text-muted)'; this.style.borderColor='var(--ps-border)';">
           <span class="material-symbols-outlined" style="font-size:32px; margin-bottom:8px;">add_circle</span>
           <span style="font-size:14px; font-weight:600;">${i18n('aud.newAudioProject')}</span>
         </button>
       `;
       
       // Project Cards
       projects.forEach((p, i) => {
         // Filter to audio projects, assume it's audio if it has script or voices, or we can just try to open it
         const isAudio = p.projectData.voices || p.projectData.script !== undefined;
         if (!isAudio) return; // Skip video projects

         const title = p.projectData.title || p.projectData.name || i18n('aud.untitled');
         const thumb = `<div style="width:100%; height:120px; background:var(--ps-surface); border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;"><span class="material-symbols-outlined text-muted text-[32px]">record_voice_over</span></div>`;
         
         gridHtml += `
           <div class="aud-project-card" data-index="${i}" style="display:flex; flex-direction:column; padding:12px; background:var(--ps-surface); border:1px solid var(--ps-border); border-radius:12px; cursor:pointer; transition:0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='var(--ps-blue)';" onmouseout="this.style.background='var(--ps-surface)'; this.style.borderColor='var(--ps-border)';">
              ${thumb}
              <span style="font-size:14px; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${title}</span>
              <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px;">${i18n('aud.itemsCount', { count: (p.projectData.history || []).length })}</span>
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
          const name = await showDialog({ type: 'prompt', title: i18n('aud.newProjectTitle'), message: i18n('aud.projectNameLabel') });
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
             await dbPut('folders', { key: 'active_audio_project', handle: dirHandle });
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
               
               await dbPut('folders', { key: 'active_audio_project', handle: p.dirHandle });
               // Re-hydrate media handles if needed in future
               render(container, hash);
             } catch(e) { alert(i18n('aud.couldNotOpenProject', { error: e.message })); }
          };
       });
    };
    
    renderWorkspace();
    return;
  }

  container.innerHTML = `
    <style>
      .hidden { display: none !important; }
    </style>
    <div class="screen aud-screen" style="display:flex; flex-direction:column; height:100%;">
      <div class="screen-header shrink-0" style="display:flex; justify-content:space-between; align-items:center;">
        <div class="flex items-center gap-4">
          <div class="screen-title flex items-center gap-2">
            <span class="material-symbols-outlined text-[var(--ps-blue)]">record_voice_over</span>
            <span>${i18n('aud.title')}</span>
          </div>
          <div class="flex gap-2">
            <button id="aud-tab-dialogue" class="btn-primary btn-sm">${i18n('aud.tabDialogue')}</button>
            <button id="aud-tab-voicecraft" class="btn-secondary btn-sm">${i18n('aud.tabVoicecraft')}</button>
          </div>
        </div>
        <button id="aud-btn-close-project" class="btn-secondary btn-sm" style="display: flex; align-items: center; gap: 4px;">
          <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
          ${i18n('aud.closeProject')}
        </button>
      </div>
      
      <!-- Dialogue Studio Tab -->
      <div id="aud-view-dialogue" class="panel-layout flex-1" style="display: flex; min-height: 0; height: 100%;">
        
        <!-- Left Panel: Engine Selection & Speaker Mapping -->
        <div class="panel-left" style="width: 320px; min-width: 320px; border-right: 1px solid var(--ps-border); background: var(--ps-bg-surface);">
          <div class="panel-header">
            <span class="panel-header-title">${i18n('aud.setupMapping')}</span>
          </div>
          <div class="panel-body flex flex-col gap-4 overflow-y-auto" style="padding: 16px;">
            <div>
              <label class="ic-label">${i18n('aud.projectTitle')}</label>
              <input type="text" id="aud-input-title" class="ic-input" placeholder="${i18n('aud.projectTitlePlaceholder')}" style="margin-top: 4px;">
            </div>

            <div>
              <label class="ic-label">${i18n('aud.speechEngines')}</label>
              <div class="flex flex-col gap-2 mt-2">
                <label class="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" id="aud-check-kokoro" class="accent-[var(--ps-blue)]">
                  <span>${i18n('aud.engineKokoro')}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" id="aud-check-cb" class="accent-[var(--ps-blue)]">
                  <span>${i18n('aud.engineCb')}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" id="aud-check-pt" class="accent-[var(--ps-blue)]">
                  <span>${i18n('aud.enginePt')}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" id="aud-check-el" class="accent-[var(--ps-blue)]">
                  <span>${i18n('aud.engineEl')}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" id="aud-check-local" class="accent-[var(--ps-blue)]">
                  <span>${i18n('aud.engineLocal')}</span>
                </label>
              </div>
              <div id="aud-engine-status" class="text-xs text-[var(--ps-blue)] mt-2 min-h-4"></div>
              <progress id="aud-engine-progress" class="w-full hidden mt-1 h-1.5 rounded overflow-hidden" value="0" max="100"></progress>
            </div>

            <!-- Divider -->
            <div style="border-top: 1px solid var(--ps-border); margin: 8px 0;"></div>

            <!-- Speaker Mapping -->
            <div id="aud-section-mapping" class="flex-1 flex flex-col min-h-0">
              <label class="ic-label mb-2">${i18n('aud.speakerMapping')}</label>
              <div id="aud-speaker-list" class="flex-1 flex flex-col gap-3 overflow-y-auto min-h-[100px] pr-1">
                <div class="text-sm text-muted">${i18n('aud.enterScriptHint')}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Center Panel: Large Transcript Editor -->
        <div class="panel-center" style="flex: 1; display: flex; flex-direction: column; background: var(--ps-bg-app); border-right: 1px solid var(--ps-border);">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
            <span class="panel-header-title">${i18n('aud.scriptEditor')}</span>
            <div class="flex gap-2">
              <button id="aud-btn-load-sample" class="btn-ghost btn-sm" style="font-size: 11px;">${i18n('aud.loadSample')}</button>
              <button id="aud-btn-upload-script" class="btn-secondary btn-sm" style="font-size: 11px; display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px;">upload_file</span> ${i18n('aud.importCaptions')}</button>
            </div>
            <input type="file" id="aud-input-upload-script" style="display: none" accept=".txt,.srt,.vtt,.md">
          </div>
          <div class="panel-body flex flex-col gap-4" style="flex: 1; padding: 16px; min-height: 0; justify-content: space-between;">
            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
              <textarea id="aud-input" class="ic-input" style="flex: 1; width: 100%; min-height: 250px; font-family: monospace; padding: 16px; font-size: 14px; line-height: 1.5; resize: vertical; background: var(--ps-bg-surface); border: 1px solid var(--ps-border);" placeholder="${i18n('aud.scriptPlaceholder')}"></textarea>
            </div>
            
            <div class="flex flex-col gap-3 shrink-0 pt-2">
              <div id="aud-generate-container">
                <button id="aud-btn-generate" class="btn-primary w-full" style="justify-content: center; height: 44px; font-weight: 600;" disabled title="${i18n('aud.titleParseFirst')}">${i18n('aud.generateAudio')}</button>
                <!-- Status/progress are surfaced in the Output History item; these stay hidden. -->
                <div id="aud-generate-status" class="hidden"></div>
                <progress id="aud-generate-progress" class="hidden" value="0" max="100"></progress>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Output History -->
        <div id="aud-section-output" class="panel-right" style="width: 360px; min-width: 360px; background: var(--ps-bg-surface);">
          <div class="panel-header">
            <span class="panel-header-title">${i18n('aud.outputHistory')}</span>
          </div>
          <div class="panel-body flex flex-col gap-4 overflow-y-auto" style="padding: 16px;">
            <div id="aud-history-list" class="flex-1 flex flex-col gap-4">
              <div class="text-sm text-muted" id="aud-history-empty">${i18n('aud.noAudioYet')}</div>
            </div>
          </div>
        </div>

      </div>

      <!-- VoiceCraft Tab -->
      <div id="aud-view-voicecraft" class="p-6" style="display: none; flex: 1; flex-direction: column; overflow-y: auto; min-height: 0; background-color: var(--ps-bg-surface, #1e1e1e);">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-xl font-bold mb-1">${i18n('aud.voicecraftTitle')}</h2>
            <div class="text-sm text-muted">${i18n('aud.voicecraftDesc')}</div>
          </div>
          <button id="aud-btn-add-voice" class="btn-primary"><span class="material-symbols-outlined text-sm mr-2">add</span>${i18n('aud.addCharacter')}</button>
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
  const checkEl = container.querySelector('#aud-check-el');
  const checkLocal = container.querySelector('#aud-check-local');
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
  const generateContainerEl = container.querySelector('#aud-generate-container');
  
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
  
  // Model Caching (using module-level caches)

  const cleanupVisualizers = [];
  const activeVisualizerAnims = [];

  async function renderHistory() {
     if (!audioHistory || audioHistory.length === 0) {
        if(historyListEl) historyListEl.innerHTML = `<div class="text-sm text-muted" id="aud-history-empty">${i18n('aud.noAudioYet')}</div>`;
        return;
     }
     
     let html = '';
     for (const hist of audioHistory) {
         let wavUrl = '';
         let mp3Url = '';
         if (hist.wavFile) wavUrl = await resolveMediaUrl(hist.wavFile, currentAudioProjectDirHandle) || '';
         if (hist.mp3File) mp3Url = await resolveMediaUrl(hist.mp3File, currentAudioProjectDirHandle) || '';
         
         html += `
           <div class="p-4 border border-[var(--ps-border)] rounded-lg bg-[var(--ps-bg)] flex flex-col gap-3 aud-hist-card" id="aud-hist-${hist.id}">
             <div class="flex justify-between items-center">
               <span class="font-bold text-[var(--ps-text)]">${hist.title}</span>
               <span class="text-xs text-muted">${i18n('aud.durationSpeakers', { secs: hist.durationSecs, count: hist.speakerCount })}</span>
             </div>
             ${wavUrl ? `
             <div class="flex items-center gap-3">
               <button class="aud-wave-play btn btn-secondary flex items-center justify-center" title="${i18n('aud.playPause')}" style="width:36px;height:36px;min-width:36px;border-radius:50%;">
                 <span class="material-symbols-outlined text-sm">play_arrow</span>
               </button>
               <div class="flex-1 min-w-0">
                 <canvas class="aud-wave-canvas" width="600" height="48" style="width:100%;height:48px;display:block;cursor:pointer;border-radius:4px;background:rgba(0,0,0,0.15);"></canvas>
                 <div class="aud-wave-time text-xs text-muted mt-1" style="font-variant-numeric:tabular-nums;">0:00 / 0:00</div>
               </div>
               <audio src="${wavUrl}" preload="metadata" style="display:none;"></audio>
             </div>` : `<div class="text-xs text-danger">${i18n('aud.missingFile')}</div>`}
             <div class="flex gap-2 mt-1">
               ${wavUrl ? `<a href="${wavUrl}" download="${hist.title}.wav" class="btn btn-secondary flex-1 justify-center text-center text-xs">${i18n('aud.downloadWav')}</a>` : ''}
               ${mp3Url ? `<a href="${mp3Url}" download="${hist.title}.mp3" class="btn btn-secondary flex-1 justify-center text-center text-xs">${i18n('aud.downloadMp3')}</a>` : ''}
             </div>
           </div>
         `;
     }
     if(historyListEl) {
         historyListEl.innerHTML = html;
         initHistoryVisualizers();
     }
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
                   if (prog.status === 'download' || prog.status === 'downloading' || prog.status === 'progress') {
                       const name = prog.name || prog.file || i18n('aud.modelWeights');
                       let text = i18n('aud.downloading', { name });
                       if (prog.loaded && prog.total) {
                           const loadedMB = (prog.loaded / (1024 * 1024)).toFixed(1);
                           const totalMB = (prog.total / (1024 * 1024)).toFixed(1);
                           text = i18n('aud.downloadingProgress', { name, loaded: loadedMB, total: totalMB });
                       }
                       if (statusEl) statusEl.textContent = text;
                       if (progressEl) {
                           progressEl.classList.remove('hidden');
                           if (prog.total) {
                               progressEl.value = (prog.loaded / prog.total) * 100;
                           } else if (prog.progress) {
                               progressEl.value = prog.progress;
                           }
                       }
                   } else if (prog.status === 'loading_model') {
                       const file = prog.file || '';
                       if (statusEl) statusEl.textContent = i18n('aud.loadingFile', { file, loaded: prog.loaded + 1, total: prog.total });
                       if (progressEl && prog.total) {
                           progressEl.classList.remove('hidden');
                           progressEl.value = ((prog.loaded + 1) / prog.total) * 100;
                       }
                   } else if (prog.status === 'loading_config' || prog.status === 'loading_tokenizer' || prog.status === 'loading_bos') {
                       if (statusEl) statusEl.textContent = i18n('aud.initializingStatus', { status: prog.status.replace('loading_', '') });
                   } else if (prog.status === 'done') {
                       if (statusEl) statusEl.innerHTML = `<span class="animate-pulse" style="display: inline-block; background-color: #fbbf24; color: #000; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 0.75rem;">${i18n('aud.loadedCompiling', { name: prog.name || '' })}</span>`;
                       if (progressEl) {
                           progressEl.classList.remove('hidden');
                           progressEl.removeAttribute('value');
                       }
                   } else if (prog.status === 'encoding_speaker') {
                       if (statusEl) statusEl.textContent = i18n('aud.encodingSpeaker');
                   } else if (prog.status === 'generating') {
                       if (statusEl) statusEl.textContent = i18n('aud.generatingAudio');
                   } else if (prog.status === 'tokenizing' || prog.status === 'encoding_text' || prog.status === 'encoding_voice' || prog.status === 'synthesizing' || prog.status === 'decoding') {
                       if (statusEl) statusEl.textContent = `${prog.status.replace('_', ' ')}...`;
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

  const btnCloseProject = container.querySelector('#aud-btn-close-project');
  if (btnCloseProject) {
    btnCloseProject.onclick = async () => {
      await dbPut('folders', { key: 'active_audio_project', handle: null });
      currentAudioProject = null;
      currentAudioProjectDirHandle = null;
      render(container, hash);
    };
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
    renderSpeakerList();
    updateGenerateButtonState();
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
        <div class="text-xs text-muted mb-2">${i18n('aud.voiceSample')}</div>
        <audio controls class="w-full h-8 outline-none rounded" src="${blobUrl}"></audio>
      </div>`;
    }
    customVoicesGrid.innerHTML = html;

    customVoicesGrid.querySelectorAll('button[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-delete-id');
        if (await showDialog({ title: i18n('aud.deleteVoiceTitle'), message: i18n('aud.deleteVoiceMsg') })) {
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
        types: [{ description: i18n('aud.audioFiles'), accept: {'audio/*': ['.wav', '.mp3', '.mpeg']} }],
        multiple: false
      });
      if (!handles || handles.length === 0) return;
      const file = await handles[0].getFile();

      const name = await showDialog({ type: 'prompt', title: i18n('aud.newVoiceTitle'), message: i18n('aud.newVoiceMsg') });
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
      trackEvent('custom_voice_added', {
          component: 'voice-studio',
          properties: {
              duration: Math.round(audioBuffer.duration * 10) / 10
          }
      });
      loadCustomVoices();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        await showDialog({ title: i18n('aud.errorTitle'), message: i18n('aud.failedProcessAudio', { error: err.message }), type: 'confirm' });
      }
    }
  });

  // --- Script Upload Logic ---
  btnUploadScript.addEventListener('click', async () => {
    try {
      const handles = await window.showOpenFilePicker({
        id: 'aud_script_picker',
        types: [{ description: i18n('aud.textFiles'), accept: {'text/plain': ['.txt', '.srt', '.vtt']} }],
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

  let parseDebounceId = null;
  inputEl.addEventListener('input', () => {
    clearTimeout(parseDebounceId);
    parseDebounceId = setTimeout(parseScript, 300);
  });

  // Parse the script into speakers + segments. Runs automatically as the user
  // types or loads text. If no [Speaker]: tags are present, everything maps to a
  // single implicit "Single voice" speaker.
  function parseScript() {
    const text = inputEl.value.trim();
    detectedSpeakers = [];
    parsedSegments = [];
    if (!text) {
      renderSpeakerList();
      updateGenerateButtonState();
      return;
    }
    if (customVoices.length === 0) customVoices = currentAudioProject.voices || [];

    const lines = text.split('\n');
    let currentSpeaker = i18n('aud.singleVoice');
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
    renderSpeakerList();
    updateGenerateButtonState();
  }

  // --- Dialogue Studio Logic ---
  function updateGenerateButtonState() {
    const isKokoroChecked = checkKokoro.checked;
    const isCbChecked = checkCb.checked;
    const isPtChecked = checkPt.checked;
    const isElChecked = checkEl.checked;
    const isLocalChecked = checkLocal.checked;

    if (parsedSegments.length === 0) {
      generateBtn.disabled = true;
      generateBtn.title = i18n('aud.titleParseFirst');
      return;
    }
    if (!isKokoroChecked && !isCbChecked && !isPtChecked && !isElChecked && !isLocalChecked) {
      generateBtn.disabled = true;
      generateBtn.title = i18n('aud.titleSelectEngine');
      return;
    }

    const requiresCustomVoiceOnly = (isCbChecked || isPtChecked) && !isKokoroChecked && !isElChecked && !isLocalChecked;
    if (requiresCustomVoiceOnly && customVoices.length === 0) {
      generateBtn.disabled = true;
      generateBtn.title = i18n('aud.titleRequiresCustom');
      generateBtn.textContent = i18n('aud.voiceSampleRequired');
      return;
    }

    let isWaiting = false;
    if (isKokoroChecked && !kokoroReady) isWaiting = true;
    if (isCbChecked && !cbReady) isWaiting = true;
    if (isPtChecked && !ptReady) isWaiting = true;
    if (isElChecked && !elReady) isWaiting = true;
    if (isLocalChecked && !localReady) isWaiting = true;

    if (isWaiting) {
      generateBtn.disabled = true;
      generateBtn.title = i18n('aud.titleWaitingCompile');
      generateBtn.textContent = i18n('aud.waitingForModel');
      return;
    }

    // Mapping must be complete: every detected speaker needs an assigned voice.
    const selects = [...container.querySelectorAll('.aud-voice-select')];
    const mappingComplete = selects.length >= detectedSpeakers.length && selects.every(s => s.value);
    if (!mappingComplete) {
      generateBtn.disabled = true;
      generateBtn.title = i18n('aud.titleAssignVoices');
      generateBtn.textContent = i18n('aud.generateAudio');
      return;
    }

    generateBtn.disabled = false;
    generateBtn.title = "";
    generateBtn.textContent = i18n('aud.generateAudio');
  }

  async function loadEngine(type) {
    try {
      engineProgressEl.classList.remove('hidden');
      engineStatusEl.textContent = i18n('aud.initializingEngine', { type });

      if (type === 'kokoro') {
        if (!(await isModelDownloaded('kokoro-82m'))) throw new Error(i18n('aud.errKokoroNotDownloaded'));
        // Run Kokoro in a Web Worker so synthesis stays off the main thread
        // (long scripts were freezing the page).
        if (!kokoroWorker) {
          kokoroWorker = new Worker(new URL('../workers/kokoro.worker.js', import.meta.url), { type: 'module' });
          kokoroWorker.modelLoaded = false;
        }
        if (!kokoroWorker.modelLoaded) {
          await executeWorkerTask(kokoroWorker, 'load', {}, engineStatusEl, engineProgressEl);
          kokoroWorker.modelLoaded = true;
        }
        kokoroReady = true;
      } else if (type === 'cb') {
        if (!(await isModelDownloaded('chatterbox-tts'))) throw new Error(i18n('aud.errCbNotDownloaded'));
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
        if (!(await isModelDownloaded('pocket-tts'))) throw new Error(i18n('aud.errPtNotDownloaded'));
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
      } else if (type === 'el') {
        const { getSettings } = await import('../utils/settings.js');
        const s = getSettings();
        const apiKey = s.elevenlabs?.apiKey;
        if (!apiKey) throw new Error(i18n('aud.errElNoKey'));

        engineStatusEl.textContent = i18n('aud.fetchingElVoices');
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': apiKey }
        });
        if (!response.ok) throw new Error(i18n('aud.errElHttp', { status: response.status }));
        const data = await response.json();
        elevenLabsVoices = data.voices || [];
        elReady = true;
      } else if (type === 'local') {
        const { getSettings } = await import('../utils/settings.js');
        const s = getSettings();
        const gatewayUrl = s.localTts?.url?.trim();
        if (!gatewayUrl) throw new Error(i18n('aud.errLocalNoUrl'));

        engineStatusEl.textContent = i18n('aud.fetchingLocalVoices');
        const response = await fetch(`${gatewayUrl.endsWith('/') ? gatewayUrl : gatewayUrl + '/' }voices`);
        if (!response.ok) throw new Error(i18n('aud.errLocalHttp', { status: response.status }));
        const data = await response.json();
        localTtsVoices = data || [];
        localReady = true;
      }

      engineStatusEl.textContent = '';
      engineProgressEl.classList.add('hidden');
    } catch (err) {
      engineStatusEl.textContent = i18n('aud.errLoadingEngine', { type, error: err.message });
      engineProgressEl.classList.add('hidden');
      if (type === 'kokoro') checkKokoro.checked = false;
      if (type === 'cb') checkCb.checked = false;
      if (type === 'pt') checkPt.checked = false;
      if (type === 'el') checkEl.checked = false;
      if (type === 'local') checkLocal.checked = false;
    }
    // Render the speaker selects FIRST, then evaluate the Generate button —
    // mapping-completeness reads the .aud-voice-select elements.
    renderSpeakerList();
    updateGenerateButtonState();
  }

  checkKokoro.addEventListener('change', () => {
    if (checkKokoro.checked && !kokoroReady) loadEngine('kokoro');
    else { renderSpeakerList(); updateGenerateButtonState(); }
  });

  checkCb.addEventListener('change', () => {
    if (checkCb.checked && !cbReady) loadEngine('cb');
    else { renderSpeakerList(); updateGenerateButtonState(); }
  });

  checkPt.addEventListener('change', () => {
    if (checkPt.checked && !ptReady) loadEngine('pt');
    else { renderSpeakerList(); updateGenerateButtonState(); }
  });

  checkEl.addEventListener('change', () => {
    if (checkEl.checked && !elReady) loadEngine('el');
    else { renderSpeakerList(); updateGenerateButtonState(); }
  });

  checkLocal.addEventListener('change', () => {
    if (checkLocal.checked && !localReady) loadEngine('local');
    else { renderSpeakerList(); updateGenerateButtonState(); }
  });

  // Initial parse for a project that already has a script loaded.
  parseScript();

  function renderSpeakerList() {
    if (detectedSpeakers.length === 0) {
      speakerListEl.innerHTML = `<div class="text-sm text-muted">${i18n('aud.enterScriptHint')}</div>`;
      return;
    }

    const isCbChecked = checkCb.checked;
    const isPtChecked = checkPt.checked;
    const isKokoroChecked = checkKokoro.checked;
    const isElChecked = checkEl.checked;

    // No engine chosen yet: list the detected speakers as "Unassigned" and make
    // it clear that a speech engine must be picked before voices can be mapped.
    if (!isCbChecked && !isPtChecked && !isKokoroChecked && !isElChecked && !checkLocal.checked) {
      speakerListEl.innerHTML = detectedSpeakers.map(spk => `
        <div class="flex items-center justify-between gap-2 p-3 bg-[var(--ps-bg)] border border-[var(--ps-border)] rounded">
          <span class="font-bold text-sm text-[var(--ps-text)]">${spk}</span>
          <span class="text-xs px-2 py-0.5 rounded" style="background:rgba(234,179,8,0.15); color:#eab308;">${i18n('aud.unassigned')}</span>
        </div>`).join('') +
        `<div class="text-xs text-muted mt-1 px-1 flex items-center gap-1"><span class="material-symbols-outlined" style="font-size:14px;">arrow_upward</span>${i18n('aud.chooseEngineHint')}</div>`;
      return;
    }

    const requiresCustomVoice = (isCbChecked || isPtChecked) && !isKokoroChecked && !isElChecked && !checkLocal.checked;
    if (requiresCustomVoice && customVoices.length === 0) {
      speakerListEl.innerHTML = `
        <div class="p-4 bg-[var(--ps-bg)] border border-[var(--ps-border)] rounded flex flex-col gap-2 m-1">
          <div class="flex items-center gap-2 text-[var(--ps-orange)] font-bold text-sm">
            <span class="material-symbols-outlined">warning</span>
            <span>${i18n('aud.customVoiceRequired')}</span>
          </div>
          <div class="text-xs text-[var(--ps-text)] leading-relaxed">
            ${i18n('aud.customVoiceRequiredMsg', { engine: isCbChecked ? 'Chatterbox' : 'Pocket TTS' })}
          </div>
        </div>
      `;
      return;
    }

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

      // If no CB or KK match, Auto-match Eleven Labs
      let autoMatchedEl = null;
      if (!autoMatchedCb && !autoMatchedKk && checkEl.checked && elevenLabsVoices.length > 0) {
        autoMatchedEl = elevenLabsVoices.find(v => v.name.toLowerCase().includes(spkLower) || spkLower.includes(v.name.toLowerCase()));
      }

      // If no CB, KK, or EL match, Auto-match Local Voices
      let autoMatchedLocal = null;
      if (!autoMatchedCb && !autoMatchedKk && !autoMatchedEl && checkLocal.checked && localTtsVoices.length > 0) {
        autoMatchedLocal = localTtsVoices.find(v => v.name.toLowerCase().includes(spkLower) || spkLower.includes(v.name.toLowerCase()));
      }

      // Determine default
      let defaultSelection = '';
      if (autoMatchedCb) defaultSelection = `cb_${autoMatchedCb.id}`;
      else if (autoMatchedKk) defaultSelection = `kk_${autoMatchedKk.value}`;
      else if (autoMatchedEl) defaultSelection = `el_${autoMatchedEl.voice_id}`;
      else if (autoMatchedLocal) defaultSelection = `local_${autoMatchedLocal.id}`;
      else if (checkKokoro.checked) defaultSelection = `kk_${KOKORO_OPTIONS[i % KOKORO_OPTIONS.length].value}`;
      else if (checkCb.checked && customVoices.length > 0) defaultSelection = `cb_${customVoices[0].id}`;
      else if (checkPt.checked) defaultSelection = `pp_${POCKET_TTS_PRESETS[i % POCKET_TTS_PRESETS.length].id}`;
      else if (checkEl.checked && elevenLabsVoices.length > 0) defaultSelection = `el_${elevenLabsVoices[0].voice_id}`;
      else if (checkLocal.checked && localTtsVoices.length > 0) defaultSelection = `local_${localTtsVoices[0].id}`;

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

      let elevenLabsOptionsHtml = '';
      if (checkEl.checked && elevenLabsVoices.length > 0) {
        elevenLabsOptionsHtml = `<optgroup label="Eleven Labs">${elevenLabsVoices.map(v => `<option value="el_${v.voice_id}" ${defaultSelection === `el_${v.voice_id}` ? 'selected' : ''}>${v.name}</option>`).join('')}</optgroup>`;
      }

      let localOptionsHtml = '';
      if (checkLocal.checked && localTtsVoices.length > 0) {
        const engines = {};
        localTtsVoices.forEach(v => {
          const eng = v.engine || 'Local Server';
          if (!engines[eng]) engines[eng] = [];
          engines[eng].push(v);
        });
        
        Object.entries(engines).forEach(([engName, voices]) => {
          localOptionsHtml += `<optgroup label="Local (${engName})">`;
          voices.forEach(v => {
            localOptionsHtml += `<option value="local_${v.id}" ${defaultSelection === `local_${v.id}` ? 'selected' : ''}>${v.name}</option>`;
          });
          localOptionsHtml += `</optgroup>`;
        });
      }

      if (!customOptionsHtml && !kokoroOptionsHtml && !elevenLabsOptionsHtml && !localOptionsHtml) {
        return `<div class="p-3 bg-[var(--ps-bg)] border border-[var(--ps-border)] rounded text-sm text-muted">${i18n('aud.selectEngineToMapSpeaker', { speaker: spk })}</div>`;
      }

      return `
        <div class="flex flex-col gap-2 p-3 bg-[var(--ps-bg)] border border-[var(--ps-border)] rounded">
          <div class="font-bold text-sm text-[var(--ps-text)]">${spk}</div>
          <div class="flex items-center gap-2">
            <select class="aud-voice-select bg-[var(--ps-bg-surface)] border border-[var(--ps-border)] rounded text-xs px-2 py-1 outline-none flex-1 min-w-0" data-speaker="${spk}">
              ${customOptionsHtml}
              ${kokoroOptionsHtml}
              ${elevenLabsOptionsHtml}
              ${localOptionsHtml}
            </select>
            <button class="aud-voice-preview-btn btn btn-secondary p-1 flex items-center justify-center" title="${i18n('aud.previewVoice')}" data-speaker="${spk}" style="width: 28px; height: 28px; min-width: 28px; border-radius: 4px;">
              <span class="material-symbols-outlined text-sm">volume_up</span>
            </button>
          </div>
          <div class="flex items-center gap-2 mt-1">
             <span class="text-xs text-muted w-14">${i18n('aud.emotion')}</span>
             <input type="range" class="aud-emotion-select flex-1" data-speaker="${spk}" min="0" max="1" step="0.05" value="0.5">
          </div>
        </div>
      `;
    }).join('');
  }

  speakerListEl.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('aud-link-to-voicecraft')) {
      e.preventDefault();
      tabVoicecraft.click();
      return;
    }

    const btn = e.target.closest('.aud-voice-preview-btn');
    if (!btn) return;
    
    const speaker = btn.dataset.speaker;
    const selectEl = speakerListEl.querySelector(`.aud-voice-select[data-speaker="${speaker}"]`);
    if (!selectEl) return;
    
    const voiceId = selectEl.value;
    if (!voiceId) return;

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">refresh</span>';

    try {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
      }

      if (voiceId.startsWith('el_')) {
        const elVoiceId = voiceId.substring(3);
        const voice = elevenLabsVoices.find(v => v.voice_id === elVoiceId);
        if (voice && voice.preview_url) {
          const resp = await fetch(voice.preview_url);
          if (!resp.ok) throw new Error(`Failed to download preview: HTTP ${resp.status}`);
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          previewAudio = new Audio(blobUrl);
          previewAudio.onended = () => { URL.revokeObjectURL(blobUrl); };
          await previewAudio.play();
        } else {
          throw new Error(i18n('aud.errNoElPreview'));
        }
      } else if (voiceId.startsWith('cb_') || voiceId.startsWith('pt_')) {
        const dbId = voiceId.substring(3);
        const customRec = customVoices.find(c => c.id === dbId);
        if (customRec) {
          const refBlobUrl = await resolveMediaUrl(customRec.filename, currentAudioProjectDirHandle);
          previewAudio = new Audio(refBlobUrl);
          previewAudio.onended = () => { revokeMediaUrl(refBlobUrl); };
          await previewAudio.play();
        } else {
          throw new Error(i18n('aud.errCustomVoiceNotFound'));
        }
      } else if (voiceId.startsWith('pp_')) {
        const presetId = voiceId.substring(3);
        const preset = POCKET_TTS_PRESETS.find(p => p.id === presetId);
        if (preset && preset.url) {
          previewAudio = new Audio(preset.url);
          await previewAudio.play();
        } else {
          throw new Error(i18n('aud.errPresetUrlNotFound'));
        }
      } else if (voiceId.startsWith('kk_')) {
        if (!kokoroReady || !kokoroWorker) {
          throw new Error(i18n('aud.errEnableKokoroFirst'));
        }
        const v = voiceId.substring(3);
        const { waveform } = await executeWorkerTask(kokoroWorker, 'generate', { text: "Kokoro voice preview", voice: v });
        const wavBlob = audioBufferToWav(new Float32Array(waveform), 24000);
        const blobUrl = URL.createObjectURL(wavBlob);
        previewAudio = new Audio(blobUrl);
        previewAudio.onended = () => { URL.revokeObjectURL(blobUrl); };
        await previewAudio.play();
      } else if (voiceId.startsWith('local_')) {
        const localVoiceId = voiceId.substring(6);
        const voice = localTtsVoices.find(v => v.id === localVoiceId);
        if (voice) {
          const { getSettings } = await import('../utils/settings.js');
          const s = getSettings();
          const gatewayUrl = s.localTts?.url?.trim();
          if (!gatewayUrl) throw new Error(i18n('aud.errLocalNoUrlShort'));

          let previewUrl = voice.preview_url;
          if (previewUrl && !previewUrl.startsWith('http://') && !previewUrl.startsWith('https://')) {
            const p = previewUrl.startsWith('/') ? previewUrl.substring(1) : previewUrl;
            const base = gatewayUrl.endsWith('/') ? gatewayUrl : gatewayUrl + '/';
            previewUrl = base + p;
          }

          if (previewUrl) {
            const resp = await fetch(previewUrl);
            if (!resp.ok) throw new Error(`Failed to download local preview: HTTP ${resp.status}`);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            previewAudio = new Audio(blobUrl);
            previewAudio.onended = () => { URL.revokeObjectURL(blobUrl); };
            await previewAudio.play();
          } else {
            throw new Error(i18n('aud.errNoLocalPreview'));
          }
        } else {
          throw new Error(i18n('aud.errLocalVoiceNotFound'));
        }
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  });

  if (parseBtn) parseBtn.addEventListener('click', () => parseScript());

  generateBtn.addEventListener('click', async () => {
    let historyId = null;
    try {
      generateBtn.disabled = true;
      generateBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm mr-2">refresh</span> ${i18n('aud.generatingShort')}`;
      genStatusEl.textContent = '';
      
      trackEvent('speech_generation_started', {
          component: 'voice-studio',
          properties: {
              segment_count: parsedSegments.length,
              speaker_count: detectedSpeakers.length
          }
      });

      const speakerVoiceMap = {};
      const speakerEmotionMap = {};
      container.querySelectorAll('.aud-voice-select').forEach(sel => { speakerVoiceMap[sel.dataset.speaker] = sel.value; });
      container.querySelectorAll('.aud-emotion-select').forEach(sel => { speakerEmotionMap[sel.dataset.speaker] = parseFloat(sel.value); });

      const inputTitle = inputTitleEl.value.trim() || 'Audio_Studio_Output';

      if (audioHistory.length === 0) historyListEl.innerHTML = ''; // clear empty message
      historyId = generateId();

      // Insert placeholder immediately — the progress bar lives here, in the
      // output-history slot the finished item will occupy.
      const placeholderHtml = `
        <div id="aud-hist-${historyId}" class="p-4 rounded-lg flex flex-col gap-2" style="background-color: #1e3a8a; color: #fff;">
          <div class="flex justify-between items-center">
            <span class="font-bold">${inputTitle}</span>
            <span class="text-xs font-bold uppercase tracking-wider aud-ph-phase" style="color: #93c5fd;">${i18n('aud.generatingShort')}</span>
          </div>
          <progress class="aud-ph-progress w-full h-1.5 rounded overflow-hidden" value="0" max="100"></progress>
          <div class="aud-ph-status text-xs font-medium" style="color:#dbeafe;">${i18n('aud.preparingGeneration')}</div>
          <div class="aud-ph-substatus text-xs" style="color:#93c5fd; min-height: 1em;"></div>
        </div>
      `;
      historyListEl.insertAdjacentHTML('afterbegin', placeholderHtml);
      const phProgressEl = container.querySelector(`#aud-hist-${historyId} .aud-ph-progress`);
      const phStatusEl = container.querySelector(`#aud-hist-${historyId} .aud-ph-status`);
      const phPhaseEl = container.querySelector(`#aud-hist-${historyId} .aud-ph-phase`);
      const phSubStatusEl = container.querySelector(`#aud-hist-${historyId} .aud-ph-substatus`);
      // Main phase line ("Segment 2 of 8") + progress bar. The sub-status line is
      // driven separately by the worker (e.g. "synthesizing…") so the phase count
      // is never clobbered.
      const setGenProgress = (val, text) => {
        if (phProgressEl && val != null) phProgressEl.value = val;
        if (phStatusEl && text != null) phStatusEl.textContent = text;
        if (phSubStatusEl) phSubStatusEl.textContent = ''; // new phase clears the sub-status
        if (val != null) genProgressEl.value = val;
        if (text != null) genStatusEl.textContent = text;
      };
      
      // Force DOM repaint before starting heavy processing
      await new Promise(r => setTimeout(r, 50));

      const generatedAudio = [];
      const SAMPLE_RATE = 24000; // Final alignment rate
      let totalSamples = 0;

      for (let i = 0; i < parsedSegments.length; i++) {
        const seg = parsedSegments[i];
        setGenProgress((i / parsedSegments.length) * 100, i18n('aud.generatingSegment', { current: i + 1, total: parsedSegments.length }));
        if (phPhaseEl) phPhaseEl.textContent = `${i + 1} / ${parsedSegments.length}`;

        const voiceId = speakerVoiceMap[seg.speaker] || 'kk_af_heart';
        const emotionVal = speakerEmotionMap[seg.speaker] || 0.5;

        let audioData = null;

        if (voiceId.startsWith('kk_')) {
          if (!kokoroReady || !kokoroWorker) throw new Error(i18n('aud.errKokoroNotReady'));
          const v = voiceId.substring(3);
          const { waveform, sampleRate } = await executeWorkerTask(kokoroWorker, 'generate', { text: seg.text, voice: v }, phSubStatusEl, null);
          audioData = new Float32Array(waveform);
          if (sampleRate && sampleRate !== SAMPLE_RATE) {
            audioData = await resampleFloat32(audioData, sampleRate, SAMPLE_RATE);
          }
        } else if (voiceId.startsWith('cb_')) {
          if (!cbReady) throw new Error(i18n('aud.errCbNotReady'));
          const dbId = voiceId.substring(3);
          const customRec = customVoices.find(c => c.id === dbId);
          if (!customRec) throw new Error(i18n('aud.errCustomVoiceMissing'));
          
          // Decode the reference WAV stored in DB at 24000Hz for Chatterbox
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
          const refBlobUrl = await resolveMediaUrl(customRec.filename, currentAudioProjectDirHandle);
          const refResp = await fetch(refBlobUrl);
          const refAudioBuffer = await audioCtx.decodeAudioData(await refResp.arrayBuffer());
          revokeMediaUrl(refBlobUrl);
          const refFloat32 = refAudioBuffer.getChannelData(0);
          await audioCtx.close();
          
          setGenProgress(null, i18n('aud.generatingSegmentEngine', { current: i + 1, total: parsedSegments.length, engine: 'Chatterbox' }));
          
          const { waveform } = await executeWorkerTask(cbWorker, 'generate', {
              text: seg.text,
              refFloat32Array: refFloat32,
              speakerId: dbId,
              emotionVal: emotionVal
          }, phSubStatusEl, null);
          
          audioData = new Float32Array(waveform);

          // Resample if for some reason the output is not 24kHz
          const CB_RATE = 24000;
          if (CB_RATE !== SAMPLE_RATE) {
             audioData = await resampleFloat32(audioData, CB_RATE, SAMPLE_RATE);
          }
        } else if (voiceId.startsWith('pt_')) {
          if (!ptReady) throw new Error(i18n('aud.errPtNotReady'));
          const dbId = voiceId.substring(3);
          const customRec = customVoices.find(c => c.id === dbId);
          if (!customRec) throw new Error(i18n('aud.errCustomVoiceMissingPt'));

          // Decode reference audio at 24 kHz (same store as Chatterbox custom voices)
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
          const refBlobUrl = await resolveMediaUrl(customRec.filename, currentAudioProjectDirHandle);
          const refResp = await fetch(refBlobUrl);
          const refAudioBuffer = await audioCtx.decodeAudioData(await refResp.arrayBuffer());
          revokeMediaUrl(refBlobUrl);
          const refFloat32 = refAudioBuffer.getChannelData(0);
          await audioCtx.close();

          setGenProgress(null, i18n('aud.generatingSegmentEngine', { current: i + 1, total: parsedSegments.length, engine: 'Pocket TTS' }));

          const { waveform } = await executeWorkerTask(ptWorker, 'generate', {
            text: seg.text,
            refFloat32Array: refFloat32,
            speakerId: dbId,
            sampleRate: 24000,
          }, phSubStatusEl, null);

          audioData = new Float32Array(waveform);
        } else if (voiceId.startsWith('pp_')) {
          if (!ptReady) throw new Error(i18n('aud.errPtNotReady'));
          const presetId = voiceId.substring(3);

          setGenProgress(null, i18n('aud.loadingPreset', { preset: presetId }));
          const refFloat32 = await getPocketTtsPreset(presetId);

          setGenProgress(null, i18n('aud.generatingSegmentEngine', { current: i + 1, total: parsedSegments.length, engine: 'Pocket TTS preset' }));

          const { waveform } = await executeWorkerTask(ptWorker, 'generate', {
            text: seg.text,
            refFloat32Array: refFloat32,
            speakerId: `preset_${presetId}`,
            sampleRate: 24000,
          }, phSubStatusEl, null);

          audioData = new Float32Array(waveform);
        } else if (voiceId.startsWith('el_')) {
          if (!elReady) throw new Error(i18n('aud.errElNotReady'));
          const { getSettings } = await import('../utils/settings.js');
          const s = getSettings();
          const apiKey = s.elevenlabs?.apiKey;
          if (!apiKey) throw new Error(i18n('aud.errElNoKey'));
          const elVoiceId = voiceId.substring(3);
          setGenProgress(null, i18n('aud.generatingSegmentEngine', { current: i + 1, total: parsedSegments.length, engine: 'Eleven Labs' }));
          audioData = await generateElevenLabsAudio(seg.text, elVoiceId, apiKey);
        } else if (voiceId.startsWith('local_')) {
          if (!localReady) throw new Error(i18n('aud.errLocalNotReady'));
          const { getSettings } = await import('../utils/settings.js');
          const s = getSettings();
          const gatewayUrl = s.localTts?.url?.trim();
          if (!gatewayUrl) throw new Error(i18n('aud.errLocalNoUrl'));
          const localVoiceId = voiceId.substring(6);
          setGenProgress(null, i18n('aud.generatingSegmentEngine', { current: i + 1, total: parsedSegments.length, engine: 'Local TTS Gateway' }));
          audioData = await generateLocalTtsAudio(seg.text, localVoiceId, gatewayUrl);
        }

        if (audioData) {
          generatedAudio.push(audioData);
          totalSamples += audioData.length;
        }
      }

      setGenProgress(100, i18n('aud.compilingFinal'));

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
      
      setGenProgress(null, i18n('aud.encodingMp3'));
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

      // Rebuild the history list (replaces the placeholder) with the new
      // seekable waveform player for every item.
      audioHistory = currentAudioProject.history;
      await renderHistory();
      
      const enginesUsed = Array.from(new Set(parsedSegments.map(s => {
          const voice = speakerVoiceMap[s.speaker] || '';
          if (voice.startsWith('kk_')) return 'kokoro';
          if (voice.startsWith('cb_')) return 'chatterbox';
          if (voice.startsWith('pt_')) return 'pocket_tts';
          if (voice.startsWith('pp_')) return 'pocket_tts_preset';
          if (voice.startsWith('el_')) return 'elevenlabs';
          if (voice.startsWith('local_')) return 'local_gateway';
          return 'unknown';
      }))).join(',');

      trackEvent('speech_generation_completed', {
          component: 'voice-studio',
          properties: {
              duration: parseFloat(durationSecs) || 0.0,
              segment_count: parsedSegments.length,
              speaker_count: detectedSpeakers.length,
              engines: enginesUsed
          }
      });

      setGenProgress(null, i18n('aud.done'));
    } catch (e) {
      console.error(e);
      alert(i18n('aud.generationFailed', { error: e.message }));

      // Remove or mark the placeholder as failed
      if (historyId) {
        const placeholderEl = container.querySelector(`#aud-hist-${historyId}`);
        if (placeholderEl) {
          placeholderEl.className = "p-4 border border-[var(--ps-red)] rounded-lg bg-[var(--ps-bg)] flex flex-col gap-3 opacity-50";
          placeholderEl.innerHTML = `<div class="text-xs text-danger">${i18n('aud.failedToGenerate', { error: e.message })}</div>`;
        }
      }
    } finally {
      genProgressEl.classList.add('hidden');
      updateGenerateButtonState();
    }
  });

  async function generateElevenLabsAudio(text, voiceId, apiKey) {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Eleven Labs API error: ${response.status} - ${errText}`);
    }
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const float32 = audioBuffer.getChannelData(0);
    await audioCtx.close();
    return float32;
  }

  async function generateLocalTtsAudio(text, voiceId, gatewayUrl) {
    const cleanUrl = gatewayUrl.endsWith('/') ? gatewayUrl : gatewayUrl + '/';
    const response = await fetch(`${cleanUrl}tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        voice_id: voiceId,
        temperature: 0.7
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Local TTS Gateway error: ${response.status} - ${errText}`);
    }
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const float32 = audioBuffer.getChannelData(0);
    await audioCtx.close();
    return float32;
  }

  function initHistoryVisualizers() {
    cleanupVisualizers.forEach(cleanup => cleanup());
    cleanupVisualizers.length = 0;
    activeVisualizerAnims.forEach(id => cancelAnimationFrame(id));
    activeVisualizerAnims.length = 0;

    container.querySelectorAll('.aud-hist-card').forEach(card => {
      const cleanup = setupWaveformPlayer(card);
      if (cleanup) cleanupVisualizers.push(cleanup);
    });
  }

  // Compute downsampled peak amplitudes (one value per bucket) for waveform drawing.
  function computePeaks(channelData, buckets) {
    const peaks = new Float32Array(buckets);
    const blockSize = Math.max(1, Math.floor(channelData.length / buckets));
    for (let b = 0; b < buckets; b++) {
      const start = b * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(channelData[start + j] || 0);
        if (v > max) max = v;
      }
      peaks[b] = max;
    }
    return peaks;
  }

  // Static, seekable waveform player for an output-history card.
  function setupWaveformPlayer(card) {
    const audioEl = card.querySelector('audio');
    const canvas = card.querySelector('.aud-wave-canvas');
    const playBtn = card.querySelector('.aud-wave-play');
    const timeEl = card.querySelector('.aud-wave-time');
    if (!audioEl || !canvas || !playBtn) return null;

    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let peaks = null;
    let duration = 0;
    let rafId = null;
    let destroyed = false;

    const fmt = (s) => {
      if (!isFinite(s) || s < 0) s = 0;
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const mid = H / 2;
      const total = duration || audioEl.duration || 0;
      const progress = total > 0 ? (audioEl.currentTime / total) : 0;
      const playedX = progress * W;
      if (peaks) {
        const barW = Math.max(1, W / peaks.length);
        for (let i = 0; i < peaks.length; i++) {
          const x = i * barW;
          const bh = Math.max(1, peaks[i] * (H - 4));
          ctx.fillStyle = x <= playedX ? '#3b82f6' : 'rgba(148,163,184,0.5)';
          ctx.fillRect(x, mid - bh / 2, Math.max(1, barW - 1), bh);
        }
      } else {
        ctx.fillStyle = 'rgba(148,163,184,0.4)';
        ctx.fillRect(0, mid - 1, W, 2);
      }
      // Playhead
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(Math.min(W - 1, playedX), 0, 2, H);
      if (timeEl) timeEl.textContent = `${fmt(audioEl.currentTime)} / ${fmt(total)}`;
    };

    const loop = () => {
      if (destroyed) return;
      draw();
      if (!audioEl.paused && !audioEl.ended) {
        rafId = requestAnimationFrame(loop);
        activeVisualizerAnims.push(rafId);
      }
    };

    const seekFromEvent = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, (e.clientX ?? 0) - rect.left));
      const total = duration || audioEl.duration || 0;
      if (total > 0) { audioEl.currentTime = (x / rect.width) * total; draw(); }
    };

    let scrubbing = false;
    const onDown = (e) => { scrubbing = true; seekFromEvent(e); };
    const onMove = (e) => { if (scrubbing) seekFromEvent(e); };
    const onUp = () => { scrubbing = false; };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const onPlay = () => {
      playBtn.querySelector('.material-symbols-outlined').textContent = 'pause';
      loop();
    };
    const onPause = () => {
      playBtn.querySelector('.material-symbols-outlined').textContent = 'play_arrow';
      cancelAnimationFrame(rafId);
      draw();
    };
    const onPlayClick = () => { if (audioEl.paused) audioEl.play().catch(() => {}); else audioEl.pause(); };
    playBtn.addEventListener('click', onPlayClick);
    audioEl.addEventListener('play', onPlay);
    audioEl.addEventListener('pause', onPause);
    audioEl.addEventListener('ended', onPause);
    audioEl.addEventListener('loadedmetadata', () => { if (!duration) duration = audioEl.duration; draw(); });

    // Decode for peaks, then draw.
    (async () => {
      try {
        const resp = await fetch(audioEl.src);
        const ab = await resp.arrayBuffer();
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const buf = await ac.decodeAudioData(ab);
        if (destroyed) { ac.close().catch(() => {}); return; }
        duration = buf.duration;
        peaks = computePeaks(buf.getChannelData(0), 200);
        ac.close().catch(() => {});
      } catch (err) {
        // Fall back to a flat line + native duration.
      }
      draw();
    })();

    draw();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      playBtn.removeEventListener('click', onPlayClick);
      audioEl.removeEventListener('play', onPlay);
      audioEl.removeEventListener('pause', onPause);
      audioEl.removeEventListener('ended', onPause);
      try { audioEl.pause(); } catch (e) {}
    };
  }

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
      if (await showDialog({ title: i18n('aud.leavePageTitle'), message: i18n('aud.leavePageMsg') })) {
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
     
     if (previewAudio) {
       previewAudio.pause();
       previewAudio = null;
     }

     cleanupVisualizers.forEach(cleanup => cleanup());
     cleanupVisualizers.length = 0;
     activeVisualizerAnims.forEach(id => cancelAnimationFrame(id));
     activeVisualizerAnims.length = 0;

     window.removeEventListener('beforeunload', handleBeforeUnload);
     navItems.forEach(item => item.removeEventListener('click', handleNavClick, true));
  };
}
