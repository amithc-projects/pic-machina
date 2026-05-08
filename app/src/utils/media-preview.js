/**
 * Pic-Machina — Stock Media Preview Modal
 *
 * Lightweight <dialog>-based preview for normalised stock assets.
 * Mirrors the modal pattern from utils/info-modal.js.
 *
 * Both providers' CDNs serve responses without a
 * Cross-Origin-Resource-Policy header, so when this app runs under
 * a `Cross-Origin-Embedder-Policy: require-corp` document, embedding
 * those URLs directly in <img>/<video> elements is blocked. To work
 * around that we fetch the asset via fetch() (CORS-enabled on both
 * CDNs) and serve it from a same-origin blob: URL.
 */

let activeModal = null;

/**
 * @param {object} asset normalised asset
 * @param {object} opts
 * @param {boolean} opts.isSelected
 * @param {() => void} opts.onToggleSelect
 * @param {() => Promise<void>} opts.onDownloadOne
 */
export function showMediaPreview(asset, opts = {}) {
  if (activeModal) { try { activeModal.close(); } catch {} cleanup(activeModal); }

  const modal = document.createElement('dialog');
  modal.className = 'modal ic-media-preview';
  modal.style.cssText = 'width:min(1200px, 95vw); max-width:95vw; height:min(85vh, 900px); max-height:90vh; padding:0; border:1px solid var(--ps-border); border-radius:14px; background:var(--ps-bg-surface); overflow:hidden;';

  const provider = asset.provider === 'unsplash' ? 'Unsplash' : 'Pexels';
  const dims = (asset.width && asset.height) ? `${asset.width} × ${asset.height}` : '';
  const dur  = asset.kind === 'video' && asset.duration ? `${asset.duration}s` : '';

  modal.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--ps-border); background:var(--ps-bg);">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="font-size:14px; font-weight:600; color:var(--ps-text);">
            ${asset.kind === 'video' ? 'Video' : 'Photo'} by ${escapeHtml(asset.photographer || 'Unknown')}
          </div>
          <div style="font-size:11px; color:var(--ps-text-muted);">
            ${provider}${dims ? ' · ' + dims : ''}${dur ? ' · ' + dur : ''}
            ${asset.pageUrl ? ` · <a href="${asset.pageUrl}" target="_blank" rel="noopener" style="color:var(--ps-accent);">View on ${provider}</a>` : ''}
          </div>
        </div>
        <button class="btn-icon" id="mp-close" title="Close (Esc)"><span class="material-symbols-outlined">close</span></button>
      </div>

      <div id="mp-viewer" style="flex:1; min-height:0; display:flex; align-items:center; justify-content:center; background:#000; overflow:hidden; position:relative;">
        <div id="mp-loading" style="color:#aaa; font-size:13px; display:flex; flex-direction:column; align-items:center; gap:8px;">
          <span class="material-symbols-outlined" style="font-size:32px; animation:spin 1.2s linear infinite;">progress_activity</span>
          <span id="mp-loading-text">Loading preview…</span>
        </div>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; border-top:1px solid var(--ps-border); background:var(--ps-bg);">
        <div style="font-size:11px; color:var(--ps-text-faint);">
          ${asset.photographerUrl ? `<a href="${asset.photographerUrl}" target="_blank" rel="noopener" style="color:var(--ps-accent);">${escapeHtml(asset.photographer || '')}</a>` : escapeHtml(asset.photographer || '')}
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" id="mp-toggle">
            <span class="material-symbols-outlined" style="font-size:16px;">${opts.isSelected ? 'check_box' : 'check_box_outline_blank'}</span>
            <span id="mp-toggle-label">${opts.isSelected ? 'Selected' : 'Add to selection'}</span>
          </button>
          <button class="btn-primary" id="mp-download">
            <span class="material-symbols-outlined" style="font-size:16px;">download</span>
            Download
          </button>
        </div>
      </div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;

  // Track the blob URL so we can revoke it on close
  modal._blobUrl = null;

  function closeAndCleanup() {
    try { modal.close(); } catch {}
    cleanup(modal);
    if (activeModal === modal) activeModal = null;
  }

  modal.querySelector('#mp-close').addEventListener('click', closeAndCleanup);
  modal.addEventListener('click', e => { if (e.target === modal) closeAndCleanup(); });
  modal.addEventListener('cancel', e => { e.preventDefault(); closeAndCleanup(); });

  modal.querySelector('#mp-toggle').addEventListener('click', () => {
    opts.onToggleSelect?.();
    const newSelected = !opts.isSelected;
    opts.isSelected = newSelected;
    modal.querySelector('#mp-toggle-label').textContent = newSelected ? 'Selected' : 'Add to selection';
    modal.querySelector('#mp-toggle .material-symbols-outlined').textContent = newSelected ? 'check_box' : 'check_box_outline_blank';
  });

  modal.querySelector('#mp-download').addEventListener('click', async () => {
    try { await opts.onDownloadOne?.(); } catch (e) { console.error(e); }
  });

  document.body.appendChild(modal);
  activeModal = modal;
  modal.showModal();

  // Fetch via blob to bypass COEP issues with provider CDNs
  loadAssetIntoViewer(modal, asset);
}

async function loadAssetIntoViewer(modal, asset) {
  const viewer = modal.querySelector('#mp-viewer');
  const loading = modal.querySelector('#mp-loading');
  const loadingText = modal.querySelector('#mp-loading-text');

  // For videos, prefer a smaller-than-original quality file when available
  // to keep preview load times reasonable. Falls back to the download URL.
  const url = asset.kind === 'video'
    ? pickPreviewVideoUrl(asset)
    : (asset.previewUrl || asset.thumb);

  if (!url) {
    loadingText.textContent = 'No preview available.';
    return;
  }

  try {
    if (asset.kind === 'video') {
      loadingText.textContent = 'Buffering video…';
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    modal._blobUrl = blobUrl;

    loading.remove();

    if (asset.kind === 'video') {
      const video = document.createElement('video');
      video.src = blobUrl;
      video.controls = true;
      video.autoplay = true;
      video.style.cssText = 'max-width:100%; max-height:100%; width:auto; height:auto;';
      video.poster = asset.thumb || '';
      viewer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = blobUrl;
      img.alt = asset.photographer || '';
      img.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain;';
      viewer.appendChild(img);
    }
  } catch (err) {
    console.error('[media-preview] load failed', err);
    loadingText.innerHTML = `Could not load preview.<br><span style="font-size:11px; opacity:0.7;">${escapeHtml(err.message || '')}</span>`;
  }
}

/**
 * For Pexels videos, the normalised asset's `videoUrl` is the highest
 * quality MP4. For preview, prefer an SD or HD file from the raw record
 * if present — much faster to buffer. Falls back to videoUrl.
 */
function pickPreviewVideoUrl(asset) {
  const files = asset.raw?.video_files || [];
  if (!files.length) return asset.videoUrl;
  const mp4 = files.filter(f => (f.file_type || '').includes('mp4'));
  // Prefer a file <= 1280px wide; else smallest available
  const sorted = mp4.slice().sort((a, b) => (a.width || 0) - (b.width || 0));
  const small = sorted.find(f => (f.width || 0) <= 1280) || sorted[0];
  return small?.link || asset.videoUrl;
}

function cleanup(modal) {
  const v = modal.querySelector('video');
  if (v) { try { v.pause(); v.src = ''; v.load(); } catch {} }
  if (modal._blobUrl) {
    try { URL.revokeObjectURL(modal._blobUrl); } catch {}
    modal._blobUrl = null;
  }
  modal.remove();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
