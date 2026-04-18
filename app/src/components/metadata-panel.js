/**
 * ImageChef — MetadataPanel
 *
 * A unified, persistent right-side panel showing ALL metadata for an image:
 *   • Sidecar fields (editable: rating, flag, tags, caption, geo)
 *   • Full EXIF / file info (read-only, via image-info.js)
 *   • Vision / People / Computed (read-only, via asset-panel.js)
 *
 * Mounted as a fixed-width column inside any screen layout.
 * Collapses to a 36px strip when the user clicks the chevron.
 *
 * Usage:
 *   const panel = new MetadataPanel(containerEl, { dirHandle, onSaved });
 *   await panel.setFile(file);   // update displayed file
 *   panel.toggle();              // show/hide (in overlay mode)
 *   panel.show() / panel.hide()
 */

import {
  readSidecar, writeSidecar, listSidecarTags,
  reverseGeocode, buildSidecarPatch,
} from '../data/sidecar.js';
import { extractExif } from '../engine/exif-reader.js';

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    /* ── MetadataPanel shell ───────────────────────────── */
    .mp-panel {
      display:flex; flex-direction:column;
      width:300px; min-width:300px;
      height:100%; overflow:hidden;
      border-left:1px solid var(--ps-border);
      background:var(--ps-bg-surface);
      transition:width 200ms ease, min-width 200ms ease;
      flex-shrink:0;
    }
    .mp-panel.mp-hidden { display:none; }
    .mp-panel.mp-collapsed { width:36px; min-width:36px; }
    .mp-panel.mp-collapsed .mp-body,
    .mp-panel.mp-collapsed .mp-footer { display:none; }
    .mp-panel.mp-collapsed .mp-header { flex-direction:column; padding:8px 0; justify-content:flex-start; align-items:center; gap:8px; }
    .mp-panel.mp-collapsed .mp-header-title { writing-mode:vertical-rl; transform:rotate(180deg); font-size:11px; max-width:none; overflow:visible; }
    .mp-panel.mp-collapsed .mp-no-image { display:none; }

    .mp-header {
      display:flex; align-items:center; gap:8px;
      padding:10px 12px;
      border-bottom:1px solid var(--ps-border);
      flex-shrink:0; min-height:40px;
    }
    .mp-header-title {
      flex:1; font-size:12px; font-weight:500;
      color:var(--ps-text); overflow:hidden;
      text-overflow:ellipsis; white-space:nowrap;
    }
    .mp-collapse-btn {
      width:24px; height:24px; border-radius:4px;
      border:none; background:none; cursor:pointer;
      color:var(--ps-text-muted); display:flex;
      align-items:center; justify-content:center;
      flex-shrink:0; transition:background 100ms;
    }
    .mp-collapse-btn:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .mp-collapse-icon { font-size:18px; transition:transform 200ms; }
    .mp-panel.mp-collapsed .mp-collapse-icon { transform:rotate(180deg); }

    .mp-body { flex:1; overflow-y:auto; padding:0; }

    .mp-no-image {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:8px; padding:32px 16px; color:var(--ps-text-faint); text-align:center;
    }
    .mp-no-image .material-symbols-outlined { font-size:32px; opacity:.4; }
    .mp-no-image-text { font-size:12px; opacity:.6; }

    /* ── Sidecar editable block ───────────────────────── */
    .mp-sidecar { padding:12px; border-bottom:1px solid var(--ps-border); }

    .mp-label { font-size:10px; font-weight:600; text-transform:uppercase;
      letter-spacing:.07em; color:var(--ps-text-faint); margin-bottom:4px; display:block; }

    /* Rating */
    .mp-rating-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
    .mp-stars { display:flex; gap:2px; }
    .mp-star {
      font-size:18px; cursor:pointer; color:var(--ps-text-faint);
      font-family:'Material Symbols Outlined'; font-style:normal;
      transition:color 100ms; line-height:1; user-select:none;
    }
    .mp-star.filled { color:var(--ps-warning,#f59e0b); }
    .mp-star:hover { color:var(--ps-warning,#f59e0b); }
    .mp-flag-btns { display:flex; gap:4px; margin-left:auto; }
    .mp-flag-btn {
      padding:2px 7px; border-radius:5px; font-size:10px; font-weight:600;
      border:1px solid var(--ps-border); background:none;
      cursor:pointer; color:var(--ps-text-muted); transition:all 100ms;
    }
    .mp-flag-btn:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .mp-flag-btn.active-pick   { background:rgba(52,211,153,0.15); color:#34d399; border-color:#34d399; }
    .mp-flag-btn.active-reject { background:rgba(248,113,113,0.15); color:#f87171; border-color:#f87171; }
    .mp-flag-btn.active-unflag { background:var(--ps-bg-hover); color:var(--ps-text-muted); }

    /* Tags */
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

    /* Caption */
    .mp-textarea {
      width:100%; box-sizing:border-box;
      padding:6px 7px; border:1px solid var(--ps-border); border-radius:6px;
      background:var(--ps-bg-app); color:var(--ps-text);
      font-size:11px; line-height:1.5; resize:vertical; min-height:50px;
      font-family:inherit; margin-bottom:8px;
    }
    .mp-textarea:focus { outline:none; border-color:var(--ps-blue); }

    /* Input fields */
    .mp-input {
      width:100%; box-sizing:border-box;
      padding:5px 7px; border:1px solid var(--ps-border); border-radius:6px;
      background:var(--ps-bg-app); color:var(--ps-text); font-size:11px;
      font-family:inherit; margin-bottom:6px;
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

    /* ── Collapsible metadata sections ───────────────── */
    .mp-section { border-bottom:1px solid var(--ps-border); }
    .mp-section-hdr {
      display:flex; align-items:center; gap:6px; padding:8px 12px;
      cursor:pointer; user-select:none; transition:background 100ms;
    }
    .mp-section-hdr:hover { background:var(--ps-bg-hover); }
    .mp-section-title {
      font-size:10px; font-weight:600; text-transform:uppercase;
      letter-spacing:.07em; color:var(--ps-text-faint); flex:1;
    }
    .mp-section-toggle {
      font-size:16px; color:var(--ps-text-faint);
      font-family:'Material Symbols Outlined'; font-style:normal;
      transition:transform 200ms; line-height:1;
    }
    .mp-section.mp-sec-collapsed .mp-section-toggle { transform:rotate(-90deg); }
    .mp-section-body { padding:0 12px 10px; }
    .mp-section.mp-sec-collapsed .mp-section-body { display:none; }

    /* ── Footer ─────────────────────────────────────── */
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
    .mp-save-row .btn-primary  { flex:1; font-size:12px; padding:6px 10px; }
    .mp-save-row .btn-secondary { font-size:12px; padding:6px 10px; }
    .mp-no-save-note { font-size:10px; color:var(--ps-text-faint); text-align:center; padding:4px 0; }
  `;
  document.head.appendChild(s);
}

export class MetadataPanel {
  /**
   * @param {HTMLElement} rootEl - element to render the panel into
   * @param {object} opts
   * @param {FileSystemDirectoryHandle|null} opts.dirHandle - for sidecar read/write; null = read-only
   * @param {function} opts.onSaved - called with (file, sidecar) after a successful save
   * @param {boolean} opts.startCollapsed - initial collapsed state
   * @param {boolean} opts.startHidden - initial hidden state (for overlay/toggle mode)
   */
  constructor(rootEl, { dirHandle = null, onSaved = null, startCollapsed = false, startHidden = false } = {}) {
    this._root      = rootEl;
    this._dirHandle = dirHandle;
    this._onSaved   = onSaved;
    this._file      = null;
    this._sidecar   = null;
    this._tags      = [];
    this._rating    = null;
    this._flag      = null;
    this._allTags   = [];
    this._tagSuggest = null;
    this._panelEl   = null;
    this._dirty     = false;

    injectStyles();
    this._mount(startCollapsed, startHidden);
  }

  // ── Public API ────────────────────────────────────────────

  setDirHandle(handle) { this._dirHandle = handle; }

  async setFile(file) {
    if (!file) { this.clear(); return; }
    this._file    = file;
    this._sidecar = await readSidecar(this._dirHandle, file.name);
    this._tags    = [...(this._sidecar?.annotation?.tags || [])];
    this._rating  = this._sidecar?.annotation?.rating ?? null;
    this._flag    = this._sidecar?.annotation?.flag   ?? null;
    this._dirty   = false;

    // Update header title immediately
    const titleEl = this._panelEl?.querySelector('.mp-header-title');
    if (titleEl) titleEl.textContent = file.name;

    // Tag hints in background
    if (this._dirHandle) listSidecarTags(this._dirHandle).then(t => { this._allTags = t; });

    await this._renderBody();
  }

  clear() {
    this._file    = null;
    this._sidecar = null;
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

  show() { this._panelEl?.classList.remove('mp-hidden'); }
  hide() { this._panelEl?.classList.add('mp-hidden'); }
  toggle() { this._panelEl?.classList.toggle('mp-hidden'); }
  isVisible() { return !this._panelEl?.classList.contains('mp-hidden'); }
  collapse() { this._panelEl?.classList.add('mp-collapsed'); }
  expand() { this._panelEl?.classList.remove('mp-collapsed'); }
  isCollapsed() { return !!this._panelEl?.classList.contains('mp-collapsed'); }

  // ── Internal ──────────────────────────────────────────────

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
          <button class="btn-primary" id="mp-save">Save sidecar</button>
        </div>
      </div>`;

    this._panelEl = el;
    this._root.appendChild(el);

    el.querySelector('#mp-collapse').addEventListener('click', () => {
      el.classList.toggle('mp-collapsed');
    });
    el.querySelector('#mp-cancel')?.addEventListener('click', () => {
      if (this._file) this.setFile(this._file); // reload to discard changes
    });
    el.querySelector('#mp-save')?.addEventListener('click', () => this._save());
  }

  async _renderBody() {
    const body   = this._panelEl?.querySelector('.mp-body');
    const footer = this._panelEl?.querySelector('.mp-footer');
    if (!body || !this._file) return;

    const file    = this._file;
    const sidecar = this._sidecar;
    const ann     = sidecar?.annotation || {};
    const geo     = sidecar?.geo        || {};
    const comp    = sidecar?.computed   || {};
    const procs   = sidecar?.processing || [];
    const exifS   = sidecar?.exif       || {};
    const hasGPS  = !!(exifS.gpsLat || exifS.gpsLng);
    const canSave = !!this._dirHandle;

    body.innerHTML = `
      <!-- ── Sidecar editable section ──────────────────── -->
      <div class="mp-sidecar">
        <div style="margin-bottom:8px">
          <span class="mp-label">Rating &amp; Flag</span>
          <div class="mp-rating-row">
            <div class="mp-stars" id="mp-stars">
              ${[1,2,3,4,5].map(n => `
                <span class="mp-star ${(this._rating||0)>=n?'filled':''}" data-star="${n}">
                  ${(this._rating||0)>=n?'star':'star'}
                </span>`).join('')}
            </div>
            <div class="mp-flag-btns">
              <button class="mp-flag-btn ${this._flag==='pick'?'active-pick':''}" data-flag="pick">Pick</button>
              <button class="mp-flag-btn ${this._flag==='reject'?'active-reject':''}" data-flag="reject">Reject</button>
              <button class="mp-flag-btn ${!this._flag?'active-unflag':''}" data-flag="">Unflag</button>
            </div>
          </div>
        </div>

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

        <div style="margin-bottom:8px">
          <span class="mp-label">Caption</span>
          <textarea class="mp-textarea" id="mp-caption" rows="2"
            placeholder="Add a caption…">${_e(ann.caption||'')}</textarea>
        </div>

        <!-- Location -->
        <details open style="margin-bottom:4px">
          <summary class="mp-label" style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:4px">
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
            ${hasGPS ? `<div class="mp-readonly-val">📍 ${exifS.gpsLat?.toFixed(5)}, ${exifS.gpsLng?.toFixed(5)}</div>` : ''}
          </div>
        </details>
      </div>

      <!-- ── Collapsible read-only metadata sections ─── -->
      ${comp && Object.keys(comp).length ? `
      <div class="mp-section mp-sec-collapsed" id="mp-sec-computed">
        <div class="mp-section-hdr" data-sec="mp-sec-computed">
          <span class="mp-section-toggle">expand_more</span>
          <span class="mp-section-title">Computed</span>
        </div>
        <div class="mp-section-body">
          ${Object.entries(comp).map(([k,v]) => `
            <div style="display:flex;gap:8px;padding:3px 0;font-size:11px">
              <span style="color:var(--ps-text-faint);min-width:90px">${_e(k)}</span>
              <span style="color:var(--ps-text)">${_e(typeof v==='object'?JSON.stringify(v):String(v))}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}

      ${procs.length ? `
      <div class="mp-section mp-sec-collapsed" id="mp-sec-proc">
        <div class="mp-section-hdr" data-sec="mp-sec-proc">
          <span class="mp-section-toggle">expand_more</span>
          <span class="mp-section-title">Processing log</span>
          <span style="font-size:10px;color:var(--ps-text-faint)">${procs.length}</span>
        </div>
        <div class="mp-section-body">
          ${procs.slice().reverse().map(p => `
            <div style="font-size:11px;padding:4px 0;border-bottom:1px solid var(--ps-border)">
              <div><strong>${_e(p.recipe||'?')}</strong></div>
              <div style="color:var(--ps-text-faint)">${_fmtDate(p.at)}${p.output?` · ${_e(p.output)}`:''}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Placeholder: EXIF sections injected async below -->
      <div id="mp-exif-mount"></div>
      <div id="mp-asset-mount"></div>

      ${!canSave ? '<div class="mp-no-save-note" style="padding:8px">Sidecar editing not available in this view</div>' : ''}
    `;

    // Show/hide footer
    if (footer) {
      footer.style.display = canSave ? 'flex' : 'none';
    }

    this._bindBodyEvents(body);

    // Async: inject EXIF sections
    this._loadExifSection(file, body);
  }

  async _loadExifSection(file, body) {
    try {
      const { getImageInfo, renderImageInfoPanel, injectImageInfoStyles } = await import('../utils/image-info.js');
      const { renderExtractedMetadataForSidebar, injectAssetPanelStyles }  = await import('../utils/asset-panel.js');
      injectImageInfoStyles();
      injectAssetPanelStyles();

      const info    = await getImageInfo(file);
      const infoEl  = renderImageInfoPanel(info);

      const mount = body.querySelector('#mp-exif-mount');
      if (!mount || this._file !== file) return; // user navigated away

      // Wrap in a collapsible section
      const sec = document.createElement('div');
      sec.className = 'mp-section mp-sec-collapsed';
      sec.id = 'mp-sec-exif';
      sec.innerHTML = `
        <div class="mp-section-hdr" data-sec="mp-sec-exif">
          <span class="mp-section-toggle">expand_more</span>
          <span class="mp-section-title">File, Camera &amp; EXIF</span>
          <span style="font-size:10px;color:var(--ps-text-faint)">read-only</span>
        </div>
        <div class="mp-section-body"></div>`;
      sec.querySelector('.mp-section-body').appendChild(infoEl);
      mount.replaceWith(sec);

      // Bind toggle
      sec.querySelector('.mp-section-hdr').addEventListener('click', () => {
        sec.classList.toggle('mp-sec-collapsed');
      });

      // Extracted metadata (vision, people, custom)
      const extracted = await renderExtractedMetadataForSidebar(file);
      const assetMount = body.querySelector('#mp-asset-mount');
      if (extracted && assetMount && this._file === file) {
        const secA = document.createElement('div');
        secA.className = 'mp-section mp-sec-collapsed';
        secA.id = 'mp-sec-asset';
        secA.innerHTML = `
          <div class="mp-section-hdr" data-sec="mp-sec-asset">
            <span class="mp-section-toggle">expand_more</span>
            <span class="mp-section-title">Vision &amp; Analysis</span>
            <span style="font-size:10px;color:var(--ps-text-faint)">read-only</span>
          </div>
          <div class="mp-section-body"></div>`;
        secA.querySelector('.mp-section-body').appendChild(extracted);
        assetMount.replaceWith(secA);
        secA.querySelector('.mp-section-hdr').addEventListener('click', () => {
          secA.classList.toggle('mp-sec-collapsed');
        });
      } else {
        assetMount?.remove();
      }
    } catch (err) {
      console.warn('[MetadataPanel] Failed to load EXIF section:', err);
    }
  }

  _bindBodyEvents(body) {
    // Collapsible section toggles
    body.querySelectorAll('.mp-section-hdr').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const sec = body.querySelector(`#${hdr.dataset.sec}`);
        sec?.classList.toggle('mp-sec-collapsed');
      });
    });

    // Stars
    const starsEl = body.querySelector('#mp-stars');
    starsEl?.querySelectorAll('.mp-star').forEach(star => {
      star.addEventListener('click', () => {
        const n = parseInt(star.dataset.star);
        this._rating = this._rating === n ? null : n;
        this._dirty = true;
        starsEl.querySelectorAll('.mp-star').forEach((s, i) => {
          s.classList.toggle('filled', (this._rating || 0) > i);
          s.textContent = (this._rating || 0) > i ? 'star' : 'star';
        });
      });
    });

    // Flags
    body.querySelectorAll('.mp-flag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.flag || null;
        this._flag  = val;
        this._dirty = true;
        body.querySelectorAll('.mp-flag-btn').forEach(b => {
          b.classList.remove('active-pick', 'active-reject', 'active-unflag');
        });
        btn.classList.add(val === 'pick' ? 'active-pick' : val === 'reject' ? 'active-reject' : 'active-unflag');
      });
    });

    // Tags
    this._bindTagInput(body);
    body.querySelector('#mp-tag-wrap')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      this._tags  = this._tags.filter(t => t !== btn.dataset.remove);
      this._dirty = true;
      btn.closest('.mp-chip')?.remove();
    });

    // Caption change tracking
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
      finally { setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">my_location</span>Fill from GPS';
      }, 2000); }
    });
  }

  _bindTagInput(body) {
    const wrap  = body.querySelector('#mp-tag-wrap');
    const input = body.querySelector('#mp-tag-input');
    if (!input) return;
    wrap?.addEventListener('click', () => input.focus());
    input.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        this._addTag(input.value.trim().toLowerCase(), wrap, input);
      }
      if (e.key === 'Backspace' && !input.value && this._tags.length) {
        this._tags.pop();
        wrap.querySelector('.mp-chip:last-of-type')?.remove();
      }
    });
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      this._showTagSug(q, input, wrap);
    });
    input.addEventListener('blur', () => setTimeout(() => this._hideTagSug(), 200));
  }

  _addTag(tag, wrap, input) {
    tag = tag.replace(/,+$/, '').trim();
    if (!tag || this._tags.includes(tag)) return;
    this._tags.push(tag);
    this._dirty = true;
    const chip = document.createElement('span');
    chip.className = 'mp-chip';
    chip.dataset.tag = tag;
    chip.innerHTML = `${_e(tag)}<button class="mp-chip-remove" data-remove="${_e(tag)}">×</button>`;
    chip.querySelector('[data-remove]').addEventListener('click', () => {
      this._tags  = this._tags.filter(t => t !== tag);
      this._dirty = true;
      chip.remove();
    });
    wrap.insertBefore(chip, input);
    input.value = '';
    this._hideTagSug();
  }

  _showTagSug(q, input, wrap) {
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
      item.addEventListener('mousedown', e => { e.preventDefault(); this._addTag(t, wrap, input); });
      box.appendChild(item);
    });
    const rect = input.getBoundingClientRect();
    box.style.cssText = `top:${rect.bottom+4}px;left:${rect.left}px;`;
    document.body.appendChild(box);
    this._tagSuggest = box;
  }

  _hideTagSug() { this._tagSuggest?.remove(); this._tagSuggest = null; }

  async _save() {
    const body = this._panelEl?.querySelector('.mp-body');
    const btn  = this._panelEl?.querySelector('#mp-save');
    if (!btn || !this._file || !this._dirHandle) return;
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const exifWriteback = this._panelEl?.querySelector('#mp-writeback')?.checked;
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

    // Populate exif block from file if not yet set
    if (!merged.exif || !Object.keys(merged.exif).some(k => merged.exif[k])) {
      merged.exif = {
        cameraMake:  exif.Make                  || null,
        cameraModel: exif.Model                 || null,
        focalLength: exif.FocalLength           || null,
        aperture:    exif.FNumber               || null,
        iso:         exif.ISOSpeedRatings       || null,
        shutterSpeed:exif.ExposureTime ? `1/${Math.round(1/exif.ExposureTime)}` : null,
        dateTaken:   exif.DateTimeOriginal       || null,
        gpsLat:      exif.GPSLatitude  ?? null,
        gpsLng:      exif.GPSLongitude ?? null,
        gpsAltitude: exif.GPSAltitude  ?? null,
      };
    }
    merged.source = merged.source?.filename ? merged.source : {
      filename: this._file.name, sizeBytes: this._file.size,
    };

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

// ── Tiny helpers ────────────────────────────────────────────
function _e(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined,{dateStyle:'medium'}); } catch { return iso; }
}
function _ab2b64(ab) {
  let b=''; const u=new Uint8Array(ab); for(let i=0;i<u.byteLength;i++) b+=String.fromCharCode(u[i]); return btoa(b);
}
function _b642ab(b64) {
  const b=atob(b64); const u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u.buffer;
}
