/**
 * ImageChef — MetadataPanel
 *
 * Unified persistent right-side panel showing ALL metadata for an image.
 *
 * Panel structure
 * ───────────────
 * [Editable]          rating · flag · content-rating · title · tags ·
 *                     usage scenarios · caption · location
 * [AI Analysis]  L1   generatedBy/at badge · segmentation summary
 *   Colour Palette  L2  hex swatches — dominant / secondary / accent
 *   AI Tags         L2  chips with one-click "promote to my tags"
 *   Scene           L2  locationType, timeOfDay, season, weather …
 *   Subjects        L2  count + per-person detail (hidden when 0)
 *   Composition     L2  combined with Lighting
 *   Identified Loc  L2  landmark detail (hidden when absent)
 *   Architecture    L2  building analysis (hidden when absent)
 *   Gen. Prompts    L2  short / detailed / negative + copy buttons
 *   DAM Notes       L2  contentSensitivity, releases, limitations
 *   Computed        L2  scalar values from Pic-Machina transforms
 *   Vision (legacy) L2  asset-panel extracted data (fallback)
 * [File, Camera & EXIF]  L1 (async)
 * [Processing Log]       L1
 *
 * Usage:
 *   const panel = new MetadataPanel(containerEl, { dirHandle, onSaved });
 *   await panel.setFile(file);
 *   panel.toggle();
 */

import {
  readSidecar, writeSidecar, listSidecarTags,
  reverseGeocode, buildSidecarPatch,
} from '../data/sidecar.js';
import { extractExif } from '../engine/exif-reader.js';

// ── Style injection ────────────────────────────────────────────────────────────

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    /* ── Shell ─────────────────────────────────────────────── */
    .mp-panel {
      display:flex; flex-direction:column;
      width:320px; min-width:320px; height:100%; overflow:hidden;
      border-left:1px solid var(--ps-border);
      background:var(--ps-bg-surface);
      transition:width 200ms ease, min-width 200ms ease;
      flex-shrink:0;
    }
    .mp-panel.mp-hidden { display:none; }
    .mp-panel.mp-collapsed { width:36px; min-width:36px; }
    .mp-panel.mp-collapsed .mp-body,
    .mp-panel.mp-collapsed .mp-footer { display:none; }
    .mp-panel.mp-collapsed .mp-header {
      flex-direction:column; padding:8px 0;
      justify-content:flex-start; align-items:center; gap:8px;
    }
    .mp-panel.mp-collapsed .mp-header-title {
      writing-mode:vertical-rl; transform:rotate(180deg);
      font-size:11px; max-width:none; overflow:visible;
    }
    .mp-panel.mp-collapsed .mp-no-image { display:none; }

    .mp-header {
      display:flex; align-items:center; gap:8px;
      padding:10px 12px; border-bottom:1px solid var(--ps-border);
      flex-shrink:0; min-height:40px;
    }
    .mp-header-title {
      flex:1; font-size:12px; font-weight:500; color:var(--ps-text);
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    .mp-collapse-btn {
      width:24px; height:24px; border-radius:4px; border:none;
      background:none; cursor:pointer; color:var(--ps-text-muted);
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; transition:background 100ms;
    }
    .mp-collapse-btn:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .mp-collapse-icon { font-size:18px; transition:transform 200ms; }
    .mp-panel.mp-collapsed .mp-collapse-icon { transform:rotate(180deg); }

    .mp-body { flex:1; overflow-y:auto; padding:0; }

    .mp-no-image {
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:8px; padding:32px 16px;
      color:var(--ps-text-faint); text-align:center;
    }
    .mp-no-image .material-symbols-outlined { font-size:32px; opacity:.4; }
    .mp-no-image-text { font-size:12px; opacity:.6; }

    /* ── Editable sidecar block ─────────────────────────────── */
    .mp-sidecar { padding:12px; border-bottom:1px solid var(--ps-border); }

    .mp-label {
      font-size:10px; font-weight:600; text-transform:uppercase;
      letter-spacing:.07em; color:var(--ps-text-faint);
      margin-bottom:4px; display:block;
    }

    /* Rating */
    .mp-rating-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
    .mp-stars { display:flex; gap:2px; }
    .mp-star {
      font-size:18px; cursor:pointer; color:var(--ps-text-faint);
      font-family:'Material Symbols Outlined'; font-style:normal;
      transition:color 100ms; line-height:1; user-select:none;
    }
    .mp-star.filled { color:var(--ps-warning,#f59e0b); }
    .mp-star:hover  { color:var(--ps-warning,#f59e0b); }
    .mp-flag-btns { display:flex; gap:4px; margin-left:auto; }
    .mp-flag-btn {
      padding:2px 7px; border-radius:5px; font-size:10px; font-weight:600;
      border:1px solid var(--ps-border); background:none;
      cursor:pointer; color:var(--ps-text-muted); transition:all 100ms;
    }
    .mp-flag-btn:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .mp-flag-btn.active-pick   { background:rgba(52,211,153,.15); color:#34d399; border-color:#34d399; }
    .mp-flag-btn.active-reject { background:rgba(248,113,113,.15); color:#f87171; border-color:#f87171; }
    .mp-flag-btn.active-unflag { background:var(--ps-bg-hover); color:var(--ps-text-muted); }

    /* Content rating */
    .mp-rating-row-2 { display:flex; align-items:center; gap:4px; margin-bottom:10px; }
    .mp-cr-btn {
      padding:2px 8px; border-radius:5px; font-size:10px; font-weight:600;
      border:1px solid var(--ps-border); background:none;
      cursor:pointer; color:var(--ps-text-muted); transition:all 100ms;
    }
    .mp-cr-btn:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .mp-cr-btn.active { background:rgba(0,119,255,.12); color:var(--ps-blue); border-color:var(--ps-blue); }
    .mp-cr-btn.active-mature  { background:rgba(245,158,11,.12); color:#f59e0b; border-color:#f59e0b; }
    .mp-cr-btn.active-explicit{ background:rgba(248,113,113,.12); color:#f87171; border-color:#f87171; }
    .mp-cr-sep { font-size:10px; color:var(--ps-text-faint); margin-left:auto; }

    /* Tags + usage scenarios */
    .mp-tag-wrap {
      display:flex; flex-wrap:wrap; gap:4px; align-items:center;
      padding:5px 7px; border:1px solid var(--ps-border); border-radius:6px;
      min-height:30px; cursor:text; background:var(--ps-bg-app); margin-bottom:8px;
    }
    .mp-tag-wrap:focus-within { border-color:var(--ps-blue); }
    .mp-chip {
      display:inline-flex; align-items:center; gap:3px;
      background:var(--ps-bg-raised); border-radius:3px;
      padding:1px 5px 1px 6px; font-size:11px; color:var(--ps-text);
    }
    .mp-chip-remove {
      cursor:pointer; color:var(--ps-text-muted); font-size:11px;
      line-height:1; background:none; border:none; padding:0;
    }
    .mp-chip-remove:hover { color:var(--ps-text); }
    .mp-tag-input {
      border:none; outline:none; background:none;
      font-size:11px; color:var(--ps-text); min-width:60px; flex:1;
    }
    .mp-tag-suggestions {
      position:fixed; background:var(--ps-bg-surface);
      border:1px solid var(--ps-border); border-radius:6px;
      box-shadow:0 4px 12px rgba(0,0,0,.15);
      z-index:1000; min-width:140px; overflow:hidden;
    }
    .mp-tag-suggestion {
      padding:6px 10px; font-size:11px; cursor:pointer; color:var(--ps-text);
      transition:background 80ms;
    }
    .mp-tag-suggestion:hover { background:var(--ps-bg-hover); }

    /* Caption / inputs */
    .mp-textarea {
      width:100%; box-sizing:border-box;
      padding:6px 7px; border:1px solid var(--ps-border); border-radius:6px;
      background:var(--ps-bg-app); color:var(--ps-text);
      font-size:11px; line-height:1.5; resize:vertical; min-height:50px;
      font-family:inherit; margin-bottom:8px;
    }
    .mp-textarea:focus { outline:none; border-color:var(--ps-blue); }
    .mp-input {
      width:100%; box-sizing:border-box;
      padding:5px 7px; border:1px solid var(--ps-border); border-radius:6px;
      background:var(--ps-bg-app); color:var(--ps-text);
      font-size:11px; font-family:inherit; margin-bottom:6px;
    }
    .mp-input:focus { outline:none; border-color:var(--ps-blue); }
    .mp-input-sm { width:80px; }

    .mp-geocode-btn {
      align-self:flex-start; padding:3px 8px; font-size:10px;
      border-radius:5px; border:1px solid var(--ps-border);
      background:none; cursor:pointer; color:var(--ps-text-muted);
      display:inline-flex; align-items:center; gap:3px;
      transition:all 100ms; margin-bottom:8px;
    }
    .mp-geocode-btn:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .mp-geocode-btn:disabled { opacity:.5; cursor:default; }
    .mp-readonly-val { font-size:11px; color:var(--ps-text-muted); padding:2px 0 6px; }

    /* ── Level 1 collapsible sections ───────────────────────── */
    .mp-section { border-bottom:1px solid var(--ps-border); }
    .mp-section-hdr {
      display:flex; align-items:center; gap:6px; padding:9px 12px;
      cursor:pointer; user-select:none; transition:background 100ms;
    }
    .mp-section-hdr:hover { background:var(--ps-bg-hover); }
    .mp-section-title {
      font-size:10px; font-weight:600; text-transform:uppercase;
      letter-spacing:.07em; color:var(--ps-text-faint); flex:1;
    }
    .mp-section-badge {
      font-size:9px; color:var(--ps-text-faint);
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      border-radius:3px; padding:1px 5px; white-space:nowrap; max-width:110px;
      overflow:hidden; text-overflow:ellipsis;
    }
    .mp-section-toggle {
      font-size:16px; color:var(--ps-text-faint);
      font-family:'Material Symbols Outlined'; font-style:normal;
      transition:transform 200ms; line-height:1; flex-shrink:0;
    }
    .mp-section.mp-sec-collapsed .mp-section-toggle { transform:rotate(-90deg); }
    .mp-section-body { }
    .mp-section.mp-sec-collapsed .mp-section-body { display:none; }

    /* Segmentation tag strip */
    .mp-seg-strip {
      display:flex; flex-wrap:wrap; gap:3px;
      padding:0 12px 8px; margin-top:-2px;
    }
    .mp-seg-tag {
      font-size:9px; color:var(--ps-text-faint);
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      border-radius:3px; padding:1px 4px;
    }
    .mp-section.mp-sec-collapsed .mp-seg-strip { display:none; }

    /* ── Level 2 sub-sections ───────────────────────────────── */
    .mp-subsec { border-top:1px solid var(--ps-border); }
    .mp-subsec:first-child { border-top:none; }
    .mp-subsec-hdr {
      display:flex; align-items:center; gap:6px;
      padding:7px 12px 7px 24px;
      cursor:pointer; user-select:none; transition:background 100ms;
    }
    .mp-subsec-hdr:hover { background:var(--ps-bg-hover); }
    .mp-subsec-icon { font-size:13px; color:var(--ps-text-faint); flex-shrink:0; }
    .mp-subsec-title {
      font-size:10px; font-weight:600; text-transform:uppercase;
      letter-spacing:.06em; color:var(--ps-text-faint); flex:1;
    }
    .mp-subsec-meta { font-size:9px; color:var(--ps-text-faint); flex-shrink:0; }
    .mp-subsec-toggle {
      font-size:14px; color:var(--ps-text-faint);
      font-family:'Material Symbols Outlined'; font-style:normal;
      transition:transform 200ms; line-height:1; flex-shrink:0;
    }
    .mp-subsec.mp-subsec-collapsed .mp-subsec-toggle { transform:rotate(-90deg); }
    .mp-subsec-body { padding:4px 12px 10px 24px; }
    .mp-subsec.mp-subsec-collapsed .mp-subsec-body { display:none; }

    /* Key-value rows inside subsections */
    .mp-kv { display:flex; gap:8px; padding:3px 0; font-size:11px; }
    .mp-kv-key { color:var(--ps-text-faint); min-width:90px; flex-shrink:0; }
    .mp-kv-val { color:var(--ps-text); flex:1; word-break:break-word; line-height:1.4; }
    .mp-kv-badge {
      display:inline-block; border-radius:3px; padding:1px 6px;
      font-size:9px; font-weight:600; text-transform:uppercase;
      background:rgba(52,211,153,.12); color:#34d399; border:1px solid rgba(52,211,153,.3);
    }
    .mp-kv-badge.warn {
      background:rgba(245,158,11,.12); color:#f59e0b; border-color:rgba(245,158,11,.3);
    }

    /* Bullet list */
    .mp-bullet-list { margin:4px 0 0; padding:0; list-style:none; }
    .mp-bullet-list li {
      font-size:11px; color:var(--ps-text-muted); padding:2px 0;
      padding-left:10px; position:relative;
    }
    .mp-bullet-list li::before {
      content:'·'; position:absolute; left:0; color:var(--ps-text-faint);
    }

    /* ── Colour palette ─────────────────────────────────────── */
    .mp-palette-tier { margin-bottom:8px; }
    .mp-palette-tier-label {
      font-size:9px; font-weight:600; text-transform:uppercase;
      letter-spacing:.06em; color:var(--ps-text-faint); margin-bottom:4px;
    }
    .mp-palette-chips { display:flex; flex-wrap:wrap; gap:5px; }
    .mp-color-chip {
      display:flex; align-items:center; gap:5px;
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      border-radius:4px; padding:3px 6px 3px 4px;
      font-size:10px; color:var(--ps-text-muted);
    }
    .mp-color-swatch {
      width:14px; height:14px; border-radius:3px; flex-shrink:0;
      border:1px solid rgba(0,0,0,.12);
    }

    /* ── AI tags ────────────────────────────────────────────── */
    .mp-ai-tags-wrap { display:flex; flex-wrap:wrap; gap:4px; }
    .mp-ai-tag-chip {
      display:inline-flex; align-items:center; gap:0;
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      border-radius:3px; overflow:hidden;
    }
    .mp-ai-tag-label {
      font-size:10px; color:var(--ps-text-muted); padding:2px 5px;
    }
    .mp-ai-promote {
      border:none; border-left:1px solid var(--ps-border);
      background:none; cursor:pointer; color:var(--ps-text-faint);
      padding:2px 4px; font-size:11px; line-height:1;
      display:flex; align-items:center; transition:all 80ms;
    }
    .mp-ai-promote:hover { background:rgba(0,119,255,.1); color:var(--ps-blue); }
    .mp-ai-tag-chip.promoted .mp-ai-promote { color:var(--ps-blue); opacity:.4; cursor:default; }

    /* ── Generation prompts ─────────────────────────────────── */
    .mp-prompt-block { margin-bottom:8px; }
    .mp-prompt-label {
      font-size:9px; font-weight:600; text-transform:uppercase;
      letter-spacing:.06em; color:var(--ps-text-faint);
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom:3px;
    }
    .mp-prompt-copy {
      border:none; background:none; cursor:pointer; color:var(--ps-text-faint);
      display:inline-flex; align-items:center; gap:2px;
      font-size:9px; padding:1px 4px; border-radius:3px; transition:all 80ms;
    }
    .mp-prompt-copy:hover { background:var(--ps-bg-hover); color:var(--ps-blue); }
    .mp-prompt-copy .material-symbols-outlined { font-size:11px; }
    .mp-prompt-text {
      font-size:11px; color:var(--ps-text-muted); line-height:1.5;
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      border-radius:4px; padding:6px 8px;
      max-height:80px; overflow-y:auto;
    }
    .mp-prompt-text.mp-prompt-expanded { max-height:none; }
    .mp-prompt-expand {
      font-size:9px; color:var(--ps-blue); cursor:pointer;
      background:none; border:none; padding:2px 0; margin-top:2px;
    }
    .mp-cam-grid {
      display:grid; grid-template-columns:1fr 1fr; gap:4px;
    }
    .mp-cam-cell {
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      border-radius:4px; padding:4px 7px; font-size:10px;
    }
    .mp-cam-cell-key { color:var(--ps-text-faint); font-size:9px; margin-bottom:1px; }
    .mp-cam-cell-val { color:var(--ps-text); }

    /* ── Subject per-person card ─────────────────────────────── */
    .mp-subject-card {
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      border-radius:6px; padding:8px; margin-bottom:6px;
    }
    .mp-subject-card-hdr {
      font-size:11px; font-weight:500; color:var(--ps-text); margin-bottom:5px;
      display:flex; align-items:center; gap:6px;
    }
    .mp-subject-pos {
      font-size:9px; background:rgba(0,119,255,.1); color:var(--ps-blue);
      border-radius:3px; padding:1px 5px;
    }

    /* ── Footer ─────────────────────────────────────────────── */
    .mp-footer {
      padding:10px 12px; border-top:1px solid var(--ps-border);
      display:flex; flex-direction:column; gap:6px; flex-shrink:0;
    }
    .mp-footer-row { display:flex; align-items:center; gap:6px; }
    .mp-writeback-label {
      display:flex; align-items:center; gap:5px;
      font-size:10px; color:var(--ps-text-muted); flex:1; cursor:pointer;
    }
    .mp-writeback-label input { cursor:pointer; }
    .mp-save-row { display:flex; gap:6px; }
    .mp-save-row .btn-primary   { flex:1; font-size:12px; padding:6px 10px; }
    .mp-save-row .btn-secondary { font-size:12px; padding:6px 10px; }
    .mp-no-save-note { font-size:10px; color:var(--ps-text-faint); text-align:center; padding:4px 0; }
  `;
  document.head.appendChild(s);
}

// ── Tiny helpers ───────────────────────────────────────────────────────────────

function _e(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _fmtDate(val) {
  if (!val) return '';
  try {
    const d = typeof val === 'number' ? new Date(val) : new Date(val);
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch { return String(val); }
}
function _fmtDateTime(val) {
  if (!val) return '';
  try {
    const d = typeof val === 'number' ? new Date(val) : new Date(val);
    return d.toLocaleDateString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return String(val); }
}

// ── MetadataPanel ──────────────────────────────────────────────────────────────

export class MetadataPanel {
  /**
   * @param {HTMLElement} rootEl
   * @param {object}  opts
   * @param {FileSystemDirectoryHandle|null} opts.dirHandle
   * @param {function} opts.onSaved
   * @param {boolean}  opts.startCollapsed
   * @param {boolean}  opts.startHidden
   */
  constructor(rootEl, {
    dirHandle = null, onSaved = null,
    startCollapsed = false, startHidden = false,
  } = {}) {
    this._root     = rootEl;
    this._dirHandle= dirHandle;
    this._onSaved  = onSaved;
    this._file     = null;
    this._sidecar  = null;
    // Editable state
    this._rating          = null;
    this._flag            = null;
    this._contentRating   = 'general';
    this._tags            = [];
    this._usageScenarios  = [];
    this._assetTitle      = '';
    // Misc
    this._allTags    = [];
    this._tagSuggest = null;
    this._panelEl    = null;
    this._dirty      = false;

    injectStyles();
    this._mount(startCollapsed, startHidden);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setDirHandle(handle) { this._dirHandle = handle; }

  async setFile(file) {
    if (!file) { this.clear(); return; }
    this._file    = file;
    this._sidecar = await readSidecar(this._dirHandle, file.name);

    const ann  = this._sidecar?.annotation || {};
    const ast  = this._sidecar?.asset      || {};
    this._rating         = ann.rating          ?? null;
    this._flag           = ann.flag            ?? null;
    this._contentRating  = ast.contentRating   ?? 'general';
    this._tags           = [...(ann.tags        || [])];
    this._usageScenarios = [...(ann.usageScenarios || [])];
    this._assetTitle     = ast.title           ?? '';
    this._dirty = false;

    const titleEl = this._panelEl?.querySelector('.mp-header-title');
    if (titleEl) titleEl.textContent = file.name;

    if (this._dirHandle) listSidecarTags(this._dirHandle).then(t => { this._allTags = t; });

    await this._renderBody();
  }

  clear() {
    this._file = null; this._sidecar = null;
    const titleEl = this._panelEl?.querySelector('.mp-header-title');
    if (titleEl) titleEl.textContent = 'No image selected';
    const body = this._panelEl?.querySelector('.mp-body');
    if (body) body.innerHTML = `
      <div class="mp-no-image">
        <span class="material-symbols-outlined">image_not_supported</span>
        <div class="mp-no-image-text">Select an image to view its metadata</div>
      </div>`;
    const footer = this._panelEl?.querySelector('.mp-footer');
    if (footer) footer.style.display = 'none';
  }

  show()        { this._panelEl?.classList.remove('mp-hidden'); }
  hide()        { this._panelEl?.classList.add('mp-hidden'); }
  toggle()      { this._panelEl?.classList.toggle('mp-hidden'); }
  isVisible()   { return !this._panelEl?.classList.contains('mp-hidden'); }
  collapse()    { this._panelEl?.classList.add('mp-collapsed'); }
  expand()      { this._panelEl?.classList.remove('mp-collapsed'); }
  isCollapsed() { return !!this._panelEl?.classList.contains('mp-collapsed'); }

  // ── Mount ──────────────────────────────────────────────────────────────────

  _mount(startCollapsed, startHidden) {
    const el = document.createElement('div');
    el.className = 'mp-panel'
      + (startCollapsed ? ' mp-collapsed' : '')
      + (startHidden    ? ' mp-hidden'    : '');

    el.innerHTML = `
      <div class="mp-header">
        <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-text-faint);flex-shrink:0">info</span>
        <div class="mp-header-title">No image selected</div>
        <button class="mp-collapse-btn" id="mp-collapse" title="Collapse panel">
          <span class="material-symbols-outlined mp-collapse-icon">chevron_right</span>
        </button>
      </div>
      <div class="mp-body">
        <div class="mp-no-image">
          <span class="material-symbols-outlined">image_not_supported</span>
          <div class="mp-no-image-text">Select an image to view its metadata</div>
        </div>
      </div>
      <div class="mp-footer" style="display:none">
        <div class="mp-footer-row">
          <label class="mp-writeback-label">
            <input type="checkbox" id="mp-writeback" checked>
            Write to image EXIF
          </label>
        </div>
        <div class="mp-save-row">
          <button class="btn-secondary" id="mp-cancel">Cancel</button>
          <button class="btn-primary"   id="mp-save">Save sidecar</button>
        </div>
      </div>`;

    this._panelEl = el;
    this._root.appendChild(el);

    el.querySelector('#mp-collapse').addEventListener('click', () => {
      el.classList.toggle('mp-collapsed');
    });
    el.querySelector('#mp-cancel')?.addEventListener('click', () => {
      if (this._file) this.setFile(this._file);
    });
    el.querySelector('#mp-save')?.addEventListener('click', () => this._save());
  }

  // ── Body rendering ─────────────────────────────────────────────────────────

  async _renderBody() {
    const body   = this._panelEl?.querySelector('.mp-body');
    const footer = this._panelEl?.querySelector('.mp-footer');
    if (!body || !this._file) return;

    const file    = this._file;
    const sidecar = this._sidecar;
    const ann     = sidecar?.annotation || {};
    const geo     = sidecar?.geo        || {};
    const exifS   = sidecar?.exif       || {};
    const hasGPS  = !!(exifS.gpsLat || exifS.gpsLng);
    const canSave = !!this._dirHandle;

    // Content rating button classes
    const crClass = v => {
      if (this._contentRating === v) {
        return v === 'general' ? 'mp-cr-btn active'
             : v === 'mature'  ? 'mp-cr-btn active-mature'
             :                   'mp-cr-btn active-explicit';
      }
      return 'mp-cr-btn';
    };

    body.innerHTML = `
      <!-- ═══ Editable section ═══════════════════════════════ -->
      <div class="mp-sidecar">

        <!-- Rating & Flag -->
        <div style="margin-bottom:8px">
          <span class="mp-label">Rating &amp; Flag</span>
          <div class="mp-rating-row">
            <div class="mp-stars" id="mp-stars">
              ${[1,2,3,4,5].map(n => `
                <span class="mp-star ${(this._rating||0)>=n?'filled':''}" data-star="${n}">star</span>
              `).join('')}
            </div>
            <div class="mp-flag-btns">
              <button class="mp-flag-btn ${this._flag==='pick'   ?'active-pick':''}"   data-flag="pick">Pick</button>
              <button class="mp-flag-btn ${this._flag==='reject' ?'active-reject':''}" data-flag="reject">Reject</button>
              <button class="mp-flag-btn ${!this._flag           ?'active-unflag':''}" data-flag="">Unflag</button>
            </div>
          </div>
          <!-- Content Rating -->
          <div class="mp-rating-row-2">
            <button class="${crClass('general')}"  data-cr="general">General</button>
            <button class="${crClass('mature')}"   data-cr="mature">Mature</button>
            <button class="${crClass('explicit')}" data-cr="explicit">Explicit</button>
            <span class="mp-cr-sep">content</span>
          </div>
        </div>

        <!-- Asset title -->
        <div style="margin-bottom:8px">
          <span class="mp-label">Title</span>
          <input class="mp-input" id="mp-asset-title"
            value="${_e(this._assetTitle)}" placeholder="Descriptive title…">
        </div>

        <!-- Tags -->
        <div style="margin-bottom:8px">
          <span class="mp-label">Tags</span>
          <div class="mp-tag-wrap" id="mp-tag-wrap">
            ${this._tags.map(t => `
              <span class="mp-chip" data-tag="${_e(t)}">
                ${_e(t)}<button class="mp-chip-remove" data-remove="${_e(t)}">×</button>
              </span>`).join('')}
            <input class="mp-tag-input" id="mp-tag-input" placeholder="Add tag…" autocomplete="off">
          </div>
        </div>

        <!-- Usage scenarios -->
        <div style="margin-bottom:8px">
          <span class="mp-label">Usage Scenarios</span>
          <div class="mp-tag-wrap" id="mp-usage-wrap">
            ${this._usageScenarios.map(t => `
              <span class="mp-chip" data-usagetag="${_e(t)}">
                ${_e(t)}<button class="mp-chip-remove" data-removeusage="${_e(t)}">×</button>
              </span>`).join('')}
            <input class="mp-tag-input" id="mp-usage-input" placeholder="Add scenario…" autocomplete="off">
          </div>
        </div>

        <!-- Caption -->
        <div style="margin-bottom:8px">
          <span class="mp-label">Caption</span>
          <textarea class="mp-textarea" id="mp-caption" rows="2"
            placeholder="Add a caption…">${_e(ann.caption||'')}</textarea>
        </div>

        <!-- Location -->
        <details open style="margin-bottom:4px">
          <summary class="mp-label"
            style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:4px">
            <span class="material-symbols-outlined" style="font-size:12px">expand_more</span>
            Location
            ${hasGPS ? '<span style="font-size:9px;color:var(--ps-text-faint);margin-left:auto">GPS ✓</span>' : ''}
          </summary>
          <div style="padding:6px 0 0">
            ${hasGPS ? `<button class="mp-geocode-btn" id="mp-geocode">
              <span class="material-symbols-outlined" style="font-size:12px">my_location</span>Fill from GPS
            </button>` : ''}
            <span class="mp-label">City</span>
            <input class="mp-input" id="mp-city" value="${_e(geo.city||'')}" placeholder="City">
            <span class="mp-label">Region / State</span>
            <input class="mp-input" id="mp-region" value="${_e(geo.region||'')}" placeholder="Region">
            <span class="mp-label">Country</span>
            <input class="mp-input" id="mp-country" value="${_e(geo.country||'')}" placeholder="Country">
            <span class="mp-label">Code</span>
            <input class="mp-input mp-input-sm" id="mp-cc" value="${_e(geo.countryCode||'')}" placeholder="GB">
            ${hasGPS
              ? `<div class="mp-readonly-val">📍 ${exifS.gpsLat?.toFixed(5)}, ${exifS.gpsLng?.toFixed(5)}</div>`
              : ''}
          </div>
        </details>
      </div>

      <!-- ═══ AI Analysis  (Level 1) ══════════════════════════ -->
      <div id="mp-sec-analysis" class="mp-section mp-sec-collapsed">
        <div class="mp-section-hdr" id="mp-analysis-hdr">
          <span class="mp-section-toggle">expand_more</span>
          <span class="mp-section-title">AI Analysis</span>
          <span class="mp-section-badge" id="mp-analysis-badge"></span>
        </div>
        <div id="mp-seg-strip-host"></div>
        <div class="mp-section-body" id="mp-analysis-body">
          <!-- Level 2 sub-sections injected below -->
        </div>
      </div>

      <!-- ═══ File, Camera & EXIF (Level 1) ══════════════════ -->
      <div id="mp-sec-exif-host"></div>

      <!-- ═══ Processing Log (Level 1) ═══════════════════════ -->
      ${this._renderProcessingLog(sidecar?.processing || [])}

      ${!canSave ? '<div class="mp-no-save-note" style="padding:8px">Sidecar editing not available in this view</div>' : ''}
    `;

    if (footer) footer.style.display = canSave ? 'flex' : 'none';

    this._bindBodyEvents(body);
    this._populateAnalysisSection(body, sidecar);
    this._loadExifSection(file, body);  // async
  }

  // ── AI Analysis section ────────────────────────────────────────────────────

  _populateAnalysisSection(body, sidecar) {
    const analysis = sidecar?.analysis || {};
    const hasAnalysis = Object.keys(analysis).length > 0;

    // Badge: "claude-opus-4 · Apr 2026"
    const badge = body.querySelector('#mp-analysis-badge');
    if (badge) {
      if (analysis.generatedBy || analysis.generatedAt) {
        const parts = [];
        if (analysis.generatedBy) parts.push(analysis.generatedBy.replace(/^claude-/, 'claude/'));
        if (analysis.generatedAt) parts.push(_fmtDate(analysis.generatedAt));
        badge.textContent = parts.join(' · ');
      } else if (!hasAnalysis) {
        badge.textContent = 'No analysis yet';
      }
    }

    // Segmentation strip
    const segHost = body.querySelector('#mp-seg-strip-host');
    if (segHost && analysis.segmentation?.scene) {
      const regions = Object.keys(analysis.segmentation.scene);
      if (regions.length) {
        segHost.innerHTML = `<div class="mp-seg-strip">
          ${regions.map(r => `<span class="mp-seg-tag">${_e(r)}</span>`).join('')}
        </div>`;
      }
    }

    // Wire Level 1 toggle
    const hdr = body.querySelector('#mp-analysis-hdr');
    const sec = body.querySelector('#mp-sec-analysis');
    hdr?.addEventListener('click', () => sec?.classList.toggle('mp-sec-collapsed'));

    // Build Level 2 sub-sections
    const analysisBody = body.querySelector('#mp-analysis-body');
    if (!analysisBody) return;

    // Determine computed — support both schema locations
    const computed = analysis.computed || sidecar?.computed || {};

    const subsections = [
      { key: 'palette',   show: !!analysis.colorPalette,            build: () => this._buildColorPalette(analysis.colorPalette) },
      { key: 'aitags',    show: !!(analysis.tags?.length),          build: () => this._buildAITags(analysis.tags, body) },
      { key: 'scene',     show: !!analysis.scene,                   build: () => this._buildScene(analysis.scene) },
      { key: 'subjects',  show: !!(analysis.subjects?.count > 0 || analysis.subjects?.items?.length), build: () => this._buildSubjects(analysis.subjects) },
      { key: 'complight', show: !!(analysis.composition || analysis.lighting), build: () => this._buildCompositionLighting(analysis.composition, analysis.lighting) },
      { key: 'idloc',     show: !!analysis.identifiedLocation,      build: () => this._buildIdentifiedLocation(analysis.identifiedLocation) },
      { key: 'arch',      show: !!analysis.architecture,            build: () => this._buildArchitecture(analysis.architecture) },
      { key: 'prompts',   show: !!analysis.generationPrompts,       build: () => this._buildGenPrompts(analysis.generationPrompts) },
      { key: 'dam',       show: !!analysis.dam,                     build: () => this._buildDAM(analysis.dam) },
      { key: 'computed',  show: Object.keys(computed).length > 0,   build: () => this._buildComputed(computed) },
    ];

    let built = 0;
    subsections.forEach(({ key, show, build }) => {
      if (!show) return;
      const node = build();
      if (node) { analysisBody.appendChild(node); built++; }
    });

    // Legacy vision data placeholder (async, via asset-panel)
    const legacyHost = document.createElement('div');
    legacyHost.id = 'mp-legacy-vision-host';
    analysisBody.appendChild(legacyHost);

    if (!hasAnalysis && !built) {
      analysisBody.innerHTML = `<div style="padding:10px 24px;font-size:11px;color:var(--ps-text-faint);font-style:italic">No AI analysis data in sidecar</div>`;
    }
  }

  // ── Level 2 sub-section factory ────────────────────────────────────────────

  _subsec(icon, title, meta, bodyEl, startCollapsed = true) {
    const div = document.createElement('div');
    div.className = 'mp-subsec' + (startCollapsed ? ' mp-subsec-collapsed' : '');
    div.innerHTML = `
      <div class="mp-subsec-hdr">
        <span class="material-symbols-outlined mp-subsec-icon">${_e(icon)}</span>
        <span class="mp-subsec-title">${_e(title)}</span>
        ${meta ? `<span class="mp-subsec-meta">${_e(meta)}</span>` : ''}
        <span class="mp-subsec-toggle">expand_more</span>
      </div>`;
    const body = document.createElement('div');
    body.className = 'mp-subsec-body';
    if (bodyEl instanceof HTMLElement) body.appendChild(bodyEl);
    else body.innerHTML = bodyEl;
    div.appendChild(body);
    div.querySelector('.mp-subsec-hdr').addEventListener('click', () => {
      div.classList.toggle('mp-subsec-collapsed');
    });
    return div;
  }

  _kv(key, val, opts = {}) {
    if (val == null || val === '' || val === false) return '';
    const display = opts.badge
      ? `<span class="mp-kv-badge ${opts.badgeWarn ? 'warn' : ''}">${_e(String(val))}</span>`
      : `<span class="mp-kv-val">${_e(String(val))}</span>`;
    return `<div class="mp-kv">
      <span class="mp-kv-key">${_e(key)}</span>${display}
    </div>`;
  }

  _bulletList(items) {
    if (!items?.length) return '';
    return `<ul class="mp-bullet-list">${items.map(i => `<li>${_e(i)}</li>`).join('')}</ul>`;
  }

  // ── Sub-section builders ───────────────────────────────────────────────────

  _buildColorPalette(palette) {
    if (!palette) return null;
    const body = document.createElement('div');
    const tiers = [
      { key: 'dominant',  label: 'Dominant'  },
      { key: 'secondary', label: 'Secondary' },
      { key: 'accent',    label: 'Accent'    },
    ];
    tiers.forEach(({ key, label }) => {
      const items = palette[key];
      if (!items?.length) return;
      const tier = document.createElement('div');
      tier.className = 'mp-palette-tier';
      tier.innerHTML = `<div class="mp-palette-tier-label">${_e(label)}</div>`;
      const chips = document.createElement('div');
      chips.className = 'mp-palette-chips';
      items.forEach(entry => {
        // Support both object {label, hex} and legacy string
        const label = typeof entry === 'string' ? entry : (entry.label || '');
        const hex   = typeof entry === 'object' ? entry.hex : null;
        const chip = document.createElement('div');
        chip.className = 'mp-color-chip';
        chip.title = hex ? `${label} · ${hex}` : label;
        const swatchStyle = hex
          ? `background:${hex}`
          : `background:var(--ps-bg-raised)`;
        chip.innerHTML = `
          <div class="mp-color-swatch" style="${swatchStyle}"></div>
          <span>${_e(label)}${hex ? `<span style="font-size:9px;opacity:.6;margin-left:3px">${_e(hex)}</span>` : ''}</span>`;
        chips.appendChild(chip);
      });
      tier.appendChild(chips);
      body.appendChild(tier);
    });
    const count = (palette.dominant?.length||0) + (palette.secondary?.length||0) + (palette.accent?.length||0);
    return this._subsec('palette', 'Colour Palette', `${count} colours`, body);
  }

  _buildAITags(tags, panelBody) {
    if (!tags?.length) return null;
    const body = document.createElement('div');
    body.innerHTML = `<div style="margin-bottom:6px;font-size:10px;color:var(--ps-text-faint)">
      Click <strong>+</strong> to add to your tags</div>`;
    const wrap = document.createElement('div');
    wrap.className = 'mp-ai-tags-wrap';
    tags.forEach(tag => {
      const chip = document.createElement('div');
      chip.className = 'mp-ai-tag-chip';
      chip.dataset.aitag = tag;
      const alreadyOwned = this._tags.includes(tag);
      chip.innerHTML = `<span class="mp-ai-tag-label">${_e(tag)}</span>
        <button class="mp-ai-promote" title="Add to my tags" ${alreadyOwned ? 'disabled' : ''}>+</button>`;
      if (alreadyOwned) chip.classList.add('promoted');
      chip.querySelector('.mp-ai-promote').addEventListener('click', () => {
        if (this._tags.includes(tag)) return;
        this._promoteAITag(tag, panelBody);
        chip.classList.add('promoted');
        chip.querySelector('.mp-ai-promote').disabled = true;
      });
      wrap.appendChild(chip);
    });
    body.appendChild(wrap);
    return this._subsec('tag', 'AI Tags', `${tags.length}`, body);
  }

  _buildScene(scene) {
    if (!scene) return null;
    const body = document.createElement('div');
    body.innerHTML = [
      this._kv('Location type', scene.locationType),
      this._kv('Indoor/outdoor', scene.indoorOutdoor),
      this._kv('Time of day', scene.timeOfDay),
      this._kv('Season', scene.season),
      this._kv('Weather', scene.weather),
      this._kv('Visibility', scene.visibility),
      this._kv('Atmosphere', scene.atmosphere),
      this._kv('Style', scene.style),
    ].join('');
    if (scene.settingDetails?.length) {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ps-text-faint);padding:5px 0 2px';
      h.textContent = 'Setting details';
      body.appendChild(h);
      body.insertAdjacentHTML('beforeend', this._bulletList(scene.settingDetails));
    }
    return this._subsec('landscape', 'Scene', '', body);
  }

  _buildSubjects(subjects) {
    if (!subjects) return null;
    const body = document.createElement('div');
    body.innerHTML = [
      this._kv('Count', subjects.count),
      this._kv('Arrangement', subjects.arrangement),
      this._kv('Interaction', subjects.interaction),
      this._kv('Emotion', subjects.emotion),
    ].join('');

    (subjects.items || []).forEach((subj, i) => {
      const card = document.createElement('div');
      card.className = 'mp-subject-card';
      const label = subj.id || `Subject ${i + 1}`;
      card.innerHTML = `<div class="mp-subject-card-hdr">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-text-faint)">person</span>
        ${_e(label)}
        ${subj.position ? `<span class="mp-subject-pos">${_e(subj.position)}</span>` : ''}
      </div>` + [
        this._kv('Gender pres.', subj.genderPresentation),
        this._kv('Age range', subj.approximateAgeRange),
        this._kv('Skin tone', subj.skinTone),
        this._kv('Expression', subj.expression),
        this._kv('Visibility', subj.visibility),
        this._kv('Posture', subj.posture),
        subj.hair  ? this._kv('Hair',  [subj.hair.color, subj.hair.length, subj.hair.style].filter(Boolean).join(', ')) : '',
        subj.eyes  ? this._kv('Eyes',  [subj.eyes.color, subj.eyes.expression].filter(Boolean).join(', ')) : '',
        subj.glasses ? this._kv('Glasses', [subj.glasses.frameStyle, subj.glasses.frameColor, subj.glasses.lens].filter(Boolean).join(', ')) : '',
        subj.accessories?.length ? this._kv('Accessories', subj.accessories.join(', ')) : '',
        subj.outfit && Object.keys(subj.outfit).length
          ? this._kv('Outfit', Object.values(subj.outfit).join(', ')) : '',
      ].join('');
      body.appendChild(card);
    });

    const count = subjects.count ?? subjects.items?.length ?? 0;
    return this._subsec('group', 'Subjects', `${count} ${count === 1 ? 'person' : 'people'}`, body);
  }

  _buildCompositionLighting(comp, light) {
    const body = document.createElement('div');
    if (comp) {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ps-text-faint);padding:2px 0 3px';
      h.textContent = 'Composition';
      body.appendChild(h);
      body.insertAdjacentHTML('beforeend', [
        this._kv('Shot type', comp.shotType),
        this._kv('Framing', comp.framing),
        this._kv('Camera angle', comp.cameraAngle),
        this._kv('Perspective', comp.cameraPerspective),
        this._kv('Viewpoint', comp.viewpoint),
        this._kv('Foreground', comp.foreground),
        this._kv('Midground', comp.midground),
        this._kv('Background', comp.background),
        this._kv('Horizon line', comp.horizonLine),
        this._kv('Focus', comp.focus),
        this._kv('Depth of field', comp.depthOfField),
        this._kv('Capture type', comp.captureType),
      ].join(''));
    }
    if (light) {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ps-text-faint);padding:8px 0 3px';
      h.textContent = 'Lighting';
      body.appendChild(h);
      body.insertAdjacentHTML('beforeend', [
        this._kv('Type', light.type),
        this._kv('Primary source', light.primarySource),
        this._kv('Secondary', light.secondarySource),
        this._kv('Quality', light.quality),
        this._kv('Sky condition', light.skyCondition),
        this._kv('Highlights', light.highlights),
        this._kv('Shadows', light.shadows),
        this._kv('Colour temp', light.colorTemperatureK ? String(light.colorTemperatureK) + (typeof light.colorTemperatureK === 'number' ? 'K' : '') : null),
        this._kv('Exposure note', light.exposureNote),
      ].join(''));
    }
    return this._subsec('camera', 'Composition & Lighting', '', body);
  }

  _buildIdentifiedLocation(loc) {
    if (!loc) return null;
    const body = document.createElement('div');
    if (loc.name || loc.localName) {
      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:12px;font-weight:500;color:var(--ps-text);margin-bottom:2px';
      nameEl.textContent = loc.name || '';
      body.appendChild(nameEl);
      if (loc.localName && loc.localName !== loc.name) {
        const localEl = document.createElement('div');
        localEl.style.cssText = 'font-size:10px;color:var(--ps-text-faint);margin-bottom:6px';
        localEl.textContent = loc.localName;
        body.appendChild(localEl);
      }
    }
    body.insertAdjacentHTML('beforeend', [
      loc.country || loc.region ? this._kv('Location', [loc.municipality, loc.region, loc.country].filter(Boolean).join(', ')) : '',
      this._kv('Period', loc.architecturalPeriod),
      this._kv('Architect', loc.architect),
      this._kv('Denomination', loc.denomination),
      this._kv('Heritage', loc.heritageStatus),
      loc.identificationConfidence ? this._kv('Confidence', loc.identificationConfidence, { badge: true }) : '',
    ].join(''));
    if (loc.historicalSignificance) {
      body.insertAdjacentHTML('beforeend', `
        <div style="font-size:10px;color:var(--ps-text-muted);line-height:1.5;margin-top:4px;padding:6px;background:var(--ps-bg-app);border-radius:4px;border:1px solid var(--ps-border)">
          ${_e(loc.historicalSignificance)}
        </div>`);
    }
    if (loc.identificationBasis) {
      body.insertAdjacentHTML('beforeend', `
        <div style="font-size:9px;color:var(--ps-text-faint);margin-top:6px;font-style:italic">
          Identified by: ${_e(loc.identificationBasis)}</div>`);
    }
    if (loc.coordinatesApproximate?.latitude) {
      body.insertAdjacentHTML('beforeend',
        `<div style="font-size:10px;color:var(--ps-text-faint);margin-top:4px">
          📍 ~${loc.coordinatesApproximate.latitude.toFixed(4)}, ${loc.coordinatesApproximate.longitude.toFixed(4)}
        </div>`);
    }
    return this._subsec('location_on', 'Identified Location', '', body);
  }

  _buildArchitecture(arch) {
    if (!arch) return null;
    const body = document.createElement('div');
    body.insertAdjacentHTML('beforeend', [
      this._kv('Building type', arch.buildingType),
      this._kv('Style', arch.style),
      this._kv('Material', arch.constructionMaterial),
      this._kv('Exterior colour', arch.exteriorColor),
      this._kv('Roof', arch.roofMaterial),
      this._kv('Condition', arch.condition),
    ].join(''));

    if (arch.components && Object.keys(arch.components).length) {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ps-text-faint);padding:6px 0 2px';
      h.textContent = 'Components';
      body.appendChild(h);
      Object.entries(arch.components).forEach(([name, detail]) => {
        const entry = document.createElement('div');
        entry.style.cssText = 'margin-bottom:4px';
        entry.innerHTML = `<div style="font-size:11px;font-weight:500;color:var(--ps-text);margin-bottom:1px">${_e(name)}</div>`;
        if (detail.type)     entry.insertAdjacentHTML('beforeend', this._kv('Type', detail.type));
        if (detail.position) entry.insertAdjacentHTML('beforeend', this._kv('Position', detail.position));
        if (detail.features?.length) {
          entry.insertAdjacentHTML('beforeend', this._bulletList(detail.features));
        }
        body.appendChild(entry);
      });
    }

    if (arch.distinctiveFeatures?.length) {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ps-text-faint);padding:4px 0 2px';
      h.textContent = 'Distinctive features';
      body.appendChild(h);
      body.insertAdjacentHTML('beforeend', this._bulletList(arch.distinctiveFeatures));
    }

    return this._subsec('domain', 'Architecture', arch.buildingType || '', body);
  }

  _buildGenPrompts(prompts) {
    if (!prompts) return null;
    const body = document.createElement('div');

    const addPrompt = (label, text) => {
      if (!text) return;
      const block = document.createElement('div');
      block.className = 'mp-prompt-block';
      const copyId = `mp-prcopy-${Math.random().toString(36).slice(2)}`;
      block.innerHTML = `
        <div class="mp-prompt-label">
          ${_e(label)}
          <button class="mp-prompt-copy" id="${copyId}">
            <span class="material-symbols-outlined">content_copy</span>Copy
          </button>
        </div>
        <div class="mp-prompt-text" id="${copyId}-txt">${_e(text)}</div>`;
      if (text.length > 180) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'mp-prompt-expand';
        expandBtn.textContent = 'Show full ▾';
        const txtEl = block.querySelector(`#${copyId}-txt`);
        expandBtn.addEventListener('click', () => {
          txtEl.classList.toggle('mp-prompt-expanded');
          expandBtn.textContent = txtEl.classList.contains('mp-prompt-expanded')
            ? 'Collapse ▴' : 'Show full ▾';
        });
        block.appendChild(expandBtn);
      }
      block.querySelector(`#${copyId}`).addEventListener('click', () => {
        navigator.clipboard.writeText(text).catch(() => {});
        const btn = block.querySelector(`#${copyId}`);
        btn.innerHTML = `<span class="material-symbols-outlined">check</span>Copied`;
        setTimeout(() => { btn.innerHTML = `<span class="material-symbols-outlined">content_copy</span>Copy`; }, 1500);
      });
      body.appendChild(block);
    };

    addPrompt('Short prompt', prompts.short);
    addPrompt('Detailed prompt', prompts.detailed);
    addPrompt('Negative prompt', prompts.negativePrompt);

    if (prompts.replicationSettings) {
      const rs = prompts.replicationSettings;
      const grid = document.createElement('div');
      grid.innerHTML = `<div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ps-text-faint);margin:6px 0 4px">Camera settings to replicate</div>`;
      const cells = document.createElement('div');
      cells.className = 'mp-cam-grid';
      const addCell = (k, v) => {
        if (!v) return;
        cells.insertAdjacentHTML('beforeend', `
          <div class="mp-cam-cell">
            <div class="mp-cam-cell-key">${_e(k)}</div>
            <div class="mp-cam-cell-val">${_e(v)}</div>
          </div>`);
      };
      addCell('Lens', rs.lensEquivalent);
      addCell('Aperture', rs.aperture);
      addCell('Shutter', rs.shutterSpeed);
      addCell('ISO', rs.iso);
      addCell('WB', rs.whiteBalance);
      addCell('DoF', rs.depthOfField);
      if (cells.children.length) { grid.appendChild(cells); body.appendChild(grid); }
      if (rs.technique) {
        body.insertAdjacentHTML('beforeend',
          `<div style="font-size:10px;color:var(--ps-text-faint);font-style:italic;margin-top:4px">${_e(rs.technique)}</div>`);
      }
    }

    return this._subsec('auto_awesome', 'Generative Prompts', '', body);
  }

  _buildDAM(dam) {
    if (!dam) return null;
    const body = document.createElement('div');
    body.insertAdjacentHTML('beforeend', [
      this._kv('Sensitivity', dam.contentSensitivity),
      this._kv('Identity', dam.identityNotes),
      this._kv('Property', dam.propertyReleaseNotes),
      this._kv('Branding', dam.brandingFlexibility),
      this._kv('Geo verify', dam.geoVerification),
    ].join(''));
    if (dam.limitations?.length) {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ps-text-faint);padding:5px 0 2px';
      h.textContent = 'Limitations';
      body.appendChild(h);
      body.insertAdjacentHTML('beforeend', this._bulletList(dam.limitations));
    }
    return this._subsec('shield', 'DAM Notes', '', body);
  }

  _buildComputed(computed) {
    if (!computed || !Object.keys(computed).length) return null;
    const body = document.createElement('div');
    Object.entries(computed).forEach(([k, v]) => {
      body.insertAdjacentHTML('beforeend', this._kv(k, typeof v === 'object' ? JSON.stringify(v) : String(v)));
    });
    return this._subsec('tune', 'Computed', '', body);
  }

  _renderProcessingLog(procs) {
    if (!procs.length) return '';
    return `
      <div class="mp-section mp-sec-collapsed" id="mp-sec-proc">
        <div class="mp-section-hdr" data-sec="mp-sec-proc">
          <span class="mp-section-toggle">expand_more</span>
          <span class="mp-section-title">Processing Log</span>
          <span class="mp-section-badge">${procs.length} run${procs.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="mp-section-body" style="padding:0 12px 10px">
          ${procs.slice().reverse().map(p => `
            <div style="font-size:11px;padding:5px 0;border-bottom:1px solid var(--ps-border)">
              <div style="font-weight:500;color:var(--ps-text)">${_e(p.recipeName || p.recipe || '—')}</div>
              <div style="color:var(--ps-text-faint);font-size:10px">${_fmtDateTime(p.at)}${p.output ? ` · ${_e(p.output)}` : ''}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // ── EXIF section (async) ───────────────────────────────────────────────────

  async _loadExifSection(file, body) {
    try {
      const { getImageInfo, renderImageInfoPanel, injectImageInfoStyles } = await import('../utils/image-info.js');
      const { renderExtractedMetadataForSidebar, injectAssetPanelStyles }  = await import('../utils/asset-panel.js');
      injectImageInfoStyles();
      injectAssetPanelStyles();

      const info   = await getImageInfo(file);
      const infoEl = renderImageInfoPanel(info);
      const host   = body.querySelector('#mp-sec-exif-host');
      if (!host || this._file !== file) return;

      // Level 1: File, Camera & EXIF
      const sec = document.createElement('div');
      sec.className = 'mp-section mp-sec-collapsed';
      sec.id = 'mp-sec-exif';
      sec.innerHTML = `
        <div class="mp-section-hdr" id="mp-exif-hdr">
          <span class="mp-section-toggle">expand_more</span>
          <span class="mp-section-title">File, Camera &amp; EXIF</span>
          <span class="mp-section-badge">read-only</span>
        </div>`;
      const secBody = document.createElement('div');
      secBody.className = 'mp-section-body';
      secBody.style.padding = '0 12px 10px';
      secBody.appendChild(infoEl);
      sec.appendChild(secBody);
      sec.querySelector('#mp-exif-hdr').addEventListener('click', () => {
        sec.classList.toggle('mp-sec-collapsed');
      });
      host.replaceWith(sec);

      // Legacy vision/extracted data → goes into AI Analysis section
      const extracted = await renderExtractedMetadataForSidebar(file);
      const legacyHost = body.querySelector('#mp-legacy-vision-host');
      if (extracted && legacyHost && this._file === file) {
        const legacyNode = this._subsec('visibility', 'Vision (legacy)', 'read-only', extracted);
        legacyHost.replaceWith(legacyNode);
        // If there is any legacy data, make sure AI Analysis section is visible
        const analysisBody = body.querySelector('#mp-analysis-body');
        if (analysisBody?.children.length === 1) {
          // was only the legacy host placeholder — no other sub-sections
          // remove the "no data" note if present and show the legacy node
        }
      } else {
        legacyHost?.remove();
      }
    } catch (err) {
      console.warn('[MetadataPanel] Failed to load EXIF section:', err);
    }
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  _bindBodyEvents(body) {
    // Level 1 section toggles (processing log — analysis & EXIF wired separately)
    body.querySelectorAll('.mp-section-hdr[data-sec]').forEach(hdr => {
      hdr.addEventListener('click', () => {
        body.querySelector(`#${hdr.dataset.sec}`)?.classList.toggle('mp-sec-collapsed');
      });
    });

    // Stars
    const starsEl = body.querySelector('#mp-stars');
    starsEl?.querySelectorAll('.mp-star').forEach(star => {
      star.addEventListener('click', () => {
        const n = parseInt(star.dataset.star);
        this._rating = this._rating === n ? null : n;
        this._dirty  = true;
        starsEl.querySelectorAll('.mp-star').forEach((s, i) => {
          s.classList.toggle('filled', (this._rating || 0) > i);
        });
      });
    });

    // Flags
    body.querySelectorAll('.mp-flag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val   = btn.dataset.flag || null;
        this._flag  = val;
        this._dirty = true;
        body.querySelectorAll('.mp-flag-btn').forEach(b => {
          b.classList.remove('active-pick', 'active-reject', 'active-unflag');
        });
        btn.classList.add(val === 'pick' ? 'active-pick' : val === 'reject' ? 'active-reject' : 'active-unflag');
      });
    });

    // Content rating
    body.querySelectorAll('.mp-cr-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._contentRating = btn.dataset.cr;
        this._dirty = true;
        body.querySelectorAll('.mp-cr-btn').forEach(b => {
          b.className = 'mp-cr-btn';
        });
        const activeClass = this._contentRating === 'mature' ? 'mp-cr-btn active-mature'
          : this._contentRating === 'explicit' ? 'mp-cr-btn active-explicit'
          : 'mp-cr-btn active';
        btn.className = activeClass;
      });
    });

    // Asset title
    body.querySelector('#mp-asset-title')?.addEventListener('input', () => { this._dirty = true; });

    // Tags
    this._bindChipInput(
      body, 'mp-tag-wrap', 'mp-tag-input',
      () => this._tags,
      (arr) => { this._tags = arr; this._dirty = true; },
      true /* show suggestions */
    );

    // Usage scenarios
    this._bindChipInput(
      body, 'mp-usage-wrap', 'mp-usage-input',
      () => this._usageScenarios,
      (arr) => { this._usageScenarios = arr; this._dirty = true; },
      false /* no suggestions */
    );

    // Caption & location inputs
    body.querySelector('#mp-caption')?.addEventListener('input', () => { this._dirty = true; });
    body.querySelectorAll('#mp-city,#mp-region,#mp-country,#mp-cc').forEach(i => {
      i.addEventListener('input', () => { this._dirty = true; });
    });

    // Geocode
    body.querySelector('#mp-geocode')?.addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">hourglass_empty</span>Looking up…';
      try {
        const lat = this._sidecar?.exif?.gpsLat ?? this._file._exifLat;
        const lng = this._sidecar?.exif?.gpsLng ?? this._file._exifLng;
        if (lat == null) throw new Error('No GPS data');
        const r = await reverseGeocode(lat, lng);
        body.querySelector('#mp-city').value    = r.city;
        body.querySelector('#mp-region').value  = r.region;
        body.querySelector('#mp-country').value = r.country;
        body.querySelector('#mp-cc').value      = r.countryCode;
        this._dirty = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">check</span>Done';
      } catch { btn.innerHTML = 'Geocode failed'; }
      finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">my_location</span>Fill from GPS';
        }, 2000);
      }
    });
  }

  // Generic chip input binder (shared by tags + usage scenarios)
  _bindChipInput(body, wrapId, inputId, getArr, setArr, showSuggestions) {
    const wrap  = body.querySelector(`#${wrapId}`);
    const input = body.querySelector(`#${inputId}`);
    if (!input || !wrap) return;

    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove],[data-removeusage]');
      if (btn) {
        const val = btn.dataset.remove ?? btn.dataset.removeusage;
        setArr(getArr().filter(t => t !== val));
        btn.closest('.mp-chip')?.remove();
        return;
      }
      input.focus();
    });

    const addItem = (val) => {
      val = val.replace(/,+$/, '').trim();
      if (!val || getArr().includes(val)) return;
      const arr = [...getArr(), val];
      setArr(arr);
      const chip = document.createElement('span');
      chip.className = 'mp-chip';
      const removeAttr = inputId === 'mp-usage-input' ? 'data-removeusage' : 'data-remove';
      chip.innerHTML = `${_e(val)}<button class="mp-chip-remove" ${removeAttr}="${_e(val)}">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        setArr(getArr().filter(t => t !== val));
        chip.remove();
      });
      wrap.insertBefore(chip, input);
      input.value = '';
      this._hideTagSug();
    };

    input.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        addItem(input.value.trim().toLowerCase());
      }
      if (e.key === 'Backspace' && !input.value && getArr().length) {
        const last = getArr().slice(-1)[0];
        setArr(getArr().slice(0, -1));
        wrap.querySelector(`.mp-chip:last-of-type`)?.remove();
      }
    });

    if (showSuggestions) {
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        this._showTagSug(q, input, val => addItem(val));
      });
      input.addEventListener('blur', () => setTimeout(() => this._hideTagSug(), 200));
    }
  }

  // Promote an AI tag into annotation.tags
  _promoteAITag(tag, body) {
    if (this._tags.includes(tag)) return;
    this._tags.push(tag);
    this._dirty = true;
    const wrap  = body.querySelector('#mp-tag-wrap');
    const input = body.querySelector('#mp-tag-input');
    if (!wrap || !input) return;
    const chip = document.createElement('span');
    chip.className = 'mp-chip';
    chip.innerHTML = `${_e(tag)}<button class="mp-chip-remove" data-remove="${_e(tag)}">×</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      this._tags  = this._tags.filter(t => t !== tag);
      this._dirty = true;
      chip.remove();
    });
    wrap.insertBefore(chip, input);
    window.AuroraToast?.show({ variant: 'success', title: `Tag added: ${tag}` });
  }

  _showTagSug(q, input, onSelect) {
    this._hideTagSug();
    if (!q) return;
    const hits = this._allTags.filter(t => t.includes(q) && !this._tags.includes(t)).slice(0, 8);
    if (!hits.length) return;
    const box = document.createElement('div');
    box.className = 'mp-tag-suggestions';
    hits.forEach(t => {
      const item = document.createElement('div');
      item.className = 'mp-tag-suggestion';
      item.textContent = t;
      item.addEventListener('mousedown', e => { e.preventDefault(); onSelect(t); });
      box.appendChild(item);
    });
    const rect = input.getBoundingClientRect();
    box.style.cssText = `top:${rect.bottom+4}px;left:${rect.left}px;`;
    document.body.appendChild(box);
    this._tagSuggest = box;
  }
  _hideTagSug() { this._tagSuggest?.remove(); this._tagSuggest = null; }

  // ── Save ───────────────────────────────────────────────────────────────────

  async _save() {
    const body = this._panelEl?.querySelector('.mp-body');
    const btn  = this._panelEl?.querySelector('#mp-save');
    if (!btn || !this._file || !this._dirHandle) return;
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const exifWriteback = this._panelEl?.querySelector('#mp-writeback')?.checked;

    // Annotation + geo fields
    const formValues = {
      rating:      this._rating,
      flag:        this._flag || null,
      tags:        [...this._tags],
      caption:     body?.querySelector('#mp-caption')?.value?.trim()    || '',
      city:        body?.querySelector('#mp-city')?.value?.trim()       || '',
      region:      body?.querySelector('#mp-region')?.value?.trim()     || '',
      country:     body?.querySelector('#mp-country')?.value?.trim()    || '',
      countryCode: body?.querySelector('#mp-cc')?.value?.trim().toUpperCase() || '',
    };

    const exif   = await extractExif(this._file).catch(() => ({}));
    const merged = buildSidecarPatch(this._sidecar, formValues);

    // New v2 editable fields
    merged.annotation = merged.annotation || {};
    merged.annotation.usageScenarios = [...this._usageScenarios];

    merged.asset = {
      ...(this._sidecar?.asset || {}),
      ...(merged.asset || {}),
    };
    const newTitle = body?.querySelector('#mp-asset-title')?.value?.trim();
    if (newTitle !== undefined) merged.asset.title = newTitle;
    merged.asset.contentRating = this._contentRating;

    // EXIF block
    if (!merged.exif || !Object.keys(merged.exif).some(k => merged.exif[k])) {
      merged.exif = {
        cameraMake:   exif.Make                                           || null,
        cameraModel:  exif.Model                                          || null,
        focalLength:  exif.FocalLength                                    || null,
        aperture:     exif.FNumber                                        || null,
        iso:          exif.ISOSpeedRatings                                || null,
        shutterSpeed: exif.ExposureTime ? `1/${Math.round(1/exif.ExposureTime)}` : null,
        dateTaken:    exif.DateTimeOriginal                               || null,
        gpsLat:       exif.GPSLatitude  ?? null,
        gpsLng:       exif.GPSLongitude ?? null,
        gpsAltitude:  exif.GPSAltitude  ?? null,
      };
    }
    merged.source = merged.source?.filename ? merged.source : {
      filename: this._file.name, sizeBytes: this._file.size,
    };

    // Preserve existing analysis block (we don't overwrite AI analysis on save)
    if (this._sidecar?.analysis) {
      merged.analysis = merged.analysis || this._sidecar.analysis;
    }

    try {
      await writeSidecar(this._dirHandle, this._file.name, merged);
      if (exifWriteback) {
        await this._writeExifBack(merged.annotation).catch(err =>
          console.warn('[MetadataPanel] EXIF write-back failed:', err));
      }
      this._sidecar = merged;
      this._dirty   = false;
      this._onSaved?.(this._file, merged);
      window.AuroraToast?.show({ variant: 'success', title: `Sidecar saved · ${this._file.name}.json` });
    } catch (err) {
      window.AuroraToast?.show({ variant: 'danger', title: 'Save failed', description: err.message });
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save sidecar';
    }
  }

  async _writeExifBack(annotation) {
    const name = this._file?.name?.toLowerCase() || '';
    if (!name.endsWith('.jpg') && !name.endsWith('.jpeg')) return;
    const { default: piexif } = await import('piexifjs');
    const ab  = await this._file.arrayBuffer();
    const b64 = _ab2b64(ab);
    let obj = {};
    try { obj = piexif.load(b64); } catch { obj = { '0th':{}, 'Exif':{}, 'GPS':{}, '1st':{} }; }
    if (annotation.caption) obj['0th'][piexif.ImageIFD.ImageDescription] = annotation.caption;
    const bytes = piexif.dump(obj);
    const nb64  = piexif.insert(bytes, b64);
    const blob  = new Blob([_b642ab(nb64)], { type:'image/jpeg' });
    const fh    = await this._dirHandle.getFileHandle(this._file.name, { create:false });
    const wr    = await fh.createWritable();
    await wr.write(blob); await wr.close();
  }
}

// ── Binary helpers ─────────────────────────────────────────────────────────────
function _ab2b64(ab) {
  let b = ''; const u = new Uint8Array(ab);
  for (let i = 0; i < u.byteLength; i++) b += String.fromCharCode(u[i]);
  return btoa(b);
}
function _b642ab(b64) {
  const b = atob(b64); const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u.buffer;
}
