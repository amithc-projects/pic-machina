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

/** Read ALL media files (images + video) from a directory handle. */
async function listAllMedia(dirHandle) {
  const files = [];
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind !== 'file') continue;
    const ext = extOf(name);
    if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
      files.push(await entry.getFile());
    }
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function render(container, hash) {
  const params    = new URLSearchParams((hash || '').split('?')[1] || '');
  const runId     = params.get('run');
  const fromRoute = params.get('from') || 'out'; // back nav target

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
  let allFiles   = [];   // File[]
  let inputFiles = [];   // File[] from input folder for comparison
  let inputByBase = new Map();
  let filtered   = [];   // current filtered+sorted list
  let viewMode   = 'grid';
  let filterType = 'all';
  let sortKey    = 'name';
  let selected   = null; // File | null
  let blobUrls   = [];   // track for cleanup

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

    allFiles = await listAllMedia(subHandle);

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
    allFiles.forEach(f => { counts[fileType(f.name)] = (counts[fileType(f.name)] || 0) + 1; });
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
    filtered = allFiles.filter(f => filterType === 'all' || fileType(f.name) === filterType);
    // Sort
    filtered.sort((a, b) => {
      if (sortKey === 'type') return fileType(a.name).localeCompare(fileType(b.name)) || a.name.localeCompare(b.name);
      if (sortKey === 'size') return b.size - a.size;
      return a.name.localeCompare(b.name);
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
      return;
    }

    if (viewMode === 'grid')       renderGrid(main);
    else if (viewMode === 'filmstrip') renderFilmstrip(main);
    else                           renderList(main);
  }

  // ── Grid view ───────────────────────────────────────────────
  function renderGrid(main) {
    main.className = 'fld-main fld-main--grid';
    main.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'fld-grid';
    main.appendChild(grid);

    filtered.forEach((file, i) => {
      const type = fileType(file.name);
      const cell = document.createElement('div');
      cell.className = `fld-cell${selected?.name === file.name ? ' is-selected' : ''}`;
      cell.dataset.idx = i;

      if (type === 'video') {
        const url = URL.createObjectURL(file);
        blobUrls.push(url);
        cell.innerHTML = `
          <div class="fld-thumb fld-thumb--video">
            <video src="${url}" class="fld-thumb-vid" preload="metadata" muted></video>
            <div class="fld-thumb-video-badge"><span class="material-symbols-outlined">play_circle</span></div>
          </div>
          <div class="fld-cell-name">${escHtml(file.name)}</div>`;
      } else {
        const url = URL.createObjectURL(file);
        blobUrls.push(url);
        cell.innerHTML = `
          <div class="fld-thumb">
            <img src="${url}" class="fld-thumb-img" loading="lazy" draggable="false">
          </div>
          <div class="fld-cell-name">${escHtml(file.name)}</div>`;
      }

      cell.addEventListener('click', () => selectFile(file));
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
    filtered.forEach((file, i) => {
      const type = fileType(file.name);
      const thumb = document.createElement('div');
      thumb.className = `fld-fs-thumb${selected?.name === file.name ? ' is-selected' : ''}`;
      thumb.dataset.idx = i;

      if (type === 'video') {
        const url = URL.createObjectURL(file);
        blobUrls.push(url);
        thumb.innerHTML = `
          <video src="${url}" class="fld-fs-thumb-img" preload="metadata" muted></video>
          <span class="fld-fs-video-badge material-symbols-outlined">play_circle</span>`;
      } else {
        const url = URL.createObjectURL(file);
        blobUrls.push(url);
        thumb.innerHTML = `<img src="${url}" class="fld-fs-thumb-img" loading="lazy" draggable="false">`;
      }

      thumb.addEventListener('click', () => selectFile(file));
      strip.appendChild(thumb);
    });

    // If something was selected, show it
    if (selected) renderFilmstripPreview(selected);
  }

  function renderFilmstripPreview(file) {
    const preview = container.querySelector('#fld-fs-preview');
    if (!preview) return;
    renderDetailContent(preview, file, true);
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
    filtered.forEach((file, i) => {
      const type = fileType(file.name);
      const tr = document.createElement('tr');
      tr.className = `fld-list-row${selected?.name === file.name ? ' is-selected' : ''}`;
      tr.dataset.idx = i;

      const icon = type === 'video' ? 'movie' : 'image';
      const badge = type === 'video'
        ? '<span class="ic-badge" style="background:rgba(0,119,255,.15);color:var(--ps-blue)">MP4</span>'
        : `<span class="ic-badge">${extOf(file.name).slice(1).toUpperCase()}</span>`;

      const thumbUrl = URL.createObjectURL(file);
      blobUrls.push(thumbUrl);

      tr.innerHTML = `
        <td class="fld-list-td">
          ${type === 'video'
            ? `<div class="fld-list-icon"><span class="material-symbols-outlined" style="color:var(--ps-blue)">movie</span></div>`
            : `<img src="${thumbUrl}" class="fld-list-thumb" loading="lazy" draggable="false">`}
        </td>
        <td class="fld-list-td">
          <span class="fld-list-name">${escHtml(file.name)}</span>
        </td>
        <td class="fld-list-td">${badge}</td>
        <td class="fld-list-td mono text-sm text-muted">${formatBytes(file.size)}</td>
        <td class="fld-list-td" style="text-align:right">
          <button class="btn-icon fld-list-dl" data-idx="${i}" title="Download">
            <span class="material-symbols-outlined" style="font-size:15px">download</span>
          </button>
        </td>`;

      tr.addEventListener('click', e => { if (!e.target.closest('.fld-list-dl')) selectFile(file); });
      tr.querySelector('.fld-list-dl')?.addEventListener('click', e => {
        e.stopPropagation();
        downloadFile(file);
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
  function renderDetailContent(el, file, fullSize) {
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
              <button class="fld-cmp-btn is-active" data-cmp-mode="slider">
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
        btn.addEventListener('click', () => {
          cmpMode = btn.dataset.cmpMode;
          el.querySelectorAll('.fld-cmp-btn[data-cmp-mode]').forEach(b => b.classList.toggle('is-active', b === btn));
          if (cmpMode === 'info') renderInfo();
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
              <button class="fld-cmp-btn is-active" data-nosrc-mode="preview">
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

  return () => revokeBlobUrls();
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
    .fld-cmp-badge--before { left:10px; }
    .fld-cmp-badge--after { right:10px; background:rgba(0,119,255,0.85); }
  `;
  document.head.appendChild(s);
}
