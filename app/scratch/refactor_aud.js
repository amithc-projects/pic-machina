import fs from 'fs';

let content = fs.readFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/aud.js', 'utf-8');

// 1. Update Imports
content = content.replace(
  "import { getCustomVoices, saveCustomVoice, deleteCustomVoice } from '../data/voices.js';",
  "import { createProject, openProject, saveProject, resolveMediaUrl, revokeMediaUrl } from '../utils/project-io.js';"
);

// 2. Add Project State variables and Startup View
content = content.replace(
  "let customVoices = [];",
  `let currentAudioProjectDirHandle = null;
  let currentAudioProject = null;
  let customVoices = []; // Kept for reference but populated from currentAudioProject.voices`
);

// Update `export async function render(container, hash) {` to inject startup UI.
content = content.replace(
  /export async function render\(container, hash\) \{/,
  `export async function render(container, hash) {
  if (!currentAudioProject || !currentAudioProjectDirHandle) {
    container.innerHTML = \`
      <div class="screen" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 16px;">
        <h2>Speech Studio</h2>
        <div style="display:flex; gap:16px;">
          <button class="btn-primary" id="aud-btn-startup-new">Create New Audio Project</button>
          <button class="btn-secondary" id="aud-btn-startup-open">Open Audio Project</button>
        </div>
      </div>
    \`;
    
    container.querySelector('#aud-btn-startup-new').onclick = async () => {
       const initialData = {
         title: 'Untitled Audio Project',
         script: '',
         voices: [],
         history: []
       };
       const dirHandle = await createProject(initialData);
       if (dirHandle) {
         currentAudioProjectDirHandle = dirHandle;
         currentAudioProject = initialData;
         render(container, hash);
       }
    };
    
    container.querySelector('#aud-btn-startup-open').onclick = async () => {
       try {
         const { dirHandle, projectData } = await openProject();
         currentAudioProjectDirHandle = dirHandle;
         currentAudioProject = projectData;
         
         // Fallbacks
         if (!currentAudioProject.voices) currentAudioProject.voices = [];
         if (!currentAudioProject.history) currentAudioProject.history = [];
         if (!currentAudioProject.script) currentAudioProject.script = '';
         
         render(container, hash);
       } catch (e) {
         if (e && e.message && !e.message.includes('AbortError')) alert(e.message);
       }
    };
    return;
  }
`
);

// 3. Hydrate state to UI on load
content = content.replace(
  /const tabVoicecraft = container\.querySelector\('#aud-tab-voicecraft'\);/,
  `const tabVoicecraft = container.querySelector('#aud-tab-voicecraft');
  
  // Set initial project values
  const inputTitleElDef = container.querySelector('#aud-input-title');
  if (inputTitleElDef && currentAudioProject.title) inputTitleElDef.value = currentAudioProject.title;
  const inputElDef = container.querySelector('#aud-input');
  if (inputElDef && currentAudioProject.script) inputElDef.value = currentAudioProject.script;
  
  if (currentAudioProject.voices) customVoices = currentAudioProject.voices;
  if (currentAudioProject.history) audioHistory = currentAudioProject.history;
  
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
  }`
);

// 4. Fix loadCustomVoices / getCustomVoices
content = content.replace(
  /async function loadCustomVoices\(\) \{[\s\S]*?renderCustomVoices\(\);\n  \}/,
  `async function loadCustomVoices() {
    customVoices = currentAudioProject.voices || [];
    await renderCustomVoices();
  }`
);

content = content.replace(
  /if \(customVoices\.length === 0\) customVoices = await getCustomVoices\(\);/g,
  `if (customVoices.length === 0) customVoices = currentAudioProject.voices || [];`
);

// 5. Fix renderCustomVoices to use resolveMediaUrl asynchronously
content = content.replace(
  /function renderCustomVoices\(\) \{[\s\S]*?join\(''\);\n\n    customVoicesGrid\.querySelectorAll/m,
  `async function renderCustomVoices() {
    let html = '';
    for (const v of customVoices) {
      const blobUrl = await resolveMediaUrl(v.filename, currentAudioProjectDirHandle);
      html += \`
      <div class="flex flex-col bg-[var(--ps-bg)] border border-[var(--ps-border)] rounded p-4">
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[var(--ps-blue)]"></div>
            <span class="font-bold text-sm">\${v.name}</span>
          </div>
          <button class="material-symbols-outlined text-muted hover:text-danger cursor-pointer text-sm" data-delete-id="\${v.id}">close</button>
        </div>
        <div class="text-xs text-muted mb-2">Voice Sample</div>
        <audio controls class="w-full h-8 outline-none rounded" src="\${blobUrl}"></audio>
      </div>\`;
    }
    customVoicesGrid.innerHTML = html;

    customVoicesGrid.querySelectorAll`
);

// 6. Delete Custom Voice
content = content.replace(
  /await deleteCustomVoice\(id\);/g,
  `currentAudioProject.voices = currentAudioProject.voices.filter(v => v.id !== id);
          await saveProject(currentAudioProjectDirHandle, currentAudioProject);`
);

// 7. Add Voice file copying
content = content.replace(
  /await saveCustomVoice\(generateId\(\), name, wavBuffer\);/,
  `const newId = generateId();
        const voicesDirHandle = await currentAudioProjectDirHandle.getDirectoryHandle('voices', { create: true });
        const cleanName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const targetFileName = \`\${cleanName}_\${newId}.wav\`;
        const targetFileHandle = await voicesDirHandle.getFileHandle(targetFileName, { create: true });
        const writable = await targetFileHandle.createWritable();
        await writable.write(wavBuffer);
        await writable.close();
        
        currentAudioProject.voices.push({ id: newId, name, filename: 'voices/' + targetFileName });
        await saveProject(currentAudioProjectDirHandle, currentAudioProject);`
);

// 8. Fix refAudioBuffer decode in Generation loop
// For Chatterbox
content = content.replace(
  /const refAudioBuffer = await audioCtx\.decodeAudioData\(customRec\.bytes\.slice\(0\)\); \/\/ clone buffer/g,
  `const refBlobUrl = await resolveMediaUrl(customRec.filename, currentAudioProjectDirHandle);
          const refResp = await fetch(refBlobUrl);
          const refAudioBuffer = await audioCtx.decodeAudioData(await refResp.arrayBuffer());
          revokeMediaUrl(refBlobUrl);`
);

// For Pocket TTS
content = content.replace(
  /const refAudioBuffer = await audioCtx\.decodeAudioData\(customRec\.bytes\.slice\(0\)\);/g,
  `const refBlobUrl = await resolveMediaUrl(customRec.filename, currentAudioProjectDirHandle);
          const refResp = await fetch(refBlobUrl);
          const refAudioBuffer = await audioCtx.decodeAudioData(await refResp.arrayBuffer());
          revokeMediaUrl(refBlobUrl);`
);

// 9. Fix Final Audio Output Saving
// Save to outputs/ folder
content = content.replace(
  /const wavBlob = audioBufferToWav\(combinedAudio, SAMPLE_RATE\);\n\s*const wavUrl = URL\.createObjectURL\(wavBlob\);\n\s*\/\/ Convert to MP3\n\s*genStatusEl\.textContent = 'Encoding MP3\.\.\.';\n\s*const mp3Blob = await encodeMp3\(combinedAudio, SAMPLE_RATE\);\n\s*const mp3Url = URL\.createObjectURL\(mp3Blob\);/g,
  `const wavBlob = audioBufferToWav(combinedAudio, SAMPLE_RATE);
      const outputsDirHandle = await currentAudioProjectDirHandle.getDirectoryHandle('outputs', { create: true });
      const cleanTitle = inputTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const baseName = \`\${cleanTitle}_\${historyId}\`;
      
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
      await saveProject(currentAudioProjectDirHandle, currentAudioProject);`
);

// 10. Fix history rendering on load
// Find the initial history load... ah, it currently doesn't render history on load.
content = content.replace(
  /let audioHistory = \[\];/,
  `let audioHistory = [];
  
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
         
         html += \`
           <div class="p-4 border border-[var(--ps-border)] rounded-lg bg-[var(--ps-bg)] flex flex-col gap-3" id="aud-hist-\${hist.id}">
             <div class="flex justify-between items-center">
               <span class="font-bold text-[var(--ps-text)]">\${hist.title}</span>
               <span class="text-xs text-muted">\${hist.durationSecs}s • \${hist.speakerCount} speaker(s)</span>
             </div>
             \${wavUrl ? \`<audio controls class="w-full h-10 outline-none" src="\${wavUrl}"></audio>\` : '<div class="text-xs text-danger">Missing file</div>'}
             <div class="flex gap-2 mt-1">
               \${wavUrl ? \`<a href="\${wavUrl}" download="\${hist.title}.wav" class="btn btn-secondary flex-1 justify-center text-center text-xs">Download .wav</a>\` : ''}
               \${mp3Url ? \`<a href="\${mp3Url}" download="\${hist.title}.mp3" class="btn btn-secondary flex-1 justify-center text-center text-xs">Download .mp3</a>\` : ''}
             </div>
           </div>
         \`;
     }
     if(historyListEl) historyListEl.innerHTML = html;
  }`
);

// Wait, we need to call renderHistory() when the UI loads.
content = content.replace(
  /if \(currentAudioProject\.history\) audioHistory = currentAudioProject\.history;/,
  `if (currentAudioProject.history) audioHistory = currentAudioProject.history;
  renderHistory();`
);

fs.writeFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/aud.js', content, 'utf-8');
console.log('Success refactoring aud.js');
