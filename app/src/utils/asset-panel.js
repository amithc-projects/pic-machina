/**
 * PicMachina — Asset Metadata Panel
 *
 * Renders a read/edit panel for an asset's stored metadata.
 * Call renderAssetPanel(file) → returns a DOM element.
 *
 * Sections displayed:
 *   • EXIF          — date, camera, GPS, exposure (read-only)
 *   • Geocode       — city, country, state etc. (read-only)
 *   • OCR           — extracted text + tags (read-only)
 *   • Vision        — face count, person count, pose (read-only)
 *   • Custom Fields — sidecar key/value map (editable: add / edit / delete)
 */

import { initDB }                              from '../data/db.js';
import { ingestFile, patchAsset,
         setSidecarField }                     from '../data/assets.js';

// ── Style injection ─────────────────────────────────────────

let _stylesInjected = false;
export function injectAssetPanelStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    .ap-panel {
      display: flex; flex-direction: column; height: 100%; overflow-y: auto;
      padding: 12px; gap: 12px; font-size: 13px; color: var(--ps-text);
      box-sizing: border-box;
    }
    .ap-section {
      background: var(--ps-bg-surface);
      border: 1px solid var(--ps-border);
      border-radius: 10px;
      overflow: hidden;
    }
    .ap-section-head {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px;
      font-size: 11px; font-weight: 600; letter-spacing: .04em;
      text-transform: uppercase; color: var(--ps-text-muted);
      background: var(--ps-bg-app);
      border-bottom: 1px solid var(--ps-border);
      cursor: pointer; user-select: none;
    }
    .ap-section-head .material-symbols-outlined { font-size: 14px; }
    .ap-section-head .ap-chevron { margin-left: auto; font-size: 14px; transition: transform 200ms; }
    .ap-section-head.is-collapsed .ap-chevron { transform: rotate(-90deg); }
    .ap-section-body { padding: 4px 0; }
    .ap-section.is-collapsed .ap-section-body { display: none; }
    .ap-row {
      display: grid; grid-template-columns: 120px 1fr;
      gap: 4px 8px; align-items: start;
      padding: 5px 12px;
    }
    .ap-row:hover { background: var(--ps-bg-hover); }
    .ap-key {
      font-size: 11px; color: var(--ps-text-muted); font-weight: 500;
      padding-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .ap-val {
      font-size: 12px; color: var(--ps-text);
      word-break: break-word; line-height: 1.4;
    }
    .ap-val-muted { color: var(--ps-text-faint); font-style: italic; }
    .ap-ocr-text {
      padding: 8px 12px; font-size: 11px; font-family: var(--font-mono);
      color: var(--ps-text-muted); line-height: 1.5;
      max-height: 100px; overflow-y: auto;
      background: var(--ps-bg-app); border-top: 1px solid var(--ps-border);
    }

    /* Editable sidecar rows */
    .ap-sidecar-row {
      display: grid; grid-template-columns: 110px 1fr auto;
      gap: 4px 6px; align-items: center; padding: 4px 8px;
    }
    .ap-sidecar-row:hover { background: var(--ps-bg-hover); }
    .ap-sidecar-key, .ap-sidecar-val {
      background: transparent; border: 1px solid transparent;
      border-radius: 5px; padding: 3px 6px; font-size: 12px;
      color: var(--ps-text); width: 100%; box-sizing: border-box;
      font-family: inherit;
      transition: border-color 120ms, background 120ms;
    }
    .ap-sidecar-key { color: var(--ps-text-muted); font-weight: 500; font-size: 11px; }
    .ap-sidecar-val:hover, .ap-sidecar-val:focus,
    .ap-sidecar-key:hover, .ap-sidecar-key:focus {
      border-color: var(--ps-blue); background: var(--ps-bg-app); outline: none;
    }
    .ap-sidecar-del {
      background: transparent; border: none; cursor: pointer;
      color: var(--ps-text-faint); display: flex; align-items: center;
      border-radius: 4px; padding: 2px; opacity: 0; transition: opacity 120ms;
    }
    .ap-sidecar-del .material-symbols-outlined { font-size: 14px; }
    .ap-sidecar-row:hover .ap-sidecar-del { opacity: 1; }
    .ap-sidecar-del:hover { color: #e55; background: rgba(220,50,50,.1); }
    .ap-add-row {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; border-top: 1px solid var(--ps-border);
      margin-top: 2px;
    }
    .ap-add-key, .ap-add-val {
      flex: 1; background: var(--ps-bg-app); border: 1px solid var(--ps-border);
      border-radius: 5px; padding: 4px 8px; font-size: 12px;
      color: var(--ps-text); font-family: inherit;
    }
    .ap-add-key:focus, .ap-add-val:focus { outline: none; border-color: var(--ps-blue); }
    .ap-add-key { max-width: 110px; }
    .ap-add-btn {
      background: var(--ps-blue); border: none; color: #fff; cursor: pointer;
      border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600;
      white-space: nowrap; flex-shrink: 0;
    }
    .ap-add-btn:hover { filter: brightness(1.1); }
    .ap-empty { padding: 10px 12px; font-size: 12px; color: var(--ps-text-faint); font-style: italic; }
    .ap-hash { font-family: var(--font-mono); font-size: 10px; color: var(--ps-text-faint); padding: 6px 12px 8px; }
    .ap-loading { display:flex; align-items:center; justify-content:center; height:100%; gap:8px; }
    .ap-save-badge {
      font-size:10px; color: var(--ps-green, #22c55e); font-weight:600;
      margin-left: 6px; opacity: 0; transition: opacity 400ms;
    }
    .ap-save-badge.is-visible { opacity: 1; }
  `;
  document.head.appendChild(s);
}

// ── Helpers ─────────────────────────────────────────────────

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function section(icon, title, bodyHtml, collapsed = false) {
  const sec = document.createElement('div');
  sec.className = `ap-section${collapsed ? ' is-collapsed' : ''}`;
  sec.innerHTML = `
    <div class="ap-section-head">
      <span class="material-symbols-outlined">${escHtml(icon)}</span>
      ${escHtml(title)}
      <span class="material-symbols-outlined ap-chevron">expand_more</span>
    </div>
    <div class="ap-section-body">${bodyHtml}</div>
  `;
  sec.querySelector('.ap-section-head').addEventListener('click', () => {
    sec.classList.toggle('is-collapsed');
  });
  return sec;
}

function row(key, val) {
  if (val == null || val === '') return '';
  return `<div class="ap-row"><div class="ap-key">${escHtml(key)}</div><div class="ap-val">${escHtml(String(val))}</div></div>`;
}

// ── Sidebar extracted-metadata renderer ──────────────────────
// Uses img-info-* CSS classes to match the embedded metadata panel style.

let _sidebarStylesInjected = false;
function injectSidebarStyles() {
  if (_sidebarStylesInjected) return;
  _sidebarStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    .ii-copy-row { display:flex; align-items:baseline; gap:4px; }
    .ii-copy-val { flex:1; }
    .ii-copy-btn {
      flex-shrink:0; background:none; border:none; cursor:pointer;
      color:var(--ps-text-faint); padding:0 2px; border-radius:3px;
      display:inline-flex; align-items:center; opacity:0; transition:opacity 120ms;
    }
    .ii-copy-btn .material-symbols-outlined { font-size:11px; }
    tr:hover .ii-copy-btn { opacity:1; }
    .ii-copy-btn:hover { color:var(--ps-blue); background:var(--ps-bg-hover); }
    .ii-copy-btn.did-copy { color:var(--ps-green, #22c55e); opacity:1; }
    .img-info-extracted-heading {
      padding:10px 14px 4px;
      font-size:11px; font-weight:700; letter-spacing:.06em;
      text-transform:uppercase; color:var(--ps-text-faint);
      border-top:1px solid var(--ps-border);
    }
  `;
  document.head.appendChild(s);
}

function makeCopyBtn(token) {
  const btn = document.createElement('button');
  btn.className = 'ii-copy-btn';
  btn.title = `Copy ${token}`;
  btn.innerHTML = `<span class="material-symbols-outlined">content_copy</span>`;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    navigator.clipboard.writeText(token).then(() => {
      btn.classList.add('did-copy');
      btn.innerHTML = `<span class="material-symbols-outlined">check</span>`;
      setTimeout(() => {
        btn.classList.remove('did-copy');
        btn.innerHTML = `<span class="material-symbols-outlined">content_copy</span>`;
      }, 1400);
    });
  });
  return btn;
}

function sidebarRow(table, label, value, token) {
  if (value == null || value === '' || value === 0 && token !== '{{sidecar.faceCount}}') return;
  const tr = document.createElement('tr');
  const keyTd = document.createElement('td');
  keyTd.className = 'img-info-key';
  keyTd.textContent = label;
  const valTd = document.createElement('td');
  valTd.className = 'img-info-val';
  const row = document.createElement('span');
  row.className = 'ii-copy-row';
  const valSpan = document.createElement('span');
  valSpan.className = 'ii-copy-val';
  valSpan.textContent = String(value);
  row.appendChild(valSpan);
  if (token) row.appendChild(makeCopyBtn(token));
  valTd.appendChild(row);
  tr.appendChild(keyTd);
  tr.appendChild(valTd);
  table.appendChild(tr);
}

function sidebarSection(title, icon, rows) {
  // rows is a <table> element; returns a <details> matching img-info-* styles
  if (!rows.rows.length) return null;
  const details = document.createElement('details');
  details.open = true;
  details.className = 'img-info-section';
  const summary = document.createElement('summary');
  summary.className = 'img-info-section-title';
  summary.innerHTML = `<span class="material-symbols-outlined" style="font-size:13px">${escHtml(icon)}</span> ${escHtml(title)}`;
  details.appendChild(summary);
  details.appendChild(rows);
  return details;
}

/**
 * Render extracted-metadata rows for the right sidebar, matching img-info-* style.
 * Appended below renderImageInfoPanel() in renderInfoPanel().
 * @param {File} file
 * @returns {Promise<HTMLElement|null>}  null if nothing to show
 */
export async function renderExtractedMetadataForSidebar(file) {
  injectSidebarStyles();
  try {
    await initDB();
    const asset = await ingestFile(file);

    // Filename fallback — output file may differ from input
    const isEnriched = a => a.geo || a.ocr || a.vision || Object.keys(a.sidecar ?? {}).length;
    if (!isEnriched(asset)) {
      const { getAssetsByFilename } = await import('../data/assets.js');
      const matches = await getAssetsByFilename(file.name);
      const score   = a => [a.geo, a.ocr, a.vision].filter(Boolean).length + Object.keys(a.sidecar ?? {}).length;
      const best    = matches.sort((a, b) => score(b) - score(a))[0];
      if (best && score(best) > 0) {
        Object.assign(asset, {
          geo:    asset.geo    ?? best.geo,
          ocr:    asset.ocr    ?? best.ocr,
          vision: asset.vision ?? best.vision,
          sidecar: Object.keys(asset.sidecar ?? {}).length ? asset.sidecar : (best.sidecar ?? {}),
          exif:   Object.keys(asset.exif ?? {}).length    ? asset.exif    : (best.exif ?? {}),
        });
      }
    }

    if (!isEnriched(asset)) return null;

    const frag = document.createDocumentFragment();

    // Heading
    const heading = document.createElement('div');
    heading.className = 'img-info-extracted-heading';
    heading.textContent = 'Extracted Metadata';
    frag.appendChild(heading);

    // ── Geocode ──────────────────────────────────────────────
    if (asset.geo) {
      const t = document.createElement('table');
      t.className = 'img-info-table';
      const g = asset.geo;
      sidebarRow(t, 'Location',  g.location,  '{{sidecar.location}}');
      sidebarRow(t, 'City',      g.city,       '{{sidecar.city}}');
      sidebarRow(t, 'State',     g.state,      '{{sidecar.state}}');
      sidebarRow(t, 'Country',   g.country,    '{{sidecar.country}}');
      sidebarRow(t, 'Road',      g.road,       '{{sidecar.road}}');
      sidebarRow(t, 'Postcode',  g.postcode,   '{{sidecar.postcode}}');
      const sec = sidebarSection('Geocode', 'location_on', t);
      if (sec) frag.appendChild(sec);
    }

    // ── OCR ──────────────────────────────────────────────────
    if (asset.ocr) {
      const t = document.createElement('table');
      t.className = 'img-info-table';
      const o = asset.ocr;
      if (o.tags?.length) sidebarRow(t, 'Tags',  o.tags.join(', '), '{{sidecar.ocrTags}}');
      if (o.text)         sidebarRow(t, 'Text',  o.text.slice(0, 120) + (o.text.length > 120 ? '…' : ''), '{{sidecar.ocrText}}');
      const sec = sidebarSection('OCR Text', 'text_fields', t);
      if (sec) frag.appendChild(sec);
    }

    // ── Vision / People ──────────────────────────────────────
    if (asset.vision) {
      const t = document.createElement('table');
      t.className = 'img-info-table';
      const v = asset.vision;
      if (v.peopleLabel)  sidebarRow(t, 'People',   v.peopleLabel,           '{{sidecar.peopleLabel}}');
      if (v.personCount != null) sidebarRow(t, 'Persons', v.personCount,     '{{sidecar.personCount}}');
      if (v.faceCount   != null) sidebarRow(t, 'Faces',   v.faceCount,       '{{sidecar.faceCount}}');
      if (v.poseLabel)    sidebarRow(t, 'Pose',     v.poseLabel,             '{{sidecar.poseLabel}}');
      const sec = sidebarSection('Vision / People', 'group', t);
      if (sec) frag.appendChild(sec);
    }

    // ── Custom sidecar ───────────────────────────────────────
    const sidecarKeys = Object.keys(asset.sidecar ?? {});
    if (sidecarKeys.length) {
      const t = document.createElement('table');
      t.className = 'img-info-table';
      for (const key of sidecarKeys) {
        sidebarRow(t, key, asset.sidecar[key], `{{sidecar.${key}}}`);
      }
      const sec = sidebarSection('Custom Fields', 'edit_note', t);
      if (sec) frag.appendChild(sec);
    }

    const wrapper = document.createElement('div');
    wrapper.appendChild(frag);
    return wrapper;
  } catch {
    return null;
  }
}

// ── Main render ─────────────────────────────────────────────

/**
 * Render the full asset metadata panel for a file.
 * @param {File} file
 * @returns {Promise<HTMLElement>}
 */
export async function renderAssetPanel(file) {
  injectAssetPanelStyles();

  const wrapper = document.createElement('div');
  wrapper.className = 'ap-panel';
  wrapper.innerHTML = `<div class="ap-loading"><div class="spinner"></div><span class="text-sm text-muted">Loading metadata…</span></div>`;

  // Async load — replace loading state when ready
  loadAndRender(file, wrapper);
  return wrapper;
}

async function loadAndRender(file, wrapper) {
  try {
    await initDB();
    // ingestFile is idempotent — returns existing record or creates one
    const asset = await ingestFile(file);

    // If the asset has no enrichment (output file has different hash from its input),
    // try to find a richer record by filename and merge its enriched fields in.
    const isEnriched = a => a.geo || a.ocr || a.vision || Object.keys(a.sidecar ?? {}).length;
    if (!isEnriched(asset)) {
      const { getAssetsByFilename } = await import('../data/assets.js');
      const matches = await getAssetsByFilename(file.name);
      // Pick the most-enriched match (most non-null top-level fields)
      const score = a => [a.geo, a.ocr, a.vision].filter(Boolean).length + Object.keys(a.sidecar ?? {}).length;
      const best  = matches.sort((a, b) => score(b) - score(a))[0];
      if (best && score(best) > 0) {
        // Merge enriched fields into the current asset's display record (don't write back)
        Object.assign(asset, {
          geo:    asset.geo    ?? best.geo,
          ocr:    asset.ocr    ?? best.ocr,
          vision: asset.vision ?? best.vision,
          sidecar: Object.keys(asset.sidecar ?? {}).length ? asset.sidecar : (best.sidecar ?? {}),
          exif:   Object.keys(asset.exif ?? {}).length    ? asset.exif    : (best.exif ?? {}),
        });
      }
    }

    wrapper.innerHTML = '';
    wrapper.appendChild(buildPanel(asset, file));
  } catch (err) {
    wrapper.innerHTML = `<div class="ap-empty">Failed to load metadata: ${escHtml(err.message)}</div>`;
  }
}

function buildPanel(asset, file) {
  const frag = document.createDocumentFragment();

  // ── EXIF ───────────────────────────────────────────────────
  const exif = asset.exif ?? {};
  const exifRows = [
    row('Date',         exif.date),
    row('Camera',       [exif.cameraMake, exif.cameraModel].filter(Boolean).join(' ')),
    row('Exposure',     exif.exposure),
    row('Aperture',     exif.aperture ? `f/${exif.aperture}` : null),
    row('ISO',          exif.iso),
    row('Focal Length', exif.focalLength),
    row('Author',       exif.author),
    row('Copyright',    exif.copyright),
    row('Description',  exif.description),
    exif.gps ? row('GPS', `${exif.gps.lat.toFixed(5)}, ${exif.gps.lng.toFixed(5)}`) : '',
  ].join('');

  if (exifRows.trim()) {
    frag.appendChild(section('camera', 'EXIF', exifRows));
  }

  // ── Geocode ────────────────────────────────────────────────
  const geo = asset.geo;
  if (geo) {
    const geoRows = [
      row('Location',  geo.location),
      row('City',      geo.city),
      row('County',    geo.county),
      row('State',     geo.state),
      row('Country',   geo.country),
      row('Postcode',  geo.postcode),
      row('Road',      geo.road),
      row('Suburb',    geo.suburb),
      row('Geocoded',  formatDate(geo.geocodedAt)),
    ].join('');
    frag.appendChild(section('location_on', 'Geocode', geoRows));
  }

  // ── OCR ────────────────────────────────────────────────────
  const ocr = asset.ocr;
  if (ocr) {
    let ocrBody = '';
    if (ocr.tags?.length) ocrBody += row('Tags', ocr.tags.join(', '));
    ocrBody += row('Words',    ocr.words?.length);
    ocrBody += row('OCR date', formatDate(ocr.ocrAt));
    if (ocr.text) {
      ocrBody += `<div class="ap-ocr-text">${escHtml(ocr.text.slice(0, 500))}${ocr.text.length > 500 ? '…' : ''}</div>`;
    }
    frag.appendChild(section('text_fields', 'OCR Text', ocrBody));
  }

  // ── Vision / People ────────────────────────────────────────
  const vision = asset.vision;
  if (vision) {
    const visionRows = [
      row('People',      vision.peopleLabel),
      row('Persons',     vision.personCount != null ? String(vision.personCount) : null),
      row('Faces',       vision.faceCount   != null ? String(vision.faceCount)   : null),
      row('Pose',        vision.poseLabel),
      row('Analysed',    formatDate(vision.detectedAt)),
    ].join('');
    frag.appendChild(section('group', 'Vision / People', visionRows));
  }

  // ── Custom Metadata (sidecar — editable) ───────────────────
  frag.appendChild(buildSidecarSection(asset));

  // ── Asset identity ─────────────────────────────────────────
  const identity = document.createElement('div');
  identity.className = 'ap-hash';
  identity.textContent = `hash: ${asset.hash.slice(0, 16)}…  ·  ingested: ${formatDate(asset.ingestedAt)}`;
  frag.appendChild(identity);

  const container = document.createElement('div');
  container.style.cssText = 'display:contents';
  container.appendChild(frag);
  return container;
}

function buildSidecarSection(asset) {
  const sidecarSec = document.createElement('div');
  sidecarSec.className = 'ap-section';

  // Header with "saved" badge
  sidecarSec.innerHTML = `
    <div class="ap-section-head">
      <span class="material-symbols-outlined">edit_note</span>
      Custom Metadata
      <span class="ap-save-badge" id="ap-save-badge">Saved</span>
      <span class="material-symbols-outlined ap-chevron">expand_more</span>
    </div>
    <div class="ap-section-body" id="ap-sidecar-body"></div>
  `;
  sidecarSec.querySelector('.ap-section-head').addEventListener('click', e => {
    // Don't collapse if click was on an input inside the head
    sidecarSec.classList.toggle('is-collapsed');
  });

  const body    = sidecarSec.querySelector('#ap-sidecar-body');
  const badge   = sidecarSec.querySelector('#ap-save-badge');
  let sidecar   = { ...(asset.sidecar ?? {}) };

  function flashSaved() {
    badge.classList.add('is-visible');
    clearTimeout(badge._t);
    badge._t = setTimeout(() => badge.classList.remove('is-visible'), 1800);
  }

  async function saveField(key, value) {
    try {
      await setSidecarField(asset.hash, key, value);
      sidecar[key] = value;
      flashSaved();
    } catch (err) {
      console.error('[asset-panel] save failed:', err);
    }
  }

  async function deleteField(key) {
    delete sidecar[key];
    // Rebuild sidecar without the deleted key
    try {
      const { patchAsset: patch } = await import('../data/assets.js');
      await patch(asset.hash, { sidecar: { ...sidecar } });
      flashSaved();
    } catch (err) {
      console.error('[asset-panel] delete failed:', err);
    }
    renderRows();
  }

  function renderRows() {
    body.innerHTML = '';
    const keys = Object.keys(sidecar);

    if (keys.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ap-empty';
      empty.textContent = 'No custom fields yet. Add one below.';
      body.appendChild(empty);
    } else {
      for (const key of keys) {
        const rowEl = document.createElement('div');
        rowEl.className = 'ap-sidecar-row';
        rowEl.innerHTML = `
          <input class="ap-sidecar-key" value="${escHtml(key)}" readonly title="${escHtml(key)}">
          <input class="ap-sidecar-val" value="${escHtml(sidecar[key] ?? '')}">
          <button class="ap-sidecar-del" title="Delete field">
            <span class="material-symbols-outlined">delete</span>
          </button>
        `;
        const valInput = rowEl.querySelector('.ap-sidecar-val');
        valInput.addEventListener('change', () => saveField(key, valInput.value));
        valInput.addEventListener('keydown', e => { if (e.key === 'Enter') valInput.blur(); });
        rowEl.querySelector('.ap-sidecar-del').addEventListener('click', () => deleteField(key));
        body.appendChild(rowEl);
      }
    }

    // Add-field row
    const addRow = document.createElement('div');
    addRow.className = 'ap-add-row';
    addRow.innerHTML = `
      <input class="ap-add-key" placeholder="field name" spellcheck="false">
      <input class="ap-add-val" placeholder="value">
      <button class="ap-add-btn">Add</button>
    `;
    const addKey = addRow.querySelector('.ap-add-key');
    const addVal = addRow.querySelector('.ap-add-val');
    addRow.querySelector('.ap-add-btn').addEventListener('click', async () => {
      const k = addKey.value.trim().replace(/\s+/g, '_');
      const v = addVal.value;
      if (!k) { addKey.focus(); return; }
      sidecar[k] = v;
      await saveField(k, v);
      addKey.value = '';
      addVal.value = '';
      renderRows();
    });
    addVal.addEventListener('keydown', e => {
      if (e.key === 'Enter') addRow.querySelector('.ap-add-btn').click();
    });
    body.appendChild(addRow);
  }

  renderRows();
  return sidecarSec;
}
