import { createEmptyTimeline, saveTimeline } from '../data/timeline-store.js';
import { createProject, openProject, importMediaToProject, resolveMediaUrl, revokeMediaUrl, addRecentProject, getRecentProjects, openProjectFromHandle, getWorkspaceRoot, setWorkspaceRoot, scanWorkspaceProjects, createProjectInWorkspace, verifyPermission } from '../utils/project-io.js';
import { registry } from '../engine/index.js';
import { applyBehavior, getAllBehaviors } from '../engine/behaviors.js';
import { renderParamField, collectParams, bindParamFieldEvents } from '../utils/param-fields.js';
import { FsaBrowser } from '../components/fsa-browser.js';
import { WebGLCompositor, TRANSITIONS } from '../engine/stitcher.js';
import { formatBytes } from '../utils/misc.js';
import { TimelineView } from '../components/timeline-view.js';
import JSZip from 'jszip';

let currentTimeline = null;
let currentProjectDirHandle = null;
let timelineView = null;
let mediaPoolSelection = new Set();
let lastSelectedPoolIndex = -1;
let selectedItemId = null;
let selectedItemType = null;
let isMagneticSnapping = true;

// Ensure unique ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

let _tmeStyles = false;
function injectTmeStyles() {
  if (_tmeStyles) return;
  _tmeStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .ned-fields { display:flex; flex-direction:column; gap:10px; }
    .ned-field { display:flex; flex-direction:column; gap:4px; }
    .ned-field-label { display:flex; align-items:center; font-size:12px; color:var(--ps-text-muted); font-weight:500; }
    .ned-color-row { display:flex; align-items:center; gap:6px; }
    .ned-color-input { width:36px; height:32px; padding:2px; border:1px solid var(--ps-border); border-radius:6px; background:var(--ps-bg-app); cursor:pointer; }
    .ned-toggle { display:flex; align-items:center; cursor:pointer; width:fit-content; }
    .ned-toggle input { display:none; }
    .ned-toggle-track {
      width:36px; height:20px; border-radius:10px; background:var(--ps-bg-app);
      border:1px solid var(--ps-border); position:relative; transition:background 150ms, border-color 150ms;
    }
    .ned-toggle-track::after {
      content:''; position:absolute; top:2px; left:2px; width:14px; height:14px;
      border-radius:50%; background:#fff; transition:transform 150ms;
    }
    .ned-toggle input:checked + .ned-toggle-track { background:var(--ps-blue); border-color:var(--ps-blue); }
    .ned-toggle input:checked + .ned-toggle-track::after { transform:translateX(16px); }
  `;
  document.head.appendChild(s);
}

  function showDialog(options) {
    return new Promise((resolve) => {
      const { title, message, type = 'confirm', defaultValue = '' } = options;
      const dialog = document.createElement('div');
      dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;color:#fff;backdrop-filter:blur(4px);';
      
      let inputHtml = '';
      if (type === 'prompt') {
        inputHtml = `<input type="text" id="tme-dialog-input" class="ic-input" value="${defaultValue}" style="width:100%;margin-bottom:16px;">`;
      }
      
      dialog.innerHTML = `
        <div style="background:var(--ps-bg-surface);border:1px solid var(--ps-border);border-radius:8px;padding:20px;width:320px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          <h3 style="margin-top:0;margin-bottom:8px;color:var(--ps-text);font-size:16px;">${title}</h3>
          <p style="margin-bottom:16px;color:var(--ps-text-muted);font-size:13px;line-height:1.4;">${message}</p>
          ${inputHtml}
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button id="tme-btn-dialog-cancel" class="btn-ghost">Cancel</button>
            <button id="tme-btn-dialog-confirm" class="${type === 'confirm' ? 'btn-danger' : 'btn-primary'}">OK</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      const btnCancel = dialog.querySelector('#tme-btn-dialog-cancel');
      const btnConfirm = dialog.querySelector('#tme-btn-dialog-confirm');
      const inputEl = dialog.querySelector('#tme-dialog-input');
      
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

export async function render(container) {
  timelineView = null;
  injectTmeStyles();
  
  
  if (!currentTimeline || !currentProjectDirHandle) {
    container.innerHTML = `
      <div class="screen" style="display:flex; flex-direction:column; align-items:center; padding: 48px; gap: 24px; overflow-y:auto; height:100%;">
        <div style="text-align:center;">
           <h2 style="font-size:24px; margin-bottom:8px;">Timeline Editor</h2>
           <p class="text-muted" style="font-size:14px;">Select or create a project to get started.</p>
        </div>
        <div id="tme-workspace-root" style="width:100%; max-width:800px; display:flex; flex-direction:column; gap:16px;"></div>
      </div>
    `;

    const renderWorkspace = async () => {
       const rootEl = container.querySelector('#tme-workspace-root');
       let workspaceHandle = await getWorkspaceRoot();
       
       if (!workspaceHandle) {
          rootEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; padding:48px; border:2px dashed var(--ps-border); border-radius:12px; background:var(--ps-surface);">
               <span class="material-symbols-outlined text-muted" style="font-size:48px; margin-bottom:16px;">folder_open</span>
               <h3 style="margin-bottom:8px;">No Workspace Selected</h3>
               <p class="text-muted" style="margin-bottom:24px; text-align:center;">A workspace is a local folder on your computer where all your video projects will be stored.</p>
               <button class="btn-primary" id="tme-btn-set-workspace">Select Workspace Folder</button>
            </div>
          `;
          rootEl.querySelector('#tme-btn-set-workspace').onclick = async () => {
             try {
                workspaceHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                await setWorkspaceRoot(workspaceHandle);
                renderWorkspace();
             } catch(e) { if(e.name !== 'AbortError') window.AuroraToast?.show({ variant: 'error', title: 'Error', description: e.message }); }
          };
          return;
       }
       
       if (!(await verifyPermission(workspaceHandle, true))) {
          rootEl.innerHTML = `<div style="text-align:center; padding:24px;"><p class="text-[var(--ps-orange)] mb-4">Permission required to access Workspace.</p><button class="btn-primary" id="tme-btn-grant">Grant Permission</button></div>`;
          rootEl.querySelector('#tme-btn-grant').onclick = async () => {
             if (await verifyPermission(workspaceHandle, true)) renderWorkspace();
          };
          return;
       }
       
       rootEl.innerHTML = `<div style="text-align:center; padding:24px;"><span class="material-symbols-outlined spin">autorenew</span> Scanning workspace...</div>`;
       const projects = await scanWorkspaceProjects(workspaceHandle);
       
       // Sort by recent? They don't have lastOpened natively unless we read it from db, but let's just sort by title
       projects.sort((a,b) => (b.projectData.title || b.projectData.name || '').localeCompare(a.projectData.title || a.projectData.name || ''));
       
       let gridHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
         <div class="text-sm text-muted flex flex-items-center gap-2"><span class="material-symbols-outlined text-[16px]">snippet_folder</span> Workspace: <b>${workspaceHandle.name}</b></div>
         <button class="btn-ghost btn-sm" id="tme-btn-change-workspace" title="Change Workspace"><span class="material-symbols-outlined text-[16px]">edit</span></button>
       </div>`;
       
       gridHtml += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:16px;">`;
       
       // New Project Card
       gridHtml += `
         <button id="tme-btn-new-project" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; background:rgba(255,255,255,0.02); border:2px dashed var(--ps-border); border-radius:12px; cursor:pointer; color:var(--ps-text-muted); transition:0.2s;" onmouseover="this.style.color='var(--ps-blue)'; this.style.borderColor='var(--ps-blue)';" onmouseout="this.style.color='var(--ps-text-muted)'; this.style.borderColor='var(--ps-border)';">
           <span class="material-symbols-outlined" style="font-size:32px; margin-bottom:8px;">add_circle</span>
           <span style="font-size:14px; font-weight:600;">New Project</span>
         </button>
       `;
       
       // Project Cards
       projects.forEach((p, i) => {
         const title = p.projectData.title || p.projectData.name || 'Untitled';
         const thumb = p.projectData.mediaPool && p.projectData.mediaPool.length > 0 ? `<div style="width:100%; height:120px; background:#111; border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;"><span class="material-symbols-outlined text-muted" style="font-size:32px;">movie</span></div>` : `<div style="width:100%; height:120px; background:var(--ps-surface); border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;"><span class="material-symbols-outlined text-muted text-[32px]">folder</span></div>`;
         
         gridHtml += `
           <div class="tme-project-card" data-index="${i}" style="display:flex; flex-direction:column; padding:12px; background:var(--ps-surface); border:1px solid var(--ps-border); border-radius:12px; cursor:pointer; transition:0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='var(--ps-blue)';" onmouseout="this.style.background='var(--ps-surface)'; this.style.borderColor='var(--ps-border)';">
              ${thumb}
              <span style="font-size:14px; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${title}</span>
              <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px;">${p.projectData.mediaPool?.length || 0} assets</span>
           </div>
         `;
       });
       
       gridHtml += `</div>`;
       rootEl.innerHTML = gridHtml;
       
       rootEl.querySelector('#tme-btn-change-workspace').onclick = async () => {
          try {
             const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
             await setWorkspaceRoot(handle);
             renderWorkspace();
          } catch(e) {}
       };
       
       rootEl.querySelector('#tme-btn-new-project').onclick = async () => {
          const name = await showDialog({ type: 'prompt', title: 'New Project', message: 'Project Name:' });
          if (!name) return;
          try {
             const dirHandle = await createProjectInWorkspace(workspaceHandle, name, createEmptyTimeline());
             const fileHandle = await dirHandle.getFileHandle('project.json');
             const file = await fileHandle.getFile();
             currentTimeline = JSON.parse(await file.text());
             currentProjectDirHandle = dirHandle;
             render(container);
          } catch(e) { window.AuroraToast?.show({ variant: 'error', title: 'Error', description: e.message }); }
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
             } catch(e) { window.AuroraToast?.show({ variant: 'error', title: 'Error', description: 'Could not open project. Error: ' + e.message }); }
          };
       });
    };
    
    renderWorkspace();
    return;
  }

  // Fallbacks for older schemas
  if (!currentTimeline.mediaPool || !Array.isArray(currentTimeline.mediaPool)) currentTimeline.mediaPool = [];
  if (!currentTimeline.videoTrack) currentTimeline.videoTrack = [];
  if (!currentTimeline.effectTracks) currentTimeline.effectTracks = [{ id: 'fx1', name: 'FX 1', blocks: [] }];
  if (!currentTimeline.audioTracks) currentTimeline.audioTracks = [{ id: 'a1', name: 'A1', blocks: [] }];

  container.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">view_timeline</span>
          Timeline Editor — 
          <span contenteditable="true" id="tme-project-name" style="font-weight: 400; color: var(--ps-text-muted); margin-left: 4px; padding: 2px 4px; border-radius: 4px; border: 1px solid transparent; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--ps-border)'" onblur="this.style.borderColor='transparent'">${currentTimeline.name}</span>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary" id="tme-btn-new">
            <span class="material-symbols-outlined">add_box</span> New
          </button>
          <button class="btn-secondary" id="tme-btn-open">
            <span class="material-symbols-outlined">folder_open</span> Open
          </button>
          <button class="btn-secondary" id="tme-btn-save">
            <span class="material-symbols-outlined">save</span> Save Project
          </button>
          <button class="btn-secondary" id="tme-btn-export">
            <span class="material-symbols-outlined">ios_share</span> Export
          </button>
        </div>
      </div>
      
      <div class="screen-body" style="flex-direction: column;">
        <!-- Top Half: Media Pool + Player -->
        <div class="flex" style="flex: 1; min-height: 0; border-bottom: 1px solid var(--ps-border);">
          
          <!-- Left Sidebar: Asset Browser & Media Pool -->
          <div class="panel-left" style="width: 320px; border-right: 1px solid var(--ps-border); display: flex; flex-direction: column;">
            
            <div id="tme-fsa-browser-panel" style="flex: 2; min-height: 400px; display: none; flex-direction: column; border-bottom: 1px solid var(--ps-border);"></div>

            <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
              <span class="panel-header-title">Media Pool</span>
              <div style="display: flex; gap: 4px;">
                <button class="btn-ghost" id="tme-btn-remove-media" title="Remove Selected Media" style="color: var(--ps-danger); padding: 4px; opacity: 0.3; cursor: not-allowed;" disabled>
                  <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                </button>

                <button class="btn-ghost" id="tme-btn-import-folder" title="Import Folder" style="padding: 4px;"><span class="material-symbols-outlined" style="font-size: 20px;">snippet_folder</span></button>
                <button class="btn-ghost" id="tme-btn-add-media" title="Import Media Files" style="padding: 4px;">
                  <span class="material-symbols-outlined" style="font-size: 18px;">add</span>
                </button>
              </div>
            </div>
            <div class="panel-body" id="tme-media-pool" style="display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start;">
              <!-- Media items rendered here -->
            </div>
          </div>

          <!-- Player Canvas -->
          <div class="panel-center" style="background: #000; align-items: center; justify-content: center; position: relative;">
            <canvas id="tme-player-canvas" style="max-width: 100%; max-height: 100%; object-fit: contain;"></canvas>
            
            <!-- Player Controls -->
            <div class="flex items-center gap-4" style="position: absolute; bottom: 20px; background: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 99px; backdrop-filter: blur(10px);">
              <button class="btn-icon" id="tme-btn-play"><span class="material-symbols-outlined">play_arrow</span></button>
              <span id="tme-timecode" class="font-mono text-sm" style="color: #fff;">00:00:00:00</span>
            </div>
          </div>

          <!-- Effects Browser & Properties Panel -->
          <div class="panel-right" style="width: 260px; border-left: 1px solid var(--ps-border); display: flex; flex-direction: column;">
            <div class="panel-header" id="tme-effects-header" style="flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span class="panel-header-title">Effects</span>
                <span class="material-symbols-outlined" id="tme-effects-chevron" style="font-size: 16px;">expand_more</span>
              </div>
              <input type="text" id="tme-effects-search" placeholder="Search effects..." class="ic-input" style="font-size: 11px; padding: 4px 8px; border-radius: 4px; background: rgba(0,0,0,0.2);">
            </div>
            <div class="panel-body" id="tme-effects-pool" style="flex: 1; overflow-y: auto; padding-bottom: 8px; padding-top: 8px;">
              <!-- Render list of available effects here -->
            </div>

            <!-- Properties Panel -->
            <div class="panel-header" style="flex-shrink: 0; border-top: 1px solid var(--ps-border);">
              <span class="panel-header-title">Properties</span>
            </div>
            <div class="panel-body" id="tme-properties-panel" style="height: 45%; overflow-y: auto; background: var(--ps-bg-surface);">
              <div class="text-sm text-muted" style="padding: 12px;">Select an effect block to view properties.</div>
            </div>
          </div>

        </div>

        <!-- Bottom Half: Timeline Tracks -->
        <div class="flex-col" style="height: 350px; background: var(--ps-bg-surface); overflow: hidden; display: flex; flex-direction: column;">
          <!-- Timeline Area (Wrapper for TimelineView) -->
          <div id="tme-timeline-wrapper" style="flex: 1; position: relative; display: flex;"></div>
        </div>
      </div>
    </div>
  `;

  const poolContainer = container.querySelector('#tme-media-pool');
  const btnAddMedia = container.querySelector('#tme-btn-add-media');
  const btnImportFolder = container.querySelector('#tme-btn-import-folder');

  const handleGlobalKeyDown = async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    
    // Command+F or Ctrl+F toggles playback
    if (e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        btnPlay.click();
        return;
    }

    if ((e.key === 'Backspace' || e.key === 'Delete') && timelineView && timelineView.selectedClips.size > 0) {
        if (!(await showDialog({ title: 'Delete Items', message: 'Are you sure you want to delete the selected items?' }))) return;
        
        currentTimeline.videoTrack = currentTimeline.videoTrack.filter(c => !timelineView.selectedClips.has(c.id));
        currentTimeline.effectTracks.forEach(t => {
            t.blocks = t.blocks.filter(b => !timelineView.selectedClips.has(b.id));
        });
        currentTimeline.audioTracks.forEach(t => {
            t.blocks = t.blocks.filter(b => !timelineView.selectedClips.has(b.id));
        });
        
        timelineView.selectedClips.clear();
        selectedItemId = null;
        selectedItemType = null;
        
        await saveTimeline(currentTimeline, currentProjectDirHandle);
        renderTimelineTracks();
        renderFrame();
        renderPropertiesPanel();
    }
  };
  document.addEventListener('keydown', handleGlobalKeyDown);

  // ─── Render Media Pool ──────────────────────────────────
  function renderMediaPool() {
    poolContainer.innerHTML = '';
    
    if (!currentTimeline.mediaPool || currentTimeline.mediaPool.length === 0) {
      poolContainer.innerHTML = `
        <div class="empty-state" style="width: 100%;">
          <span class="material-symbols-outlined">perm_media</span>
          <div class="empty-state-title">No Media</div>
          <div class="empty-state-desc">Click '+' or drag files here to add media.</div>
        </div>
      `;
      return;
    }

    // Determine which pool items are used in the timeline
    const usedPoolIds = new Set(currentTimeline.videoTrack.map(clip => clip.poolId));
    if (currentTimeline.audioTracks) {
      currentTimeline.audioTracks.forEach(t => t.blocks.forEach(b => usedPoolIds.add(b.poolId)));
    }

    const btnRemoveMedia = container.querySelector('#tme-btn-remove-media');
    let anySelectedIsUsed = false;

    currentTimeline.mediaPool.forEach(item => {
      const isSelected = mediaPoolSelection.has(item.id);
      const isUsed = usedPoolIds.has(item.id);
      if (isSelected && isUsed) anySelectedIsUsed = true;
      
      const el = document.createElement('div');
      el.className = 'tme-pool-item' + (isSelected ? ' is-selected' : '');
      // Basic inline styling for now, we can move to css later
      el.style.width = '72px';
      el.style.height = '72px';
      el.style.borderRadius = '8px';
      el.style.background = '#111';
      el.style.backgroundImage = `url(${item.thumbnail})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.border = isSelected ? '2px solid var(--ps-blue)' : (isUsed ? '2px solid var(--ps-success)' : '1px solid var(--ps-border)');
      el.style.cursor = 'pointer';
      el.style.position = 'relative';
      
      let tooltip = item.name || item.fileHandle?.name || 'Media';
      if (item.meta) {
         const dateStr = item.meta.lastModified ? new Date(item.meta.lastModified).toLocaleString() : '';
         const sizeStr = item.meta.size ? formatBytes(item.meta.size) : '';
         let typeStr = '';
         if (item.type === 'video') {
           typeStr = `Video: ${item.meta.width || '?'}x${item.meta.height || '?'} • ${item.meta.duration ? item.meta.duration.toFixed(1) + 's' : '?s'}`;
         } else if (item.type === 'image') {
           typeStr = `Image: ${item.meta.width || '?'}x${item.meta.height || '?'}`;
         } else if (item.type === 'audio') {
           typeStr = `Audio: ${item.meta.duration ? item.meta.duration.toFixed(1) + 's' : '?s'}`;
         }
         tooltip = `${tooltip}\n${typeStr}\nModified: ${dateStr}\nSize: ${sizeStr}`;
      }
      el.title = tooltip;
      
      if (item.type === 'video') {
        el.innerHTML = '<span class="material-symbols-outlined" style="position:absolute; bottom:2px; right:2px; font-size:14px; background:rgba(0,0,0,0.6); border-radius:4px; padding:2px; color:#fff;">movie</span>';
      } else if (item.type === 'audio') {
        el.innerHTML = '<span class="material-symbols-outlined" style="position:absolute; bottom:2px; right:2px; font-size:14px; background:rgba(0,0,0,0.6); border-radius:4px; padding:2px; color:#fff;">music_note</span>';
        if (!item.thumbnail) {
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.innerHTML += '<span class="material-symbols-outlined" style="font-size:32px; color:#555;">audio_file</span>';
        }
      }

      el.addEventListener('click', (e) => {
        const idx = currentTimeline.mediaPool.findIndex(x => x.id === item.id);
        if (e.shiftKey && lastSelectedPoolIndex !== -1) {
          const start = Math.min(lastSelectedPoolIndex, idx);
          const end = Math.max(lastSelectedPoolIndex, idx);
          if (!e.metaKey && !e.ctrlKey) mediaPoolSelection.clear();
          for (let i = start; i <= end; i++) {
             mediaPoolSelection.add(currentTimeline.mediaPool[i].id);
          }
          lastSelectedPoolIndex = idx;
        } else if (e.metaKey || e.ctrlKey) {
          if (isSelected) mediaPoolSelection.delete(item.id);
          else {
             mediaPoolSelection.add(item.id);
             lastSelectedPoolIndex = idx;
          }
        } else {
          mediaPoolSelection.clear();
          mediaPoolSelection.add(item.id);
          lastSelectedPoolIndex = idx;
        }
        renderMediaPool();
      });

      // Enable dragging to timeline
      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        // If the item being dragged isn't selected, select only it
        if (!mediaPoolSelection.has(item.id)) {
          mediaPoolSelection.clear();
          mediaPoolSelection.add(item.id);
          renderMediaPool(); // updates border
        }
        // Pass the list of selected pool item IDs
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(mediaPoolSelection)));
        e.dataTransfer.effectAllowed = 'copy';
      });

      // Double-click to insert at end of respective track
      el.addEventListener('dblclick', async () => {
        const duration = item.meta?.duration || 4.0;
        if (item.type === 'video' || item.type === 'image') {
          let maxT = 0;
          if (timelineView && timelineView.isMagnetic) {
             maxT = currentTimeline.videoTrack.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
          } else {
             maxT = playheadTime;
          }
          currentTimeline.videoTrack.push({
            id: generateId(), poolId: item.id, timelineStart: maxT, duration: duration, sourceStart: 0, transitionOut: null
          });
        } else if (item.type === 'audio') {
          if (currentTimeline.audioTracks.length === 0) {
            currentTimeline.audioTracks.push({ id: generateId(), name: 'A1', blocks: [] });
          }
          let targetTrack = currentTimeline.audioTracks.find(t => timelineView && timelineView.selectedTracks.has(t.id));
          if (!targetTrack) targetTrack = currentTimeline.audioTracks[0];
          
          let maxT = 0;
          if (timelineView && timelineView.isMagnetic) {
             maxT = targetTrack.blocks.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
          } else {
             maxT = playheadTime;
          }
          targetTrack.blocks.push({ id: generateId(), poolId: item.id, timelineStart: maxT, duration: duration, sourceStart: 0 });
        }
        await saveTimeline(currentTimeline, currentProjectDirHandle);
        renderTimelineTracks();
      });

      poolContainer.appendChild(el);
    });

    if (btnRemoveMedia) {
      if (mediaPoolSelection.size > 0 && !anySelectedIsUsed) {
        btnRemoveMedia.disabled = false;
        btnRemoveMedia.style.opacity = '1';
        btnRemoveMedia.style.cursor = 'pointer';
        btnRemoveMedia.title = "Remove Selected Media";
      } else {
        btnRemoveMedia.disabled = true;
        btnRemoveMedia.style.opacity = '0.3';
        btnRemoveMedia.style.cursor = 'not-allowed';
        if (anySelectedIsUsed) {
           btnRemoveMedia.title = "Cannot delete media currently used in timeline";
        } else {
           btnRemoveMedia.title = "Remove Selected Media";
        }
      }
    }
  }

  const btnRemoveMedia = container.querySelector('#tme-btn-remove-media');
  if (btnRemoveMedia) {
    btnRemoveMedia.addEventListener('click', async () => {
      const idsToRemove = Array.from(mediaPoolSelection);
      currentTimeline.mediaPool = currentTimeline.mediaPool.filter(p => !idsToRemove.includes(p.id));
      mediaPoolSelection.clear();
      await saveTimeline(currentTimeline, currentProjectDirHandle);
      renderMediaPool();
    });
  }

  const fxPoolContainer = container.querySelector('#tme-effects-pool');
  const fxSearchInput = container.querySelector('#tme-effects-search');
  
  if (fxSearchInput) {
    fxSearchInput.addEventListener('input', () => {
      renderEffectsPool(fxSearchInput.value.toLowerCase());
    });
  }

  const fxHeader = container.querySelector('#tme-effects-header');
  let isEffectsCollapsed = false;

  function updateEffectsCollapseState() {
    const pool = container.querySelector('#tme-effects-pool');
    const chevron = container.querySelector('#tme-effects-chevron');
    const propsPanel = container.querySelector('#tme-properties-panel');
    
    if (isEffectsCollapsed) {
      pool.style.display = 'none';
      if (fxSearchInput) fxSearchInput.style.display = 'none';
      if (chevron) chevron.textContent = 'chevron_right';
      if (propsPanel) propsPanel.style.flex = '1';
    } else {
      pool.style.display = 'block';
      if (fxSearchInput) fxSearchInput.style.display = 'block';
      if (chevron) chevron.textContent = 'expand_more';
      if (propsPanel) {
        propsPanel.style.flex = 'none';
        propsPanel.style.height = '45%';
      }
    }
  }

  if (fxHeader) {
    fxHeader.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return;
      isEffectsCollapsed = !isEffectsCollapsed;
      updateEffectsCollapseState();
    });
  }

  // ─── Render Effects Pool ────────────────────────────────
  function renderEffectsPool(filterText = '') {
    fxPoolContainer.innerHTML = '';
    const allDefs = registry.getAll();
    const fxDefs = allDefs.filter(d => 
       (d.timeline === 'native' || d.timeline === 'compatible') && 
       (d.name.toLowerCase().includes(filterText) || (d.category || '').toLowerCase().includes(filterText))
    );
    
    fxDefs.forEach(def => {
      const el = document.createElement('div');
      el.className = 'tme-effect-item ic-card';
      el.style.padding = '8px';
      el.style.cursor = 'grab';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.gap = '8px';
      el.style.marginBottom = '8px';
      
      el.innerHTML = `
        <span class="material-symbols-outlined text-muted">${def.icon || 'auto_awesome'}</span>
        <div class="flex-col">
          <span class="text-sm" style="color:var(--ps-text); font-weight:500;">${def.name}</span>
        </div>
      `;

      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'effect', transformId: def.id }));
        e.dataTransfer.effectAllowed = 'copy';
      });

      el.addEventListener('dblclick', async () => {
        if (currentTimeline.effectTracks.length > 0) {
          currentTimeline.effectTracks[0].blocks.push({
            id: generateId(),
            transformId: def.id,
            timelineStart: playheadTime,
            duration: 4.0,
            params: {},
            keyframes: []
          });
          await saveTimeline(currentTimeline, currentProjectDirHandle);
          renderTimelineTracks();
          renderFrame();
        }
      });

      fxPoolContainer.appendChild(el);
    });
  }

  const propsContainer = container.querySelector('#tme-properties-panel');

  function renderPropertiesPanel() {
    propsContainer.innerHTML = '';
    
    if (!selectedItemId || (selectedItemType !== 'fx' && selectedItemType !== 'video')) {
      propsContainer.innerHTML = '<div class="text-sm text-muted" style="padding: 12px;">Select an effect or video block to view properties.</div>';
      if (isEffectsCollapsed) {
        isEffectsCollapsed = false;
        updateEffectsCollapseState();
      }
      return;
    }

    if (!isEffectsCollapsed) {
      isEffectsCollapsed = true;
      updateEffectsCollapseState();
    }

    function getTransitionHtml(block) {
      const tIn = block.transitionIn || { style: 'none', duration: 0.0 };
      const tOut = block.transitionOut || { style: 'none', duration: 0.0 };
      const styles = ['none', ...Object.keys(TRANSITIONS)];
      
      return `
        <div class="panel-header" style="flex-shrink: 0; border-top: 1px solid var(--ps-border); border-bottom: 1px solid var(--ps-border); background: var(--ps-bg-surface);">
          <span class="panel-header-title text-xs">Transitions</span>
        </div>
        <div class="ned-fields" style="padding: 12px; background: rgba(0,0,0,0.1);">
          <div class="ned-field">
            <span class="ned-field-label">Transition In</span>
            <div style="display:flex; gap: 8px;">
              <select id="tme-t-in-style" class="ic-input" style="flex: 1; font-size: 11px;">
                ${styles.map(s => `<option value="${s}" ${tIn.style === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <input type="number" id="tme-t-in-dur" class="ic-input" style="width: 60px; font-size: 11px;" value="${tIn.duration}" step="0.1" min="0">
              <span class="text-xs text-muted" style="line-height:24px;">s</span>
            </div>
          </div>
          <div class="ned-field">
            <span class="ned-field-label">Transition Out</span>
            <div style="display:flex; gap: 8px;">
              <select id="tme-t-out-style" class="ic-input" style="flex: 1; font-size: 11px;">
                ${styles.map(s => `<option value="${s}" ${tOut.style === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <input type="number" id="tme-t-out-dur" class="ic-input" style="width: 60px; font-size: 11px;" value="${tOut.duration}" step="0.1" min="0">
              <span class="text-xs text-muted" style="line-height:24px;">s</span>
            </div>
          </div>
        </div>
      `;
    }

    function bindTransitionEvents(block) {
      const tInStyle = propsContainer.querySelector('#tme-t-in-style');
      const tInDur = propsContainer.querySelector('#tme-t-in-dur');
      const tOutStyle = propsContainer.querySelector('#tme-t-out-style');
      const tOutDur = propsContainer.querySelector('#tme-t-out-dur');
      
      const updateTransitions = async () => {
        block.transitionIn = { style: tInStyle.value, duration: parseFloat(tInDur.value) || 0 };
        block.transitionOut = { style: tOutStyle.value, duration: parseFloat(tOutDur.value) || 0 };
        await saveTimeline(currentTimeline, currentProjectDirHandle);
        renderTimelineTracks();
        renderFrame();
      };
      
      if (tInStyle) {
        tInStyle.addEventListener('change', () => {
            if (tInStyle.value !== 'none' && (!tInDur.value || parseFloat(tInDur.value) === 0)) {
                tInDur.value = '1.0';
            }
            updateTransitions();
        });
        tInDur.addEventListener('change', updateTransitions);
        tOutStyle.addEventListener('change', () => {
            if (tOutStyle.value !== 'none' && (!tOutDur.value || parseFloat(tOutDur.value) === 0)) {
                tOutDur.value = '1.0';
            }
            updateTransitions();
        });
        tOutDur.addEventListener('change', updateTransitions);
      }
    }

    // --- VIDEO CLIP PROPERTIES ---
    if (selectedItemType === 'video') {
      const vBlock = currentTimeline.videoTrack.find(c => c.id === selectedItemId);
      if (!vBlock) return;
      
      const poolItem = currentTimeline.mediaPool.find(m => m.id === vBlock.poolId);
      const name = poolItem ? poolItem.name : vBlock.poolId;

      propsContainer.innerHTML = `
        <div style="padding: 12px; font-size: 12px; color: var(--ps-text-muted);">
          <strong>Video Clip:</strong> ${name}
        </div>
        ${getTransitionHtml(vBlock)}
      `;
      bindTransitionEvents(vBlock);
      return;
    }

    // --- AUDIO CLIP PROPERTIES ---
    if (selectedItemType === 'audio') {
      let aBlock = null;
      currentTimeline.audioTracks.forEach(t => {
        const b = t.blocks.find(blk => blk.id === selectedItemId);
        if (b) aBlock = b;
      });
      if (!aBlock) return;
      
      const poolItem = currentTimeline.mediaPool.find(m => m.id === aBlock.poolId);
      const name = poolItem ? poolItem.name || poolItem.fileHandle?.name : 'Audio Clip';

      propsContainer.innerHTML = `
        <div style="padding: 12px; font-size: 12px; color: var(--ps-text-muted); border-bottom: 1px solid var(--ps-border);">
          <strong>Audio Clip:</strong> ${name}
        </div>
        <div style="padding: 16px;">
          <div class="ned-field">
            <div class="ned-field-label">Volume</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" id="tme-audio-volume" min="0" max="1" step="0.05" value="${aBlock.volume !== undefined ? aBlock.volume : 1}" style="flex:1;">
              <span id="tme-audio-volume-val" style="font-size:11px; width:30px;">${Math.round((aBlock.volume !== undefined ? aBlock.volume : 1) * 100)}%</span>
            </div>
          </div>
        </div>
      `;
      
      const volInput = propsContainer.querySelector('#tme-audio-volume');
      const volVal = propsContainer.querySelector('#tme-audio-volume-val');
      volInput.addEventListener('input', async (e) => {
        const val = parseFloat(e.target.value);
        volVal.textContent = Math.round(val * 100) + '%';
        aBlock.volume = val;
        await saveTimeline(currentTimeline, currentProjectDirHandle);
        syncAudioPlayback(); // immediate update of volume
      });
      
      return;
    }

    // --- EFFECT PROPERTIES ---
    let fxBlock = null;
    currentTimeline.effectTracks.forEach(t => {
      const b = t.blocks.find(blk => blk.id === selectedItemId);
      if (b) fxBlock = b;
    });

    if (!fxBlock) return;

    const def = registry.get(fxBlock.transformId);
    let paramsHtml = '';
    let activeParams = fxBlock.params || {};
    let activeKeyframeIdx = -1;

    if (!def || !def.params || def.params.length === 0) {
      paramsHtml = '<div class="text-sm text-muted" style="padding: 12px;">No configurable properties for this effect.</div>';
    } else {
      if (Array.isArray(fxBlock.keyframes) && fxBlock.keyframes.length > 0) {
        const offset = playheadTime - fxBlock.timelineStart;
        for (let i = fxBlock.keyframes.length - 1; i >= 0; i--) {
          if (fxBlock.keyframes[i].offset <= offset + 0.05) {
            activeKeyframeIdx = i;
            break;
          }
        }
        if (activeKeyframeIdx !== -1) {
          activeParams = fxBlock.keyframes[activeKeyframeIdx].params;
        } else {
          activeParams = fxBlock.params || {};
        }
      }

      const hasKeyframes = Array.isArray(fxBlock.keyframes) && fxBlock.keyframes.length > 0;
      const disablePrev = activeKeyframeIdx <= 0;
      const disableNext = !hasKeyframes || activeKeyframeIdx === fxBlock.keyframes.length - 1;

      let kfHeaderHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; padding: 8px 12px; background: rgba(0,0,0,0.8); border-bottom: 1px solid var(--ps-border); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px);">
          <div style="display:flex; align-items:center; gap: 4px;">
            <button class="btn-icon" id="tme-kf-prev" style="width:20px;height:20px;padding:0;" ${disablePrev ? 'disabled' : ''}><span class="material-symbols-outlined" style="font-size:14px;">chevron_left</span></button>
            <span class="text-xs" style="color:#22d3ee;">${activeKeyframeIdx === -1 ? 'Base Settings' : `Keyframe ${activeKeyframeIdx + 1}`}</span>
            <button class="btn-icon" id="tme-kf-next" style="width:20px;height:20px;padding:0;" ${disableNext ? 'disabled' : ''}><span class="material-symbols-outlined" style="font-size:14px;">chevron_right</span></button>
          </div>
          <button class="btn-icon" id="tme-kf-delete" style="width:20px;height:20px;padding:0; color:var(--ps-danger); ${activeKeyframeIdx === -1 ? 'display:none;' : ''}" title="Delete Keyframe"><span class="material-symbols-outlined" style="font-size:14px;">delete</span></button>
        </div>
      `;

      paramsHtml = `
        ${kfHeaderHtml}
        <div class="ned-fields" style="padding: 12px;">
          ${def.params.map(p => {
             let html = renderParamField(p, activeParams[p.name], 'tme');
             if (p.type === 'range' || p.type === 'number') {
                const behaviorsList = getAllBehaviors();
                const currentBehav = fxBlock.behaviors?.[p.name];
                
                const behavOptions = behaviorsList.map(b => `<option value="${b.id}" ${currentBehav?.id === b.id ? 'selected' : ''}>${b.name}</option>`).join('');
                
                let behavParamsHtml = '';
                if (currentBehav && currentBehav.id) {
                   const behavDef = behaviorsList.find(b => b.id === currentBehav.id);
                   if (behavDef && behavDef.params) {
                      behavParamsHtml = '<div style="margin-top:4px; padding:8px; background:rgba(0,0,0,0.2); border-radius:4px; border: 1px solid var(--ps-border);">' + behavDef.params.map(bp => {
                         const bVal = currentBehav.params?.[bp.name] ?? bp.defaultValue;
                         return `
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:10px;">
                               <label style="color:var(--ps-text-muted);">${bp.label}</label>
                               <div style="display:flex; align-items:center; gap:4px;">
                                 <input type="${bp.type === 'range' ? 'range' : 'number'}" class="tme-behavior-param ic-range" data-param="${p.name}" data-bparam="${bp.name}" min="${bp.min}" max="${bp.max}" step="${bp.step||1}" value="${bVal}" style="width:60px;">
                                 ${bp.type === 'range' ? `<span style="width:20px; text-align:right; color:var(--ps-blue);">${bVal}</span>` : ''}
                               </div>
                            </div>
                         `;
                      }).join('') + '</div>';
                   }
                }

                html += `
                  <div style="margin-top: 4px; margin-bottom: 12px; display:flex; flex-direction:column; gap:4px; padding-left: 8px; border-left: 2px solid rgba(167, 139, 250, 0.3);">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:var(--ps-blue);">
                      <span><span class="material-symbols-outlined" style="font-size:12px; vertical-align:middle; margin-right:2px;">animation</span> Behavior</span>
                      <select class="tme-behavior-select ic-input" data-param="${p.name}" style="font-size:10px; padding:2px; height:auto; width: 100px;">
                        <option value="">None</option>
                        ${behavOptions}
                      </select>
                    </div>
                    ${behavParamsHtml}
                  </div>
                `;
             }
             return html;
          }).join('')}
        </div>
      `;
    }

    propsContainer.innerHTML = `
      ${paramsHtml}
      ${getTransitionHtml(fxBlock)}
    `;
    
    bindTransitionEvents(fxBlock);

    if (def && def.params && def.params.length > 0) {
      const btnKfPrev = propsContainer.querySelector('#tme-kf-prev');
      if (btnKfPrev) btnKfPrev.addEventListener('click', () => {
         playheadTime = fxBlock.timelineStart + fxBlock.keyframes[activeKeyframeIdx - 1].offset;
         updatePlayheadUI();
         renderPropertiesPanel();
         renderFrame();
      });
      
      const btnKfNext = propsContainer.querySelector('#tme-kf-next');
      if (btnKfNext) btnKfNext.addEventListener('click', () => {
         playheadTime = fxBlock.timelineStart + fxBlock.keyframes[activeKeyframeIdx + 1].offset;
         updatePlayheadUI();
         renderPropertiesPanel();
         renderFrame();
      });

      const btnKfDelete = propsContainer.querySelector('#tme-kf-delete');
      if (btnKfDelete) btnKfDelete.addEventListener('click', async () => {
         fxBlock.keyframes.splice(activeKeyframeIdx, 1);
         if (fxBlock.keyframes.length === 0) {
           delete fxBlock.keyframes;
         }
         await saveTimeline(currentTimeline, currentProjectDirHandle);
         renderTimelineTracks();
         renderPropertiesPanel();
         renderFrame();
      });

      // Initialize UI events and previews
      bindParamFieldEvents(propsContainer, def.params, 'tme');
      
      const onChange = async () => {
        const newParams = collectParams(propsContainer, def.params, 'tme');
        if (Array.isArray(fxBlock.keyframes) && fxBlock.keyframes.length > 0) {
           if (activeKeyframeIdx !== -1) {
             fxBlock.keyframes[activeKeyframeIdx].params = newParams;
           }
        } else {
           fxBlock.params = newParams;
        }

        // Collect behaviors
        if (!fxBlock.behaviors) fxBlock.behaviors = {};
        propsContainer.querySelectorAll('.tme-behavior-select').forEach(sel => {
           const pName = sel.dataset.param;
           const bId = sel.value;
           if (!bId) {
              delete fxBlock.behaviors[pName];
           } else {
              if (!fxBlock.behaviors[pName] || fxBlock.behaviors[pName].id !== bId) {
                 fxBlock.behaviors[pName] = { id: bId, params: {} };
              }
           }
        });

        propsContainer.querySelectorAll('.tme-behavior-param').forEach(inp => {
           const pName = inp.dataset.param;
           const bpName = inp.dataset.bparam;
           if (fxBlock.behaviors[pName]) {
              fxBlock.behaviors[pName].params[bpName] = parseFloat(inp.value);
           }
        });

        await saveTimeline(currentTimeline, currentProjectDirHandle);
        renderFrame();
      };

      propsContainer.querySelectorAll('input, select').forEach(el => {
        if (!el.classList.contains('tme-behavior-select') && !el.classList.contains('tme-behavior-param')) {
          if (el.type === 'range' || el.type === 'color') {
            el.addEventListener('input', () => {
              if (el.type === 'range') {
                const valEl = propsContainer.querySelector(`#${el.id}-val`);
                if (valEl) valEl.textContent = el.value;
              }
              onChange();
            });
          } else {
            el.addEventListener('change', onChange);
          }
        }
      });

      propsContainer.querySelectorAll('.tme-behavior-select').forEach(sel => {
         sel.addEventListener('change', async () => {
            await onChange();
            renderPropertiesPanel();
         });
      });

      propsContainer.querySelectorAll('.tme-behavior-param').forEach(inp => {
         inp.addEventListener('input', async () => {
            if (inp.type === 'range') {
               const valSpan = inp.nextElementSibling;
               if (valSpan) valSpan.textContent = inp.value;
            }
            await onChange();
         });
      });
    }
  }

  // ─── Timeline Rendering & Logic ─────────────────────────
  let PIXELS_PER_SECOND = 50; 
  const tracksBodyEl = container.querySelector('#tme-tracks-body');
  const trackHeadersEl = container.querySelector('#tme-track-headers');
  const rulerCanvas = container.querySelector('#tme-ruler-canvas');
  const scrollContainer = container.querySelector('#tme-timeline-scroll');

  if (trackHeadersEl) {
    trackHeadersEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.tme-btn-toggle-track');
      if (btn) {
         const type = btn.dataset.trackType;
         const idx = parseInt(btn.dataset.trackIdx);
         if (type === 'video') {
           currentTimeline.videoTrackDisabled = !currentTimeline.videoTrackDisabled;
         } else if (type === 'fx') {
           currentTimeline.effectTracks[idx].disabled = !currentTimeline.effectTracks[idx].disabled;
         } else if (type === 'audio') {
           currentTimeline.audioTracks[idx].disabled = !currentTimeline.audioTracks[idx].disabled;
         }
         await saveTimeline(currentTimeline, currentProjectDirHandle);
         renderTimelineTracks();
         renderFrame();
      }
    });
  }
  if (tracksBodyEl) {
    tracksBodyEl.addEventListener('contextmenu', async (e) => {
      if (e.target.closest('.tme-clip') || e.target.closest('.tme-fx-block')) return;
      
      e.preventDefault();
      
      const rect = tracksBodyEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left + scrollContainer.scrollLeft;
      const clickTime = Math.max(0, clickX / PIXELS_PER_SECOND);
      
      const gapStr = await showDialog({ type: 'prompt', title: 'Insert Gap', message: `Insert gap at ${clickTime.toFixed(2)}s.\nEnter number of seconds to shift everything forward:`, defaultValue: '1.0' });
      if (!gapStr) return;
      const gap = parseFloat(gapStr);
      if (isNaN(gap) || gap <= 0) return;
      
      let changed = false;
      const tThreshold = clickTime - 0.01;
      
      if (currentTimeline.videoTrack) {
        currentTimeline.videoTrack.forEach(clip => {
          if (clip.timelineStart >= tThreshold) {
            clip.timelineStart += gap;
            changed = true;
          }
        });
      }
      
      if (currentTimeline.effectTracks) {
        currentTimeline.effectTracks.forEach(track => {
          track.blocks.forEach(fx => {
            if (fx.timelineStart >= tThreshold) {
              fx.timelineStart += gap;
              changed = true;
            }
          });
        });
      }
      
      if (currentTimeline.audioTracks) {
        currentTimeline.audioTracks.forEach(track => {
          track.blocks.forEach(clip => {
            if (clip.timelineStart >= tThreshold) {
              clip.timelineStart += gap;
              changed = true;
            }
          });
        });
      }
      
      if (changed) {
        await saveTimeline(currentTimeline, currentProjectDirHandle);
        renderTimelineTracks();
        renderFrame();
      }
    });
  }

  function renderRuler() {
    if (!rulerCanvas) return;
    
    // Make ruler match the scroll width
    rulerCanvas.width = Math.max(scrollContainer.clientWidth, scrollContainer.scrollWidth);
    rulerCanvas.height = 30;

    const ctx = rulerCanvas.getContext('2d');
    ctx.clearRect(0, 0, rulerCanvas.width, rulerCanvas.height);
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxSeconds = Math.ceil(rulerCanvas.width / PIXELS_PER_SECOND);
    
    for (let s = 0; s <= maxSeconds; s++) {
      const x = s * PIXELS_PER_SECOND;
      ctx.fillRect(x, 20, 1, 10); // Major tick
      
      // Sub-ticks
      if (PIXELS_PER_SECOND >= 40) {
        ctx.fillRect(x + PIXELS_PER_SECOND * 0.25, 25, 1, 5);
        ctx.fillRect(x + PIXELS_PER_SECOND * 0.5, 25, 1, 5);
        ctx.fillRect(x + PIXELS_PER_SECOND * 0.75, 25, 1, 5);
      }
      
      let interval = 1;
      if (PIXELS_PER_SECOND < 20) interval = 5;
      if (PIXELS_PER_SECOND < 5) interval = 10;
      
      if (s % interval === 0) {
        ctx.fillText(formatTimecode(s).slice(3, 8), x, 4); // MM:SS format
      }
    }
  }

  // ─── Playhead Scrubbing ─────────────────────────────────
  let isScrubbing = false;
  const rulerHeader = container.querySelector('#tme-ruler-header');
  
  if (rulerHeader) {
    rulerHeader.addEventListener('mousedown', (e) => {
      isScrubbing = true;
      handleScrub(e);
    });
  }

  const handleScrub = (e) => {
    const rect = tracksBodyEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    playheadTime = Math.max(0, x / PIXELS_PER_SECOND);
    updatePlayheadUI();
    renderFrame();
  };

  document.addEventListener('mousemove', (e) => {
    if (isScrubbing) handleScrub(e);
  });
  document.addEventListener('mouseup', () => {
    isScrubbing = false;
  });

  function renderTimelineTracks() {
    if (!timelineView) {
      timelineView = new TimelineView(container.querySelector('#tme-timeline-wrapper'), {
        pixelsPerSecond: PIXELS_PER_SECOND,
        onTogglePlay: () => {
            const btnPlay = container.querySelector('#tme-btn-play');
            if (btnPlay) btnPlay.click();
        },
        onPlayheadMove: (time) => {
          playheadTime = time;
          updatePlayheadUI();
          renderFrame();
          renderPropertiesPanel();
        },
        onClipSelect: (clipId, trackId, event) => {
          if (event.shiftKey || event.metaKey) {
            if (timelineView.selectedClips.has(clipId)) timelineView.selectedClips.delete(clipId);
            else timelineView.selectedClips.add(clipId);
          } else {
            timelineView.selectedClips.clear();
            timelineView.selectedClips.add(clipId);
          }
          selectedItemId = timelineView.selectedClips.size === 1 ? [...timelineView.selectedClips][0] : null;
          selectedItemType = trackId === 'v1' ? 'video' : (trackId.startsWith('audio_') || trackId.startsWith('a') || trackId.startsWith('A') ? 'audio' : 'fx');
          renderPropertiesPanel();
          renderTimelineTracks();
        },
        onTrackSelect: (trackId, event) => {
          timelineView.selectedClips.clear();
          let trackClips = [];
          if (trackId === 'v1') {
             trackClips = currentTimeline.videoTrack;
             selectedItemType = 'video';
          } else {
             const audioTrack = currentTimeline.audioTracks.find(x => x.id === trackId);
             if (audioTrack) {
                trackClips = audioTrack.blocks;
                selectedItemType = 'audio';
             } else {
                const effectTrack = currentTimeline.effectTracks.find(x => x.id === trackId);
                if (effectTrack) {
                   trackClips = effectTrack.blocks;
                   selectedItemType = 'fx';
                }
             }
          }
          trackClips.forEach(c => timelineView.selectedClips.add(c.id));
          selectedItemId = timelineView.selectedClips.size === 1 ? [...timelineView.selectedClips][0] : null;
          renderPropertiesPanel();
          renderTimelineTracks();
        },
        onAddTrack: async () => {
          const dialog = document.createElement('div');
          dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;color:#fff;';
          dialog.innerHTML = `
            <div style="background:var(--ps-bg-surface);border:1px solid var(--ps-border);border-radius:8px;padding:20px;width:300px;">
              <h3 style="margin-bottom:16px;">Add Track</h3>
              <select id="tme-add-track-type" class="ic-input" style="width:100%;margin-bottom:16px;">
                <option value="audio">Audio Track</option>
                <option value="fx">Effect (FX) Track</option>
              </select>
              <div style="display:flex;justify-content:flex-end;gap:8px;">
                <button id="tme-btn-cancel-add-track" class="btn-ghost">Cancel</button>
                <button id="tme-btn-confirm-add-track" class="btn-primary">Add Track</button>
              </div>
            </div>
          `;
          document.body.appendChild(dialog);
          
          dialog.querySelector('#tme-btn-cancel-add-track').onclick = () => document.body.removeChild(dialog);
          dialog.querySelector('#tme-btn-confirm-add-track').onclick = async () => {
              const type = dialog.querySelector('#tme-add-track-type').value;
              if (type === 'audio') {
                  const idx = currentTimeline.audioTracks.length + 1;
                  currentTimeline.audioTracks.push({ id: generateId(), name: `A${idx}`, blocks: [] });
              } else if (type === 'fx') {
                  const idx = currentTimeline.effectTracks.length + 1;
                  currentTimeline.effectTracks.push({ id: generateId(), name: `FX ${idx}`, blocks: [] });
              }
              await saveTimeline(currentTimeline, currentProjectDirHandle);
              renderTimelineTracks();
              document.body.removeChild(dialog);
          };
        },
        onClipContextMenu: (clip, e) => {
            if (!timelineView.selectedClips.has(clip.id)) {
                timelineView.selectedClips.clear();
                timelineView.selectedClips.add(clip.id);
            }
            selectedItemId = timelineView.selectedClips.size === 1 ? [...timelineView.selectedClips][0] : null;
            
            let trackType = 'video';
            if (currentTimeline.effectTracks.some(t => t.blocks.find(b => b.id === clip.id))) trackType = 'fx';
            if (currentTimeline.audioTracks.some(t => t.blocks.find(b => b.id === clip.id))) trackType = 'audio';
            selectedItemType = trackType;
            
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const splitOffsetSec = clickX / PIXELS_PER_SECOND;

            renderPropertiesPanel();
            renderTimelineTracks();

            const menu = document.createElement('div');
            menu.style.position = 'fixed';
            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;
            menu.style.background = '#1e1e1e';
            menu.style.border = '1px solid #333';
            menu.style.borderRadius = '8px';
            menu.style.padding = '8px 0';
            menu.style.zIndex = '9999';
            menu.style.boxShadow = '0 8px 16px rgba(0,0,0,0.5)';
            menu.style.minWidth = '160px';

            const addMenuItem = (label, icon, onClick) => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.gap = '8px';
                item.style.padding = '8px 16px';
                item.style.cursor = 'pointer';
                item.style.fontSize = '14px';
                item.style.color = '#fff';
                item.style.transition = 'background 0.2s';
                
                item.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;color:#aaa;">${icon}</span> ${label}`;
                item.onmouseenter = () => item.style.backgroundColor = 'rgba(255,255,255,0.1)';
                item.onmouseleave = () => item.style.backgroundColor = 'transparent';
                
                item.onclick = (evt) => { 
                    evt.stopPropagation();
                    onClick(); 
                    if (document.body.contains(menu)) document.body.removeChild(menu); 
                };
                menu.appendChild(item);
            };

            if (trackType === 'fx') {
                addMenuItem('Add Keyframe Here', 'add_location_alt', async () => {
                   let fxBlock = null;
                   currentTimeline.effectTracks.forEach(t => {
                     const b = t.blocks.find(blk => blk.id === selectedItemId);
                     if (b) fxBlock = b;
                   });
                   if (!fxBlock) return;
                   
                   const offset = splitOffsetSec;
                   if (offset < 0 || offset > fxBlock.duration) return;

                   if (!Array.isArray(fxBlock.keyframes) || fxBlock.keyframes.length === 0) {
                     fxBlock.keyframes = [{ offset: 0, params: JSON.parse(JSON.stringify(fxBlock.params || {})) }];
                   }
                   
                   const existingIdx = fxBlock.keyframes.findIndex(k => Math.abs(k.offset - offset) < 0.05);
                   if (existingIdx === -1) {
                     const currentParams = getInterpolatedParams(fxBlock, fxBlock.timelineStart + splitOffsetSec);
                     fxBlock.keyframes.push({ offset: offset, params: currentParams });
                     fxBlock.keyframes.sort((a, b) => a.offset - b.offset);
                     await saveTimeline(currentTimeline, currentProjectDirHandle);
                     renderTimelineTracks();
                     renderPropertiesPanel();
                   }
                });
            }
            
            addMenuItem('Split Clip Here', 'content_cut', async () => {
                let splitHappened = false;
                const splitTime = clip.timelineStart + splitOffsetSec;

                if (trackType === 'video') {
                  const clipIndex = currentTimeline.videoTrack.findIndex(c => c.id === clip.id);
                  if (clipIndex !== -1) {
                    const c = currentTimeline.videoTrack[clipIndex];
                    const splitOffset = splitTime - c.timelineStart;
                    const newDuration2 = c.duration - splitOffset;
                    c.duration = splitOffset;
                    currentTimeline.videoTrack.splice(clipIndex + 1, 0, {
                      ...c, id: generateId(), timelineStart: splitTime, duration: newDuration2, sourceStart: (c.sourceStart || 0) + splitOffset
                    });
                    splitHappened = true;
                  }
                } else if (trackType === 'fx') {
                  currentTimeline.effectTracks.forEach(t => {
                    const fxIndex = t.blocks.findIndex(b => b.id === clip.id);
                    if (fxIndex !== -1) {
                      const fx = t.blocks[fxIndex];
                      const splitOffset = splitTime - fx.timelineStart;
                      const newDuration2 = fx.duration - splitOffset;
                      fx.duration = splitOffset;
                      t.blocks.splice(fxIndex + 1, 0, {
                        ...fx, id: generateId(), timelineStart: splitTime, duration: newDuration2
                      });
                      splitHappened = true;
                    }
                  });
                } else if (trackType === 'audio') {
                  currentTimeline.audioTracks.forEach(t => {
                    const aIndex = t.blocks.findIndex(b => b.id === clip.id);
                    if (aIndex !== -1) {
                      const c = t.blocks[aIndex];
                      const splitOffset = splitTime - c.timelineStart;
                      const newDuration2 = c.duration - splitOffset;
                      c.duration = splitOffset;
                      t.blocks.splice(aIndex + 1, 0, {
                        ...c, id: generateId(), timelineStart: splitTime, duration: newDuration2, sourceStart: (c.sourceStart || 0) + splitOffset
                      });
                      splitHappened = true;
                    }
                  });
                }

                if (splitHappened) {
                  await saveTimeline(currentTimeline, currentProjectDirHandle);
                  renderTimelineTracks();
                  renderFrame();
                }
            });
            
            addMenuItem('Delete Clip', 'delete', () => timelineView.options.onDeleteSelected());

            document.body.appendChild(menu);
            const closeMenu = (evt) => {
                if (document.body.contains(menu) && !menu.contains(evt.target)) {
                    document.body.removeChild(menu);
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 10);
        },
        onClipDrag: (clipId, newTimeSec) => {
           // Find the clip and update its timelineStart
           let c = currentTimeline.videoTrack.find(x => x.id === clipId);
           if (c) c.timelineStart = newTimeSec;
           
           currentTimeline.audioTracks.forEach(t => {
             let ac = t.blocks.find(x => x.id === clipId);
             if (ac) ac.timelineStart = newTimeSec;
           });
           
           currentTimeline.effectTracks.forEach(t => {
             let fc = t.blocks.find(x => x.id === clipId);
             if (fc) fc.timelineStart = newTimeSec;
           });
           
           renderFrame();
        },
        onTrackDrop: async (track, offsetX, event) => {
           try {
             let currentTime = Math.max(0, offsetX / PIXELS_PER_SECOND);
             let dropped = false;

             const jsonStr = event.dataTransfer.getData('application/json');
             if (jsonStr) {
                 const payload = JSON.parse(jsonStr);
                 if (payload.type === 'effect' && track.type === 'effect') {
                     const t = currentTimeline.effectTracks.find(et => et.id === track.id);
                     if (t) {
                         t.blocks.push({ id: generateId(), type: 'effect', transformId: payload.transformId, timelineStart: currentTime, duration: 2.0 });
                         dropped = true;
                     }
                 }
             } else {
                 const dataStr = event.dataTransfer.getData('text/plain');
                 if (dataStr) {
                     const poolIds = JSON.parse(dataStr);
                     poolIds.forEach(id => {
                       const poolItem = currentTimeline.mediaPool.find(p => p.id === id);
                       if (poolItem) {
                         if (track.type === 'video' && (poolItem.type === 'video' || poolItem.type === 'image')) {
                           const duration = poolItem.meta?.duration || 4.0;
                            let dropTime = currentTime;
                            if (typeof timelineView !== 'undefined' && timelineView.isMagnetic) {
                               dropTime = currentTimeline.videoTrack.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
                            }
                            currentTimeline.videoTrack.push({ id: generateId(), poolId: id, timelineStart: dropTime, duration: duration, sourceStart: 0, transitionOut: null });
                            currentTime = dropTime;
                           currentTime += (typeof duration !== 'undefined' ? duration : 4.0);
                           dropped = true;
                         } else if (track.type === 'audio' && poolItem.type === 'audio') {
                           const t = currentTimeline.audioTracks.find(at => at.id === track.id);
                           if (t) {
                               const duration = poolItem.meta?.duration || 4.0;
                                let dropTime = currentTime;
                                if (typeof timelineView !== 'undefined' && timelineView.isMagnetic) {
                                   dropTime = t.blocks.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
                                }
                                t.blocks.push({ id: generateId(), poolId: id, timelineStart: dropTime, duration: duration, sourceStart: 0 });
                                currentTime = dropTime;
                               currentTime += (typeof duration !== 'undefined' ? duration : 4.0);
                               dropped = true;
                           }
                         }
                       }
                     });
                 }
             }
             
             if (dropped) {
                 await saveTimeline(currentTimeline, currentProjectDirHandle);
                 renderTimelineTracks();
                 renderFrame();
             }
           } catch(err) {}
        },
        onClipDrop: async (clipId) => {
           await saveTimeline(currentTimeline, currentProjectDirHandle);
           renderTimelineTracks();
        },
        onDeleteSelected: async () => {
           if (timelineView.selectedClips.size === 0) return;
           currentTimeline.videoTrack = currentTimeline.videoTrack.filter(c => !timelineView.selectedClips.has(c.id));
           currentTimeline.effectTracks.forEach(t => {
               t.blocks = t.blocks.filter(b => !timelineView.selectedClips.has(b.id));
           });
           currentTimeline.audioTracks.forEach(t => {
               t.blocks = t.blocks.filter(b => !timelineView.selectedClips.has(b.id));
           });
           timelineView.selectedClips.clear();
           selectedItemId = null;
           await saveTimeline(currentTimeline, currentProjectDirHandle);
           renderTimelineTracks();
           renderFrame();
        },
        onSplitClip: async () => {
          if (!selectedItemId) return;
          let splitHappened = false;

          if (selectedItemType === 'video') {
            const clipIndex = currentTimeline.videoTrack.findIndex(c => c.id === selectedItemId);
            if (clipIndex !== -1) {
              const clip = currentTimeline.videoTrack[clipIndex];
              if (playheadTime > clip.timelineStart && playheadTime < clip.timelineStart + clip.duration) {
                const splitOffset = playheadTime - clip.timelineStart;
                const newDuration2 = clip.duration - splitOffset;
                clip.duration = splitOffset;
                
                const newClip = {
                  ...clip,
                  id: generateId(),
                  timelineStart: playheadTime,
                  duration: newDuration2,
                  sourceStart: (clip.sourceStart || 0) + splitOffset
                };
                currentTimeline.videoTrack.splice(clipIndex + 1, 0, newClip);
                splitHappened = true;
              }
            }
          } else if (selectedItemType === 'fx') {
            currentTimeline.effectTracks.forEach(t => {
              const fxIndex = t.blocks.findIndex(b => b.id === selectedItemId);
              if (fxIndex !== -1) {
                const fx = t.blocks[fxIndex];
                if (playheadTime > fx.timelineStart && playheadTime < fx.timelineStart + fx.duration) {
                  const splitOffset = playheadTime - fx.timelineStart;
                  const newDuration2 = fx.duration - splitOffset;
                  fx.duration = splitOffset;
                  
                  const newFx = {
                    ...fx,
                    id: generateId(),
                    timelineStart: playheadTime,
                    duration: newDuration2
                  };
                  t.blocks.splice(fxIndex + 1, 0, newFx);
                  splitHappened = true;
                }
              }
            });
          } else if (selectedItemType === 'audio') {
            currentTimeline.audioTracks.forEach(t => {
              const aIndex = t.blocks.findIndex(b => b.id === selectedItemId);
              if (aIndex !== -1) {
                const clip = t.blocks[aIndex];
                if (playheadTime > clip.timelineStart && playheadTime < clip.timelineStart + clip.duration) {
                  const splitOffset = playheadTime - clip.timelineStart;
                  const newDuration2 = clip.duration - splitOffset;
                  clip.duration = splitOffset;
                  
                  const newClip = {
                    ...clip,
                    id: generateId(),
                    timelineStart: playheadTime,
                    duration: newDuration2,
                    sourceStart: (clip.sourceStart || 0) + splitOffset
                  };
                  t.blocks.splice(aIndex + 1, 0, newClip);
                  splitHappened = true;
                }
              }
            });
          }

          if (splitHappened) {
            selectedItemId = null;
            await saveTimeline(currentTimeline, currentProjectDirHandle);
            renderTimelineTracks();
            renderFrame();
          }
        },
        onZoom: (val) => {
          PIXELS_PER_SECOND = val;
        },
        onRenderTrackHeader: (track, element) => {
            let icon = 'movie';
            let toggleIcon = 'visibility';
            let trackClass = 'text-muted';
            
            if (track.type === 'effect') {
                icon = 'auto_awesome';
                trackClass = 'text-success';
            } else if (track.type === 'audio') {
                icon = 'music_note';
                toggleIcon = 'volume_up';
            }
            
            element.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm ${trackClass}">${icon}</span>
                        <span class="text-xs font-mono text-muted">${track.name}</span>
                    </div>
                    <div class="actions flex gap-1 items-center">
                        <span class="material-symbols-outlined text-muted tl-btn-toggle-track" style="font-size:14px; cursor:pointer;" title="Disable Track">visibility</span>
                        ${track.type !== 'video' ? `<span class="material-symbols-outlined text-muted tl-btn-delete-track" style="font-size:14px; cursor:pointer;" title="Delete Track">delete</span>` : ''}
                    </div>
                </div>
            `;
            
            const btnDel = element.querySelector('.tl-btn-delete-track');
            if (btnDel) {
                btnDel.onclick = async (e) => {
                    e.stopPropagation();
                    if (!(await showDialog({ title: 'Delete Track', message: `Delete track ${track.name}?` }))) return;
                    currentTimeline.audioTracks = currentTimeline.audioTracks.filter(t => t.id !== track.id);
                    currentTimeline.effectTracks = currentTimeline.effectTracks.filter(t => t.id !== track.id);
                    await saveTimeline(currentTimeline, currentProjectDirHandle);
                    renderTimelineTracks();
                    renderFrame();
                };
            }

            const btnToggle = element.querySelector('.tl-btn-toggle-track');
            if (btnToggle) {
                btnToggle.onclick = async (e) => {
                    e.stopPropagation();
                    if (track.type === 'video') {
                        currentTimeline.videoTrackDisabled = !currentTimeline.videoTrackDisabled;
                    } else if (track.type === 'audio') {
                        const at = currentTimeline.audioTracks.find(t => t.id === track.id);
                        if (at) at.disabled = !at.disabled;
                    } else if (track.type === 'effect') {
                        const et = currentTimeline.effectTracks.find(t => t.id === track.id);
                        if (et) et.disabled = !et.disabled;
                    }
                    await saveTimeline(currentTimeline, currentProjectDirHandle);
                    renderTimelineTracks();
                    renderFrame();
                };
                if (track.disabled) {
                    btnToggle.textContent = 'visibility_off';
                    element.style.opacity = '0.5';
                }
            }

            // Allow drag and drop into track header!
            element.addEventListener('dragover', e => {
                e.preventDefault();
                element.style.background = 'rgba(255,255,255,0.1)';
            });
            element.addEventListener('dragleave', e => {
                element.style.background = 'transparent';
            });
            element.addEventListener('drop', async e => {
                e.preventDefault();
                element.style.background = 'transparent';
                try {
                  const dataStr = e.dataTransfer.getData('text/plain');
                  if (!dataStr) return;
                  const poolIds = JSON.parse(dataStr);
                  
                  let currentTime = playheadTime;
                  let dropped = false;
                  
                  poolIds.forEach(id => {
                    const poolItem = currentTimeline.mediaPool.find(p => p.id === id);
                    if (!poolItem) return;
                    
                    const duration = poolItem.meta?.duration || 4.0;
                    if (track.type === 'video' && (poolItem.type === 'video' || poolItem.type === 'image')) {
                      let dropTime = currentTime;
                      if (timelineView && timelineView.isMagnetic) {
                         dropTime = currentTimeline.videoTrack.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
                      }
                      currentTimeline.videoTrack.push({ id: generateId(), poolId: id, timelineStart: dropTime, duration: duration, sourceStart: 0, transitionOut: null });
                      currentTime = dropTime + duration;
                      dropped = true;
                    } else if (track.type === 'audio' && poolItem.type === 'audio') {
                      const t = currentTimeline.audioTracks.find(at => at.id === track.id);
                      if (t) {
                          let dropTime = currentTime;
                          if (timelineView && timelineView.isMagnetic) {
                             dropTime = t.blocks.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
                          }
                          t.blocks.push({ id: generateId(), poolId: id, timelineStart: dropTime, duration: duration, sourceStart: 0 });
                          currentTime = dropTime + duration;
                          dropped = true;
                      }
                    }
                  });
                  
                  if (dropped) {
                      await saveTimeline(currentTimeline, currentProjectDirHandle);
                      renderTimelineTracks();
                      renderFrame();
                  }
                } catch(err) {}
            });
        },
        onRenderClip: (clip, element, track) => {
            const isSelected = timelineView.selectedClips.has(clip.id);
            
            if (isSelected) {
                element.style.border = '2px solid var(--ps-danger)';
            }
            if (track && track.type === 'effect') {
                const def = registry.get(clip.transformId);
                const labelText = def ? def.name : (clip.transformId || 'Effect');
                const labelDiv = document.createElement('div');
                labelDiv.textContent = labelText;
                labelDiv.style.position = 'absolute';
                labelDiv.style.top = '4px';
                labelDiv.style.left = '4px';
                labelDiv.style.zIndex = '15';
                labelDiv.style.color = '#fff';
                labelDiv.style.background = 'rgba(0,0,0,0.6)';
                labelDiv.style.padding = '2px 4px';
                labelDiv.style.borderRadius = '3px';
                labelDiv.style.pointerEvents = 'none';
                element.appendChild(labelDiv);
                
                if (clip.keyframes && clip.keyframes.length > 0) {
                    clip.keyframes.forEach(kf => {
                        const tick = document.createElement('div');
                        tick.style.position = 'absolute';
                        tick.style.top = '50%';
                        tick.style.width = '8px';
                        tick.style.height = '8px';
                        tick.style.background = '#fff';
                        tick.style.left = `${kf.offset * PIXELS_PER_SECOND}px`;
                        tick.style.transform = 'translate(-50%, -50%) rotate(45deg)';
                        tick.style.zIndex = '20';
                        element.appendChild(tick);
                    });
                }
            }
            
            element.style.overflow = 'hidden';
            element.style.display = 'flex';
            element.style.alignItems = 'center';
            element.style.padding = '0 4px';
            element.style.fontSize = '11px';
            
            // Add trim handles
            const leftHandle = document.createElement('div');
            leftHandle.style.position = 'absolute';
            leftHandle.style.left = '0';
            leftHandle.style.top = '0';
            leftHandle.style.bottom = '0';
            leftHandle.style.width = '8px';
            leftHandle.style.cursor = 'ew-resize';
            leftHandle.style.zIndex = '10';
            leftHandle.style.background = isSelected ? 'rgba(255,255,255,0.2)' : 'transparent';
            
            const rightHandle = document.createElement('div');
            rightHandle.style.position = 'absolute';
            rightHandle.style.right = '0';
            rightHandle.style.top = '0';
            rightHandle.style.bottom = '0';
            rightHandle.style.width = '8px';
            rightHandle.style.cursor = 'ew-resize';
            rightHandle.style.zIndex = '10';
            rightHandle.style.background = isSelected ? 'rgba(255,255,255,0.2)' : 'transparent';
            
            // Trim logic
            const setupTrim = (handle, isLeft) => {
                handle.addEventListener('mousedown', e => {
                    e.stopPropagation();
                    selectedItemId = clip.id;
                    renderTimelineTracks(); // select visually
                    
                    let startX = e.clientX;
                    let originalStart = clip.timelineStart;
                    let originalDuration = clip.duration;
                    let originalSourceStart = clip.sourceStart || 0;
                    
                    const onMouseMove = (moveEvent) => {
                        const deltaX = moveEvent.clientX - startX;
                        const deltaSec = deltaX / PIXELS_PER_SECOND;
                        
                        if (isLeft) {
                            let newStart = Math.max(0, originalStart + deltaSec);
                            let timeDiff = newStart - originalStart;
                            let newDuration = originalDuration - timeDiff;
                            
                            if (newDuration < 0.5) {
                                newDuration = 0.5;
                                newStart = originalStart + (originalDuration - 0.5);
                                timeDiff = newStart - originalStart;
                            }
                            clip.timelineStart = newStart;
                            clip.duration = newDuration;
                            if (clip.poolId) {
                                clip.sourceStart = Math.max(0, originalSourceStart + timeDiff);
                            }
                        } else {
                            clip.duration = Math.max(0.5, originalDuration + deltaSec);
                        }
                        
                        // Fast visual update
                        element.style.left = `${clip.timelineStart * PIXELS_PER_SECOND}px`;
                        element.style.width = `${clip.duration * PIXELS_PER_SECOND}px`;
                    };
                    
                    const onMouseUp = async () => {
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                        await saveTimeline(currentTimeline, currentProjectDirHandle);
                        renderTimelineTracks();
                        renderFrame();
                    };
                    
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                });
            };
            
            setupTrim(leftHandle, true);
            setupTrim(rightHandle, false);
            
            element.appendChild(leftHandle);
            element.appendChild(rightHandle);
            
            // Thumbnails for video
            if (clip.poolId) {
                const poolItem = currentTimeline.mediaPool.find(p => p.id === clip.poolId);
                if (poolItem && poolItem.type === 'video' && poolItem.thumbnail) {
                    element.style.backgroundImage = `url(${poolItem.thumbnail})`;
                    element.style.backgroundSize = 'cover';
                    element.style.backgroundPosition = 'center';
                    const overlay = document.createElement('div');
                    overlay.style.position = 'absolute';
                    overlay.style.inset = '0';
                    overlay.style.background = 'rgba(0,0,0,0.5)';
                    overlay.style.pointerEvents = 'none';
                    element.appendChild(overlay);
                }
            }
        }
      });
    }

    const tracks = [];
    
    // Video Track
    tracks.push({
        id: 'v1',
        name: 'V1 (Main)',
        type: 'video',
        color: '#3b82f6',
        clips: currentTimeline.videoTrack,
        disabled: currentTimeline.videoTrackDisabled
    });
    
    // Effect Tracks
    currentTimeline.effectTracks.forEach((t, i) => {
        tracks.push({
            id: t.id,
            name: t.name || `FX ${i+1}`,
            type: 'effect',
            color: '#10b981',
            clips: t.blocks,
            disabled: t.disabled
        });
    });
    
    // Audio Tracks
    currentTimeline.audioTracks.forEach((t, i) => {
        tracks.push({
            id: t.id,
            name: t.name || `A${i+1}`,
            type: 'audio',
            color: '#10b981',
            clips: t.blocks,
            disabled: t.disabled
        });
    });
    
    timelineView.setData(tracks);
    timelineView.setPlayhead(playheadTime, false);
  }

  const btnExport = container.querySelector('#tme-btn-export');
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      const maxTime = Math.max(
         ...currentTimeline.videoTrack.map(c => c.timelineStart + c.duration),
         ...currentTimeline.effectTracks.flatMap(t => t.blocks.map(b => b.timelineStart + b.duration)),
         0
      );
      if (maxTime === 0) { window.AuroraToast?.show({ variant: 'warning', title: 'Notice', description: "Timeline is empty!" }); return; }

      // Find the first video clip's resolution if available
      let defaultW = currentTimeline.width || 1920;
      let defaultH = currentTimeline.height || 1080;
      if (currentTimeline.videoTrack && currentTimeline.videoTrack.length > 0) {
        const firstClip = [...currentTimeline.videoTrack].sort((a,b) => a.timelineStart - b.timelineStart)[0];
        const poolItem = currentTimeline.mediaPool.find(m => m.id === firstClip.poolId);
        if (poolItem && poolItem.meta && poolItem.meta.width) {
          defaultW = poolItem.meta.width;
          defaultH = poolItem.meta.height;
        }
      }

      // Show custom dialog for settings
      const dialog = document.createElement('div');
      dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;color:#fff;font-family:Inter,sans-serif;';
      dialog.innerHTML = `
        <div style="background:var(--ps-bg-surface);border:1px solid var(--ps-border);border-radius:8px;padding:24px;width:320px;">
          <h3 style="margin-bottom:16px;">Export Settings</h3>
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;color:#a1a1aa;margin-bottom:4px;">Resolution (WxH)</label>
            <input type="text" id="tme-export-res" class="ic-input" value="${defaultW}x${defaultH}" style="width:100%; padding:8px; background:rgba(0,0,0,0.2); border:1px solid var(--ps-border); border-radius:4px; color:#fff;">
          </div>
          <div style="display:flex;gap:12px;margin-bottom:20px;">
            <div style="flex:1;">
              <label style="display:block;font-size:11px;color:#a1a1aa;margin-bottom:4px;">Start Time (s)</label>
              <input type="number" id="tme-export-start" class="ic-input" value="0" min="0" step="0.1" style="width:100%; padding:8px; background:rgba(0,0,0,0.2); border:1px solid var(--ps-border); border-radius:4px; color:#fff;">
            </div>
            <div style="flex:1;">
              <label style="display:block;font-size:11px;color:#a1a1aa;margin-bottom:4px;">End Time (s)</label>
              <input type="number" id="tme-export-end" class="ic-input" value="${maxTime.toFixed(1)}" min="0" step="0.1" style="width:100%; padding:8px; background:rgba(0,0,0,0.2); border:1px solid var(--ps-border); border-radius:4px; color:#fff;">
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button id="tme-export-cancel" class="btn-ghost" style="padding:8px 16px;">Cancel</button>
            <button id="tme-export-confirm" class="btn-primary" style="padding:8px 16px;">Export</button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);

      dialog.querySelector('#tme-export-cancel').onclick = () => document.body.removeChild(dialog);
      dialog.querySelector('#tme-export-confirm').onclick = async () => {
        const resStr = dialog.querySelector('#tme-export-res').value;
        const exportStart = parseFloat(dialog.querySelector('#tme-export-start').value) || 0;
        const exportEnd = parseFloat(dialog.querySelector('#tme-export-end').value) || maxTime;
        document.body.removeChild(dialog);

        const [parsedW, parsedH] = resStr.toLowerCase().split('x').map(s => parseInt(s.trim(), 10));
        if (!parsedW || !parsedH) { window.AuroraToast?.show({ variant: 'warning', title: 'Notice', description: "Invalid resolution format. Please use WxH (e.g. 1920x1080)." }); return; }
        if (exportStart >= exportEnd) { window.AuroraToast?.show({ variant: 'warning', title: 'Notice', description: "Start time must be before end time." }); return; }
        
        // Update canvas and timeline with new dimensions
        canvas.width = parsedW;
        canvas.height = parsedH;
        currentTimeline.width = parsedW;
        currentTimeline.height = parsedH;
        await saveTimeline(currentTimeline, currentProjectDirHandle);
        renderFrame();

        // Pause playback if it's currently running
        if (isPlaying) btnPlay.click();

        const fps = 30;
        const w = canvas.width % 2 === 0 ? canvas.width : canvas.width - 1;
        const h = canvas.height % 2 === 0 ? canvas.height : canvas.height - 1;

        let fileStream = null;
        try {
           const projectNameSafe = (currentTimeline.name || 'export').replace(/[^a-z0-9_\- ]/gi, '').trim().replace(/ +/g, '_').toLowerCase();
           const handle = await window.showSaveFilePicker({
              suggestedName: `${projectNameSafe}.mp4`,
              types: [{ description: 'MP4 Video', accept: {'video/mp4': ['.mp4']} }],
           });
           fileStream = await handle.createWritable();
        } catch(e) {
           return; // User cancelled save picker
        }

        let cancelExport = false;
        // Show progress modal
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:Inter, sans-serif;';
        modal.innerHTML = `
          <h2 style="margin-bottom:10px;">Exporting Video...</h2>
          <div id="tme-export-progress" style="color:#a1a1aa; margin-bottom:20px;">Preparing Audio Mix...</div>
          <button id="tme-btn-cancel-export" class="btn-secondary" style="border: 1px solid var(--ps-border); padding:8px 16px; border-radius:4px; background:rgba(0,0,0,0.3); color:#fff;">Cancel Export</button>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#tme-btn-cancel-export').addEventListener('click', () => {
          cancelExport = true;
          modal.innerHTML = `<h2>Cancelling...</h2>`;
        });

        try {
          const { Muxer, FileSystemWritableFileStreamTarget } = await import('mp4-muxer');
          const { avcCodec } = await import('../engine/video-convert.js');

          // Mix Audio
          const sampleRate = 44100;
          const exportDuration = exportEnd - exportStart;
          const offlineCtx = new window.OfflineAudioContext(2, Math.max(1, Math.ceil(sampleRate * exportDuration)), sampleRate);
          const allClips = [
            ...currentTimeline.audioTracks.flatMap(t => t.blocks),
            ...currentTimeline.videoTrack
          ];
          for (const clip of allClips) {
            if (cancelExport) break;
            
            // Calculate overlap between clip and export window
            const clipEnd = clip.timelineStart + clip.duration;
            if (clipEnd <= exportStart || clip.timelineStart >= exportEnd) continue; // Outside export window

            const poolItem = currentTimeline.mediaPool.find(p => p.id === clip.poolId);
            if (poolItem && poolItem.fileHandle) {
               try {
                 const file = poolItem.fileHandle.getFile ? await poolItem.fileHandle.getFile() : poolItem.fileHandle;
                 const arrayBuffer = await file.arrayBuffer();
                 const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
                 const source = offlineCtx.createBufferSource();
                 source.buffer = audioBuffer;
                 source.connect(offlineCtx.destination);
                 
                 // Determine start time relative to the export window
                 const startOffsetInExport = Math.max(0, clip.timelineStart - exportStart);
                 const startOffsetInClip = Math.max(0, exportStart - clip.timelineStart);
                 const playDuration = Math.min(
                   clip.duration - startOffsetInClip,
                   exportEnd - Math.max(exportStart, clip.timelineStart)
                 );
                 
                 source.start(
                   startOffsetInExport, 
                   (clip.sourceStart || 0) + startOffsetInClip, 
                   Math.min(playDuration, audioBuffer.duration - ((clip.sourceStart || 0) + startOffsetInClip))
                 );
               } catch(err) { /* Might be an image or silent video */ }
            }
          }
          
          let renderedAudio = null;
          if (!cancelExport) {
            renderedAudio = await offlineCtx.startRendering();
          }

          const target = new FileSystemWritableFileStreamTarget(fileStream);
          const muxer  = new Muxer({ 
            target, 
            video: { codec: 'avc', width: w, height: h }, 
            audio: { codec: 'aac', sampleRate: 44100, numberOfChannels: 2 },
            fastStart: false 
          });

          await new Promise((resolve, reject) => {
            if (cancelExport) return reject(new Error('Cancelled'));

            const videoEncoder = new VideoEncoder({
              output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
              error: err => reject(new Error(`VideoEncoder: ${err.message}`)),
            });
            videoEncoder.configure({ codec: avcCodec(w, h), width: w, height: h, bitrate: 6_000_000, framerate: fps });

            const audioEncoder = new AudioEncoder({
              output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
              error: err => reject(new Error(`AudioEncoder: ${err.message}`)),
            });
            audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 128_000 });

            const totalFrames = Math.ceil(exportDuration * fps);
            
            (async () => {
              try {
                // 1. Encode Audio
                if (renderedAudio) {
                  const channelData = [];
                  for (let c=0; c<renderedAudio.numberOfChannels; c++) {
                      channelData.push(renderedAudio.getChannelData(c));
                  }
                  const chunkSize = 44100; // 1 second chunks
                  const totalSamples = renderedAudio.length;
                  let currentSample = 0;

                  while (currentSample < totalSamples && !cancelExport) {
                     const size = Math.min(chunkSize, totalSamples - currentSample);
                     const planarData = new Float32Array(size * 2);
                     planarData.set(channelData[0].subarray(currentSample, currentSample + size), 0); // Ch 1
                     if (renderedAudio.numberOfChannels > 1) {
                       planarData.set(channelData[1].subarray(currentSample, currentSample + size), size); // Ch 2
                     } else {
                       planarData.set(channelData[0].subarray(currentSample, currentSample + size), size); // Duplicate Ch 1
                     }

                     const audioData = new AudioData({
                        format: 'f32-planar',
                        sampleRate: 44100,
                        numberOfFrames: size,
                        numberOfChannels: 2,
                        timestamp: (currentSample / 44100) * 1_000_000,
                        data: planarData
                     });

                     audioEncoder.encode(audioData);
                     audioData.close();
                     currentSample += size;
                     
                     modal.querySelector('#tme-export-progress').innerText = `Encoding Audio ${Math.round((currentSample/totalSamples)*100)}%`;
                     await new Promise(r => setTimeout(r, 0));
                  }
                  await audioEncoder.flush();
                  audioEncoder.close();
                }

                if (cancelExport) return reject(new Error('Cancelled'));

                // 2. Encode Video
                for (let fi = 0; fi < totalFrames; fi++) {
                  if (cancelExport) {
                    reject(new Error('Cancelled'));
                    break;
                  }
                  // Advance playhead manually for export loop (relative to exportStart)
                  playheadTime = exportStart + (fi / fps);
                  await renderFrame(); 

                  const vf = new VideoFrame(canvas, { timestamp: fi * (1_000_000 / fps) });
                  videoEncoder.encode(vf, { keyFrame: fi % 30 === 0 });
                  vf.close();

                  // Yield to UI to show progress
                  if (fi % 5 === 0) {
                    modal.querySelector('#tme-export-progress').innerText = `Rendering Frame ${fi} / ${totalFrames} (${Math.round((fi/totalFrames)*100)}%)`;
                    await new Promise(r => setTimeout(r, 0));
                  }
                }
                if (!cancelExport) {
                  await videoEncoder.flush();
                  videoEncoder.close();
                  resolve();
                }
              } catch (err) {
                reject(err);
              }
            })();
          });

          muxer.finalize();
          await fileStream.close();
          
          modal.innerHTML = `
            <div style="text-align:center;">
              <span class="material-symbols-outlined" style="font-size:48px; color:var(--ps-green); margin-bottom:10px;">check_circle</span>
              <h2>Export Complete</h2>
              <button onclick="this.parentElement.parentElement.remove()" class="btn-secondary" style="margin-top:20px; padding:8px 16px; border-radius:4px; background:rgba(255,255,255,0.1); color:#fff; border:none; cursor:pointer;">Close</button>
            </div>
          `;
        } catch (err) {
          if (fileStream) await fileStream.close().catch(()=>{});
          if (err.message === 'Cancelled') {
            modal.remove();
          } else {
            modal.innerHTML = `
              <div style="text-align:center; padding: 20px;">
                <span class="material-symbols-outlined" style="font-size:48px; color:var(--ps-danger); margin-bottom:10px;">error</span>
                <h2 style="color:var(--ps-danger); margin-bottom: 10px;">Export Failed</h2>
                <p style="color:#a1a1aa; max-width:400px; text-align:center; margin-bottom:20px;">${err.message}</p>
                <button onclick="this.parentElement.parentElement.remove()" style="padding:10px 24px; background:var(--ps-surface); border:1px solid #444; border-radius:6px; color:white; cursor:pointer;">Close</button>
              </div>
            `;
            console.error(err);
          }
        }
      };
    });
  }

  // ─── Import Media ───────────────────────────────────────

  const fsaPanelEl = container.querySelector('#tme-fsa-browser-panel');
  let fsaBrowserInstance = null;
  
  if (btnImportFolder) {
    btnImportFolder.innerHTML = '<span class="material-symbols-outlined" style="font-size: 20px;">folder_special</span>';
    btnImportFolder.title = 'Asset Browser';
    
    btnImportFolder.addEventListener('click', () => {
      fsaPanelEl.style.display = fsaPanelEl.style.display === 'none' ? 'flex' : 'none';
      if (!fsaBrowserInstance && fsaPanelEl.style.display === 'flex') {
         fsaBrowserInstance = new FsaBrowser(fsaPanelEl, {
            onClose: () => { fsaPanelEl.style.display = 'none'; },
            onImportMedia: async (fileHandle) => {
               try {
                 const file = await fileHandle.getFile();
                 const type = file.type.startsWith('video') ? 'video' : (file.type.startsWith('audio') ? 'audio' : 'image');
                 let thumbnail = null;
                 let meta = await extractMediaMeta(file, type);
                 
                 if (type === 'image') { thumbnail = URL.createObjectURL(file); }
                 else if (type === 'video') { thumbnail = await extractVideoThumbnail(file); }
                 
                 const filename = await importMediaToProject(fileHandle, currentProjectDirHandle);
                 currentTimeline.mediaPool = currentTimeline.mediaPool || [];
                 currentTimeline.mediaPool.push({
                   id: generateId(),
                   type,
                   name: fileHandle.name,
                   filename,
                   fileHandle: fileHandle,
                   thumbnail,
                   meta
                 });
                 await saveTimeline(currentTimeline, currentProjectDirHandle);
                 renderMediaPool();
                 window.AuroraToast?.show({ variant: 'success', title: 'Asset Imported', description: fileHandle.name });
               } catch (err) {
                 console.error('Error importing from Asset Browser:', err);
                 window.AuroraToast?.show({ variant: 'error', title: 'Import Failed', description: 'Failed to import asset: ' + err.message });
               }
            },
            onImportMediaBatch: async (fileHandles) => {
               try {
                 let count = 0;
                 for (const fileHandle of fileHandles) {
                   const file = await fileHandle.getFile();
                   const type = file.type.startsWith('video') ? 'video' : (file.type.startsWith('audio') ? 'audio' : 'image');
                   let thumbnail = null;
                   let meta = await extractMediaMeta(file, type);
                   
                   if (type === 'image') { thumbnail = URL.createObjectURL(file); }
                   else if (type === 'video') { thumbnail = await extractVideoThumbnail(file); }
                   
                   const filename = await importMediaToProject(fileHandle, currentProjectDirHandle);
                   currentTimeline.mediaPool = currentTimeline.mediaPool || [];
                   currentTimeline.mediaPool.push({
                     id: generateId(),
                     type,
                     name: fileHandle.name,
                     filename,
                     fileHandle: fileHandle,
                     thumbnail,
                     meta
                   });
                   count++;
                 }
                 await saveTimeline(currentTimeline, currentProjectDirHandle);
                 renderMediaPool();
                 window.AuroraToast?.show({ variant: 'success', title: 'Batch Import Complete', description: `Imported ${count} assets` });
               } catch (err) {
                 console.error('Error importing batch from Asset Browser:', err);
                 window.AuroraToast?.show({ variant: 'error', title: 'Import Failed', description: 'Failed to import some assets: ' + err.message });
               }
            }
         });
      }
    });
  }

  btnAddMedia.addEventListener('click', async () => {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{
          description: 'Images, Video, and Audio',
          accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
            'video/*': ['.mp4', '.webm'],
            'audio/*': ['.mp3', '.wav', '.m4a']
          }
        }]
      });

      for (const handle of handles) {
        const file = await handle.getFile();
        let type = 'image';
        if (file.type.startsWith('video')) type = 'video';
        if (file.type.startsWith('audio')) type = 'audio';
        
        let thumbnail = '';
        let meta = await extractMediaMeta(file, type);
        
        if (type === 'image') {
          thumbnail = URL.createObjectURL(file);
        } else if (type === 'video') {
          thumbnail = await extractVideoThumbnail(file);
        }

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
      if (err.name !== 'AbortError') {
        console.error('Failed to import media', err);
      }
    }
  });

  // ─── Drag & Drop to Import ──────────────────────────────
  poolContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    poolContainer.style.background = 'var(--ps-bg-raised)';
  });

  poolContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    poolContainer.style.background = 'transparent';
  });

  poolContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    poolContainer.style.background = 'transparent';

    const items = e.dataTransfer.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        // Skip non-media
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) continue;
        
        let handle = null;
        if ('getAsFileSystemHandle' in item) {
          handle = await item.getAsFileSystemHandle();
        } else {
          // fallback, won't persist across reloads
          handle = file;
        }

        let type = 'image';
        if (file.type.startsWith('video')) type = 'video';
        if (file.type.startsWith('audio')) type = 'audio';
        let thumbnail = '';
        let meta = await extractMediaMeta(file, type);

        if (type === 'image') {
          thumbnail = URL.createObjectURL(file);
        } else if (type === 'video') {
          thumbnail = await extractVideoThumbnail(file);
        }

        const filename = await importMediaToProject(handle, currentProjectDirHandle);
        currentTimeline.mediaPool.push({
          id: generateId(),
          fileHandle: handle,
          filename,
          type,
          name: file.name,
          thumbnail,
          meta
        });
      }
    }
    await saveTimeline(currentTimeline, currentProjectDirHandle);
    renderMediaPool();
  });


  // ─── Playback & Preview Engine ──────────────────────────
  const canvas = container.querySelector('#tme-player-canvas');
  const ctx = canvas.getContext('2d');
  const btnPlay = container.querySelector('#tme-btn-play');
  const timecodeEl = container.querySelector('#tme-timecode');
  const playheadLine = container.querySelector('#tme-playhead');
  
  let isPlaying = false;
  let playheadTime = 0; // seconds
  let lastFrameTime = 0;
  let animFrameId = null;

  // Set canvas size from timeline
  canvas.width = currentTimeline.width;
  canvas.height = currentTimeline.height;

  function formatTimecode(seconds) {
    const d = new Date(seconds * 1000);
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    const s = d.getUTCSeconds().toString().padStart(2, '0');
    const ms = Math.floor(d.getUTCMilliseconds() / 10).toString().padStart(2, '0');
    return `${m}:${s}:${ms}`;
  }

  const activeAudioPlayers = new Map();

  function syncAudioPlayback() {
    const activeIds = new Set();
    const activeClips = [
      ...(currentTimeline.audioTracks?.filter(t => !t.disabled).flatMap(t => t.blocks) || []),
      ...(currentTimeline.videoTrackDisabled ? [] : currentTimeline.videoTrack)
    ].filter(c => playheadTime >= c.timelineStart && playheadTime < c.timelineStart + c.duration);

    if (isPlaying) {
      activeClips.forEach(clip => {
        activeIds.add(clip.id);
        if (!activeAudioPlayers.has(clip.id)) {
           const poolItem = currentTimeline.mediaPool.find(p => p.id === clip.poolId);
           if (poolItem && poolItem.fileHandle) {
               poolItem.fileHandle.getFile ? poolItem.fileHandle.getFile().then(file => playAudio(clip, file)) : playAudio(clip, poolItem.fileHandle);
           }
        } else {
           const audio = activeAudioPlayers.get(clip.id);
           const targetTime = playheadTime - clip.timelineStart + (clip.sourceStart || 0);
           if (Math.abs(audio.currentTime - targetTime) > 0.15) {
               audio.currentTime = targetTime;
           }
           if (audio.paused) audio.play().catch(e => {});
           
           const targetVol = clip.volume !== undefined ? clip.volume : 1;
           if (audio.volume !== targetVol) audio.volume = targetVol;
        }
      });
    }

    for (const [id, audio] of activeAudioPlayers.entries()) {
      if (!activeIds.has(id) || !isPlaying) {
         audio.pause();
         URL.revokeObjectURL(audio.src);
         activeAudioPlayers.delete(id);
      }
    }
  }

  function playAudio(clip, file) {
      const audio = new Audio(URL.createObjectURL(file));
      audio.currentTime = playheadTime - clip.timelineStart + (clip.sourceStart || 0);
      audio.volume = clip.volume !== undefined ? clip.volume : 1;
      audio.play().catch(e => {});
      activeAudioPlayers.set(clip.id, audio);
  }

  function updatePlayheadUI() {
    if (timelineView) timelineView.setPlayhead(playheadTime, false);
    timecodeEl.textContent = formatTimecode(playheadTime);
    syncAudioPlayback();

    const btnAddKeyframe = container.querySelector('#tme-btn-add-keyframe');
    if (btnAddKeyframe) {
      let isInsideActiveFx = false;
      if (selectedItemId && selectedItemType === 'fx') {
        let fxBlock = null;
        currentTimeline.effectTracks.forEach(t => {
          const b = t.blocks.find(blk => blk.id === selectedItemId);
          if (b) fxBlock = b;
        });
        if (fxBlock) {
          const offset = playheadTime - fxBlock.timelineStart;
          if (offset >= -0.01 && offset <= fxBlock.duration + 0.01) {
            isInsideActiveFx = true;
          }
        }
      }
      btnAddKeyframe.disabled = !isInsideActiveFx;
      btnAddKeyframe.style.opacity = isInsideActiveFx ? '1' : '0.5';
    }
  }

  const imageCache = new Map();
  const videoCache = new Map();

  async function loadVideoFrameAtTime(poolItem, time) {
    let videoObj = videoCache.get(poolItem.id);
    if (!videoObj) {
      let file;
      try {
        file = poolItem.fileHandle.getFile ? await poolItem.fileHandle.getFile() : poolItem.fileHandle;
      } catch(e) {
        return null;
      }
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.crossOrigin = 'anonymous';
      videoObj = { video };
      videoCache.set(poolItem.id, videoObj);
      
      // Wait for metadata to load so seeking works reliably
      await new Promise(r => {
        video.onloadedmetadata = r;
        video.onerror = r;
      });
    }
    
    const { video } = videoObj;
    
    return new Promise((resolve) => {
      if (Math.abs(video.currentTime - time) < 0.05) {
        return resolve(video);
      }
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve(video);
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
  }

  async function loadFrame(activeClip, timeOverride = null) {
    const item = currentTimeline.mediaPool.find(p => p.id === activeClip.poolId);
    if (!item) return null;
    
    if (item.type === 'image') {
      if (imageCache.has(item.id)) return imageCache.get(item.id);
      return new Promise(async (resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imageCache.set(item.id, img);
          resolve(img);
        };
        img.onerror = () => resolve(null);
        
        let file;
        try { file = item.fileHandle.getFile ? await item.fileHandle.getFile() : item.fileHandle; } catch(e){}
        img.src = file ? URL.createObjectURL(file) : item.thumbnail; 
      });
    } else if (item.type === 'video') {
      const pTime = timeOverride !== null ? timeOverride : playheadTime;
      const clipTime = Math.max(0, pTime - activeClip.timelineStart + (activeClip.sourceStart || 0));
      return loadVideoFrameAtTime(item, clipTime);
    }
    return null;
  }

  function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    return [r, g, b];
  }

  function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
  }

  function interpolateValue(val1, val2, t) {
    if (typeof val1 === 'number' && typeof val2 === 'number') {
      return val1 + (val2 - val1) * t;
    }
    if (typeof val1 === 'string' && typeof val2 === 'string' && val1.startsWith('#') && val2.startsWith('#')) {
      const [r1, g1, b1] = hexToRgb(val1);
      const [r2, g2, b2] = hexToRgb(val2);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return rgbToHex(r, g, b);
    }
    return t < 0.5 ? val1 : val2;
  }

  function getInterpolatedParams(fxBlock, playheadTime) {
    let baseParams = {};
    if (!Array.isArray(fxBlock.keyframes) || fxBlock.keyframes.length === 0) {
      baseParams = { ...(fxBlock.params || {}) };
    } else {
      const offset = playheadTime - fxBlock.timelineStart;
      
      let kfBefore = null;
      let kfAfter = null;
      
      for (const kf of fxBlock.keyframes) {
        if (kf.offset <= offset) {
          if (!kfBefore || kf.offset > kfBefore.offset) kfBefore = kf;
        }
        if (kf.offset >= offset) {
          if (!kfAfter || kf.offset < kfAfter.offset) kfAfter = kf;
        }
      }
      
      if (!kfBefore && !kfAfter) {
         baseParams = { ...(fxBlock.params || {}) };
      } else if (!kfBefore) {
         baseParams = { ...kfAfter.params };
      } else if (!kfAfter) {
         baseParams = { ...kfBefore.params };
      } else if (kfBefore.offset === kfAfter.offset) {
         baseParams = { ...kfBefore.params };
      } else {
        const t = (offset - kfBefore.offset) / (kfAfter.offset - kfBefore.offset);
        const allKeys = new Set([...Object.keys(kfBefore.params), ...Object.keys(kfAfter.params)]);
        
        for (const key of allKeys) {
          const v1 = kfBefore.params[key];
          const v2 = kfAfter.params[key];
          if (v1 === undefined) baseParams[key] = v2;
          else if (v2 === undefined) baseParams[key] = v1;
          else baseParams[key] = interpolateValue(v1, v2, t);
        }
      }
    }

    // Apply Behaviors
    if (fxBlock.behaviors) {
      const timeContext = playheadTime - fxBlock.timelineStart; // Use relative time to the block
      for (const [pName, bData] of Object.entries(fxBlock.behaviors)) {
        if (baseParams[pName] !== undefined && typeof baseParams[pName] === 'number') {
          baseParams[pName] = applyBehavior(bData, baseParams[pName], timeContext);
        }
      }
    }

    return baseParams;
  }

  let compositor = null;

  async function renderFrame() {
    if (canvas.width === 0 || canvas.height === 0) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = '#000';
    tempCtx.fillRect(0, 0, canvas.width, canvas.height);

    if (!compositor && canvas.width > 0 && canvas.height > 0) {
      compositor = new WebGLCompositor(canvas.width, canvas.height);
    }

    function drawSourceToCtx(frameSource, targetCtx) {
      const sourceW = frameSource.videoWidth || frameSource.width;
      const sourceH = frameSource.videoHeight || frameSource.height;
      const scale = Math.max(canvas.width / sourceW, canvas.height / sourceH);
      const x = (canvas.width / 2) - (sourceW / 2) * scale;
      const y = (canvas.height / 2) - (sourceH / 2) * scale;
      targetCtx.drawImage(frameSource, x, y, sourceW * scale, sourceH * scale);
    }

    // --- 1. VIDEO RENDERING ---
    if (!currentTimeline.videoTrackDisabled) {
      const activeClipIdx = currentTimeline.videoTrack.findIndex(c => 
        playheadTime >= c.timelineStart && playheadTime < c.timelineStart + c.duration
      );

      if (activeClipIdx !== -1) {
        const activeClip = currentTimeline.videoTrack[activeClipIdx];
        const tIn = activeClip.transitionIn || { style: 'none', duration: 0 };
        const tOut = activeClip.transitionOut || { style: 'none', duration: 0 };
        
        const isTransIn = tIn.style !== 'none' && tIn.duration > 0 && playheadTime < activeClip.timelineStart + tIn.duration;
        const isTransOut = tOut.style !== 'none' && tOut.duration > 0 && playheadTime >= (activeClip.timelineStart + activeClip.duration) - tOut.duration;

        if (compositor && (isTransIn || isTransOut)) {
          let progress = 0;
          let style = 'none';
          let fromClip = null;
          let toClip = null;

          if (isTransIn) {
            progress = (playheadTime - activeClip.timelineStart) / tIn.duration;
            style = tIn.style;
            toClip = activeClip;
            fromClip = activeClipIdx > 0 ? currentTimeline.videoTrack[activeClipIdx - 1] : null;
          } else {
            progress = (playheadTime - ((activeClip.timelineStart + activeClip.duration) - tOut.duration)) / tOut.duration;
            style = tOut.style;
            fromClip = activeClip;
            toClip = activeClipIdx < currentTimeline.videoTrack.length - 1 ? currentTimeline.videoTrack[activeClipIdx + 1] : null;
          }

          const toFrameSrc = toClip ? await loadFrame(toClip, isTransOut ? toClip.timelineStart : playheadTime) : null;
          const fromFrameSrc = fromClip ? await loadFrame(fromClip, isTransIn ? fromClip.timelineStart + fromClip.duration : playheadTime) : null;
          
          let toBmp = null, fromBmp = null;
          let toTex = null, fromTex = null;

          if (toFrameSrc) {
             const tempC = new OffscreenCanvas(canvas.width, canvas.height);
             const tempCtx = tempC.getContext('2d');
             drawSourceToCtx(toFrameSrc, tempCtx);
             try { toBmp = await createImageBitmap(tempC); } catch(e) {}
             toTex = compositor.createTexture(toBmp || null);
          }
          if (fromFrameSrc) {
             const tempC = new OffscreenCanvas(canvas.width, canvas.height);
             const tempCtx = tempC.getContext('2d');
             drawSourceToCtx(fromFrameSrc, tempCtx);
             try { fromBmp = await createImageBitmap(tempC); } catch(e) {}
             fromTex = compositor.createTexture(fromBmp || null);
          }

          compositor.renderFrame({
            programName: style,
            fromTex,
            toTex,
            progress,
            fromMotion: null,
            toMotion: null
          });

          tempCtx.drawImage(compositor.canvas, 0, 0, canvas.width, canvas.height);

          if (toTex) compositor.gl.deleteTexture(toTex);
          if (fromTex) compositor.gl.deleteTexture(fromTex);
          if (toBmp) toBmp.close();
          if (fromBmp) fromBmp.close();
        } else {
          const frameSource = await loadFrame(activeClip);
          if (frameSource) {
            drawSourceToCtx(frameSource, tempCtx);
          }
        }
      }
    }

    // --- 2. EFFECT RENDERING ---
    const activeFx = currentTimeline.effectTracks
      .filter(t => !t.disabled)
      .flatMap(t => t.blocks)
      .filter(fx => playheadTime >= fx.timelineStart && playheadTime < fx.timelineStart + fx.duration);

    for (const fx of activeFx) {
      const def = registry.get(fx.transformId);
      if (def) {
        try {
          const context = { timestampSec: playheadTime };
          const interpParams = getInterpolatedParams(fx, playheadTime);

          const tIn = fx.transitionIn || { style: 'none', duration: 0 };
          const tOut = fx.transitionOut || { style: 'none', duration: 0 };
          const isTransIn = tIn.style !== 'none' && tIn.duration > 0 && playheadTime < fx.timelineStart + tIn.duration;
          const isTransOut = tOut.style !== 'none' && tOut.duration > 0 && playheadTime >= (fx.timelineStart + fx.duration) - tOut.duration;

          if (compositor && (isTransIn || isTransOut)) {
            // Render effect to isolated canvas
            const fxCanvas = new OffscreenCanvas(canvas.width, canvas.height);
            const fxCtx = fxCanvas.getContext('2d');
            
            if (def.applyPerFrame) await def.applyPerFrame(fxCtx, interpParams, context);
            else if (def.apply) await def.apply(fxCtx, interpParams, context);

            const style = isTransIn ? tIn.style : tOut.style;
            const progress = isTransIn 
              ? (playheadTime - fx.timelineStart) / tIn.duration 
              : (playheadTime - ((fx.timelineStart + fx.duration) - tOut.duration)) / tOut.duration;

            let fxBmp = null;
            try {
              fxBmp = await createImageBitmap(fxCanvas);
            } catch (e) {
              // Ignore untouched/empty canvas errors
            }
            const fxTex = compositor.createTexture(fxBmp || null);
            
            // Empty transparent texture
            const emptyTex = compositor.createTexture(null);

            const fromTex = isTransIn ? emptyTex : fxTex;
            const toTex = isTransIn ? fxTex : emptyTex;
            
            compositor.renderFrame({
              programName: style,
              fromTex,
              toTex,
              progress,
              fromMotion: null,
              toMotion: null
            });

            tempCtx.drawImage(compositor.canvas, 0, 0);

            compositor.gl.deleteTexture(fxTex);
            compositor.gl.deleteTexture(emptyTex);
            if (fxBmp) fxBmp.close();
          } else {
            // Normal direct render
            if (def.applyPerFrame) {
              await def.applyPerFrame(tempCtx, interpParams, context);
            } else if (def.apply) {
              await def.apply(tempCtx, interpParams, context);
            }
          }
        } catch (err) {
          console.warn(`Effect ${fx.transformId} failed during preview:`, err);
        }
      }
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
  }

  async function loop(timestamp) {
    if (!isPlaying) return;
    
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    playheadTime += dt;
    
    // Auto stop if we pass the end of the last clip or effect
    let maxTime = currentTimeline.videoTrack.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
    if (currentTimeline.effectTracks) {
      currentTimeline.effectTracks.forEach(t => {
        maxTime = t.blocks.reduce((max, fx) => Math.max(max, fx.timelineStart + fx.duration), maxTime);
      });
    }
    if (currentTimeline.audioTracks) {
      currentTimeline.audioTracks.forEach(t => {
        maxTime = t.blocks.reduce((max, au) => Math.max(max, au.timelineStart + au.duration), maxTime);
      });
    }

    if (playheadTime > maxTime && maxTime > 0) {
      playheadTime = 0; // loop back to start
    }

    updatePlayheadUI();
    await renderFrame();

    animFrameId = requestAnimationFrame(loop);
  }

  container.addEventListener('click', async (e) => {
    // Other container clicks if any, or empty it.
  });

  btnPlay.addEventListener('click', () => {
    isPlaying = !isPlaying;
    const btnPlayTimeline = container.querySelector('#tme-btn-play-timeline');
    if (isPlaying) {
      btnPlay.innerHTML = '<span class="material-symbols-outlined">pause</span>';
      if (btnPlayTimeline) btnPlayTimeline.innerHTML = '<span class="material-symbols-outlined" style="font-size: 22px;">pause</span>';
      lastFrameTime = 0;
      animFrameId = requestAnimationFrame(loop);
    } else {
      btnPlay.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      if (btnPlayTimeline) btnPlayTimeline.innerHTML = '<span class="material-symbols-outlined" style="font-size: 22px;">play_arrow</span>';
      if (animFrameId) cancelAnimationFrame(animFrameId);
      syncAudioPlayback();
    }
  });

  // Render first frame on load
  setTimeout(renderFrame, 500);

  // ─── Initial Render ───────────────────────────────────────
  renderMediaPool();
  renderEffectsPool();
  renderTimelineTracks();
  updatePlayheadUI();

  const btnSave = container.querySelector('#tme-btn-save');
  const btnOpen = container.querySelector('#tme-btn-open');
  const btnNew = container.querySelector('#tme-btn-new');
  const projectNameEl = container.querySelector('#tme-project-name');

  if (projectNameEl) {
    projectNameEl.addEventListener('blur', async () => {
      const newName = projectNameEl.textContent.trim() || 'Untitled Project';
      projectNameEl.textContent = newName;
      currentTimeline.name = newName;
      currentTimeline.title = newName;
      await saveTimeline(currentTimeline, currentProjectDirHandle);
    });
    projectNameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        projectNameEl.blur();
      }
    });
  }

  if (btnNew) {
    btnNew.addEventListener('click', async () => {
      if (await showDialog({ title: 'New Project', message: 'Create a new project? Any unsaved changes will be lost.' })) {
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
          await addRecentProject('video', dirHandle, currentTimeline);
          render(container);
        }
      }
    });
  }
  
  if (btnOpen) {
    btnOpen.addEventListener('click', async () => {
       if (!(await showDialog({ title: 'Open Project', message: 'Close current project to open another? Unsaved changes will be lost.' }))) return;
       
       if (isPlaying) {
         isPlaying = false;
         btnPlay.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
         if (animFrameId) cancelAnimationFrame(animFrameId);
         if (typeof syncAudioPlayback === 'function') syncAudioPlayback();
       }
       
       currentTimeline = null;
       currentProjectDirHandle = null;
       render(container);
    });
  }

  if (projectNameEl) {
    projectNameEl.addEventListener('blur', async () => {
      currentTimeline.name = projectNameEl.textContent.trim() || 'Untitled Project';
      await saveTimeline(currentTimeline, currentProjectDirHandle);
    });
    projectNameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); projectNameEl.blur(); }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      await saveTimeline(currentTimeline, currentProjectDirHandle);
      window.AuroraToast?.show({ variant: 'success', title: 'Project Saved' });
    });
  }

  return () => {
    document.removeEventListener('keydown', handleGlobalKeyDown);
    isPlaying = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
  };
}

async function extractMediaMeta(file, type) {
  let meta = { size: file.size, lastModified: file.lastModified };
  if (type === 'image') {
    try {
      const bmp = await createImageBitmap(file);
      meta.width = bmp.width;
      meta.height = bmp.height;
      bmp.close();
    } catch(e) {}
  } else if (type === 'video') {
    await new Promise(res => {
      const v = document.createElement('video');
      v.src = URL.createObjectURL(file);
      v.onloadedmetadata = () => {
         meta.width = v.videoWidth;
         meta.height = v.videoHeight;
         meta.duration = v.duration;
         URL.revokeObjectURL(v.src);
         res();
      };
      v.onerror = () => { URL.revokeObjectURL(v.src); res(); };
    });
  } else if (type === 'audio') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      meta.duration = decodedBuffer.duration;
      ctx.close();
    } catch(e) {
      console.warn("Failed to extract exact audio duration:", e);
    }
  }
  return meta;
}

async function extractVideoThumbnail(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.crossOrigin = 'anonymous';
    
    video.onloadeddata = () => {
      video.currentTime = Math.min(1.0, video.duration / 2); // grab a frame slightly into the video
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      // Scale down for thumbnail
      const aspect = video.videoWidth / video.videoHeight;
      canvas.height = 100;
      canvas.width = 100 * aspect;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(video.src);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    video.onerror = () => {
      resolve(''); // fallback empty
    };
  });
}
