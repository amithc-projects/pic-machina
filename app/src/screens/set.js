/**
 * ImageChef — SET: Batch Setup
 *
 * Users select: input folder, output folder, recipe to apply, then start the batch.
 * Uses File System Access API for persistent folder handles.
 */

import { pickFolder, getFolder, listImages }        from '../data/folders.js';
import { getAllRecipes, getRecipe }                  from '../data/recipes.js';
import { startBatch }                               from '../engine/batch.js';
import { navigate }                                 from '../main.js';
import { formatBytes }                              from '../utils/misc.js';
import { renderParamField, collectParams,
         bindParamFieldEvents,
         injectParamFieldStyles }                   from '../utils/param-fields.js';

export async function render(container, hash) {
  // Parse recipe id from hash e.g. #set?recipe=sys-web-optimise
  const recipeId = new URLSearchParams(hash.split('?')[1] || '').get('recipe');

  // ── State ──────────────────────────────────────────────
  let inputHandle    = null;
  let outputHandle   = null;
  let selectedFiles  = [];       // File[] from input folder
  let selectedIds    = new Set();// filenames of checked items
  let currentRecipe  = null;
  let allRecipes     = [];
  let batchControl   = null;     // { cancel, runId }
  let lastClickedIdx = -1;       // for shift+click range

  container.innerHTML = `
    <div class="screen set-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">folder_open</span>
          Batch Setup
        </div>
        <div class="flex items-center gap-2">
          <span id="set-sel-count" class="ic-badge"></span>
          <button class="btn-secondary" id="btn-select-all">Select All</button>
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
          </section>

          <!-- Input folder -->
          <section class="set-section">
            <div class="set-section-title">Input Folder</div>
            <div class="set-folder-row" id="set-input-row">
              <span class="material-symbols-outlined" style="color:var(--ps-text-faint)">folder</span>
              <span id="set-input-path" class="set-folder-path text-muted">Not selected</span>
              <button class="btn-secondary" id="btn-pick-input">
                <span class="material-symbols-outlined">folder_open</span>Browse
              </button>
            </div>
            <div id="set-input-stats" class="text-sm text-muted" style="margin-top:4px;"></div>
          </section>

          <!-- Output folder -->
          <section class="set-section">
            <div class="set-section-title">Output Folder</div>
            <div class="set-folder-row" id="set-output-row">
              <span class="material-symbols-outlined" style="color:var(--ps-text-faint)">drive_folder_upload</span>
              <span id="set-output-path" class="set-folder-path text-muted">Not selected</span>
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
        <div class="set-grid-area">
          <div id="set-image-grid" class="set-image-grid">
            <div class="empty-state" style="grid-column:1/-1">
              <span class="material-symbols-outlined">photo_library</span>
              <div class="empty-state-title">No input folder selected</div>
              <div class="empty-state-desc">Pick an input folder to see images here.</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  injectStyles();

  // ── Load recipes ──────────────────────────────────────
  allRecipes = await getAllRecipes();

  // Restore persisted folder handles
  inputHandle  = await getFolder('input').catch(() => null);
  outputHandle = await getFolder('output').catch(() => null);
  if (inputHandle)  { container.querySelector('#set-input-path').textContent  = inputHandle.name; await refreshImageGrid(); }
  if (outputHandle) { container.querySelector('#set-output-path').textContent = outputHandle.name; }

  // Pre-select recipe if passed in hash
  if (recipeId) {
    currentRecipe = await getRecipe(recipeId);
    if (currentRecipe) updateRecipeDisplay();
  }

  updateRunButton();

  // ── Pick recipe button ────────────────────────────────
  container.querySelector('#btn-pick-recipe').addEventListener('click', () => showRecipePicker());

  // ── Input folder ─────────────────────────────────────
  container.querySelector('#btn-pick-input').addEventListener('click', async () => {
    try {
      inputHandle = await pickFolder('input');
      container.querySelector('#set-input-path').textContent = inputHandle.name;
      await refreshImageGrid();
      updateRunButton();
    } catch (e) { if (e.name !== 'AbortError') console.error(e); }
  });

  // ── Output folder ─────────────────────────────────────
  container.querySelector('#btn-pick-output').addEventListener('click', async () => {
    try {
      outputHandle = await pickFolder('output');
      container.querySelector('#set-output-path').textContent = outputHandle.name;
      updateRunButton();
    } catch (e) { if (e.name !== 'AbortError') console.error(e); }
  });

  // ── Select all / none ────────────────────────────────
  container.querySelector('#btn-select-all').addEventListener('click', () => {
    const allSelected = selectedIds.size === selectedFiles.length && selectedFiles.length > 0;
    selectedIds = allSelected ? new Set() : new Set(selectedFiles.map(f => f.name));
    lastClickedIdx = -1;
    renderSelectionState();
  });

  // ── Run batch ─────────────────────────────────────────
  container.querySelector('#btn-run').addEventListener('click', async () => {
    if (!currentRecipe || !inputHandle || !outputHandle) return;
    const files = selectedFiles.filter(f => selectedIds.has(f.name));
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

    // Navigate to QUE with run control
    navigate('#que');
    // Small delay to let QUE render, then start
    setTimeout(async () => {
      try {
        batchControl = await startBatch({
          recipe: currentRecipe,
          files,
          outputHandle,
          subfolder,
          runParams,
          onProgress: (p, t, fn) => window._queProgress?.(p, t, fn),
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
    }, 50);
  });

  // ── Helpers ───────────────────────────────────────────
  async function refreshImageGrid() {
    if (!inputHandle) return;
    try {
      const VIDEO_TRANSFORMS = new Set(['flow-video-wall', 'video-extract-frame']);
      const hasVideoRecipe = (currentRecipe?.nodes || []).some(n => VIDEO_TRANSFORMS.has(n.transformId));
      selectedFiles = await listImages(inputHandle, { includeVideo: hasVideoRecipe });
      selectedIds   = new Set(selectedFiles.map(f => f.name));
      renderImageGrid();
      const stats = container.querySelector('#set-input-stats');
      if (stats) stats.textContent = `${selectedFiles.length} ${hasVideoRecipe ? 'file' : 'image'}${selectedFiles.length !== 1 ? 's' : ''} found`;
      updateRunButton();
    } catch (err) {
      console.error('[SET] listImages failed:', err);
    }
  }

  function renderImageGrid() {
    const grid = container.querySelector('#set-image-grid');
    if (!selectedFiles.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <span class="material-symbols-outlined">image_not_supported</span>
        <div class="empty-state-title">No images found</div>
        <div class="empty-state-desc">This folder contains no supported image files.</div>
      </div>`;
      return;
    }
    grid.innerHTML = selectedFiles.map(f => `
      <label class="set-img-cell ${selectedIds.has(f.name) ? 'is-selected' : ''}" data-name="${f.name}">
        <input type="checkbox" class="set-img-check" data-name="${f.name}" ${selectedIds.has(f.name) ? 'checked' : ''} style="display:none">
        <div class="set-img-thumb" data-file-name="${f.name}">
          <span class="material-symbols-outlined set-img-placeholder">image</span>
        </div>
        <div class="set-img-check-icon">
          <span class="material-symbols-outlined">check_circle</span>
        </div>
        <div class="set-img-name">${f.name}</div>
        <div class="set-img-size">${formatBytes(f.size)}</div>
      </label>`).join('');

    // Lazy-load thumbnails
    grid.querySelectorAll('[data-file-name]').forEach(thumb => {
      const file = selectedFiles.find(f => f.name === thumb.dataset.fileName);
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        thumb.style.backgroundImage = `url(${url})`;
        thumb.style.backgroundSize  = 'cover';
        thumb.style.backgroundPosition = 'center';
        thumb.querySelector('.set-img-placeholder')?.remove();
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
      // Clean up URL after 60s
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });

    // Selection — click, ctrl+click, shift+click
    grid.querySelectorAll('.set-img-cell').forEach((cell, idx) => {
      cell.addEventListener('click', e => {
        // Prevent the label from triggering a synthetic checkbox click,
        // which would bubble back here and double-fire the handler.
        e.preventDefault();

        const name = cell.dataset.name;

        if (e.shiftKey && lastClickedIdx !== -1) {
          // Extend range from last click to here
          const from = Math.min(lastClickedIdx, idx);
          const to   = Math.max(lastClickedIdx, idx);
          for (let i = from; i <= to; i++) selectedIds.add(selectedFiles[i].name);
        } else {
          // Plain click or ctrl+click: toggle this item
          if (selectedIds.has(name)) selectedIds.delete(name); else selectedIds.add(name);
          lastClickedIdx = idx;
        }

        renderSelectionState();
      });
    });
  }

  function renderSelectionState() {
    container.querySelectorAll('.set-img-cell').forEach(cell => {
      const sel = selectedIds.has(cell.dataset.name);
      cell.classList.toggle('is-selected', sel);
      const cb = cell.querySelector('.set-img-check');
      if (cb) cb.checked = sel;
    });
    updateSelCount();
  }

  function updateSelCount() {
    const c = container.querySelector('#set-sel-count');
    if (!c) return;
    const n = selectedIds.size;
    const total = selectedFiles.length;
    c.textContent = n ? `${n} / ${total} selected` : 'None selected';
    c.className = `ic-badge ${n ? 'ic-badge--blue' : ''}`;

    // Update Select All button label
    const selAllBtn = container.querySelector('#btn-select-all');
    if (selAllBtn) selAllBtn.textContent = (n === total && total > 0) ? 'Select None' : 'Select All';
  }

  function updateRunButton() {
    const btn = container.querySelector('#btn-run');
    if (!btn) return;
    const ready = currentRecipe && inputHandle && outputHandle && selectedIds.size > 0;
    btn.disabled = !ready;
  }

  function recipeSlug(name) {
    return (name || 'output').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'output';
  }

  function updateRecipeDisplay() {
    const name = container.querySelector('#set-recipe-name');
    if (name) name.textContent = currentRecipe?.name || 'No recipe selected';
    const editBtn = container.querySelector('#btn-edit-recipe');
    if (editBtn) editBtn.style.display = currentRecipe ? '' : 'none';

    // Default subfolder to sanitized recipe name
    const subfolderEl = container.querySelector('#set-subfolder');
    if (subfolderEl && currentRecipe) subfolderEl.value = recipeSlug(currentRecipe.name);

    // Render inline recipe params
    renderInlineParams();
    updateRunButton();
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
    fields.innerHTML = paramDefs.map(p => renderParamField(p, lastUsed[p.name] ?? p.defaultValue, 'rp')).join('');
    bindParamFieldEvents(container, paramDefs, 'rp');

    container.querySelector('#set-params-reset')?.addEventListener('click', () => {
      localStorage.removeItem(storageKey);
      fields.innerHTML = paramDefs.map(p => renderParamField(p, p.defaultValue, 'rp')).join('');
      bindParamFieldEvents(container, paramDefs, 'rp');
    }, { once: true });
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

    .set-grid-area { flex:1; overflow-y:auto; padding:16px; }
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
    .set-img-check-icon {
      position:absolute; top:4px; right:4px;
      background:var(--ps-bg-raised); border-radius:50%; padding:1px;
      display:none; color:var(--ps-blue);
    }
    .set-img-cell.is-selected .set-img-check-icon { display:block; }
    .set-img-name {
      font-size:10px; color:var(--ps-text-muted); padding:3px 5px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .set-img-size { font-size:9px; color:var(--ps-text-faint); padding:0 5px 4px; font-family:var(--font-mono); }
  `;
  document.head.appendChild(s);
}
