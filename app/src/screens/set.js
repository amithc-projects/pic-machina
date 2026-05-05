/**
 * ImageChef — SET: Batch Setup
 *
 * Users select: input folder, output folder, recipe to apply, then start the batch.
 * Uses File System Access API for persistent folder handles.
 */

import { pickFolder, getFolder, setCurrentFolder, fileFilterForRecipe,
         listImages, loadVideoPreviews, writeVideoPreview, IMAGE_EXTS, VIDEO_EXTS } from '../data/folders.js';
import { isVideoFile, extractVideoFrame, getVideoDuration } from '../utils/video-frame.js';
import { getAllRecipes, getRecipe }                  from '../data/recipes.js';
import { getRunsForRecipe }                          from '../data/runs.js';
import { startBatch }                               from '../engine/batch.js';
import { navigate }                                 from '../main.js';
import { formatBytes }                              from '../utils/misc.js';
import { dbSaveFolderHistory, dbGetFolderHistory }  from '../data/db.js';
import { getSettings }                              from '../utils/settings.js';
import { renderParamField, collectParams,
         bindParamFieldEvents,
         injectParamFieldStyles }                   from '../utils/param-fields.js';
import { showThreeWayConfirm }                      from '../utils/dialogs.js';
import { registry }                                 from '../engine/index.js';
import { computeStrength }                          from '../engine/video-convert.js';
import { checkRecipeAvailability }                  from '../engine/capabilities.js';
import { MediaBrowser }                             from '../components/media-browser.js';
import { GlobalLightbox }                           from '../components/lightbox.js';

export async function render(container, hash) {
  injectStyles();
  // Parse recipe id from hash e.g. #set?recipe=sys-web-optimise
  const recipeId = new URLSearchParams(hash.split('?')[1] || '').get('recipe');

  // ── State ──────────────────────────────────────────────
  let inputHandle    = null;     // FileSystemDirectoryHandle (root)
  let currentHandle  = null;     // Currently navigated directory
  let outputHandle   = null;
  let selectedFiles  = [];       // File[] from input folder
  let dirStack       = [];       // [{handle, name}]
  let allFolders     = [];       // {name, handle}[]
  let setVideoPreviews = new Map(); // videoName → preview File
  let setFileMetadata = new Map(); // videoName → { width, height, duration }
  let selectedIds    = new Map();// Map<filename, sequenceInt>
  let currentRecipe  = null;
  let allRecipes     = [];
  let batchControl   = null;     // { cancel, runId }
  let lastClickedIdx = -1;       // for shift+click range

  let inputHistory   = [];
  let outputHistory  = [];
  let gridSearchTerm = '';
  let mediaBrowser   = null;

  // ── State declared early to avoid temporal dead zone (TDZ) ──
  const BUILTIN_SLOT_COUNTS = {
    'grid-2x2': 4, 'grid-3x3': 9, 'grid-4x4': 16,
    'split-1x2': 2, 'custom-tv': 1,
    'pip-corner-br': 2, 'pip-corner-bl': 2,
    'pip-corner-tr': 2, 'pip-corner-tl': 2,
  };
  let _slotTemplate = null;
  let _setPreviewGenHandle = 0;

  container.innerHTML = `
    <div class="screen set-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">folder_open</span>
          Batch Setup
        </div>
        <div class="flex items-center gap-2">
          <span id="set-order-hint" style="display:none; font-size:12px; margin-right:4px; font-style:italic;" class="text-muted">Select photos in sequence</span>
          <span id="set-run-warning" style="color:var(--ps-danger);display:none;font-size:12px;font-weight:500;padding-right:8px;"></span>
          <button class="btn-secondary" id="btn-edit-recipe" style="display:none" title="Edit selected recipe">
            <span class="material-symbols-outlined">edit</span>
            Edit Recipe
          </button>
          <button class="btn-primary" id="btn-run" disabled>
            <span class="material-symbols-outlined">play_arrow</span>
            Run Batch
          </button>
        </div>
      </div>

      <div class="set-body">
        <!-- Left config panel -->
        <div class="set-config">
          <!-- Recipe selector -->
          <section class="set-section">
            <div class="set-section-title">Recipe</div>
            <div id="set-recipe-display" class="set-recipe-pill">
              <span class="material-symbols-outlined">format_list_numbered</span>
              <span id="set-recipe-name">No recipe selected</span>
              <button class="btn-ghost" id="btn-pick-recipe" style="margin-left:auto">
                <span class="material-symbols-outlined">swap_horiz</span>Change
              </button>
            </div>
            <div id="set-recipe-desc" class="text-muted" style="font-size: 12px; margin-top: 8px; line-height: 1.4; display: none;"></div>
          </section>


          <!-- Output folder -->
          <section class="set-section" id="set-output-section">
            <div class="set-section-title" id="set-output-title">Output Folder</div>
            <div class="set-folder-row" id="set-output-row" style="flex-wrap:wrap">
              <span class="material-symbols-outlined" style="color:var(--ps-text-faint)">drive_folder_upload</span>
              <span id="set-output-path" class="set-folder-path text-muted">Not selected</span>
              <select id="set-output-mru" class="ic-input" style="width: auto; height: 33px; padding: 4px 8px; display: none; max-width:140px; font-size: 11px;">
                <option value="">Recent...</option>
              </select>
              <button class="btn-secondary" id="btn-pick-output">
                <span class="material-symbols-outlined">folder_open</span>Browse
              </button>
            </div>
            <div class="set-subfolder-row">
              <label class="ic-label">Output subfolder</label>
              <input id="set-subfolder" class="ic-input" value="output" style="max-width:160px">
            </div>
          </section>

          <!-- Options -->
          <section class="set-section">
            <div class="set-section-title">Options</div>
            <label class="set-checkbox-row">
              <input type="checkbox" id="opt-skip-existing" checked>
              <span>Skip already-processed files</span>
            </label>
          </section>

          <!-- Recent runs link — populated by updateRecipeDisplay() -->
          <section class="set-section" id="set-history-section" style="display:none">
            <div class="set-section-title">History</div>
            <a href="#" id="set-history-link" class="set-history-link" role="button">
              <span class="material-symbols-outlined">history</span>
              <span class="set-history-link__label">View recent runs</span>
              <span class="material-symbols-outlined set-history-link__arrow">arrow_forward</span>
            </a>
          </section>

          <!-- Slot assignment (shown when recipe uses a named template) -->
          <section class="set-section" id="set-slots-section" style="display:none">
            <div class="set-section-title">Slot Assignment</div>
            <div id="set-slots-list" style="display:flex;flex-direction:column;gap:6px;margin-top:4px;"></div>
          </section>

          <!-- Recipe run parameters (shown when recipe has params) -->
          <section class="set-section" id="set-params-section" style="display:none">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
              <div class="set-section-title" style="margin-bottom:0">Parameters</div>
              <button class="btn-ghost" id="set-params-reset" style="margin-left:auto;font-size:11px;padding:2px 8px;color:var(--ps-text-muted)">Reset</button>
            </div>
            <div id="set-params-fields" style="display:flex;flex-direction:column;gap:10px"></div>
          </section>
        </div>

        <!-- Right: image grid -->
        <div class="set-grid-area" style="display:flex; flex-direction:column; background:var(--ps-surface);">
          <div id="set-filter-warning" style="display:none; background: rgba(227, 179, 65, 0.15); color: #e3b341; padding: 12px 16px; font-size: 13px; font-weight: 500; border-bottom: 1px solid rgba(227, 179, 65, 0.2); align-items:center; gap: 8px;">
            <span class="material-symbols-outlined" style="font-size:18px;">warning</span>
            <span id="set-filter-warning-text"></span>
          </div>
          <div id="set-mb-host" style="flex: 1; display:flex; flex-direction:column; min-height: 0;"></div>
        </div>
      </div>

      <!-- Phase 6: read-only multi-track timeline for video-effect time ranges -->
      <div class="set-timeline" id="set-timeline" style="display:none">
        <div class="set-timeline-header">
          <span class="material-symbols-outlined" style="font-size:14px">timeline</span>
          Effect Timeline
        </div>
        <div class="set-timeline-tracks" id="set-timeline-tracks"></div>
      </div>
    </div>`;

  // ── Load recipes ──────────────────────────────────────
  allRecipes = await getAllRecipes();

  // Restore persisted folder handles
  inputHandle  = await getFolder('input').catch(() => null);
  outputHandle = await getFolder('output').catch(() => null);
  if (inputHandle) {
    currentHandle = inputHandle;
    dirStack = [];
    await refreshImageGrid();
  } else {
    renderEmptyState();
  }
  if (outputHandle) { container.querySelector('#set-output-path').textContent = outputHandle.name; }

  // ── Apply Settings ──────────────────────────────────────
  const settings = getSettings();
  if (settings.batch?.useInputForOutput) {
     container.querySelector('#set-output-title').textContent = 'Output Destination';
     container.querySelector('#set-output-row').style.display = 'none';
  }

  // ── MRU Injection ───────────────────────────────────────
  async function renderMRUs() {
    outputHistory = await dbGetFolderHistory('output');
    
    const renderDropdown = (hist, curHandle, selId) => {
      const dp = container.querySelector(selId);
      if (!dp || !hist || hist.length === 0) {
        if (dp) dp.style.display = 'none';
        return;
      }
      let html = `<option value="">History...</option>`;
      hist.forEach((h, i) => html += `<option value="${i}">${h.name}</option>`);
      dp.innerHTML = html;
      dp.style.display = 'block';
    };

    renderDropdown(outputHistory, outputHandle, '#set-output-mru');
  }
  await renderMRUs();

  container.querySelector('#set-output-mru')?.addEventListener('change', async e => {
    const idx = parseInt(e.target.value);
    if (isNaN(idx)) return;
    const h = outputHistory[idx];
    try {
      if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') return;
      }
      outputHandle = h;
      container.querySelector('#set-output-path').textContent = outputHandle.name;
      await dbSaveFolderHistory('output', outputHandle);
      await renderMRUs();
      updateRunButton();
      e.target.value = '';
    } catch (err) { console.error('MRU output load failed', err); }
  });

  // Pre-select recipe if passed in hash
  if (recipeId) {
    currentRecipe = await getRecipe(recipeId);
    if (currentRecipe) updateRecipeDisplay();
  }

  updateRunButton();

  // ── Pick recipe button ────────────────────────────────
  container.querySelector('#btn-pick-recipe').addEventListener('click', () => showRecipePicker());


  // ── Output folder ─────────────────────────────────────
  container.querySelector('#btn-pick-output').addEventListener('click', async () => {
    try {
      outputHandle = await pickFolder('output');
      container.querySelector('#set-output-path').textContent = outputHandle.name;
      await dbSaveFolderHistory('output', outputHandle);
      await renderMRUs();
      updateRunButton();
    } catch (e) { if (e.name !== 'AbortError') console.error(e); }
  });

  // ── Run batch ─────────────────────────────────────────
  container.querySelector('#btn-run').addEventListener('click', async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (!currentRecipe || !inputHandle) return;
    
    let effOutputHandle = outputHandle;
    const settings = getSettings();
    if (settings.batch?.useInputForOutput) {
      effOutputHandle = inputHandle;
      
      // Ensure we have read/write access to input folder if using it as output natively
      if ((await effOutputHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
          if ((await effOutputHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
              window.AuroraToast?.show({ variant: 'danger', title: 'Permission Denied', description: 'Cannot write output to the input directory without your permission.' });
              return;
          }
      }
    }
    
    if (!effOutputHandle) return;

    let files = selectedFiles.filter(f => selectedIds.has(f.name));
    if (currentRecipe?.isOrdered) {
        files = files.sort((a,b) => selectedIds.get(a.name) - selectedIds.get(b.name));
    }
    if (!files.length) return;

    const subfolder = container.querySelector('#set-subfolder').value.trim() || 'output';

    // Collect inline run params (if any) and persist last-used values
    let runParams = {};
    if (currentRecipe.params?.length) {
      runParams = collectParams(container, currentRecipe.params, 'rp');
      localStorage.setItem(`ic-run-params-${currentRecipe.id}`, JSON.stringify(runParams));
    }

    // Verify output folder is still accessible before navigating away
    try {
      await outputHandle.getDirectoryHandle('.', { create: false }).catch(() => {});
    } catch (_) { /* non-fatal — let startBatch surface the real error */ }

    // Pre-run gate: check for unmet transform requirements
    const { available: recipeAvailable, unmet } = await checkRecipeAvailability(currentRecipe);
    if (!recipeAvailable) {
      const proceed = await showCapabilityDialog(unmet);
      if (!proceed) return;
    }

    // Update browser URL hash explicitly
    location.hash = '#que';
    
    window._queRunAgain = async () => {
      try {
        batchControl = await startBatch({
          recipe: currentRecipe,
          files,
          inputHandle: currentHandle,
          outputHandle: effOutputHandle,
          subfolder,
          runParams,
          onProgress: (p, t, fn, overridePct) => window._queProgress?.(p, t, fn, overridePct),
          onLog:      (lvl, msg) => window._queLog?.(lvl, msg),
          onComplete: (run)      => window._queComplete?.(run),
          onError:    (msg)      => window._queError?.(msg),
        });
        window._queRunControl = batchControl;
      } catch (err) {
        console.error('[SET] startBatch failed:', err);
        const msg = err.name === 'NotFoundError'
          ? 'Output folder not found — please re-select it on the Batch Setup screen.'
          : err.message;
        window._queError?.(msg);
        window.AuroraToast?.show({ variant: 'danger', title: 'Batch failed to start', description: msg });
      }
    };

    // Wait for QUE screen to render before starting
    const checkReady = setInterval(() => {
      if (window._queProgress) {
        clearInterval(checkReady);
        window._queRunAgain();
      }
    }, 50);
    
    // Safety timeout just in case it never renders
    setTimeout(() => clearInterval(checkReady), 5000);
  });

  // ── Background preview generation ────────────────────

  async function scheduleSetPreviewGeneration(dirHandle) {
    const runId = ++_setPreviewGenHandle;

    // 1. Fetch missing metadata for all files
    const filesWithoutMeta = selectedFiles.filter(f => !setFileMetadata.has(f.name));
    for (const file of filesWithoutMeta) {
      if (_setPreviewGenHandle !== runId) return;
      await new Promise(r => setTimeout(r, 10)); // tiny yield to avoid blocking UI
      try {
        if (isVideoFile(file)) {
          const meta = await getVideoDuration(file);
          setFileMetadata.set(file.name, meta);
        } else {
          // Fast dimension read for images
          const bmp = await createImageBitmap(file);
          setFileMetadata.set(file.name, { width: bmp.width, height: bmp.height });
          bmp.close();
        }
        
        // Live update the tooltip if it's currently rendered
        const thumb = container.querySelector(`[data-file-name="${CSS.escape(file.name)}"]`);
        if (thumb) {
          const cell = thumb.closest('.set-img-cell');
          if (cell) {
            const meta = setFileMetadata.get(file.name);
            const dateStr = new Date(file.lastModified).toLocaleString();
            const sizeStr = formatBytes(file.size);
            const typeStr = isVideoFile(file) 
              ? `Video: ${meta.width}x${meta.height} • ${meta.duration ? meta.duration.toFixed(1) + 's' : '?s'}` 
              : `Image: ${meta.width}x${meta.height}`;
            cell.title = `${file.name}\n${typeStr}\nModified: ${dateStr}\nSize: ${sizeStr}`;
          }
        }
      } catch(e) {
        setFileMetadata.set(file.name, { width: '?', height: '?' });
      }
    }

    // 2. Generate missing video thumbnails
    const videosWithoutPreview = selectedFiles.filter(
      f => isVideoFile(f) && !setVideoPreviews.has(f.name)
    );
    if (!videosWithoutPreview.length) return;

    for (const file of videosWithoutPreview) {
      if (_setPreviewGenHandle !== runId) return; // cancelled by new folder load
      await new Promise(r => setTimeout(r, 50)); // yield to UI
      try {
        const canvas = await extractVideoFrame(file);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
        await writeVideoPreview(dirHandle, file.name, blob);
        const previewFile = new File([blob], `.${file.name}.preview.jpg`, { type: 'image/jpeg' });
        setVideoPreviews.set(file.name, previewFile);
        if (mediaBrowser) {
           const ent = mediaBrowser.entries.find(e => e.name === file.name);
           if (ent) ent.preview = previewFile;
        }
      } catch { /* silently skip this video */ }
    }
  }

  // ── Helpers ───────────────────────────────────────────
  function renderEmptyState() {
    const host = container.querySelector('#set-mb-host');
    if (!host) return;
    host.innerHTML = `
      <div class="empty-state" style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <span class="material-symbols-outlined" style="font-size:48px; color:var(--ps-text-faint);">folder_open</span>
        <div class="empty-state-title" style="margin-top:16px;">No Input Folder Selected</div>
        <div class="empty-state-desc">Select an input folder to view and pick media for processing.</div>
        <button class="btn-primary" id="set-btn-empty-browse" style="margin-top:16px;">
          <span class="material-symbols-outlined">folder_open</span> Browse
        </button>
      </div>`;
    host.querySelector('#set-btn-empty-browse')?.addEventListener('click', async () => {
      try {
        inputHandle = await pickFolder('input');
        currentHandle = inputHandle;
        dirStack = [];
        await refreshImageGrid();
      } catch(e) {}
    });
  }

  async function refreshImageGrid() {
    if (!currentHandle) return;
    try {
      const { includeVideo, onlyVideo } = fileFilterForRecipe(currentRecipe);

      const files = [];
      allFolders = [];
      let skippedMediaCount = 0;

      for await (const [name, entry] of currentHandle.entries()) {
        if (name.startsWith('.')) continue;
        if (entry.kind === 'directory') {
          allFolders.push({ name, handle: entry });
        } else if (entry.kind === 'file') {
          const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
          const isImg = IMAGE_EXTS.has(ext);
          const isVid = VIDEO_EXTS.has(ext);
          const isMedia = isImg || isVid;
          
          let match = false;
          if (onlyVideo) {
            if (isVid) match = true;
          } else if (includeVideo) {
            if (isImg || isVid) match = true;
          } else {
            if (isImg) match = true;
          }
          
          if (match) {
            files.push({ file: await entry.getFile(), handle: entry });
          } else if (isMedia) {
            skippedMediaCount++;
          }
        }
      }
      files.sort((a, b) => a.file.name.localeCompare(b.file.name));
      allFolders.sort((a, b) => a.name.localeCompare(b.name));

      selectedFiles = files.map(f => f.file);
      setVideoPreviews = await loadVideoPreviews(currentHandle);

      const previousSelection = new Map(selectedIds);
      selectedIds.clear();

      if (previousSelection.size > 0) {
        selectedFiles.forEach(f => {
          if (previousSelection.has(f.name)) selectedIds.set(f.name, previousSelection.get(f.name));
        });
      }
      
      const mbEntries = [];
      allFolders.forEach(folder => {
        mbEntries.push({ name: folder.name, file: null, isFolder: true, _folder: folder });
      });
      selectedFiles.forEach(f => {
        mbEntries.push({ name: f.name, file: f, isFolder: false, sidecar: null, preview: setVideoPreviews.get(f.name) });
      });
      if (dirStack.length > 0) {
        mbEntries.push({ name: '..', file: null, isFolder: true, _up: true });
      }

      if (!mediaBrowser) {
        container.querySelector('#set-mb-host').innerHTML = ''; // Clear empty state
        mediaBrowser = new MediaBrowser(container.querySelector('#set-mb-host'), {
          mode: 'grid',
          entries: mbEntries,
          breadcrumbs: dirStack.map(d => d.name),
          currentFolderName: currentHandle.name,
          canGoUp: dirStack.length > 0,
          childFolders: allFolders.map(f => f.name),
          hiddenFilesCount: skippedMediaCount,
          hiddenFilesMessage: onlyVideo ? 'because this recipe only accepts Videos.' : (includeVideo ? 'because this recipe only accepts Images and Videos.' : 'because this recipe only accepts Images.'),
          isOrderedSelection: !!currentRecipe?.isOrdered,
          onChangeFolderClick: async () => {
            try {
              inputHandle = await pickFolder('input');
              currentHandle = inputHandle;
              dirStack = [];
              await refreshImageGrid();
            } catch (e) { if (e.name !== 'AbortError') console.error(e); }
          },
          onChildFolderSelect: async (name) => {
            const folder = allFolders.find(f => f.name === name);
            if (folder) {
              dirStack.push({ handle: currentHandle, name: currentHandle.name });
              currentHandle = folder.handle;
              await refreshImageGrid();
            }
          },
          onNavigateUp: async () => {
            if (dirStack.length === 0) return;
            const up = dirStack.pop();
            currentHandle = up.handle;
            await refreshImageGrid();
          },
          onNavigateTo: async (idx) => {
            if (idx < 0 || idx >= dirStack.length) return;
            currentHandle = dirStack[idx].handle;
            dirStack = dirStack.slice(0, idx);
            await refreshImageGrid();
          },
          onSelectionChange: (sel) => {
             selectedIds.clear();
             sel.forEach((s, i) => selectedIds.set(s, i + 1));
             updateSelCount();
             updateRunButton();
             renderSlotAssignment();
          },
          onDoubleClick: (ent) => {
             if (ent.isFolder) {
               if (ent.name === '..') {
                 if (dirStack.length > 0) {
                   const up = dirStack.pop();
                   currentHandle = up.handle;
                   refreshImageGrid();
                 }
               } else {
                 const folder = allFolders.find(f => f.name === ent.name);
                 if (folder) {
                   dirStack.push({ handle: currentHandle, name: currentHandle.name });
                   currentHandle = folder.handle;
                   refreshImageGrid();
                 }
               }
               return;
             }
             if (ent.file) {
               const lb = new GlobalLightbox();
               lb.show([ent], 0);
             }
          }
        });
        
        const selArray = Array.from(selectedIds.entries()).sort((a,b) => a[1] - b[1]).map(x => x[0]);
        selArray.forEach(s => mediaBrowser.selectedIds.add(s));
        mediaBrowser._syncSelectionUI();
        
      } else {
        mediaBrowser.options.isOrderedSelection = !!currentRecipe?.isOrdered;
        mediaBrowser.options.breadcrumbs = dirStack.map(d => d.name);
        mediaBrowser.options.currentFolderName = currentHandle.name;
        mediaBrowser.options.canGoUp = dirStack.length > 0;
        mediaBrowser.options.childFolders = allFolders.map(f => f.name);
        mediaBrowser.options.hiddenFilesCount = skippedMediaCount;
        mediaBrowser.options.hiddenFilesMessage = onlyVideo ? 'because this recipe only accepts Videos.' : (includeVideo ? 'because this recipe only accepts Images and Videos.' : 'because this recipe only accepts Images.');
        mediaBrowser.entries = mbEntries;
        mediaBrowser.applyFilters();
        
        const selArray = Array.from(selectedIds.entries()).sort((a,b) => a[1] - b[1]).map(x => x[0]);
        mediaBrowser.selectedIds.clear();
        selArray.forEach(s => mediaBrowser.selectedIds.add(s));
        mediaBrowser._syncSelectionUI();
        mediaBrowser.renderHeader(); // Re-render breadcrumbs
      }

      const warningEl = container.querySelector('#set-filter-warning');
      const warningText = container.querySelector('#set-filter-warning-text');
      if (warningEl && warningText) {
        if (skippedMediaCount > 0) {
           const typeStr = onlyVideo ? 'Videos' : 'Images';
           warningText.innerHTML = `<b>${skippedMediaCount} file(s) hidden</b> because this recipe only accepts ${typeStr}.`;
           warningEl.style.display = 'flex';
        } else if (files.length === 0 && (allFolders.length > 0 || dirStack.length > 0)) {
           const typeStr = onlyVideo ? 'Videos' : (includeVideo ? 'media files' : 'Images');
           warningText.innerHTML = `No <b>${typeStr}</b> found in this folder.`;
           warningEl.style.display = 'flex';
        } else {
           warningEl.style.display = 'none';
        }
      }

      renderSlotAssignment();
      scheduleSetPreviewGeneration(currentHandle);

      window._icTestFolderFiles = [...selectedFiles];
      
      updateSelCount();
      updateRunButton();
    } catch (err) {
      console.error('[SET] listImages failed:', err);
    }
  }

  function updateSelCount() {
    // Toggle hint
    const hintEl = container.querySelector('#set-order-hint');
    if (hintEl) hintEl.style.display = (currentRecipe?.isOrdered && selectedIds.size > 0) ? '' : 'none';
  }

  function updateRunButton() {
    const btn = container.querySelector('#btn-run');
    const warningText = container.querySelector('#set-run-warning');
    if (!btn) return;

    let warning = '';
    if (currentRecipe) {
      const count = selectedIds.size;
      const min = currentRecipe.minItems;
      const max = currentRecipe.maxItems;
      
      if (typeof min === 'number' && count < min) {
        warning = min === max ? `Requires exactly ${min} items` : `Requires at least ${min} items`;
      } else if (typeof max === 'number' && count > max) {
        warning = min === max ? `Requires exactly ${max} items` : `Requires at most ${max} items`;
      }
    }

    let effOut = outputHandle;
    if (getSettings().batch?.useInputForOutput) {
       effOut = inputHandle; // Bypasses the discrete outputHandle check
    }

    let isReady = !!(currentRecipe && inputHandle && effOut && selectedIds.size > 0);
    if (warning) {
      isReady = false;
    }

    btn.disabled = !isReady;
    if (warningText) {
      warningText.textContent = warning;
      warningText.style.display = warning ? '' : 'none';
    }

    // Async lock for capabilities (prevents even trying to run if blocked by premium)
    if (isReady && currentRecipe) {
      checkRecipeAvailability(currentRecipe).then(({ available, unmet }) => {
        if (!available) {
          const hasPremiumLock = unmet.some(r => r.type === 'premium');
          if (hasPremiumLock) {
            btn.disabled = true;
            if (warningText) {
              const lockType = unmet.find(r => r.type === 'premium')?.id === 'enterprise' ? 'Enterprise' : 'Pro';
              warningText.textContent = `Requires Pic-Machina ${lockType}`;
              warningText.style.display = '';
            }
          }
        }
      });
    }
  }

  function recipeSlug(name) {
    return (name || 'output').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'output';
  }

  function updateRecipeDisplay() {
    const name = container.querySelector('#set-recipe-name');
    if (name) name.textContent = currentRecipe?.name || 'No recipe selected';
    const editBtn = container.querySelector('#btn-edit-recipe');
    if (editBtn) editBtn.style.display = currentRecipe ? '' : 'none';

    const descEl = container.querySelector('#set-recipe-desc');
    if (descEl) {
      if (currentRecipe) {
        const stepCount = currentRecipe.nodes ? currentRecipe.nodes.length : 0;
        const stepText = stepCount === 1 ? '1 step' : `${stepCount} steps`;
        descEl.innerHTML = `<strong>${stepText}</strong> &nbsp;·&nbsp; ${currentRecipe.description || 'No description provided.'}`;
        descEl.style.display = 'block';
      } else {
        descEl.style.display = 'none';
      }
    }

    // Default subfolder to sanitized recipe name
    const subfolderEl = container.querySelector('#set-subfolder');
    if (subfolderEl && currentRecipe) subfolderEl.value = recipeSlug(currentRecipe.name);

    // Render inline recipe params and slot assignment
    renderInlineParams();
    loadSlotTemplate().then(renderSlotAssignment);
    renderEffectTimeline();
    updateRunButton();
    refreshImageGrid();
    refreshHistoryLink();
  }

  /**
   * Toggle the "Recent runs" link in the sidebar based on the current
   * recipe. When there are runs for this recipe, the link shows the count
   * and navigates to the Output History pre-filtered to this recipe id.
   * When there are no runs yet, the section is hidden so it doesn't add
   * noise to a brand-new recipe's setup screen.
   */
  async function refreshHistoryLink() {
    const section = container.querySelector('#set-history-section');
    const link    = container.querySelector('#set-history-link');
    const label   = container.querySelector('.set-history-link__label');
    if (!section || !link || !label) return;

    if (!currentRecipe?.id) { section.style.display = 'none'; return; }

    let runs = [];
    try { runs = await getRunsForRecipe(currentRecipe.id); } catch { runs = []; }
    if (!runs.length) { section.style.display = 'none'; return; }

    section.style.display = '';
    label.textContent = runs.length === 1
      ? 'View 1 recent run'
      : `View ${runs.length} recent runs`;

    // Re-bind every refresh — the link's recipe id changes when the user
    // swaps recipes via "Change". Prefer onclick (idempotent) over
    // addEventListener so we don't accumulate handlers.
    link.onclick = (e) => {
      e.preventDefault();
      navigate(`#out?recipe=${currentRecipe.id}`);
    };
  }

  // ── Phase 6: Read-only effect timeline ───────────────────
  function renderEffectTimeline() {
    const timelineEl = container.querySelector('#set-timeline');
    const tracksEl   = container.querySelector('#set-timeline-tracks');
    if (!timelineEl || !tracksEl) return;

    if (!currentRecipe) { timelineEl.style.display = 'none'; return; }

    // Collect video-effect nodes that have a timeRange
    const allNodes = flattenRecipeNodes(currentRecipe.nodes);
    const trNodes = allNodes.filter(n => {
      if (!n.timeRange) return false;
      const d = registry.get(n.transformId);
      return d?.categoryKey === 'video-effect';
    });

    // Also check if any input files are video (heuristic: check window._icTestFolderFiles)
    const files = window._icTestFolderFiles || [];
    const hasVideo = files.some(f => isVideoFile(f));

    if (!trNodes.length || !hasVideo) {
      timelineEl.style.display = 'none';
      return;
    }

    timelineEl.style.display = '';

    // Estimate total duration: use the longest "end" or a default
    let maxEnd = 10;
    let totalInsert = 0;
    for (const n of trNodes) {
      const tr = n.timeRange;
      if (tr.mode === 'standard' && tr.end > maxEnd) maxEnd = tr.end;
      if (tr.mode === 'freeze') totalInsert += tr.insertDuration || 0;
    }
    const totalDur = maxEnd + totalInsert;

    tracksEl.innerHTML = trNodes.map(n => {
      const d  = registry.get(n.transformId);
      const tr = n.timeRange;
      const label = d?.name || n.transformId;
      const spLabel = d?.strengthParam
        ? (d.params || []).find(p => p.name === d.strengthParam)?.label || d.strengthParam
        : '';

      if (tr.mode === 'freeze') {
        const left = ((tr.start || 0) / totalDur) * 100;
        const width = ((tr.insertDuration || 2) / totalDur) * 100;
        return `
          <div class="set-tl-track">
            <div class="set-tl-label">${label}${spLabel ? ` <span class="set-tl-param">${spLabel}</span>` : ''}</div>
            <div class="set-tl-bar">
              <div class="set-tl-range set-tl-freeze" style="left:${left}%;width:${width}%"
                title="Freeze: ${tr.insertDuration}s inserted at ${tr.start}s"></div>
            </div>
          </div>`;
      }

      // Standard mode
      const s = tr.start || 0;
      const e = tr.end ?? totalDur;
      const fi = tr.fadeIn || 0;
      const fo = tr.fadeOut || 0;
      const left  = (s / totalDur) * 100;
      const width = ((e - s) / totalDur) * 100;
      const relFI = fi > 0 ? (fi / (e - s)) * 100 : 0;
      const relFO = fo > 0 ? (1 - fo / (e - s)) * 100 : 100;

      return `
        <div class="set-tl-track">
          <div class="set-tl-label">${label}${spLabel ? ` <span class="set-tl-param">${spLabel}</span>` : ''}</div>
          <div class="set-tl-bar">
            <div class="set-tl-range set-tl-standard" style="left:${left}%;width:${width}%;
              background:linear-gradient(to right,
                rgba(59,130,246,0.1) 0%,
                rgba(59,130,246,0.5) ${relFI}%,
                rgba(59,130,246,0.5) ${relFO}%,
                rgba(59,130,246,0.1) 100%
              )" title="${s.toFixed(1)}s – ${e.toFixed(1)}s"></div>
          </div>
        </div>`;
    }).join('');
  }

  function renderInlineParams() {
    injectParamFieldStyles();
    const section = container.querySelector('#set-params-section');
    const fields  = container.querySelector('#set-params-fields');
    if (!section || !fields) return;

    const paramDefs = currentRecipe?.params || [];
    if (!paramDefs.length) { section.style.display = 'none'; return; }

    section.style.display = '';
    const storageKey = `ic-run-params-${currentRecipe.id}`;
    const lastUsed   = JSON.parse(localStorage.getItem(storageKey) || 'null') || {};
    fields.innerHTML = paramDefs.map(p => renderParamField(p, lastUsed[p.name] ?? p.defaultValue, 'rp', { showVarBind: false })).join('');
    bindParamFieldEvents(container, paramDefs, 'rp', {
      getRecipeVars: () => paramDefs.map(p => p.name),
      getVarContext: () => ({ recipeVars: paramDefs.map(p => p.name) }),
    });

    container.querySelector('#set-params-reset')?.addEventListener('click', () => {
      localStorage.removeItem(storageKey);
      fields.innerHTML = paramDefs.map(p => renderParamField(p, p.defaultValue, 'rp', { showVarBind: false })).join('');
      bindParamFieldEvents(container, paramDefs, 'rp', {
      getRecipeVars: () => paramDefs.map(p => p.name),
      getVarContext: () => ({ recipeVars: paramDefs.map(p => p.name) }),
    });
    }, { once: true });
  }

  // ── Slot assignment panel ─────────────────────────────

  function flattenRecipeNodes(nodes) {
    const out = [];
    for (const n of (nodes || [])) {
      if (n.type === 'transform') out.push(n);
      if (n.type === 'conditional') { out.push(...flattenRecipeNodes(n.thenNodes)); out.push(...flattenRecipeNodes(n.elseNodes)); }
      if (n.type === 'branch') n.branches?.forEach(b => out.push(...flattenRecipeNodes(b.nodes)));
    }
    return out;
  }

  async function loadSlotTemplate() {
    if (!currentRecipe) { _slotTemplate = null; return; }

    const allNodes = flattenRecipeNodes(currentRecipe.nodes);

    // flow-video-wall uses params.layout — either a built-in key or a custom template ID
    const wallNode = allNodes.find(n => n.transformId === 'flow-video-wall' && n.params?.layout);
    if (wallNode) {
      const layout = wallNode.params.layout;
      if (layout in BUILTIN_SLOT_COUNTS) {
        const count = BUILTIN_SLOT_COUNTS[layout];
        _slotTemplate = { name: layout, placeholders: Array.from({ length: count }, () => ({})) };
        return;
      }
      // Not a built-in key — try loading as a custom template from the DB
      try {
        const { getTemplate } = await import('../data/templates.js');
        _slotTemplate = await getTemplate(layout) || null;
      } catch { _slotTemplate = null; }
      return;
    }

    // flow-template-aggregator uses params.templateId (custom template DB key)
    const aggNode = allNodes.find(n => n.transformId === 'flow-template-aggregator' && n.params?.templateId);
    if (aggNode) {
      try {
        const { getTemplate } = await import('../data/templates.js');
        _slotTemplate = await getTemplate(aggNode.params.templateId) || null;
      } catch { _slotTemplate = null; }
      return;
    }

    _slotTemplate = null;
  }

  function renderSlotAssignment() {
    const section = container.querySelector('#set-slots-section');
    const list    = container.querySelector('#set-slots-list');
    if (!section || !list) return;

    if (!_slotTemplate || !_slotTemplate.placeholders?.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';

    // Build reverse map: sequenceNumber → File
    const seqToFile = new Map();
    for (const [name, seq] of selectedIds.entries()) {
      const file = selectedFiles.find(f => f.name === name);
      if (file) seqToFile.set(seq, file);
    }

    // Sort placeholders by zIndex to match batch.js rendering order
    const sortedPlaceholders = [..._slotTemplate.placeholders].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    list.innerHTML = sortedPlaceholders.map((ph, i) => {
      const slotNum  = i + 1;
      const label    = ph.label ? ` — ${ph.label}` : '';
      const assigned = seqToFile.get(slotNum);
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;
          background:var(--ps-bg-raised);border:1px solid var(--ps-border);border-radius:6px;">
          <div class="set-slot-thumb" data-slot="${slotNum}"
            style="width:44px;height:44px;border-radius:4px;flex-shrink:0;
              background:var(--ps-bg-overlay);border:1px solid var(--ps-border);
              display:flex;align-items:center;justify-content:center;overflow:hidden;">
            <span class="material-symbols-outlined" style="font-size:18px;color:var(--ps-text-faint)">
              ${assigned ? (isVideoFile(assigned) ? 'movie' : 'image') : 'help_outline'}
            </span>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:600;">Slot ${slotNum}${label}</div>
            <div style="font-size:11px;color:var(--ps-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${assigned ? assigned.name : '<span style="color:var(--ps-text-faint);font-style:italic">Not assigned</span>'}
            </div>
          </div>
        </div>`;
    }).join('');

    // Load thumbnails asynchronously
    list.querySelectorAll('[data-slot]').forEach(thumbEl => {
      const slotNum = parseInt(thumbEl.dataset.slot, 10);
      const file    = seqToFile.get(slotNum);
      if (!file) return;

      const imgEl = thumbEl; // the div itself is the thumbnail container

      if (isVideoFile(file)) {
        const preview = setVideoPreviews.get(file.name);
        if (preview) {
          const url = URL.createObjectURL(preview);
          imgEl.style.backgroundImage    = `url(${url})`;
          imgEl.style.backgroundSize     = 'cover';
          imgEl.style.backgroundPosition = 'center';
          imgEl.innerHTML = '';
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        imgEl.style.backgroundImage    = `url(${url})`;
        imgEl.style.backgroundSize     = 'cover';
        imgEl.style.backgroundPosition = 'center';
        imgEl.innerHTML = '';
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }



  container.querySelector('#btn-edit-recipe')?.addEventListener('click', () => {
    if (currentRecipe) navigate(`#bld?id=${currentRecipe.id}`);
  });

  // ── Recipe picker modal ───────────────────────────────
  function showRecipePicker() {
    const existing = document.getElementById('recipe-picker-modal');
    if (existing) existing.remove();

    const modal = document.createElement('dialog');
    modal.id = 'recipe-picker-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal__header">
        <h2 class="modal__title">Choose a Recipe</h2>
        <button class="modal__close" aria-label="Close"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="modal__body" style="padding:0">
        <div style="padding:12px 16px;border-bottom:1px solid var(--ps-border)">
          <input class="ic-input" id="recipe-picker-search" placeholder="Search…" autocomplete="off">
        </div>
        <ul id="recipe-picker-list" style="list-style:none;padding:8px;margin:0;max-height:400px;overflow-y:auto;">
          ${allRecipes.map(r => `
            <li class="recipe-picker-item" data-id="${r.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background 100ms">
              <div class="recipe-picker-swatch" style="width:24px;height:24px;border-radius:6px;background:${r.coverColor || '#374151'};flex-shrink:0"></div>
              <div>
                <div style="font-size:13px;font-weight:500;color:var(--ps-text)">${r.name}</div>
                <div style="font-size:11px;color:var(--ps-text-muted)">${r.isSystem ? 'System' : 'Yours'}</div>
              </div>
            </li>`).join('')}
        </ul>
      </div>`;

    document.body.appendChild(modal);
    modal.showModal();

    modal.querySelector('.modal__close')?.addEventListener('click', () => modal.close());
    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

    modal.querySelector('#recipe-picker-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      modal.querySelectorAll('.recipe-picker-item').forEach(item => {
        const name = item.querySelector('div > div')?.textContent?.toLowerCase() || '';
        item.style.display = name.includes(q) ? '' : 'none';
      });
    });

    modal.querySelectorAll('.recipe-picker-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.background = 'var(--ps-bg-raised)');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('click', () => {
        currentRecipe = allRecipes.find(r => r.id === item.dataset.id);
        updateRecipeDisplay();
        modal.close();
      });
    });
  }

  return () => {
    // cleanup on unmount
  };

}

// ── Capability gate dialog ─────────────────────────────────
/**
 * Shows a non-blocking dialog listing unmet requirements.
 * Returns true  → user chose "Run anyway"
 * Returns false → user chose "Fix now" (already navigated) or dismissed
 */
function showCapabilityDialog(unmet) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'ic-modal';
    dlg.style.cssText = 'max-width:420px;width:90vw;padding:0;border-radius:12px;border:1px solid var(--ps-border);background:var(--ps-bg-surface)';

    const items = unmet.map(req =>
      `<li style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;color:var(--ps-text)">
         <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-warning,#f59e0b)">warning</span>
         ${escHtml(req.label || req.id)}
       </li>`
    ).join('');

    const hasPremiumLock = unmet.some(r => r.type === 'premium');

    dlg.innerHTML = `
      <style>
        dialog.ic-modal { margin: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        dialog.ic-modal::backdrop { background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); }
      </style>
      <div style="padding:20px 20px 8px;border-bottom:1px solid var(--ps-border)">
        <div style="font-size:15px;font-weight:600;color:var(--ps-text);margin-bottom:4px">${hasPremiumLock ? 'License Required' : 'Setup required'}</div>
        <div style="font-size:12px;color:var(--ps-text-muted)">This recipe uses steps that need additional setup:</div>
      </div>
      <ul style="list-style:none;padding:12px 20px;margin:0">
        ${items}
      </ul>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--ps-border)">
        <button class="btn-secondary" id="cap-dlg-fix">
          <span class="material-symbols-outlined">open_in_new</span>${hasPremiumLock ? 'Upgrade' : 'Fix now'}
        </button>
        ${hasPremiumLock ? '' : '<button class="btn-primary" id="cap-dlg-run">Run anyway</button>'}
      </div>`;

    document.body.appendChild(dlg);
    dlg.showModal();

    if (!hasPremiumLock) {
      dlg.querySelector('#cap-dlg-run').addEventListener('click', () => {
        dlg.close(); dlg.remove(); resolve(true);
      });
    }
    dlg.querySelector('#cap-dlg-fix').addEventListener('click', () => {
      dlg.close(); dlg.remove();
      const href = hasPremiumLock ? '#sys' : (unmet[0]?.actionHref || '#mdl');
      location.hash = href;
      resolve(false);
    });
    dlg.addEventListener('cancel', () => { dlg.remove(); resolve(false); });
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Scoped styles ─────────────────────────────────────────
let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    .set-screen { display:flex; flex-direction:column; height:100%; }
    .set-body { display:flex; flex:1; overflow:hidden; }

    .set-config {
      width: 280px; min-width: 280px;
      border-right: 1px solid var(--ps-border);
      overflow-y: auto;
      padding: 16px;
      display: flex; flex-direction: column; gap: 16px;
      background: var(--ps-bg-surface);
    }
    .set-section-title {
      font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.07em;
      color:var(--ps-text-muted); margin-bottom:8px;
    }
    .set-recipe-pill {
      display:flex; align-items:center; gap:8px;
      background:var(--ps-bg-raised); border:1px solid var(--ps-border);
      border-radius:8px; padding:8px 10px; font-size:13px; color:var(--ps-text);
    }
    .set-recipe-pill .material-symbols-outlined { color:var(--ps-blue); font-size:18px; }
    .set-folder-row {
      display:flex; align-items:center; gap:8px;
      background:var(--ps-bg-overlay); border:1px solid var(--ps-border);
      border-radius:8px; padding:8px 10px; font-size:13px;
    }
    .set-folder-path { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
    .set-subfolder-row { margin-top:8px; display:flex; align-items:center; gap:8px; }
    .set-subfolder-row .ic-label { white-space:nowrap; margin-bottom:0; }
    .set-checkbox-row { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ps-text); cursor:pointer; }

    /* "View recent runs" link — sidebar entry that jumps to Output History
       pre-filtered to the current recipe. */
    .set-history-link {
      display:flex; align-items:center; gap:8px;
      padding:8px 12px;
      border:1px solid var(--ps-border);
      border-radius:8px;
      background:var(--ps-bg-raised);
      color:var(--ps-text-muted);
      text-decoration:none;
      font-size:13px;
      transition:border-color 120ms ease, color 120ms ease, background 120ms ease;
    }
    .set-history-link:hover {
      border-color:var(--ps-blue);
      color:var(--ps-text);
      background:var(--ps-bg-surface);
    }
    .set-history-link .material-symbols-outlined { font-size:18px; }
    .set-history-link__label { flex:1; }
    .set-history-link__arrow { font-size:16px !important; opacity:.6; transition:transform 120ms ease, opacity 120ms ease; }
    .set-history-link:hover .set-history-link__arrow { transform:translateX(2px); opacity:1; }

    .set-grid-area { flex:1; display:flex; flex-direction:column; min-height:0; min-width:0; }
    .set-grid-search-bar {
      display:flex; align-items:center; gap:8px;
      background:var(--ps-bg-raised); border-bottom:1px solid var(--ps-border);
      padding:8px 16px; flex-shrink:0;
    }
    .set-grid-search-bar input::placeholder { color:var(--ps-text-faint); }
    .set-grid-scroll { flex:1; overflow-y:auto; padding:16px; }
    .set-image-grid {
      display:grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap:10px;
    }
    .set-img-cell {
      position:relative; border-radius:8px; overflow:hidden; cursor:pointer;
      border:2px solid var(--ps-border); transition:border-color 150ms ease;
    }
    .set-img-cell.is-selected { border-color:var(--ps-blue); }
    .set-img-thumb {
      width:100%; aspect-ratio:1; background:var(--ps-bg-raised);
      display:flex; align-items:center; justify-content:center;
    }
    .set-img-thumb .material-symbols-outlined { font-size:32px; color:var(--ps-text-faint); }
    .set-img-seq {
      position:absolute; top:4px; right:4px; z-index:2;
      background:var(--ps-blue); color:#fff; border-radius:50%;
      width:22px; height:22px; display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:bold; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .set-img-check-icon {
      position:absolute; top:4px; right:4px; z-index:2;
      background:var(--ps-bg-raised); border-radius:50%; padding:1px;
      display:none; color:var(--ps-blue);
    }
    .set-img-cell.is-selected .set-img-check-icon { display:block; }
    .set-img-name {
      font-size:10px; color:var(--ps-text-muted); padding:3px 5px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .set-img-size { font-size:9px; color:var(--ps-text-faint); padding:0 5px 4px; font-family:var(--font-mono); }

    /* Lightbox */
    .set-lightbox { position:fixed; inset:0; z-index:600; display:flex; align-items:center; justify-content:center; flex-direction:column; }
    .set-lightbox-bg { position:absolute; inset:0; background:rgba(0,0,0,0.88); }
    .set-lb-close { position:absolute; top:16px; right:16px; z-index:2; background:rgba(255,255,255,0.1); border-radius:50%; width:36px; height:36px; }
    .set-lb-close:hover { background:rgba(255,255,255,0.2); }
    .set-lb-label { position:absolute; top:16px; left:50%; transform:translateX(-50%); z-index:2; font-size:13px; color:rgba(255,255,255,0.8); font-family:var(--font-mono); pointer-events:none; white-space:nowrap; max-width:60vw; overflow:hidden; text-overflow:ellipsis; }
    .set-lb-hint { position:absolute; bottom:16px; left:50%; transform:translateX(-50%); z-index:2; font-size:11px; color:rgba(255,255,255,0.35); pointer-events:none; white-space:nowrap; }
    .set-lb-stage { position:relative; z-index:1; width:90vw; height:88vh; display:flex; align-items:center; justify-content:center; cursor:grab; overflow:hidden; }
    .set-lb-stage:active { cursor:grabbing; }
    .set-lb-img { max-width:100%; max-height:100%; object-fit:contain; transform-origin:center center; transition:transform 50ms linear; user-select:none; pointer-events:none; border-radius:4px; }

    /* Phase 6: effect timeline */
    .set-timeline {
      border-top:1px solid var(--ps-border);
      padding:8px 16px 10px;
      background:var(--ps-bg-surface);
      flex-shrink:0;
    }
    .set-timeline-header {
      display:flex; align-items:center; gap:6px;
      font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;
      color:var(--ps-text-faint); margin-bottom:6px;
    }
    .set-tl-track { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
    .set-tl-label { width:140px; flex-shrink:0; font-size:11px; color:var(--ps-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .set-tl-param { color:var(--ps-text-faint); font-style:italic; }
    .set-tl-bar { flex:1; height:20px; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:4px; position:relative; overflow:hidden; }
    .set-tl-range { position:absolute; top:0; bottom:0; border-radius:3px; }
    .set-tl-standard { border:1px solid rgba(59,130,246,0.4); }
    .set-tl-freeze {
      background:repeating-linear-gradient(45deg, rgba(251,146,60,0.3), rgba(251,146,60,0.3) 4px, rgba(251,146,60,0.15) 4px, rgba(251,146,60,0.15) 8px);
      border:1px solid rgba(251,146,60,0.5);
    }
  `;
  document.head.appendChild(s);
}
