import fs from 'fs';

// --- tme.js Updates ---
let tme = fs.readFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/tme.js', 'utf-8');

// 1. Imports
tme = tme.replace(
  "import { createProject, openProject, importMediaToProject, resolveMediaUrl, revokeMediaUrl } from '../utils/project-io.js';",
  "import { createProject, openProject, importMediaToProject, resolveMediaUrl, revokeMediaUrl, addRecentProject, getRecentProjects, openProjectFromHandle } from '../utils/project-io.js';"
);

// 2. Startup UI
tme = tme.replace(
  /<button class="btn-primary" id="tme-btn-startup-new">Create New Project<\/button>\n\s*<button class="btn-secondary" id="tme-btn-startup-open">Open Project Folder<\/button>/,
  `<button class="btn-primary" id="tme-btn-startup-new">Create New Project</button>
          <button class="btn-secondary" id="tme-btn-startup-open">Open Project Folder</button>
        </div>
        <div id="tme-recent-projects" class="mt-8 flex flex-col gap-2 w-full max-w-md"></div>`
);

// 3. Render Recent Projects
const tmeStartupLogic = `
    const recentProjectsEl = container.querySelector('#tme-recent-projects');
    if (recentProjectsEl) {
      getRecentProjects('video').then(recent => {
        if (recent.length > 0) {
          recentProjectsEl.innerHTML = '<h3 class="text-sm font-bold text-muted mb-2 uppercase tracking-widest text-center">Recent Projects</h3>' + 
            recent.map((p, i) => \`
              <button class="tme-btn-recent btn-ghost w-full justify-start text-left p-3 border border-[var(--ps-border)]" data-index="\${i}">
                <span class="material-symbols-outlined mr-3">folder</span>
                <div class="flex flex-col">
                  <span class="font-bold text-sm text-[var(--ps-text)]">\${p.title}</span>
                  <span class="text-xs text-muted">\${new Date(p.lastOpened).toLocaleString()}</span>
                </div>
              </button>
            \`).join('');
            
          recentProjectsEl.querySelectorAll('.tme-btn-recent').forEach(btn => {
            btn.onclick = async () => {
               const p = recent[btn.dataset.index];
               try {
                 const projectData = await openProjectFromHandle(p.handle);
                 currentProjectDirHandle = p.handle;
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
                       } catch(e) { console.error('Missing media:', item.filename); }
                    }
                 }
                 
                 await addRecentProject('video', p.handle, currentTimeline);
                 render(container);
               } catch (e) {
                 alert('Could not open recent project. You may need to select the folder manually again.\\nError: ' + e.message);
               }
            };
          });
        }
      });
    }`;

tme = tme.replace(
  /container\.querySelector\('#tme-btn-startup-new'\)\.onclick = async \(\) => \{/,
  `${tmeStartupLogic}\n\n    container.querySelector('#tme-btn-startup-new').onclick = async () => {`
);

// 4. Update createProject and openProject to save recent
tme = tme.replace(
  /currentTimeline = JSON\.parse\(await file\.text\(\)\);\n\s*render\(container\);/,
  `currentTimeline = JSON.parse(await file.text());\n         await addRecentProject('video', dirHandle, currentTimeline);\n         render(container);`
);

tme = tme.replace(
  /currentTimeline = projectData;[\s\S]*?\/\/ Re-hydrate/,
  `currentTimeline = projectData;
         await addRecentProject('video', dirHandle, currentTimeline);
         // Re-hydrate`
);

// Do the same for the top bar btnNew and btnOpen
tme = tme.replace(
  /currentTimeline = JSON\.parse\(await file\.text\(\)\);\n\s*render\(container\);\n\s*\}\n\s*\}\n\s*\}\);/,
  `currentTimeline = JSON.parse(await file.text());
          await addRecentProject('video', dirHandle, currentTimeline);
          render(container);
        }
      }
    });`
);
tme = tme.replace(
  /currentTimeline = projectData;\n\s*if \(currentTimeline\.mediaPool\)/,
  `currentTimeline = projectData;
         await addRecentProject('video', dirHandle, currentTimeline);
         if (currentTimeline.mediaPool)`
);

// 5. Add Import Folder Button HTML
tme = tme.replace(
  /<button class="btn-ghost" id="tme-btn-add-media" title="Import Media" style="padding: 4px;">/,
  `<button class="btn-ghost" id="tme-btn-import-folder" title="Import Folder" style="padding: 4px;"><span class="material-symbols-outlined" style="font-size: 20px;">snippet_folder</span></button>
                <button class="btn-ghost" id="tme-btn-add-media" title="Import Media Files" style="padding: 4px;">`
);

// 6. Add Import Folder Logic
tme = tme.replace(
  /const btnAddMedia = container\.querySelector\('#tme-btn-add-media'\);/,
  `const btnAddMedia = container.querySelector('#tme-btn-add-media');
  const btnImportFolder = container.querySelector('#tme-btn-import-folder');`
);

const importFolderLogic = `
  if (btnImportFolder) {
    btnImportFolder.addEventListener('click', async () => {
      try {
        const dirHandle = await window.showDirectoryPicker();
        
        async function scanDirectory(handle) {
           let files = [];
           for await (const entry of handle.values()) {
              if (entry.kind === 'file') {
                 if (entry.name.match(/\\.(png|jpg|jpeg|webp|mp4|webm)$/i)) {
                    files.push(entry);
                 }
              } else if (entry.kind === 'directory') {
                 files = files.concat(await scanDirectory(entry));
              }
           }
           return files;
        }
        
        const handles = await scanDirectory(dirHandle);
        for (const handle of handles) {
           const file = await handle.getFile();
           const type = file.type.startsWith('video') ? 'video' : 'image';
           let thumbnail = null;
           let meta = await extractMediaMeta(file, type);
           
           if (type === 'image') { thumbnail = URL.createObjectURL(file); }
           else if (type === 'video') { thumbnail = await extractVideoThumbnail(file); }

           const filename = await importMediaToProject(handle, currentProjectDirHandle);
           currentTimeline.mediaPool.push({
             id: generateId(),
             type,
             name: handle.name,
             filename,
             fileHandle: handle,
             thumbnail,
             meta
           });
        }
        await saveTimeline(currentTimeline, currentProjectDirHandle);
        renderMediaPool();
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Folder import error:', err);
      }
    });
  }
`;

tme = tme.replace(
  /if \(btnAddMedia\) \{/,
  `${importFolderLogic}\n  if (btnAddMedia) {`
);

fs.writeFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/tme.js', tme, 'utf-8');

// --- aud.js Updates ---
let aud = fs.readFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/aud.js', 'utf-8');

aud = aud.replace(
  "import { createProject, openProject, saveProject, resolveMediaUrl, revokeMediaUrl } from '../utils/project-io.js';",
  "import { createProject, openProject, saveProject, resolveMediaUrl, revokeMediaUrl, addRecentProject, getRecentProjects, openProjectFromHandle } from '../utils/project-io.js';"
);

aud = aud.replace(
  /<button class="btn-primary" id="aud-btn-startup-new">Create New Audio Project<\/button>\n\s*<button class="btn-secondary" id="aud-btn-startup-open">Open Audio Project<\/button>/,
  `<button class="btn-primary" id="aud-btn-startup-new">Create New Audio Project</button>
          <button class="btn-secondary" id="aud-btn-startup-open">Open Audio Project</button>
        </div>
        <div id="aud-recent-projects" class="mt-8 flex flex-col gap-2 w-full max-w-md"></div>`
);

const audStartupLogic = `
    const recentProjectsEl = container.querySelector('#aud-recent-projects');
    if (recentProjectsEl) {
      getRecentProjects('audio').then(recent => {
        if (recent.length > 0) {
          recentProjectsEl.innerHTML = '<h3 class="text-sm font-bold text-muted mb-2 uppercase tracking-widest text-center">Recent Projects</h3>' + 
            recent.map((p, i) => \`
              <button class="aud-btn-recent btn-ghost w-full justify-start text-left p-3 border border-[var(--ps-border)]" data-index="\${i}">
                <span class="material-symbols-outlined mr-3">folder</span>
                <div class="flex flex-col">
                  <span class="font-bold text-sm text-[var(--ps-text)]">\${p.title}</span>
                  <span class="text-xs text-muted">\${new Date(p.lastOpened).toLocaleString()}</span>
                </div>
              </button>
            \`).join('');
            
          recentProjectsEl.querySelectorAll('.aud-btn-recent').forEach(btn => {
            btn.onclick = async () => {
               const p = recent[btn.dataset.index];
               try {
                 const projectData = await openProjectFromHandle(p.handle);
                 currentAudioProjectDirHandle = p.handle;
                 currentAudioProject = projectData;
                 
                 if (!currentAudioProject.voices) currentAudioProject.voices = [];
                 if (!currentAudioProject.history) currentAudioProject.history = [];
                 if (!currentAudioProject.script) currentAudioProject.script = '';
                 
                 await addRecentProject('audio', p.handle, currentAudioProject);
                 render(container, hash);
               } catch (e) {
                 alert('Could not open recent project. You may need to select the folder manually again.\\nError: ' + e.message);
               }
            };
          });
        }
      });
    }`;

aud = aud.replace(
  /container\.querySelector\('#aud-btn-startup-new'\)\.onclick = async \(\) => \{/,
  `${audStartupLogic}\n\n    container.querySelector('#aud-btn-startup-new').onclick = async () => {`
);

aud = aud.replace(
  /currentAudioProject = initialData;\n\s*render\(container, hash\);/,
  `currentAudioProject = initialData;\n         await addRecentProject('audio', dirHandle, currentAudioProject);\n         render(container, hash);`
);

aud = aud.replace(
  /currentAudioProject = projectData;\n\s*\/\/ Fallbacks/,
  `currentAudioProject = projectData;\n         await addRecentProject('audio', dirHandle, currentAudioProject);\n         // Fallbacks`
);

fs.writeFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/aud.js', aud, 'utf-8');

console.log('done updating tme and aud');
