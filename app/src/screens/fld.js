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
import { getFolder, pickFolder, loadVideoPreviews,
         writeVideoPreview }                         from '../data/folders.js';
import { extractVideoFrame }                         from '../utils/video-frame.js';
import { setRecipeThumbnail }                        from '../data/recipes.js';
import { navigate }                                  from '../main.js';
import { formatBytes }                               from '../utils/misc.js';
import { injectImageInfoStyles }                     from '../utils/image-info.js';
import { renderAssetPanel,
         injectAssetPanelStyles }                    from '../utils/asset-panel.js';
import { showConfirm }                               from '../utils/dialogs.js';
import { MetadataPanel }                             from '../components/metadata-panel.js';

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
    if (name.startsWith('.')) continue; // skip hidden sidecars, .DS_Store, etc.
    const ext = extOf(name);
    if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
      entries.push({ file: await entry.getFile(), handle: entry });
    }
  }
  return entries.sort((a, b) => a.file.name.localeCompare(b.file.name));
}

/** Read media files AND subdirectories from a directory handle. */
async function listContents(dirHandle) {
  const files = [], folders = [];
  for await (const [name, entry] of dirHandle.entries()) {
    if (name.startsWith('.')) continue;
    if (entry.kind === 'directory') {
      folders.push({ name, handle: entry });
    } else {
      const ext = extOf(name);
      if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
        files.push({ file: await entry.getFile(), handle: entry });
      }
    }
  }
  files.sort((a, b) => a.file.name.localeCompare(b.file.name));
  folders.sort((a, b) => a.name.localeCompare(b.name));
  return { files, folders };
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
        <button class="btn-icon" id="fld-up" title="Up one folder" style="display:none">
          <span class="material-symbols-outlined">arrow_upward</span>
        </button>
        <div class="fld-breadcrumb" id="fld-breadcrumb"></div>

        <div style="flex:1"></div>

        ${browseMode ? `<button class="btn-secondary btn-sm" id="fld-change-folder" style="margin-right:8px">
          <span class="material-symbols-outlined" style="font-size:16px">folder_open</span> Change Folder
        </button>` : ''}
        ${runId ? `<button class="btn-secondary btn-sm" id="fld-btn-showcase" style="margin-right:8px">
          <span class="material-symbols-outlined" style="font-size:16px">star</span> Add to ShowCase
        </button>` : ''}

        <div id="fld-selection-actions" class="flex items-center gap-1" style="margin-right:8px">
          <button class="btn-secondary btn-sm" id="fld-btn-select-all" title="Select all visible items">
            <span class="material-symbols-outlined" style="font-size:16px">done_all</span>
            Select All
          </button>
          <button class="btn-secondary btn-sm" id="fld-btn-deselect-all" title="Deselect all">
            Deselect
          </button>
          <button class="btn-secondary btn-sm" id="fld-btn-download-sel" title="Download selected items">
            <span class="material-symbols-outlined" style="font-size:18px">download</span>
          </button>
          <button class="btn-secondary btn-sm" id="fld-btn-delete-sel" title="Delete selected items from disk">
            <span class="material-symbols-outlined" style="font-size:18px;color:var(--ps-red)">delete</span>
          </button>
          <div style="width:1px;height:20px;background:var(--ps-border);margin:0 4px"></div>
        </div>

        <button class="btn-icon" id="fld-btn-compare" title="Compare with input image" style="margin-right:4px">
          <span class="material-symbols-outlined">compare_arrows</span>
        </button>

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
        ${runId ? `
        <div class="fld-run-filter-wrap" id="fld-run-filter-wrap">
          <div style="width:1px;height:18px;background:var(--ps-border);margin:0 2px"></div>
          <button class="fld-chip fld-chip--run is-active" id="fld-run-filter-btn" title="Toggle between run results and all files in folder">
            <span class="material-symbols-outlined" style="font-size:12px">filter_alt</span>
            Run results
          </button>
        </div>` : ''}
      </div>

      <div class="fld-body" id="fld-body">
        <div class="fld-main" id="fld-main">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;gap:10px">
            <div class="spinner spinner--lg"></div>
            <span class="text-sm text-muted">Loading files…</span>
          </div>
        </div>
        <div id="fld-meta-panel-host" style="height:100%"></div>
      </div>
    </div>`;

  injectFldStyles();
  injectImageInfoStyles();

  container.querySelector('#fld-back')?.addEventListener('click', () => navigate(`#${fromRoute}`));
  container.querySelector('#fld-up')?.addEventListener('click', () => navigateTo(dirStack.length - 2));

  // ── Change Folder (browse mode) ─────────────────────────────
  container.querySelector('#fld-change-folder')?.addEventListener('click', async () => {
    try {
      await pickFolder('browse');
      navigate('#fld');
    } catch (e) { if (e.name !== 'AbortError') console.error(e); }
  });

  // ── Add to ShowCase (run mode) ───────────────────────────────
  container.querySelector('#fld-btn-showcase')?.addEventListener('click', async () => {
    if (!run) return;
    try {
      const { saveShowcase } = await import('../data/showcases.js');
      const { listImages, getOrCreateOutputSubfolder } = await import('../data/folders.js');
      let outputHandle = run.outputHandleObj || await getFolder('output');
      if (!outputHandle) {
        window.AuroraToast?.show({ variant: 'warning', title: 'Output folder not accessible' });
        return;
      }
      const subHandle   = await getOrCreateOutputSubfolder(outputHandle, run.outputFolder || 'output');
      const allFiles    = await listImages(subHandle, { includeVideo: true });
      const sampleFiles = allFiles.slice(0, 5);
      const sampleFileNames = sampleFiles.map(f => f.name);

      // Capture matching input filenames
      let sampleInputFileNames = [];
      try {
        const inputHandle = await getFolder('input');
        if (inputHandle) {
          const inputFiles = await listImages(inputHandle, { includeVideo: true });
          const inputByBase = new Map();
          for (const f of inputFiles) {
            inputByBase.set(f.name.replace(/\.[^.]+$/, ''), f.name);
            inputByBase.set(f.name, f.name);
          }
          sampleInputFileNames = sampleFiles.map(outFile => {
            const base     = outFile.name.replace(/\.[^.]+$/, '');
            const stripped = base.replace(/[-_][a-z0-9]+$/i, '');
            return inputByBase.get(base) || inputByBase.get(stripped) || null;
          }).filter(Boolean);
          if (!sampleInputFileNames.length && inputFiles.length) {
            sampleInputFileNames = inputFiles.slice(0, 5).map(f => f.name);
          }
        }
      } catch {}

      const entry = {
        id:                   crypto.randomUUID(),
        runId:                run.id,
        recipeId:             run.recipeId,
        recipeName:           run.recipeName,
        title:                run.recipeName,
        description:          '',
        sampleFileNames,
        sampleInputFileNames,
        createdAt:            Date.now(),
        updatedAt:            Date.now(),
      };
      await saveShowcase(entry);
      window.AuroraToast?.show({
        variant: 'success',
        title: 'Added to ShowCase',
        description: `<a href="#shc?id=${entry.id}" style="color:var(--ps-blue)">View entry →</a>`,
      });
    } catch (err) {
      console.error('[fld showcase]', err);
      window.AuroraToast?.show({ variant: 'danger', title: 'Failed to add to ShowCase', description: err.message });
    }
  });

  // ── State ───────────────────────────────────────────────────
  let activeSubHandle = null; // used by deleteSelected
  let allEntries = [];   // { file: File, handle: FileSystemFileHandle }[]
  let allFolders = [];   // { name: string, handle: FileSystemDirectoryHandle }[]
  let filteredFolders = []; // currently visible folders
  let currentHandle = null; // FileSystemDirectoryHandle being viewed
  let dirStack = [];     // [{ handle, name }] — path from root to parent of currentHandle

  // Persistent metadata panel (always mounted, user can collapse)
  const metaPanel = new MetadataPanel(
    container.querySelector('#fld-meta-panel-host'),
    {
      dirHandle: null,  // set dynamically as currentHandle changes
      onSaved: (file, sidecar) => _refreshSidecarBadge(file.name, sidecar),
    }
  );
  let videoPreviews = new Map(); // videoName → File (preview JPEG)
  let _previewGenRunning = false;
  let inputFiles = [];   // File[] from input folder for comparison
  let inputByBase = new Map();
  let filtered   = [];   // MediaEntry[] current filtered+sorted list
  let viewMode   = localStorage.getItem('ic-view-mode') || 'filmstrip';
  let filterType = 'all';
  let sortKey    = 'name';
  // Run-scoped filter: when navigating from que/out with a runId, show only files
  // whose lastModified falls within the run's execution window (±buffer).
  let runFilter  = !!runId;
  const RUN_FILTER_BUF_MS = 15_000; // 15 s buffer around run window
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

  // ── Run filter toggle ───────────────────────────────────────
  container.querySelector('#fld-run-filter-btn')?.addEventListener('click', () => {
    runFilter = !runFilter;
    const btn = container.querySelector('#fld-run-filter-btn');
    if (btn) {
      btn.classList.toggle('is-active', runFilter);
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px">${runFilter ? 'filter_alt' : 'filter_alt_off'}</span> ${runFilter ? 'Run results' : 'All files'}`;
    }
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

  container.querySelector('#fld-btn-download-sel')?.addEventListener('click', downloadSelected);
  container.querySelector('#fld-btn-delete-sel')?.addEventListener('click', deleteSelected);

  container.querySelector('#fld-btn-slideshow')?.addEventListener('click', () => {
    const images = filtered.filter(ent => fileType(ent.file.name) === 'image');
    if (!images.length) {
      window.AuroraToast?.show({ variant: 'warning', title: 'No images to show' });
      return;
    }
    startSlideshow(images);
  });

  // ── Compare button ─────────────────────────────────────────
  container.querySelector('#fld-btn-compare')?.addEventListener('click', async () => {
    if (!selected) {
      window.AuroraToast?.show({ variant: 'info', title: 'Select a file first to compare' });
      return;
    }
    const ws = await ensureWorkspace();
    ws.setFiles([selected.file]);

    const modal = document.createElement('div');
    modal.className = 'fld-modal-overlay';
    modal.innerHTML = `
      <div class="fld-modal" style="max-width:90vw;width:900px;height:80vh;display:flex;flex-direction:column">
        <div class="fld-modal-header">
          <strong>Compare</strong>
          <span style="color:var(--ps-text-muted);font-size:13px;margin-left:8px">${escHtml(selected.file.name)}</span>
          <button class="btn-icon" id="fld-cmp-close" style="margin-left:auto">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div id="fld-cmp-mount" style="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#fld-cmp-mount').appendChild(ws.container);
    modal.querySelector('#fld-cmp-close').addEventListener('click', () => {
      container.appendChild(ws.container); // return to DOM (avoid GC)
      modal.remove();
    });
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        container.appendChild(ws.container);
        modal.remove();
      }
    });
  });

  // ── Load files ──────────────────────────────────────────────
  try {
    let rootHandle;
    if (browseMode) {
      rootHandle = browseHandle;
    } else {
      let outputHandle = run?.outputHandleObj || await getFolder('output');
      if (!outputHandle) {
        showEmpty('Output folder not accessible. Grant permission in Batch Setup.');
        return;
      }

      const subfolder = run?.outputFolder || 'output';
      try {
        rootHandle = await outputHandle.getDirectoryHandle(subfolder);
      } catch {
        showEmpty(`Subfolder "${subfolder}" not found.`);
        return;
      }
    }

    currentHandle = rootHandle;
    metaPanel.setDirHandle(currentHandle);

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

    await reloadContents();
  } catch (err) {
    showEmpty(`Error: ${err.message}`);
  }

  // ── Folder navigation ───────────────────────────────────────
  async function reloadContents() {
    activeSubHandle = currentHandle;
    const { files, folders } = await listContents(currentHandle);
    allEntries = files;
    allFolders = folders;
    videoPreviews = await loadVideoPreviews(currentHandle);
    selected = null;
    selectedSet.clear();
    lastIdx = -1;

    // Update chip counts
    const counts = { image: 0, video: 0, other: 0 };
    allEntries.forEach(ent => { const t = fileType(ent.file.name); counts[t] = (counts[t] || 0) + 1; });
    container.querySelectorAll('[data-filter]').forEach(chip => {
      const t = chip.dataset.filter;
      if (t !== 'all') {
        const sp = chip.querySelector('.fld-chip-count') || document.createElement('span');
        sp.className = 'fld-chip-count';
        sp.textContent = counts[t] || 0;
        if (!chip.contains(sp)) chip.appendChild(sp);
        sp.style.display = counts[t] ? '' : 'none';
      }
    });

    updateBreadcrumb();
    applyFilter();
  }

  function updateBreadcrumb() {
    const bc = container.querySelector('#fld-breadcrumb');
    if (!bc) return;

    // Full path: dirStack entries + current
    const pathNames = [...dirStack.map(d => d.name), currentHandle.name];

    let html = '';
    if (!browseMode) {
      html += `<span class="fld-crumb-recipe">${escHtml(run?.recipeName || 'Output')}</span>`;
      html += `<span class="material-symbols-outlined fld-crumb-sep">chevron_right</span>`;
    } else {
      html += `<span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-text-muted)">folder_open</span>`;
    }

    pathNames.forEach((name, i) => {
      const isLast = i === pathNames.length - 1;
      if (i > 0 || browseMode) html += `<span class="material-symbols-outlined fld-crumb-sep">chevron_right</span>`;
      if (isLast) {
        html += `<span class="fld-crumb-folder">${escHtml(name)}/</span>`;
      } else {
        html += `<button class="fld-crumb-btn" data-crumb-idx="${i}">${escHtml(name)}/</button>`;
      }
    });

    bc.innerHTML = html;
    bc.querySelectorAll('[data-crumb-idx]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(parseInt(btn.dataset.crumbIdx)));
    });

    // Show/hide up button
    const upBtn = container.querySelector('#fld-up');
    if (upBtn) upBtn.style.display = dirStack.length > 0 ? '' : 'none';
  }

  async function enterFolder(folder) {
    dirStack.push({ handle: currentHandle, name: currentHandle.name });
    currentHandle = folder.handle;
    metaPanel.setDirHandle(currentHandle);
    metaPanel.clear();
    await reloadContents();
  }

  async function navigateTo(stackIdx) {
    if (stackIdx < 0 || stackIdx >= dirStack.length) return;
    currentHandle = dirStack[stackIdx].handle;
    dirStack = dirStack.slice(0, stackIdx);
    metaPanel.setDirHandle(currentHandle);
    metaPanel.clear();
    await reloadContents();
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
    const runStart = run?.startedAt  ? run.startedAt  - RUN_FILTER_BUF_MS : null;
    const runEnd   = run?.finishedAt ? run.finishedAt + RUN_FILTER_BUF_MS
                   : run?.startedAt  ? Date.now()     + RUN_FILTER_BUF_MS
                   : null;

    filtered = allEntries.filter(ent => {
      if (filterType !== 'all' && fileType(ent.file.name) !== filterType) return false;
      if (runFilter && runStart !== null) {
        const ts = ent.file.lastModified;
        if (ts < runStart || ts > runEnd) return false;
      }
      return true;
    });
    // Sort files
    filtered.sort((a, b) => {
      if (sortKey === 'type') return fileType(a.file.name).localeCompare(fileType(b.file.name)) || a.file.name.localeCompare(b.file.name);
      if (sortKey === 'size') return b.file.size - a.file.size;
      return a.file.name.localeCompare(b.file.name);
    });
    // Folders always shown after files, sorted by name
    filteredFolders = [...allFolders].sort((a, b) => a.name.localeCompare(b.name));
    renderMain();
  }
  // ── Render main area ────────────────────────────────────────
  function renderMain() {
    revokeBlobUrls();
    const main = container.querySelector('#fld-main');
    if (!main) return;

    if (!filtered.length && !filteredFolders.length) {
      const emptyMsg = runFilter
        ? 'No output files found for this run. Toggle "Run results" to see all files in the folder.'
        : 'No files match the current filter.';
      main.innerHTML = `<div class="empty-state" style="height:100%">
        <span class="material-symbols-outlined">filter_none</span>
        <div class="empty-state-title">No files match</div>
        <div class="empty-state-desc">${emptyMsg}</div>
      </div>`;
      updateSelectionUI();
      return;
    }

    if (viewMode === 'grid')       renderGrid(main);
    else if (viewMode === 'filmstrip') renderFilmstrip(main);
    else                           renderList(main);

    updateSelectionUI();

    // Kick off background preview generation for any videos that don't have one yet
    schedulePreviewGeneration();
  }

  // ── Background preview generation ───────────────────────────
  function schedulePreviewGeneration() {
    if (_previewGenRunning) return;
    const pending = allEntries.filter(ent =>
      VIDEO_EXTS.has(extOf(ent.file.name)) && !videoPreviews.has(ent.file.name)
    );
    if (!pending.length) return;

    _previewGenRunning = true;
    (async () => {
      for (const ent of pending) {
        try {
          const canvas = await extractVideoFrame(ent.file);
          const blob   = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
          if (blob && activeSubHandle) {
            await writeVideoPreview(activeSubHandle, ent.file.name, blob);
            // Update the in-memory map and refresh cards in the DOM
            const previewFile = await activeSubHandle.getFileHandle(`.${ent.file.name}.preview.jpg`)
              .then(h => h.getFile()).catch(() => null);
            if (previewFile) {
              videoPreviews.set(ent.file.name, previewFile);
              replaceVideoThumb(ent.file.name, previewFile);
            }
          }
        } catch { /* skip this video */ }
        // Small yield between videos so we don't saturate the main thread
        await new Promise(r => setTimeout(r, 50));
      }
      _previewGenRunning = false;
    })();
  }

  /** Swap a pending <video> placeholder with the newly-generated preview <img>. */
  function replaceVideoThumb(videoName, previewFile) {
    const previewUrl = URL.createObjectURL(previewFile);
    blobUrls.push(previewUrl);

    // Grid cells
    container.querySelectorAll(`[data-preview-pending="${CSS.escape(videoName)}"]`).forEach(vid => {
      const thumb = vid.closest('.fld-thumb') || vid.closest('.fld-fs-thumb') || vid.parentElement;
      const isGrid = vid.classList.contains('fld-thumb-vid');
      const isFs   = vid.classList.contains('fld-fs-thumb-img');

      const img = document.createElement('img');
      img.draggable = false;
      img.src       = previewUrl;

      if (isGrid) {
        img.className = 'fld-thumb-img';
        vid.replaceWith(img);
        // Remove any existing camera button (no-preview variant), then add the hover-only one
        thumb?.querySelectorAll('.fld-thumb-chg-preview').forEach(b => b.remove());
        const btn = document.createElement('button');
        btn.className = 'fld-thumb-chg-preview';
        btn.title = 'Change preview frame';
        btn.dataset.name = videoName;
        btn.innerHTML = '<span class="material-symbols-outlined">photo_camera</span>';
        const ent = allEntries.find(e => e.file.name === videoName);
        if (ent) btn.addEventListener('click', e => { e.stopPropagation(); showChangePreviewDialog(ent); });
        thumb?.appendChild(btn);
      } else if (isFs) {
        img.className = 'fld-fs-thumb-img';
        // Remove any existing camera button (no-preview variant)
        thumb?.querySelectorAll('.fld-thumb-chg-preview').forEach(b => b.remove());
        vid.replaceWith(img);
      } else {
        // List view — replace movie icon with img
        img.className = 'fld-list-thumb';
        vid.replaceWith(img);
      }
    });

    // List view icons (no data-preview-pending, use name lookup)
    container.querySelectorAll('.fld-list-icon').forEach(icon => {
      const row = icon.closest('[data-fld-ent-name]');
      if (row?.dataset.fldEntName === videoName) {
        const img = document.createElement('img');
        img.className = 'fld-list-thumb';
        img.src = previewUrl;
        img.draggable = false;
        icon.replaceWith(img);
      }
    });
  }

  // ── Change Preview Frame dialog ──────────────────────────────
  async function showChangePreviewDialog(ent) {
    const existing = document.getElementById('fld-chg-preview-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'fld-chg-preview-dialog';
    dialog.className = 'fld-modal-overlay';
    dialog.innerHTML = `
      <div class="fld-modal" style="max-width:700px;width:90vw">
        <div class="fld-modal-header">
          <strong>Change Preview Frame</strong>
          <span style="color:var(--ps-text-muted);font-size:13px;margin-left:8px">${escHtml(ent.file.name)}</span>
          <button class="btn-icon" id="fld-chg-close" style="margin-left:auto">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="fld-modal-body" style="display:flex;flex-direction:column;gap:12px;padding:16px">
          <video id="fld-chg-video" controls muted style="width:100%;border-radius:6px;background:#000;max-height:50vh"></video>
          <div style="display:flex;align-items:center;gap:10px;justify-content:flex-end">
            <span style="font-size:13px;color:var(--ps-text-muted)">Seek to the frame you want, then capture.</span>
            <button class="btn-primary" id="fld-chg-capture">
              <span class="material-symbols-outlined">photo_camera</span> Use This Frame
            </button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(dialog);

    const videoEl = dialog.querySelector('#fld-chg-video');
    const fileUrl = URL.createObjectURL(ent.file);
    videoEl.src = fileUrl;

    dialog.querySelector('#fld-chg-close').addEventListener('click', () => {
      URL.revokeObjectURL(fileUrl);
      dialog.remove();
    });
    dialog.addEventListener('click', e => {
      if (e.target === dialog) { URL.revokeObjectURL(fileUrl); dialog.remove(); }
    });

    dialog.querySelector('#fld-chg-capture').addEventListener('click', async () => {
      const canvas = document.createElement('canvas');
      canvas.width  = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      canvas.getContext('2d').drawImage(videoEl, 0, 0);

      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (blob && activeSubHandle) {
        await writeVideoPreview(activeSubHandle, ent.file.name, blob);
        const previewHandle = await activeSubHandle.getFileHandle(`.${ent.file.name}.preview.jpg`).catch(() => null);
        const previewFile   = previewHandle ? await previewHandle.getFile() : null;
        if (previewFile) {
          videoPreviews.set(ent.file.name, previewFile);
          replaceVideoThumb(ent.file.name, previewFile);
          // Also update the camera button's already-visible state
          container.querySelectorAll(`[data-name="${CSS.escape(ent.file.name)}"].fld-thumb-chg-preview`)
            .forEach(btn => {
              const thumb = btn.closest('.fld-thumb');
              const img = thumb?.querySelector('.fld-thumb-img');
              if (img) { URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(previewFile); blobUrls.push(img.src); }
            });
        }
      }
      URL.revokeObjectURL(fileUrl);
      dialog.remove();
    });
  }

  // ── File preview modal (double-click from grid or list) ─────────
  function showFilePreviewModal(ent, allEntries, startIdx) {
    const existing = document.getElementById('fld-preview-modal');
    if (existing) existing.remove();

    let currentIdx = startIdx ?? allEntries.indexOf(ent);
    let blobUrl = null;

    const overlay = document.createElement('div');
    overlay.id = 'fld-preview-modal';
    overlay.className = 'fld-preview-overlay';

    const render = () => {
      const cur = allEntries[currentIdx];
      const type = fileType(cur.file.name);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = URL.createObjectURL(cur.file);

      overlay.innerHTML = `
        <div class="fld-preview-box">
          <div class="fld-preview-header">
            <span class="material-symbols-outlined" style="color:var(--ps-blue);font-size:18px">${type === 'video' ? 'movie' : 'image'}</span>
            <span class="fld-preview-title">${escHtml(cur.file.name)}</span>
            <span class="fld-preview-counter">${currentIdx + 1} / ${allEntries.length}</span>
            <button class="btn-icon fld-preview-close" title="Close (Esc)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="fld-preview-media">
            ${type === 'video'
              ? `<video class="fld-preview-video" src="${blobUrl}" controls autoplay></video>`
              : `<img class="fld-preview-img" src="${blobUrl}" alt="${escHtml(cur.file.name)}">`}
            ${currentIdx > 0
              ? `<button class="fld-preview-nav fld-preview-nav--prev" title="Previous"><span class="material-symbols-outlined">chevron_left</span></button>`
              : ''}
            ${currentIdx < allEntries.length - 1
              ? `<button class="fld-preview-nav fld-preview-nav--next" title="Next"><span class="material-symbols-outlined">chevron_right</span></button>`
              : ''}
          </div>
          <div class="fld-preview-footer">
            <span class="fld-preview-meta">${formatBytes(cur.file.size)}</span>
            <span class="fld-preview-meta">${new Date(cur.file.lastModified).toLocaleString()}</span>
          </div>
        </div>`;

      overlay.querySelector('.fld-preview-close')?.addEventListener('click', close);
      overlay.querySelector('.fld-preview-nav--prev')?.addEventListener('click', e => { e.stopPropagation(); currentIdx--; render(); });
      overlay.querySelector('.fld-preview-nav--next')?.addEventListener('click', e => { e.stopPropagation(); currentIdx++; render(); });
    };

    const close = () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = null;
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };

    const onKey = e => {
      if (e.key === 'Escape') { close(); }
      else if (e.key === 'ArrowLeft'  && currentIdx > 0)                    { currentIdx--; render(); }
      else if (e.key === 'ArrowRight' && currentIdx < allEntries.length - 1) { currentIdx++; render(); }
    };

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    render();
  }

  // ── Async dimension loader for list/grid cells ────────────────
  async function loadDimensions(file, spanEl) {
    try {
      const type = fileType(file.name);
      if (type === 'image') {
        const bitmap = await createImageBitmap(file);
        spanEl.textContent = `${bitmap.width} × ${bitmap.height}`;
        bitmap.close?.();
      } else if (type === 'video') {
        const url = URL.createObjectURL(file);
        await new Promise(resolve => {
          const v = document.createElement('video');
          v.preload = 'metadata';
          v.onloadedmetadata = () => {
            spanEl.textContent = `${v.videoWidth} × ${v.videoHeight}`;
            URL.revokeObjectURL(url);
            resolve();
          };
          v.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          v.src = url;
        });
      }
    } catch { /* best-effort */ }
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
    const dlBtn        = container.querySelector('#fld-btn-download-sel');
    const delBtn       = container.querySelector('#fld-btn-delete-sel');

    if (selectAllBtn) selectAllBtn.style.display = selCount < filtered.length ? '' : 'none';
    if (deselectBtn)  deselectBtn.style.display  = selCount > 0 ? '' : 'none';
    if (dlBtn)        dlBtn.disabled             = selCount === 0;
    if (delBtn)       delBtn.disabled            = selCount === 0;

    // Update detail-panel download button label to reflect selection count
    container.querySelectorAll('.fld-detail-dl-btn').forEach(btn => {
      btn.innerHTML = selCount > 1
        ? `<span class="material-symbols-outlined">download</span> Download ${selCount} files`
        : `<span class="material-symbols-outlined">download</span> Download`;
    });

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

      const previewFile = type === 'video' ? videoPreviews.get(ent.file.name) : null;
      const previewUrl  = previewFile ? URL.createObjectURL(previewFile) : null;
      if (previewUrl) blobUrls.push(previewUrl);

      cell.innerHTML = `
        <div class="fld-thumb ${type === 'video' ? 'fld-thumb--video' : ''}">
          ${type === 'video'
            ? previewUrl
              ? `<img src="${previewUrl}" class="fld-thumb-img" draggable="false">
                 <div class="fld-thumb-video-badge"><span class="material-symbols-outlined">play_circle</span></div>
                 <button class="fld-thumb-chg-preview" title="Change preview frame" data-name="${escHtml(ent.file.name)}">
                   <span class="material-symbols-outlined">photo_camera</span>
                 </button>`
              : `<video src="${url}" class="fld-thumb-vid" preload="metadata" muted data-preview-pending="${escHtml(ent.file.name)}"></video>
                 <div class="fld-thumb-video-badge"><span class="material-symbols-outlined">play_circle</span></div>
                 <button class="fld-thumb-chg-preview fld-thumb-chg-preview--noprev" title="Set preview frame" data-name="${escHtml(ent.file.name)}">
                   <span class="material-symbols-outlined">photo_camera</span>
                 </button>`
            : `<img src="${url}" class="fld-thumb-img" loading="lazy" draggable="false">`
          }
        </div>
        <div class="fld-cell-name">${escHtml(ent.file.name)}</div>`;

      cell.querySelector('.fld-thumb-chg-preview')?.addEventListener('click', e => {
        e.stopPropagation();
        showChangePreviewDialog(ent);
      });
      cell.addEventListener('click', e => {
        handleFileClick(ent, i, e);
      });
      cell.addEventListener('dblclick', e => {
        e.stopPropagation();
        showFilePreviewModal(ent, filtered, i);
      });
      grid.appendChild(cell);
    });

    // ".." up entry + folders after files
    if (dirStack.length > 0) {
      const upCell = document.createElement('div');
      upCell.className = 'fld-cell fld-cell--folder fld-cell--up';
      upCell.title = `Up to ${dirStack[dirStack.length - 1].name}`;
      upCell.innerHTML = `
        <div class="fld-thumb fld-thumb--folder">
          <span class="material-symbols-outlined">drive_folder_upload</span>
        </div>
        <div class="fld-cell-name">..</div>`;
      upCell.addEventListener('click', () => navigateTo(dirStack.length - 2));
      grid.appendChild(upCell);
    }
    filteredFolders.forEach(folder => {
      const cell = document.createElement('div');
      cell.className = 'fld-cell fld-cell--folder';
      cell.innerHTML = `
        <div class="fld-thumb fld-thumb--folder">
          <span class="material-symbols-outlined">folder</span>
        </div>
        <div class="fld-cell-name">${escHtml(folder.name)}</div>`;
      cell.addEventListener('click', () => enterFolder(folder));
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

      const fsPreviewFile = type === 'video' ? videoPreviews.get(ent.file.name) : null;
      const fsPreviewUrl  = fsPreviewFile ? URL.createObjectURL(fsPreviewFile) : null;
      if (fsPreviewUrl) blobUrls.push(fsPreviewUrl);

      thumb.innerHTML = `
        ${type === 'video'
          ? fsPreviewUrl
            ? `<img src="${fsPreviewUrl}" class="fld-fs-thumb-img" draggable="false">
               <span class="fld-fs-video-badge material-symbols-outlined">play_circle</span>`
            : `<video src="${url}" class="fld-fs-thumb-img" preload="metadata" muted data-preview-pending="${escHtml(ent.file.name)}"></video>
               <span class="fld-fs-video-badge material-symbols-outlined">play_circle</span>
               <button class="fld-thumb-chg-preview fld-thumb-chg-preview--noprev" title="Set preview frame" data-name="${escHtml(ent.file.name)}">
                 <span class="material-symbols-outlined">photo_camera</span>
               </button>`
          : `<img src="${url}" class="fld-fs-thumb-img" loading="lazy" draggable="false">`
        }`;

      thumb.querySelector('.fld-thumb-chg-preview')?.addEventListener('click', e => {
        e.stopPropagation();
        showChangePreviewDialog(ent);
      });
      thumb.addEventListener('click', e => {
        handleFileClick(ent, i, e);
      });
      strip.appendChild(thumb);
    });

    // Folders after files
    filteredFolders.forEach(folder => {
      const thumb = document.createElement('div');
      thumb.className = 'fld-fs-thumb fld-fs-thumb--folder';
      thumb.title = folder.name;
      thumb.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:32px;color:var(--ps-blue)">folder</span>
        <span class="fld-fs-folder-name">${escHtml(folder.name)}</span>`;
      thumb.addEventListener('click', () => enterFolder(folder));
      strip.appendChild(thumb);
    });

    // If something was selected, show it in main area
    if (selected) {
      renderFilmstripPreview(selected);
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
            <th class="fld-list-th" style="width:70px">Size</th>
            <th class="fld-list-th" style="width:110px">Modified</th>
            <th class="fld-list-th" style="width:100px">Dimensions</th>
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

      const listPreviewFile = type === 'video' ? videoPreviews.get(ent.file.name) : null;
      const listPreviewUrl  = listPreviewFile ? URL.createObjectURL(listPreviewFile) : null;
      if (listPreviewUrl) blobUrls.push(listPreviewUrl);

      const isSel = selectedSet.has(ent.file.name);
      const modDate = ent.file.lastModified
        ? new Date(ent.file.lastModified).toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' })
        : '—';

      tr.innerHTML = `
        <td class="fld-list-td">
          ${type === 'video'
            ? listPreviewUrl
              ? `<img src="${listPreviewUrl}" class="fld-list-thumb" draggable="false">`
              : `<div class="fld-list-icon"><span class="material-symbols-outlined" style="color:var(--ps-blue)">movie</span></div>`
            : `<img src="${thumbUrl}" class="fld-list-thumb" loading="lazy" draggable="false">`}
        </td>
        <td class="fld-list-td">
          <span class="fld-list-name">${escHtml(ent.file.name)}</span>
        </td>
        <td class="fld-list-td">${type === 'video' ? '<span class="ic-badge ic-badge--blue">MP4</span>' : `<span class="ic-badge">${extOf(ent.file.name).slice(1).toUpperCase()}</span>`}</td>
        <td class="fld-list-td mono text-sm text-muted">${formatBytes(ent.file.size)}</td>
        <td class="fld-list-td fld-list-modified">${modDate}</td>
        <td class="fld-list-td fld-list-dims"><span class="fld-list-dims-val">—</span></td>
        <td class="fld-list-td" style="text-align:right">
          <button class="btn-icon fld-list-dl" data-idx="${i}" title="Download">
            <span class="material-symbols-outlined" style="font-size:15px">download</span>
          </button>
        </td>`;

      tr.addEventListener('click', e => {
        if (!e.target.closest('.fld-list-dl')) handleFileClick(ent, i, e);
      });
      tr.addEventListener('dblclick', e => {
        if (!e.target.closest('.fld-list-dl')) showFilePreviewModal(ent, filtered, i);
      });
      tr.querySelector('.fld-list-dl')?.addEventListener('click', e => {
        e.stopPropagation();
        downloadFile(ent.file);
      });
      tbody.appendChild(tr);

      // Load dimensions asynchronously
      const dimsSpan = tr.querySelector('.fld-list-dims-val');
      if (dimsSpan && (type === 'image' || type === 'video')) loadDimensions(ent.file, dimsSpan);
    });

    // Folders after files
    filteredFolders.forEach(folder => {
      const tr = document.createElement('tr');
      tr.className = 'fld-list-row fld-list-row--folder';
      tr.innerHTML = `
        <td class="fld-list-td">
          <div class="fld-list-icon"><span class="material-symbols-outlined" style="color:var(--ps-blue);font-size:22px">folder</span></div>
        </td>
        <td class="fld-list-td"><span class="fld-list-name">${escHtml(folder.name)}</span></td>
        <td class="fld-list-td"><span class="ic-badge" style="background:rgba(0,119,255,.12);color:var(--ps-blue)">Folder</span></td>
        <td class="fld-list-td"></td>
        <td class="fld-list-td"></td>
        <td class="fld-list-td"></td>
        <td class="fld-list-td"></td>`;
      tr.addEventListener('click', () => enterFolder(folder));
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
  async function selectFile(ent) {
    selected = ent;

    // Highlight selected cell in current view
    container.querySelectorAll('.fld-cell, .fld-fs-thumb, .fld-list-row').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      el.classList.toggle('is-selected', filtered[idx] === ent);
    });

    if (viewMode === 'filmstrip') {
      await renderFilmstripPreview(ent);
    }

    // Update the persistent right metadata panel
    metaPanel.setDirHandle(currentHandle);
    await metaPanel.setFile(ent.file);
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
            <button class="btn-secondary fld-detail-dl-btn" style="width:100%">
              <span class="material-symbols-outlined">download</span> Download
            </button>
          </div>` : ''}
        </div>`;
      el.querySelector('.fld-detail-dl-btn')?.addEventListener('click', () => {
        if (selectedSet.size > 1) downloadSelected();
        else downloadFile(file);
      });
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
            <button class="btn-secondary fld-detail-dl-btn" style="flex:1">
              <span class="material-symbols-outlined">download</span> Download
            </button>
            ${run?.recipeId ? `<button class="btn-secondary fld-btn-set-thumb" title="Set as recipe thumbnail">
              <span class="material-symbols-outlined">photo_library</span>
            </button>` : ''}
          </div>` : ''}
        </div>`;

      el.querySelector('.fld-detail-dl-btn')?.addEventListener('click', () => {
        if (selectedSet.size > 1) downloadSelected();
        else downloadFile(file);
      });
      const mountNode = el.querySelector('#fld-ws-mount');
      mountNode.appendChild(ws.container);
      el.querySelector('.fld-btn-set-thumb')?.addEventListener('click', e => wireThumbBtn(file, e.currentTarget));

      ws.setFiles([file]);

    }
  }

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a   = document.createElement('a');
    a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function downloadSelected() {
    const names = Array.from(selectedSet);
    if (!names.length) return;

    // Single file — direct download
    if (names.length === 1) {
      const ent = allEntries.find(e => e.file.name === names[0]);
      if (ent) downloadFile(ent.file);
      return;
    }

    // Multiple files — build a ZIP using fflate
    const btn = container.querySelector('#fld-btn-download-sel');
    if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'hourglass_empty'; }

    try {
      const { zipSync } = await import('fflate');
      const fileMap = {};
      for (const name of names) {
        const ent = allEntries.find(e => e.file.name === name);
        if (!ent) continue;
        const buf = await ent.file.arrayBuffer();
        fileMap[ent.file.name] = new Uint8Array(buf);
      }
      if (!Object.keys(fileMap).length) return;
      const zipped = zipSync(fileMap, { level: 0 }); // store-only: images don't compress, avoids blocking
      const blob   = new Blob([zipped], { type: 'application/zip' });
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement('a');
      a.href = url; a.download = 'picmachina-export.zip';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('[fld] downloadSelected failed:', err);
    } finally {
      if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'download'; }
    }
  }

  async function wireThumbBtn(file, btn) {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<img src="/assets/animated_logo.gif" style="width:18px;height:18px;display:block">`;
    }
    try {
      const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
      const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);
      let thumbFile = file;
      if (VIDEO_EXTS.has(ext)) {
        // Try to capture the frame currently visible in the detail pane video element
        const videoEl = btn.closest('.fld-detail-inner, .fld-ws-detail')?.querySelector('video')
                     ?? document.querySelector('.fld-detail-preview video, .iws-video');
        let frameCanvas;
        if (videoEl && !isNaN(videoEl.currentTime) && videoEl.readyState >= 2) {
          frameCanvas = document.createElement('canvas');
          frameCanvas.width  = videoEl.videoWidth;
          frameCanvas.height = videoEl.videoHeight;
          frameCanvas.getContext('2d').drawImage(videoEl, 0, 0);
        } else {
          frameCanvas = await extractVideoFrame(file);
        }
        const blob = await new Promise(res => frameCanvas.toBlob(res, 'image/jpeg', 0.9));
        thumbFile = new File([blob], file.name.replace(/\.[^.]+$/, '_thumb.jpg'), { type: 'image/jpeg' });
      }
      await setRecipeThumbnail(run.recipeId, thumbFile);
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

  // Update star/flag badge overlay on a thumbnail after sidecar save
  function _refreshSidecarBadge(filename, sidecar) {
    const cell = container.querySelector(`[data-fld-ent-name="${CSS.escape(filename)}"]`);
    if (!cell) return;
    // Remove existing badge
    cell.querySelector('.fld-sidecar-badge')?.remove();
    const rating = sidecar?.annotation?.rating;
    const flag   = sidecar?.annotation?.flag;
    if (!rating && !flag) return;
    const badge = document.createElement('div');
    badge.className = 'fld-sidecar-badge';
    if (rating) badge.innerHTML += `<span class="fld-sb-rating">★${rating}</span>`;
    if (flag === 'pick')   badge.innerHTML += `<span class="fld-sb-pick">P</span>`;
    if (flag === 'reject') badge.innerHTML += `<span class="fld-sb-reject">R</span>`;
    cell.querySelector('.fld-thumb')?.appendChild(badge);
  }

  return () => {
    revokeBlobUrls();
    clearInterval(slideshowTimer);
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
    .fld-crumb-btn { font-size:12px; font-family:var(--font-mono); color:var(--ps-text-muted); white-space:nowrap; background:none; border:none; cursor:pointer; padding:2px 4px; border-radius:4px; transition:background 100ms,color 100ms; }
    .fld-crumb-btn:hover { background:var(--ps-bg-hover); color:var(--ps-blue); }
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
    .fld-chip--run { gap:4px; }
    .fld-chip--run:not(.is-active) { border-color:var(--ps-border); color:var(--ps-text-muted); }
    .fld-run-filter-wrap { display:flex; align-items:center; gap:6px; }

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
    .fld-cell--folder { background:rgba(0,119,255,0.04); }
    .fld-cell--folder:hover { background:rgba(0,119,255,0.10); }
    .fld-thumb--folder { display:flex; align-items:center; justify-content:center; background:rgba(0,119,255,0.08); border-color:rgba(0,119,255,0.2); }
    .fld-thumb--folder .material-symbols-outlined { font-size:48px; color:var(--ps-blue); }
    .fld-cell.is-selected  { border-color:var(--ps-blue); background:rgba(0,119,255,0.06); }
    .fld-cell.is-multiselected { border-color:#f59e0b; background:rgba(245,158,11,0.13); }
    .fld-cell.is-selected.is-multiselected { border-color:var(--ps-blue); background:rgba(0,119,255,0.10); }

    .fld-fs-thumb.is-multiselected { border-color:#f59e0b; }
    .fld-fs-thumb.is-selected.is-multiselected { border-color:var(--ps-blue); }

    .fld-list-row.is-multiselected { background:rgba(245,158,11,0.10); outline:1px solid rgba(245,158,11,0.5); outline-offset:-1px; }
    .fld-list-row.is-selected.is-multiselected { background:rgba(0,119,255,0.10); outline:1px solid rgba(0,119,255,0.5); outline-offset:-1px; }

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
      background:rgba(0,0,0,0.4); pointer-events:none;
    }
    .fld-thumb-video-badge .material-symbols-outlined { font-size:36px; color:rgba(255,255,255,0.9); }
    .fld-thumb-chg-preview {
      position:absolute; bottom:4px; right:4px; z-index:2;
      background:rgba(0,0,0,0.6); border:none; border-radius:4px;
      color:#fff; cursor:pointer; padding:3px 5px; display:none;
      align-items:center; line-height:1;
    }
    .fld-thumb-chg-preview .material-symbols-outlined { font-size:14px; }
    .fld-thumb:hover .fld-thumb-chg-preview { display:flex; }
    .fld-thumb-chg-preview--noprev { display:flex; opacity:0.8; }
    .fld-thumb-chg-preview--noprev:hover { opacity:1; }
    /* Sidecar rating/flag badges */
    .fld-sidecar-badge {
      position:absolute; bottom:4px; left:4px; display:flex; gap:3px; z-index:2; pointer-events:none;
    }
    .fld-sb-rating, .fld-sb-pick, .fld-sb-reject {
      font-size:10px; font-weight:700; border-radius:3px;
      padding:1px 4px; line-height:1.4;
    }
    .fld-sb-rating { background:rgba(245,158,11,0.85); color:#fff; }
    .fld-sb-pick   { background:rgba(52,211,153,0.85);  color:#fff; }
    .fld-sb-reject { background:rgba(248,113,113,0.85); color:#fff; }

    /* Change-preview modal overlay (reused .fld-modal-overlay pattern) */
    .fld-modal-overlay {
      position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.65);
      backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center;
    }
    .fld-modal-overlay .fld-modal {
      background:var(--ps-bg-surface); border-radius:12px;
      border:1px solid var(--ps-border); display:flex; flex-direction:column;
      max-height:90vh; overflow:hidden;
    }
    .fld-modal-header {
      display:flex; align-items:center; gap:8px; padding:14px 16px;
      border-bottom:1px solid var(--ps-border); font-size:15px; font-weight:600;
    }
    .fld-modal-body { overflow-y:auto; }
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
    .fld-fs-thumb--folder { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; background:rgba(0,119,255,0.06); border-color:rgba(0,119,255,0.2); }
    .fld-fs-thumb--folder:hover { border-color:var(--ps-blue); background:rgba(0,119,255,0.12); }
    .fld-fs-folder-name { font-size:9px; color:var(--ps-text-muted); text-align:center; padding:0 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; }

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
    .fld-list-modified { font-size:11px; color:var(--ps-text-muted); white-space:nowrap; }
    .fld-list-dims { font-size:11px; color:var(--ps-text-muted); font-family:var(--font-mono); white-space:nowrap; }

    /* File preview modal */
    .fld-preview-overlay {
      position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.88);
      backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center;
      padding:16px;
    }
    .fld-preview-box {
      background:var(--ps-bg-surface); border-radius:14px; border:1px solid var(--ps-border);
      display:flex; flex-direction:column; max-width:92vw; max-height:92vh;
      box-shadow:0 32px 80px rgba(0,0,0,0.6); overflow:hidden;
    }
    .fld-preview-header {
      display:flex; align-items:center; gap:8px; padding:12px 16px;
      border-bottom:1px solid var(--ps-border); flex-shrink:0;
    }
    .fld-preview-title {
      font-size:13px; font-weight:600; font-family:var(--font-mono);
      color:var(--ps-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;
    }
    .fld-preview-counter {
      font-size:11px; color:var(--ps-text-muted); font-family:var(--font-mono);
      white-space:nowrap; flex-shrink:0;
    }
    .fld-preview-media {
      flex:1; overflow:hidden; position:relative; min-height:0;
      background:#000; display:flex; align-items:center; justify-content:center;
    }
    .fld-preview-img {
      max-width:100%; max-height:80vh; object-fit:contain; display:block;
    }
    .fld-preview-video {
      max-width:100%; max-height:80vh; display:block; background:#000;
    }
    .fld-preview-nav {
      position:absolute; top:50%; transform:translateY(-50%);
      background:rgba(0,0,0,0.5); border:none; color:#fff; cursor:pointer;
      width:44px; height:44px; border-radius:50%; display:flex; align-items:center;
      justify-content:center; transition:background 150ms; z-index:2;
    }
    .fld-preview-nav:hover { background:rgba(0,0,0,0.8); }
    .fld-preview-nav--prev { left:12px; }
    .fld-preview-nav--next { right:12px; }
    .fld-preview-nav .material-symbols-outlined { font-size:28px; }
    .fld-preview-footer {
      display:flex; gap:16px; align-items:center; padding:10px 16px;
      border-top:1px solid var(--ps-border); flex-shrink:0;
    }
    .fld-preview-meta { font-size:11px; color:var(--ps-text-muted); font-family:var(--font-mono); }
    .fld-preview-close { flex-shrink:0; }

    /* Filmstrip preview detail content (reused by renderDetailContent) */
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
