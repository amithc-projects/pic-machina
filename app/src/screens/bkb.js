/**
 * ImageChef — BKB: Block Builder
 *
 * Create and edit reusable step blocks.
 * Blocks can be inserted into recipes as block-ref nodes.
 * Accessed via #bkb?id=<blockId> or #bkb (list view)
 */

import { getAllBlocks, getBlock, saveBlock, deleteBlock, cloneBlock } from '../data/blocks.js';
import { navigate } from '../main.js';
import { uuid, now, deepClone, formatDate } from '../utils/misc.js';
import { showConfirm } from '../utils/dialogs.js';
import { registry } from '../engine/index.js';
import { flattenNodes, countNodes, findNodeAndParent } from '../utils/nodes.js';
import { injectBldStyles } from './bld.js';

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Block list view ────────────────────────────────────────
async function renderList(container) {
  const blocks = await getAllBlocks();
  const systemBlocks = blocks.filter(b => b.isSystem).sort((a, b) => a.name.localeCompare(b.name));
  const userBlocks   = blocks.filter(b => !b.isSystem).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const systemSection = systemBlocks.length > 0 ? `
    <div class="bkb-section-header">System Blocks</div>
    <div class="bkb-grid">${systemBlocks.map(b => blockCardHTML(b)).join('')}</div>` : '';

  const userSection = userBlocks.length > 0 ? `
    <div class="bkb-section-header" style="margin-top:${systemBlocks.length ? '24px' : '0'}">My Blocks</div>
    <div class="bkb-grid">${userBlocks.map(b => blockCardHTML(b)).join('')}</div>` : '';

  // Empty state for the user-blocks section. The "+ New Block" button in
  // the screen header is the canonical entry point for creating a block —
  // we don't repeat it here to avoid two parallel CTAs.
  const emptyUser = userBlocks.length === 0 ? `
    <div class="empty-state" style="padding-top:${systemBlocks.length ? '32px' : '60px'}">
      <span class="material-symbols-outlined" style="font-size:${systemBlocks.length ? '32px' : '48px'}">add_box</span>
      <div class="empty-state-title">No custom blocks yet</div>
      <div class="empty-state-desc">Use <strong>+ New Block</strong> above to build a reusable step sequence, or clone a system block to customise it.</div>
    </div>` : '';

  container.innerHTML = `
    <div class="screen bkb-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">widgets</span>
          Block Builder
        </div>
        <button class="btn-primary" id="bkb-btn-new">
          <span class="material-symbols-outlined">add</span>
          New Block
        </button>
      </div>

      <div class="bkb-list-body">
        ${systemSection}
        ${userSection}
        ${emptyUser}
      </div>
    </div>`;

  injectBkbStyles();

  container.querySelector('#bkb-btn-new')?.addEventListener('click', () => createNew());

  container.querySelectorAll('.bkb-card-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); navigate(`#bkb?id=${btn.dataset.id}`); });
  });
  container.querySelectorAll('.bkb-card-clone').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const c = await cloneBlock(btn.dataset.id);
      window.AuroraToast?.show({ variant: 'success', title: `"${c.name}" cloned` });
      navigate(`#bkb?id=${c.id}`);
    });
  });
  container.querySelectorAll('.bkb-card-delete').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const confirmed = await showConfirm({
        title: 'Delete Block?',
        body: 'This will permanently remove this reusable block. It will be removed from any recipes that currently reference it.',
        confirmText: 'Delete',
        variant: 'danger',
        icon: 'delete_forever'
      });
      if (!confirmed) return;
      await deleteBlock(btn.dataset.id);
      window.AuroraToast?.show({ variant: 'success', title: 'Block deleted' });
      renderList(container); // re-render
    });
  });
  container.querySelectorAll('.bkb-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      navigate(`#bkb?id=${card.dataset.id}`);
    });
  });

  async function createNew() {
    const block = { id: uuid(), name: 'Untitled Block', description: '', category: 'General', nodes: [], createdAt: now(), updatedAt: now() };
    await saveBlock(block);
    navigate(`#bkb?id=${block.id}`);
  }
}

function blockCardHTML(block) {
  const updated = block.updatedAt ? formatDate(block.updatedAt) : '—';
  const iconColor = block.isSystem ? 'var(--ps-blue)' : '#a855f7';
  return `
    <article class="bkb-card" data-id="${block.id}" tabindex="0">
      <div class="bkb-card-icon">
        <span class="material-symbols-outlined" style="font-size:28px;color:${iconColor}">widgets</span>
      </div>
      <div class="bkb-card-body">
        <div class="bkb-card-name">
          ${escHtml(block.name)}
          ${block.isSystem ? `<span class="ic-badge ic-badge--blue" style="font-size:10px;margin-left:6px;vertical-align:middle">System</span>` : ''}
        </div>
        <div class="bkb-card-desc">${escHtml(block.description || '')}</div>
        <div class="bkb-card-meta">
          <span class="ic-badge">${escHtml(block.category || 'General')}</span>
          <span class="text-sm text-muted">${countNodes(block.nodes)} step${countNodes(block.nodes) !== 1 ? 's' : ''}</span>
          <span class="text-sm text-muted" style="margin-left:auto">${updated}</span>
        </div>
      </div>
      <div class="bkb-card-actions">
        <button class="btn-icon bkb-card-edit" data-id="${block.id}" title="${block.isSystem ? 'View' : 'Edit'}">
          <span class="material-symbols-outlined">${block.isSystem ? 'visibility' : 'edit'}</span>
        </button>
        <button class="btn-icon bkb-card-clone" data-id="${block.id}" title="Clone">
          <span class="material-symbols-outlined">content_copy</span>
        </button>
        ${!block.isSystem ? `<button class="btn-icon bkb-card-delete" data-id="${block.id}" title="Delete">
          <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
        </button>` : ''}
      </div>
    </article>`;
}

// ── Block editor view ──────────────────────────────────────
async function renderEditor(container, blockId) {
  const block = await getBlock(blockId);
  if (!block) { navigate('#bkb'); return; }

  // System blocks are read-only — show a summary and offer clone
  if (block.isSystem) {
    container.innerHTML = `
      <div class="screen bkb-screen">
        <div class="screen-header">
          <div class="flex items-center gap-2">
            <button class="btn-icon" id="bkb-back">
              <span class="material-symbols-outlined">arrow_back</span>
            </button>
            <div class="screen-title">
              <span class="material-symbols-outlined">widgets</span>
              ${escHtml(block.name)}
            </div>
            <span class="ic-badge ic-badge--blue" style="font-size:11px">System</span>
          </div>
          <button class="btn-primary" id="bkb-clone-system">
            <span class="material-symbols-outlined">content_copy</span>
            Clone to Edit
          </button>
        </div>
        <div class="bkb-readonly-body">
          <div class="bkb-readonly-info">
            <div class="text-sm text-muted" style="margin-bottom:8px">${escHtml(block.description || '')}</div>
            <div class="flex items-center gap-2" style="margin-bottom:16px">
              <span class="ic-badge">${escHtml(block.category || 'General')}</span>
              <span class="text-sm text-muted">${countNodes(block.nodes)} step${countNodes(block.nodes) !== 1 ? 's' : ''}</span>
            </div>
            <div class="bkb-readonly-notice">
              <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-blue)">lock</span>
              System blocks are read-only. Clone this block to create your own editable copy.
            </div>
          </div>
          <div class="bld-node-list bkb-readonly-nodes">
            ${renderNodeList(block.nodes)}
          </div>
        </div>
      </div>`;

    injectBkbStyles();
    container.querySelector('#bkb-back')?.addEventListener('click', () => navigate('#bkb'));
    container.querySelector('#bkb-clone-system')?.addEventListener('click', async () => {
      const clone = await cloneBlock(block.id);
      window.AuroraToast?.show({ variant: 'success', title: `"${clone.name}" created`, description: 'You can now edit this block.' });
      navigate(`#bkb?id=${clone.id}`);
    });
    return;
  }

  let draft = deepClone(block);

  const grouped = registry.getGrouped();

  container.innerHTML = `
    <div class="screen bkb-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="bkb-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">widgets</span>
            <span id="bkb-header-name">${escHtml(draft.name) || 'Untitled Block'}</span>
          </div>
          <span id="bkb-save-status" class="text-sm text-muted" style="margin-left:4px"></span>
        </div>
        <button class="btn-primary" id="bkb-save-btn">
          <span class="material-symbols-outlined">save</span>
          Save Block
        </button>
      </div>

      <div class="bld-body">
        <!-- Left: meta -->
        <div class="bld-config">
          <div class="bld-config-form">
            <label class="ic-label">Name</label>
            <input type="text" id="bkb-name" class="ic-input" value="${escHtml(draft.name)}">

            <label class="ic-label" style="margin-top:12px">Description</label>
            <textarea id="bkb-desc" class="ic-input" rows="3">${escHtml(draft.description || '')}</textarea>

            <label class="ic-label" style="margin-top:12px">Category</label>
            <input type="text" id="bkb-cat" class="ic-input" value="${escHtml(draft.category || 'General')}" placeholder="e.g. Color, Privacy…">
          </div>
        </div>

        <!-- Right: nodes -->
        <div class="bld-nodes-panel">
          <div class="bld-nodes-header">
            <span class="text-sm font-medium">Steps</span>
            <span id="bkb-count" class="text-sm text-muted">${draft.nodes.length} step${draft.nodes.length !== 1 ? 's' : ''}</span>
            <button class="btn-primary" id="bkb-add-node" style="margin-left:auto">
              <span class="material-symbols-outlined">add</span>
              Add Step
            </button>
          </div>
          <div id="bkb-node-list" class="bld-node-list">
            ${renderNodeList(draft.nodes)}
          </div>
        </div>
      </div>
    </div>

    <!-- Add step modal -->
    <div id="bkb-add-modal" class="bld-modal-overlay" style="display:none">
      <div class="bld-modal">
        <div class="bld-modal-header">
          <span class="bld-modal-title">Add Step</span>
          <button class="btn-icon" id="bkb-modal-close"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="bld-add-body">
          ${Object.entries(grouped).map(([cat, transforms]) => `
            <div class="bld-add-section">
              <div class="bld-add-cat">${cat}</div>
              <div class="bld-add-grid">
                ${transforms.map(t => `
                  <button class="bld-add-item" data-tid="${t.id}">
                    <span class="material-symbols-outlined" style="font-size:18px">${t.icon || 'tune'}</span>
                    <span class="bld-add-item-name">${t.name}</span>
                  </button>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  injectBkbStyles();

  const status = container.querySelector('#bkb-save-status');

  function markDirty() { if (status) status.textContent = 'Unsaved…'; }

  async function doSave() {
    draft.name        = container.querySelector('#bkb-name')?.value || draft.name;
    draft.description = container.querySelector('#bkb-desc')?.value || '';
    draft.category    = container.querySelector('#bkb-cat')?.value  || 'General';
    await saveBlock(draft);
    if (status) status.textContent = 'Saved';
    window.AuroraToast?.show({ variant: 'success', title: 'Block saved' });
  }

  container.querySelector('#bkb-back')?.addEventListener('click', async () => { await doSave(); navigate('#bkb'); });
  container.querySelector('#bkb-save-btn')?.addEventListener('click', doSave);

  // Mirror the name input back to the header title on every keystroke so
  // the user can see the rename land before they save.
  const nameInput  = container.querySelector('#bkb-name');
  const headerName = container.querySelector('#bkb-header-name');
  nameInput?.addEventListener('input', () => {
    markDirty();
    if (headerName) headerName.textContent = nameInput.value || 'Untitled Block';
  });
  container.querySelector('#bkb-desc')?.addEventListener('input', markDirty);
  container.querySelector('#bkb-cat')?.addEventListener('input', markDirty);

  const addModal = container.querySelector('#bkb-add-modal');
  container.querySelector('#bkb-add-node')?.addEventListener('click', () => { if (addModal) addModal.style.display = 'flex'; });
  container.querySelector('#bkb-modal-close')?.addEventListener('click', () => { if (addModal) addModal.style.display = 'none'; });
  addModal?.addEventListener('click', e => { if (e.target === addModal) addModal.style.display = 'none'; });

  container.querySelectorAll('.bld-add-item[data-tid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = btn.dataset.tid;
      const def = registry.get(tid);
      const params = {};
      (def?.params || []).forEach(p => { params[p.name] = p.defaultValue ?? ''; });
      draft.nodes.push({ id: uuid(), type: 'transform', transformId: tid, label: def?.name || tid, params });
      refreshNodes();
      markDirty();
      if (addModal) addModal.style.display = 'none';
    });
  });

  function refreshNodes() {
    const listEl  = container.querySelector('#bkb-node-list');
    const countEl = container.querySelector('#bkb-count');
    if (listEl) { listEl.innerHTML = renderNodeList(draft.nodes); bindNodeActions(); }
    const realCount = countNodes(draft.nodes);
    if (countEl) countEl.textContent = `${realCount} step${realCount !== 1 ? 's' : ''}`;
  }

  function bindNodeActions() {
    container.querySelectorAll('.bkb-del-node').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const confirmed = await showConfirm({
          title: 'Remove Step?',
          body: 'This will remove the selected transformation from the block.',
          confirmText: 'Remove',
          variant: 'danger',
          icon: 'delete_sweep'
        });
        if (!confirmed) return;
        const info = findNodeAndParent(draft.nodes, id);
        if (info) {
          info.parent.splice(info.index, 1);
          refreshNodes();
          markDirty();
        }
      });
    });
  }

  bindNodeActions();
}

function renderNodeList(nodes) {
  const items = flattenNodes(nodes);
  if (!items.length) return `<div class="empty-state" style="padding:32px">
    <span class="material-symbols-outlined">account_tree</span>
    <div class="empty-state-title">No steps yet</div></div>`;

  return items.map(item => {
    const { node, depth, isBranchHeader } = item;
    if (isBranchHeader) {
      return `
        <div class="bld-node-row bld-node-row--header" style="padding-left:${12 + depth * 16}px">
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-text-faint)">subdirectory_arrow_right</span>
          <span class="bld-node-label" style="font-style:italic;font-size:11px;color:var(--ps-text-faint)">${node.label}</span>
        </div>`;
    }

    const def = registry.get(node.transformId);
    const label = node.label || def?.name || node.type;
    return `
      <div class="bld-node-row" style="padding-left:${8 + depth * 16}px">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-blue)">${def?.icon || 'tune'}</span>
        <span style="flex:1;font-size:13px">${label}</span>
        <button class="btn-icon bkb-del-node" data-id="${node.id}" title="Remove">
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-red)">delete</span>
        </button>
      </div>`;
  }).join('');
}

// ── Entry point ────────────────────────────────────────────
export async function render(container, hash) {
  const params  = new URLSearchParams((hash.split('?')[1] || ''));
  const blockId = params.get('id');
  if (blockId) {
    await renderEditor(container, blockId);
  } else {
    await renderList(container);
  }
}

let _bkbStyles = false;
function injectBkbStyles() {
  // The Block Builder reuses the recipe builder's `.bld-*` classes for
  // its layout (.bld-body, .bld-config, .bld-nodes-panel), node list
  // (.bld-node-row), and Add Step modal (.bld-modal-overlay, .bld-add-*).
  // Pull them in so going straight to #bkb without first visiting #bld
  // still produces a styled screen with a working modal.
  injectBldStyles();
  if (_bkbStyles) return;
  _bkbStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .bkb-screen { display:flex; flex-direction:column; height:100%; }
    .bkb-list-body { flex:1; overflow-y:auto; padding:20px; }
    .bkb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; }
    .bkb-card {
      background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:10px;
      display:flex; align-items:center; gap:12px; padding:14px;
      cursor:pointer; transition:border-color 150ms, box-shadow 150ms;
    }
    .bkb-card:hover { border-color:var(--ps-blue); box-shadow:0 4px 16px rgba(0,119,255,0.1); }
    .bkb-card-icon { width:48px; height:48px; border-radius:10px; background:rgba(0,119,255,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .bkb-card-body { flex:1; overflow:hidden; }
    .bkb-card-name { font-size:14px; font-weight:600; margin-bottom:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .bkb-card-desc { font-size:12px; color:var(--ps-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:6px; }
    .bkb-card-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .bkb-card-actions { display:flex; gap:4px; flex-shrink:0; }

    /* Section headers */
    .bkb-section-header { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--ps-text-muted); padding:4px 0 8px; }

    /* Read-only system block view */
    .bkb-readonly-body { display:flex; flex-direction:column; gap:16px; padding:20px 24px; overflow:auto; flex:1; }
    .bkb-readonly-info { max-width:600px; }
    .bkb-readonly-notice { display:flex; align-items:center; gap:8px; background:rgba(0,119,255,0.08); border:1px solid rgba(0,119,255,0.2); border-radius:8px; padding:10px 14px; font-size:12px; color:var(--ps-text-muted); }
    .bkb-readonly-nodes { max-width:600px; pointer-events:none; opacity:0.75; }
  `;
  document.head.appendChild(s);
}
