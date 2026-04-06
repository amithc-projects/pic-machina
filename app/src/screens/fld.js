/**
 * ImageChef — FLD: Folder Viewer
 *
 * Finder-style file browser for a batch run's output folder.
 * Accessed via #fld?run=<runId>
 *
 * View modes: grid (thumbnails) | filmstrip | list
 * Supports:   images (before/after compare), MP4 playback, contact sheets
 */

import { getRun }                                   from '../data/runs.js';
import { getFolder, pickFolder }                     from '../data/folders.js';
import { setRecipeThumbnail }                        from '../data/recipes.js';
import { navigate }                                  from '../main.js';
import { formatBytes }                               from '../utils/misc.js';
import { getImageInfo, renderImageInfoPanel,
         injectImageInfoStyles }                     from '../utils/image-info.js';
import { renderAssetPanel,
         injectAssetPanelStyles,
         renderExtractedMetadataForSidebar }         from '../utils/asset-panel.js';
import { showConfirm }                               from '../utils/dialogs.js';

const IMAGE_EXTS = new Set(['.jpg','.jpeg','.png','.webp','.gif','.tif','.tiff','.bmp','.heic']);
const VIDEO_EXTS = new Set(['.mp4','.mov','.webm']);

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function extOf(name) { return name.slice(name.lastIndexOf('.')).toLowerCase(); }

function fileType(name) {
  const ext = extOf(name);
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'other';
}

/** Read ALL media files (images + video) from a directory handle. Stores handles for deletion. */
async function listAllMedia(dirHandle) {
  const entries = [];
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind !== 'file') continue;
    const ext = extOf(name);
    if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
      entries.push({ file: await entry.getFile(), handle: entry });
    }
  }
  return entries.sort((a, b) => a.file.name.localeCompare(b.file.name));
}

export async function render(container, hash) {
  const params    = new URLSearchParams((hash || '').split('?')[1] || '');
  const runId     = params.get('run');
  // 'que' → 'out': going back to a completed/stale queue screen is a dead end
  const rawFrom   = params.get('from') || 'out';
  const fromRoute = rawFrom === 'que' ? 'out' : rawFrom;

  // Load run metadata
  const run = runId ? await getRun(runId) : null;

  // No run specified — try to restore a previously browsed folder, else show picker
  let browseHandle = null;
  let browseMode   = false;

  if (!runId) {
    browseHandle = await getFolder('browse').catch(() => null);
    if (browseHandle) {
      browseMode = true;
    } else {
      container.innerHTML = `
        <div class="screen">
          <div class="screen-header">
            <div class="screen-title">
              <span class="material-symbols-outlined">folder_open</span>
              Folder Viewer
            </div>
          </div>
          <div class="screen-body" style="align-items:center;justify-content:center">
            <div class="empty-state">
              <span class="material-symbols-outlined" style="font-size:48px">folder_open</span>
              <div class="empty-state-title">No folder selected</div>
              <div class="empty-state-desc">Open a folder to browse its contents, or go to Output History to view a completed batch run.</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px">
                <button class="btn-primary" id="fld-browse-folder">
                  <span class="material-symbols-outlined">folder_open</span> Open Folder
                </button>
                <button class="btn-secondary" id="fld-go-out">
                  <span class="material-symbols-outlined">history</span> Output History
                </button>
              </div>
            </div>
          </div>
        </div>`;
      container.querySelector('#fld-go-out')?.addEventListener('click', () => navigate('#out'));
      container.querySelector('#fld-browse-folder')?.addEventListener('click', async () => {
        try {
          await pickFolder('browse');
          navigate('#fld');
        } catch (e) { if (e.name !== 'AbortError') console.error(e); }
      });
      return;
    }
  }

  container.innerHTML = `
    <div class="screen fld-screen">
      <div class="fld-toolbar">
        <button class="btn-icon" id="fld-back" title="Back">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="fld-breadcrumb">
          ${browseMode
            ? `<span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-text-muted)">folder_open</span>
               <span class="fld-crumb-recipe">${escHtml(browseHandle.name)}</span>`
            : `<span class="fld-crumb-recipe">${escHtml(run?.recipeName || 'Output')}</span>
               <span class="material-symbols-outlined fld-crumb-sep">chevron_right</span>
               <span class="fld-crumb-folder">${escHtml(run?.outputFolder || 'output')}/</span>`
          }
        </div>

        <div style="flex:1"></div>

        ${browseMode ? `<button class="btn-secondary btn-sm" id="fld-change-folder" style="margin-right:8px">
          <span class="material-symbols-outlined" style="font-size:16px">folder_open</span> Change Folder
        </button>` : ''}

        <div id="fld-selection-actions" class="flex items-center gap-1" style="margin-right:8px">
          <button class="btn-secondary btn-sm" id="fld-btn-select-all" title="Select all visible items">
            <span class="material-symbols-outlined" style="font-size:16px">done_all</span>
            Select All
          </button>
          <button class="btn-secondary btn-sm" id="fld-btn-deselect-all" title="Deselect all">
            Deselect
          </button>
          <button class="btn-secondary btn-sm" id="fld-btn-delete-sel" title="Delete selected items from disk">
            <span class="material-symbols-outlined" style="font-size:18px;color:var(--ps-red)">delete</span>
          </button>
          <div style="width:1px;height:20px;background:var(--ps-border);margin:0 4px"></div>
        </div>

        <div class="fld-view-toggle" role="group">
          <button class="fld-view-btn is-active" data-fld-view="grid" title="Grid view">
            <span class="material-symbols-outlined">grid_view</span>
          </button>
          <button class="fld-view-btn" data-fld-view="filmstrip" title="Filmstrip view">
            <span class="material-symbols-outlined">view_carousel</span>
          </button>
          <button class="fld-view-btn" data-fld-view="list" title="List view">
            <span class="material-symbols-outlined">view_list</span>
          </button>
        </div>

        <button class="btn-secondary btn-sm" id="fld-btn-slideshow" title="Play Slideshow" style="margin-left:8px">
          <span class="material-symbols-outlined" style="font-size:18px">play_circle</span>
          Slideshow
        </button>
        <div class="fld-sort-row">
          <select id="fld-sort" class="ic-input" style="font-size:12px;padding:5px 8px;height:32px">
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="size">Size</option>
          </select>
        </div>
        <div class="fld-filter-chips" id="fld-filter-chips">
          <button class="fld-chip is-active" data-filter="all">All</button>
          <button class="fld-chip" data-filter="image">
            <span class="material-symbols-outlined" style="font-size:12px">image</span>
            Images
          </button>
          <button class="fld-chip" data-filter="video">
            <span class="material-symbols-outlined" style="font-size:12px">movie</span>
            Video
          </button>
          <button class="fld-chip" data-filter="other">Other</button>
        </div>
      </div>

      <div class="fld-body" id="fld-body">
        <div class="fld-main" id="fld-main">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;gap:10px">
            <div class="spinner spinner--lg"></div>
            <span class="text-sm text-muted">Loading files…</span>
          </div>
        </div>
        <div class="fld-resize-handle" id="fld-resize-handle" style="display:none"></div>
        <div class="fld-detail" id="fld-detail" style="display:none"></div>
      </div>
    </div>`;

  injectFldStyles();
  injectImageInfoStyles();

  container.querySelector('#fld-back')?.addEventListener('click', () => navigate(`#${fromRoute}`));

  // ── Change Folder (browse mode) ─────────────────────────────
  container.querySelector('#fld-change-folder')?.addEventListener('click', async () => {
    try {
      await pickFolder('browse');
      navigate('#fld');
    } catch (e) { if (e.name !== 'AbortError') console.error(e); }
  });

  // ── State ───────────────────────────────────────────────────
  let activeSubHandle = null; // used by deleteSelected
  let allEntries = [];   // { file: File, handle: FileSystemFileHandle }[]
  let inputFiles = [];   // File[] from input folder for comparison
  let inputByBase = new Map();
  let filtered   = [];   // MediaEntry[] current filtered+sorted list
  let viewMode   = localStorage.getItem('ic-view-mode') || 'filmstrip';
  let filterType = 'all';
  let sortKey    = 'name';
  let selected   = null; // MediaEntry | null
  let selectedSet = new Set(); // Set<string> filenames (primary selection)
  let lastIdx    = -1;   // for shift-select
  let cmpMode    = localStorage.getItem('ic-cmp-mode') || 'slider';
  let blobUrls   = [];   // track for cleanup
  let slideshowTimer = null;
  let slideshowIdx   = 0;
  let slideshowSpeed = 3000;
  let slideshowIsPlaying = false;

  function revokeBlobUrls() {
    blobUrls.forEach(url => URL.revokeObjectURL(url));
    blobUrls = [];
  }

  // ── View toggle ─────────────────────────────────────────────
  container.querySelectorAll('[data-fld-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.fldView;
      localStorage.setItem('ic-view-mode', viewMode);
      container.querySelectorAll('[data-fld-view]').forEach(b => b.classList.toggle('is-active', b === btn));
      renderMain();
    });
  });
  // Restore active state based on saved viewMode
  container.querySelectorAll('[data-fld-view]').forEach(b => {
    b.classList.toggle('is-active', b.dataset.fldView === viewMode);
  });

  // ── Filter chips ────────────────────────────────────────────
  container.querySelectorAll('[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      filterType = chip.dataset.filter;
      container.querySelectorAll('[data-filter]').forEach(c => c.classList.toggle('is-active', c === chip));
      applyFilter();
    });
  });

  // ── Sort ───────────────────────────────────────────────────
  container.querySelector('#fld-sort')?.addEventListener('change', e => {
    sortKey = e.target.value;
    applyFilter();
  });

  // ── Selection actions ──────────────────────────────────────
  container.querySelector('#fld-btn-select-all')?.addEventListener('click', () => {
    filtered.forEach(ent => selectedSet.add(ent.file.name));
    updateSelectionUI();
  });

  container.querySelector('#fld-btn-deselect-all')?.addEventListener('click', () => {
    selectedSet.clear();
    updateSelectionUI();
  });

  container.querySelector('#fld-btn-delete-sel')?.addEventListener('click', deleteSelected);

  // ── Resizable detail panel ──────────────────────────────────
  const detailEl      = container.querySelector('#fld-detail');
  const resizeHandle  = container.querySelector('#fld-resize-handle');
  const DETAIL_W_KEY  = 'ic-fld-detail-width';
  let detailWidth     = Math.max(220, Math.min(700, parseInt(localStorage.getItem(DETAIL_W_KEY)) || 340));

  function applyDetailWidth(w) {
    detailWidth = Math.max(220, Math.min(700, w));
    if (detailEl) { detailEl.style.width = detailWidth + 'px'; detailEl.style.minWidth = detailWidth + 'px'; }
  }

  function showDetailAndHandle() {
    if (resizeHandle) resizeHandle.style.display = '';
    if (detailEl)     detailEl.style.display = 'flex';
    applyDetailWidth(detailWidth);
  }

  let _isResizing = false;
  resizeHandle?.addEventListener('mousedown', e => {
    _isResizing = true;
    resizeHandle.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  function _onResizeMove(e) {
    if (!_isResizing) return;
    const body = container.querySelector('#fld-body');
    if (!body) return;
    applyDetailWidth(body.getBoundingClientRect().right - e.clientX);
  }

  function _onResizeUp() {
    if (!_isResizing) return;
    _isResizing = false;
    resizeHandle?.classList.remove('is-dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem(DETAIL_W_KEY, String(detailWidth));
  }

  document.addEventListener('mousemove', _onResizeMove);
  document.addEventListener('mouseup',   _onResizeUp);

  container.querySelector('#fld-btn-slideshow')?.addEventListener('click', () => {
    const images = filtered.filter(ent => fileType(ent.file.name) === 'image');
    if (!images.length) {
      window.AuroraToast?.show({ variant: 'warning', title: 'No images to show' });
      return;
    }
    startSlideshow(images);
  });

  // ── Load files ──────────────────────────────────────────────
  try {
    let subHandle;
    if (browseMode) {
      subHandle = browseHandle;
    } else {
      let outputHandle = run?.outputHandleObj || await getFolder('output');
      if (!outputHandle) {
        showEmpty('Output folder not accessible. Grant permission in Batch Setup.');
        return;
      }

      const subfolder = run?.outputFolder || 'output';
      try {
        subHandle = await outputHandle.getDirectoryHandle(subfolder);
      } catch {
        showEmpty(`Subfolder "${subfolder}" not found.`);
        return;
      }
    }

    activeSubHandle = subHandle;
    allEntries = await listAllMedia(subHandle);

    // Try to load input files for comparison
    const inputHandle = await getFolder('input').catch(() => null);
    if (inputHandle) {
      try {
        inputFiles = [];
        for await (const [, entry] of inputHandle.entries()) {
          if (entry.kind === 'file') inputFiles.push(await entry.getFile());
        }
        for (const f of inputFiles) {
          const base = f.name.replace(/\.[^.]+$/, '');
          inputByBase.set(base, f);
          inputByBase.set(base.replace(/_[a-z0-9]+$/i, ''), f);
        }
      } catch {}
    }

    // Update filter chip counts
    const counts = { image: 0, video: 0, other: 0 };
    allEntries.forEach(ent => { const t = fileType(ent.file.name); counts[t] = (counts[t] || 0) + 1; });
    container.querySelectorAll('[data-filter]').forEach(chip => {
      const t = chip.dataset.filter;
      if (t !== 'all') {
        const badge = counts[t] || 0;
        if (badge > 0) {
          // Append count
          const existing = chip.querySelector('.fld-chip-count');
          if (!existing) {
            const sp = document.createElement('span');
            sp.className = 'fld-chip-count';
            sp.textContent = badge;
            chip.appendChild(sp);
          }
        }
      }
    });

    applyFilter();
  } catch (err) {
    showEmpty(`Error: ${err.message}`);
  }

  function showEmpty(msg) {
    const main = container.querySelector('#fld-main');
    if (main) main.innerHTML = `<div class="empty-state" style="height:100%">
      <span class="material-symbols-outlined">folder_off</span>
      <div class="empty-state-title">No files</div>
      <div class="empty-state-desc">${escHtml(msg)}</div>
    </div>`;
  }

  function applyFilter() {
    filtered = allEntries.filter(ent => filterType === 'all' || fileType(ent.file.name) === filterType);
    // Sort
    filtered.sort((a, b) => {
      if (sortKey === 'type') return fileType(a.file.name).localeCompare(fileType(b.file.name)) || a.file.name.compare(b.file.name);
      if (sortKey === 'size') return b.file.size - a.file.size;
      return a.file.name.localeCompare(b.file.name);
    });
    renderMain();
  }
  // ── Render main area ────────────────────────────────────────
  function renderMain() {
    revokeBlobUrls();
    const main = container.querySelector('#fld-main');
    if (!main) return;

    if (!filtered.length) {
      main.innerHTML = `<div class="empty-state" style="height:100%">
        <span class="material-symbols-outlined">filter_none</span>
        <div class="empty-state-title">No files match</div>
      </div>`;
      updateSelectionUI();
      return;
    }

    if (viewMode === 'grid')       renderGrid(main);
    else if (viewMode === 'filmstrip') renderFilmstrip(main);
    else                           renderList(main);

    updateSelectionUI();
  }

  function handleFileClick(ent, index, e) {
    const isCmd = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    if (isShift && lastIdx >= 0) {
      const start = Math.min(lastIdx, index);
      const end = Math.max(lastIdx, index);
      for (let i = start; i <= end; i++) {
        selectedSet.add(filtered[i].file.name);
      }
    } else if (isCmd) {
      if (selectedSet.has(ent.file.name)) selectedSet.delete(ent.file.name);
      else selectedSet.add(ent.file.name);
      lastIdx = index;
    } else {
      selectedSet.clear();
      selectedSet.add(ent.file.name);
      lastIdx = index;
      selectFile(ent); // Open in preview
    }
    updateSelectionUI();
  }

  async function deleteSelected() {
    const names = Array.from(selectedSet);
    if (!names.length) return;

    const confirmed = await showConfirm({
      title: `Delete ${names.length} Item${names.length !== 1 ? 's' : ''}?`,
      body: 'This will permanently remove these files from your computer. This action cannot be undone.',
      confirmText: 'Delete Forever',
      variant: 'danger',
      icon: 'delete_forever'
    });
    if (!confirmed) return;

    try {
      if (!activeSubHandle) throw new Error('Folder not accessible');

      for (const name of names) {
        if (allEntries.find(e => e.file.name === name)) {
          await activeSubHandle.removeEntry(name);
        }
      }

      // Refresh data
      allEntries = await listAllMedia(activeSubHandle);
      selectedSet.clear();
      lastIdx = -1;
      selected = null;
      applyFilter();

      if (window.AuroraToast) {
        window.AuroraToast.show({
          variant: 'success',
          title: 'Files deleted',
          description: `Successfully removed ${names.length} item${names.length !== 1 ? 's' : ''}.`
        });
      }
    } catch (err) {
      console.error(err);
      if (window.AuroraToast) {
        window.AuroraToast.show({
          variant: 'danger',
          title: 'Deletion failed',
          description: err.message
        });
      }
    }
  }

  function updateSelectionUI() {
    const selCount = selectedSet.size;

    const selectAllBtn = container.querySelector('#fld-btn-select-all');
    const deselectBtn  = container.querySelector('#fld-btn-deselect-all');
    const delBtn       = container.querySelector('#fld-btn-delete-sel');

    if (selectAllBtn) selectAllBtn.style.display = selCount < filtered.length ? '' : 'none';
    if (deselectBtn)  deselectBtn.style.display  = selCount > 0 ? '' : 'none';
    if (delBtn)       delBtn.disabled             = selCount === 0;

    container.querySelectorAll('[data-fld-ent-name]').forEach(el => {
      el.classList.toggle('is-multiselected', selectedSet.has(el.dataset.fldEntName));
    });
  }

  // ── Grid view ───────────────────────────────────────────────
  function renderGrid(main) {
    main.className = 'fld-main fld-main--grid';
    main.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'fld-grid';
    main.appendChild(grid);

    filtered.forEach((ent, i) => {
      const type = fileType(ent.file.name);
      const cell = document.createElement('div');
      cell.className = `fld-cell${selected?.file.name === ent.file.name ? ' is-selected' : ''}`;
      cell.dataset.idx = i;
      cell.dataset.fldEntName = ent.file.name;

      const url = URL.createObjectURL(ent.file);
      blobUrls.push(url);

      cell.innerHTML = `
        <div class="fld-thumb ${type === 'video' ? 'fld-thumb--video' : ''}">
          ${type === 'video'
            ? `<video src="${url}" class="fld-thumb-vid" preload="metadata" muted></video>
               <div class="fld-thumb-video-badge"><span class="material-symbols-outlined">play_circle</span></div>`
            : `<img src="${url}" class="fld-thumb-img" loading="lazy" draggable="false">`
          }
        </div>
        <div class="fld-cell-name">${escHtml(ent.file.name)}</div>`;

      cell.addEventListener('click', e => {
        handleFileClick(ent, i, e);
      });
      grid.appendChild(cell);
    });
  }

  // ── Filmstrip view ──────────────────────────────────────────
  function renderFilmstrip(main) {
    main.className = 'fld-main fld-main--filmstrip';
    main.innerHTML = `
      <div class="fld-fs-preview" id="fld-fs-preview">
        <div class="empty-state" style="height:100%">
          <span class="material-symbols-outlined" style="font-size:40px">touch_app</span>
          <div class="empty-state-title">Select a file below</div>
        </div>
      </div>
      <div class="fld-fs-strip" id="fld-fs-strip"></div>`;

    const strip = main.querySelector('#fld-fs-strip');
    filtered.forEach((ent, i) => {
      const type = fileType(ent.file.name);
      const thumb = document.createElement('div');
      thumb.className = `fld-fs-thumb${selected?.file.name === ent.file.name ? ' is-selected' : ''}`;
      thumb.dataset.idx = i;
      thumb.dataset.fldEntName = ent.file.name;

      const url = URL.createObjectURL(ent.file);
      blobUrls.push(url);

      thumb.innerHTML = `
        ${type === 'video'
          ? `<video src="${url}" class="fld-fs-thumb-img" preload="metadata" muted></video>
             <span class="fld-fs-video-badge material-symbols-outlined">play_circle</span>`
          : `<img src="${url}" class="fld-fs-thumb-img" loading="lazy" draggable="false">`
        }`;

      thumb.addEventListener('click', e => {
        handleFileClick(ent, i, e);
      });
      strip.appendChild(thumb);
    });

    // If something was selected, show it in main area and sidebar info panel
    if (selected) {
      renderFilmstripPreview(selected);
      showDetailAndHandle();
      renderInfoPanel(detailEl, selected);
    }
  }

  async function renderFilmstripPreview(ent) {
    const preview = container.querySelector('#fld-fs-preview');
    if (!preview) return;
    await renderDetailContent(preview, ent, true);
    // Scroll selected thumb into view
    const strip = container.querySelector('#fld-fs-strip');
    const sel = strip?.querySelector('.fld-fs-thumb.is-selected');
    sel?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // ── List view ───────────────────────────────────────────────
  function renderList(main) {
    main.className = 'fld-main fld-main--list';
    main.innerHTML = `
      <table class="fld-list-table">
        <thead>
          <tr>
            <th class="fld-list-th" style="width:40px"></th>
            <th class="fld-list-th">Name</th>
            <th class="fld-list-th" style="width:80px">Type</th>
            <th class="fld-list-th" style="width:80px">Size</th>
            <th class="fld-list-th" style="width:80px;text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody id="fld-list-body"></tbody>
      </table>`;

    const tbody = main.querySelector('#fld-list-body');
    filtered.forEach((ent, i) => {
      const type = fileType(ent.file.name);
      const tr = document.createElement('tr');
      tr.className = `fld-list-row${selected?.file.name === ent.file.name ? ' is-selected' : ''}`;
      tr.dataset.idx = i;
      tr.dataset.fldEntName = ent.file.name;

      const thumbUrl = URL.createObjectURL(ent.file);
      blobUrls.push(thumbUrl);

      const isSel = selectedSet.has(ent.file.name);
      tr.innerHTML = `
        <td class="fld-list-td">
          ${type === 'video'
            ? `<div class="fld-list-icon"><span class="material-symbols-outlined" style="color:var(--ps-blue)">movie</span></div>`
            : `<img src="${thumbUrl}" class="fld-list-thumb" loading="lazy" draggable="false">`}
        </td>
        <td class="fld-list-td">
          <span class="fld-list-name">${escHtml(ent.file.name)}</span>
        </td>
        <td class="fld-list-td">${type === 'video' ? '<span class="ic-badge ic-badge--blue">MP4</span>' : `<span class="ic-badge">${extOf(ent.file.name).slice(1).toUpperCase()}</span>`}</td>
        <td class="fld-list-td mono text-sm text-muted">${formatBytes(ent.file.size)}</td>
        <td class="fld-list-td" style="text-align:right">
          <button class="btn-icon fld-list-dl" data-idx="${i}" title="Download">
            <span class="material-symbols-outlined" style="font-size:15px">download</span>
          </button>
        </td>`;

      tr.addEventListener('click', e => {
        if (!e.target.closest('.fld-list-dl')) handleFileClick(ent, i, e);
      });
      tr.querySelector('.fld-list-dl')?.addEventListener('click', e => {
        e.stopPropagation();
        downloadFile(ent.file);
      });
      tbody.appendChild(tr);
    });
  }

  // ── Unified Image Workspace ───────────────────────────────
  let fldWorkspace = null;

  async function ensureWorkspace() {
    if (fldWorkspace) return fldWorkspace;
    const { ImageWorkspace } = await import('../components/image-workspace.js');
    
    const wsDiv = document.createElement('div');
    wsDiv.style.flex = "1";
    wsDiv.style.display = "flex";
    wsDiv.style.flexDirection = "column";
    wsDiv.style.minWidth = "0";
    wsDiv.style.minHeight = "0";

    fldWorkspace = new ImageWorkspace(wsDiv, {
      allowUpload: false,
      allowFolder: false,
      customControlsHtml: `
        <button class="btn-icon iw-meta-btn" title="View Extracted AI Metadata">
           <span class="material-symbols-outlined">edit_note</span>
        </button>
      `,
      onBindCustomControls: (container) => {
        container.querySelector('.iw-meta-btn')?.addEventListener('click', async () => {
          if (!fldWorkspace.activeFile) return;
          injectAssetPanelStyles();
          const p = container.querySelector('.iw-stage');
          p.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div class="spinner"></div></div>';
          const ap = await renderAssetPanel(fldWorkspace.activeFile);
          p.innerHTML = '';
          p.style.overflow = 'hidden';
          p.appendChild(ap);
        });
      },
      onRender: async (file) => {
        // Try matching various suffix patterns (underscores or hyphens)
        const baseName    = file.name.replace(/\.[^.]+$/, '');
        const baseNoSuf   = baseName.replace(/[-_][a-z0-9]+$/i, '');
        const inputFile   = inputByBase.get(baseName) || inputByBase.get(baseNoSuf);

        const beforeUrl = URL.createObjectURL(inputFile || file);
        const afterUrl = URL.createObjectURL(file);
        blobUrls.push(beforeUrl, afterUrl);
        
        return {
          beforeUrl,
          afterUrl,
          beforeLabel: inputFile ? 'Input' : 'File',
          afterLabel: inputFile ? 'Output' : 'File',
          context: { filename: file.name },
          canCompare: !!inputFile
        };
      }
    });
    return fldWorkspace;
  }

  // ── Select / detail panel ───────────────────────────────────
  async function selectFile(file) {
    selected = file;

    // Highlight selected cell in current view
    container.querySelectorAll('.fld-cell, .fld-fs-thumb, .fld-list-row').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      el.classList.toggle('is-selected', filtered[idx] === file);
    });

    if (viewMode === 'filmstrip') {
      await renderFilmstripPreview(file);
      showDetailAndHandle();
      renderInfoPanel(detailEl, file);
      return;
    }

    showDetailAndHandle();
    await renderDetailContent(detailEl, file, false);
  }

  /** Render file preview into an element (used by both detail panel + filmstrip preview). */
  async function renderDetailContent(el, ent, fullSize) {
    const file = ent.file;
    const type = fileType(file.name);
    const fileUrl = URL.createObjectURL(file);
    blobUrls.push(fileUrl);

    if (type === 'video') {
      el.innerHTML = `
        <div class="fld-detail-inner">
          ${!fullSize ? `
          <div class="fld-detail-header">
            <div class="fld-detail-title">${escHtml(file.name)}</div>
            <div class="fld-detail-meta">
              <span class="ic-badge" style="background:rgba(0,119,255,.15);color:var(--ps-blue)">Video</span>
              <span class="text-sm text-muted">${formatBytes(file.size)}</span>
            </div>
          </div>` : ''}
          <div class="fld-detail-preview" style="flex:1;display:flex;align-items:center;justify-content:center;background:#000;position:relative">
            <video src="${fileUrl}" class="fld-detail-video" controls preload="metadata"
              style="max-width:100%;max-height:100%;display:block"></video>
          </div>
          ${!fullSize ? `
          <div class="fld-detail-footer">
            <button class="btn-secondary" style="width:100%" onclick="(function(u,n){const a=document.createElement('a');a.href=u;a.download=n;a.click()})('${fileUrl}','${escHtml(file.name)}')">
              <span class="material-symbols-outlined">download</span> Download
            </button>
          </div>` : ''}
        </div>`;
    } else {
      const ws = await ensureWorkspace();
      
      el.innerHTML = `
        <div class="fld-detail-inner">
          ${!fullSize ? `
          <div class="fld-detail-header">
            <div class="fld-detail-title">${escHtml(file.name)}</div>
            <div class="fld-detail-meta">
              <span class="ic-badge">${extOf(file.name).slice(1).toUpperCase()}</span>
              <span class="text-sm text-muted">${formatBytes(file.size)}</span>
            </div>
          </div>` : ''}
          <div class="fld-detail-preview" id="fld-ws-mount" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>
          ${!fullSize ? `
          <div class="fld-detail-footer">
            <button class="btn-secondary" style="flex:1" onclick="(function(u,n){const a=document.createElement('a');a.href=u;a.download=n;a.click()})('${fileUrl}','${escHtml(file.name)}')">
              <span class="material-symbols-outlined">download</span> Download
            </button>
            ${run?.recipeId ? `<button class="btn-secondary fld-btn-set-thumb" title="Set as recipe thumbnail">
              <span class="material-symbols-outlined">photo_library</span>
            </button>` : ''}
          </div>` : ''}
        </div>`;

      const mountNode = el.querySelector('#fld-ws-mount');
      mountNode.appendChild(ws.container);
      el.querySelector('.fld-btn-set-thumb')?.addEventListener('click', e => wireThumbBtn(file, e.currentTarget));
      
      ws.setFiles([file]);

    }
  }

  async function renderInfoPanel(el, ent) {
    const file = ent.file;
    const type = fileType(file.name);
    const fileUrl = URL.createObjectURL(file);
    blobUrls.push(fileUrl);
    el.innerHTML = `
      <div class="fld-detail-inner">
        <div class="fld-detail-header">
          <div class="fld-detail-title">${escHtml(file.name)}</div>
          <div class="fld-detail-meta">
            ${type === 'video'
              ? `<span class="ic-badge" style="background:rgba(0,119,255,.15);color:var(--ps-blue)">Video</span>`
              : `<span class="ic-badge">${extOf(file.name).slice(1).toUpperCase()}</span>`
            }
            <span class="text-sm text-muted">${formatBytes(file.size)}</span>
          </div>
        </div>
        <div class="fld-detail-preview" id="fld-info-panel-view">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;gap:8px">
            <div class="spinner"></div><span class="text-sm text-muted">Reading metadata…</span>
          </div>
        </div>
        <div class="fld-detail-footer">
          <button class="btn-secondary" style="flex:1" onclick="(function(u,n){const a=document.createElement('a');a.href=u;a.download=n;a.click()})('${fileUrl}','${escHtml(file.name)}')">
            <span class="material-symbols-outlined">download</span> Download
          </button>
          ${run?.recipeId ? `<button class="btn-secondary fld-btn-set-thumb" title="Set as recipe thumbnail">
            <span class="material-symbols-outlined">photo_library</span>
          </button>` : ''}
        </div>
      </div>`;
    el.querySelector('.fld-btn-set-thumb')?.addEventListener('click', e => wireThumbBtn(file, e.currentTarget));
    const view = el.querySelector('#fld-info-panel-view');
    if (!view) return;
    const info = await getImageInfo(file);
    view.innerHTML = '';
    view.appendChild(renderImageInfoPanel(info));
    // Append extracted metadata (geocode, OCR, vision, custom) below embedded EXIF
    const extracted = await renderExtractedMetadataForSidebar(file);
    if (extracted) view.appendChild(extracted);
  }

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a   = document.createElement('a');
    a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function wireThumbBtn(file, btn) {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<img src="/assets/animated_logo.gif" style="width:18px;height:18px;display:block">`;
    }
    try {
      await setRecipeThumbnail(run.recipeId, file);
      window.AuroraToast?.show({
        variant: 'success',
        title: 'Recipe thumbnail updated',
        description: 'The recipe card in the Library will now show this image.',
      });
    } catch (err) {
      window.AuroraToast?.show({ variant: 'danger', title: 'Failed to set thumbnail', description: err.message });
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined">photo_library</span>`;
      }
    }
  }

  function revokeBlobUrls() {
    blobUrls.forEach(u => URL.revokeObjectURL(u));
    blobUrls = [];
  }

  // ── Slideshow ──────────────────────────────────────────────
  function startSlideshow(images) {
    slideshowIdx = 0;
    slideshowIsPlaying = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'fld-ss-overlay';
    overlay.innerHTML = `
      <div class="fld-ss-header">
        <div class="fld-ss-title">Slideshow</div>
        <div class="fld-ss-counter">1 / ${images.length}</div>
        <div style="flex:1"></div>
        <div class="fld-ss-controls">
          <button class="fld-ss-btn" id="fld-ss-prev" title="Previous (Left Arrow)">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button class="fld-ss-btn" id="fld-ss-play" title="Play/Pause (Space)">
            <span class="material-symbols-outlined" id="fld-ss-play-icon">pause</span>
          </button>
          <button class="fld-ss-btn" id="fld-ss-next" title="Next (Right Arrow)">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
          <div class="fld-ss-sep"></div>
          <select class="fld-ss-speed" id="fld-ss-speed">
            <option value="2000">2s</option>
            <option value="3000" selected>3s</option>
            <option value="5000">5s</option>
            <option value="10000">10s</option>
          </select>
        </div>
        <button class="fld-ss-close" id="fld-ss-close" title="Close (Esc)">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="fld-ss-main" id="fld-ss-main"></div>
    `;
    document.body.appendChild(overlay);

    const main    = overlay.querySelector('#fld-ss-main');
    const counter = overlay.querySelector('.fld-ss-counter');
    const playIcon = overlay.querySelector('#fld-ss-play-icon');

    function showItem(idx) {
      slideshowIdx = (idx + images.length) % images.length;
      const ent = images[slideshowIdx];
      const url = URL.createObjectURL(ent.file);
      main.innerHTML = `<img src="${url}" class="fld-ss-img">`;
      counter.textContent = `${slideshowIdx + 1} / ${images.length}`;
      
      // Auto-revoke after some time or on next show
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    function togglePlay() {
      slideshowIsPlaying = !slideshowIsPlaying;
      playIcon.textContent = slideshowIsPlaying ? 'pause' : 'play_arrow';
      if (slideshowIsPlaying) startTimer();
      else stopTimer();
    }

    function startTimer() {
      stopTimer();
      slideshowTimer = setInterval(() => {
        showItem(slideshowIdx + 1);
      }, slideshowSpeed);
    }

    function stopTimer() {
      clearInterval(slideshowTimer);
    }

    function close() {
      stopTimer();
      overlay.remove();
      document.removeEventListener('keydown', handleKey);
    }

    function handleKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowLeft') { showItem(slideshowIdx - 1); if (slideshowIsPlaying) startTimer(); }
      if (e.key === 'ArrowRight') { showItem(slideshowIdx + 1); if (slideshowIsPlaying) startTimer(); }
    }

    overlay.querySelector('#fld-ss-prev').onclick = () => { showItem(slideshowIdx - 1); if (slideshowIsPlaying) startTimer(); };
    overlay.querySelector('#fld-ss-next').onclick = () => { showItem(slideshowIdx + 1); if (slideshowIsPlaying) startTimer(); };
    overlay.querySelector('#fld-ss-play').onclick = togglePlay;
    overlay.querySelector('#fld-ss-close').onclick = close;
    overlay.querySelector('#fld-ss-speed').onchange = (e) => {
      slideshowSpeed = parseInt(e.target.value);
      if (slideshowIsPlaying) startTimer();
    };

    document.addEventListener('keydown', handleKey);
    showItem(0);
    if (slideshowIsPlaying) startTimer();
  }

  return () => {
    revokeBlobUrls();
    clearInterval(slideshowTimer);
    document.removeEventListener('mousemove', _onResizeMove);
    document.removeEventListener('mouseup',   _onResizeUp);
  };
}

// ── Styles ──────────────────────────────────────────────────
let _fldStyles = false;
function injectFldStyles() {
  if (_fldStyles) return;
  _fldStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .fld-screen { display:flex; flex-direction:column; height:100%; }

    /* Toolbar */
    .fld-toolbar {
      display:flex; align-items:center; gap:8px; padding:8px 14px;
      border-bottom:1px solid var(--ps-border); background:var(--ps-bg-surface);
      flex-shrink:0; flex-wrap:wrap;
    }
    .fld-breadcrumb { display:flex; align-items:center; gap:4px; min-width:0; }
    .fld-crumb-recipe { font-size:13px; font-weight:600; color:var(--ps-text); white-space:nowrap; max-width:180px; overflow:hidden; text-overflow:ellipsis; }
    .fld-crumb-sep { font-size:16px; color:var(--ps-text-faint); flex-shrink:0; }
    .fld-crumb-folder { font-size:12px; font-family:var(--font-mono); color:var(--ps-blue); white-space:nowrap; }
    .fld-view-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden; }
    .fld-view-btn { display:flex; align-items:center; padding:6px 9px; background:transparent; border:none; color:var(--ps-text-muted); cursor:pointer; transition:background 150ms,color 150ms; }
    .fld-view-btn .material-symbols-outlined { font-size:16px; }
    .fld-view-btn.is-active { background:var(--ps-blue); color:#fff; }
    .fld-view-btn:hover:not(.is-active) { background:var(--ps-bg-hover); color:var(--ps-text); }
    .fld-sort-row select { background:var(--ps-bg-app); border:1px solid var(--ps-border); color:var(--ps-text); border-radius:6px; }
    .fld-filter-chips { display:flex; gap:4px; align-items:center; }
    .fld-chip {
      display:flex; align-items:center; gap:4px; padding:4px 10px;
      font-size:11px; font-weight:500; border-radius:20px;
      border:1px solid var(--ps-border); background:transparent;
      color:var(--ps-text-muted); cursor:pointer; transition:all 120ms;
      font-family:var(--font-primary);
    }
    .fld-chip:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .fld-chip.is-active { background:var(--ps-blue); border-color:var(--ps-blue); color:#fff; }
    .fld-chip-count { background:rgba(255,255,255,0.2); border-radius:10px; padding:0 5px; font-size:10px; }
    .fld-chip.is-active .fld-chip-count { background:rgba(255,255,255,0.25); }

    /* Body layout */
    .fld-body { display:flex; flex:1; overflow:hidden; }

    /* Main */
    .fld-main { flex:1; overflow:auto; padding:12px; }

    /* Grid view */
    .fld-main--grid { }
    .fld-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; }
    .fld-cell {
      display:flex; flex-direction:column; gap:5px; padding:6px;
      border-radius:10px; border:2px solid transparent; cursor:pointer;
      transition:background 100ms, border-color 150ms;
    }
    .fld-cell:hover { background:var(--ps-bg-hover); }
    .fld-cell.is-selected { border-color:var(--ps-blue); background:rgba(0,119,255,0.06); }
    .fld-cell.is-multiselected, .fld-fs-thumb.is-multiselected, .fld-list-row.is-multiselected { background:rgba(0,119,255,0.12) !important; color:var(--ps-text) !important; }
    .fld-cell.is-multiselected { border-color:var(--ps-blue); }

    .fld-thumb {
      aspect-ratio:1; border-radius:8px; overflow:hidden;
      background:var(--ps-bg-surface); border:1px solid var(--ps-border);
      position:relative;
    }
    .fld-thumb--video { }
    .fld-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }
    .fld-thumb-vid { width:100%; height:100%; object-fit:cover; display:block; }
    .fld-thumb-video-badge {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.4);
    }
    .fld-thumb-video-badge .material-symbols-outlined { font-size:36px; color:rgba(255,255,255,0.9); }
    .fld-cell-name { font-size:10px; color:var(--ps-text-muted); font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center; }

    /* Filmstrip view */
    .fld-main--filmstrip { display:flex; flex-direction:column; padding:0; }
    .fld-fs-preview {
      flex:1; overflow:hidden; border-bottom:1px solid var(--ps-border);
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%,var(--ps-bg-app) 0% 50%) 0 0/24px 24px;
    }
    .fld-fs-strip {
      height:110px; min-height:110px; display:flex; gap:6px; overflow-x:auto; overflow-y:hidden;
      padding:8px 12px; background:var(--ps-bg-surface); align-items:center;
      scrollbar-width:thin;
    }
    .fld-fs-thumb {
      height:88px; width:88px; min-width:88px; border-radius:8px; overflow:hidden;
      border:2px solid transparent; cursor:pointer; position:relative; flex-shrink:0;
      background:var(--ps-bg-app); transition:border-color 150ms;
    }
    .fld-fs-thumb:hover { border-color:var(--ps-border); }
    .fld-fs-thumb.is-selected { border-color:var(--ps-blue); }
    .fld-fs-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }
    .fld-fs-video-badge { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:28px; color:rgba(255,255,255,0.9); background:rgba(0,0,0,0.35); }

    /* List view */
    .fld-main--list { padding:0; }
    .fld-list-table { width:100%; border-collapse:collapse; }
    .fld-list-th { padding:8px 12px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--ps-text-faint); border-bottom:1px solid var(--ps-border); position:sticky; top:0; background:var(--ps-bg-surface); z-index:2; }
    .fld-list-row { cursor:pointer; transition:background 80ms; border-bottom:1px solid var(--ps-border); }

    /* Slideshow Overlay */
    .fld-ss-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:9999;
      display:flex; flex-direction:column; color:#fff; font-family:var(--font-primary);
      backdrop-filter:blur(10px);
    }
    .fld-ss-header {
      display:flex; align-items:center; padding:12px 20px; background:rgba(20,20,20,0.8);
      border-bottom:1px solid rgba(255,255,255,0.1);
    }
    .fld-ss-title { font-weight:600; font-size:14px; margin-right:15px; color:var(--ps-blue); }
    .fld-ss-counter { font-family:var(--font-mono); font-size:12px; color:rgba(255,255,255,0.5); }
    .fld-ss-controls { display:flex; align-items:center; gap:10px; }
    .fld-ss-btn {
      background:transparent; border:none; color:#fff; cursor:pointer;
      width:36px; height:36px; display:flex; align-items:center; justify-content:center;
      border-radius:50%; transition:background 150ms;
    }
    .fld-ss-btn:hover { background:rgba(255,255,255,0.1); }
    .fld-ss-btn .material-symbols-outlined { font-size:24px; }
    .fld-ss-sep { width:1px; height:20px; background:rgba(255,255,255,0.15); margin:0 5px; }
    .fld-ss-speed {
      background:transparent; border:1px solid rgba(255,255,255,0.2); color:#fff;
      font-size:11px; border-radius:5px; padding:2px 4px; outline:none;
    }
    .fld-ss-speed option { background:#222; }
    .fld-ss-close {
      background:transparent; border:none; color:rgba(255,255,255,0.6); cursor:pointer;
      margin-left:20px; transition:color 150ms;
    }
    .fld-ss-close:hover { color:#fff; }
    .fld-ss-main { flex:1; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
    .fld-ss-img { max-width:100%; max-height:100%; object-fit:contain; animation:ss-fade 400ms ease-out; }
    @keyframes ss-fade {
      from { opacity:0; transform:scale(0.98); }
      to { opacity:1; transform:scale(1); }
    }
    .fld-list-row:hover { background:var(--ps-bg-hover); }
    .fld-list-row.is-selected { background:rgba(0,119,255,0.07); }
    .fld-list-td { padding:6px 12px; vertical-align:middle; }
    .fld-list-thumb { width:36px; height:36px; object-fit:cover; border-radius:6px; display:block; }
    .fld-list-icon { width:36px; height:36px; display:flex; align-items:center; justify-content:center; }
    .fld-list-name { font-size:12px; color:var(--ps-text); font-family:var(--font-mono); }

    /* Resize handle between main and detail */
    .fld-resize-handle {
      width:5px; flex-shrink:0; cursor:col-resize;
      background:var(--ps-border);
      transition:background 120ms;
      position:relative;
    }
    .fld-resize-handle:hover, .fld-resize-handle.is-dragging {
      background:var(--ps-blue);
    }

    /* Detail panel */
    .fld-detail {
      min-width:220px; border:none;
      display:flex; flex-direction:column; overflow:hidden; flex-shrink:0;
      background:var(--ps-bg-app);
    }
    .fld-detail-inner { display:flex; flex-direction:column; height:100%; }
    .fld-detail-header { padding:12px 14px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .fld-detail-title { font-size:12px; font-weight:600; color:var(--ps-text); font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:6px; }
    .fld-detail-meta { display:flex; gap:6px; align-items:center; }
    .fld-detail-cmp-toolbar { display:flex; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .fld-detail-preview {
      flex:1; overflow:hidden; position:relative;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%,var(--ps-bg-app) 0% 50%) 0 0/20px 20px;
    }
    .fld-detail-footer { padding:10px 14px; border-top:1px solid var(--ps-border); flex-shrink:0; display:flex; gap:6px; align-items:center; }
    .fld-detail-video { background:#000; }


    .fld-modal {
      border:none; border-radius:16px; padding:0; background:var(--ps-bg-surface);
      box-shadow:0 24px 80px rgba(0,0,0,0.5); color:var(--ps-text);
      width:360px; max-width:90vw; outline:none;
    }
    .fld-modal::backdrop { background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); }
    .fld-modal-content { padding:24px; display:flex; flex-direction:column; align-items:center; text-align:center; }
    .fld-modal-icon {
      width:56px; height:56px; border-radius:28px; display:flex; align-items:center; justify-content:center;
      margin-bottom:16px;
    }
    .fld-modal-icon--danger { background:rgba(239,68,68,0.1); color:#ef4444; }
    .fld-modal-icon .material-symbols-outlined { font-size:32px; }
    .fld-modal-title { font-size:18px; font-weight:700; margin-bottom:8px; }
    .fld-modal-body { font-size:14px; color:var(--ps-text-muted); line-height:1.5; margin-bottom:24px; }
    .fld-modal-footer { display:flex; gap:12px; width:100%; }
    .fld-modal-footer button { flex:1; justify-content:center; padding:10px; }
  `;
  document.head.appendChild(s);
}
