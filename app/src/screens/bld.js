/**
 * ImageChef — BLD: Recipe Builder
 *
 * Edit recipe metadata, manage node list, add/reorder/delete nodes.
 * Autosaves after 5 s of inactivity; flush on navigate-away.
 * Accessed via #bld?id=<recipeId>
 */

import { getRecipe, saveRecipe, scheduleAutosave, flushAutosave } from '../data/recipes.js';
import { navigate } from '../main.js';
import { uuid, now, deepClone } from '../utils/misc.js';
import { registry, ImageProcessor } from '../engine/index.js';
import { flattenNodes, countNodes, findNodeAndParent } from '../utils/nodes.js';
import { showConfirm } from '../utils/dialogs.js';
import { extractExif } from '../engine/exif-reader.js';

// Category accent colours (match theme vars)
const CAT_COLORS = {
  'Geometric & Framing': { key: 'geo',     color: '#38bdf8' },
  'Color & Tone':        { key: 'color',   color: '#a78bfa' },
  'Overlays & Text':     { key: 'overlay', color: '#fb923c' },
  'AI & Vision':         { key: 'ai',      color: '#34d399' },
  'Flow & Export':       { key: 'flow',    color: '#0077ff' },
  'Metadata':            { key: 'meta',    color: '#f472b6' },
};

const COVER_COLORS = [
  { label: 'Blue',   value: '#0077ff' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'Amber',  value: '#f59e0b' },
  { label: 'Pink',   value: '#f472b6' },
  { label: 'Slate',  value: '#374151' },
  { label: 'Brown',  value: '#92400e' },
  { label: 'Sky',    value: '#0ea5e9' },
];

const COVER_GRADIENTS = {
  '#0077ff': 'linear-gradient(135deg,#0a1628 0%,#0044cc 100%)',
  '#8b5cf6': 'linear-gradient(135deg,#1a0a2e 0%,#6d28d9 100%)',
  '#22c55e': 'linear-gradient(135deg,#0a1e10 0%,#15803d 100%)',
  '#f59e0b': 'linear-gradient(135deg,#1e150a 0%,#b45309 100%)',
  '#f472b6': 'linear-gradient(135deg,#1e0a14 0%,#be185d 100%)',
  '#374151': 'linear-gradient(135deg,#111318 0%,#374151 100%)',
  '#92400e': 'linear-gradient(135deg,#1a0e06 0%,#92400e 100%)',
  '#0ea5e9': 'linear-gradient(135deg,#060e1a 0%,#0369a1 100%)',
};

function getCoverGradient(color) {
  return COVER_GRADIENTS[color] || 'linear-gradient(135deg,#111318 0%,#1e293b 100%)';
}

function getCatInfo(transformId) {
  // Ask registry for categoryKey
  const def = registry.get(transformId);
  if (def) {
    const entry = Object.values(CAT_COLORS).find(e => e.key === def.categoryKey);
    return entry || { key: def.categoryKey || 'other', color: '#6b7280' };
  }
  return { key: transformId?.split('-')[0] || 'other', color: '#6b7280' };
}

function nodeIconAndColor(node) {
  if (node.type === 'branch')      return { icon: 'device_hub',  color: '#0077ff' };
  if (node.type === 'conditional') return { icon: 'alt_route',   color: '#0077ff' };
  if (node.type === 'block-ref')   return { icon: 'widgets',     color: '#6b7280' };
  const info = getCatInfo(node.transformId);
  const def  = registry.get(node.transformId);
  return { icon: def?.icon || 'tune', color: info.color };
}

function buildNodeRow(item, isSelected) {
  const { node, depth, isBranchHeader } = item;
  const { icon, color } = nodeIconAndColor(node);
  const label = node.label || node.transformId || node.type;

  if (isBranchHeader) {
    return `
      <div class="bld-node-row bld-node-row--header ${isSelected ? 'is-selected' : ''}"
           data-id="${node.id}" style="padding-left:${12 + depth * 16}px">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-text-faint)">subdirectory_arrow_right</span>
        <span class="bld-node-label" style="font-style:italic;font-size:11px;color:var(--ps-text-faint)">${label}</span>
      </div>`;
  }

  return `
    <div class="bld-node-row ${isSelected ? 'is-selected' : ''} ${node.disabled ? 'is-disabled' : ''}"
         data-id="${node.id}" draggable="true" style="padding-left:${8 + depth * 16}px">
      <button class="btn-icon bld-drag-handle" title="Drag to reorder" tabindex="-1">
        <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-text-faint)">drag_indicator</span>
      </button>
      <span class="bld-node-dot" style="background:${color}"></span>
      <span class="material-symbols-outlined" style="font-size:14px;color:${color};flex-shrink:0">${icon}</span>
      <span class="bld-node-label" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span>
      ${node.disabled ? '<span class="ic-badge" style="font-size:10px">off</span>' : ''}
      <div class="bld-node-actions">
        <button class="btn-icon bld-btn-toggle" data-id="${node.id}" title="${node.disabled ? 'Enable' : 'Disable'}">
          <span class="material-symbols-outlined" style="font-size:14px">${node.disabled ? 'visibility_off' : 'visibility'}</span>
        </button>
        <button class="btn-icon bld-btn-edit" data-id="${node.id}" title="Edit node">
          <span class="material-symbols-outlined" style="font-size:14px">edit</span>
        </button>
        <button class="btn-icon bld-btn-delete" data-id="${node.id}" title="Delete node">
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-red)">delete</span>
        </button>
      </div>
    </div>`;
}

function buildAddNodeModal(grouped) {
  const sections = Object.entries(grouped).map(([cat, transforms]) => {
    const { color } = Object.values(CAT_COLORS).find(e =>
      transforms.some(t => t.categoryKey === e.key)
    ) || { color: '#6b7280' };
    return `
      <div class="bld-add-section">
        <div class="bld-add-cat" style="color:${color}">${cat}</div>
        <div class="bld-add-grid">
          ${transforms.map(t => `
            <button class="bld-add-item" data-transform-id="${t.id}">
              <span class="material-symbols-outlined" style="font-size:18px;color:${color}">${t.icon || 'tune'}</span>
              <span class="bld-add-item-name">${t.name}</span>
            </button>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  return `
    <div id="bld-add-modal" class="bld-modal-overlay" style="display:none">
      <div class="bld-modal">
        <div class="bld-modal-header">
          <span class="bld-modal-title">Add Step</span>
          <div class="flex items-center gap-2">
            <input type="text" id="bld-add-search" class="ic-input" placeholder="Search transforms…" style="width:200px" autocomplete="off">
            <button class="btn-icon" id="bld-add-close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div class="bld-add-body" id="bld-add-sections">
          ${sections}
        </div>
        <div class="bld-modal-footer">
          <button class="btn-secondary bld-add-branch-btn" data-type="branch">
            <span class="material-symbols-outlined" style="font-size:14px">device_hub</span>
            Add Branch
          </button>
          <button class="btn-secondary bld-add-branch-btn" data-type="conditional">
            <span class="material-symbols-outlined" style="font-size:14px">alt_route</span>
            Add Conditional
          </button>
        </div>
      </div>
    </div>`;
}

export async function render(container, hash) {
  const params   = new URLSearchParams((hash.split('?')[1] || ''));
  const recipeId = params.get('id');

  const recipe = recipeId ? await getRecipe(recipeId) : null;
  if (!recipe) {
    container.innerHTML = `<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">Recipe not found</div>
        <button class="btn-primary" onclick="navigate('#lib')">Back to Library</button>
      </div></div></div>`;
    return;
  }

  if (recipe.isSystem) {
    // Redirect system recipes to preview
    navigate(`#pvw?id=${recipe.id}`);
    return;
  }

  // Make a working copy
  let draft = deepClone(recipe);
  let selectedId = null;

  // Auto-expand config panel for brand-new recipes
  const isNew = draft.name === 'Untitled Recipe' && !draft.description && !draft.nodes?.length;
  let configOpen = isNew;

  function getFlatItems() {
    return flattenNodes(draft.nodes);
  }

  // Get grouped transforms for modal
  import('../../src/engine/index.js').catch(() => {});
  const grouped = registry.getGrouped();

  container.innerHTML = `
    <div class="screen bld-screen">
      <div class="screen-header bld-header-3col">
        <div class="bld-header-left flex items-center gap-2">
          <button class="btn-icon" id="bld-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">format_list_numbered</span>
            Recipe Builder
          </div>
          <button class="btn-icon bld-config-toggle" id="bld-config-toggle" title="Toggle recipe details">
            <span class="material-symbols-outlined">tune</span>
          </button>
          <span id="bld-save-status" class="text-sm text-muted" style="margin-left:4px"></span>
        </div>
        <div class="bld-header-center">
          <span id="bld-header-name" class="bld-header-name">${escHtml(draft.name)}</span>
        </div>
        <div class="bld-header-right flex items-center gap-2">
          <button class="btn-secondary" id="bld-btn-preview">
            <span class="material-symbols-outlined">preview</span>
            Preview
          </button>
          <button class="btn-primary" id="bld-btn-use">
            <span class="material-symbols-outlined">play_arrow</span>
            Use
          </button>
        </div>
      </div>

      <div class="bld-body">
        <!-- Left: recipe meta -->
        <div class="bld-config">
          <div class="bld-cover-preview" id="bld-cover-preview" style="${getCoverGradient(draft.coverColor) ? `background:${getCoverGradient(draft.coverColor)}` : ''}">
            <span class="bld-cover-name" id="bld-cover-name">${draft.name}</span>
          </div>

          <div class="bld-config-form">
            <label class="ic-label">Name</label>
            <input type="text" id="bld-name" class="ic-input" value="${escHtml(draft.name)}" placeholder="Recipe name…">

            <label class="ic-label" style="margin-top:12px">Description</label>
            <textarea id="bld-desc" class="ic-input" rows="3" placeholder="What does this recipe do?">${escHtml(draft.description || '')}</textarea>

            <label class="ic-label" style="margin-top:12px">Cover Colour</label>
            <div class="bld-color-grid">
              ${COVER_COLORS.map(c => `
                <button class="bld-color-swatch ${draft.coverColor === c.value ? 'is-active' : ''}"
                  data-color="${c.value}" style="background:${c.value}" title="${c.label}">
                  ${draft.coverColor === c.value ? '<span class="material-symbols-outlined" style="font-size:14px">check</span>' : ''}
                </button>`).join('')}
            </div>

            <label class="ic-label" style="margin-top:12px">Tags</label>
            <input type="text" id="bld-tags" class="ic-input" value="${(draft.tags || []).join(', ')}" placeholder="web, social, print …">
            <div class="text-sm text-muted" style="margin-top:4px">Comma-separated</div>
          </div>
        </div>

        <!-- Middle: node list -->
        <div class="bld-nodes-panel">
          <div class="bld-nodes-header">
            <span class="text-sm font-medium">Steps</span>
            <span id="bld-node-count" class="text-sm text-muted">${draft.nodes.length} step${draft.nodes.length !== 1 ? 's' : ''}</span>
            <button class="btn-primary bld-btn-add" id="bld-btn-add-node" style="margin-left:auto">
              <span class="material-symbols-outlined">add</span>
              Add Step
            </button>
          </div>

          <div id="bld-node-list" class="bld-node-list">
            ${getFlatItems().length
              ? getFlatItems().map(item => buildNodeRow(item, selectedId === item.node.id)).join('')
              : `<div class="empty-state" style="padding:32px">
                   <span class="material-symbols-outlined">account_tree</span>
                   <div class="empty-state-title">No steps yet</div>
                   <div class="empty-state-desc">Click "Add Step" to build your recipe.</div>
                 </div>`}
          </div>
        </div>

        <!-- Right: inline preview -->
        <div class="bld-inline-preview">
          <div class="bld-inline-preview-header">
            <span class="text-sm font-medium">Preview</span>
            <div class="flex items-center gap-2">
              <button class="btn-secondary bld-cmp-toggle" id="bld-cmp-toggle" style="display:none;font-size:12px;padding:4px 10px">
                <span class="material-symbols-outlined" style="font-size:14px">compare</span>
                Compare
              </button>
              <div id="bld-cmp-ref-row" class="bld-cmp-ref-row" style="display:none">
                <button class="bld-cmp-ref-btn is-active" data-ref="original">Original</button>
                <button class="bld-cmp-ref-btn" data-ref="prev">Prev Step</button>
              </div>
              <label class="btn-secondary bld-upload-label" style="cursor:pointer">
                <span class="material-symbols-outlined" style="font-size:14px">upload</span>
                Image
                <input type="file" id="bld-preview-file" accept="image/*" style="display:none">
              </label>
            </div>
          </div>
          <div id="bld-preview-area" class="bld-preview-area">
            <div class="empty-state" style="padding:24px;text-align:center">
              <span class="material-symbols-outlined" style="font-size:36px">image</span>
              <div class="empty-state-title" style="font-size:12px">Upload a test image</div>
              <div class="empty-state-desc" style="font-size:11px">Preview updates automatically.</div>
            </div>
          </div>
          <div id="bld-preview-step-info" class="bld-preview-step-info" style="display:none">
            <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-blue)">info</span>
            <span id="bld-preview-step-label" class="text-xs text-muted"></span>
          </div>
        </div>
      </div>
    </div>

    ${buildAddNodeModal(grouped)}`;

  injectBldStyles();

  // ── Config panel collapse ─────────────────────────────────
  const configPanel = container.querySelector('.bld-config');
  function applyConfigOpen() {
    configPanel?.classList.toggle('is-collapsed', !configOpen);
    const toggleBtn = container.querySelector('#bld-config-toggle');
    if (toggleBtn) toggleBtn.classList.toggle('is-active', configOpen);
  }
  applyConfigOpen();

  container.querySelector('#bld-config-toggle')?.addEventListener('click', () => {
    configOpen = !configOpen;
    applyConfigOpen();
  });

  const saveStatus = container.querySelector('#bld-save-status');

  // ── Inline preview state ──────────────────────────────────
  let bldTestFile      = null;
  let bldPreviewNodeId = null;
  let bldPreviewTimer  = null;
  let bldCompareMode   = false;
  let bldCompareRef    = 'original'; // 'original' | 'prev'

  // Restore persisted test image
  if (window._icTestImage?.file) {
    bldTestFile = window._icTestImage.file;
  }

  function scheduleBldPreview(delay = 400) {
    clearTimeout(bldPreviewTimer);
    bldPreviewTimer = setTimeout(() => runBldPreview(), delay);
  }

  function getPrevNodeId() {
    const nodes = flattenNodes(draft.nodes).filter(i => !i.isBranchHeader);
    if (!bldPreviewNodeId) return nodes.length >= 2 ? nodes[nodes.length - 2].node.id : null;
    const idx = nodes.findIndex(i => i.node.id === bldPreviewNodeId);
    return idx > 0 ? nodes[idx - 1].node.id : null;
  }

  function renderCompareSlider(area, beforeUrl, afterUrl, beforeLabel, afterLabel) {
    area.innerHTML = `
      <div class="bld-cmp-wrap" id="bld-cmp-wrap">
        <img class="bld-cmp-img" id="bld-cmp-before-img" src="${beforeUrl}" draggable="false" style="clip-path:inset(0 50% 0 0)">
        <img class="bld-cmp-img" id="bld-cmp-after-img"  src="${afterUrl}"  draggable="false" style="clip-path:inset(0 0 0 50%)">
        <div class="bld-cmp-handle" id="bld-cmp-handle" style="left:50%">
          <div class="bld-cmp-handle-line"></div>
          <div class="bld-cmp-handle-knob">
            <span class="material-symbols-outlined" style="font-size:18px">swap_horiz</span>
          </div>
        </div>
        <span class="bld-cmp-label bld-cmp-label--l">${beforeLabel}</span>
        <span class="bld-cmp-label bld-cmp-label--r">${afterLabel}</span>
      </div>`;

    const wrap      = area.querySelector('#bld-cmp-wrap');
    const handle    = area.querySelector('#bld-cmp-handle');
    const beforeImg = area.querySelector('#bld-cmp-before-img');
    const afterImg  = area.querySelector('#bld-cmp-after-img');
    let dragging = false;

    const setPos = clientX => {
      const rect = wrap.getBoundingClientRect();
      const pos  = Math.max(0.01, Math.min(0.99, (clientX - rect.left) / rect.width));
      const pct  = (pos * 100).toFixed(1);
      handle.style.left         = `${pct}%`;
      beforeImg.style.clipPath  = `inset(0 ${(100 - pos * 100).toFixed(1)}% 0 0)`;
      afterImg.style.clipPath   = `inset(0 0 0 ${pct}%)`;
    };

    handle.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
    window.addEventListener('mousemove', e => { if (dragging) setPos(e.clientX); });
    window.addEventListener('mouseup',   () => { dragging = false; });
    handle.addEventListener('touchstart', e => { dragging = true; e.preventDefault(); }, { passive: false });
    window.addEventListener('touchmove',  e => { if (dragging) setPos(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchend',   () => { dragging = false; });
  }

  async function runBldPreview() {
    if (!bldTestFile) return;
    const previewArea = container.querySelector('#bld-preview-area');
    if (!previewArea) return;

    previewArea.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:32px">
      <div class="spinner"></div>
      <div class="text-sm text-muted" style="margin-top:10px">Processing…</div>
    </div>`;

    try {
      const url = URL.createObjectURL(bldTestFile);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });

      const exif    = await extractExif(bldTestFile);
      const context = { filename: bldTestFile.name, exif, meta: {}, variables: new Map() };

      const proc     = new ImageProcessor();
      const afterUrl = await proc.previewDataUrl(img, draft.nodes, context, bldPreviewNodeId);

      // Step label
      const flat    = flattenNodes(draft.nodes);
      const nodeEnt = flat.find(f => f.node.id === bldPreviewNodeId);
      const label   = nodeEnt ? (nodeEnt.node.label || nodeEnt.node.transformId || nodeEnt.node.type) : 'All Steps';

      const stepInfo  = container.querySelector('#bld-preview-step-info');
      const stepLabel = container.querySelector('#bld-preview-step-label');
      if (stepInfo)  stepInfo.style.display = 'flex';
      if (stepLabel) stepLabel.textContent  = bldPreviewNodeId ? `Up to: ${label}` : 'All steps applied';

      // Show compare button now that we have an image
      const cmpToggle = container.querySelector('#bld-cmp-toggle');
      if (cmpToggle) cmpToggle.style.display = '';

      if (bldCompareMode) {
        let beforeUrl, beforeLabel;
        if (bldCompareRef === 'original') {
          beforeUrl   = URL.createObjectURL(bldTestFile);
          beforeLabel = 'Original';
        } else {
          const prevId = getPrevNodeId();
          if (prevId) {
            const proc2 = new ImageProcessor();
            const ctx2  = { filename: bldTestFile.name, exif, meta: {}, variables: new Map() };
            beforeUrl   = await proc2.previewDataUrl(img, draft.nodes, ctx2, prevId);
            const prevEnt = flat.find(f => f.node.id === prevId);
            beforeLabel   = prevEnt ? (prevEnt.node.label || prevEnt.node.transformId || prevEnt.node.type) : 'Prev Step';
          } else {
            beforeUrl   = URL.createObjectURL(bldTestFile);
            beforeLabel = 'Original';
          }
        }
        renderCompareSlider(previewArea, beforeUrl, afterUrl, beforeLabel, label || 'All Steps');
      } else {
        previewArea.innerHTML = `
          <div class="bld-preview-img-wrapper">
            <img src="${afterUrl}" class="bld-preview-result-img" draggable="false">
            <div class="bld-preview-img-badge${bldPreviewNodeId ? ' bld-preview-img-badge--blue' : ''}">
              ${bldPreviewNodeId ? label : 'All Steps'}
            </div>
          </div>`;
      }
    } catch (err) {
      console.error('[bld] Preview error:', err);
      const area2 = container.querySelector('#bld-preview-area');
      if (area2) area2.innerHTML = `<div class="empty-state" style="padding:24px">
        <span class="material-symbols-outlined">error</span>
        <div class="empty-state-title" style="font-size:12px">Preview failed</div>
        <div class="empty-state-desc" style="font-size:11px">${err.message}</div>
      </div>`;
    }
  }

  // File upload for inline preview
  container.querySelector('#bld-preview-file')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    bldTestFile = file;
    window._icTestImage = { file };
    runBldPreview();
  });

  // Drag & drop on preview area
  const bldPreviewArea = container.querySelector('#bld-preview-area');
  bldPreviewArea?.addEventListener('dragover', e => { e.preventDefault(); bldPreviewArea.classList.add('bld-preview-dragover'); });
  bldPreviewArea?.addEventListener('dragleave', () => bldPreviewArea.classList.remove('bld-preview-dragover'));
  bldPreviewArea?.addEventListener('drop', async e => {
    e.preventDefault();
    bldPreviewArea.classList.remove('bld-preview-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) {
      bldTestFile = file;
      window._icTestImage = { file };
      runBldPreview();
    }
  });

  // Kick off preview if we already have a test image
  if (bldTestFile) scheduleBldPreview(100);

  function markDirty() {
    if (saveStatus) saveStatus.textContent = 'Unsaved…';
    scheduleAutosave(draft, () => { if (saveStatus) saveStatus.textContent = 'Saved'; });
    scheduleBldPreview();
  }

  function refreshNodeList() {
    const listEl = container.querySelector('#bld-node-list');
    const countEl = container.querySelector('#bld-node-count');
    const items = getFlatItems();
    if (listEl) {
      listEl.innerHTML = items.length
        ? items.map(item => buildNodeRow(item, selectedId === item.node.id)).join('')
        : `<div class="empty-state" style="padding:32px">
             <span class="material-symbols-outlined">account_tree</span>
             <div class="empty-state-title">No steps yet</div>
             <div class="empty-state-desc">Click "Add Step" to build your recipe.</div>
           </div>`;
      bindNodeActions();
    }
    const realCount = countNodes(draft.nodes);
    if (countEl) countEl.textContent = `${realCount} step${realCount !== 1 ? 's' : ''}`;
  }

  // ── Back ──────────────────────────────────────────────────
  container.querySelector('#bld-back')?.addEventListener('click', async () => {
    await flushAutosave(draft);
    navigate('#lib');
  });

  // ── Use / Preview ─────────────────────────────────────────
  container.querySelector('#bld-btn-use')?.addEventListener('click', () => navigate(`#set?recipe=${draft.id}`));
  container.querySelector('#bld-btn-preview')?.addEventListener('click', () => navigate(`#pvw?id=${draft.id}`));

  // ── Name input ────────────────────────────────────────────
  container.querySelector('#bld-name')?.addEventListener('input', e => {
    draft.name = e.target.value;
    const cn = container.querySelector('#bld-cover-name');
    if (cn) cn.textContent = draft.name || 'Untitled';
    const hn = container.querySelector('#bld-header-name');
    if (hn) hn.textContent = draft.name || 'Untitled Recipe';
    markDirty();
  });

  // ── Description ───────────────────────────────────────────
  container.querySelector('#bld-desc')?.addEventListener('input', e => {
    draft.description = e.target.value;
    markDirty();
  });

  // ── Tags ──────────────────────────────────────────────────
  container.querySelector('#bld-tags')?.addEventListener('input', e => {
    draft.tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
    markDirty();
  });

  // ── Cover colour swatches ─────────────────────────────────
  container.querySelectorAll('.bld-color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      draft.coverColor = btn.dataset.color;
      container.querySelectorAll('.bld-color-swatch').forEach(b => {
        b.classList.toggle('is-active', b.dataset.color === draft.coverColor);
        b.innerHTML = b.dataset.color === draft.coverColor
          ? '<span class="material-symbols-outlined" style="font-size:14px">check</span>'
          : '';
      });
      const cp = container.querySelector('#bld-cover-preview');
      if (cp) cp.style.background = getCoverGradient(draft.coverColor);
      markDirty();
    });
  });

  // ── Add node modal ────────────────────────────────────────
  const addModal = container.querySelector('#bld-add-modal');
  const addSearch = container.querySelector('#bld-add-search');

  container.querySelector('#bld-btn-add-node')?.addEventListener('click', () => {
    if (addModal) { addModal.style.display = 'flex'; addSearch?.focus(); }
  });
  container.querySelector('#bld-add-close')?.addEventListener('click', () => {
    if (addModal) addModal.style.display = 'none';
  });
  addModal?.addEventListener('click', e => {
    if (e.target === addModal) addModal.style.display = 'none';
  });

  // Search filter
  addSearch?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    container.querySelectorAll('.bld-add-item').forEach(btn => {
      const name = btn.querySelector('.bld-add-item-name')?.textContent.toLowerCase() || '';
      const id   = (btn.dataset.transformId || '').toLowerCase();
      btn.closest('.bld-add-section').style.display = '';
      btn.style.display = (!q || name.includes(q) || id.includes(q)) ? '' : 'none';
    });
    // Hide empty sections
    container.querySelectorAll('.bld-add-section').forEach(sec => {
      const visible = [...sec.querySelectorAll('.bld-add-item')].some(b => b.style.display !== 'none');
      sec.style.display = visible ? '' : 'none';
    });
  });

  // Add transform node
  container.querySelectorAll('.bld-add-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = btn.dataset.transformId;
      const def = registry.get(tid);
      const params = {};
      (def?.params || []).forEach(p => { params[p.name] = p.defaultValue ?? ''; });
      const node = { id: uuid(), type: 'transform', transformId: tid, label: def?.name || tid, params };

      insertAtSelection(node);

      refreshNodeList();
      markDirty();
      addModal.style.display = 'none';
      // Open NED to configure
      navigate(`#ned?recipe=${draft.id}&node=${node.id}`);
    });
  });

  function insertAtSelection(node) {
    if (!selectedId) {
      draft.nodes.push(node);
      return;
    }

    const items = getFlatItems();
    const item = items.find(i => i.node.id === selectedId);
    if (!item) {
      draft.nodes.push(node);
      return;
    }

    const { parentId, branchIdx, type } = item.node;
    if (type === '_branch_header') {
      // Find the actual branch node
      const parentInfo = findNodeAndParent(draft.nodes, parentId);
      if (parentInfo && parentInfo.node.branches) {
        const branchNodes = parentInfo.node.branches[branchIdx].nodes;
        branchNodes.unshift(node);
      }
    } else {
      // It's a normal node, insert after it
      const parentInfo = findNodeAndParent(draft.nodes, selectedId);
      if (parentInfo) {
        parentInfo.parent.splice(parentInfo.index + 1, 0, node);
      }
    }
    selectedId = node.id; // Auto-select the new node
  }

  // Add branch / conditional
  container.querySelectorAll('.bld-add-branch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      let newNode;
      if (type === 'branch') {
        newNode = {
          id: uuid(), type: 'branch', label: 'Branch',
          branches: [
            { id: uuid(), label: 'Variant A', nodes: [] },
            { id: uuid(), label: 'Variant B', nodes: [] },
          ]
        };
      } else {
        newNode = {
          id: uuid(), type: 'conditional', label: 'Conditional',
          condition: { field: 'width', operator: 'gt', value: 1000 },
          thenNodes: [], elseNodes: []
        };
      }

      insertAtSelection(newNode);

      refreshNodeList();
      markDirty();
      addModal.style.display = 'none';
    });
  });

  // ── Node list actions ─────────────────────────────────────
  function bindNodeActions() {
    // Toggle disable
    container.querySelectorAll('.bld-btn-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const info = findNodeAndParent(draft.nodes, id);
        if (info) {
          info.node.disabled = !info.node.disabled;
          refreshNodeList();
          markDirty();
        }
      });
    });

    // Edit → open NED
    container.querySelectorAll('.bld-btn-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        navigate(`#ned?recipe=${draft.id}&node=${id}`);
      });
    });

    // Delete
    container.querySelectorAll('.bld-btn-delete').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const confirmed = await showConfirm({
          title: 'Remove Step?',
          body: 'This will remove the selected transformation or block from the recipe.',
          confirmText: 'Remove',
          variant: 'danger',
          icon: 'delete_sweep'
        });
        if (!confirmed) return;

        const info = findNodeAndParent(draft.nodes, id);
        if (info) {
          info.parent.splice(info.index, 1);
          if (selectedId === id) { selectedId = null; bldPreviewNodeId = null; }
          refreshNodeList();
          markDirty();
        }
      });
    });

    // Click row = select
    container.querySelectorAll('.bld-node-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't select if clicking an action button
        if (e.target.closest('.bld-node-actions, .btn-icon')) return;
        const id = row.dataset.id;
        selectedId = (selectedId === id) ? null : id;
        bldPreviewNodeId = selectedId;
        refreshNodeList();
        scheduleBldPreview(0);
      });

      row.addEventListener('dblclick', () => {
        const id = row.dataset.id;
        const info = findNodeAndParent(draft.nodes, id);
        if (info && info.node.type === 'transform') {
          navigate(`#ned?recipe=${draft.id}&node=${id}`);
        }
      });
    });

    // Drag-and-drop reorder
    bindDragDrop();
  }

  // ── Drag-and-drop ─────────────────────────────────────────
  let dragId = null;
  function bindDragDrop() {
    const rows = container.querySelectorAll('.bld-node-row[draggable="true"]');
    rows.forEach(row => {
      row.addEventListener('dragstart', e => {
        dragId = row.dataset.id;
        row.classList.add('bld-node-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => { row.classList.remove('bld-node-dragging'); dragId = null; });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        const overId = row.dataset.id;
        if (overId !== dragId) row.classList.add('bld-node-drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('bld-node-drag-over'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('bld-node-drag-over');
        const toId = row.dataset.id;
        if (!dragId || dragId === toId) return;

        const fromInfo = findNodeAndParent(draft.nodes, dragId);
        const toInfo   = findNodeAndParent(draft.nodes, toId);

        if (fromInfo && toInfo) {
          const [moved] = fromInfo.parent.splice(fromInfo.index, 1);
          // If moving within same parent and fromIndex was before toIndex, adjust toIndex
          let targetIndex = toInfo.index;
          if (fromInfo.parent === toInfo.parent && fromInfo.index < toInfo.index) {
            // targetIndex is already correct because we spliced from before it
          }
          toInfo.parent.splice(targetIndex, 0, moved);
          refreshNodeList();
          markDirty();
        }
      });
    });
  }

  // ── Compare toggle ────────────────────────────────────────
  container.querySelector('#bld-cmp-toggle')?.addEventListener('click', () => {
    bldCompareMode = !bldCompareMode;
    const btn    = container.querySelector('#bld-cmp-toggle');
    const refRow = container.querySelector('#bld-cmp-ref-row');
    btn?.classList.toggle('is-active', bldCompareMode);
    if (refRow) refRow.style.display = bldCompareMode ? 'flex' : 'none';
    scheduleBldPreview(0);
  });

  container.querySelectorAll('.bld-cmp-ref-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bldCompareRef = btn.dataset.ref;
      container.querySelectorAll('.bld-cmp-ref-btn').forEach(b => b.classList.toggle('is-active', b.dataset.ref === bldCompareRef));
      if (bldCompareMode) scheduleBldPreview(0);
    });
  });

  bindNodeActions();

  // ── Cleanup: flush autosave ───────────────────────────────
  return async () => { await flushAutosave(draft); };
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _bldStyles = false;
function injectBldStyles() {
  if (_bldStyles) return;
  _bldStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .bld-screen { display:flex; flex-direction:column; height:100%; }
    .bld-body { display:flex; flex:1; overflow:hidden; }

    /* 3-column header */
    .bld-header-3col { display:grid !important; grid-template-columns:1fr auto 1fr; }
    .bld-header-left { justify-self:start; }
    .bld-header-center { justify-self:center; overflow:hidden; max-width:320px; }
    .bld-header-right { justify-self:end; }
    .bld-header-name {
      font-size:14px; font-weight:600; color:var(--ps-text);
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      display:block;
    }

    /* Compare slider */
    .bld-cmp-wrap {
      display:grid; position:relative; cursor:col-resize; user-select:none;
      max-width:100%; max-height:calc(100vh - 200px);
    }
    .bld-cmp-img {
      grid-area:1/1; display:block;
      max-width:100%; max-height:calc(100vh - 200px); object-fit:contain;
    }
    .bld-cmp-handle {
      position:absolute; top:0; bottom:0; width:0;
      transform:translateX(-50%); cursor:col-resize; z-index:10;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
    }
    .bld-cmp-handle-line {
      position:absolute; top:0; bottom:0; width:2px;
      background:rgba(255,255,255,0.85); box-shadow:0 0 4px rgba(0,0,0,0.5);
    }
    .bld-cmp-handle-knob {
      position:relative; background:#fff; border-radius:50%;
      width:32px; height:32px; display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.4); color:#111; z-index:2;
    }
    .bld-cmp-label {
      position:absolute; top:8px; background:rgba(0,0,0,0.7); color:#fff;
      font-size:10px; padding:3px 7px; border-radius:4px; font-family:var(--font-mono);
      pointer-events:none;
    }
    .bld-cmp-label--l { left:8px; }
    .bld-cmp-label--r { right:8px; }

    /* Compare toggle button */
    .bld-cmp-toggle.is-active { background:var(--ps-blue-10); color:var(--ps-blue); border-color:var(--ps-blue); }
    .bld-cmp-ref-row {
      display:flex; background:var(--ps-bg-app);
      border:1px solid var(--ps-border); border-radius:6px; overflow:hidden;
    }
    .bld-cmp-ref-btn {
      padding:4px 10px; font-size:11px; color:var(--ps-text-muted); border:none;
      background:transparent; cursor:pointer; font-family:var(--font-primary); transition:color 100ms, background 100ms;
    }
    .bld-cmp-ref-btn.is-active { background:var(--ps-blue); color:#fff; }
    .bld-cmp-ref-btn:not(.is-active):hover { background:var(--ps-bg-hover); }

    /* Config panel */
    .bld-config {
      width:260px; flex-shrink:0; border-right:1px solid var(--ps-border);
      overflow-y:auto; display:flex; flex-direction:column;
      transition:width 200ms ease, border-color 200ms ease;
      min-width:0;
    }
    .bld-config.is-collapsed { width:0; border-right-color:transparent; overflow:hidden; }
    .bld-config-toggle.is-active { background:var(--ps-blue-10); color:var(--ps-blue); }
    .bld-cover-preview {
      height:90px; display:flex; align-items:flex-end; padding:10px 12px; flex-shrink:0;
      transition:background 300ms;
    }
    .bld-cover-name { font-size:14px; font-weight:700; color:#fff; text-shadow:0 1px 4px rgba(0,0,0,0.8); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:100%; }
    .bld-config-form { padding:14px; }
    .bld-color-grid { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
    .bld-color-swatch {
      width:28px; height:28px; border-radius:6px; border:2px solid transparent;
      display:flex; align-items:center; justify-content:center; cursor:pointer; transition:border-color 150ms;
    }
    .bld-color-swatch.is-active { border-color: #fff; }
    .bld-color-swatch:hover { transform:scale(1.1); }

    /* Nodes panel */
    .bld-nodes-panel { width:340px; flex-shrink:0; display:flex; flex-direction:column; overflow:hidden; border-right:1px solid var(--ps-border); }
    .bld-nodes-header { display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .bld-node-list { flex:1; overflow-y:auto; padding:8px 0; }

    /* Inline preview panel */
    .bld-inline-preview { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }
    .bld-inline-preview-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .bld-upload-label { font-size:12px; padding:4px 10px; display:inline-flex; align-items:center; gap:5px; }
    .bld-preview-area {
      flex:1; overflow:auto; display:flex; align-items:center; justify-content:center;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/24px 24px;
    }
    .bld-preview-area.bld-preview-dragover { outline:2px dashed var(--ps-blue); outline-offset:-4px; }
    .bld-preview-img-wrapper { position:relative; max-width:100%; max-height:100%; }
    .bld-preview-result-img { display:block; max-width:100%; max-height:calc(100vh - 200px); object-fit:contain; }
    .bld-preview-img-badge {
      position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.7);
      color:#fff; font-size:10px; padding:3px 7px; border-radius:4px; font-family:var(--font-mono);
    }
    .bld-preview-img-badge--blue { background:rgba(0,119,255,0.8); }
    .bld-preview-step-info {
      display:flex; align-items:center; gap:8px;
      padding:8px 14px; border-top:1px solid var(--ps-border); flex-shrink:0;
      background:var(--ps-bg-surface);
    }

    .bld-node-row {
      display:flex; align-items:center; gap:8px; padding:8px 12px 8px 8px;
      border-bottom:1px solid transparent; cursor:default; transition:all 100ms;
      user-select:none; border-left:3px solid transparent;
    }
    .bld-node-row:hover { background:var(--ps-bg-hover); }
    .bld-node-row.is-selected { background:var(--ps-blue-10); border-left-color:var(--ps-blue); }
    .bld-node-row.is-disabled { opacity:0.5; }
    .bld-node-row--header { border-bottom:none; margin-top:4px; }
    .bld-node-row:hover .bld-node-actions { opacity:1; }
    .bld-drag-handle { cursor:grab; padding:0; }
    .bld-drag-handle:active { cursor:grabbing; }
    .bld-node-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .bld-node-actions { display:flex; gap:2px; opacity:0; transition:opacity 120ms; margin-left:auto; flex-shrink:0; }
    .bld-node-dragging { opacity:0.4; }
    .bld-node-drag-over { border-top:2px solid var(--ps-blue); }

    /* Add modal */
    .bld-modal-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:200;
      display:flex; align-items:center; justify-content:center;
    }
    .bld-modal {
      background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:14px;
      width:640px; max-height:80vh; display:flex; flex-direction:column; overflow:hidden;
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
    }
    .bld-modal-header { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .bld-modal-title { font-size:15px; font-weight:600; }
    .bld-add-body { flex:1; overflow-y:auto; padding:12px 16px; }
    .bld-add-section { margin-bottom:16px; }
    .bld-add-cat { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; }
    .bld-add-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:6px; }
    .bld-add-item {
      display:flex; flex-direction:column; align-items:center; gap:4px;
      padding:10px 8px; border-radius:8px; background:var(--ps-bg-app);
      border:1px solid var(--ps-border); cursor:pointer; font-family:var(--font-primary);
      transition:border-color 150ms, background 150ms; text-align:center;
    }
    .bld-add-item:hover { border-color:var(--ps-blue); background:var(--ps-bg-hover); }
    .bld-add-item-name { font-size:11px; color:var(--ps-text-muted); line-height:1.3; }
    .bld-modal-footer { display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--ps-border); flex-shrink:0; }
  `;
  document.head.appendChild(s);
}
