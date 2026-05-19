/**
 * Pic-Machina — Get Media Screen
 *
 * Search and download free stock photos and videos from Pexels and
 * Unsplash. Source is switchable via the Source dropdown. Both
 * providers expose Search and Collections modes. Clicking a card
 * opens a preview modal; checkbox toggles selection. Selected items
 * can be batch-downloaded into a chosen folder via the File System
 * Access API.
 */

import { showToast } from '../aurora/toast.js';
import { listProviders, getProvider } from '../utils/media-providers.js';
import { downloadMany, buildFilename } from '../utils/media-download.js';
import { showMediaPreview } from '../utils/media-preview.js';

const PER_PAGE = 24;

export async function render(container) {
  const providers = listProviders();
  const defaultSource = providers[0]?.id || 'pexels';
  const state = {
    source: defaultSource,
    mode: 'search',          // 'search' | 'collections' | 'collection-detail'
    query: '',
    kind: 'both',            // 'photo' | 'video' | 'both'
    orientation: '',
    size: '',
    page: 1,
    assets: [],
    collections: [],
    activeCollection: null,
    selected: new Map(),     // key -> normalised asset
    rate: null,
    loading: false
  };

  container.innerHTML = `
    <style>
      .gmd-card .gmd-sel-indicator { position:absolute; top:8px; right:8px; width:22px; height:22px; border-radius:50%; background:#fff; color:var(--ps-blue, #3b82f6); display:flex; align-items:center; justify-content:center; font-size:14px; box-shadow:0 2px 4px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.15s; pointer-events:none; z-index:2; }
      .gmd-card.is-selected .gmd-sel-indicator { opacity:1; }
      .gmd-card.is-selected { border-color:var(--ps-accent, #10b981) !important; }
    </style>
    <div class="screen gmd-screen" style="padding:20px; display:flex; flex-direction:column; gap:14px; height:100%;">
      <header style="display:flex; flex-direction:column; gap:6px;">
        <h2 style="margin:0; display:flex; align-items:center; gap:8px;">
          <span class="material-symbols-outlined" style="color:#10b981;">image_search</span>
          Import Media
        </h2>
        <p style="margin:0; color:var(--ps-text-muted); font-size:13px;">
          Search Pexels, Unsplash and Pixabay for free photos and videos. Preview, multi-select, and download to a folder.
        </p>
      </header>

      <div id="gmd-banner"></div>

      <section style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
        <label style="display:flex; flex-direction:column; gap:2px; font-size:11px; color:var(--ps-text-muted);">
          Source
          <select id="gmd-source" class="ic-input" style="width:auto;">
            ${providers.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
          </select>
        </label>

        <label id="gmd-mode-wrap" style="display:flex; flex-direction:column; gap:2px; font-size:11px; color:var(--ps-text-muted);">
          Mode
          <select id="gmd-mode" class="ic-input" style="width:auto;">
            <option value="search">Search</option>
            <option value="collections">Collections</option>
          </select>
        </label>

        <label id="gmd-q-wrap" style="display:flex; flex-direction:column; gap:2px; font-size:11px; color:var(--ps-text-muted); flex:1; min-width:200px; position:relative;">
          Query
          <input id="gmd-q" type="search" class="ic-input" placeholder="Search query…" autocomplete="off" />
          <div id="gmd-history-drop" style="display:none; position:absolute; top:100%; left:0; right:0; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:6px; margin-top:2px; z-index:200; max-height:260px; overflow-y:auto; box-shadow:0 4px 16px rgba(0,0,0,0.4);"></div>
        </label>

        <label id="gmd-kind-wrap" style="display:flex; flex-direction:column; gap:2px; font-size:11px; color:var(--ps-text-muted);">
          Kind
          <select id="gmd-kind" class="ic-input" style="width:auto;">
            <option value="both">Photos + Videos</option>
            <option value="photo">Photos</option>
            <option value="video">Videos</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:2px; font-size:11px; color:var(--ps-text-muted);">
          Orientation
          <select id="gmd-orient" class="ic-input" style="width:auto;">
            <option value="">Any</option>
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
            <option value="square">Square</option>
          </select>
        </label>

        <button id="gmd-go" class="btn-primary" disabled>
          <span class="material-symbols-outlined" style="font-size:16px;">search</span>
          <span id="gmd-go-label">Search</span>
        </button>
      </section>

      <div id="gmd-toolbar" style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 4px;">
        <div id="gmd-status" style="font-size:12px; color:var(--ps-text-muted);"></div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span id="gmd-selcount" style="font-size:12px; color:var(--ps-text-muted);">0 selected</span>
          <button id="gmd-selall" class="btn-secondary" style="font-size:11px; padding:5px 10px;">Select page</button>
          <button id="gmd-clear" class="btn-secondary" style="font-size:11px; padding:5px 10px;">Clear</button>
          <button id="gmd-download" class="btn-primary" disabled>
            <span class="material-symbols-outlined" style="font-size:16px;">download</span>
            Download selected
          </button>
        </div>
      </div>

      <div id="gmd-results" style="flex:1; overflow-y:auto; display:flex; gap:12px; align-items:flex-start; padding:4px;"></div>

      <footer style="display:flex; align-items:center; justify-content:space-between; font-size:11px; color:var(--ps-text-faint); border-top:1px solid var(--ps-border); padding-top:8px;">
        <span id="gmd-rate"></span>
        <span id="gmd-credit">Powered by Pexels &amp; Unsplash</span>
      </footer>
    </div>
  `;

  const $ = sel => container.querySelector(sel);
  const elBanner      = $('#gmd-banner');
  const elSource      = $('#gmd-source');
  const elModeWrap    = $('#gmd-mode-wrap');
  const elMode        = $('#gmd-mode');
  const elQWrap       = $('#gmd-q-wrap');
  const elQ           = $('#gmd-q');
  const elKindWrap    = $('#gmd-kind-wrap');
  const elKind        = $('#gmd-kind');
  const elOrient      = $('#gmd-orient');
  const elGo          = $('#gmd-go');
  const elGoLabel     = $('#gmd-go-label');
  const elResults     = $('#gmd-results');
  const elStatus      = $('#gmd-status');
  const elSelCount    = $('#gmd-selcount');
  const elSelAll      = $('#gmd-selall');
  const elClear       = $('#gmd-clear');
  const elDownload    = $('#gmd-download');
  const elRate        = $('#gmd-rate');
  const elCredit      = $('#gmd-credit');
  const elHistoryDrop = $('#gmd-history-drop');

  const HISTORY_KEY = 'pm-gmd-search-history';
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  }
  function saveHistory(query) {
    const h = [query, ...loadHistory().filter(q => q !== query)].slice(0, 10);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  }

  let _historyBlurTimer = null;
  function showHistoryDrop(filter) {
    const all = loadHistory();
    const items = filter
      ? all.filter(q => q.toLowerCase().includes(filter.toLowerCase()))
      : all;
    if (!items.length) { hideHistoryDrop(); return; }
    elHistoryDrop.innerHTML = items.map(q => `
      <div class="gmd-hist-item" data-q="${escapeHtml(q)}"
           style="padding:8px 12px; font-size:13px; cursor:pointer; color:var(--ps-text); display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--ps-border);">
        <span class="material-symbols-outlined" style="font-size:14px; color:var(--ps-text-muted);">history</span>
        ${escapeHtml(q)}
      </div>`).join('');
    elHistoryDrop.style.display = 'block';
    elHistoryDrop.querySelectorAll('.gmd-hist-item').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault(); // prevent input blur before click registers
        elQ.value = el.dataset.q;
        hideHistoryDrop();
        runSearch();
      });
      el.addEventListener('mouseover', () => { el.style.background = 'var(--ps-bg-hover, rgba(255,255,255,0.06))'; });
      el.addEventListener('mouseout',  () => { el.style.background = ''; });
    });
  }
  function hideHistoryDrop() {
    elHistoryDrop.style.display = 'none';
  }

  elQ.addEventListener('focus', () => {
    clearTimeout(_historyBlurTimer);
    showHistoryDrop(elQ.value.trim() || null);
  });
  elQ.addEventListener('input', () => {
    const v = elQ.value.trim();
    if (v) showHistoryDrop(v); else showHistoryDrop(null);
  });
  elQ.addEventListener('blur', () => {
    _historyBlurTimer = setTimeout(hideHistoryDrop, 150);
  });

  function provider() { return getProvider(state.source); }

  function refreshControls() {
    const p = provider();

    // Hide kind selector when source has no videos
    elKindWrap.style.display = p.supportsVideos ? 'flex' : 'none';
    if (!p.supportsVideos) state.kind = 'photo';
    elKind.value = state.kind;

    // Mode-specific button label / placeholder
    if (state.mode === 'search') {
      elGoLabel.textContent = 'Search';
      elQ.placeholder = `Search ${p.label}…`;
      elQ.disabled = false;
      elGo.disabled = !elQ.value.trim();
    } else if (state.mode === 'collections') {
      elGoLabel.textContent = 'Browse';
      elQ.placeholder = `Browse ${p.label} collections (no query needed)`;
      elQ.disabled = true;
      elGo.disabled = false;
    } else if (state.mode === 'collection-detail') {
      elGoLabel.textContent = 'Back to collections';
      elQ.placeholder = state.activeCollection?.title || '';
      elQ.disabled = true;
      elGo.disabled = false;
    }

    elCredit.innerHTML = `Powered by <a href="${p.siteUrl}" target="_blank" rel="noopener" style="color:var(--ps-accent);">${p.label}</a>`;
  }

  function renderBanner() {
    const p = provider();
    if (!p.hasKey()) {
      elBanner.innerHTML = `
        <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.4); border-radius:8px; padding:12px 14px; display:flex; align-items:flex-start; gap:10px;">
          <span class="material-symbols-outlined" style="color:#f59e0b;">key</span>
          <div style="flex:1; font-size:12px; line-height:1.5;">
            <strong style="color:var(--ps-text);">${p.label} not configured.</strong>
            Add your ${p.configHint} in
            <a href="#sys" style="color:var(--ps-accent);">Settings &rsaquo; Stock Media Providers</a>
            to enable this source.
          </div>
        </div>`;
    } else {
      elBanner.innerHTML = '';
    }
  }

  function updateRate(rate) {
    if (!rate) return;
    state.rate = rate;
    if (rate.remaining != null) {
      const reset = rate.reset ? ' · resets ' + new Date(rate.reset * 1000).toLocaleTimeString() : '';
      elRate.textContent = `${provider().label} API: ${rate.remaining}${rate.limit ? '/' + rate.limit : ''} remaining${reset}`;
    }
  }

  function assetKey(a) { return `${a.provider}:${a.kind}:${a.id}`; }

  function updateSelectionUi() {
    elSelCount.textContent = `${state.selected.size} selected`;
    elDownload.disabled = state.selected.size === 0;
  }

  function toggleSelected(asset, on) {
    const key = assetKey(asset);
    if (on === undefined) on = !state.selected.has(key);
    if (on) state.selected.set(key, asset);
    else state.selected.delete(key);
    const card = elResults.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (card) card.classList.toggle('is-selected', on);
    updateSelectionUi();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // Revoke any blob URLs from a previous grid render to avoid memory leaks
  let _thumbBlobUrls = [];
  function revokeThumbBlobs() {
    _thumbBlobUrls.forEach(u => URL.revokeObjectURL(u));
    _thumbBlobUrls = [];
  }

  async function loadThumbsAsBlobs(assets) {
    const imgs = elResults.querySelectorAll('img[data-thumb-src]');
    await Promise.all(Array.from(imgs).map(async img => {
      const url = img.dataset.thumbSrc;
      if (!url) return;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        _thumbBlobUrls.push(blobUrl);
        img.src = blobUrl;
      } catch { /* leave broken */ }
    }));
  }

  function buildCardHtml(asset) {
    const key = assetKey(asset);
    const selected = state.selected.has(key);
    const isVid = asset.kind === 'video';
    const ratio = (asset.width && asset.height) ? `${asset.width}/${asset.height}` : '4/3';
    const kindBadge = isVid
      ? `<div style="position:absolute; top:6px; left:6px; background:rgba(30,80,180,0.85); color:#fff; font-size:10px; padding:2px 7px; border-radius:4px; display:flex; align-items:center; gap:3px;">
          <span class="material-symbols-outlined" style="font-size:12px;">play_circle</span>${asset.duration ? asset.duration + 's' : 'Video'}</div>`
      : `<div style="position:absolute; top:6px; left:6px; background:rgba(16,100,60,0.85); color:#fff; font-size:10px; padding:2px 7px; border-radius:4px; display:flex; align-items:center; gap:3px;">
          <span class="material-symbols-outlined" style="font-size:12px;">photo_camera</span>Photo</div>`;
    return `
      <div class="gmd-card${selected ? ' gmd-card--selected' : ''}" data-key="${escapeHtml(key)}"
           style="background:var(--ps-bg-app); border:2px solid var(--ps-border); border-radius:8px; overflow:hidden; cursor:pointer; transition:border-color 0.15s;">
        <div style="position:relative; aspect-ratio:${ratio}; background:#111;">
          <img data-thumb-src="${escapeHtml(asset.thumb || '')}" alt="" style="width:100%; height:100%; object-fit:cover; display:block;" />
          ${kindBadge}
          <div class="gmd-sel-indicator"><span class="material-symbols-outlined" style="font-size:14px;">check</span></div>
        </div>
        <div style="padding:8px 10px; font-size:11px; color:var(--ps-text-muted); display:flex; justify-content:space-between; gap:6px;">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(asset.photographer)}">${escapeHtml(asset.photographer || 'Unknown')}</span>
          <span style="color:var(--ps-text-faint); display:flex; align-items:center; gap:3px;">
            <span class="material-symbols-outlined" style="font-size:13px;">visibility</span>preview
          </span>
        </div>
      </div>`;
  }

  function renderMasonryColumns(items, htmlFn) {
    const GAP = 12;
    const COL_MIN = 220;
    const numCols = Math.max(1, Math.floor((elResults.offsetWidth + GAP) / (COL_MIN + GAP)));
    const cols = Array.from({ length: numCols }, () => []);
    items.forEach((item, i) => cols[i % numCols].push(item));
    return cols.map(col =>
      `<div style="flex:1; display:flex; flex-direction:column; gap:${GAP}px; min-width:0;">
        ${col.map(htmlFn).join('')}
      </div>`
    ).join('');
  }

  function renderAssetGrid(assets) {
    revokeThumbBlobs();
    if (!assets.length) {
      elResults.innerHTML = `<div style="width:100%; text-align:center; padding:40px; color:var(--ps-text-muted); font-size:13px;">
        ${state.loading ? 'Loading…' : 'No results.'}
      </div>`;
      return;
    }
    elResults.innerHTML = renderMasonryColumns(assets, buildCardHtml);

    loadThumbsAsBlobs(assets);

    elResults.querySelectorAll('.gmd-card').forEach(card => {
      let _clickTimer = null;
      card.addEventListener('click', e => {
        const key = card.dataset.key;
        const asset = assets.find(a => assetKey(a) === key);
        if (!asset) return;
        clearTimeout(_clickTimer);
        _clickTimer = setTimeout(() => toggleSelected(asset), 220);
      });
      card.addEventListener('dblclick', e => {
        const key = card.dataset.key;
        const asset = assets.find(a => assetKey(a) === key);
        if (!asset) return;
        clearTimeout(_clickTimer); // cancel the pending single-click toggle
        openPreview(asset);
      });
    });
  }

  function renderCollectionsGrid(collections) {
    revokeThumbBlobs();
    if (!collections.length) {
      elResults.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--ps-text-muted); font-size:13px;">
        ${state.loading ? 'Loading…' : 'No collections.'}
      </div>`;
      return;
    }
    elResults.innerHTML = renderMasonryColumns(collections, c => `
      <div class="gmd-collection" data-id="${escapeHtml(String(c.id))}"
           style="background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden; cursor:pointer; transition:border-color 0.15s;">
        <div style="aspect-ratio:4/3; background:#111; display:flex; align-items:center; justify-content:center;">
          ${c.coverUrl
            ? `<img data-thumb-src="${escapeHtml(c.coverUrl)}" alt="" style="width:100%; height:100%; object-fit:cover;" />`
            : `<span class="material-symbols-outlined" style="font-size:48px; color:var(--ps-text-faint);">folder_special</span>`}
        </div>
        <div style="padding:10px 12px; display:flex; flex-direction:column; gap:4px;">
          <div style="font-size:13px; font-weight:500; color:var(--ps-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.title)}</div>
          <div style="font-size:11px; color:var(--ps-text-muted);">${c.totalCount} item${c.totalCount === 1 ? '' : 's'}</div>
        </div>
      </div>
    `);

    loadThumbsAsBlobs(collections.map(c => ({ thumb: c.coverUrl })));

    elResults.querySelectorAll('.gmd-collection').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const c = collections.find(x => String(x.id) === id);
        if (c) openCollection(c);
      });
    });
  }

  function openPreview(asset) {
    const key = assetKey(asset);
    showMediaPreview(asset, {
      isSelected: state.selected.has(key),
      onToggleSelect: () => toggleSelected(asset),
      onDownloadOne: async () => {
        try {
          const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
          const result = await downloadMany([asset], dirHandle, () => {});
          if (result.failed.length) throw result.failed[0].error;
          showToast({ variant: 'success', title: 'Downloaded', description: buildFilename(asset) });
        } catch (e) {
          if (e?.name !== 'AbortError') {
            showToast({ variant: 'error', title: 'Download failed', description: e.message });
          }
        }
      }
    });
  }

  async function runSearch() {
    const p = provider();

    if (state.mode === 'collection-detail') {
      // "Back" button
      state.mode = 'collections';
      state.activeCollection = null;
      refreshControls();
      await loadCollections();
      return;
    }
    if (state.mode === 'collections') {
      await loadCollections();
      return;
    }
    // Search mode
    if (!p.hasKey()) {
      showToast({ variant: 'warning', title: `${p.label} not configured`, description: 'Add an API key in Settings.' });
      return;
    }
    const q = elQ.value.trim();
    if (!q) return;
    state.query = q;
    state.kind = elKind.value;
    state.orientation = elOrient.value;
    saveHistory(q);
    state.loading = true;
    elStatus.textContent = `Searching ${p.label}…`;
    state.assets = [];
    renderAssetGrid([]);
    try {
      const r = await p.search({ query: q, kind: state.kind, perPage: PER_PAGE, orientation: state.orientation });
      if (r.unauthenticated) { renderBanner(); elStatus.textContent = ''; return; }
      state.assets = r.assets || [];
      updateRate(r.rate);
      elStatus.textContent = `${state.assets.length} result(s) for "${q}" on ${p.label}`;
    } catch (err) {
      showToast({ variant: 'error', title: `${p.label} search failed`, description: err.message });
      elStatus.textContent = '';
    } finally {
      state.loading = false;
      renderAssetGrid(state.assets);
    }
  }

  async function loadCollections() {
    const p = provider();
    if (!p.hasKey()) { renderBanner(); return; }
    state.loading = true;
    elStatus.textContent = `Loading ${p.label} collections…`;
    state.collections = [];
    renderCollectionsGrid([]);
    try {
      const r = await p.listCollections({ perPage: 30 });
      if (r.unauthenticated) { renderBanner(); elStatus.textContent = ''; return; }
      state.collections = r.collections || [];
      updateRate(r.rate);
      elStatus.textContent = `${state.collections.length} collection(s) on ${p.label}`;
    } catch (err) {
      showToast({ variant: 'error', title: 'Could not load collections', description: err.message });
      elStatus.textContent = '';
    } finally {
      state.loading = false;
      renderCollectionsGrid(state.collections);
    }
  }

  async function openCollection(collection) {
    const p = provider();
    state.mode = 'collection-detail';
    state.activeCollection = collection;
    refreshControls();
    state.loading = true;
    elStatus.textContent = `Loading "${collection.title}"…`;
    state.assets = [];
    renderAssetGrid([]);
    try {
      const r = await p.getCollectionMedia({ id: collection.id, perPage: PER_PAGE });
      if (r.unauthenticated) { renderBanner(); elStatus.textContent = ''; return; }
      state.assets = r.assets || [];
      updateRate(r.rate);
      elStatus.textContent = `${state.assets.length} item(s) in "${collection.title}"`;
    } catch (err) {
      showToast({ variant: 'error', title: 'Could not load collection', description: err.message });
      elStatus.textContent = '';
    } finally {
      state.loading = false;
      renderAssetGrid(state.assets);
    }
  }

  async function downloadSelected() {
    if (!state.selected.size) return;
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      if (e.name !== 'AbortError') showToast({ variant: 'error', title: 'Folder selection failed', description: e.message });
      return;
    }
    const assets = Array.from(state.selected.values());
    const total = assets.length;
    elDownload.disabled = true;
    const original = elDownload.innerHTML;
    elDownload.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">downloading</span> 0/${total}`;
    try {
      const result = await downloadMany(assets, dirHandle, ({ done }) => {
        elDownload.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">downloading</span> ${done}/${total}`;
      });
      const ok = result.ok.length;
      const fail = result.failed.length;
      showToast({
        variant: fail === 0 ? 'success' : (ok === 0 ? 'error' : 'warning'),
        title: fail === 0 ? 'Download complete' : 'Finished with errors',
        description: fail === 0
          ? `${ok} file(s) saved + attribution.txt`
          : `${ok} succeeded, ${fail} failed`
      });
    } catch (err) {
      showToast({ variant: 'error', title: 'Download failed', description: err.message });
    } finally {
      elDownload.innerHTML = original;
      updateSelectionUi();
    }
  }

  // Wire events
  elSource.addEventListener('change', () => {
    state.source = elSource.value;
    state.assets = [];
    state.collections = [];
    state.activeCollection = null;
    state.mode = elMode.value === 'collections' ? 'collections' : 'search';
    refreshControls();
    renderBanner();
    elResults.innerHTML = '';
    elStatus.textContent = '';
    elRate.textContent = '';
  });

  elMode.addEventListener('change', () => {
    state.mode = elMode.value;
    state.activeCollection = null;
    refreshControls();
    elResults.innerHTML = '';
    elStatus.textContent = state.mode === 'collections' ? 'Click Browse to load collections.' : 'Type a query and press Enter.';
  });

  elGo.addEventListener('click', runSearch);
  elQ.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
  elQ.addEventListener('input', () => {
    elGo.disabled = state.mode === 'search' && !elQ.value.trim();
  });
  elKind.addEventListener('change', () => { state.kind = elKind.value; });

  elSelAll.addEventListener('click', () => {
    state.assets.forEach(a => toggleSelected(a, true));
  });
  elClear.addEventListener('click', () => {
    state.selected.clear();
    elResults.querySelectorAll('.gmd-card.is-selected').forEach(c => c.classList.remove('is-selected'));
    updateSelectionUi();
  });
  elDownload.addEventListener('click', downloadSelected);

  // Initial render
  refreshControls();
  renderBanner();
  requestAnimationFrame(() => elQ.focus());
  elStatus.textContent = provider().hasKey()
    ? 'Type a query and press Enter.'
    : `Add a ${provider().configHint} in Settings to get started.`;
}
