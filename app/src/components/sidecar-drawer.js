/**
 * ImageChef — SidecarDrawer
 *
 * A right-hand slide-in panel that shows and edits the sidecar metadata
 * for an image. Mounts as a fixed overlay so the underlying grid stays visible.
 *
 * Usage:
 *   const drawer = new SidecarDrawer(document.body, { dirHandle, onSaved });
 *   drawer.open(file, fileList);   // fileList for prev/next navigation
 *   drawer.close();
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
    .sdc-overlay {
      position:fixed; inset:0; z-index:900;
      background:rgba(0,0,0,0.4);
      cursor:pointer;
      animation:sdc-bg-in 180ms ease-out forwards;
    }
    @keyframes sdc-bg-in { from{opacity:0} to{opacity:1} }

    .sdc-panel {
      position:fixed; top:0; right:0; bottom:0;
      width:340px; max-width:100vw;
      background:var(--ps-bg-surface);
      border-left:1px solid var(--ps-border);
      display:flex; flex-direction:column;
      z-index:901;
      box-shadow:-8px 0 32px rgba(0,0,0,0.18);
      animation:sdc-slide-in 220ms cubic-bezier(0.2,0,0,1) forwards;
    }
    @keyframes sdc-slide-in { from{transform:translateX(100%)} to{transform:translateX(0)} }

    .sdc-header {
      display:flex; align-items:center; gap:8px;
      padding:12px 16px;
      border-bottom:1px solid var(--ps-border);
      flex-shrink:0;
    }
    .sdc-header-title {
      flex:1; font-size:13px; font-weight:500;
      color:var(--ps-text); overflow:hidden;
      text-overflow:ellipsis; white-space:nowrap;
    }
    .sdc-nav-btn, .sdc-close-btn {
      width:28px; height:28px; border-radius:6px;
      border:none; background:none; cursor:pointer;
      color:var(--ps-text-muted); display:flex;
      align-items:center; justify-content:center;
      transition:background 100ms;
    }
    .sdc-nav-btn:hover, .sdc-close-btn:hover {
      background:var(--ps-bg-hover); color:var(--ps-text);
    }
    .sdc-nav-btn:disabled { opacity:.3; cursor:default; }
    .sdc-nav-btn:disabled:hover { background:none; }

    .sdc-body { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:16px; }

    /* Rating row */
    .sdc-rating-row { display:flex; align-items:center; gap:12px; }
    .sdc-stars { display:flex; gap:4px; }
    .sdc-star {
      font-size:20px; cursor:pointer;
      color:var(--ps-text-faint); transition:color 100ms;
      font-family:'Material Symbols Outlined'; font-style:normal;
    }
    .sdc-star.filled { color:var(--ps-warning,#f59e0b); }
    .sdc-star:hover { color:var(--ps-warning,#f59e0b); }
    .sdc-flag-btns { display:flex; gap:6px; margin-left:auto; }
    .sdc-flag-btn {
      padding:3px 8px; border-radius:6px; font-size:11px; font-weight:500;
      border:1px solid var(--ps-border); background:none;
      cursor:pointer; color:var(--ps-text-muted); transition:all 100ms;
    }
    .sdc-flag-btn:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .sdc-flag-btn.active-pick   { background:rgba(52,211,153,0.15); color:#34d399; border-color:#34d399; }
    .sdc-flag-btn.active-reject { background:rgba(248,113,113,0.15); color:#f87171; border-color:#f87171; }

    /* Tags */
    .sdc-label { font-size:11px; font-weight:600; text-transform:uppercase;
      letter-spacing:.06em; color:var(--ps-text-faint); margin-bottom:4px; }
    .sdc-tag-wrap {
      display:flex; flex-wrap:wrap; gap:5px; align-items:center;
      padding:6px 8px; border:1px solid var(--ps-border); border-radius:8px;
      min-height:34px; cursor:text; background:var(--ps-bg-app);
    }
    .sdc-tag-wrap:focus-within { border-color:var(--ps-blue); }
    .sdc-chip {
      display:inline-flex; align-items:center; gap:4px;
      background:var(--ps-bg-raised); border-radius:4px;
      padding:2px 6px 2px 8px; font-size:11px; color:var(--ps-text);
    }
    .sdc-chip-remove {
      cursor:pointer; color:var(--ps-text-muted); font-size:12px;
      line-height:1; background:none; border:none; padding:0;
    }
    .sdc-chip-remove:hover { color:var(--ps-text); }
    .sdc-tag-input {
      border:none; outline:none; background:none;
      font-size:12px; color:var(--ps-text); min-width:80px; flex:1;
    }
    .sdc-tag-suggestions {
      position:absolute; background:var(--ps-bg-surface);
      border:1px solid var(--ps-border); border-radius:8px;
      box-shadow:0 4px 12px rgba(0,0,0,.15);
      z-index:910; min-width:160px; overflow:hidden;
    }
    .sdc-tag-suggestion {
      padding:7px 12px; font-size:12px; cursor:pointer;
      color:var(--ps-text); transition:background 80ms;
    }
    .sdc-tag-suggestion:hover { background:var(--ps-bg-hover); }

    /* Caption */
    .sdc-textarea {
      width:100%; box-sizing:border-box;
      padding:8px; border:1px solid var(--ps-border); border-radius:8px;
      background:var(--ps-bg-app); color:var(--ps-text);
      font-size:12px; line-height:1.5; resize:vertical; min-height:60px;
      font-family:inherit;
    }
    .sdc-textarea:focus { outline:none; border-color:var(--ps-blue); }

    /* Location / EXIF / Computed sections */
    .sdc-section {}
    .sdc-section-header {
      display:flex; align-items:center; gap:6px;
      cursor:pointer; user-select:none; padding:4px 0;
    }
    .sdc-section-title {
      font-size:11px; font-weight:600; text-transform:uppercase;
      letter-spacing:.06em; color:var(--ps-text-faint); flex:1;
    }
    .sdc-section-badge {
      font-size:10px; color:var(--ps-text-faint);
    }
    .sdc-section-toggle {
      font-size:16px; color:var(--ps-text-faint);
      font-family:'Material Symbols Outlined'; font-style:normal;
      transition:transform 200ms;
    }
    .sdc-section.collapsed .sdc-section-toggle { transform:rotate(-90deg); }
    .sdc-section-body { display:flex; flex-direction:column; gap:8px; padding-top:8px; }
    .sdc-section.collapsed .sdc-section-body { display:none; }

    .sdc-field { display:flex; flex-direction:column; gap:3px; }
    .sdc-input {
      padding:6px 8px; border:1px solid var(--ps-border); border-radius:6px;
      background:var(--ps-bg-app); color:var(--ps-text); font-size:12px;
      font-family:inherit;
    }
    .sdc-input:focus { outline:none; border-color:var(--ps-blue); }
    .sdc-readonly {
      font-size:12px; color:var(--ps-text-muted); padding:4px 0;
      line-height:1.5;
    }
    .sdc-geocode-btn {
      align-self:flex-start; padding:4px 10px; font-size:11px;
      border-radius:6px; border:1px solid var(--ps-border);
      background:none; cursor:pointer; color:var(--ps-text-muted);
      display:flex; align-items:center; gap:4px; transition:all 100ms;
    }
    .sdc-geocode-btn:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .sdc-geocode-btn:disabled { opacity:.5; cursor:default; }

    /* Processing log */
    .sdc-proc-entry { font-size:11px; color:var(--ps-text-muted); padding:4px 0;
      border-bottom:1px solid var(--ps-border-subtle,var(--ps-border)); }
    .sdc-proc-entry:last-child { border-bottom:none; }

    /* Footer */
    .sdc-footer {
      padding:12px 16px; border-top:1px solid var(--ps-border);
      display:flex; align-items:center; gap:8px; flex-shrink:0;
    }
    .sdc-exif-writeback { display:flex; align-items:center; gap:6px;
      font-size:11px; color:var(--ps-text-muted); flex:1; cursor:pointer; }
    .sdc-exif-writeback input { cursor:pointer; }
  `;
  document.head.appendChild(s);
}

export class SidecarDrawer {
  constructor(mountEl, { dirHandle, onSaved } = {}) {
    this._mount      = mountEl;
    this._dirHandle  = dirHandle;
    this._onSaved    = onSaved;
    this._file       = null;
    this._fileList   = [];
    this._sidecar    = null;
    this._tags       = [];
    this._overlay    = null;
    this._panel      = null;
    this._allTags    = [];   // tag hints from other sidecars
    this._tagInput   = null;
    this._tagSuggest = null;
    injectStyles();
  }

  /** Update the directory handle (e.g. when user navigates to a new folder) */
  setDirHandle(handle) {
    this._dirHandle = handle;
  }

  /** Open the drawer for `file`. `fileList` is the full list for prev/next navigation. */
  async open(file, fileList = []) {
    this._file     = file;
    this._fileList  = fileList;
    this._sidecar  = await readSidecar(this._dirHandle, file.name);
    this._tags     = [...(this._sidecar?.annotation?.tags || [])];
    this._rating   = this._sidecar?.annotation?.rating ?? null;
    this._flag     = this._sidecar?.annotation?.flag   ?? null;

    // Kick off tag hint scan in background
    listSidecarTags(this._dirHandle).then(t => { this._allTags = t; });

    this._render();
  }

  close() {
    this._overlay?.remove();
    this._panel?.remove();
    this._overlay = null;
    this._panel   = null;
    this._tagSuggest?.remove();
    this._tagSuggest = null;
  }

  _currentIdx() { return this._fileList.findIndex(f => f.name === this._file?.name); }

  async _navigate(delta) {
    const idx     = this._currentIdx();
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= this._fileList.length) return;
    await this.open(this._fileList[nextIdx], this._fileList);
  }

  _render() {
    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'sdc-overlay';
    overlay.addEventListener('click', () => this.close());
    this._overlay = overlay;

    const panel = document.createElement('div');
    panel.className = 'sdc-panel';
    panel.addEventListener('click', e => e.stopPropagation());
    this._panel = panel;

    const idx    = this._currentIdx();
    const total  = this._fileList.length;
    const exif   = this._sidecar?.exif || {};
    const geo    = this._sidecar?.geo  || {};
    const ann    = this._sidecar?.annotation || {};
    const comp   = this._sidecar?.computed   || {};
    const procs  = this._sidecar?.processing || [];
    const hasGPS = !!(this._sidecar?.exif?.gpsLat || this._sidecar?.exif?.gpsLng);

    panel.innerHTML = `
      <div class="sdc-header">
        <button class="sdc-nav-btn" id="sdc-prev" title="Previous" ${idx <= 0 ? 'disabled' : ''}>
          <span class="material-symbols-outlined" style="font-size:18px">chevron_left</span>
        </button>
        <div class="sdc-header-title" title="${escH(this._file?.name || '')}">${escH(this._file?.name || '')}</div>
        ${total > 0 ? `<span style="font-size:11px;color:var(--ps-text-faint)">${idx + 1}/${total}</span>` : ''}
        <button class="sdc-nav-btn" id="sdc-next" title="Next" ${idx >= total - 1 ? 'disabled' : ''}>
          <span class="material-symbols-outlined" style="font-size:18px">chevron_right</span>
        </button>
        <button class="sdc-close-btn" id="sdc-close">
          <span class="material-symbols-outlined" style="font-size:18px">close</span>
        </button>
      </div>

      <div class="sdc-body">

        <!-- Rating + Flag -->
        <div>
          <div class="sdc-label">Rating &amp; Flag</div>
          <div class="sdc-rating-row">
            <div class="sdc-stars" id="sdc-stars">
              ${[1,2,3,4,5].map(n => `
                <span class="sdc-star ${(this._rating || 0) >= n ? 'filled' : ''}"
                      data-star="${n}" title="${n} star${n>1?'s':''}">${(this._rating||0)>=n?'star':'star'}</span>
              `).join('')}
            </div>
            <div class="sdc-flag-btns">
              <button class="sdc-flag-btn ${this._flag==='pick'?'active-pick':''}" data-flag="pick">Pick</button>
              <button class="sdc-flag-btn ${this._flag==='reject'?'active-reject':''}" data-flag="reject">Reject</button>
              <button class="sdc-flag-btn ${!this._flag?'active':''}" data-flag="">Unflag</button>
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div>
          <div class="sdc-label">Tags</div>
          <div class="sdc-tag-wrap" id="sdc-tag-wrap">
            ${this._tags.map(t => `
              <span class="sdc-chip" data-tag="${escH(t)}">
                ${escH(t)}
                <button class="sdc-chip-remove" data-remove="${escH(t)}" title="Remove">×</button>
              </span>`).join('')}
            <input class="sdc-tag-input" id="sdc-tag-input" placeholder="Add tag…" autocomplete="off">
          </div>
        </div>

        <!-- Caption -->
        <div>
          <div class="sdc-label">Caption</div>
          <textarea class="sdc-textarea" id="sdc-caption" placeholder="Add a caption…" rows="3">${escH(ann.caption || '')}</textarea>
        </div>

        <!-- Location (collapsible) -->
        <div class="sdc-section" id="sdc-sec-geo">
          <div class="sdc-section-header" data-toggle="sdc-sec-geo">
            <span class="material-symbols-outlined sdc-section-toggle" style="font-size:16px">expand_more</span>
            <span class="sdc-section-title">Location</span>
            ${hasGPS ? '<span class="sdc-section-badge">GPS ✓</span>' : ''}
          </div>
          <div class="sdc-section-body">
            ${hasGPS ? `
              <button class="sdc-geocode-btn" id="sdc-geocode-btn">
                <span class="material-symbols-outlined" style="font-size:14px">my_location</span>
                Fill from GPS
              </button>` : ''}
            <div class="sdc-field">
              <div class="sdc-label">City</div>
              <input class="sdc-input" id="sdc-city" value="${escH(geo.city||'')}" placeholder="City">
            </div>
            <div class="sdc-field">
              <div class="sdc-label">Region / State</div>
              <input class="sdc-input" id="sdc-region" value="${escH(geo.region||'')}" placeholder="Region">
            </div>
            <div class="sdc-field">
              <div class="sdc-label">Country</div>
              <input class="sdc-input" id="sdc-country" value="${escH(geo.country||'')}" placeholder="Country">
            </div>
            <div class="sdc-field">
              <div class="sdc-label">Country Code</div>
              <input class="sdc-input" id="sdc-country-code" value="${escH(geo.countryCode||'')}" placeholder="e.g. GB" style="width:80px">
            </div>
            ${hasGPS ? `<div class="sdc-readonly">GPS: ${this._sidecar.exif.gpsLat?.toFixed(5)}, ${this._sidecar.exif.gpsLng?.toFixed(5)}</div>` : ''}
          </div>
        </div>

        <!-- Camera / EXIF (collapsible, read-only) -->
        <div class="sdc-section collapsed" id="sdc-sec-exif">
          <div class="sdc-section-header" data-toggle="sdc-sec-exif">
            <span class="material-symbols-outlined sdc-section-toggle" style="font-size:16px">expand_more</span>
            <span class="sdc-section-title">Camera &amp; EXIF</span>
            <span class="sdc-section-badge" style="color:var(--ps-text-faint);font-size:10px">read-only</span>
          </div>
          <div class="sdc-section-body">
            ${this._renderExifBlock(exif)}
          </div>
        </div>

        <!-- Computed (collapsible, read-only) -->
        ${Object.keys(comp).length > 0 ? `
        <div class="sdc-section collapsed" id="sdc-sec-comp">
          <div class="sdc-section-header" data-toggle="sdc-sec-comp">
            <span class="material-symbols-outlined sdc-section-toggle" style="font-size:16px">expand_more</span>
            <span class="sdc-section-title">Computed</span>
            <span class="sdc-section-badge" style="color:var(--ps-text-faint);font-size:10px">read-only</span>
          </div>
          <div class="sdc-section-body">
            ${this._renderComputedBlock(comp)}
          </div>
        </div>` : ''}

        <!-- Processing log (collapsible, read-only) -->
        ${procs.length > 0 ? `
        <div class="sdc-section collapsed" id="sdc-sec-proc">
          <div class="sdc-section-header" data-toggle="sdc-sec-proc">
            <span class="material-symbols-outlined sdc-section-toggle" style="font-size:16px">expand_more</span>
            <span class="sdc-section-title">Processing log</span>
            <span class="sdc-section-badge">${procs.length} run${procs.length!==1?'s':''}</span>
          </div>
          <div class="sdc-section-body">
            ${procs.slice().reverse().map(p => `
              <div class="sdc-proc-entry">
                <strong>${escH(p.recipe||'Unknown')}</strong> &nbsp;·&nbsp; ${formatAge(p.at)}
                ${p.output ? `<br><span style="font-size:10px;opacity:.6">${escH(p.output)}</span>` : ''}
              </div>`).join('')}
          </div>
        </div>` : ''}

      </div>

      <div class="sdc-footer">
        <label class="sdc-exif-writeback">
          <input type="checkbox" id="sdc-writeback" checked>
          Write to image EXIF
        </label>
        <button class="btn-secondary" id="sdc-cancel">Cancel</button>
        <button class="btn-primary" id="sdc-save">Save sidecar</button>
      </div>
    `;

    this._mount.appendChild(overlay);
    this._mount.appendChild(panel);

    this._bindEvents(panel);
  }

  _renderExifBlock(exif) {
    const rows = [];
    if (exif.cameraMake || exif.cameraModel) {
      rows.push(`<div class="sdc-readonly">${escH([exif.cameraMake, exif.cameraModel].filter(Boolean).join(' '))}</div>`);
    }
    const specs = [
      exif.focalLength    ? `${exif.focalLength}mm` : null,
      exif.aperture       ? `f/${exif.aperture}`    : null,
      exif.shutterSpeed   ? exif.shutterSpeed        : null,
      exif.iso            ? `ISO ${exif.iso}`        : null,
    ].filter(Boolean);
    if (specs.length) rows.push(`<div class="sdc-readonly">${specs.join(' · ')}</div>`);
    if (exif.dateTaken) rows.push(`<div class="sdc-readonly">${escH(formatDate(exif.dateTaken))}</div>`);
    if (!rows.length) rows.push('<div class="sdc-readonly" style="opacity:.5">No EXIF data</div>');
    return rows.join('');
  }

  _renderComputedBlock(comp) {
    return Object.entries(comp).map(([k, v]) => {
      const display = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `<div class="sdc-readonly"><strong>${escH(k)}:</strong> ${escH(display)}</div>`;
    }).join('');
  }

  _bindEvents(panel) {
    // Close / nav
    panel.querySelector('#sdc-close')?.addEventListener('click', () => this.close());
    panel.querySelector('#sdc-prev')?.addEventListener('click', () => this._navigate(-1));
    panel.querySelector('#sdc-next')?.addEventListener('click', () => this._navigate(1));
    panel.querySelector('#sdc-cancel')?.addEventListener('click', () => this.close());

    // Collapsible sections
    panel.querySelectorAll('[data-toggle]').forEach(h => {
      h.addEventListener('click', () => {
        const sec = panel.querySelector(`#${h.dataset.toggle}`);
        sec?.classList.toggle('collapsed');
      });
    });

    // Stars
    const starsEl = panel.querySelector('#sdc-stars');
    starsEl?.querySelectorAll('.sdc-star').forEach(star => {
      star.addEventListener('click', () => {
        const n = parseInt(star.dataset.star);
        this._rating = this._rating === n ? null : n;
        starsEl.querySelectorAll('.sdc-star').forEach((s, i) => {
          s.classList.toggle('filled', (this._rating || 0) > i);
        });
      });
    });

    // Flags
    panel.querySelectorAll('.sdc-flag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.flag || null;
        this._flag = val;
        panel.querySelectorAll('.sdc-flag-btn').forEach(b => {
          b.classList.remove('active-pick', 'active-reject', 'active');
        });
        btn.classList.add(val === 'pick' ? 'active-pick' : val === 'reject' ? 'active-reject' : 'active');
      });
    });

    // Tags
    this._bindTagInput(panel);

    // Chip removal
    panel.querySelector('#sdc-tag-wrap')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      const tag = btn.dataset.remove;
      this._tags = this._tags.filter(t => t !== tag);
      btn.closest('.sdc-chip')?.remove();
    });

    // Geocode
    panel.querySelector('#sdc-geocode-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Looking up…';
      try {
        const lat = this._sidecar?.exif?.gpsLat;
        const lng = this._sidecar?.exif?.gpsLng;
        if (lat == null || lng == null) throw new Error('No GPS');
        const result = await reverseGeocode(lat, lng);
        panel.querySelector('#sdc-city').value         = result.city;
        panel.querySelector('#sdc-region').value       = result.region;
        panel.querySelector('#sdc-country').value      = result.country;
        panel.querySelector('#sdc-country-code').value = result.countryCode;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">check</span> Done';
      } catch (err) {
        btn.textContent = 'Geocode failed';
        console.warn('[sidecar] Geocode error:', err);
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">my_location</span> Fill from GPS';
        }, 2000);
      }
    });

    // Save
    panel.querySelector('#sdc-save')?.addEventListener('click', () => this._save(panel));
  }

  _bindTagInput(panel) {
    const wrap    = panel.querySelector('#sdc-tag-wrap');
    const input   = panel.querySelector('#sdc-tag-input');
    if (!input) return;
    this._tagInput = input;

    // Click on wrap focuses input
    wrap?.addEventListener('click', () => input.focus());

    input.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        this._addTag(input.value.trim().toLowerCase(), wrap, input);
      }
      if (e.key === 'Backspace' && !input.value && this._tags.length) {
        this._tags.pop();
        wrap.querySelector('.sdc-chip:last-of-type')?.remove();
      }
    });

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      this._showTagSuggestions(q, input, wrap);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => this._hideTagSuggestions(), 200);
    });
  }

  _addTag(tag, wrap, input) {
    tag = tag.replace(/,+$/, '').trim();
    if (!tag || this._tags.includes(tag)) return;
    this._tags.push(tag);
    const chip = document.createElement('span');
    chip.className = 'sdc-chip';
    chip.dataset.tag = tag;
    chip.innerHTML = `${escH(tag)}<button class="sdc-chip-remove" data-remove="${escH(tag)}" title="Remove">×</button>`;
    chip.querySelector('[data-remove]').addEventListener('click', () => {
      this._tags = this._tags.filter(t => t !== tag);
      chip.remove();
    });
    wrap.insertBefore(chip, input);
    input.value = '';
    this._hideTagSuggestions();
  }

  _showTagSuggestions(q, input, wrap) {
    this._hideTagSuggestions();
    if (!q) return;
    const hits = this._allTags.filter(t => t.includes(q) && !this._tags.includes(t));
    if (!hits.length) return;

    const box = document.createElement('div');
    box.className = 'sdc-tag-suggestions';
    hits.slice(0, 8).forEach(t => {
      const item = document.createElement('div');
      item.className = 'sdc-tag-suggestion';
      item.textContent = t;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        this._addTag(t, wrap, input);
      });
      box.appendChild(item);
    });
    const rect = input.getBoundingClientRect();
    box.style.cssText = `top:${rect.bottom + 4}px;left:${rect.left}px;position:fixed`;
    document.body.appendChild(box);
    this._tagSuggest = box;
  }

  _hideTagSuggestions() {
    this._tagSuggest?.remove();
    this._tagSuggest = null;
  }

  async _save(panel) {
    const btn = panel.querySelector('#sdc-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const exifWriteback = panel.querySelector('#sdc-writeback')?.checked;

    const formValues = {
      rating:      this._rating,
      flag:        this._flag || null,
      tags:        [...this._tags],
      caption:     panel.querySelector('#sdc-caption')?.value?.trim() || '',
      city:        panel.querySelector('#sdc-city')?.value?.trim()    || '',
      region:      panel.querySelector('#sdc-region')?.value?.trim()  || '',
      country:     panel.querySelector('#sdc-country')?.value?.trim() || '',
      countryCode: panel.querySelector('#sdc-country-code')?.value?.trim().toUpperCase() || '',
    };

    // Build sidecar, including a source block from EXIF
    const exif = await extractExif(this._file).catch(() => ({}));
    const merged = buildSidecarPatch(this._sidecar, formValues);

    // Populate exif block from current file (first save or update)
    if (!merged.exif || Object.keys(merged.exif).length === 0) {
      merged.exif = {
        cameraMake:   exif.Make        || null,
        cameraModel:  exif.Model       || null,
        focalLength:  exif.FocalLength || null,
        aperture:     exif.FNumber     || null,
        iso:          exif.ISOSpeedRatings || null,
        shutterSpeed: exif.ExposureTime   ? `1/${Math.round(1 / exif.ExposureTime)}` : null,
        dateTaken:    exif.DateTimeOriginal || null,
        gpsLat:       exif.GPSLatitude  ?? null,
        gpsLng:       exif.GPSLongitude ?? null,
        gpsAltitude:  exif.GPSAltitude  ?? null,
      };
    }
    merged.source = merged.source?.filename ? merged.source : {
      filename:  this._file.name,
      sizeBytes: this._file.size,
    };

    try {
      await writeSidecar(this._dirHandle, this._file.name, merged);

      if (exifWriteback) {
        await this._writeExifBack(merged.annotation, exif).catch(err => {
          console.warn('[sidecar] EXIF write-back failed (non-fatal):', err);
        });
      }

      this._sidecar = merged;
      this._onSaved?.(this._file, merged);
      window.AuroraToast?.show({ variant: 'success', title: `Sidecar saved · ${this._file.name}.json` });
      this.close();
    } catch (err) {
      window.AuroraToast?.show({ variant: 'danger', title: 'Save failed', description: err.message });
      btn.disabled = false;
      btn.textContent = 'Save sidecar';
    }
  }

  async _writeExifBack(annotation, exif) {
    // Only write back to JPEG/JPG files (piexifjs doesn't support RAW/PNG)
    const name = this._file?.name?.toLowerCase() || '';
    if (!name.endsWith('.jpg') && !name.endsWith('.jpeg')) return;

    const { default: piexif } = await import('piexifjs');
    const ab  = await this._file.arrayBuffer();
    const b64 = _ab2b64(ab);

    let exifObj = {};
    try { exifObj = piexif.load(b64); } catch { exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {} }; }

    if (annotation.caption) {
      exifObj['0th'][piexif.ImageIFD.ImageDescription] = annotation.caption;
    }
    if (annotation.rating != null) {
      // XMP Rating is non-standard in piexifjs; store as UserComment as fallback
      exifObj['Exif'][piexif.ExifIFD.UserComment] = `Rating:${annotation.rating}`;
    }

    const exifBytes = piexif.dump(exifObj);
    const newB64    = piexif.insert(exifBytes, b64);
    const newBytes  = _b642ab(newB64);
    const blob      = new Blob([newBytes], { type: 'image/jpeg' });

    // Write back via File System Access API
    const fh       = await this._dirHandle.getFileHandle(this._file.name, { create: false });
    const writable  = await fh.createWritable();
    await writable.write(blob);
    await writable.close();
  }
}

// ─── Helpers ───────────────────────────────────────────────

function escH(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return String(d); }
}

function formatAge(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch { return iso; }
}

function _ab2b64(ab) {
  let binary = '';
  const bytes = new Uint8Array(ab);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function _b642ab(b64) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
