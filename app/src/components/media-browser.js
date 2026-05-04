export function getFileType(filename, isFolder = false) {
  if (isFolder) return 'folder';
  const ext = filename.toLowerCase().split('.').pop();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic', 'tif', 'tiff'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) return 'audio';
  if (['pdf', 'txt', 'md', 'json', 'csv', 'html', 'doc', 'docx'].includes(ext)) return 'document';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'pptx'].includes(ext)) return 'archive';
  return 'other';
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024, dm = decimals < 0 ? 0 : decimals, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export class MediaBrowser {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      mode: 'grid',
      entries: [],
      breadcrumbs: [], // e.g. ['..', 'current folder']
      onSelectionChange: () => {},
      onDoubleClick: () => {},
      onChangeFolderClick: null,
      onNavigateUp: null,
      onDownloadSelected: null,
      onDeleteSelected: null
    }, options);

    this.entries = this.options.entries;
    this.filtered = [...this.entries];
    this.mode = this.options.mode;
    
    this.selectedIds = new Set();
    this.activeFilter = 'all';
    this.sortKey = 'name';
    this.searchQuery = '';
    this.sortFn = null;

    this.blobUrls = [];
    this.renderLimit = 5000;

    this.initDOM();
    this.applyFilters();
  }

  initDOM() {
    this.container.innerHTML = `
      <style>
        .ic-mb { display: flex; flex-direction: column; height: 100%; background: var(--ps-bg); font-family: system-ui, sans-serif; position: relative; outline: none; }
        .ic-mb:focus, .ic-mb:focus-within, .ic-mb-main:focus, .ic-mb-fs:focus { outline: none !important; box-shadow: none !important; }
        
        /* Header */
        .ic-mb-header { display: flex; flex-direction: column; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--ps-border); background: var(--ps-surface); }
        .ic-mb-top-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .ic-mb-bottom-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        
        .ic-mb-breadcrumbs { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
        .ic-mb-crumb-btn { background: none; border: none; color: var(--ps-text-muted); padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; transition: 0.15s; }
        .ic-mb-crumb-btn:hover { color: var(--ps-text); background: rgba(255,255,255,0.05); }
        .ic-mb-crumb-sep { color: var(--ps-text-muted); margin: 0 2px; }
        .ic-mb-crumb-current { color: var(--ps-text); padding: 4px; }
        
        .ic-mb-toolbar { display: flex; gap: 8px; align-items: center; }
        .ic-mb-search { background: var(--ps-bg); border: 1px solid var(--ps-border); color: var(--ps-text); border-radius: 6px; padding: 6px 12px; font-size: 13px; width: 220px; outline: none; transition: 0.2s; }
        .ic-mb-search:focus { border-color: var(--ps-blue); }
        
        .ic-mb-actions { display: flex; gap: 6px; align-items: center; border-left: 1px solid var(--ps-border); padding-left: 12px; margin-left: 4px; }
        
        .ic-mb-filters { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
        .ic-mb-filter { padding: 4px 12px; border-radius: 16px; border: 1px solid var(--ps-border); background: transparent; color: var(--ps-text-muted); cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px; transition: 0.15s; white-space: nowrap; user-select: none; }
        .ic-mb-filter:hover { background: rgba(255,255,255,0.05); color: var(--ps-text); }
        .ic-mb-filter.is-active { background: var(--ps-blue); color: #fff; border-color: var(--ps-blue); }
        .ic-mb-filter-count { background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 600; margin-left: 2px; }
        
        .ic-mb-modes { display: flex; background: var(--ps-bg); border-radius: 6px; padding: 2px; border: 1px solid var(--ps-border); flex-shrink: 0; }
        .ic-mb-mode-btn { background: none; border: none; color: var(--ps-text-muted); padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; transition: 0.15s; }
        .ic-mb-mode-btn:hover { color: var(--ps-text); }
        .ic-mb-mode-btn.is-active { background: var(--ps-surface); color: var(--ps-blue); box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        
        .ic-mb-main { flex: 1; overflow-y: auto; padding: 16px; position: relative; }
        
        /* Tooltips */
        .ic-mb-tooltip { 
          position: fixed; z-index: 9999; background: var(--ps-bg-surface); border: 1px solid var(--ps-border); 
          padding: 8px 12px; border-radius: 6px; font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.15s ease-in-out; 
          box-shadow: 0 8px 24px rgba(0,0,0,0.8); color: var(--ps-text); white-space: pre-wrap; line-height: 1.5; 
          position-anchor: --mb-hovered-cell; top: calc(anchor(bottom) + 8px); left: anchor(left); position-try: flip-block, flip-inline;
        }
        .ic-mb-tooltip.show { opacity: 1; }
        
        /* Dropdowns */
        .ic-mb-child-dropdown-wrap { position: relative; display: flex; align-items: center; }
        .ic-mb-child-dropdown { position: absolute; top: calc(100% + 4px); left: 0; background: var(--ps-bg-surface); border: 1px solid var(--ps-border); border-radius: 6px; padding: 4px 0; max-height: 300px; overflow-y: auto; display: none; z-index: 1000; box-shadow: 0 4px 16px rgba(0,0,0,0.5); min-width: 200px; }
        .ic-mb-child-dropdown.show { display: block; }
        .ic-mb-child-item { padding: 8px 12px; font-size: 13px; color: var(--ps-text); cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .ic-mb-child-item:hover { background: rgba(255,255,255,0.05); }
        
        /* Grid View */
        .ic-mb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
        .ic-mb-cell { display: flex; flex-direction: column; gap: 8px; cursor: pointer; border-radius: 8px; padding: 8px; transition: background 0.15s; user-select: none; }
        .ic-mb-cell:hover { background: rgba(255,255,255,0.05); }
        .ic-mb-cell.is-selected { background: rgba(56, 139, 253, 0.15); box-shadow: inset 0 0 0 1px var(--ps-blue); }
        
        .ic-mb-thumb { aspect-ratio: 1; border-radius: 6px; overflow: hidden; background: #111; position: relative; display: flex; align-items: center; justify-content: center; }
        .ic-mb-thumb img, .ic-mb-thumb video { width: 100%; height: 100%; object-fit: cover; }
        .ic-mb-badge { position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.6); color: #fff; padding: 2px 4px; border-radius: 4px; font-size: 10px; display: flex; align-items: center; backdrop-filter: blur(4px); }
        .ic-mb-name { font-size: 12px; color: var(--ps-text); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        /* List View */
        .ic-mb-list { display: flex; flex-direction: column; width: 100%; }
        .ic-mb-list-row { display: grid; grid-template-columns: 48px minmax(200px, 2fr) 1fr 1fr; gap: 16px; padding: 8px; align-items: center; border-bottom: 1px solid var(--ps-border); cursor: pointer; user-select: none; }
        .ic-mb-list-row:hover { background: rgba(255,255,255,0.02); }
        .ic-mb-list-row.is-selected { background: rgba(56, 139, 253, 0.15); }
        .ic-mb-list-row.is-header { background: var(--ps-surface); font-weight: 600; font-size: 11px; color: var(--ps-text-muted); text-transform: uppercase; border-bottom: 2px solid var(--ps-border); cursor: default; }
        .ic-mb-list-thumb { width: 32px; height: 32px; border-radius: 4px; overflow: hidden; background: #111; display: flex; align-items: center; justify-content: center; }
        .ic-mb-list-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .ic-mb-list-col { font-size: 13px; color: var(--ps-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        /* Filmstrip View */
        .ic-mb-fs { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
        .ic-mb-fs-viewer { flex: 1; display: flex; align-items: center; justify-content: center; background: #000; position: relative; min-height: 0; overflow: hidden; }
        .ic-mb-fs-viewer img, .ic-mb-fs-viewer video { max-width: 100%; max-height: 100%; object-fit: contain; }
        .ic-mb-fs-strip { height: 140px; background: var(--ps-surface); border-top: 1px solid var(--ps-border); display: flex; gap: 8px; padding: 12px; overflow-x: auto; white-space: nowrap; align-items: flex-start; }
        .ic-mb-fs-item { display: flex; flex-direction: column; gap: 4px; width: 100px; flex-shrink: 0; cursor: pointer; user-select: none; }
        .ic-mb-fs-thumb { width: 100px; height: 100px; border-radius: 6px; overflow: hidden; border: 2px solid transparent; opacity: 0.6; transition: 0.2s; background: #111; display: flex; align-items: center; justify-content: center; }
        .ic-mb-fs-item:hover .ic-mb-fs-thumb { opacity: 1; }
        .ic-mb-fs-item.is-selected .ic-mb-fs-thumb { border-color: var(--ps-blue); opacity: 1; }
        .ic-mb-fs-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .ic-mb-fs-name { font-size: 10px; color: var(--ps-text); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      </style>
      <div class="ic-mb">
        <div class="ic-mb-header" id="ic-mb-header"></div>
        <div class="ic-mb-main" id="ic-mb-main"></div>
      </div>
    `;

    this.headerEl = this.container.querySelector('#ic-mb-header');
    this.mainEl = this.container.querySelector('#ic-mb-main');

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'ic-mb-tooltip';
    document.body.appendChild(this.tooltipEl);

    this.container.tabIndex = 0;
    this.container.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  getCounts() {
    const counts = { all: 0, image: 0, video: 0, audio: 0, document: 0, archive: 0, other: 0, folder: 0 };
    this.entries.forEach(ent => {
      if (ent.name === '..') return; // Don't count up directory
      const t = getFileType(ent.name, ent.isFolder);
      if (counts[t] !== undefined) counts[t]++;
      else counts.other++;
      counts.all++;
    });
    return counts;
  }

  renderHeader() {
    const counts = this.getCounts();
    const bc = this.options.breadcrumbs || [];

    if (!this.headerEl.querySelector('.ic-mb-search')) {
      this.headerEl.innerHTML = `
        <div class="ic-mb-top-row">
          <div class="ic-mb-breadcrumbs" id="mb-bc-wrapper"></div>
          <div class="ic-mb-toolbar">
            <input type="text" class="ic-mb-search" placeholder="Search files..." value="${escHtml(this.searchQuery)}">
            <div class="ic-mb-actions">
              <span id="mb-sel-count" style="font-size:12px; color:var(--ps-text-muted); margin-right:8px; font-weight:600;"></span>
              <button class="btn-secondary btn-sm" id="mb-btn-select-all" title="Select all"><span class="material-symbols-outlined text-[16px]">done_all</span></button>
              <button class="btn-secondary btn-sm" id="mb-btn-deselect-all" title="Deselect all"><span class="material-symbols-outlined text-[16px]">remove_done</span></button>
              ${this.options.onDownloadSelected ? `<button class="btn-secondary btn-sm" id="mb-btn-download" title="Download selected"><span class="material-symbols-outlined text-[16px]">download</span></button>` : ''}
              ${this.options.onDeleteSelected ? `<button class="btn-secondary btn-sm text-[var(--ps-red)]" id="mb-btn-delete" title="Delete selected"><span class="material-symbols-outlined text-[16px]">delete</span></button>` : ''}
            </div>
          </div>
        </div>
        <div class="ic-mb-bottom-row">
          <div class="ic-mb-filters" id="mb-filters">
            <button class="ic-mb-filter" data-type="all">All <span class="ic-mb-filter-count"></span></button>
            <button class="ic-mb-filter" data-type="image"><span class="material-symbols-outlined text-[14px]">image</span> Images <span class="ic-mb-filter-count"></span></button>
            <button class="ic-mb-filter" data-type="video"><span class="material-symbols-outlined text-[14px]">movie</span> Video <span class="ic-mb-filter-count"></span></button>
            <button class="ic-mb-filter" data-type="audio"><span class="material-symbols-outlined text-[14px]">music_note</span> Audio <span class="ic-mb-filter-count"></span></button>
            <button class="ic-mb-filter" data-type="document"><span class="material-symbols-outlined text-[14px]">description</span> Documents <span class="ic-mb-filter-count"></span></button>
            <button class="ic-mb-filter" data-type="archive"><span class="material-symbols-outlined text-[14px]">folder_zip</span> Archives <span class="ic-mb-filter-count"></span></button>
            <button class="ic-mb-filter" data-type="other">Other <span class="ic-mb-filter-count"></span></button>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <select id="mb-sort-select" style="background:var(--ps-surface); border:1px solid var(--ps-border); color:var(--ps-text); border-radius:6px; padding:4px 8px; font-size:12px; outline:none; cursor:pointer;">
              <option value="name">Sort by Name</option>
              <option value="type">Sort by Type</option>
              <option value="size">Sort by Size</option>
            </select>
            <div class="ic-mb-modes">
              <button class="ic-mb-mode-btn" data-mode="grid" title="Grid View"><span class="material-symbols-outlined text-[18px]">grid_view</span></button>
              <button class="ic-mb-mode-btn" data-mode="list" title="List View"><span class="material-symbols-outlined text-[18px]">view_list</span></button>
              <button class="ic-mb-mode-btn" data-mode="filmstrip" title="Filmstrip View"><span class="material-symbols-outlined text-[18px]">view_carousel</span></button>
            </div>
          </div>
        </div>
      `;

      this.headerEl.querySelector('.ic-mb-search').addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.applyFilters();
      });

      this.headerEl.querySelectorAll('.ic-mb-filter').forEach(btn => {
        btn.addEventListener('click', () => {
          this.activeFilter = btn.dataset.type;
          this.applyFilters();
        });
      });

      this.headerEl.querySelectorAll('.ic-mb-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
      });

      this.headerEl.querySelector('#mb-sort-select')?.addEventListener('change', (e) => {
        this.sortKey = e.target.value;
        this.applyFilters();
      });
      
      this.headerEl.querySelector('#mb-btn-select-all')?.addEventListener('click', () => this.selectAll());
      this.headerEl.querySelector('#mb-btn-deselect-all')?.addEventListener('click', () => this.deselectAll());
      this.headerEl.querySelector('#mb-btn-download')?.addEventListener('click', () => this.options.onDownloadSelected?.(Array.from(this.selectedIds)));
      this.headerEl.querySelector('#mb-btn-delete')?.addEventListener('click', () => this.options.onDeleteSelected?.(Array.from(this.selectedIds)));
    }

    // Always update breadcrumbs
    let bcHtml = '';
    if (this.options.onChangeFolderClick) {
      bcHtml += `<button class="ic-mb-crumb-btn" id="mb-btn-change-folder" title="Browse for new folder"><span class="material-symbols-outlined text-[18px]">folder_open</span></button>`;
    }
    if (this.options.canGoUp) {
      if (bcHtml) bcHtml += `<span class="ic-mb-crumb-sep">/</span>`;
      bcHtml += `<button class="ic-mb-crumb-btn" id="mb-btn-up" title="Up one folder">..</button>`;
    }
    
    const currentFolderName = this.options.currentFolderName || 'Current Folder';
    
    if (bc && bc.length > 0) {
      bc.forEach((crumb, idx) => {
        bcHtml += `<span class="ic-mb-crumb-sep">/</span>`;
        bcHtml += `<button class="ic-mb-crumb-btn ic-mb-path-crumb" data-idx="${idx}">${escHtml(crumb)}</button>`;
      });
    }
    
    bcHtml += `<span class="ic-mb-crumb-sep">/</span>`;
    bcHtml += `<span class="ic-mb-crumb-current" id="mb-bc-current">${escHtml(currentFolderName)}</span>`;
    
    if (this.options.childFolders && this.options.childFolders.length > 0) {
      bcHtml += `
        <div class="ic-mb-child-dropdown-wrap ml-1">
           <button class="ic-mb-crumb-btn" id="mb-btn-child-folders" title="Subfolders"><span class="material-symbols-outlined text-[16px]">expand_more</span></button>
           <div class="ic-mb-child-dropdown" id="mb-child-dropdown"></div>
        </div>
      `;
    }
    
    const bcWrapper = this.headerEl.querySelector('#mb-bc-wrapper');
    if (bcWrapper) {
      bcWrapper.innerHTML = bcHtml;
      
      this.headerEl.querySelector('#mb-btn-change-folder')?.addEventListener('click', () => this.options.onChangeFolderClick?.());
      this.headerEl.querySelector('#mb-btn-up')?.addEventListener('click', () => this.options.onNavigateUp?.());
      this.headerEl.querySelectorAll('.ic-mb-path-crumb').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          if (this.options.onNavigateTo) this.options.onNavigateTo(idx);
        });
      });

      const dropdownBtn = this.headerEl.querySelector('#mb-btn-child-folders');
      const dropdownEl = this.headerEl.querySelector('#mb-child-dropdown');
      if (dropdownBtn && dropdownEl) {
        dropdownEl.innerHTML = (this.options.childFolders || []).map((name, i) => `<div class="ic-mb-child-item" data-idx="${i}"><span class="material-symbols-outlined text-[16px]">folder</span> ${escHtml(name)}</div>`).join('');
        dropdownBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdownEl.classList.toggle('show');
        });
        dropdownEl.addEventListener('click', (e) => {
          const item = e.target.closest('.ic-mb-child-item');
          if (item) {
             const idx = parseInt(item.dataset.idx);
             this.options.onChildFolderSelect?.(this.options.childFolders[idx]);
          }
        });
        document.addEventListener('click', () => dropdownEl.classList.remove('show'));
      }
    }
    
    const selCountEl = this.headerEl.querySelector('#mb-sel-count');
    if (selCountEl) selCountEl.textContent = this.selectedIds.size > 0 ? `${this.selectedIds.size} selected` : '';

    this.headerEl.querySelectorAll('.ic-mb-mode-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === this.mode);
    });

    const sortSel = this.headerEl.querySelector('#mb-sort-select');
    if (sortSel) sortSel.value = this.sortKey;

    this.headerEl.querySelectorAll('.ic-mb-filter').forEach(btn => {
      const type = btn.dataset.type;
      btn.classList.toggle('is-active', type === this.activeFilter);
      btn.querySelector('.ic-mb-filter-count').textContent = counts[type] || 0;
      
      if (type !== 'all' && (!counts[type] || counts[type] === 0)) {
        btn.style.display = 'none';
      } else {
        btn.style.display = '';
      }
    });

    this.headerEl.querySelectorAll('.ic-mb-mode-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === this.mode);
    });
  }

  setEntries(entries) {
    this.entries = entries;
    this.selectedIds.clear();
    this.lastSelectedIdx = -1;
    this.renderHeader(); // Re-render breadcrumbs if options changed
    this.applyFilters();
  }

  setMode(mode) {
    this.mode = mode;
    localStorage.setItem('ic-view-mode', mode);
    this.render();
  }

  selectAll() {
    this.selectedIds.clear();
    this.filtered.forEach(e => {
      if (e.name !== '..') this.selectedIds.add(e.name);
    });
    this.options.onSelectionChange(Array.from(this.selectedIds));
    this.render();
  }

  deselectAll() {
    this.selectedIds.clear();
    this.options.onSelectionChange([]);
    this.render();
  }

  applyFilters() {
    this.filtered = this.entries.filter(ent => {
      if (ent.name === '..') return true; // Always show Up directory if present
      if (this.activeFilter !== 'all' && getFileType(ent.name, ent.isFolder) !== this.activeFilter) return false;
      if (this.searchQuery) {
        if (ent.name.toLowerCase().includes(this.searchQuery)) return true;
        if (ent.sidecar) {
          const jsonStr = JSON.stringify(ent.sidecar).toLowerCase();
          if (jsonStr.includes(this.searchQuery)) return true;
        }
        return false;
      }
      return true;
    });
    
    // Sort logic: Folders at the end, and .. at the absolute end
    this.filtered.sort((a, b) => {
      if (a.name === '..') return 1;
      if (b.name === '..') return -1;
      if (a.isFolder && !b.isFolder) return 1;
      if (!a.isFolder && b.isFolder) return -1;
      
      if (this.sortKey === 'type') {
         const typeA = getFileType(a.name, a.isFolder);
         const typeB = getFileType(b.name, b.isFolder);
         return typeA.localeCompare(typeB) || a.name.localeCompare(b.name);
      } else if (this.sortKey === 'size') {
         const sizeA = a.file ? a.file.size : 0;
         const sizeB = b.file ? b.file.size : 0;
         return sizeB - sizeA || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

    if (this.sortFn) {
      this.filtered.sort(this.sortFn);
    }
    
    this.render();
  }

  clearBlobUrls() {
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
    this.blobUrls = [];
  }

  render() {
    this.clearBlobUrls();
    this.renderHeader();
    this.mainEl.innerHTML = '';
    
    if (this.filtered.length === 0) {
      this.mainEl.innerHTML = '<div class="flex items-center justify-center h-full text-[var(--ps-text-muted)]">No items found.</div>';
      return;
    }

    if (this.mode === 'grid') this.renderGrid();
    else if (this.mode === 'list') this.renderList();
    else if (this.mode === 'filmstrip') this.renderFilmstrip();
  }

  getTooltipText(ent) {
    if (ent.isFolder) return ent.name === '..' ? 'Go up one directory' : `Folder: ${ent.name}`;
    const lines = [`Name: ${ent.name}`];
    if (ent.file) {
      lines.push(`Size: ${formatBytes(ent.file.size)}`);
      lines.push(`Updated: ${new Date(ent.file.lastModified).toLocaleString()}`);
    }
    if (ent.sidecar?.width && ent.sidecar?.height) {
      lines.push(`Dimensions: ${ent.sidecar.width} x ${ent.sidecar.height}`);
    }
    return lines.join('\n');
  }

  bindTooltip(el, ent) {
    el.addEventListener('mouseenter', (e) => {
      this.tooltipEl.textContent = this.getTooltipText(ent);
      el.style.anchorName = '--mb-hovered-cell';
      this.tooltipEl.classList.add('show');
      
      const type = getFileType(ent.name, ent.isFolder);
      if (ent.file && (type === 'image' || type === 'video') && (!ent.sidecar?.width)) {
        const hoverId = ++this._hoverId;
        const url = URL.createObjectURL(ent.file);
        if (type === 'image') {
          const img = new Image();
          img.onload = () => {
            if (this._hoverId === hoverId) {
              this.tooltipEl.textContent += `\nDimensions: ${img.naturalWidth} x ${img.naturalHeight}`;
            }
            URL.revokeObjectURL(url);
          };
          img.src = url;
        } else {
          const vid = document.createElement('video');
          vid.onloadedmetadata = () => {
            if (this._hoverId === hoverId) {
              this.tooltipEl.textContent += `\nDimensions: ${vid.videoWidth} x ${vid.videoHeight}`;
            }
            URL.revokeObjectURL(url);
          };
          vid.src = url;
        }
      }
    });
    el.addEventListener('mouseleave', () => {
      this._hoverId = (this._hoverId || 0) + 1; // Invalidate pending tooltips
      el.style.anchorName = '';
      this.tooltipEl.classList.remove('show');
    });
  }

  _createThumbnailHtml(ent, type) {
    if (type === 'folder' || ent.isFolder) {
      const icon = ent.name === '..' ? 'reply' : 'folder';
      return `<div class="flex items-center justify-center h-full w-full text-[var(--ps-blue)] bg-[var(--ps-surface)]"><span class="material-symbols-outlined text-[48px]">${icon}</span></div>`;
    }

    const url = ent.file ? URL.createObjectURL(ent.file) : '';
    if (url) this.blobUrls.push(url);
    
    const previewUrl = ent.preview ? URL.createObjectURL(ent.preview) : null;
    if (previewUrl) this.blobUrls.push(previewUrl);

    if (type === 'video') {
      return previewUrl 
        ? `<div style="position:relative; width:100%; height:100%;"><img src="${previewUrl}" loading="lazy"><div style="position:absolute; bottom:4px; left:4px; background:rgba(0,0,0,0.6); color:#fff; border-radius:4px; padding:2px; display:flex;"><span class="material-symbols-outlined text-[14px]">play_circle</span></div></div>`
        : `<div style="position:relative; width:100%; height:100%;"><video src="${url}#t=0.1" preload="metadata" muted></video><div style="position:absolute; bottom:4px; left:4px; background:rgba(0,0,0,0.6); color:#fff; border-radius:4px; padding:2px; display:flex;"><span class="material-symbols-outlined text-[14px]">play_circle</span></div></div>`;
    }
    if (type === 'image') return `<img src="${url}" loading="lazy">`;
    if (type === 'audio') return `<div class="flex items-center justify-center h-full w-full text-[var(--ps-text-muted)] bg-[var(--ps-surface)]"><span class="material-symbols-outlined text-[32px]">music_note</span></div>`;
    if (type === 'document') return `<div class="flex items-center justify-center h-full w-full text-[var(--ps-text-muted)] bg-[var(--ps-surface)]"><span class="material-symbols-outlined text-[32px]">description</span></div>`;
    if (type === 'archive') return `<div class="flex items-center justify-center h-full w-full text-[var(--ps-text-muted)] bg-[var(--ps-surface)]"><span class="material-symbols-outlined text-[32px]">folder_zip</span></div>`;
    
    return `<div class="flex items-center justify-center h-full w-full text-[var(--ps-text-muted)] bg-[var(--ps-surface)]"><span class="material-symbols-outlined text-[32px]">insert_drive_file</span></div>`;
  }

  renderGrid() {
    this.mainEl.className = 'ic-mb-main';
    const grid = document.createElement('div');
    grid.className = 'ic-mb-grid';
    
    const limit = Math.min(this.filtered.length, this.renderLimit);
    
    for (let i = 0; i < limit; i++) {
      const ent = this.filtered[i];
      const type = getFileType(ent.name, ent.isFolder);
      
      const cell = document.createElement('div');
      cell.className = `ic-mb-cell ${this.selectedIds.has(ent.name) ? 'is-selected' : ''}`;
      cell.innerHTML = `
        <div class="ic-mb-thumb">${this._createThumbnailHtml(ent, type)}</div>
        <div class="ic-mb-name">${escHtml(ent.name)}</div>
      `;
      
      this.bindTooltip(cell, ent);
      this.bindCellEvents(cell, ent, i);
      grid.appendChild(cell);
    }
    
    this.mainEl.appendChild(grid);
  }

  renderList() {
    this.mainEl.className = 'ic-mb-main';
    const list = document.createElement('div');
    list.className = 'ic-mb-list';
    
    list.innerHTML = `
      <div class="ic-mb-list-row is-header">
        <div></div>
        <div>Name</div>
        <div>Type</div>
        <div>Size</div>
      </div>
    `;

    const limit = Math.min(this.filtered.length, this.renderLimit);
    
    for (let i = 0; i < limit; i++) {
      const ent = this.filtered[i];
      const type = getFileType(ent.name, ent.isFolder);
      
      const row = document.createElement('div');
      row.className = `ic-mb-list-row ${this.selectedIds.has(ent.name) ? 'is-selected' : ''}`;
      row.innerHTML = `
        <div class="ic-mb-list-thumb">${this._createThumbnailHtml(ent, type)}</div>
        <div class="ic-mb-list-col">${escHtml(ent.name)}</div>
        <div class="ic-mb-list-col text-[var(--ps-text-muted)]">${type.toUpperCase()}</div>
        <div class="ic-mb-list-col text-[var(--ps-text-muted)]">${ent.file ? formatBytes(ent.file.size) : '--'}</div>
      `;
      
      this.bindTooltip(row, ent);
      this.bindCellEvents(row, ent, i);
      list.appendChild(row);
    }
    
    this.mainEl.appendChild(list);
  }

  renderFilmstrip() {
    this.mainEl.className = 'ic-mb-main';
    this.mainEl.style.padding = '0';
    
    const fs = document.createElement('div');
    fs.className = 'ic-mb-fs';
    
    let activeEnt = this.filtered[0];
    if (this.selectedIds.size > 0) {
      const firstSelected = this.filtered.find(e => this.selectedIds.has(e.name));
      if (firstSelected) activeEnt = firstSelected;
    }
    
    const activeType = getFileType(activeEnt.name, activeEnt.isFolder);
    let activeUrl = '';
    if (activeEnt.file) {
      activeUrl = URL.createObjectURL(activeEnt.file);
      this.blobUrls.push(activeUrl);
    }

    let viewerHtml = '';
    if (activeType === 'folder' || activeEnt.isFolder) {
      const icon = activeEnt.name === '..' ? 'reply' : 'folder';
      viewerHtml = `<div class="flex flex-col items-center justify-center text-[var(--ps-blue)]"><span class="material-symbols-outlined text-[64px] mb-4">${icon}</span><span class="text-lg">${escHtml(activeEnt.name)}</span></div>`;
    } else if (activeType === 'video') viewerHtml = `<video src="${activeUrl}" controls></video>`;
    else if (activeType === 'image') viewerHtml = `<img src="${activeUrl}">`;
    else viewerHtml = `<div class="text-[var(--ps-text-muted)]">Preview not available</div>`;

    fs.innerHTML = `
      <div class="ic-mb-fs-viewer">${viewerHtml}</div>
      <div class="ic-mb-fs-strip"></div>
    `;

    const viewerEl = fs.querySelector('.ic-mb-fs-viewer');
    viewerEl.addEventListener('dblclick', () => {
      const active = this._currentFsActiveEnt || activeEnt;
      if (active) {
        this.options.onDoubleClick(active, this.filtered.indexOf(active), this.filtered);
      }
    });

    const strip = fs.querySelector('.ic-mb-fs-strip');
    
    // Restore scroll position
    if (this._fsScrollLeft !== undefined) {
      setTimeout(() => strip.scrollLeft = this._fsScrollLeft, 0);
    }
    strip.addEventListener('scroll', () => {
      this._fsScrollLeft = strip.scrollLeft;
    });

    const limit = Math.min(this.filtered.length, this.renderLimit);
    
    for (let i = 0; i < limit; i++) {
      const ent = this.filtered[i];
      const type = getFileType(ent.name, ent.isFolder);
      
      const thumb = document.createElement('div');
      thumb.className = `ic-mb-fs-item ${activeEnt.name === ent.name ? 'is-selected' : ''}`;
      thumb.innerHTML = `
        <div class="ic-mb-fs-thumb">${this._createThumbnailHtml(ent, type)}</div>
        <div class="ic-mb-fs-name">${escHtml(ent.name)}</div>
      `;
      
      this.bindTooltip(thumb, ent);
      
      // Override default cell bind to trigger re-render in filmstrip
      thumb.addEventListener('click', (e) => this._handleItemClick(e, ent, i));
      
      thumb.addEventListener('dblclick', () => {
        this.selectedIds.clear();
        this.selectedIds.add(ent.name);
        this.lastSelectedIdx = i;
        this._syncSelectionUI();
        this.options.onDoubleClick(ent, i, this.filtered);
      });
      
      strip.appendChild(thumb);
    }

    this.mainEl.appendChild(fs);
  }

  _handleItemClick(e, ent, index) {
    if (e.shiftKey && this.lastSelectedIdx !== -1) {
      const start = Math.min(this.lastSelectedIdx, index);
      const end = Math.max(this.lastSelectedIdx, index);
      if (!e.metaKey && !e.ctrlKey) this.selectedIds.clear();
      for (let i = start; i <= end; i++) {
        this.selectedIds.add(this.filtered[i].name);
      }
      this.lastSelectedIdx = index;
    } else if (e.metaKey || e.ctrlKey) {
      if (this.selectedIds.has(ent.name)) {
        this.selectedIds.delete(ent.name);
      } else {
        this.selectedIds.add(ent.name);
        this.lastSelectedIdx = index;
      }
    } else {
      if (this.selectedIds.has(ent.name) && this.selectedIds.size === 1) {
        this.selectedIds.clear();
      } else {
        this.selectedIds.clear();
        this.selectedIds.add(ent.name);
        this.lastSelectedIdx = index;
      }
    }
    
    this._syncSelectionUI();
  }

  _syncSelectionUI() {
    const selCountEl = this.headerEl.querySelector('#mb-sel-count');
    if (selCountEl) selCountEl.textContent = this.selectedIds.size > 0 ? `${this.selectedIds.size} selected` : '';

    if (this.mode === 'filmstrip') {
      const strip = this.mainEl.querySelector('.ic-mb-fs-strip');
      if (strip) {
        const items = strip.children;
        for (let i = 0; i < items.length; i++) {
           items[i].classList.toggle('is-selected', this.selectedIds.has(this.filtered[i].name));
        }
      }
      this._updateFilmstripViewer();
    } else {
      const listContainer = this.mainEl.children[0];
      if (listContainer) {
        const items = listContainer.children;
        for (let i = 0; i < items.length; i++) {
          const domIdx = this.mode === 'list' ? i - 1 : i;
          if (domIdx >= 0 && domIdx < this.filtered.length) {
             items[i].classList.toggle('is-selected', this.selectedIds.has(this.filtered[domIdx].name));
          }
        }
      }
    }
    
    this.options.onSelectionChange(Array.from(this.selectedIds));
  }

  _updateFilmstripViewer() {
    let activeEnt = this.filtered[this.lastSelectedIdx !== -1 ? this.lastSelectedIdx : 0];
    if (!activeEnt) return;
    if (this.selectedIds.size > 0 && !this.selectedIds.has(activeEnt.name)) {
      activeEnt = this.filtered.find(e => this.selectedIds.has(e.name)) || activeEnt;
    }
    
    this._currentFsActiveEnt = activeEnt;
    
    const viewerEl = this.mainEl.querySelector('.ic-mb-fs-viewer');
    if (!viewerEl) return;

    const activeType = getFileType(activeEnt.name, activeEnt.isFolder);
    let activeUrl = '';
    if (activeEnt.file) {
      activeUrl = URL.createObjectURL(activeEnt.file);
      this.blobUrls.push(activeUrl);
    }

    let viewerHtml = '';
    if (activeType === 'folder' || activeEnt.isFolder) {
      const icon = activeEnt.name === '..' ? 'reply' : 'folder';
      viewerHtml = `<div class="flex flex-col items-center justify-center text-[var(--ps-blue)] w-full h-full"><span class="material-symbols-outlined text-[64px] mb-4">${icon}</span><span class="text-lg">${escHtml(activeEnt.name)}</span></div>`;
    } else if (activeType === 'video') viewerHtml = `<video src="${activeUrl}" controls style="max-width:100%; max-height:100%; object-fit:contain;"></video>`;
    else if (activeType === 'image') viewerHtml = `<img src="${activeUrl}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
    else viewerHtml = `<div class="text-[var(--ps-text-muted)] flex items-center justify-center w-full h-full">Preview not available</div>`;

    viewerEl.innerHTML = viewerHtml;
  }

  bindCellEvents(el, ent, index) {
    el.addEventListener('click', (e) => this._handleItemClick(e, ent, index));

    el.addEventListener('dblclick', () => {
      this.selectedIds.clear();
      this.selectedIds.add(ent.name);
      this.lastSelectedIdx = index;
      this._syncSelectionUI();
      this.options.onDoubleClick(ent, index, this.filtered);
    });
  }

  handleKeyDown(e) {
    if (this.filtered.length === 0) return;
    if (this.lastSelectedIdx === -1) this.lastSelectedIdx = 0;

    let cols = 1;
    if (this.mode === 'grid') {
      const grid = this.mainEl.querySelector('.ic-mb-grid');
      if (grid) {
        const itemWidth = 140 + 16; 
        cols = Math.floor(grid.clientWidth / itemWidth) || 1;
      }
    }

    let newIdx = this.lastSelectedIdx;
    
    switch(e.key) {
      case 'ArrowRight': newIdx = Math.min(this.filtered.length - 1, newIdx + 1); break;
      case 'ArrowLeft':  newIdx = Math.max(0, newIdx - 1); break;
      case 'ArrowDown':  newIdx = Math.min(this.filtered.length - 1, newIdx + cols); break;
      case 'ArrowUp':    newIdx = Math.max(0, newIdx - cols); break;
      case 'Enter': 
        if (this.lastSelectedIdx >= 0) {
          this.options.onDoubleClick(this.filtered[this.lastSelectedIdx], this.lastSelectedIdx, this.filtered);
        }
        return;
      default: return;
    }

    e.preventDefault();
    this.lastSelectedIdx = newIdx;
    const ent = this.filtered[newIdx];
    
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
      this.selectedIds.clear();
      this.selectedIds.add(ent.name);
    } else if (e.shiftKey) {
      this.selectedIds.add(ent.name);
    }
    
    this._syncSelectionUI();
    
    // Ensure the new selected item is scrolled into view smoothly
    const listContainer = this.mode === 'filmstrip' 
      ? this.mainEl.querySelector('.ic-mb-fs-strip') 
      : this.mainEl.children[0];
      
    if (listContainer) {
      const items = listContainer.children;
      for (let i = 0; i < items.length; i++) {
        const domIdx = this.mode === 'list' ? i - 1 : i;
        if (domIdx === newIdx && items[i].scrollIntoView) {
           items[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        }
      }
    }
  }
}
