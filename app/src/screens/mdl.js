/**
 * PicMachina — MDL: Model Manager
 *
 * Lists downloadable AI models (e.g. InSPyReNet) and lets the user manage
 * local copies stored in IndexedDB.
 */

import {
  MODEL_REGISTRY,
  getModelRecord,
  downloadModel,
  deleteModel,
} from '../data/models.js';

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${n} B`;
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString();
}

export async function render(container) {
  injectStyles();

  container.innerHTML = `
    <div class="screen mdl-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <div class="screen-title">
            <span class="material-symbols-outlined">neurology</span>
            Models
          </div>
        </div>
      </div>

      <div class="mdl-intro">
        <div class="mdl-env" id="mdl-env"></div>
        <div class="mdl-storage" id="mdl-storage"></div>
      </div>

      <div class="mdl-body" id="mdl-body"></div>
    </div>`;

  // Environment info strip
  const envEl = container.querySelector('#mdl-env');
  const hasWebGPU = !!(navigator.gpu);
  envEl.innerHTML = `
    <span class="mdl-badge ${hasWebGPU ? 'ok' : 'warn'}">
      <span class="material-symbols-outlined">${hasWebGPU ? 'bolt' : 'memory'}</span>
      ${hasWebGPU ? 'WebGPU available' : 'CPU / WASM fallback'}
    </span>
    <span class="mdl-badge ${self.crossOriginIsolated ? 'ok' : 'warn'}">
      <span class="material-symbols-outlined">${self.crossOriginIsolated ? 'lock' : 'lock_open'}</span>
      ${self.crossOriginIsolated ? 'cross-origin isolated' : 'not cross-origin isolated'}
    </span>`;

  const storageEl = container.querySelector('#mdl-storage');
  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const pct = est.quota ? Math.round((est.usage / est.quota) * 100) : null;
      storageEl.textContent =
        `Storage: ${formatBytes(est.usage)} used of ${formatBytes(est.quota)}` +
        (pct !== null ? ` (${pct}%)` : '');
    } catch { /* ignore */ }
  }

  // Body — one card per registry entry
  const body = container.querySelector('#mdl-body');
  const cards = new Map(); // id -> { wrapper, inflight: AbortController | null }

  for (const meta of MODEL_REGISTRY) {
    const card = document.createElement('div');
    card.className = 'mdl-card';
    card.dataset.id = meta.id;
    body.appendChild(card);
    cards.set(meta.id, { card, abort: null });
    await refreshCard(meta);
  }

  async function refreshCard(meta) {
    const entry = cards.get(meta.id);
    if (!entry) return;
    const rec = await getModelRecord(meta.id);
    const hasBytes = !!(rec && rec.bytes);
    const size = rec?.sizeBytes || meta.sizeBytes;

    entry.card.innerHTML = `
      <div class="mdl-card__head">
        <div>
          <div class="mdl-card__title">${escHtml(meta.name)}</div>
          <div class="mdl-card__sub mono">${escHtml(meta.id)} · ${formatBytes(size)} · ${escHtml(meta.precision || '')}</div>
        </div>
        <div class="mdl-card__status">
          ${hasBytes
            ? `<span class="mdl-pill ok"><span class="material-symbols-outlined">check_circle</span> Downloaded</span>`
            : `<span class="mdl-pill muted"><span class="material-symbols-outlined">download</span> Not downloaded</span>`}
        </div>
      </div>

      <p class="mdl-card__desc">${escHtml(meta.description)}</p>

      ${hasBytes
        ? `<div class="mdl-card__meta mono text-muted">Downloaded ${escHtml(formatTimestamp(rec.downloadedAt))}</div>`
        : ''}

      <div class="mdl-card__progress" hidden>
        <div class="mdl-card__progress-bar"><div class="mdl-card__progress-fill" style="width:0%"></div></div>
        <div class="mdl-card__progress-label mono text-sm"></div>
      </div>

      <div class="mdl-card__actions">
        ${hasBytes
          ? `<button class="btn-secondary" data-action="redownload">
               <span class="material-symbols-outlined">refresh</span> Re-download
             </button>
             <button class="btn-secondary" data-action="delete">
               <span class="material-symbols-outlined">delete</span> Delete
             </button>`
          : `<button class="btn-primary" data-action="download">
               <span class="material-symbols-outlined">download</span> Download
             </button>`}
      </div>
      <div class="mdl-card__error" hidden></div>
    `;

    entry.card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(meta, btn.dataset.action));
    });
  }

  async function handleAction(meta, action) {
    const entry = cards.get(meta.id);
    if (!entry) return;

    if (action === 'download' || action === 'redownload') {
      await startDownload(meta);
    } else if (action === 'delete') {
      const confirmMsg = `Delete "${meta.name}" from local storage?`;
      if (!window.confirm(confirmMsg)) return;
      try {
        const { disposeSession } = await import('../engine/ai/inspyrenet.js');
        await disposeSession();
      } catch { /* non-fatal */ }
      await deleteModel(meta.id);
      await refreshCard(meta);
    }
  }

  async function startDownload(meta) {
    const entry = cards.get(meta.id);
    if (!entry) return;
    if (entry.abort) return; // already in flight

    const progEl = entry.card.querySelector('.mdl-card__progress');
    const fillEl = entry.card.querySelector('.mdl-card__progress-fill');
    const lblEl  = entry.card.querySelector('.mdl-card__progress-label');
    const errEl  = entry.card.querySelector('.mdl-card__error');
    const actions = entry.card.querySelectorAll('[data-action]');

    progEl.hidden = false;
    errEl.hidden = true;
    actions.forEach(b => b.disabled = true);

    const abort = new AbortController();
    entry.abort = abort;

    try {
      // Drop any live session so a stale one can't outlive the byte swap
      try {
        const { disposeSession } = await import('../engine/ai/inspyrenet.js');
        await disposeSession();
      } catch { /* non-fatal */ }

      await downloadModel(meta.id, ({ loaded, total }) => {
        const pct = total ? (loaded / total) * 100 : 0;
        fillEl.style.width = `${pct.toFixed(1)}%`;
        lblEl.textContent = total
          ? `${formatBytes(loaded)} / ${formatBytes(total)} (${pct.toFixed(1)}%)`
          : `${formatBytes(loaded)}`;
      }, abort.signal);
      entry.abort = null;
      await refreshCard(meta);
    } catch (err) {
      entry.abort = null;
      if (err.name === 'AbortError') {
        lblEl.textContent = 'Cancelled';
      } else {
        errEl.hidden = false;
        errEl.textContent = `Download failed: ${err.message || err}`;
      }
      actions.forEach(b => b.disabled = false);
    }
  }

  // Cleanup: cancel any in-flight downloads when navigating away
  return () => {
    for (const entry of cards.values()) {
      if (entry.abort) {
        try { entry.abort.abort(); } catch { /* ignore */ }
      }
    }
  };
}

let _mdlStyles = false;
function injectStyles() {
  if (_mdlStyles) return;
  _mdlStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .mdl-screen { display:flex; flex-direction:column; height:100%; overflow:hidden; }
    .mdl-intro {
      display:flex; gap:16px; align-items:center; flex-wrap:wrap;
      padding:12px 20px; border-bottom:1px solid var(--ps-border);
      background:var(--ps-bg-surface);
    }
    .mdl-badge {
      display:inline-flex; align-items:center; gap:6px;
      padding:4px 10px; border-radius:20px;
      font-size:12px; font-weight:500;
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      color:var(--ps-text-muted);
    }
    .mdl-badge.ok   { color:#22c55e; border-color:rgba(34,197,94,0.35); }
    .mdl-badge.warn { color:#f59e0b; border-color:rgba(245,158,11,0.35); }
    .mdl-badge .material-symbols-outlined { font-size:16px; }
    .mdl-storage { font-size:12px; color:var(--ps-text-muted); font-family:var(--font-mono); }

    .mdl-body {
      flex:1; overflow:auto; padding:20px;
      display:grid; gap:16px;
      grid-template-columns: repeat(auto-fill, minmax(440px, 1fr));
      align-content:start;
    }
    .mdl-card {
      display:flex; flex-direction:column; gap:10px;
      background:var(--ps-bg-surface); border:1px solid var(--ps-border);
      border-radius:10px; padding:16px;
    }
    .mdl-card__head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .mdl-card__title { font-size:15px; font-weight:600; color:var(--ps-text); }
    .mdl-card__sub { font-size:11px; color:var(--ps-text-muted); margin-top:2px; }
    .mdl-card__desc { font-size:13px; color:var(--ps-text-muted); line-height:1.5; margin:0; }
    .mdl-card__meta { font-size:11px; }

    .mdl-pill {
      display:inline-flex; align-items:center; gap:4px;
      padding:3px 10px; border-radius:20px;
      font-size:11px; font-weight:600;
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      color:var(--ps-text-muted);
    }
    .mdl-pill.ok { color:#22c55e; border-color:rgba(34,197,94,0.35); }
    .mdl-pill .material-symbols-outlined { font-size:14px; }

    .mdl-card__progress { display:flex; flex-direction:column; gap:4px; }
    .mdl-card__progress-bar {
      height:6px; border-radius:4px; overflow:hidden;
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
    }
    .mdl-card__progress-fill {
      height:100%; background:var(--ps-blue, #0077ff);
      transition:width 120ms linear;
    }
    .mdl-card__progress-label { color:var(--ps-text-muted); }

    .mdl-card__actions { display:flex; gap:8px; flex-wrap:wrap; }
    .mdl-card__actions button { display:inline-flex; align-items:center; gap:4px; }
    .mdl-card__actions button .material-symbols-outlined { font-size:16px; }

    .mdl-card__error {
      padding:8px 10px; border-radius:6px;
      background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.35);
      color:#ef4444; font-size:12px;
    }
  `;
  document.head.appendChild(s);
}
