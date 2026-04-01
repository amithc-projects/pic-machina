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
import { getFolder }                                 from '../data/folders.js';
import { navigate }                                  from '../main.js';
import { formatBytes }                               from '../utils/misc.js';
import { getImageInfo, renderImageInfoPanel,
         injectImageInfoStyles }                     from '../utils/image-info.js';
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

  // No run specified — show prompt to come from output history
  if (!runId) {
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
            <div class="empty-state-desc">Open the folder viewer from a completed batch run.</div>
            <button class="btn-primary" id="fld-go-out">
              <span class="material-symbols-outlined">history</span> Go to Output History
            </button>
          </div>
        </div>
      </div>`;
    container.querySelector('#fld-go-out')?.addEventListener('click', () => navigate('#out'));
    return;
  }

  container.innerHTML = `
    <div class="screen fld-screen">
      <div class="fld-toolbar">
        <button class="btn-icon" id="fld-back" title="Back">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="fld-breadcrumb">
          <span class="fld-crumb-recipe">${escHtml(run?.recipeName || 'Output')}</span>
          <span class="material-symbols-outlined fld-crumb-sep">chevron_right</span>
          <span class="fld-crumb-folder">${escHtml(run?.outputFolder || 'output')}/</span>
        </div>

        <div style="flex:1"></div>

        <div id="fld-selection-actions" class="flex items-center gap-1" style="display:none;margin-right:8px">
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
        <div class="fld-detail" id="fld-detail" style="display:none"></div>
      </div>
    </div>`;

  injectFldStyles();
  injectImageInfoStyles();

  container.querySelector('#fld-back')?.addEventListener('click', () => navigate(`#${fromRoute}`));

  // ── State ───────────────────────────────────────────────────
  let allEntries = [];   // { file: File, handle: FileSystemFileHandle }[]
  let inputFiles = [];   // File[] from input folder for comparison
  let inputByBase = new Map();
  let filtered   = [];   // MediaEntry[] current filtered+sorted list
  let viewMode   = 'grid';
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
      container.querySelectorAll('[data-fld-view]').forEach(b => b.classList.toggle('is-active', b === btn));
      renderMain();
    });
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
    const outputHandle = await getFolder('output');
    if (!outputHandle) {
      showEmpty('Output folder not accessible. Grant permission in Batch Setup.');
      return;
    }

    const subfolder = run?.outputFolder || 'output';
    let subHandle;
    try {
      subHandle = await outputHandle.getDirectoryHandle(subfolder);
    } catch {
      showEmpty(`Subfolder "${subfolder}" not found.`);
      return;
    }

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
      const outputHandle = await getFolder('output');
      const subfolder = run?.outputFolder || 'output';
      const subHandle = await outputHandle.getDirectoryHandle(subfolder);

      for (const name of names) {
        const ent = allEntries.find(e => e.file.name === name);
        if (ent) {
          // Use parentHandle.removeEntry for better reliability
          await subHandle.removeEntry(name);
        }
      }

      // Refresh data
      allEntries = await listAllMedia(subHandle);
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
    const actions = container.querySelector('#fld-selection-actions');
    if (actions) actions.style.display = selCount > 0 ? 'flex' : 'none';

    const delBtn = container.querySelector('#fld-btn-delete-sel');
    if (delBtn) delBtn.disabled = selCount === 0;

    container.querySelectorAll('[data-fld-ent-name]').forEach(el => {
      const name = el.dataset.fldEntName;
      const isSelected = selectedSet.has(name);
      el.classList.toggle('is-multiselected', isSelected);
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

    // If something was selected, show it
    if (selected) renderFilmstripPreview(selected);
  }

  function renderFilmstripPreview(ent) {
    const preview = container.querySelector('#fld-fs-preview');
    if (!preview) return;
    renderDetailContent(preview, ent, true);
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

  // ── Select / detail panel ───────────────────────────────────
  function selectFile(file) {
    selected = file;

    // Highlight selected cell in current view
    container.querySelectorAll('.fld-cell, .fld-fs-thumb, .fld-list-row').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      el.classList.toggle('is-selected', filtered[idx] === file);
    });

    if (viewMode === 'filmstrip') {
      renderFilmstripPreview(file);
      return; // filmstrip uses inline preview, no side panel
    }

    const detail = container.querySelector('#fld-detail');
    if (!detail) return;
    detail.style.display = 'flex';
    renderDetailContent(detail, file, false);
  }

  /** Render file preview into an element (used by both detail panel + filmstrip preview). */
  function renderDetailContent(el, ent, fullSize) {
    const file = ent.file;
    const type = fileType(file.name);
    const fileUrl = URL.createObjectURL(file);
    blobUrls.push(fileUrl);

    // Find matching input file
    const baseName    = file.name.replace(/\.[^.]+$/, '');
    const baseNoSuf   = baseName.replace(/_[a-z0-9]+$/i, '');
    const inputFile   = inputByBase.get(baseName) || inputByBase.get(baseNoSuf) || null;
    const inputUrl    = inputFile ? URL.createObjectURL(inputFile) : null;
    if (inputUrl) blobUrls.push(inputUrl);

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
    } else if (inputUrl) {
      // Image with before/after compare
      let sliderPct = 50;
      let isDragging = false;
      let cmpMode = 'slider';

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
          <div class="fld-detail-cmp-toolbar">
            <div class="fld-cmp-toggle" role="group">
              <button class="fld-cmp-btn" data-cmp-mode="slider">
                <span class="material-symbols-outlined" style="font-size:13px">swap_horiz</span> Slider
              </button>
              <button class="fld-cmp-btn" data-cmp-mode="side">
                <span class="material-symbols-outlined" style="font-size:13px">view_column</span> Side
              </button>
            </div>
            <button class="fld-cmp-btn" data-cmp-mode="info" style="margin-left:8px;border-radius:8px;border:1px solid var(--ps-border);padding:4px 9px">
              <span class="material-symbols-outlined" style="font-size:13px">info</span> Info
            </button>
          </div>
          <div class="fld-detail-preview" id="fld-cmp-view">
          </div>
          ${!fullSize ? `
          <div class="fld-detail-footer">
            <button class="btn-secondary" style="width:100%" onclick="(function(u,n){const a=document.createElement('a');a.href=u;a.download=n;a.click()})('${fileUrl}','${escHtml(file.name)}')">
              <span class="material-symbols-outlined">download</span> Download
            </button>
          </div>` : ''}
        </div>`;

      el.querySelectorAll('.fld-cmp-btn[data-cmp-mode]').forEach(btn => {
        if (btn.dataset.cmpMode === cmpMode) btn.classList.add('is-active');
        btn.addEventListener('click', () => {
          if (btn.dataset.cmpMode !== 'info') {
            cmpMode = btn.dataset.cmpMode;
            localStorage.setItem('ic-cmp-mode', cmpMode);
          }
          el.querySelectorAll('.fld-cmp-btn[data-cmp-mode]').forEach(b => b.classList.toggle('is-active', b === btn));
          if (btn.dataset.cmpMode === 'info') renderInfo();
          else renderCmp();
        });
      });

      async function renderInfo() {
        const cmpEl = el.querySelector('#fld-cmp-view');
        if (!cmpEl) return;
        cmpEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;gap:8px"><div class="spinner"></div><span class="text-sm text-muted">Reading metadata…</span></div>';
        const info = await getImageInfo(file);
        cmpEl.innerHTML = '';
        cmpEl.appendChild(renderImageInfoPanel(info));
      }

      function renderCmp() {
        const cmpEl = el.querySelector('#fld-cmp-view');
        if (!cmpEl) return;

        if (cmpMode === 'side') {
          cmpEl.innerHTML = `
            <div class="fld-cmp-side">
              <div class="fld-cmp-col">
                <span class="fld-cmp-label">Before</span>
                <img src="${inputUrl}" class="fld-cmp-img" draggable="false">
              </div>
              <div class="fld-cmp-divider"></div>
              <div class="fld-cmp-col">
                <span class="fld-cmp-label fld-cmp-label--after">After</span>
                <img src="${fileUrl}" class="fld-cmp-img" draggable="false">
              </div>
            </div>`;
        } else {
          sliderPct = 50;
          cmpEl.innerHTML = `
            <div class="fld-cmp-slider" id="fld-slider-root">
              <img src="${inputUrl}" class="fld-cmp-img" draggable="false">
              <img src="${fileUrl}"  class="fld-cmp-img" id="fld-slider-after" draggable="false"
                   style="clip-path:inset(0 0 0 50%)">
              <div class="fld-cmp-handle" id="fld-slider-handle" style="left:50%">
                <div class="fld-cmp-handle-line"></div>
                <div class="fld-cmp-handle-grip">
                  <span class="material-symbols-outlined" style="font-size:16px">swap_horiz</span>
                </div>
              </div>
              <span class="fld-cmp-badge fld-cmp-badge--before">Before</span>
              <span class="fld-cmp-badge fld-cmp-badge--after">After</span>
            </div>`;

          const root     = cmpEl.querySelector('#fld-slider-root');
          const afterImg = cmpEl.querySelector('#fld-slider-after');
          const handle   = cmpEl.querySelector('#fld-slider-handle');

          function setSlider(x) {
            const rect = root.getBoundingClientRect();
            sliderPct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
            if (afterImg) afterImg.style.clipPath = `inset(0 0 0 ${sliderPct}%)`;
            if (handle)   handle.style.left = `${sliderPct}%`;
          }
          handle?.addEventListener('mousedown', e => { isDragging = true; e.preventDefault(); });
          document.addEventListener('mousemove', e => { if (isDragging) setSlider(e.clientX); });
          document.addEventListener('mouseup',   () => { isDragging = false; });
          root?.addEventListener('click', e => { if (!isDragging) setSlider(e.clientX); });
        }
      }
      renderCmp();
    } else {
      // Image without original — preview + info
      let noSrcMode = 'preview';
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
          <div class="fld-detail-cmp-toolbar">
            <div class="fld-cmp-toggle" role="group">
              <button class="fld-cmp-btn" data-nosrc-mode="preview">
                <span class="material-symbols-outlined" style="font-size:13px">image</span> Preview
              </button>
              <button class="fld-cmp-btn" data-nosrc-mode="info">
                <span class="material-symbols-outlined" style="font-size:13px">info</span> Info
              </button>
            </div>
          </div>
          <div class="fld-detail-preview" id="fld-nosrc-view">
            <img src="${fileUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block" draggable="false">
          </div>
          ${!fullSize ? `
          <div class="fld-detail-footer">
            <button class="btn-secondary" style="width:100%" onclick="(function(u,n){const a=document.createElement('a');a.href=u;a.download=n;a.click()})('${fileUrl}','${escHtml(file.name)}')">
              <span class="material-symbols-outlined">download</span> Download
            </button>
          </div>` : ''}
        </div>`;

      el.querySelectorAll('.fld-cmp-btn[data-nosrc-mode]').forEach(btn => {
        btn.addEventListener('click', async () => {
          noSrcMode = btn.dataset.nosrcMode;
          el.querySelectorAll('.fld-cmp-btn[data-nosrc-mode]').forEach(b => b.classList.toggle('is-active', b === btn));
          const view = el.querySelector('#fld-nosrc-view');
          if (!view) return;
          if (noSrcMode === 'info') {
            view.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;gap:8px"><div class="spinner"></div><span class="text-sm text-muted">Reading metadata…</span></div>';
            const info = await getImageInfo(file);
            view.innerHTML = '';
            view.appendChild(renderImageInfoPanel(info));
          } else {
            view.innerHTML = `<img src="${fileUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block" draggable="false">`;
          }
        });
      });
    }
  }

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a   = document.createElement('a');
    a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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

  return () => { revokeBlobUrls(); clearInterval(slideshowTimer); };
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

    /* Detail panel */
    .fld-detail {
      width:340px; min-width:340px; border-left:1px solid var(--ps-border);
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
    .fld-detail-footer { padding:10px 14px; border-top:1px solid var(--ps-border); flex-shrink:0; }
    .fld-detail-video { background:#000; }

    /* Mode toggle */
    .fld-cmp-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden; }
    .fld-cmp-btn { display:flex; align-items:center; gap:5px; padding:4px 9px; font-size:11px; font-weight:500; background:transparent; border:none; color:var(--ps-text-muted); cursor:pointer; font-family:var(--font-primary); transition:background 150ms,color 150ms; }
    .fld-cmp-btn.is-active { background:var(--ps-blue); color:#fff; }
    .fld-cmp-btn:hover:not(.is-active) { background:var(--ps-bg-hover); color:var(--ps-text); }

    /* Self-contained comparison images — fill the positioned parent absolutely */
    .fld-cmp-img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; }

    /* Side-by-side layout */
    .fld-cmp-side { display:flex; width:100%; height:100%; }
    .fld-cmp-col { flex:1; position:relative; overflow:hidden; min-width:0; }
    .fld-cmp-divider { width:2px; background:var(--ps-border); flex-shrink:0; }
    .fld-cmp-label { position:absolute; top:10px; left:10px; z-index:2; background:rgba(0,0,0,0.72); color:#fff; font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; font-family:var(--font-mono); }
    .fld-cmp-label--after { background:rgba(0,119,255,0.85); }

    /* Slider layout */
    .fld-cmp-slider { position:relative; width:100%; height:100%; overflow:hidden; user-select:none; cursor:col-resize; }
    .fld-cmp-handle { position:absolute; top:0; height:100%; transform:translateX(-50%); display:flex; align-items:center; pointer-events:none; z-index:10; }
    .fld-cmp-handle-line { position:absolute; top:0; left:50%; width:2px; height:100%; background:rgba(255,255,255,0.9); transform:translateX(-50%); box-shadow:0 0 8px rgba(0,0,0,0.4); }
    .fld-cmp-handle-grip { position:relative; z-index:1; width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.95); box-shadow:0 2px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; cursor:col-resize; pointer-events:all; color:#111; }
    .fld-cmp-badge { position:absolute; top:10px; z-index:5; background:rgba(0,0,0,0.72); color:#fff; font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; font-family:var(--font-mono); pointer-events:none; }
    /* Lightbox slider vs Side logic */
    .fld-cmp-badge--before { left:10px; }
    .fld-cmp-badge--after { right:10px; background:rgba(0,119,255,0.85); }

    /* Modals */
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
