/**
 * ImageChef — INS: Block Inspector
 *
 * Read-only view of a block's steps with live preview.
 * Accessed via #ins?id=<blockId>
 */

import { getBlock, cloneBlock } from '../data/blocks.js';
import { navigate }             from '../main.js';
import { registry }             from '../engine/index.js';
import { ImageProcessor } from '../engine/index.js';
import { extractExif }          from '../engine/exif-reader.js';
import { formatDate }           from '../utils/misc.js';

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const CAT_COLORS = {
  geo:     '#38bdf8',
  color:   '#a78bfa',
  overlay: '#fb923c',
  ai:      '#34d399',
  flow:    '#0077ff',
  meta:    '#f472b6',
};

export async function render(container, hash) {
  const params  = new URLSearchParams((hash.split('?')[1] || ''));
  const blockId = params.get('id');

  if (!blockId) { navigate('#bkb'); return; }

  const block = await getBlock(blockId);
  if (!block) {
    container.innerHTML = `<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">Block not found</div>
        <button class="btn-primary" onclick="navigate('#bkb')">Back to Blocks</button>
      </div></div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="screen ins-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="ins-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">widgets</span>
            ${escHtml(block.name)}
          </div>
          <span class="ic-badge">${escHtml(block.category || 'General')}</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary" id="ins-edit-btn">
            <span class="material-symbols-outlined">edit</span>
            Edit Block
          </button>
          <button class="btn-secondary" id="ins-clone-btn">
            <span class="material-symbols-outlined">content_copy</span>
            Clone
          </button>
        </div>
      </div>

      <div class="ins-body">
        <!-- Left: meta + steps -->
        <div class="ins-sidebar">
          <div class="ins-meta">
            <div class="ins-meta-icon">
              <span class="material-symbols-outlined" style="font-size:32px;color:var(--ps-blue)">widgets</span>
            </div>
            <div>
              ${block.description ? `<p class="ins-desc">${escHtml(block.description)}</p>` : ''}
              <div class="text-sm text-muted">
                ${block.nodes.length} step${block.nodes.length !== 1 ? 's' : ''}
                &nbsp;·&nbsp;
                Updated ${block.updatedAt ? formatDate(block.updatedAt) : '—'}
              </div>
            </div>
          </div>

          <div class="ins-steps-title">Steps</div>
          <div class="ins-steps-list">
            ${block.nodes.length === 0
              ? '<div class="empty-state" style="padding:24px"><div class="empty-state-title">No steps</div></div>'
              : block.nodes.map((n, i) => {
                  const def    = registry.get(n.transformId);
                  const catKey = def?.categoryKey || n.transformId?.split('-')[0] || 'other';
                  const color  = CAT_COLORS[catKey] || '#6b7280';
                  const label  = n.label || def?.name || n.type;
                  return `
                    <div class="ins-step-row" data-idx="${i}">
                      <span class="ins-step-num">${i + 1}</span>
                      <span class="material-symbols-outlined" style="font-size:14px;color:${color};flex-shrink:0">${def?.icon || 'tune'}</span>
                      <span class="ins-step-label">${escHtml(label)}</span>
                    </div>`;
                }).join('')}
          </div>
        </div>

        <!-- Right: preview -->
        <div class="ins-preview-panel">
          <div class="ins-preview-header">
            <span class="text-sm text-muted">Test Image</span>
            <label class="btn-secondary" style="cursor:pointer">
              <span class="material-symbols-outlined">upload</span>
              Upload Image
              <input type="file" id="ins-file-input" accept="image/*" style="display:none">
            </label>
          </div>

          <div id="ins-preview-area" class="ins-preview-area">
            <div class="empty-state">
              <span class="material-symbols-outlined" style="font-size:48px">image</span>
              <div class="empty-state-title">Upload a test image</div>
              <div class="empty-state-desc">Preview how this block transforms images.</div>
            </div>
          </div>

          <div id="ins-step-scrubber" class="ins-step-scrubber" style="display:none">
            <span class="text-sm text-muted" style="flex-shrink:0">Step:</span>
            <input type="range" id="ins-step-slider" class="ic-range" min="0" value="0" style="flex:1">
            <span id="ins-step-label" class="mono text-sm" style="min-width:80px;text-align:right">Original</span>
          </div>
        </div>
      </div>
    </div>`;

  injectInsStyles();

  container.querySelector('#ins-back')?.addEventListener('click', () => navigate('#bkb'));
  container.querySelector('#ins-edit-btn')?.addEventListener('click', () => navigate(`#bkb?id=${block.id}`));
  container.querySelector('#ins-clone-btn')?.addEventListener('click', async () => {
    const c = await cloneBlock(block.id);
    window.AuroraToast?.show({ variant: 'success', title: `"${c.name}" cloned` });
    navigate(`#bkb?id=${c.id}`);
  });

  // Step row click → jump preview
  container.querySelectorAll('.ins-step-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.idx) + 1;
      const slider = container.querySelector('#ins-step-slider');
      if (slider) { slider.value = idx; showStep(idx); }
    });
  });

  let stepResults = [];

  container.querySelector('#ins-step-slider')?.addEventListener('input', e => showStep(parseInt(e.target.value)));

  container.querySelector('#ins-file-input')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    await runPreview(file);
  });

  async function runPreview(file) {
    const previewArea = container.querySelector('#ins-preview-area');
    if (!previewArea) return;
    previewArea.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px"><div class="spinner spinner--lg"></div><div class="text-sm text-muted">Processing…</div></div>`;

    try {
      const url    = URL.createObjectURL(file);
      const img    = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const exif   = await extractExif(file);
      const ctx    = { filename: file.name, exif, meta: {} };

      stepResults = [{ label: 'Original', dataUrl: url }];

      for (let i = 0; i < block.nodes.length; i++) {
        const proc = new ImageProcessor();
        await proc.process(img, block.nodes, { ...ctx, variables: new Map() }, i);
        stepResults.push({ label: block.nodes[i].label || block.nodes[i].transformId || block.nodes[i].type, dataUrl: proc.canvas.toDataURL('image/jpeg', 0.85) });
      }

      const slider = container.querySelector('#ins-step-slider');
      if (slider) { slider.max = stepResults.length - 1; slider.value = stepResults.length - 1; }
      container.querySelector('#ins-step-scrubber').style.display = 'flex';
      showStep(stepResults.length - 1);
    } catch (err) {
      const pa = container.querySelector('#ins-preview-area');
      if (pa) pa.innerHTML = `<div class="empty-state"><span class="material-symbols-outlined">error</span><div class="empty-state-desc">${escHtml(err.message)}</div></div>`;
    }
  }

  function showStep(idx) {
    const step = stepResults[idx];
    if (!step) return;
    const label = container.querySelector('#ins-step-label');
    if (label) label.textContent = idx === 0 ? 'Original' : `Step ${idx}: ${step.label}`;
    const pa = container.querySelector('#ins-preview-area');
    if (pa) pa.innerHTML = `<img src="${step.dataUrl}" class="ins-result-img" draggable="false">`;

    // Highlight active step row
    container.querySelectorAll('.ins-step-row').forEach((row, i) => {
      row.classList.toggle('ins-step-row--active', i === idx - 1);
    });
  }
}

let _insStyles = false;
function injectInsStyles() {
  if (_insStyles) return;
  _insStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .ins-screen { display:flex; flex-direction:column; height:100%; }
    .ins-body { display:flex; flex:1; overflow:hidden; }

    .ins-sidebar { width:280px; flex-shrink:0; border-right:1px solid var(--ps-border); overflow-y:auto; display:flex; flex-direction:column; }
    .ins-meta { display:flex; align-items:flex-start; gap:12px; padding:16px; border-bottom:1px solid var(--ps-border); }
    .ins-meta-icon { width:52px; height:52px; border-radius:12px; background:rgba(0,119,255,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ins-desc { font-size:12px; color:var(--ps-text-muted); line-height:1.5; margin-bottom:6px; }
    .ins-steps-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--ps-text-faint); padding:12px 16px 6px; flex-shrink:0; }
    .ins-steps-list { flex:1; overflow-y:auto; }

    .ins-step-row {
      display:flex; align-items:center; gap:8px; padding:8px 16px;
      cursor:pointer; transition:background 100ms; border-radius:0;
    }
    .ins-step-row:hover { background:var(--ps-bg-hover); }
    .ins-step-row--active { background:rgba(0,119,255,0.08); }
    .ins-step-num { width:18px; height:18px; border-radius:50%; background:var(--ps-bg-app); border:1px solid var(--ps-border); font-size:10px; font-family:var(--font-mono); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--ps-text-muted); }
    .ins-step-label { font-size:12px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    .ins-preview-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .ins-preview-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .ins-preview-area {
      flex:1; display:flex; align-items:center; justify-content:center; overflow:auto;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/32px 32px;
    }
    .ins-result-img { max-width:100%; max-height:100%; object-fit:contain; display:block; }
    .ins-step-scrubber { display:flex; align-items:center; gap:10px; padding:10px 16px; border-top:1px solid var(--ps-border); flex-shrink:0; background:var(--ps-bg-surface); }
  `;
  document.head.appendChild(s);
}
