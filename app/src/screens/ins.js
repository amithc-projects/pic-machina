/**
 * ImageChef — INS: Block Inspector
 *
 * Read-only view of a block's steps with live preview.
 * Accessed via #ins?id=<blockId>
 */

import { getBlock, cloneBlock } from '../data/blocks.js';
import { navigate }             from '../main.js';
import { registry }             from '../engine/index.js';
import { ImageProcessor }      from '../engine/index.js';
import { checkTransformAvailability } from '../engine/capabilities.js';
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
          <button class="btn-icon" id="ins-btn-info" title="Image info for last test image">
            <span class="material-symbols-outlined">info</span>
          </button>
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
        <div class="ins-preview-panel" style="display:flex;flex-direction:column;">
          <div id="ins-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0"></div>
          
          <div id="ins-step-scrubber" class="ins-step-scrubber" style="display:none">
            <span class="text-sm text-muted" style="flex-shrink:0">Step:</span>
            <input type="range" id="ins-step-slider" class="ic-range" min="0" value="0" style="flex:1">
            <span id="ins-step-label" class="mono text-sm" style="min-width:80px;text-align:right">Original</span>
          </div>
        </div>
      </div>
    </div>`;

  injectInsStyles();

  // Async pass: annotate step rows with warning icons for unmet requirements
  (async () => {
    for (let i = 0; i < block.nodes.length; i++) {
      const node = block.nodes[i];
      if (!node.transformId) continue;
      const { available } = await checkTransformAvailability(node.transformId);
      if (available) continue;
      const row = container.querySelector(`.ins-step-row[data-idx="${i}"]`);
      row?.insertAdjacentHTML('beforeend',
        `<span class="material-symbols-outlined" title="Needs setup"
               style="font-size:12px;color:var(--ps-warning,#f59e0b);margin-left:auto;flex-shrink:0">warning</span>`);
    }
  })();

  container.querySelector('#ins-back')?.addEventListener('click', () => navigate('#bkb'));
  container.querySelector('#ins-edit-btn')?.addEventListener('click', () => navigate(`#bkb?id=${block.id}`));

  // ── Metadata panel (i) button ─────────────────────────
  {
    const { MetadataPanel } = await import('../components/metadata-panel.js');
    const infoPanelHost = document.createElement('div');
    infoPanelHost.style.cssText = 'position:fixed;top:0;right:0;height:100vh;z-index:200;';
    container.appendChild(infoPanelHost);
    const infoPanel = new MetadataPanel(infoPanelHost, { dirHandle: null, startHidden: true });

    container.querySelector('#ins-btn-info')?.addEventListener('click', async () => {
      const tf = window._icTestImage?.file;
      if (!tf) {
        window.AuroraToast?.show({ variant: 'info', title: 'No test image selected yet' });
        return;
      }
      if (infoPanel.isVisible()) {
        infoPanel.hide();
      } else {
        await infoPanel.setFile(tf);
        infoPanel.show();
      }
    });
  }

  container.querySelector('#ins-clone-btn')?.addEventListener('click', async () => {
    const c = await cloneBlock(block.id);
    window.AuroraToast?.show({ variant: 'success', title: `"${c.name}" cloned` });
    navigate(`#bkb?id=${c.id}`);
  });

  // Step row click → jump preview
  let stepResults = [];
  let currentlyProcessedFile = null;
  let activeStepIdx = 0;
  let testFile = null;

  const { ImageWorkspace } = await import('../components/image-workspace.js');
  const wsContainer = container.querySelector('#ins-workspace-container');

  const workspace = new ImageWorkspace(wsContainer, {
    allowUpload: true,
    allowFolder: false, // Blocks test on a single focused image
    onFilesChange: (files, activeFile) => {
      window._icTestImage = { file: activeFile };
      testFile = activeFile;
      if (!activeFile) {
        container.querySelector('#ins-step-scrubber').style.display = 'none';
        stepResults = [];
        currentlyProcessedFile = null;
      }
    },
    onRender: async (file) => {
      if (currentlyProcessedFile !== file) {
        currentlyProcessedFile = file;
        
        const url  = URL.createObjectURL(file);
        const img  = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        const exif = await extractExif(file);
        const ctx  = { filename: file.name, exif, meta: {} };

        stepResults = [{ label: 'Original', dataUrl: url }];

        for (let i = 0; i < block.nodes.length; i++) {
          const proc = new ImageProcessor();
          await proc.process(img, block.nodes, { ...ctx, variables: new Map() }, i);
          const label = block.nodes[i].label || block.nodes[i].transformId || block.nodes[i].type;
          stepResults.push({ label, dataUrl: proc.canvas.toDataURL('image/jpeg', 0.85) });
        }

        activeStepIdx = stepResults.length - 1;

        const slider = container.querySelector('#ins-step-slider');
        if (slider) { 
          slider.max = stepResults.length - 1; 
          slider.value = activeStepIdx; 
        }
        container.querySelector('#ins-step-scrubber').style.display = 'flex';
      }

      updateScrubberUI(activeStepIdx);

      return {
        beforeUrl: stepResults[0]?.dataUrl,
        afterUrl: stepResults[activeStepIdx]?.dataUrl || stepResults[0]?.dataUrl,
        beforeLabel: 'Original',
        afterLabel: activeStepIdx === 0 ? 'Original' : `Step ${activeStepIdx}: ${stepResults[activeStepIdx]?.label}`,
        context: { filename: file.name }
      };
    }
  });

  if (window._icTestImage?.file) {
    workspace.setFiles([window._icTestImage.file]);
  }

  function updateScrubberUI(idx) {
    const step = stepResults[idx];
    if (!step) return;
    const label = container.querySelector('#ins-step-label');
    if (label) label.textContent = idx === 0 ? 'Original' : `Step ${idx}: ${step.label}`;

    // Highlight active step row
    container.querySelectorAll('.ins-step-row').forEach((row, i) => {
      row.classList.toggle('ins-step-row--active', i === idx - 1);
    });
  }

  container.querySelectorAll('.ins-step-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.idx) + 1;
      const slider = container.querySelector('#ins-step-slider');
      if (slider) { slider.value = idx; }
      activeStepIdx = idx;
      if (testFile) workspace.triggerProcess();
    });
  });

  container.querySelector('#ins-step-slider')?.addEventListener('input', e => {
    activeStepIdx = parseInt(e.target.value);
    if (testFile) workspace.triggerProcess(); // triggerProcess returns fast due to cache
  });
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
