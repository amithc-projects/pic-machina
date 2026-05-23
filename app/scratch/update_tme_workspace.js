import fs from 'fs';

let tme = fs.readFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/tme.js', 'utf-8');

tme = tme.replace(
  "import { createProject, openProject, importMediaToProject, resolveMediaUrl, revokeMediaUrl, addRecentProject, getRecentProjects, openProjectFromHandle } from '../utils/project-io.js';",
  "import { createProject, openProject, importMediaToProject, resolveMediaUrl, revokeMediaUrl, addRecentProject, getRecentProjects, openProjectFromHandle, getWorkspaceRoot, setWorkspaceRoot, scanWorkspaceProjects, createProjectInWorkspace, verifyPermission } from '../utils/project-io.js';"
);

const newStartupScreen = `
  if (!currentTimeline || !currentProjectDirHandle) {
    container.innerHTML = \`
      <div class="screen" style="display:flex; flex-direction:column; align-items:center; padding: 48px; gap: 24px; overflow-y:auto; height:100%;">
        <div style="text-align:center;">
           <h2 style="font-size:24px; margin-bottom:8px;">Timeline Editor</h2>
           <p class="text-muted" style="font-size:14px;">Select or create a project to get started.</p>
        </div>
        <div id="tme-workspace-root" style="width:100%; max-width:800px; display:flex; flex-direction:column; gap:16px;"></div>
      </div>
    \`;

    const renderWorkspace = async () => {
       const rootEl = container.querySelector('#tme-workspace-root');
       let workspaceHandle = await getWorkspaceRoot();
       
       if (!workspaceHandle) {
          rootEl.innerHTML = \`
            <div style="display:flex; flex-direction:column; align-items:center; padding:48px; border:2px dashed var(--ps-border); border-radius:12px; background:var(--ps-surface);">
               <span class="material-symbols-outlined text-muted" style="font-size:48px; margin-bottom:16px;">folder_open</span>
               <h3 style="margin-bottom:8px;">No Workspace Selected</h3>
               <p class="text-muted" style="margin-bottom:24px; text-align:center;">A workspace is a local folder on your computer where all your video projects will be stored.</p>
               <button class="btn-primary" id="tme-btn-set-workspace">Select Workspace Folder</button>
            </div>
          \`;
          rootEl.querySelector('#tme-btn-set-workspace').onclick = async () => {
             try {
                workspaceHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                await setWorkspaceRoot(workspaceHandle);
                renderWorkspace();
             } catch(e) { if(e.name !== 'AbortError') alert(e.message); }
          };
          return;
       }
       
       if (!(await verifyPermission(workspaceHandle, true))) {
          rootEl.innerHTML = \`<div style="text-align:center; padding:24px;"><p class="text-[var(--ps-orange)] mb-4">Permission required to access Workspace.</p><button class="btn-primary" id="tme-btn-grant">Grant Permission</button></div>\`;
          rootEl.querySelector('#tme-btn-grant').onclick = async () => {
             if (await verifyPermission(workspaceHandle, true)) renderWorkspace();
          };
          return;
       }
       
       rootEl.innerHTML = \`<div style="text-align:center; padding:24px;"><span class="material-symbols-outlined spin">autorenew</span> Scanning workspace...</div>\`;
       const projects = await scanWorkspaceProjects(workspaceHandle);
       
       // Sort by recent? They don't have lastOpened natively unless we read it from db, but let's just sort by title
       projects.sort((a,b) => (b.projectData.title || b.projectData.name || '').localeCompare(a.projectData.title || a.projectData.name || ''));
       
       let gridHtml = \`<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
         <div class="text-sm text-muted flex flex-items-center gap-2"><span class="material-symbols-outlined text-[16px]">snippet_folder</span> Workspace: <b>\${workspaceHandle.name}</b></div>
         <button class="btn-ghost btn-sm" id="tme-btn-change-workspace" title="Change Workspace"><span class="material-symbols-outlined text-[16px]">edit</span></button>
       </div>\`;
       
       gridHtml += \`<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:16px;">\`;
       
       // New Project Card
       gridHtml += \`
         <button id="tme-btn-new-project" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; background:rgba(255,255,255,0.02); border:2px dashed var(--ps-border); border-radius:12px; cursor:pointer; color:var(--ps-text-muted); transition:0.2s;" onmouseover="this.style.color='var(--ps-blue)'; this.style.borderColor='var(--ps-blue)';" onmouseout="this.style.color='var(--ps-text-muted)'; this.style.borderColor='var(--ps-border)';">
           <span class="material-symbols-outlined" style="font-size:32px; margin-bottom:8px;">add_circle</span>
           <span style="font-size:14px; font-weight:600;">New Project</span>
         </button>
       \`;
       
       // Project Cards
       projects.forEach((p, i) => {
         const title = p.projectData.title || p.projectData.name || 'Untitled';
         const thumb = p.projectData.mediaPool && p.projectData.mediaPool.length > 0 ? \`<div style="width:100%; height:120px; background:#111; border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;"><span class="material-symbols-outlined text-muted" style="font-size:32px;">movie</span></div>\` : \`<div style="width:100%; height:120px; background:var(--ps-surface); border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;"><span class="material-symbols-outlined text-muted text-[32px]">folder</span></div>\`;
         
         gridHtml += \`
           <div class="tme-project-card" data-index="\${i}" style="display:flex; flex-direction:column; padding:12px; background:var(--ps-surface); border:1px solid var(--ps-border); border-radius:12px; cursor:pointer; transition:0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='var(--ps-blue)';" onmouseout="this.style.background='var(--ps-surface)'; this.style.borderColor='var(--ps-border)';">
              \${thumb}
              <span style="font-size:14px; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">\${title}</span>
              <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px;">\${p.projectData.mediaPool?.length || 0} assets</span>
           </div>
         \`;
       });
       
       gridHtml += \`</div>\`;
       rootEl.innerHTML = gridHtml;
       
       rootEl.querySelector('#tme-btn-change-workspace').onclick = async () => {
          try {
             const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
             await setWorkspaceRoot(handle);
             renderWorkspace();
          } catch(e) {}
       };
       
       rootEl.querySelector('#tme-btn-new-project').onclick = async () => {
          const name = prompt('Project Name:');
          if (!name) return;
          try {
             const dirHandle = await createProjectInWorkspace(workspaceHandle, name, createEmptyTimeline());
             const fileHandle = await dirHandle.getFileHandle('project.json');
             const file = await fileHandle.getFile();
             currentTimeline = JSON.parse(await file.text());
             currentProjectDirHandle = dirHandle;
             render(container);
          } catch(e) { alert(e.message); }
       };
       
       rootEl.querySelectorAll('.tme-project-card').forEach(card => {
          card.onclick = async () => {
             const p = projects[card.dataset.index];
             try {
               const projectData = await openProjectFromHandle(p.dirHandle);
               currentProjectDirHandle = p.dirHandle;
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
               render(container);
             } catch(e) { alert('Could not open project.\\nError: ' + e.message); }
          };
       });
    };
    
    renderWorkspace();
    return;
  }
`;

tme = tme.replace(
  /if \(!currentTimeline \|\| !currentProjectDirHandle\) \{[\s\S]*?\n  \}\n\n  \/\/ Fallbacks for older schemas/,
  `${newStartupScreen}\n  // Fallbacks for older schemas`
);

fs.writeFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/tme.js', tme, 'utf-8');
console.log('tme.js startup screen updated');
