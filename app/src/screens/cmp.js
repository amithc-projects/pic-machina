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
      </div>

      <!-- Unified Image Workspace -->
      <div id="cmp-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0"></div>

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

  let afterCanvas = null;

  // ── Back ──────────────────────────────────────────────────
  container.querySelector('#cmp-back')?.addEventListener('click', () => {
    if (recipe) navigate(`#pvw?id=${recipe.id}`);
    else navigate('#lib');
  });

  // ── Unified Image Workspace ───────────────────────────────
  const { ImageWorkspace } = await import('../components/image-workspace.js');
  const wsContainer = container.querySelector('#cmp-workspace-container');
  
  const workspace = new ImageWorkspace(wsContainer, {
    allowUpload: true,
    allowFolder: false, // Explicit compare mode deals with singles
    onFilesChange: (files, activeFile) => {
      window._icCmpFile = activeFile;
    },
    onRender: async (file) => {
      const beforeUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = beforeUrl; });

      const baseExif = await extractExif(file);
      window._icCmpTargetExif = baseExif;
      const context = { filename: file.name, exif: baseExif, meta: {}, variables: new Map() };
      
      let afterUrl = beforeUrl;
      afterCanvas = null;

      if (recipe) {
        const proc = new ImageProcessor();
        await proc.process(img, recipe.nodes, context);
        afterCanvas = proc.canvas;
        afterUrl = proc.canvas.toDataURL('image/jpeg', 0.92);
      }

      window._icCmpAfterUrl = afterUrl;

      // Update footer
      const beforeInfo = container.querySelector('#cmp-before-info');
      const afterInfo = container.querySelector('#cmp-after-info');
      if (beforeInfo) beforeInfo.textContent = `${img.naturalWidth}×${img.naturalHeight}`;
      if (afterCanvas && afterInfo) afterInfo.textContent = `${afterCanvas.width}×${afterCanvas.height}`;
      container.querySelector('#cmp-footer').style.display = 'flex';

      return {
        beforeUrl,
        afterUrl,
        beforeLabel: 'Original',
        afterLabel: recipe ? recipe.name : 'Result',
        context
      };
    }
  });

  // Init if file passed from other views
  if (window._icCmpFile) {
    workspace.setFiles([window._icCmpFile]);
  }

  // ── Save after ────────────────────────────────────────────
  container.querySelector('#cmp-btn-save')?.addEventListener('click', () => {
    if (!afterCanvas) return;
    afterCanvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${recipe?.name?.replace(/\\s+/g, '_') || 'output'}_after.jpg`;
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
