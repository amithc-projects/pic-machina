/**
 * ImageChef — NED: Node Editor
 *
 * Full-screen editor for a single recipe node's parameters.
 * Accessed via #ned?recipe=<recipeId>&node=<nodeId>
 * Saves params back to the recipe on Done.
 */

import { getRecipe, saveRecipe }               from '../data/recipes.js';
import { navigate }                            from '../main.js';
import { uuid, now, deepClone }                 from '../utils/misc.js';
import { showConfirm }                         from '../utils/dialogs.js';
import { registry }                            from '../engine/index.js';
import { ImageProcessor }                      from '../engine/index.js';
import { extractExif }                         from '../engine/exif-reader.js';
import { getImageInfo, renderImageInfoPanel,
         injectImageInfoStyles }               from '../utils/image-info.js';
import { renderParamField, collectParams, bindParamFieldEvents } from '../utils/param-fields.js';
import { isVideoFile, extractVideoFrame } from '../utils/video-frame.js';
import { fileFilterForRecipe } from '../data/folders.js';

// Category accent colours
const CAT_COLORS = {
  geo:     '#38bdf8',
  color:   '#a78bfa',
  overlay: '#fb923c',
  ai:      '#34d399',
  flow:    '#0077ff',
  meta:    '#f472b6',
};

// ── Find node in recipe tree by id ─────────────────────────
function findNode(nodes, nodeId) {
  for (const n of nodes) {
    if (n.id === nodeId) return n;
    if (n.branches) {
      for (const b of n.branches) {
        const found = findNode(b.nodes, nodeId);
        if (found) return found;
      }
    }
    if (n.thenNodes) {
      const f = findNode(n.thenNodes, nodeId);
      if (f) return f;
    }
    if (n.elseNodes) {
      const f = findNode(n.elseNodes, nodeId);
      if (f) return f;
    }
  }
  return null;
}

export async function render(container, hash) {
  const params   = new URLSearchParams((hash.split('?')[1] || ''));
  const recipeId = params.get('recipe');
  const nodeId   = params.get('node');

  const recipe = recipeId ? await getRecipe(recipeId) : null;
  const node   = recipe ? findNode(recipe.nodes, nodeId) : null;

  if (!recipe || !node) {
    container.innerHTML = `<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">Node not found</div>
        <button class="btn-primary" id="ned-back-btn">Back</button>
      </div></div></div>`;
    container.querySelector('#ned-back-btn')?.addEventListener('click', () => window.history.back());
    return;
  }

  const def     = node.type === 'transform' ? registry.get(node.transformId) : null;
  const catKey  = def?.categoryKey || node.transformId?.split('-')[0] || 'other';
  const accent  = CAT_COLORS[catKey] || '#6b7280';

  // ── Condition editor for conditional nodes ─────────────────
  const isConditional = node.type === 'conditional';
  const isBranch      = node.type === 'branch';

  const conditionHtml = isConditional ? buildConditionEditor(node.condition) : '';
  const branchHtml    = isBranch      ? buildBranchEditor(node)              : '';
  const paramsHtml    = def ? (def.params || []).map(p => renderParamField(p, node.params?.[p.name], 'ned')).join('') : '';

  container.innerHTML = `
    <div class="screen ned-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="ned-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="ned-node-icon" style="background:${accent}20;border-color:${accent}40">
            <span class="material-symbols-outlined" style="font-size:16px;color:${accent}">${def?.icon || 'tune'}</span>
          </div>
          <div>
            <div class="screen-title" style="font-size:15px">${def?.name || node.label || node.type}</div>
            ${def?.description ? `<div class="text-sm text-muted" style="margin-top:2px">${def.description}</div>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary" id="ned-btn-reset">
            <span class="material-symbols-outlined">restart_alt</span>
            Reset
          </button>
          <button class="btn-primary" id="ned-done-btn">
            <span class="material-symbols-outlined">check</span>
            Done
          </button>
        </div>
      </div>

      <div class="ned-body">
        <!-- Params panel -->
        <div class="ned-params-panel">
          <div class="ned-section-title">
            <span class="material-symbols-outlined" style="font-size:14px">settings</span>
            Parameters
          </div>

          ${node.type === 'transform' && def ? `
            <div class="ned-fields">
              ${paramsHtml || '<div class="text-sm text-muted" style="padding:12px">No parameters for this step.</div>'}
            </div>` : ''}

          ${conditionHtml}
          <div id="ned-branches-wrapper">
            ${branchHtml}
          </div>

          <!-- Label override -->
          <div class="ned-section-title" style="margin-top:16px">
            <span class="material-symbols-outlined" style="font-size:14px">label</span>
            Display Label
          </div>
          <div class="ned-fields">
            <div class="ned-field">
              <label class="ned-field-label" for="ned-label-input">Step Label</label>
              <input type="text" id="ned-label-input" class="ic-input" value="${escHtml(node.label || '')}" placeholder="Custom label…">
            </div>
          </div>
        </div>

        <!-- Preview panel -->
        <div class="ned-preview-panel" style="position:relative">
          <div id="ned-notice" class="ned-notice" style="display:none;position:absolute;top:0;left:0;right:0;z-index:20;"></div>
          <div id="ned-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0"></div>
        </div>
      </div>
    </div>`;

  injectNedStyles();

  if (def && def.params) {
    // Provide recipe variable names for autocomplete in variable-bind mode
    const getRecipeVars = () => (recipe?.params || []).map(p => p.name);
    bindParamFieldEvents(container, def.params, 'ned', { getRecipeVars });
  }

  let _previewTimer = null;
  function schedulePreview() {
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(() => workspace?.triggerProcess(), 300);
  }

  // ── Unified Image Workspace ───────────────────────────────
  const { ImageWorkspace } = await import('../components/image-workspace.js');
  const wsContainer = container.querySelector('#ned-workspace-container');
  let testFile = null;

  // For video-specific steps show only videos; otherwise follow the recipe's inputType.
  // A step is video-specific if its transform ID starts with 'flow-video-' or it is a
  // video-effect variant (sourceTransformId set).
  const stepIsVideoOnly = node.transformId?.startsWith('flow-video-') || !!def?.sourceTransformId;
  const stepFileFilter  = stepIsVideoOnly
    ? { includeVideo: true, onlyVideo: true }
    : fileFilterForRecipe(recipe);

  const workspace = new ImageWorkspace(wsContainer, {
    allowUpload: true,
    allowFolder: true,
    fileFilter: stepFileFilter,
    onFilesChange: (files, activeFile) => {
      window._icTestFolderFiles = files;
      window._icTestImage = { file: activeFile };
      testFile = activeFile;
    },
    onRender: async (file) => {
      // Non-transform nodes (conditional, branch, block-ref) have no visual output
      if (!def) return { noPreview: true };


      // Transforms that produce no visual output or require full batch context
      const NO_PREVIEW_IDS = new Set([
        'flow-create-gif', 'flow-create-video', 'flow-create-pdf', 'flow-create-pptx',
        'flow-create-zip', 'flow-video-wall', 'flow-video-stitcher', 'flow-geo-timeline',
        'flow-contact-sheet', 'flow-photo-stack', 'flow-animate-stack',
        'flow-template-aggregator', 'flow-face-swap', 'flow-gif-from-states',
        'flow-video-concat',
        // Video-only transforms (no canvas output, file is mutated via mediabunny)
        'flow-video-convert', 'flow-video-trim', 'flow-video-compress',
        'flow-video-change-fps', 'flow-video-strip-audio', 'flow-video-extract-audio',
        'flow-video-remix-audio',
      ]);
      if (NO_PREVIEW_IDS.has(node.transformId)) {
        return { noPreview: true };
      }

      // Video-only canvas transforms can't be applied to image files
      const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);
      const fileIsVideo = VIDEO_EXTS.has(file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase());
      if (!fileIsVideo && def.sourceTransformId) {
        // sourceTransformId marks a video-effect variant — skip on image files
        return { noPreview: true, noPreviewReason: 'This step only applies to video files. Select a video to preview.' };
      }

      const params = collectParams(container, def.params || [], 'ned');
      const exif   = await extractExif(file);

      // Update Notice
      let notice = null;
      if (node.transformId === 'flow-geo-timeline' && (!exif?.gps?.lat)) {
        notice = 'Timeline requires an image with GPS Exif data. This step will skip images lacking location metadata.';
      }
      const noticeEl = container.querySelector('#ned-notice');
      if (noticeEl) {
        noticeEl.textContent = notice || '';
        noticeEl.style.display = notice ? 'block' : 'none';
      }

      const context = {
        filename: file.name, exif, meta: {}, variables: new Map(),
        originalFile: file,
        _previewMode: true,
      };

      // For video files, extract a representative frame as the canvas base.
      // For image files, load normally.
      let imageSource;
      let beforeUrl;
      if (isVideoFile(file)) {
        const frameCanvas = await extractVideoFrame(file);
        imageSource = frameCanvas;
        beforeUrl = await new Promise(r => frameCanvas.toBlob(b => r(URL.createObjectURL(b)), 'image/jpeg', 0.88));
      } else {
        const rawUrl = URL.createObjectURL(file);
        const img    = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = rawUrl; });
        imageSource = img;
        beforeUrl   = rawUrl; // keep alive; workspace will display it
      }

      const proc = new ImageProcessor();
      proc.canvas.width  = imageSource.width  ?? imageSource.naturalWidth;
      proc.canvas.height = imageSource.height ?? imageSource.naturalHeight;
      proc.ctx.drawImage(imageSource, 0, 0);

      // Video effect transforms delegate to their source image transform's apply().
      // Other transforms call their own apply() as usual.
      const applyDef = def.sourceTransformId ? registry.get(def.sourceTransformId) : def;
      if (applyDef?.apply) {
        try { await applyDef.apply(proc.ctx, params, context); } catch (err) { /* ignore */ }
      }

      const afterUrl = await new Promise(res => proc.canvas.toBlob(b => {
        res(b ? URL.createObjectURL(b) : null);
      }, 'image/jpeg', 0.88));

      return {
        beforeUrl,
        afterUrl,
        beforeLabel: 'Original',
        afterLabel: 'Result',
        context
      };
    }
  });

  if (window._icTestFolderFiles && window._icTestFolderFiles.length > 0) {
    const idx = window._icTestFolderFiles.findIndex(f => f.name === window._icTestImage?.file?.name);
    workspace.setFiles(window._icTestFolderFiles, idx >= 0 ? idx : 0);
  } else if (window._icTestImage?.file) {
    workspace.setFiles([window._icTestImage.file]);
  }

  // ── Back ──────────────────────────────────────────────────
  container.querySelector('#ned-back')?.addEventListener('click', () => navigate(`#bld?id=${recipeId}`));

  // ── Done — save params and go back ───────────────────────
  const saveNode = async () => {
    if (def) node.params = collectParams(container, def.params || [], 'ned');
    if (isConditional) node.condition = collectCondition(container);
    const labelInput = container.querySelector('#ned-label-input');
    if (labelInput) node.label = labelInput.value.trim();
    await saveRecipe(recipe);
  };

  container.querySelector('#ned-done-btn')?.addEventListener('click', async () => {
    await saveNode();
    navigate(`#bld?id=${recipeId}`);
  });

  // ── Reset ─────────────────────────────────────────────────
  container.querySelector('#ned-btn-reset')?.addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: 'Reset Parameters?',
      body: 'This will restore all settings in this step to their factory defaults. This action cannot be undone.',
      confirmText: 'Reset',
      variant: 'warning',
      icon: 'restart_alt'
    });
    if (!confirmed) return;
    const defaults = {};
    (def?.params || []).forEach(p => { defaults[p.name] = p.defaultValue ?? ''; });
    node.params = defaults;
    navigate(`#ned?recipe=${recipeId}&node=${nodeId}`); // re-render
  });

  // ── Wire range inputs ─────────────────────────────────────
  container.querySelectorAll('input[type=range]').forEach(input => {
    const valEl = container.querySelector(`#${input.id}-val`);
    if (valEl) {
      input.addEventListener('input', () => { valEl.textContent = input.value; schedulePreview(); });
    }
  });

  // ── Wire color inputs ─────────────────────────────────────
  container.querySelectorAll('input[type=color]').forEach(input => {
    const hexInput = container.querySelector(`#${input.id}-hex`);
    input.addEventListener('input', () => { if (hexInput) hexInput.value = input.value; schedulePreview(); });
    hexInput?.addEventListener('input', e => {
      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) { input.value = e.target.value; schedulePreview(); }
    });
  });

  // ── Wire all other inputs ─────────────────────────────────
  container.querySelectorAll('.ic-input:not(.ned-branch-label), input[type=checkbox]').forEach(input => {
    if (input.type !== 'color') input.addEventListener('change', schedulePreview);
  });

  // ── Wire file-browse buttons ──────────────────────────────
  container.querySelectorAll('.ned-file-browse-btn').forEach(btn => {
    const targetId  = btn.dataset.target;
    const picker    = container.querySelector(`#${targetId}-picker`);
    const pathInput = container.querySelector(`#${targetId}`);
    btn.addEventListener('click', () => picker?.click());
    picker?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file || !pathInput) return;
      if (pathInput._objectUrl) URL.revokeObjectURL(pathInput._objectUrl);
      const url = URL.createObjectURL(file);
      pathInput._objectUrl = url;
      pathInput.value = url;
      schedulePreview();
    });
  });

  // ── Branch actions ────────────────────────────────────────
  if (isBranch) {
    const bindBranchActions = () => {
      container.querySelector('#ned-btn-add-branch')?.addEventListener('click', () => {
        const nextLetter = String.fromCharCode(65 + (node.branches || []).length);
        node.branches.push({ id: uuid(), label: `Variant ${nextLetter}`, nodes: [] });
        refreshBranchEditor();
      });

      container.querySelectorAll('.ned-btn-del-branch').forEach(btn => {
        btn.addEventListener('click', async e => {
          const idx = parseInt(btn.dataset.idx);
          if (node.branches.length <= 1) return;
          const confirmed = await showConfirm({
            title: 'Remove Variant?',
            body: 'This will delete the selected branch and every transformation step within it.',
            confirmText: 'Remove Variant',
            variant: 'danger',
            icon: 'delete_sweep'
          });
          if (!confirmed) return;
          node.branches.splice(idx, 1);
          refreshBranchEditor();
        });
      });

      container.querySelectorAll('.ned-branch-label').forEach(input => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.dataset.branchIdx);
          node.branches[idx].label = input.value;
        });
      });
    };

    const refreshBranchEditor = () => {
      const containerEl = container.querySelector('#ned-branches-wrapper');
      if (containerEl) {
        containerEl.innerHTML = buildBranchEditor(node);
        bindBranchActions();
        schedulePreview();
      }
    };

    bindBranchActions();
  }


}

// ── Condition editor builder ───────────────────────────────
function buildConditionEditor(cond = {}) {
  const fields = ['width','height','aspectRatio','IsPortrait','HasGPS','MetaExists','exif.date','exif.author','meta.custom'];
  const ops    = ['exists','eq','neq','gt','lt','gte','lte','contains'];
  return `
    <div class="ned-section-title" style="margin-top:16px">
      <span class="material-symbols-outlined" style="font-size:14px">alt_route</span>
      Condition
    </div>
    <div class="ned-fields">
      <div class="ned-field">
        <label class="ned-field-label">Field</label>
        <select id="ned-cond-field" class="ic-input">
          ${fields.map(f => `<option value="${f}" ${f === cond.field ? 'selected' : ''}>${f}</option>`).join('')}
          <option value="${cond.field || ''}" ${!fields.includes(cond.field) ? 'selected' : ''}>${cond.field || '(custom)'}</option>
        </select>
      </div>
      <div class="ned-field">
        <label class="ned-field-label">Operator</label>
        <select id="ned-cond-op" class="ic-input">
          ${ops.map(o => `<option value="${o}" ${o === cond.operator ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="ned-field">
        <label class="ned-field-label">Value</label>
        <input type="text" id="ned-cond-value" class="ic-input" value="${escHtml(String(cond.value ?? ''))}">
      </div>
    </div>`;
}

function collectCondition(container) {
  return {
    field:    container.querySelector('#ned-cond-field')?.value  || 'width',
    operator: container.querySelector('#ned-cond-op')?.value     || 'gt',
    value:    container.querySelector('#ned-cond-value')?.value  || '',
  };
}

// ── Branch editor builder ──────────────────────────────────
function buildBranchEditor(node) {
  return `
    <div class="ned-section-title" style="margin-top:16px">
      <span class="material-symbols-outlined" style="font-size:14px">device_hub</span>
      Branch Variants
    </div>
    <div class="ned-fields">
      ${(node.branches || []).map((b, i) => `
        <div class="ned-field">
          <div class="flex items-center gap-2">
            <div style="flex:1">
              <label class="ned-field-label">Variant ${i + 1} Label</label>
              <input type="text" class="ic-input ned-branch-label" data-branch-idx="${i}" value="${escHtml(b.label || '')}" placeholder="Variant label…">
            </div>
            ${node.branches.length > 1 ? `
              <button class="btn-icon ned-btn-del-branch" data-idx="${i}" title="Remove variant" style="margin-top:18px">
                <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-red)">delete</span>
              </button>` : ''}
          </div>
        </div>`).join('')}
      <button class="btn-secondary" id="ned-btn-add-branch" style="margin-top:4px">
        <span class="material-symbols-outlined" style="font-size:14px">add</span>
        Add Variant
      </button>
    </div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _nedStyles = false;
function injectNedStyles() {
  if (_nedStyles) return;
  _nedStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .ned-screen { display:flex; flex-direction:column; height:100%; }
    .ned-body { display:flex; flex:1; overflow:hidden; }
    .ned-node-icon { width:32px; height:32px; border-radius:8px; border:1px solid; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

    .ned-params-panel { width:320px; flex-shrink:0; border-right:1px solid var(--ps-border); overflow-y:auto; }
    .ned-section-title {
      display:flex; align-items:center; gap:6px;
      font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;
      color:var(--ps-text-faint); padding:12px 16px 6px;
    }
    .ned-fields { padding:4px 16px 12px; display:flex; flex-direction:column; gap:10px; }
    .ned-field { display:flex; flex-direction:column; gap:4px; }
    .ned-field-label { display:flex; align-items:center; font-size:12px; color:var(--ps-text-muted); font-weight:500; }

    .ned-toggle { display:flex; align-items:center; cursor:pointer; width:fit-content; }
    .ned-toggle input { display:none; }
    .ned-toggle-track {
      width:36px; height:20px; border-radius:10px; background:var(--ps-bg-app);
      border:1px solid var(--ps-border); position:relative; transition:background 150ms, border-color 150ms;
    }
    .ned-toggle-track::after {
      content:''; position:absolute; top:2px; left:2px; width:14px; height:14px;
      border-radius:50%; background:#fff; transition:transform 150ms;
    }
    .ned-toggle input:checked + .ned-toggle-track { background:var(--ps-blue); border-color:var(--ps-blue); }
    .ned-toggle input:checked + .ned-toggle-track::after { transform:translateX(16px); }

    .ned-color-row { display:flex; align-items:center; gap:6px; }
    .ned-color-input { width:36px; height:32px; padding:2px; border:1px solid var(--ps-border); border-radius:6px; background:var(--ps-bg-app); cursor:pointer; }
    .ned-file-row { display:flex; align-items:center; gap:6px; }
    .ned-file-path { flex:1; min-width:0; color:var(--ps-text-muted); font-size:11px; font-family:var(--font-mono); cursor:default; }

    .ned-preview-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .ned-preview-header { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; flex-wrap:wrap; }
    .ned-notice { padding:8px 14px; font-size:12px; color:#f59e0b; background:rgba(245,158,11,0.08); border-bottom:1px solid rgba(245,158,11,0.2); flex-shrink:0; line-height:1.5; }
    .ned-preview-area {
      flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/32px 32px;
    }


  `;
  document.head.appendChild(s);
}
