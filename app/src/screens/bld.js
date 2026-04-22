/**
 * ImageChef — BLD: Recipe Builder
 *
 * Edit recipe metadata, manage node list, add/reorder/delete nodes.
 * Autosaves after 5 s of inactivity; flush on navigate-away.
 * Accessed via #bld?id=<recipeId>
 */

import { getRecipe, saveRecipe, scheduleAutosave, flushAutosave, setRecipeThumbnail, clearRecipeThumbnail } from '../data/recipes.js';
import { getAllBlocks } from '../data/blocks.js';
import { navigate } from '../main.js';
import { showConfirm } from '../utils/dialogs.js';
import { uuid, now, deepClone } from '../utils/misc.js';
import { registry, ImageProcessor } from '../engine/index.js';
import { flattenNodes, countNodes, findNodeAndParent } from '../utils/nodes.js';
import { checkTransformAvailability } from '../engine/capabilities.js';
import { extractExif } from '../engine/exif-reader.js';
import { renderParamField } from '../utils/param-fields.js';
import { isVideoFile, extractVideoFrame } from '../utils/video-frame.js';
import { fileFilterForRecipe } from '../data/folders.js';

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

let bldCompareLayout = localStorage.getItem('ic-bld-cmp-mode') || 'slider';

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
      <a href="#hlp?id=${node.transformId}" class="bld-node-info-icon" style="margin-right:8px; display:inline-flex; text-decoration:none;" title="View Documentation for ${label}">
        <span class="material-symbols-outlined dropdown-toggle" style="font-size:16px;color:var(--ps-blue)">help</span>
      </a>
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

function buildParamRow(p, i) {
  const typeLabel = { text:'Text', number:'Number', range:'Range', select:'Select', boolean:'Toggle', color:'Color' }[p.type] || p.type;
  return `
    <div class="bld-param-row" data-idx="${i}">
      <span class="ic-badge" style="font-size:10px;font-family:var(--font-mono)">${escHtml(p.name)}</span>
      <span class="text-sm" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.label)}</span>
      <span class="text-sm text-muted">${typeLabel}</span>
      <button class="btn-icon bld-param-edit" data-idx="${i}" title="Edit">
        <span class="material-symbols-outlined" style="font-size:14px">edit</span>
      </button>
      <button class="btn-icon bld-param-delete" data-idx="${i}" title="Delete" style="color:var(--ps-red)">
        <span class="material-symbols-outlined" style="font-size:14px">delete</span>
      </button>
    </div>`;
}

function buildAddNodeModal(grouped, blocks = []) {
  const sections = Object.entries(grouped).map(([cat, transforms]) => {
    const { color } = Object.values(CAT_COLORS).find(e =>
      transforms.some(t => t.categoryKey === e.key)
    ) || { color: '#6b7280' };
    return `
      <div class="bld-add-section">
        <div class="bld-add-cat" style="color:${color}">${cat}</div>
        <div class="bld-add-grid">
          ${transforms.map(t => `
            <button class="bld-add-item" data-transform-id="${t.id}" style="position:relative;">
              <span class="material-symbols-outlined" style="font-size:18px;color:${color}">${t.icon || 'tune'}</span>
              <span class="bld-add-item-name">${t.name}</span>
            </button>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  const blockItems = blocks.length === 0
    ? `<div style="padding:6px 2px;color:var(--ps-text-muted);font-size:12px">No blocks yet. <a href="#bkb" style="color:var(--ps-blue)">Create a block →</a></div>`
    : `<div class="bld-add-grid">
        ${blocks.map(b => `
          <button class="bld-add-item bld-add-block-item" data-block-id="${escHtml(b.id)}" data-block-name="${escHtml(b.name)}">
            <span class="material-symbols-outlined" style="font-size:18px;color:#a855f7">widgets</span>
            <span class="bld-add-item-name">${escHtml(b.name)}</span>
            ${b.isSystem ? `<span class="ic-badge" style="font-size:9px;line-height:1;padding:1px 4px;margin-top:2px">sys</span>` : ''}
          </button>
        `).join('')}
      </div>`;

  return `
    <div id="bld-add-modal" class="bld-modal-overlay" style="display:none">
      <div class="bld-modal" style="width:1200px; max-width:95vw;">
        <div class="bld-modal-header">
          <span class="bld-modal-title">Add Step</span>
          <div class="flex items-center gap-2">
            <button class="btn-secondary is-active" id="bld-toggle-help-btn" style="margin-right:12px;font-size:12px;padding:4px 8px;gap:6px;transition:background 0.2s;background:var(--ps-blue);color:#fff;border-color:var(--ps-blue);">
               <span class="material-symbols-outlined" style="font-size:14px;">menu_book</span>
               Hide Help
            </button>
            <input type="text" id="bld-add-search" class="ic-input" placeholder="Search transforms & blocks…" style="width:220px" autocomplete="off">
            <button class="btn-icon" id="bld-add-close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div style="display:flex; flex:1; overflow:hidden;">
          <div style="flex:1; display:flex; flex-direction:column; min-width:300px;">
            <div class="bld-add-body" id="bld-add-sections">
              ${sections}
              <div class="bld-add-section bld-add-section--blocks">
                <div class="bld-add-cat" style="color:#a855f7">Blocks</div>
                ${blockItems}
              </div>
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
          <div id="bld-add-help-pane" style="display:flex; flex-direction:column; flex:1; border-left:1px solid var(--ps-border); background:var(--ps-bg-app); min-width:0; overflow:hidden; position:relative;">
            <div class="empty-state">Hover over a transformation to view its detailed documentation.</div>
          </div>
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

  // Sync state from storage
  bldCompareLayout = localStorage.getItem('ic-bld-cmp-mode') || 'slider';

  // Auto-expand config panel for brand-new recipes
  const isNew = draft.name === 'Untitled Recipe' && !draft.description && !draft.nodes?.length;
  let configOpen = isNew;

  function getFlatItems() {
    return flattenNodes(draft.nodes);
  }

  // Get grouped transforms + blocks for modal
  import('../../src/engine/index.js').catch(() => {});
  const grouped   = registry.getGrouped();
  const allBlocks = await getAllBlocks();
  allBlocks.sort((a, b) => {
    // System blocks first, then alphabetical
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

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
          <span id="bld-save-status" class="text-sm text-muted" style="margin-left:4px"></span>
        </div>
        <div class="bld-header-center">
          <span id="bld-header-name" class="bld-header-name">${escHtml(draft.name)}</span>
          <button class="btn-icon bld-config-toggle" id="bld-config-toggle" title="Edit recipe details" style="margin-left:4px">
            <span class="material-symbols-outlined" style="font-size:15px">edit</span>
          </button>
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
            <label class="ic-label">Thumbnail</label>
            <div id="bld-thumb-preview" style="width:100%;height:80px;border-radius:6px;border:1px solid var(--ps-border);background:var(--ps-bg-overlay);margin-bottom:6px;overflow:hidden;${draft.thumbnail ? `background-image:url(${draft.thumbnail});background-size:cover;background-position:center;` : ''}"></div>
            <div style="display:flex;gap:6px">
              <label class="btn-secondary" style="flex:1;justify-content:center;cursor:pointer;font-size:12px;">
                <span class="material-symbols-outlined" style="font-size:14px;margin-right:4px">upload</span>Browse
                <input type="file" id="bld-thumb-input" accept="image/*" style="display:none">
              </label>
              <button class="btn-ghost" id="bld-thumb-clear" style="font-size:12px;color:var(--ps-red);${draft.thumbnail ? '' : 'display:none'}">
                <span class="material-symbols-outlined" style="font-size:14px">delete</span>
              </button>
            </div>
            <div class="text-xs text-muted" style="margin-top:4px">
              <span class="material-symbols-outlined" style="font-size:11px;vertical-align:middle">content_paste</span>
              Paste image anywhere to set
            </div>

            <label class="ic-label" style="margin-top:12px">Name</label>
            <input type="text" id="bld-name" class="ic-input" value="${escHtml(draft.name)}" placeholder="Recipe name…">

            <label class="ic-label" style="margin-top:12px">Description</label>
            <textarea id="bld-desc" class="ic-input" rows="3" placeholder="What does this recipe do?">${escHtml(draft.description || '')}</textarea>

            <label class="ic-label" style="margin-top:12px; display:flex; align-items:center; gap:8px; cursor:pointer; color:var(--ps-text); font-weight:normal; text-transform:none; letter-spacing:0;">
              <input type="checkbox" id="bld-is-ordered" ${draft.isOrdered ? 'checked' : ''}>
              Enforce Sequence Ordering
            </label>

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

            <div style="display:flex;gap:12px;margin-top:16px">
              <div style="flex:1">
                <label class="ic-label">Min Items</label>
                <input type="number" id="bld-min-items" class="ic-input" value="${draft.minItems ?? ''}" placeholder="Any" min="1">
              </div>
              <div style="flex:1">
                <label class="ic-label">Max Items</label>
                <input type="number" id="bld-max-items" class="ic-input" value="${draft.maxItems ?? ''}" placeholder="Any" min="1">
              </div>
            </div>

            <div style="margin-top:12px">
              <label class="ic-label">Media Type</label>
              <select id="bld-input-type" class="ic-input">
                <option value="image" ${draft.inputType === 'image' || !draft.inputType ? 'selected' : ''}>Images Only</option>
                <option value="video" ${draft.inputType === 'video' ? 'selected' : ''}>Videos Only</option>
                <option value="any" ${draft.inputType === 'any' ? 'selected' : ''}>Images & Videos</option>
              </select>
            </div>

            <div style="margin-top:16px;border-top:1px solid var(--ps-border);padding-top:12px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span class="material-symbols-outlined" style="font-size:15px;color:var(--ps-blue)">tune</span>
                <span class="ic-label" style="margin-bottom:0">Run Parameters</span>
                <button class="btn-ghost" id="bld-add-param" style="margin-left:auto;font-size:11px;padding:2px 8px">
                  <span class="material-symbols-outlined" style="font-size:13px">add</span> Add
                </button>
              </div>
              <div id="bld-params-list" class="bld-params-list">
                ${(draft.params || []).length === 0
                  ? `<div class="text-sm text-muted" id="bld-params-empty">No parameters defined.</div>`
                  : (draft.params || []).map((p, i) => buildParamRow(p, i)).join('')}
              </div>
            </div>
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
        <div id="bld-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;border-left:1px solid var(--ps-border)">
        </div>
      </div>
    </div>

    ${buildAddNodeModal(grouped, allBlocks)}`;

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

  // ── Metadata panel — lazy, shared by bld-info-btn and iw-info-btn ────
  let _bldInfoPanel = null;
  async function getBldInfoPanel() {
    if (!_bldInfoPanel) {
      const { MetadataPanel } = await import('../components/metadata-panel.js');
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;top:0;right:0;height:100vh;z-index:200;';
      container.appendChild(host);
      const { getFolder } = await import('../data/folders.js');
      const inputHandle = await getFolder('input').catch(() => null);
      _bldInfoPanel = new MetadataPanel(host, { dirHandle: inputHandle, startHidden: true });
    }
    return _bldInfoPanel;
  }

  container.querySelector('#bld-info-btn')?.addEventListener('click', async () => {
    const testFile = window._icTestImage?.file;
    if (!testFile) {
      window.AuroraToast?.show({ variant: 'info', title: 'No test image selected yet' });
      return;
    }
    const panel = await getBldInfoPanel();
    if (panel.isVisible()) {
      panel.hide();
    } else {
      await panel.setFile(testFile);
      panel.show();
    }
  });

  const saveStatus = container.querySelector('#bld-save-status');

  // ── Unified Image Workspace ───────────────────────────────
  let bldPreviewNodeId = null;
  let bldCompareRef = 'original';

  const { ImageWorkspace } = await import('../components/image-workspace.js');
  const wsContainer = container.querySelector('#bld-workspace-container');

  const workspace = new ImageWorkspace(wsContainer, {
    fileFilter: fileFilterForRecipe(draft),
    customControlsHtml: `
      <div id="bld-cmp-ref-row" class="bld-cmp-ref-row" style="display:flex;gap:4px">
        <button class="bld-cmp-ref-btn is-active" data-ref="original">Original</button>
        <button class="bld-cmp-ref-btn" data-ref="prev">Prev Step</button>
      </div>
    `,
    onBindCustomControls: (cnt) => {
      cnt.querySelectorAll('.bld-cmp-ref-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          cnt.querySelectorAll('.bld-cmp-ref-btn').forEach(b => b.classList.remove('is-active'));
          e.currentTarget.classList.add('is-active');
          bldCompareRef = e.currentTarget.dataset.ref;
          workspace.triggerProcess();
        });
      });
    },
    onFilesChange: async (files, activeFile) => {
      window._icTestFolderFiles = files;
      window._icTestImage = { file: activeFile };
      // Live-update metadata panel if open; also refresh dirHandle in case folder changed
      if (_bldInfoPanel && activeFile) {
        const { getFolder } = await import('../data/folders.js');
        const inputHandle = await getFolder('input').catch(() => null);
        if (inputHandle) _bldInfoPanel.setDirHandle(inputHandle);
        if (_bldInfoPanel.isVisible()) _bldInfoPanel.setFile(activeFile);
      }
    },
    onInfo: async (file) => {
      const panel = await getBldInfoPanel();
      await panel.setFile(file);
      panel.show();
    },
    onRender: async (file) => {
      const url = URL.createObjectURL(file);
      const isVideo = isVideoFile(file);

      // For video files, extract a representative frame (~3s or 40% in) to use as
      // the canvas base image. For images, load normally.
      let imageSource;
      if (isVideo) {
        const frameCanvas = await extractVideoFrame(url);
        imageSource = frameCanvas;
      } else {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        imageSource = img;
      }

      const exif = await extractExif(file);

      // Load sidecar JSON (best-effort) so {{sidecar.*}} tokens resolve in the preview.
      let sidecar = null;
      try {
        const { getFolder }   = await import('../data/folders.js');
        const { readSidecar } = await import('../data/sidecar.js');
        const inputHandle = await getFolder('input').catch(() => null);
        if (inputHandle) sidecar = await readSidecar(inputHandle, file.name).catch(() => null);
      } catch { /* best-effort */ }

      const context = {
        filename: file.name, exif, meta: {}, sidecar, variables: new Map(),
        originalFile: file,   // needed by video transforms
        _previewMode: true,   // signals processor to use fast canvas path
      };

      window._icBldTargetExif = exif;
      window._icBldTargetContext = context;

      const proc = new ImageProcessor();
      const afterUrl = await proc.previewDataUrl(imageSource, draft.nodes, context, bldPreviewNodeId);
      window._icBldAfterUrl = afterUrl;

      const flat = flattenNodes(draft.nodes);
      const nodeEnt = flat.find(f => f.node.id === bldPreviewNodeId);
      const afterTitle = nodeEnt ? (nodeEnt.node.label || nodeEnt.node.transformId || nodeEnt.node.type) : 'All Steps';

      let beforeUrl = isVideo && imageSource
        ? (() => { const c = imageSource; const b = document.createElement('canvas'); b.width = c.width; b.height = c.height; b.getContext('2d').drawImage(c, 0, 0); return new Promise(r => b.toBlob(bl => r(URL.createObjectURL(bl)), 'image/jpeg', 0.9)); })()
        : Promise.resolve(URL.createObjectURL(file));
      beforeUrl = await beforeUrl;
      let beforeTitle = 'Original';

      if (bldCompareRef === 'prev') {
        const prevId = getPrevNodeId();
        if (prevId) {
          const proc2 = new ImageProcessor();
          const ctx2 = {
            filename: file.name, exif, meta: {}, sidecar, variables: new Map(),
            originalFile: file, _previewMode: true,
          };
          beforeUrl = await proc2.previewDataUrl(imageSource, draft.nodes, ctx2, prevId);
          const prevEnt = flat.find(f => f.node.id === prevId);
          beforeTitle = prevEnt ? (prevEnt.node.label || prevEnt.node.transformId || prevEnt.node.type) : 'Prev Step';
        }
      }

      URL.revokeObjectURL(url);
      return {
        beforeUrl,
        afterUrl,
        beforeLabel: beforeTitle,
        afterLabel: afterTitle,
        context
      };
    }
  });

  if (window._icTestFolderFiles && window._icTestFolderFiles.length > 0) {
    workspace.setFiles(window._icTestFolderFiles);
  } else if (window._icTestImage?.file) {
    workspace.setFiles([window._icTestImage.file]);
  }

  function getPrevNodeId() {
    const nodes = flattenNodes(draft.nodes).filter(i => !i.isBranchHeader);
    if (!bldPreviewNodeId) return nodes.length >= 2 ? nodes[nodes.length - 2].node.id : null;
    const idx = nodes.findIndex(i => i.node.id === bldPreviewNodeId);
    return idx > 0 ? nodes[idx - 1].node.id : null;
  }

  function scheduleBldPreview(delay = 400) {
    clearTimeout(window._icBldTimer);
    window._icBldTimer = setTimeout(() => workspace.triggerProcess(), delay);
  }

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

      // Async pass: add amber warning icon to rows whose transform has unmet requirements
      (async () => {
        for (const item of items) {
          if (item.node.type !== 'transform' || !item.node.transformId) continue;
          const { available, unmet } = await checkTransformAvailability(item.node.transformId);
          if (available) continue;
          const row = listEl.querySelector(`.bld-node-row[data-id="${item.node.id}"]`);
          if (!row || row.querySelector('.bld-req-warn')) continue;
          const tip = unmet.map(r => r.label).join(', ');
          row.insertAdjacentHTML('beforeend',
            `<span class="material-symbols-outlined bld-req-warn" title="Needs setup: ${tip}"` +
            ` style="font-size:14px;color:var(--ps-warning,#f59e0b);flex-shrink:0;margin-left:2px;cursor:default">warning</span>`);
        }
      })();
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

  container.querySelector('#bld-is-ordered')?.addEventListener('change', e => {
    draft.isOrdered = e.target.checked;
    markDirty();
  });

  // ── Tags ──────────────────────────────────────────────────
  container.querySelector('#bld-tags')?.addEventListener('input', e => {
    draft.tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
    markDirty();
  });

  // ── Limits ────────────────────────────────────────────────
  container.querySelector('#bld-min-items')?.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    draft.minItems = isNaN(val) ? null : val;
    markDirty();
  });
  
  container.querySelector('#bld-max-items')?.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    draft.maxItems = isNaN(val) ? null : val;
    markDirty();
  });

  // ── Media Type ────────────────────────────────────────────
  container.querySelector('#bld-input-type')?.addEventListener('change', e => {
    draft.inputType = e.target.value;
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

  // ── Thumbnail picker ──────────────────────────────────────
  container.querySelector('#bld-thumb-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const preview = container.querySelector('#bld-thumb-preview');
      const paintPreview = (url) => {
        if (!preview) return;
        preview.style.backgroundImage = `url(${url})`;
        preview.style.backgroundSize = 'cover';
        preview.style.backgroundPosition = 'center';
      };
      // Progressive render: show the instant baseline crop first so the UI
      // doesn't stall while the (optional) smart crop runs inference.
      await setRecipeThumbnail(draft.id, file, { onBaseline: paintPreview });
      const saved = await getRecipe(draft.id);
      draft.thumbnail = saved.thumbnail;
      paintPreview(draft.thumbnail);
      const clearBtn = container.querySelector('#bld-thumb-clear');
      if (clearBtn) clearBtn.style.display = '';
    } catch (err) {
      console.error('Failed to set thumbnail:', err);
    }
    e.target.value = '';
  });

  container.querySelector('#bld-thumb-clear')?.addEventListener('click', async () => {
    await clearRecipeThumbnail(draft.id);
    draft.thumbnail = null;
    const preview = container.querySelector('#bld-thumb-preview');
    if (preview) {
      preview.style.backgroundImage = '';
    }
    const clearBtn = container.querySelector('#bld-thumb-clear');
    if (clearBtn) clearBtn.style.display = 'none';
  });

  // ── Add node modal ────────────────────────────────────────
  const addModal = container.querySelector('#bld-add-modal');
  const addSearch = container.querySelector('#bld-add-search');

  let _pickerAnnotated = false;
  container.querySelector('#bld-btn-add-node')?.addEventListener('click', () => {
    if (addModal) { addModal.style.display = 'flex'; addSearch?.focus(); }
    // On first open, annotate tiles whose transforms have unmet requirements
    if (!_pickerAnnotated && addModal) {
      _pickerAnnotated = true;
      (async () => {
        const tiles = addModal.querySelectorAll('.bld-add-item[data-transform-id]');
        for (const tile of tiles) {
          const id = tile.dataset.transformId;
          const { available, unmet } = await checkTransformAvailability(id);
          if (available) continue;
          const tip = unmet.map(r => r.label).join(', ');
          tile.classList.add('bld-add-item--needs-setup');
          tile.title = `Needs setup: ${tip}`;
          tile.insertAdjacentHTML('beforeend',
            `<span class="material-symbols-outlined bld-add-warn" title="Needs setup: ${tip}"` +
            ` style="position:absolute;top:3px;right:3px;font-size:12px;color:var(--ps-warning,#f59e0b)">warning</span>`);
        }
      })();
    }
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
  container.querySelectorAll('.bld-add-item:not(.bld-add-block-item)').forEach(btn => {
    btn.addEventListener('click', e => {
      if (e.target.closest('.bld-inline-help-btn')) return; // Ignore help clicks
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

  // Hover-driven Help Pane Flow
  let isHelpPaneOpen = true;
  let currentHelpRenderId = null;
  let helpHoverTimeout = null;

  const bldToggleHelpBtn = container.querySelector('#bld-toggle-help-btn');
  const modalBox = container.querySelector('.bld-modal');
  const helpPane = container.querySelector('#bld-add-help-pane');

  bldToggleHelpBtn?.addEventListener('click', () => {
    isHelpPaneOpen = !isHelpPaneOpen;
    bldToggleHelpBtn.innerHTML = isHelpPaneOpen 
      ? `<span class="material-symbols-outlined" style="font-size:14px;">menu_book</span> Hide Help`
      : `<span class="material-symbols-outlined" style="font-size:14px;">menu_book</span> Show Help`;

    if (isHelpPaneOpen) {
      bldToggleHelpBtn.classList.add('is-active');
      bldToggleHelpBtn.style.background = 'var(--ps-blue)';
      bldToggleHelpBtn.style.color = '#fff';
      bldToggleHelpBtn.style.borderColor = 'var(--ps-blue)';
      modalBox.style.width = '1200px';
      modalBox.style.maxWidth = '95vw';
      helpPane.style.display = 'flex';
      helpPane.style.flexDirection = 'column';
      
      // Default placeholder if nothing hovered yet
      if (!currentHelpRenderId) {
         helpPane.innerHTML = `<div class="empty-state">Hover over a transformation to view its detailed documentation.</div>`;
      }
    } else {
      bldToggleHelpBtn.classList.remove('is-active');
      bldToggleHelpBtn.style.background = '';
      bldToggleHelpBtn.style.color = '';
      bldToggleHelpBtn.style.borderColor = '';
      modalBox.style.width = '';
      modalBox.style.maxWidth = '';
      helpPane.style.display = 'none';
    }
  });

  container.querySelectorAll('.bld-add-item').forEach(btn => {
    btn.addEventListener('mouseenter', e => {
      if (!isHelpPaneOpen) return;
      const helpId = btn.dataset.transformId || btn.dataset.blockId;
      if (currentHelpRenderId === helpId) return;

      clearTimeout(helpHoverTimeout);
      helpHoverTimeout = setTimeout(async () => {
        currentHelpRenderId = helpId;
        helpPane.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div class="spinner"></div></div>`;
        try {
           const hlpMod = await import('./hlp.js');
           await hlpMod.renderDetail(helpPane, helpId);
           const backBtn = helpPane.querySelector('#hlp-back');
           if (backBtn) backBtn.style.display = 'none';
        } catch(err) {
           console.error('Help Error:', err);
           helpPane.innerHTML = `<div class="empty-state">Failed to load Help module:<br/>${err.message}</div>`;
        }
      }, 100); // 100ms debounce to ignore fast sweeps
    });
  });

  // Add block-ref node
  container.querySelectorAll('.bld-add-block-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const node = {
        id:      uuid(),
        type:    'block-ref',
        blockId: btn.dataset.blockId,
        label:   btn.dataset.blockName,
      };
      insertAtSelection(node);
      refreshNodeList();
      markDirty();
      addModal.style.display = 'none';
      // No NED for blocks — they have no per-instance params
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

    // Edit → open NED for transforms, BKB for block-refs
    container.querySelectorAll('.bld-btn-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const info = findNodeAndParent(draft.nodes, id);
        if (info) {
          if (info.node.type === 'block-ref') navigate(`#bkb?id=${info.node.blockId}`);
          else navigate(`#ned?recipe=${draft.id}&node=${id}`);
        }
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
        if (info?.node.type === 'block-ref') {
          navigate(`#bkb?id=${info.node.blockId}`);
        } else if (info?.node.type === 'transform') {
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
    const controls = container.querySelector('#bld-cmp-controls');
    btn?.classList.toggle('is-active', bldCompareMode);
    if (controls) controls.style.display = bldCompareMode ? 'flex' : 'none';
    scheduleBldPreview(0);
  });

  // Layout toggle buttons
  container.querySelectorAll('.bld-cmp-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bldCompareLayout = btn.dataset.layout;
      localStorage.setItem('ic-bld-cmp-mode', bldCompareLayout);
      container.querySelectorAll('.bld-cmp-mode-btn').forEach(b => b.classList.toggle('is-active', b === btn));
      if (bldCompareMode) scheduleBldPreview(0);
    });
  });

  container.querySelectorAll('.bld-cmp-ref-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bldCompareRef = btn.dataset.ref;
      container.querySelectorAll('.bld-cmp-ref-btn').forEach(b => b.classList.toggle('is-active', b.dataset.ref === bldCompareRef));
      if (bldCompareMode) scheduleBldPreview(0);
    });
  });

  bindNodeActions();

  // ── Run params management ─────────────────────────────────
  function refreshParamsList() {
    const list = container.querySelector('#bld-params-list');
    if (!list) return;
    if (!(draft.params || []).length) {
      list.innerHTML = `<div class="text-sm text-muted" id="bld-params-empty">No parameters defined.</div>`;
    } else {
      list.innerHTML = (draft.params || []).map((p, i) => buildParamRow(p, i)).join('');
    }
    bindParamActions();
  }

  function bindParamActions() {
    container.querySelectorAll('.bld-param-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx, 10);
        draft.params = (draft.params || []).filter((_, i) => i !== idx);
        refreshParamsList();
        markDirty();
      });
    });
    container.querySelectorAll('.bld-param-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        showParamEditor((draft.params || [])[idx], idx);
      });
    });
  }

  function showParamEditor(existing, editIdx) {
    const p = existing ? { ...existing } : { name: '', label: '', type: 'text', defaultValue: '' };
    const isNew = editIdx == null;

    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    dlg.innerHTML = `
      <div class="modal__header">
        <h2 class="modal__title">${isNew ? 'Add' : 'Edit'} Parameter</h2>
      </div>
      <div class="modal__body" style="padding:16px;min-width:320px;display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="ic-label">Machine Name <span class="text-muted">(used in {{recipe.xxx}})</span></label>
          <input type="text" id="pe-name" class="ic-input" value="${escHtml(p.name)}" placeholder="e.g. overlap">
        </div>
        <div>
          <label class="ic-label">Label</label>
          <input type="text" id="pe-label" class="ic-input" value="${escHtml(p.label)}" placeholder="e.g. Overlap %">
        </div>
        <div>
          <label class="ic-label">Type</label>
          <select id="pe-type" class="ic-input">
            ${['text','number','range','select','boolean','color'].map(t =>
              `<option value="${t}" ${p.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div id="pe-extra"></div>
        <div>
          <label class="ic-label">Default Value</label>
          <input type="text" id="pe-default" class="ic-input" value="${escHtml(String(p.defaultValue ?? ''))}">
        </div>
      </div>
      <div class="modal__footer" style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--ps-border)">
        <button class="btn-secondary" id="pe-cancel">Cancel</button>
        <button class="btn-primary" id="pe-save">Save</button>
      </div>`;

    function updateExtra() {
      const type = dlg.querySelector('#pe-type').value;
      const extra = dlg.querySelector('#pe-extra');
      if (type === 'range' || type === 'number') {
        extra.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><label class="ic-label">Min</label><input type="number" id="pe-min" class="ic-input" value="${escHtml(String(p.min??''))}"></div>
            <div><label class="ic-label">Max</label><input type="number" id="pe-max" class="ic-input" value="${escHtml(String(p.max??''))}"></div>
          </div>`;
      } else if (type === 'select') {
        const opts = (p.options||[]).map(o=>`${o.label}:${o.value}`).join(', ');
        extra.innerHTML = `
          <div><label class="ic-label">Options <span class="text-muted">(Label:value, comma-separated)</span></label>
          <input type="text" id="pe-options" class="ic-input" value="${escHtml(opts)}" placeholder="GIF:gif, MP4:mp4"></div>`;
      } else {
        extra.innerHTML = '';
      }
    }

    document.body.appendChild(dlg);
    dlg.showModal();
    updateExtra();
    dlg.querySelector('#pe-type').addEventListener('change', updateExtra);

    dlg.querySelector('#pe-cancel').addEventListener('click', () => { dlg.close(); dlg.remove(); });
    dlg.querySelector('#pe-save').addEventListener('click', () => {
      const name  = dlg.querySelector('#pe-name').value.trim().replace(/\s+/g,'_');
      const label = dlg.querySelector('#pe-label').value.trim();
      const type  = dlg.querySelector('#pe-type').value;
      if (!name || !label) return;

      const entry = { name, label, type, defaultValue: dlg.querySelector('#pe-default').value };
      const minEl = dlg.querySelector('#pe-min');
      const maxEl = dlg.querySelector('#pe-max');
      if (minEl && minEl.value !== '') entry.min = parseFloat(minEl.value);
      if (maxEl && maxEl.value !== '') entry.max = parseFloat(maxEl.value);
      if (type === 'range' || type === 'number') entry.defaultValue = parseFloat(entry.defaultValue) || 0;
      if (type === 'boolean') entry.defaultValue = entry.defaultValue === 'true';
      const optsEl = dlg.querySelector('#pe-options');
      if (optsEl) {
        entry.options = optsEl.value.split(',').map(s => {
          const [label, value] = s.split(':').map(x => x.trim());
          return { label: label || value, value: value || label };
        }).filter(o => o.value);
      }

      if (!draft.params) draft.params = [];
      if (isNew) draft.params.push(entry);
      else draft.params[editIdx] = entry;

      refreshParamsList();
      markDirty();
      dlg.close(); dlg.remove();
    });
    dlg.addEventListener('cancel', () => { dlg.remove(); });
  }

  container.querySelector('#bld-add-param')?.addEventListener('click', () => showParamEditor(null, null));
  bindParamActions();

  // ── Paste Logic ───────────────────────────────────────────
  const onPaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          try {
            await setRecipeThumbnail(draft.id, file);
            const saved = await getRecipe(draft.id);
            draft.thumbnail = saved.thumbnail;
            const preview = container.querySelector('#bld-thumb-preview');
            if (preview) {
              preview.style.backgroundImage = `url(${draft.thumbnail})`;
              preview.style.backgroundSize = 'cover';
              preview.style.backgroundPosition = 'center';
            }
            const clearBtn = container.querySelector('#bld-thumb-clear');
            if (clearBtn) clearBtn.style.display = '';
            window.AuroraToast?.show({ variant: 'success', title: 'Recipe thumbnail updated from clipboard' });
          } catch (err) {
            console.error('Failed to set thumbnail via paste:', err);
          }
        }
      }
    }
  };
  window.addEventListener('paste', onPaste);

  // ── Cleanup: flush autosave & remove listener ──────────────
  return async () => {
    window.removeEventListener('paste', onPaste);
    await flushAutosave(draft);
  };
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
    .bld-header-center { justify-self:center; display:flex; align-items:center; gap:2px; overflow:hidden; max-width:360px; }
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
    .bld-cmp-mode-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:6px; overflow:hidden; }
    .bld-cmp-mode-btn {
      padding:4px 8px; font-size:11px; color:var(--ps-text-muted); border:none;
      background:transparent; cursor:pointer; font-family:var(--font-primary); transition:color 100ms, background 100ms;
      display:flex; align-items:center; justify-content:center;
    }
    .bld-cmp-mode-btn.is-active { background:var(--ps-bg-surface); color:var(--ps-blue); }
    .bld-cmp-mode-btn:not(.is-active):hover { background:var(--ps-bg-hover); }

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

    /* Side by side view */
    .bld-cmp-side-view { display:flex; width:100%; height:100%; background:var(--ps-bg-app); }
    .bld-cmp-side { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
    .bld-cmp-side-img { width:100%; height:100%; object-fit:contain; display:block; }
    .bld-cmp-divider { width:1px; background:var(--ps-border); flex-shrink:0; }
    .bld-cmp-side-label {
      position:absolute; top:8px; left:8px; z-index:5;
      background:rgba(0,0,0,0.7); color:#fff; font-size:10px; padding:3px 7px; border-radius:4px; font-family:var(--font-mono);
    }
    .bld-cmp-side-label--blue { background:rgba(0,119,255,0.8); }

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
    .bld-params-list { display:flex; flex-direction:column; gap:4px; }
    .bld-param-row { display:flex; align-items:center; gap:6px; padding:5px 6px; border-radius:6px; background:var(--ps-bg-raised); }

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
      position:relative;
    }
    .bld-add-item:hover { border-color:var(--ps-blue); background:var(--ps-bg-hover); }
    .bld-add-item--needs-setup { border-color:var(--ps-warning,#f59e0b); }
    .bld-add-item-name { font-size:11px; color:var(--ps-text-muted); line-height:1.3; }
    .bld-modal-footer { display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--ps-border); flex-shrink:0; }
  `;
  document.head.appendChild(s);
}
