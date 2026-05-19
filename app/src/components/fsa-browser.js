import { MediaBrowser } from './media-browser.js';
import { dbGet, dbPut } from '../data/db.js';
import { verifyPermission } from '../utils/project-io.js';

export class FsaBrowser {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      onImportMedia: async (fileHandle) => {},
      onImportMediaBatch: async (fileHandles) => {},
      onClose: () => {}
    }, options);
    
    this.currentHandle = null;
    this.pathStack = []; // Stack of { handle, name }
    this.recentLocations = [];
    
    this.initDOM();
    this.loadRecentLocations().then(() => {
      if (this.recentLocations.length > 0) {
        this.openLocation(this.recentLocations[0].handle, this.recentLocations[0].name);
      }
    });
  }

  initDOM() {
    this.container.innerHTML = `
      <div style="display:flex; flex-direction:column; height: 100%; width: 100%; background: var(--ps-bg-surface); border-left: 1px solid var(--ps-border);">
         <div style="display:flex; align-items:center; justify-content:space-between; padding: 12px; border-bottom: 1px solid var(--ps-border); background: var(--ps-surface);">
            <div style="display:flex; align-items:center; gap: 8px;">
               <span class="material-symbols-outlined">folder_special</span>
               <h3 style="margin:0; font-size:14px; font-weight:600;">Asset Browser</h3>
            </div>
            <button class="btn-ghost text-muted hover:text-white" id="fsa-btn-close" style="padding:4px;"><span class="material-symbols-outlined text-[18px]">close</span></button>
         </div>
         <div style="display:flex; align-items:center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--ps-border); flex-wrap: wrap;">
            <select id="fsa-recent-select" class="input-field flex-1" style="font-size:12px; padding:4px 8px; min-width: 100px;">
              <option value="">-- Recent Locations --</option>
            </select>
            <button id="fsa-btn-import-selected" class="btn-primary btn-sm" style="display:none; align-items:center; gap:4px; white-space: nowrap; flex-shrink: 0;">
               <span class="material-symbols-outlined text-[16px]">add_to_photos</span>
               Import (<span id="fsa-selected-count">0</span>)
            </button>
            <button id="fsa-btn-mount" class="btn-secondary btn-sm" title="Mount New Folder">
               <span class="material-symbols-outlined text-[16px]">create_new_folder</span>
            </button>
         </div>
         <div id="fsa-browser-root" style="flex:1; overflow:hidden; position:relative;"></div>
      </div>
    `;

    this.container.querySelector('#fsa-btn-close').onclick = () => this.options.onClose();
    this.selectEl = this.container.querySelector('#fsa-recent-select');
    this.selectEl.onchange = async () => {
      const idx = this.selectEl.value;
      if (idx !== '') {
        const loc = this.recentLocations[idx];
        await this.openLocation(loc.handle, loc.name);
      }
    };
    
    this.container.querySelector('#fsa-btn-mount').onclick = async () => {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        await this.addRecentLocation(dirHandle);
        await this.openLocation(dirHandle, dirHandle.name);
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
      }
    };

    this.browserRoot = this.container.querySelector('#fsa-browser-root');
    this.mediaBrowser = new MediaBrowser(this.browserRoot, {
      mode: 'grid',
      onChangeFolderClick: null,
      onNavigateUp: () => this.navigateUp(),
      onDoubleClick: (ent) => this.handleDoubleClick(ent),
      onSelectionChange: (ids, filtered) => {
         const fileIds = ids.filter(id => {
            const e = filtered.find(x => x.name === id);
            return e && !e.isFolder && e.name !== '..';
         });
         const btn = this.container.querySelector('#fsa-btn-import-selected');
         const cnt = this.container.querySelector('#fsa-selected-count');
         if (fileIds.length > 0) {
            btn.style.display = 'flex';
            cnt.textContent = fileIds.length;
         } else {
            btn.style.display = 'none';
         }
         this.selectedFileHandles = fileIds.map(id => filtered.find(x => x.name === id).handle);
      }
    });

    this.container.querySelector('#fsa-btn-import-selected').onclick = async () => {
       if (this.selectedFileHandles && this.selectedFileHandles.length > 0) {
          const btn = this.container.querySelector('#fsa-btn-import-selected');
          const originalHTML = btn.innerHTML;
          btn.innerHTML = '<span class="material-symbols-outlined spin text-[16px]">autorenew</span> Importing...';
          btn.disabled = true;
          
          await this.options.onImportMediaBatch(this.selectedFileHandles);
          this.mediaBrowser.deselectAll();
          
          btn.innerHTML = originalHTML;
          btn.disabled = false;
       }
    };
  }

  async loadRecentLocations() {
    const record = await dbGet('folders', 'fsa_recent_media_locations');
    this.recentLocations = record ? record.locations : [];
    this.updateSelectUI();
  }

  async addRecentLocation(dirHandle) {
    this.recentLocations = this.recentLocations.filter(loc => loc.name !== dirHandle.name);
    this.recentLocations.unshift({ name: dirHandle.name, handle: dirHandle, timestamp: Date.now() });
    if (this.recentLocations.length > 10) this.recentLocations = this.recentLocations.slice(0, 10);
    await dbPut('folders', { key: 'fsa_recent_media_locations', locations: this.recentLocations });
    this.updateSelectUI();
  }

  updateSelectUI() {
    this.selectEl.innerHTML = '<option value="">-- Recent Locations --</option>' + 
      this.recentLocations.map((loc, i) => `<option value="${i}">${loc.name}</option>`).join('');
    
    if (this.currentHandle && this.pathStack.length === 1) {
       const idx = this.recentLocations.findIndex(l => l.name === this.currentHandle.name);
       if (idx >= 0) this.selectEl.value = idx.toString();
    }
  }

  async openLocation(dirHandle, name) {
    if (!(await verifyPermission(dirHandle, false))) {
       alert("Permission to read folder was denied.");
       return;
    }
    this.currentHandle = dirHandle;
    this.pathStack = [{ handle: dirHandle, name }];
    this.updateSelectUI();
    await this.scanCurrent();
  }

  async navigateUp() {
    if (this.pathStack.length <= 1) return;
    this.pathStack.pop();
    this.currentHandle = this.pathStack[this.pathStack.length - 1].handle;
    await this.scanCurrent();
  }

  async handleDoubleClick(ent) {
    if (ent.name === '..') {
      await this.navigateUp();
      return;
    }
    if (ent.isFolder) {
      this.pathStack.push({ handle: ent.handle, name: ent.name });
      this.currentHandle = ent.handle;
      await this.scanCurrent();
    } else {
      // Import file
      await this.options.onImportMedia(ent.handle);
    }
  }

  async scanCurrent() {
    if (!this.currentHandle) return;
    
    const entries = [];
    if (this.pathStack.length > 1) {
       entries.push({ name: '..', isFolder: true });
    }
    
    for await (const entry of this.currentHandle.values()) {
       if (entry.name.startsWith('.')) continue; // skip hidden
       const isFolder = entry.kind === 'directory';
       if (!isFolder && !entry.name.match(/\.(png|jpg|jpeg|webp|mp4|webm|mp3|wav)$/i)) continue; // filter supported media
       
       let file = null;
       if (!isFolder) {
          try { file = await entry.getFile(); } catch(e) {}
       }
       entries.push({ name: entry.name, isFolder, handle: entry, file });
    }
    
    this.mediaBrowser.options.currentFolderName = this.pathStack[this.pathStack.length - 1].name;
    this.mediaBrowser.options.breadcrumbs = this.pathStack.slice(0, -1).map(p => p.name);
    this.mediaBrowser.options.canGoUp = this.pathStack.length > 1;
    this.mediaBrowser.setEntries(entries);
  }
}
