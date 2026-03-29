/**
 * ImageChef — CMP: Comparison View
 *
 * Side-by-side or slider before/after comparison for recipe preview.
 * Accessed via #cmp?recipe=<id>  or standalone with uploaded images.
 */

import { getRecipe }        from '../data/recipes.js';
import { navigate }         from '../main.js';
import { ImageProcessor } from '../engine/index.js';
import { extractExif }      from '../engine/exif-reader.js';

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export async function render(container, hash) {
  const params   = new URLSearchParams((hash.split('?')[1] || ''));
  const recipeId = params.get('recipe');

  const recipe = recipeId ? await getRecipe(recipeId) : null;

  container.innerHTML = `
    <div class="screen cmp-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="cmp-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">compare</span>
            ${recipe ? escHtml(recipe.name) : 'Comparison'}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- Mode toggle -->
          <div class="cmp-mode-toggle" role="group" aria-label="Comparison mode">
            <button class="cmp-mode-btn is-active" data-mode="slider" title="Slider">
              <span class="material-symbols-outlined" style="font-size:16px">swap_horiz</span>
              Slider
            </button>
            <button class="cmp-mode-btn" data-mode="side" title="Side by side">
              <span class="material-symbols-outlined" style="font-size:16px">view_column</span>
              Side by Side
            </button>
          </div>
          <label class="btn-secondary" style="cursor:pointer">
            <span class="material-symbols-outlined">upload</span>
            Load Image
            <input type="file" id="cmp-file-input" accept="image/*" style="display:none">
          </label>
        </div>
      </div>

      <!-- Comparison workspace -->
      <div id="cmp-workspace" class="cmp-workspace">
        <div class="empty-state" style="padding-top:80px">
          <span class="material-symbols-outlined" style="font-size:52px">compare</span>
          <div class="empty-state-title">Upload an image to compare</div>
          <div class="empty-state-desc">
            ${recipe ? `See before/after for <strong>${escHtml(recipe.name)}</strong>.` : 'Load an image to see the before/after comparison.'}
          </div>
          <label class="btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            <span class="material-symbols-outlined">upload</span>
            Upload Image
            <input type="file" id="cmp-file-input-2" accept="image/*" style="display:none">
          </label>
        </div>
      </div>

      <div id="cmp-footer" class="cmp-footer" style="display:none">
        <div class="cmp-footer-left">
          <span class="ic-badge">Before</span>
          <span id="cmp-before-info" class="mono text-sm text-muted"></span>
        </div>
        <div class="cmp-footer-right">
          <span class="ic-badge ic-badge--blue">After</span>
          <span id="cmp-after-info" class="mono text-sm text-muted"></span>
          <button class="btn-secondary" id="cmp-btn-save" style="margin-left:8px">
            <span class="material-symbols-outlined">download</span>
            Save After
          </button>
        </div>
      </div>
    </div>`;

  injectCmpStyles();

  let mode         = localStorage.getItem('ic-cmp-mode') || 'slider';
  let beforeUrl    = null;
  let afterUrl     = null;
  let afterCanvas  = null;
  let isDragging   = false;
  let sliderPct    = 50;

  // ── Back ──────────────────────────────────────────────────
  container.querySelector('#cmp-back')?.addEventListener('click', () => {
    if (recipe) navigate(`#pvw?id=${recipe.id}`);
    else navigate('#lib');
  });

  // ── Mode toggle ───────────────────────────────────────────
  container.querySelectorAll('.cmp-mode-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.mode === mode);
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      localStorage.setItem('ic-cmp-mode', mode);
      container.querySelectorAll('.cmp-mode-btn').forEach(b => b.classList.toggle('is-active', b === btn));
      if (beforeUrl && afterUrl) renderComparison();
    });
  });

  // ── File input ─────────────────────────────────────────────
  function setupFileInput(inputId) {
    container.querySelector(`#${inputId}`)?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      await processFile(file);
    });
  }
  setupFileInput('cmp-file-input');
  setupFileInput('cmp-file-input-2');

  // Drag & drop on workspace
  const workspace = container.querySelector('#cmp-workspace');
  workspace?.addEventListener('dragover', e => { e.preventDefault(); workspace.classList.add('cmp-dragover'); });
  workspace?.addEventListener('dragleave', () => workspace.classList.remove('cmp-dragover'));
  workspace?.addEventListener('drop', async e => {
    e.preventDefault();
    workspace.classList.remove('cmp-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) await processFile(file);
  });

  async function processFile(file) {
    workspace.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px">
      <div class="spinner spinner--lg"></div>
      <div class="text-sm text-muted">Processing with recipe…</div>
    </div>`;

    try {
      beforeUrl = URL.createObjectURL(file);
      const img  = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = beforeUrl; });

      if (recipe) {
        const exif    = await extractExif(file);
        const ctx     = { filename: file.name, exif, meta: {}, variables: new Map() };
        const proc    = new ImageProcessor();
        await proc.process(img, recipe.nodes, ctx);
        afterCanvas = proc.canvas;
        afterUrl    = proc.canvas.toDataURL('image/jpeg', 0.92);
      } else {
        // No recipe — just show same image both sides
        afterUrl = beforeUrl;
      }

      // Footer info
      const beforeInfo = container.querySelector('#cmp-before-info');
      const afterInfo  = container.querySelector('#cmp-after-info');
      if (beforeInfo) beforeInfo.textContent = `${img.naturalWidth}×${img.naturalHeight}`;
      if (afterCanvas && afterInfo) afterInfo.textContent = `${afterCanvas.width}×${afterCanvas.height}`;

      container.querySelector('#cmp-footer').style.display = 'flex';
      renderComparison();
    } catch (err) {
      workspace.innerHTML = `<div class="empty-state">
        <span class="material-symbols-outlined">error</span>
        <div class="empty-state-title">Processing failed</div>
        <div class="empty-state-desc">${escHtml(err.message)}</div>
      </div>`;
    }
  }

  function renderComparison() {
    if (mode === 'side') {
      renderSideBySide();
    } else {
      renderSlider();
    }
  }

  function renderSideBySide() {
    workspace.innerHTML = `
      <div class="cmp-side-view">
        <div class="cmp-side">
          <div class="cmp-side-label">Before</div>
          <img src="${beforeUrl}" class="cmp-side-img" draggable="false">
        </div>
        <div class="cmp-divider-vertical"></div>
        <div class="cmp-side">
          <div class="cmp-side-label cmp-side-label--blue">After</div>
          <img src="${afterUrl}" class="cmp-side-img" draggable="false">
        </div>
      </div>`;
  }

  function renderSlider() {
    workspace.innerHTML = `
      <div class="cmp-slider-view" id="cmp-slider-view">
        <img src="${beforeUrl}" class="cmp-slider-base" draggable="false">
        <div class="cmp-slider-clip" id="cmp-slider-clip" style="width:${sliderPct}%">
          <img src="${afterUrl}" class="cmp-slider-after" draggable="false">
        </div>
        <div class="cmp-slider-handle" id="cmp-slider-handle" style="left:${sliderPct}%">
          <div class="cmp-handle-line"></div>
          <div class="cmp-handle-grip">
            <span class="material-symbols-outlined" style="font-size:16px">swap_horiz</span>
          </div>
        </div>
        <div class="cmp-slider-badge cmp-slider-badge--left">Before</div>
        <div class="cmp-slider-badge cmp-slider-badge--right cmp-slider-badge--blue">After</div>
      </div>`;

    const sliderView = container.querySelector('#cmp-slider-view');
    const sliderClip = container.querySelector('#cmp-slider-clip');
    const handle     = container.querySelector('#cmp-slider-handle');
    if (!sliderView) return;

    function setSlider(x) {
      const rect = sliderView.getBoundingClientRect();
      sliderPct  = Math.max(2, Math.min(98, ((x - rect.left) / rect.width) * 100));
      if (sliderClip) sliderClip.style.width = `${sliderPct}%`;
      if (handle)     handle.style.left       = `${sliderPct}%`;
    }

    handle?.addEventListener('mousedown', e => { isDragging = true; e.preventDefault(); });
    document.addEventListener('mousemove', e => { if (isDragging) setSlider(e.clientX); });
    document.addEventListener('mouseup',   () => { isDragging = false; });
    handle?.addEventListener('touchstart', e => { isDragging = true; e.preventDefault(); }, { passive: false });
    document.addEventListener('touchmove', e => { if (isDragging) setSlider(e.touches[0].clientX); }, { passive: true });
    document.addEventListener('touchend',  () => { isDragging = false; });

    // Click anywhere on view to jump
    sliderView.addEventListener('click', e => {
      if (!isDragging) setSlider(e.clientX);
    });
  }

  // ── Save after ────────────────────────────────────────────
  container.querySelector('#cmp-btn-save')?.addEventListener('click', () => {
    if (!afterCanvas) return;
    afterCanvas.toBlob(blob => {
      const a  = document.createElement('a');
      a.href   = URL.createObjectURL(blob);
      a.download = `${recipe?.name?.replace(/\s+/g, '_') || 'output'}_after.jpg`;
      a.click();
    }, 'image/jpeg', 0.92);
  });
}

let _cmpStyles = false;
function injectCmpStyles() {
  if (_cmpStyles) return;
  _cmpStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .cmp-screen { display:flex; flex-direction:column; height:100%; }
    .cmp-workspace {
      flex:1; overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/24px 24px;
      transition:outline 150ms;
    }
    .cmp-workspace.cmp-dragover { outline:2px dashed var(--ps-blue); outline-offset:-4px; }

    /* Side by side */
    .cmp-side-view { display:flex; width:100%; height:100%; }
    .cmp-side { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
    .cmp-side-img { width:100%; height:100%; object-fit:contain; display:block; }
    .cmp-side-label {
      position:absolute; top:12px; left:12px; z-index:2;
      background:rgba(0,0,0,0.7); color:#fff; font-size:11px; font-weight:600;
      padding:3px 9px; border-radius:20px; font-family:var(--font-mono);
    }
    .cmp-side-label--blue { background:rgba(0,119,255,0.85); }
    .cmp-divider-vertical { width:2px; background:var(--ps-border); flex-shrink:0; }

    /* Slider */
    .cmp-slider-view { position:relative; width:100%; height:100%; overflow:hidden; user-select:none; cursor:col-resize; }
    .cmp-slider-base { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; }
    .cmp-slider-clip { position:absolute; top:0; left:0; height:100%; overflow:hidden; }
    .cmp-slider-after { position:absolute; top:0; left:0; width:100vw; max-width:none; height:100%; object-fit:contain; display:block; }
    .cmp-slider-handle { position:absolute; top:0; height:100%; transform:translateX(-50%); display:flex; align-items:center; pointer-events:none; z-index:10; }
    .cmp-handle-line { position:absolute; top:0; left:50%; width:2px; height:100%; background:rgba(255,255,255,0.9); transform:translateX(-50%); box-shadow:0 0 8px rgba(0,0,0,0.4); }
    .cmp-handle-grip {
      position:relative; z-index:1; width:36px; height:36px; border-radius:50%;
      background:rgba(255,255,255,0.95); box-shadow:0 2px 10px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center; cursor:col-resize; pointer-events:all;
      color:#111;
    }
    .cmp-slider-badge {
      position:absolute; top:12px; z-index:5;
      background:rgba(0,0,0,0.7); color:#fff; font-size:11px; font-weight:600;
      padding:3px 9px; border-radius:20px; font-family:var(--font-mono);
    }
    .cmp-slider-badge--left  { left:12px; }
    .cmp-slider-badge--right { right:12px; }
    .cmp-slider-badge--blue  { background:rgba(0,119,255,0.85); }

    /* Mode toggle */
    .cmp-mode-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden; }
    .cmp-mode-btn {
      display:flex; align-items:center; gap:5px; padding:6px 12px; font-size:12px; font-weight:500;
      background:transparent; border:none; color:var(--ps-text-muted); cursor:pointer; font-family:var(--font-primary);
      transition:background 150ms, color 150ms;
    }
    .cmp-mode-btn.is-active { background:var(--ps-blue); color:#fff; }
    .cmp-mode-btn:hover:not(.is-active) { background:var(--ps-bg-hover); color:var(--ps-text); }

    /* Footer */
    .cmp-footer { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-top:1px solid var(--ps-border); background:var(--ps-bg-surface); flex-shrink:0; }
    .cmp-footer-left, .cmp-footer-right { display:flex; align-items:center; gap:8px; }
  `;
  document.head.appendChild(s);
}
