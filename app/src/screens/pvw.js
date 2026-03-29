/**
 * ImageChef — PVW: Recipe Preview
 *
 * Shows recipe metadata, node tree, and a live before/after preview.
 * Accessed via #pvw?id=<recipeId>
 */

import { getRecipe, cloneRecipe }                  from '../data/recipes.js';
import { navigate }                                from '../main.js';
import { ImageProcessor }                          from '../engine/index.js';
import { extractExif }                             from '../engine/exif-reader.js';
import { getImageInfo, renderImageInfoPanel,
         injectImageInfoStyles }                   from '../utils/image-info.js';

// Node category accent colours (match app.css node-category-tag vars)
const CAT_COLORS = {
  geo:     '#38bdf8',
  color:   '#a78bfa',
  overlay: '#fb923c',
  ai:      '#34d399',
  flow:    '#0077ff',
  meta:    '#f472b6',
};

function nodeTypeLabel(node) {
  if (node.type === 'branch')      return { icon: 'device_hub',       label: node.label || 'Branch',       cat: 'flow' };
  if (node.type === 'conditional') return { icon: 'alt_route',        label: node.label || 'Conditional',  cat: 'flow' };
  if (node.type === 'block-ref')   return { icon: 'widgets',          label: node.label || 'Block Ref',    cat: 'flow' };
  if (node.type === 'transform')   return { icon: 'tune',             label: node.label || node.transformId, cat: node.categoryKey || node.transformId?.split('-')[0] };
  return { icon: 'help_outline', label: node.label || node.type, cat: 'other' };
}

function flattenNodes(nodes = [], depth = 0) {
  const items = [];
  for (const n of nodes) {
    items.push({ node: n, depth });
    if (n.branches) {
      for (const b of n.branches) {
        items.push({ node: { type: '_branch_header', label: b.label || 'Variant' }, depth: depth + 1, isBranchHeader: true });
        items.push(...flattenNodes(b.nodes, depth + 2));
      }
    }
    if (n.thenNodes?.length) {
      items.push({ node: { type: '_branch_header', label: 'Then' }, depth: depth + 1, isBranchHeader: true });
      items.push(...flattenNodes(n.thenNodes, depth + 2));
    }
    if (n.elseNodes?.length) {
      items.push({ node: { type: '_branch_header', label: 'Else' }, depth: depth + 1, isBranchHeader: true });
      items.push(...flattenNodes(n.elseNodes, depth + 2));
    }
  }
  return items;
}

function renderNodeList(nodes) {
  const items = flattenNodes(nodes);
  if (!items.length) return '<div class="empty-state" style="padding:24px"><div class="empty-state-title">No nodes</div></div>';
  return items.map(({ node, depth, isBranchHeader }) => {
    if (isBranchHeader) {
      return `<div class="pvw-node-row pvw-node-row--header" style="padding-left:${16 + depth * 16}px">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-text-faint)">subdirectory_arrow_right</span>
        <span class="pvw-node-variant-label">${node.label}</span>
      </div>`;
    }
    const { icon, label, cat } = nodeTypeLabel(node);
    const accent = CAT_COLORS[cat] || '#6b7280';
    return `<div class="pvw-node-row" style="padding-left:${16 + depth * 16}px">
      <span class="pvw-node-dot" style="background:${accent}"></span>
      <span class="material-symbols-outlined" style="font-size:14px;color:${accent};flex-shrink:0">${icon}</span>
      <span class="pvw-node-label">${label}</span>
      ${node.disabled ? '<span class="ic-badge" style="margin-left:auto;font-size:10px">disabled</span>' : ''}
    </div>`;
  }).join('');
}

export async function render(container, hash) {
  const params   = new URLSearchParams((hash.split('?')[1] || ''));
  const recipeId = params.get('id');

  // Minimal loading state
  container.innerHTML = `<div class="screen" style="align-items:center;justify-content:center">
    <div class="spinner spinner--lg"></div>
  </div>`;

  const recipe = recipeId ? await getRecipe(recipeId) : null;
  if (!recipe) {
    container.innerHTML = `<div class="screen">
      <div class="screen-body" style="align-items:center;justify-content:center">
        <div class="empty-state">
          <span class="material-symbols-outlined">error_outline</span>
          <div class="empty-state-title">Recipe not found</div>
          <div class="empty-state-desc">The requested recipe does not exist.</div>
          <button class="btn-primary" onclick="navigate('#lib')">Back to Library</button>
        </div>
      </div>
    </div>`;
    return;
  }

  const nodeCount = flattenNodes(recipe.nodes).filter(i => !i.isBranchHeader).length;

  container.innerHTML = `
    <div class="screen pvw-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="pvw-back" title="Back to Library">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">preview</span>
            ${recipe.name}
          </div>
          ${recipe.isSystem
            ? '<span class="ic-badge ic-badge--blue"><span class="material-symbols-outlined" style="font-size:11px">lock</span> System</span>'
            : '<span class="ic-badge ic-badge--green"><span class="material-symbols-outlined" style="font-size:11px">person</span> Yours</span>'}
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary" id="pvw-btn-compare" disabled title="Compare requires a test image">
            <span class="material-symbols-outlined">compare</span>
            Compare
          </button>
          ${recipe.isSystem
            ? `<button class="btn-secondary" id="pvw-btn-clone">
                 <span class="material-symbols-outlined">content_copy</span>
                 Clone
               </button>`
            : `<button class="btn-secondary" id="pvw-btn-edit">
                 <span class="material-symbols-outlined">edit</span>
                 Edit
               </button>`
          }
          <button class="btn-primary" id="pvw-btn-use">
            <span class="material-symbols-outlined">play_arrow</span>
            Use Recipe
          </button>
        </div>
      </div>

      <div class="pvw-body">
        <!-- Left panel: meta + nodes -->
        <div class="pvw-sidebar">
          <div class="pvw-meta-card">
            <div class="pvw-cover" style="${getCoverStyle(recipe)}">
              <div class="pvw-cover-overlay">
                <span class="text-sm text-muted mono">${nodeCount} step${nodeCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div class="pvw-meta-body">
              ${recipe.description ? `<p class="pvw-desc">${recipe.description}</p>` : ''}
              <div class="pvw-tags">
                ${(recipe.tags || []).map(t => `<span class="ic-badge">${t}</span>`).join('')}
              </div>
            </div>
          </div>

          <div class="pvw-section-title">Steps</div>
          <div class="pvw-node-list">
            ${renderNodeList(recipe.nodes)}
          </div>
        </div>

        <!-- Right panel: preview -->
        <div class="pvw-preview-panel">
          <div class="pvw-preview-header">
            <span class="text-sm text-muted">Test Image</span>
            <div class="flex items-center gap-2">
              <button class="btn-icon" id="pvw-btn-info" title="Image info / metadata" style="display:none">
                <span class="material-symbols-outlined">info</span>
              </button>
              <label class="btn-secondary pvw-upload-btn" style="cursor:pointer">
                <span class="material-symbols-outlined">upload</span>
                Upload Image
                <input type="file" id="pvw-file-input" accept="image/*" style="display:none">
              </label>
            </div>
          </div>

          <div id="pvw-preview-area" class="pvw-preview-area">
            <div class="empty-state">
              <span class="material-symbols-outlined" style="font-size:48px">image</span>
              <div class="empty-state-title">Upload a test image</div>
              <div class="empty-state-desc">See how this recipe transforms your image.</div>
            </div>
          </div>

          <div id="pvw-step-scrubber" class="pvw-step-scrubber" style="display:none">
            <span class="text-sm text-muted" style="flex-shrink:0">Step:</span>
            <input type="range" id="pvw-step-slider" class="ic-range" min="0" value="0" style="flex:1">
            <span id="pvw-step-label" class="mono text-sm" style="min-width:80px;text-align:right">Original</span>
          </div>
        </div>
      </div>
    </div>`;

  injectPvwStyles();
  injectImageInfoStyles();

  // ── State ─────────────────────────────────────────────────
  let testFile    = null;
  let testImage   = null;
  let stepResults = [];   // { canvas url, step label }

  // Restore persisted test image
  if (window._icTestImage?.file) {
    testFile = window._icTestImage.file;
    setTimeout(() => {
      container.querySelector('#pvw-btn-info').style.display = '';
      runPreview(testFile);
    }, 0);
  }

  // ── Image info modal ──────────────────────────────────────
  container.querySelector('#pvw-btn-info')?.addEventListener('click', async () => {
    if (!testFile) return;
    openInfoModal(testFile);
  });

  function openInfoModal(file) {
    let modal = document.getElementById('pvw-info-modal');
    if (modal) modal.remove();
    modal = document.createElement('dialog');
    modal.id = 'pvw-info-modal';
    modal.className = 'modal';
    modal.style.cssText = 'width:520px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;padding:0;border-radius:14px;border:1px solid var(--ps-border);background:var(--ps-bg-surface)';
    modal.innerHTML = `
      <div class="modal__header" style="padding:12px 16px;border-bottom:1px solid var(--ps-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <span style="font-size:14px;font-weight:600;color:var(--ps-text)">Image Info</span>
        <button class="btn-icon" id="pvw-info-close"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div id="pvw-info-body" style="flex:1;overflow-y:auto;padding:0">
        <div style="display:flex;align-items:center;justify-content:center;height:120px;gap:8px">
          <div class="spinner"></div><span class="text-sm text-muted">Reading metadata…</span>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.showModal();
    modal.querySelector('#pvw-info-close')?.addEventListener('click', () => modal.close());
    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

    getImageInfo(file).then(info => {
      const body = modal.querySelector('#pvw-info-body');
      if (body) { body.innerHTML = ''; body.appendChild(renderImageInfoPanel(info)); }
    });
  }

  // ── Back button ───────────────────────────────────────────
  container.querySelector('#pvw-back')?.addEventListener('click', () => navigate('#lib'));

  // ── Use button ────────────────────────────────────────────
  container.querySelector('#pvw-btn-use')?.addEventListener('click', () => navigate(`#set?recipe=${recipe.id}`));

  // ── Edit / Clone ──────────────────────────────────────────
  container.querySelector('#pvw-btn-edit')?.addEventListener('click', () => navigate(`#bld?id=${recipe.id}`));
  container.querySelector('#pvw-btn-clone')?.addEventListener('click', async () => {
    const cloned = await cloneRecipe(recipe.id);
    window.AuroraToast?.show({ variant: 'success', title: `"${cloned.name}" cloned` });
    navigate(`#bld?id=${cloned.id}`);
  });

  // ── Compare button ────────────────────────────────────────
  container.querySelector('#pvw-btn-compare')?.addEventListener('click', () => {
    if (testFile) navigate(`#cmp?recipe=${recipe.id}&file=_test`);
  });

  // ── File upload ───────────────────────────────────────────
  container.querySelector('#pvw-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    testFile = file;
    window._icTestImage = { file };
    container.querySelector('#pvw-btn-info').style.display = '';
    await runPreview(file);
  });

  // ── Drag & drop on preview area ───────────────────────────
  const previewArea = container.querySelector('#pvw-preview-area');
  previewArea?.addEventListener('dragover', e => { e.preventDefault(); previewArea.classList.add('pvw-dragover'); });
  previewArea?.addEventListener('dragleave', () => previewArea.classList.remove('pvw-dragover'));
  previewArea?.addEventListener('drop', async e => {
    e.preventDefault();
    previewArea.classList.remove('pvw-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) { testFile = file; window._icTestImage = { file }; container.querySelector('#pvw-btn-info').style.display = ''; await runPreview(file); }
  });

  // ── Step slider ───────────────────────────────────────────
  container.querySelector('#pvw-step-slider')?.addEventListener('input', e => {
    showStep(parseInt(e.target.value));
  });

  async function runPreview(file) {
    previewArea.innerHTML = `<div class="pvw-processing"><div class="spinner spinner--lg"></div><div class="text-sm text-muted" style="margin-top:12px">Processing…</div></div>`;

    try {
      const url   = URL.createObjectURL(file);
      testImage   = new Image();
      await new Promise((res, rej) => { testImage.onload = res; testImage.onerror = rej; testImage.src = url; });

      const exif    = await extractExif(file);
      const context = { filename: file.name, exif, meta: {} };

      // Build step snapshots: index -1 = original, then 0..N-1 nodes
      const allNodes    = recipe.nodes;
      const flatSteps   = flattenNodes(allNodes).filter(i => !i.isBranchHeader);

      stepResults = [{ label: 'Original', dataUrl: url }];

      // Run processor with stopAfterIndex for each top-level step
      for (let i = 0; i < allNodes.length; i++) {
        const proc = new ImageProcessor();
        await proc.process(testImage, allNodes, { ...context, variables: new Map() }, i);
        const stepUrl = proc.canvas.toDataURL('image/jpeg', 0.85);
        const stepLabel = allNodes[i].label || allNodes[i].transformId || allNodes[i].type;
        stepResults.push({ label: stepLabel, dataUrl: stepUrl });
      }

      const slider = container.querySelector('#pvw-step-slider');
      if (slider) {
        slider.max   = stepResults.length - 1;
        slider.value = stepResults.length - 1;
      }

      container.querySelector('#pvw-step-scrubber').style.display = 'flex';
      container.querySelector('#pvw-btn-compare').disabled = false;
      showStep(stepResults.length - 1);

    } catch (err) {
      console.error('[pvw] Preview error:', err);
      previewArea.innerHTML = `<div class="empty-state">
        <span class="material-symbols-outlined">error</span>
        <div class="empty-state-title">Preview failed</div>
        <div class="empty-state-desc">${err.message}</div>
      </div>`;
    }
  }

  function showStep(idx) {
    const step = stepResults[idx];
    if (!step) return;
    const label = container.querySelector('#pvw-step-label');
    if (label) label.textContent = idx === 0 ? 'Original' : `Step ${idx}: ${step.label}`;

    previewArea.innerHTML = `
      <div class="pvw-img-wrapper">
        <img src="${step.dataUrl}" class="pvw-result-img" draggable="false">
        ${idx === 0
          ? `<div class="pvw-img-badge">Original</div>`
          : `<div class="pvw-img-badge pvw-img-badge--blue">After step ${idx}</div>`}
      </div>`;
  }
}

// ── Cover gradient helper (same as lib.js) ─────────────────
const COVER_GRADIENTS = {
  '#0077ff': 'linear-gradient(135deg, #0a1628 0%, #0044cc 100%)',
  '#8b5cf6': 'linear-gradient(135deg, #1a0a2e 0%, #6d28d9 100%)',
  '#22c55e': 'linear-gradient(135deg, #0a1e10 0%, #15803d 100%)',
  '#f59e0b': 'linear-gradient(135deg, #1e150a 0%, #b45309 100%)',
  '#f472b6': 'linear-gradient(135deg, #1e0a14 0%, #be185d 100%)',
  '#374151': 'linear-gradient(135deg, #111318 0%, #374151 100%)',
  '#92400e': 'linear-gradient(135deg, #1a0e06 0%, #92400e 100%)',
  '#0ea5e9': 'linear-gradient(135deg, #060e1a 0%, #0369a1 100%)',
};
function getCoverStyle(recipe) {
  return recipe.coverColor && COVER_GRADIENTS[recipe.coverColor]
    ? `background:${COVER_GRADIENTS[recipe.coverColor]};`
    : 'background:linear-gradient(135deg,#111318 0%,#1e293b 100%);';
}

let _pvwStyles = false;
function injectPvwStyles() {
  if (_pvwStyles) return;
  _pvwStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .pvw-screen { display:flex; flex-direction:column; height:100%; }
    .pvw-body { display:flex; flex:1; overflow:hidden; gap:0; }

    /* Sidebar */
    .pvw-sidebar { width:280px; flex-shrink:0; display:flex; flex-direction:column; border-right:1px solid var(--ps-border); overflow-y:auto; }
    .pvw-meta-card { flex-shrink:0; }
    .pvw-cover { height:100px; position:relative; }
    .pvw-cover-overlay {
      position:absolute; inset:0; display:flex; align-items:flex-end; padding:8px 12px;
      background:linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%);
    }
    .pvw-meta-body { padding:12px 14px; }
    .pvw-desc { font-size:12px; color:var(--ps-text-muted); line-height:1.5; margin-bottom:8px; }
    .pvw-tags { display:flex; flex-wrap:wrap; gap:4px; }

    .pvw-section-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;
      color:var(--ps-text-faint); padding:12px 14px 6px; border-top:1px solid var(--ps-border); flex-shrink:0; }
    .pvw-node-list { flex:1; overflow-y:auto; padding-bottom:12px; }

    .pvw-node-row {
      display:flex; align-items:center; gap:7px; padding:6px 14px;
      font-size:12px; color:var(--ps-text-muted); transition:background 100ms;
    }
    .pvw-node-row:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .pvw-node-row--header { color:var(--ps-text-faint); font-size:11px; gap:4px; }
    .pvw-node-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
    .pvw-node-label { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pvw-node-variant-label { font-style:italic; }

    /* Preview panel */
    .pvw-preview-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .pvw-preview-header { display:flex; align-items:center; justify-content:space-between;
      padding:12px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }

    .pvw-preview-area {
      flex:1; overflow:auto; display:flex; align-items:center; justify-content:center;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/32px 32px;
      transition:outline 150ms;
    }
    .pvw-preview-area.pvw-dragover { outline:2px dashed var(--ps-blue); outline-offset:-4px; }
    .pvw-processing { display:flex; flex-direction:column; align-items:center; }
    .pvw-img-wrapper { position:relative; max-width:100%; max-height:100%; }
    .pvw-result-img { display:block; max-width:calc(100vw - 360px); max-height:calc(100vh - 180px); object-fit:contain; }
    .pvw-img-badge {
      position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.7);
      color:#fff; font-size:10px; padding:3px 7px; border-radius:4px; font-family:var(--font-mono);
    }
    .pvw-img-badge--blue { background:rgba(0,119,255,0.8); }

    .pvw-step-scrubber {
      display:flex; align-items:center; gap:10px;
      padding:10px 16px; border-top:1px solid var(--ps-border); flex-shrink:0;
      background:var(--ps-bg-surface);
    }
  `;
  document.head.appendChild(s);
}
