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
import { flattenNodes, countNodes }               from '../utils/nodes.js';

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


function renderNodeList(nodes, previewNodeId) {
  const items = flattenNodes(nodes);
  if (!items.length) return '<div class="empty-state" style="padding:24px"><div class="empty-state-title">No nodes</div></div>';
  return items.map(({ node, depth, isBranchHeader }) => {
    if (isBranchHeader) {
      return `<div class="pvw-node-row pvw-node-row--header" style="padding-left:${16 + depth * 16}px">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-text-faint)">subdirectory_arrow_right</span>
        <span class="pvw-node-variant-label" style="font-style:italic;font-size:11px">${node.label}</span>
      </div>`;
    }
    const { icon, label, cat } = nodeTypeLabel(node);
    const accent = CAT_COLORS[cat] || '#6b7280';
    const isCurrent = node.id === previewNodeId;
    return `<div class="pvw-node-row${isCurrent ? ' is-active' : ''}" style="padding-left:${16 + depth * 16}px" data-node-id="${node.id}" title="Click eye to preview up to this step">
      <span class="pvw-node-dot" style="background:${isCurrent ? 'var(--ps-blue)' : accent}"></span>
      <span class="material-symbols-outlined" style="font-size:14px;color:${isCurrent ? 'var(--ps-blue)' : accent};flex-shrink:0">${icon}</span>
      <span class="pvw-node-label">${label}</span>
      <button class="pvw-node-eye btn-icon" data-eye-id="${node.id}">
        <span class="material-symbols-outlined">${isCurrent ? 'visibility' : 'visibility_off'}</span>
      </button>
      ${node.disabled ? '<span class="ic-badge" style="margin-left:auto;font-size:10px">off</span>' : ''}
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

  const nodeCount = countNodes(recipe.nodes);

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
          <div class="pvw-node-list" id="pvw-node-list">
            ${renderNodeList(recipe.nodes, null)}
          </div>
        </div>

        <!-- Right panel: unified workspace -->
        <div id="pvw-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0"></div>
      </div>
    </div>`;

  injectPvwStyles();

  // ── Unified Image Workspace ───────────────────────────────
  let previewNodeId = null;

  const { ImageWorkspace } = await import('../components/image-workspace.js');
  const wsContainer = container.querySelector('#pvw-workspace-container');
  
  const workspace = new ImageWorkspace(wsContainer, {
    allowUpload: true,
    allowFolder: true,
    onFilesChange: (files, activeFile) => {
      window._icTestFolderFiles = files;
      window._icTestImage = { file: activeFile };
      const btn = container.querySelector('#pvw-btn-compare');
      if (btn) btn.disabled = !activeFile;
    },
    onRender: async (file) => {
      const img = new Image();
      const beforeUrl = URL.createObjectURL(file);
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = beforeUrl; });
      
      const exif = await extractExif(file);
      const context = { filename: file.name, exif, meta: {}, variables: new Map() };
      
      const proc = new ImageProcessor();
      const afterUrl = await proc.previewDataUrl(img, recipe.nodes, context, previewNodeId);

      const flat = flattenNodes(recipe.nodes);
      const nodeEnt = flat.find(f => f.node.id === previewNodeId);
      const label = nodeEnt ? (nodeEnt.node.label || nodeEnt.node.transformId || nodeEnt.node.type) : 'All Steps';

      return {
        beforeUrl,
        afterUrl,
        beforeLabel: 'Original',
        afterLabel: previewNodeId ? `Up to: ${label}` : 'Result',
        context
      };
    }
  });

  if (window._icTestFolderFiles && window._icTestFolderFiles.length > 0) {
    workspace.setFiles(window._icTestFolderFiles);
  } else if (window._icTestImage?.file) {
    workspace.setFiles([window._icTestImage.file]);
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
    if (window._icTestImage?.file) navigate(`#cmp?recipe=${recipe.id}&file=_test`);
  });

  // ── Step interaction ──────────────────────────────────────
  container.querySelector('#pvw-node-list')?.addEventListener('click', e => {
    const row = e.target.closest('.pvw-node-row');
    if (!row) return;
    const nodeId = row.dataset.nodeId;
    if (!nodeId) return;

    previewNodeId = nodeId;
    // Update active row
    container.querySelectorAll('.pvw-node-row').forEach(r => {
      const isAct = r.dataset.nodeId === nodeId;
      r.classList.toggle('is-active', isAct);
      const dot = r.querySelector('.pvw-node-dot');
      const icon = r.querySelector('.material-symbols-outlined[style*="color"]'); // fix this selector
      const eye = r.querySelector('.pvw-node-eye .material-symbols-outlined');
      if (eye) eye.textContent = isAct ? 'visibility' : 'visibility_off';
    });

    if (window._icTestImage?.file) workspace.triggerProcess();
  });
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
      cursor:pointer; position:relative;
    }
    .pvw-node-row:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .pvw-node-row.is-active { background:rgba(0,119,255,0.08); color:var(--ps-text); }
    .pvw-node-row--header { color:var(--ps-text-faint); font-size:11px; gap:4px; cursor:default; }
    .pvw-node-row--header:hover { background:transparent; }
    .pvw-node-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
    .pvw-node-label { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pvw-node-variant-label { font-style:italic; }

    .pvw-node-eye { opacity:0; padding:2px; margin-left:auto; }
    .pvw-node-row:hover .pvw-node-eye, .pvw-node-row.is-active .pvw-node-eye { opacity:1; }
    .pvw-node-eye .material-symbols-outlined { font-size:16px; }

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

    .pvw-step-info {
      display:flex; align-items:center; gap:8px;
      padding:10px 16px; border-top:1px solid var(--ps-border); flex-shrink:0;
      background:var(--ps-bg-surface);
    }
  `;
  document.head.appendChild(s);
}
