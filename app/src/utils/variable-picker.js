/**
 * PicMachina — Variable Picker Modal
 *
 * Opens a modal listing every {{variable}} token the user could insert into
 * the current input, grouped by source (Built-in, Recipe Vars, File EXIF,
 * Sidecar, Meta). When a file context is provided, each row also shows the
 * current resolved value so users don't have to guess.
 *
 * Multiple tokens can be selected at once; clicking Insert writes them into
 * the target input at the current cursor position (or replacing the selection).
 *
 * Usage:
 *   import { openVariablePicker } from '../utils/variable-picker.js';
 *   openVariablePicker(inputEl, { getVarContext: () => ({...}) });
 */

import { interpolate } from './variables.js';
import { SIDECAR_SCHEMA_KEYS } from '../data/sidecar.js';

// ── Built-in tokens that aren't derived from a data source ───
const BUILTIN_TOKENS = [
  { token: 'filename', desc: 'Base filename (no extension)' },
  { token: 'ext',      desc: 'File extension (no dot)' },
  { token: 'br',       desc: 'Newline (line break)' },
];

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    .vp-backdrop {
      position:fixed; inset:0; background:rgba(0,0,0,0.55);
      z-index:10000; display:flex; align-items:center; justify-content:center;
    }
    .vp-modal {
      background:var(--ps-bg-panel,#1a1a2e); color:var(--ps-text,#fff);
      border:1px solid var(--ps-border,#333); border-radius:10px;
      width:min(620px, 92vw); max-height:80vh; display:flex; flex-direction:column;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
    }
    .vp-header {
      padding:14px 18px; border-bottom:1px solid var(--ps-border,#333);
      display:flex; align-items:center; gap:10px;
    }
    .vp-title { font-size:15px; font-weight:600; flex:1; }
    .vp-close {
      background:none; border:none; color:var(--ps-text-muted,#888);
      cursor:pointer; padding:4px; border-radius:4px;
    }
    .vp-close:hover { background:var(--ps-bg-overlay,#222); color:var(--ps-text,#fff); }
    .vp-search {
      padding:10px 14px; border-bottom:1px solid var(--ps-border,#333);
    }
    .vp-search input {
      width:100%; padding:8px 10px; background:var(--ps-bg-app,#0e0e1a);
      border:1px solid var(--ps-border,#333); border-radius:6px;
      color:var(--ps-text,#fff); font-size:13px;
    }
    .vp-body { overflow-y:auto; flex:1; padding:4px 0; }
    .vp-group-title {
      font-size:11px; font-weight:600; text-transform:uppercase;
      letter-spacing:0.5px; color:var(--ps-text-muted,#888);
      padding:10px 18px 4px; position:sticky; top:0;
      background:var(--ps-bg-panel,#1a1a2e);
    }
    .vp-row {
      display:flex; align-items:center; gap:10px; padding:7px 18px;
      cursor:pointer; border-left:2px solid transparent;
    }
    .vp-row:hover { background:var(--ps-bg-overlay,#222); }
    .vp-row.vp-selected { background:rgba(59,130,246,0.12); border-left-color:var(--ps-blue,#3b82f6); }
    .vp-row input[type=checkbox] { accent-color:var(--ps-blue,#3b82f6); }
    .vp-token {
      font-family:var(--font-mono,monospace); font-size:12px;
      color:var(--ps-blue,#3b82f6); flex-shrink:0;
    }
    .vp-value {
      font-size:12px; color:var(--ps-text-muted,#888); flex:1;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      text-align:right; padding-left:12px;
    }
    .vp-value.vp-empty { font-style:italic; opacity:0.6; }
    .vp-desc {
      font-size:11px; color:var(--ps-text-muted,#888); flex:1;
      padding-left:4px;
    }
    .vp-footer {
      padding:12px 18px; border-top:1px solid var(--ps-border,#333);
      display:flex; align-items:center; gap:10px;
    }
    .vp-count { font-size:12px; color:var(--ps-text-muted,#888); flex:1; }
    .vp-btn {
      padding:7px 14px; border-radius:6px; font-size:13px; cursor:pointer;
      border:1px solid var(--ps-border,#333); background:var(--ps-bg-overlay,#222);
      color:var(--ps-text,#fff);
    }
    .vp-btn:hover { background:var(--ps-bg-app,#0e0e1a); }
    .vp-btn--primary {
      background:var(--ps-blue,#3b82f6); border-color:var(--ps-blue,#3b82f6); color:#fff;
    }
    .vp-btn--primary:hover { filter:brightness(1.1); }
    .vp-btn--primary:disabled { opacity:0.5; cursor:not-allowed; }
    .vp-empty-state {
      padding:24px 18px; text-align:center;
      color:var(--ps-text-muted,#888); font-size:13px;
    }
  `;
  document.head.appendChild(s);
}

/**
 * Build the grouped list of available variables for the current context.
 * Returns array of { title, items: [{ token, value?, desc? }] }.
 */
function buildVariableGroups(ctx = {}) {
  const groups = [];

  // ── Built-ins ──
  const builtins = BUILTIN_TOKENS.map(({ token, desc }) => {
    const resolved = ctx.filename != null ? interpolate(`{{${token}}}`, ctx) : null;
    return { token, desc, value: resolved };
  });
  groups.push({ title: 'Built-in', items: builtins });

  // ── Recipe Vars ──
  const recipeVars = (ctx.recipeVars || []).map(name => ({
    token: `recipe.${name}`,
    value: ctx.recipe?.[name] != null ? String(ctx.recipe[name]) : null,
  }));
  if (recipeVars.length) groups.push({ title: 'Recipe Variables', items: recipeVars });

  // ── EXIF (from actual file) ──
  if (ctx.exif && typeof ctx.exif === 'object') {
    const exifItems = [];
    for (const [k, v] of Object.entries(ctx.exif)) {
      if (v == null || typeof v === 'object') continue; // skip nested (gps, etc.)
      exifItems.push({ token: `exif.${k}`, value: String(v) });
    }
    // Common nested convenience keys if present
    if (ctx.exif.gps?.lat != null) exifItems.push({ token: 'exif.gps.lat', value: String(ctx.exif.gps.lat) });
    if (ctx.exif.gps?.lng != null) exifItems.push({ token: 'exif.gps.lng', value: String(ctx.exif.gps.lng) });
    if (exifItems.length) groups.push({ title: 'EXIF (this file)', items: exifItems });
  }

  // ── Meta ──
  if (ctx.meta && typeof ctx.meta === 'object') {
    const metaItems = Object.entries(ctx.meta)
      .filter(([, v]) => v != null && typeof v !== 'object')
      .map(([k, v]) => ({ token: `meta.${k}`, value: String(v) }));
    if (metaItems.length) groups.push({ title: 'Metadata', items: metaItems });
  }

  // ── Sidecar ──
  const sidecarItems = SIDECAR_SCHEMA_KEYS.map(fullKey => {
    // fullKey looks like "sidecar.geo.city"
    let resolved = null;
    if (ctx.sidecar) {
      resolved = interpolate(`{{${fullKey}}}`, ctx);
      // interpolate returns the original token on miss — detect that
      if (resolved === `{{${fullKey}}}`) resolved = null;
    }
    return { token: fullKey.replace(/^sidecar\./, 'sidecar.'), fullToken: fullKey, value: resolved };
  });
  groups.push({ title: 'Sidecar Fields', items: sidecarItems });

  return groups;
}

/**
 * Insert one or more {{tokens}} at the cursor position of the target input.
 * Falls back to appending if selection state isn't available.
 */
function insertAtCursor(input, tokens) {
  if (!input) return;
  const insertion = tokens.map(t => `{{${t}}}`).join('');
  const start = input.selectionStart ?? input.value.length;
  const end   = input.selectionEnd   ?? input.value.length;
  const before = input.value.slice(0, start);
  const after  = input.value.slice(end);
  input.value = before + insertion + after;
  // Restore cursor right after the inserted text
  const caret = start + insertion.length;
  try { input.setSelectionRange(caret, caret); } catch { /* non-text elements */ }
  input.dispatchEvent(new Event('input',  { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.focus();
}

/**
 * Open the variable picker modal bound to the given input element.
 * @param {HTMLInputElement|HTMLTextAreaElement} input
 * @param {object} [opts]
 * @param {() => object} [opts.getVarContext]  — returns { filename, ext, exif, meta, sidecar, recipe, recipeVars }
 */
export function openVariablePicker(input, { getVarContext } = {}) {
  if (!input) return;
  injectStyles();

  // Capture cursor position before the modal steals focus
  const savedStart = input.selectionStart;
  const savedEnd   = input.selectionEnd;

  const ctx = (typeof getVarContext === 'function') ? (getVarContext() || {}) : {};
  const groups = buildVariableGroups(ctx);

  const backdrop = document.createElement('div');
  backdrop.className = 'vp-backdrop';
  backdrop.innerHTML = `
    <div class="vp-modal" role="dialog" aria-label="Insert variables">
      <div class="vp-header">
        <span class="material-symbols-outlined" style="color:var(--ps-blue)">data_object</span>
        <div class="vp-title">Insert Variables</div>
        <button type="button" class="vp-close" aria-label="Close">
          <span class="material-symbols-outlined" style="font-size:20px">close</span>
        </button>
      </div>
      <div class="vp-search">
        <input type="text" placeholder="Search variables..." autocomplete="off">
      </div>
      <div class="vp-body"></div>
      <div class="vp-footer">
        <div class="vp-count">0 selected</div>
        <button type="button" class="vp-btn vp-btn-cancel">Cancel</button>
        <button type="button" class="vp-btn vp-btn--primary vp-btn-insert" disabled>Insert</button>
      </div>
    </div>`;

  const body    = backdrop.querySelector('.vp-body');
  const search  = backdrop.querySelector('.vp-search input');
  const countEl = backdrop.querySelector('.vp-count');
  const btnIns  = backdrop.querySelector('.vp-btn-insert');
  const btnCan  = backdrop.querySelector('.vp-btn-cancel');
  const btnX    = backdrop.querySelector('.vp-close');

  // Render all groups
  for (const grp of groups) {
    if (!grp.items.length) continue;
    const h = document.createElement('div');
    h.className = 'vp-group-title';
    h.textContent = grp.title;
    body.appendChild(h);
    for (const item of grp.items) {
      const token = item.fullToken || item.token;
      const row = document.createElement('label');
      row.className = 'vp-row';
      row.dataset.token = token;
      const valueHtml = item.value != null
        ? `<div class="vp-value" title="${esc(item.value)}">${esc(item.value)}</div>`
        : (item.desc
            ? `<div class="vp-desc">${esc(item.desc)}</div>`
            : `<div class="vp-value vp-empty">—</div>`);
      row.innerHTML = `
        <input type="checkbox">
        <div class="vp-token">{{${esc(token)}}}</div>
        ${valueHtml}`;
      body.appendChild(row);
    }
  }

  if (!body.children.length) {
    body.innerHTML = '<div class="vp-empty-state">No variables available in this context.</div>';
  }

  function updateCount() {
    const selected = body.querySelectorAll('.vp-row input[type=checkbox]:checked');
    countEl.textContent = `${selected.length} selected`;
    btnIns.disabled = selected.length === 0;
    // Update row highlight
    body.querySelectorAll('.vp-row').forEach(r => {
      const cb = r.querySelector('input[type=checkbox]');
      r.classList.toggle('vp-selected', !!cb?.checked);
    });
  }

  // Row click → toggle checkbox (label + checkbox combo handles this naturally,
  // but we also want single-click-insert on the token itself).
  body.addEventListener('change', (e) => {
    if (e.target.matches('input[type=checkbox]')) updateCount();
  });

  // Double-click a row to insert just that one and close
  body.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.vp-row');
    if (!row) return;
    insertAndClose([row.dataset.token]);
  });

  // Search filter
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const node of body.children) {
      if (node.classList.contains('vp-group-title')) continue;
      const token = node.dataset.token?.toLowerCase() || '';
      const value = node.querySelector('.vp-value, .vp-desc')?.textContent?.toLowerCase() || '';
      node.style.display = (!q || token.includes(q) || value.includes(q)) ? '' : 'none';
    }
    // Hide group titles whose members are all hidden
    let currentTitle = null, visibleInGroup = 0;
    for (const node of body.children) {
      if (node.classList.contains('vp-group-title')) {
        if (currentTitle) currentTitle.style.display = visibleInGroup ? '' : 'none';
        currentTitle = node;
        visibleInGroup = 0;
      } else if (node.style.display !== 'none') {
        visibleInGroup++;
      }
    }
    if (currentTitle) currentTitle.style.display = visibleInGroup ? '' : 'none';
  });

  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }

  function insertAndClose(tokens) {
    // Restore caret position if it was lost (input must be focused first)
    try {
      input.focus();
      if (savedStart != null && savedEnd != null) input.setSelectionRange(savedStart, savedEnd);
    } catch {}
    insertAtCursor(input, tokens);
    close();
  }

  btnIns.addEventListener('click', () => {
    const tokens = [...body.querySelectorAll('.vp-row input[type=checkbox]:checked')]
      .map(cb => cb.closest('.vp-row').dataset.token);
    insertAndClose(tokens);
  });
  btnCan.addEventListener('click', close);
  btnX.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && !btnIns.disabled && e.target === search) btnIns.click();
  }
  document.addEventListener('keydown', onKey);

  document.body.appendChild(backdrop);
  setTimeout(() => search.focus(), 0);
}
