import fs from 'fs';

let content = fs.readFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/tme.js', 'utf-8');

// 1. Update Imports
content = content.replace(
  "import { createEmptyTimeline, saveTimeline, getTimeline, getAllTimelines } from '../data/timeline-store.js';",
  "import { createEmptyTimeline, saveTimeline } from '../data/timeline-store.js';\nimport { createProject, openProject, importMediaToProject, resolveMediaUrl, revokeMediaUrl } from '../utils/project-io.js';"
);

// 2. Add currentProjectDirHandle state
content = content.replace(
  "let currentTimeline = null;",
  "let currentTimeline = null;\nlet currentProjectDirHandle = null;"
);

// 3. Update `export async function render(container)`
content = content.replace(
  /export async function render\(container\) \{[\s\S]*?(?=container\.innerHTML = `)/,
  `export async function render(container) {
  timelineView = null;
  injectTmeStyles();
  
  if (!currentTimeline || !currentProjectDirHandle) {
    container.innerHTML = \`
      <div class="screen" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 16px;">
        <h2>Timeline Editor</h2>
        <div style="display:flex; gap:16px;">
          <button class="btn-primary" id="tme-btn-startup-new">Create New Project</button>
          <button class="btn-secondary" id="tme-btn-startup-open">Open Project Folder</button>
        </div>
      </div>
    \`;
    
    container.querySelector('#tme-btn-startup-new').onclick = async () => {
       const dirHandle = await createProject(createEmptyTimeline());
       if (dirHandle) {
         currentProjectDirHandle = dirHandle;
         const fileHandle = await dirHandle.getFileHandle('project.json');
         const file = await fileHandle.getFile();
         currentTimeline = JSON.parse(await file.text());
         render(container);
       }
    };
    
    container.querySelector('#tme-btn-startup-open').onclick = async () => {
       try {
         const { dirHandle, projectData } = await openProject();
         currentProjectDirHandle = dirHandle;
         currentTimeline = projectData;
         
         // Re-hydrate media handles
         if (currentTimeline.mediaPool) {
            for (const item of currentTimeline.mediaPool) {
               try {
                  if (!item.filename) continue;
                  const parts = item.filename.split('/');
                  let h = currentProjectDirHandle;
                  for (let i = 0; i < parts.length - 1; i++) {
                     h = await h.getDirectoryHandle(parts[i]);
                  }
                  item.fileHandle = await h.getFileHandle(parts[parts.length - 1]);
               } catch(e) {
                  console.error('Missing media:', item.filename);
               }
            }
         }
         
         render(container);
       } catch (e) {
         if (e && e.message && !e.message.includes('AbortError')) alert(e.message);
       }
    };
    return;
  }

  // Fallbacks for older schemas
  if (!currentTimeline.videoTrack) currentTimeline.videoTrack = [];
  if (!currentTimeline.effectTracks) currentTimeline.effectTracks = [{ id: 'fx1', name: 'FX 1', blocks: [] }];
  if (!currentTimeline.audioTracks) currentTimeline.audioTracks = [{ id: 'a1', name: 'A1', blocks: [] }];

  `
);

// 4. Update top bar #tme-btn-new
content = content.replace(
  /if \(btnNew\) \{[\s\S]*?\}\n  \}/,
  `if (btnNew) {
    btnNew.addEventListener('click', async () => {
      if (confirm('Create a new project? Any unsaved changes will be lost.')) {
        if (isPlaying) {
          isPlaying = false;
          btnPlay.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
          if (animFrameId) cancelAnimationFrame(animFrameId);
          if (typeof syncAudioPlayback === 'function') syncAudioPlayback();
        }
        
        const dirHandle = await createProject(createEmptyTimeline());
        if (dirHandle) {
          currentProjectDirHandle = dirHandle;
          const fileHandle = await dirHandle.getFileHandle('project.json');
          const file = await fileHandle.getFile();
          currentTimeline = JSON.parse(await file.text());
          render(container);
        }
      }
    });
  }
  
  if (btnOpen) {
    btnOpen.addEventListener('click', async () => {
       try {
         if (isPlaying) {
           isPlaying = false;
           btnPlay.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
           if (animFrameId) cancelAnimationFrame(animFrameId);
           if (typeof syncAudioPlayback === 'function') syncAudioPlayback();
         }

         const { dirHandle, projectData } = await openProject();
         currentProjectDirHandle = dirHandle;
         currentTimeline = projectData;
         
         if (currentTimeline.mediaPool) {
            for (const item of currentTimeline.mediaPool) {
               try {
                  if (!item.filename) continue;
                  const parts = item.filename.split('/');
                  let h = currentProjectDirHandle;
                  for (let i = 0; i < parts.length - 1; i++) {
                     h = await h.getDirectoryHandle(parts[i]);
                  }
                  item.fileHandle = await h.getFileHandle(parts[parts.length - 1]);
               } catch(e) {
                  console.error('Missing media:', item.filename);
               }
            }
         }
         
         render(container);
       } catch (e) {
         if (e.message && !e.message.includes('AbortError')) {
             alert(e.message);
         }
       }
    });
  }`
);

// 5. Update saveTimeline calls (simple replacement)
content = content.replaceAll("saveTimeline(currentTimeline)", "saveTimeline(currentTimeline, currentProjectDirHandle)");

// 6. Fix Import media to project
content = content.replace(
  /currentTimeline\.mediaPool\.push\(\{\n\s*id: generateId\(\),\n\s*type,\n\s*name: handle\.name,\n\s*fileHandle: handle,\n\s*thumbnail,\n\s*meta\n\s*\}\);/g,
  `const filename = await importMediaToProject(handle, currentProjectDirHandle);
        currentTimeline.mediaPool.push({
          id: generateId(),
          type,
          name: handle.name,
          filename,
          fileHandle: handle,
          thumbnail,
          meta
        });`
);

content = content.replace(
  /currentTimeline\.mediaPool\.push\(\{\n\s*id: generateId\(\),\n\s*type: type,\n\s*name: handle\.name,\n\s*fileHandle: handle,\n\s*thumbnail: thumbnail,\n\s*meta: meta\n\s*\}\);/g,
  `const filename = await importMediaToProject(handle, currentProjectDirHandle);
          currentTimeline.mediaPool.push({
            id: generateId(),
            type,
            name: handle.name,
            filename,
            fileHandle: handle,
            thumbnail,
            meta
          });`
);

// 7. Fix Export (stitcher output save to NLE directory)
// At line ~2567: const fileHandle = await window.showSaveFilePicker({ ...
content = content.replace(
  /const fileHandle = await window\.showSaveFilePicker\(\{[\s\S]*?\}\);/,
  `// Write output directly to project directory
        const suggestedName = (currentTimeline.name || 'output').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.mp4';
        const fileHandle = await currentProjectDirHandle.getFileHandle(suggestedName, { create: true });`
);

fs.writeFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/tme.js', content, 'utf-8');
console.log('Success refactoring tme.js');
