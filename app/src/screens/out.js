/**
 * ImageChef — OUT: Output Browser
 *
 * Shows run history. Each run can be expanded to browse its output image gallery.
 * Clicking an output image opens a before/after comparison in CMP.
 */

import { getAllRuns, deleteRun }               from '../data/runs.js';
import { getFolder, listImages,
         getOrCreateOutputSubfolder }          from '../data/folders.js';
import { navigate }                            from '../main.js';
import { formatDateTime, formatBytes }         from '../utils/misc.js';

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function statusBadge(status) {
  const cfg = {
    completed: ['check_circle', 'ic-badge--green', 'Completed'],
    failed:    ['error',        'ic-badge--red',   'Failed'],
    cancelled: ['cancel',       '',                'Cancelled'],
    running:   ['sync',         'ic-badge--blue',  'Running'],
  }[status] || ['help', '', status];
  return `<span class="ic-badge ${cfg[1]}"><span class="material-symbols-outlined" style="font-size:11px">${cfg[0]}</span> ${cfg[2]}</span>`;
}

function durationStr(run) {
  if (!run.finishedAt || !run.startedAt) return '—';
  const ms = run.finishedAt - run.startedAt;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  return `${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s`;
}

export async function render(container, hash) {
  const autoRunId = new URLSearchParams((hash || '').split('?')[1] || '').get('run');
  container.innerHTML = `
    <div class="screen out-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">history</span>
          Output History
        </div>
        <button class="btn-secondary" id="out-btn-clear-all">
          <span class="material-symbols-outlined">delete_sweep</span>
          Clear All
        </button>
      </div>
      <div id="out-body" class="out-body">
        <div class="spinner spinner--lg" style="margin:40px auto;display:block"></div>
      </div>
    </div>

    <!-- Lightbox for single-image compare -->
    <div id="out-lightbox" class="out-lightbox" style="display:none">
      <div class="out-lightbox-bg" id="out-lb-bg"></div>
      <div class="out-lightbox-content">
        <div class="out-lb-toolbar">
          <span id="out-lb-title" class="text-sm font-medium"></span>
          <div class="flex items-center gap-2">
            <button class="cmp-mode-btn is-active" data-lb-mode="slider">
              <span class="material-symbols-outlined" style="font-size:14px">swap_horiz</span> Slider
            </button>
            <button class="cmp-mode-btn" data-lb-mode="side">
              <span class="material-symbols-outlined" style="font-size:14px">view_column</span> Side by Side
            </button>
            <button class="btn-icon" id="out-lb-prev" title="Previous image">
              <span class="material-symbols-outlined">chevron_left</span>
            </button>
            <button class="btn-icon" id="out-lb-next" title="Next image">
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
            <button class="btn-secondary btn-sm" id="out-lb-download" title="Download output">
              <span class="material-symbols-outlined" style="font-size:14px">download</span>
            </button>
            <button class="btn-icon" id="out-lb-close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div id="out-lb-view" class="out-lb-view"></div>
      </div>
    </div>`;

  injectOutStyles();

  // ── Lightbox state ────────────────────────────────────────
  let lbImages   = [];  // { outputFile, inputFile|null, name }
  let lbIdx      = 0;
  let lbMode     = 'slider';
  let lbSliderPct = 50;
  let lbDragging  = false;

  function openLightbox(images, startIdx) {
    lbImages = images;
    lbIdx    = startIdx;
    container.querySelector('#out-lightbox').style.display = 'flex';
    renderLb();
  }
  function closeLightbox() {
    container.querySelector('#out-lightbox').style.display = 'none';
    lbImages = [];
    // Revoke any blob URLs
    container.querySelectorAll('[data-lb-url]').forEach(el => URL.revokeObjectURL(el.dataset.lbUrl));
  }
  container.querySelector('#out-lb-bg')?.addEventListener('click', closeLightbox);
  container.querySelector('#out-lb-close')?.addEventListener('click', closeLightbox);
  container.querySelector('#out-lb-prev')?.addEventListener('click', () => { lbIdx = (lbIdx - 1 + lbImages.length) % lbImages.length; renderLb(); });
  container.querySelector('#out-lb-next')?.addEventListener('click', () => { lbIdx = (lbIdx + 1) % lbImages.length; renderLb(); });
  document.addEventListener('keydown', handleKeydown);

  container.querySelectorAll('[data-lb-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      lbMode = btn.dataset.lbMode;
      container.querySelectorAll('[data-lb-mode]').forEach(b => b.classList.toggle('is-active', b === btn));
      renderLb();
    });
  });

  container.querySelector('#out-lb-download')?.addEventListener('click', () => {
    const item = lbImages[lbIdx];
    if (!item?.outputFile) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(item.outputFile);
    a.download = item.outputFile.name;
    a.click();
  });

  function handleKeydown(e) {
    if (container.querySelector('#out-lightbox').style.display === 'none') return;
    if (e.key === 'Escape')     { closeLightbox(); }
    if (e.key === 'ArrowLeft')  { lbIdx = (lbIdx - 1 + lbImages.length) % lbImages.length; renderLb(); }
    if (e.key === 'ArrowRight') { lbIdx = (lbIdx + 1) % lbImages.length; renderLb(); }
  }

  async function renderLb() {
    const item = lbImages[lbIdx];
    if (!item) return;

    const titleEl = container.querySelector('#out-lb-title');
    if (titleEl) titleEl.textContent = `${item.outputFile.name}  (${lbIdx+1}/${lbImages.length})`;

    const prevBtn = container.querySelector('#out-lb-prev');
    const nextBtn = container.querySelector('#out-lb-next');
    if (prevBtn) prevBtn.style.visibility = lbImages.length > 1 ? '' : 'hidden';
    if (nextBtn) nextBtn.style.visibility = lbImages.length > 1 ? '' : 'hidden';

    const afterUrl  = URL.createObjectURL(item.outputFile);
    const beforeUrl = item.inputFile ? URL.createObjectURL(item.inputFile) : null;

    const view = container.querySelector('#out-lb-view');
    if (!view) return;

    if (!beforeUrl) {
      // Output only — just show the image
      view.innerHTML = `<img src="${afterUrl}" class="out-lb-img" data-lb-url="${afterUrl}">`;
      return;
    }

    if (lbMode === 'side') {
      view.innerHTML = `
        <div class="cmp-side-view">
          <div class="cmp-side">
            <div class="cmp-side-label">Before</div>
            <img src="${beforeUrl}" class="cmp-side-img" data-lb-url="${beforeUrl}" draggable="false">
          </div>
          <div class="cmp-divider-vertical"></div>
          <div class="cmp-side">
            <div class="cmp-side-label cmp-side-label--blue">After</div>
            <img src="${afterUrl}" class="cmp-side-img" data-lb-url="${afterUrl}" draggable="false">
          </div>
        </div>`;
    } else {
      lbSliderPct = 50;
      // clip-path approach: both images fill the same box identically (object-fit:contain),
      // the after image is clipped from the right so they align pixel-perfectly.
      view.innerHTML = `
        <div class="cmp-slider-view" id="lb-slider-view">
          <img src="${beforeUrl}" class="lb-cmp-img" draggable="false">
          <img src="${afterUrl}"  class="lb-cmp-img" id="lb-after-img" draggable="false"
               style="clip-path:inset(0 50% 0 0)">
          <div class="cmp-slider-handle" id="lb-handle" style="left:50%">
            <div class="cmp-handle-line"></div>
            <div class="cmp-handle-grip">
              <span class="material-symbols-outlined" style="font-size:16px">swap_horiz</span>
            </div>
          </div>
          <div class="cmp-slider-badge cmp-slider-badge--left">Before</div>
          <div class="cmp-slider-badge cmp-slider-badge--right cmp-slider-badge--blue">After</div>
        </div>`;

      const sliderView = view.querySelector('#lb-slider-view');
      const afterImg   = view.querySelector('#lb-after-img');
      const handle     = view.querySelector('#lb-handle');

      function setSlider(x) {
        const rect = sliderView.getBoundingClientRect();
        lbSliderPct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
        // clip right side of after image — reveals it from left to right as slider moves right
        if (afterImg) afterImg.style.clipPath = `inset(0 ${100 - lbSliderPct}% 0 0)`;
        if (handle)   handle.style.left = `${lbSliderPct}%`;
      }
      handle?.addEventListener('mousedown', e => { lbDragging = true; e.preventDefault(); });
      document.addEventListener('mousemove', e => { if (lbDragging) setSlider(e.clientX); });
      document.addEventListener('mouseup',   () => { lbDragging = false; });
      sliderView?.addEventListener('click', e => { if (!lbDragging) setSlider(e.clientX); });
    }
  }

  // ── Load runs ─────────────────────────────────────────────
  await loadRuns();

  async function loadRuns() {
    const body = container.querySelector('#out-body');
    if (!body) return;

    const runs = await getAllRuns();
    runs.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

    if (!runs.length) {
      body.innerHTML = `<div class="empty-state" style="padding-top:60px">
        <span class="material-symbols-outlined" style="font-size:48px">history</span>
        <div class="empty-state-title">No runs yet</div>
        <div class="empty-state-desc">Process a batch to see output history here.</div>
        <button class="btn-primary" id="out-go-lib">
          <span class="material-symbols-outlined">library_books</span> Browse Recipes
        </button>
      </div>`;
      body.querySelector('#out-go-lib')?.addEventListener('click', () => navigate('#lib'));
      return;
    }

    const completed = runs.filter(r => r.status === 'completed').length;
    const totalImgs = runs.reduce((s, r) => s + (r.successCount || 0), 0);

    body.innerHTML = `
      <div class="out-stats-bar">
        <div class="out-stat-card">
          <span class="out-stat-val">${runs.length}</span>
          <span class="out-stat-label">Total Runs</span>
        </div>
        <div class="out-stat-card">
          <span class="out-stat-val" style="color:var(--ps-green,#22c55e)">${completed}</span>
          <span class="out-stat-label">Completed</span>
        </div>
        <div class="out-stat-card">
          <span class="out-stat-val" style="color:var(--ps-blue)">${totalImgs}</span>
          <span class="out-stat-label">Images Processed</span>
        </div>
      </div>
      <div class="out-run-list">
        ${runs.map(run => runRowHTML(run)).join('')}
      </div>`;

    bindRunActions();

    // Auto-open run from ?run= query param (e.g. navigated from QUE "View Results")
    if (autoRunId) {
      const targetRow = container.querySelector(`.out-run-row[data-id="${autoRunId}"]`);
      if (targetRow) {
        // Expand detail panel
        const detail = targetRow.querySelector(`#out-detail-${autoRunId}`);
        const icon   = targetRow.querySelector('.out-run-chevron');
        if (detail) detail.style.display = 'block';
        if (icon)   icon.style.transform = 'rotate(90deg)';
        // Click "View Files" button
        setTimeout(() => {
          targetRow.querySelector('.out-btn-gallery')?.click();
          targetRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  }

  function runRowHTML(run) {
    return `
      <div class="out-run-row" data-id="${run.id}">
        <div class="out-run-header" data-expand-id="${run.id}">
          <span class="material-symbols-outlined out-run-chevron" style="font-size:16px;color:var(--ps-text-faint);transition:transform 200ms">chevron_right</span>
          <div class="out-run-info">
            <div class="out-run-name">${escHtml(run.recipeName || 'Unknown Recipe')}</div>
            <div class="out-run-meta">
              <span class="mono text-sm text-muted">${run.outputFolder || '—'}</span>
              <span class="text-sm text-muted">${run.startedAt ? formatDateTime(run.startedAt) : '—'}</span>
            </div>
          </div>
          <div class="out-run-stats">
            ${statusBadge(run.status)}
            <span class="out-stat-inline"><span class="material-symbols-outlined" style="font-size:13px">image</span>${run.successCount ?? 0}/${run.imageCount ?? 0}</span>
            ${run.failCount ? `<span class="out-stat-inline" style="color:var(--ps-red)"><span class="material-symbols-outlined" style="font-size:13px">error</span>${run.failCount} failed</span>` : ''}
            <span class="out-stat-inline"><span class="material-symbols-outlined" style="font-size:13px">schedule</span>${durationStr(run)}</span>
          </div>
          <div class="out-run-actions">
            ${run.status === 'completed' ? `<button class="btn-secondary out-btn-gallery" data-id="${run.id}" data-subfolder="${run.outputFolder || 'output'}" style="font-size:12px;padding:5px 10px">
              <span class="material-symbols-outlined" style="font-size:14px">photo_library</span>
              View Files
            </button>
            <button class="btn-secondary out-btn-browse" data-run-id="${run.id}" title="Browse in Folder Viewer" style="font-size:12px;padding:5px 10px">
              <span class="material-symbols-outlined" style="font-size:14px">folder_open</span>
              Browse
            </button>` : ''}
            <button class="btn-icon out-btn-edit" data-recipe-id="${run.recipeId}" title="Edit recipe">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="btn-icon out-btn-use" data-recipe-id="${run.recipeId}" title="Run batch again">
              <span class="material-symbols-outlined">play_arrow</span>
            </button>
            <button class="btn-icon out-btn-delete" data-id="${run.id}" title="Delete record">
              <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
            </button>
          </div>
        </div>

        <div class="out-run-detail" id="out-detail-${run.id}" style="display:none">
          <!-- Gallery section -->
          <div id="out-gallery-${run.id}" class="out-gallery-section" style="display:none"></div>
          <!-- Log section -->
          <div class="out-log-header">
            <span class="text-sm text-muted">Run log</span>
            <span class="mono text-sm text-muted">${run.id.slice(0,8)}</span>
          </div>
          <div class="terminal out-log-body">
            ${(run.log||[]).length === 0
              ? '<span style="color:var(--ps-text-faint)">No log entries.</span>'
              : (run.log||[]).map(e => {
                  const c = e.level === 'error' ? 'var(--ps-red)' : e.level === 'warn' ? '#f59e0b' : e.level === 'ok' ? '#22c55e' : e.level === 'info' ? 'var(--ps-text-muted)' : 'var(--ps-text-faint)';
                  return `<div><span style="color:var(--ps-text-faint)">[${new Date(e.ts).toLocaleTimeString()}]</span> <span style="color:${c}">[${e.level}]</span> <span style="color:${c === 'var(--ps-text-muted)' ? 'var(--ps-text)' : c}">${escHtml(e.msg)}</span></div>`;
                }).join('')}
          </div>
        </div>
      </div>`;
  }

  function bindRunActions() {
    // Expand/collapse
    container.querySelectorAll('[data-expand-id]').forEach(header => {
      header.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        const id     = header.dataset.expandId;
        const detail = container.querySelector(`#out-detail-${id}`);
        const icon   = header.querySelector('.out-run-chevron');
        if (!detail) return;
        const open = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : 'block';
        if (icon) icon.style.transform = open ? '' : 'rotate(90deg)';
      });
    });

    // View gallery
    container.querySelectorAll('.out-btn-gallery').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const runId     = btn.dataset.id;
        const subfolder = btn.dataset.subfolder;
        const galleryEl = container.querySelector(`#out-gallery-${runId}`);
        const detailEl  = container.querySelector(`#out-detail-${runId}`);
        if (!galleryEl) return;

        // Open the detail panel if collapsed
        if (detailEl) detailEl.style.display = 'block';
        const icon = container.querySelector(`[data-expand-id="${runId}"] .out-run-chevron`);
        if (icon) icon.style.transform = 'rotate(90deg)';

        if (galleryEl.dataset.loaded === '1') {
          galleryEl.style.display = galleryEl.style.display === 'none' ? 'block' : 'none';
          return;
        }

        galleryEl.style.display = 'block';
        galleryEl.innerHTML = `<div style="padding:12px;display:flex;align-items:center;gap:8px"><div class="spinner"></div><span class="text-sm text-muted">Loading output files…</span></div>`;

        try {
          const outputHandle = await getFolder('output');
          if (!outputHandle) {
            galleryEl.innerHTML = `<div class="out-gallery-empty">Output folder not accessible. <button class="btn-secondary out-btn-repick">Pick Folder</button></div>`;
            return;
          }

          let subHandle;
          try {
            subHandle = await getOrCreateOutputSubfolder(outputHandle, subfolder);
          } catch {
            galleryEl.innerHTML = `<div class="out-gallery-empty">Subfolder "${subfolder}" not found.</div>`;
            return;
          }

          const outputFiles = await listImages(subHandle);
          if (!outputFiles.length) {
            galleryEl.innerHTML = `<div class="out-gallery-empty">No images found in output folder.</div>`;
            return;
          }

          // Try to find matching input files
          const inputHandle = await getFolder('input');
          let inputFiles = [];
          if (inputHandle) {
            try { inputFiles = await listImages(inputHandle); } catch {}
          }

          const inputByBaseName = new Map();
          for (const f of inputFiles) {
            const base = f.name.replace(/\.[^.]+$/, '').replace(/_\w+$/, ''); // strip suffix
            inputByBaseName.set(base, f);
            inputByBaseName.set(f.name.replace(/\.[^.]+$/, ''), f);
          }

          // Build image pairs — try progressively looser name matches
          const pairs = outputFiles.map(outFile => {
            const withoutExt    = outFile.name.replace(/\.[^.]+$/, '');         // "a_bw.jpg" → "a_bw"
            const withoutSuffix = withoutExt.replace(/_[a-z0-9]+$/i, '');      // "a_bw"    → "a"
            const withoutBoth   = withoutSuffix.replace(/\.[^.]+$/, '');        // "a.jpg"   → "a"
            const inFile = inputByBaseName.get(withoutExt)
                        || inputByBaseName.get(withoutSuffix)
                        || inputByBaseName.get(withoutBoth)
                        || null;
            return { outputFile: outFile, inputFile: inFile };
          });

          // Render gallery
          const thumbs = pairs.map((pair, i) => {
            const url = URL.createObjectURL(pair.outputFile);
            return `<div class="out-thumb" data-pair-idx="${i}">
              <img src="${url}" class="out-thumb-img" draggable="false" loading="lazy">
              <div class="out-thumb-overlay">
                <span class="out-thumb-name">${escHtml(pair.outputFile.name)}</span>
                <div class="out-thumb-btns">
                  ${pair.inputFile ? `<button class="btn-icon out-thumb-compare" data-pair-idx="${i}" title="Compare">
                    <span class="material-symbols-outlined" style="font-size:14px">compare</span>
                  </button>` : ''}
                  <button class="btn-icon out-thumb-download" data-pair-idx="${i}" title="Download">
                    <span class="material-symbols-outlined" style="font-size:14px">download</span>
                  </button>
                </div>
              </div>
            </div>`;
          }).join('');

          const matchCount = pairs.filter(p => p.inputFile).length;
          galleryEl.innerHTML = `
            <div class="out-gallery-header">
              <span class="text-sm text-muted">${outputFiles.length} file${outputFiles.length !== 1 ? 's' : ''} in <code>${subfolder}/</code></span>
              <button class="btn-secondary out-btn-browse-gallery" data-run-id="${runId}" style="font-size:11px;padding:4px 8px;margin-left:8px">
                <span class="material-symbols-outlined" style="font-size:13px">folder_open</span> Browse Folder
              </button>
              ${matchCount
                ? `<span class="text-sm text-muted" style="margin-left:6px">&nbsp;·&nbsp; ${matchCount} originals matched for comparison</span>`
                : `<span style="margin-left:8px;display:flex;align-items:center;gap:6px">
                     <span class="ic-badge">No originals matched</span>
                     <button class="btn-secondary out-btn-reload-gallery" data-run-id="${runId}" style="font-size:11px;padding:4px 8px">
                       <span class="material-symbols-outlined" style="font-size:13px">folder_open</span>
                       Re-authorize input folder
                     </button>
                   </span>`}
            </div>
            <div class="out-thumb-grid">${thumbs}</div>`;

          galleryEl.dataset.loaded = matchCount > 0 ? '1' : '0'; // allow reload if no originals matched

          // Browse folder button in gallery header
          galleryEl.querySelectorAll('.out-btn-browse-gallery').forEach(browseBtn => {
            browseBtn.addEventListener('click', e => {
              e.stopPropagation();
              navigate(`#fld?run=${browseBtn.dataset.runId}&from=out`);
            });
          });

          // Re-authorize input folder button
          galleryEl.querySelectorAll('.out-btn-reload-gallery').forEach(reloadBtn => {
            reloadBtn.addEventListener('click', async e => {
              e.stopPropagation();
              try {
                await import('../data/folders.js').then(m => m.pickFolder('input'));
                galleryEl.dataset.loaded = '0'; // force reload
                btn.click(); // re-trigger the gallery load
              } catch {}
            });
          });

          // Bind click handlers
          galleryEl.querySelectorAll('.out-thumb').forEach(thumb => {
            thumb.addEventListener('click', e => {
              if (e.target.closest('button')) return;
              const idx = parseInt(thumb.dataset.pairIdx);
              openLightbox(pairs, idx);
            });
          });
          galleryEl.querySelectorAll('.out-thumb-compare').forEach(btn => {
            btn.addEventListener('click', e => {
              e.stopPropagation();
              openLightbox(pairs, parseInt(btn.dataset.pairIdx));
            });
          });
          galleryEl.querySelectorAll('.out-thumb-download').forEach(btn => {
            btn.addEventListener('click', e => {
              e.stopPropagation();
              const pair = pairs[parseInt(btn.dataset.pairIdx)];
              const a = document.createElement('a');
              a.href = URL.createObjectURL(pair.outputFile);
              a.download = pair.outputFile.name;
              a.click();
            });
          });

        } catch (err) {
          galleryEl.innerHTML = `<div class="out-gallery-empty">Error: ${escHtml(err.message)}</div>`;
        }
      });
    });

    // Browse folder viewer
    container.querySelectorAll('.out-btn-browse').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        navigate(`#fld?run=${btn.dataset.runId}&from=out`);
      });
    });

    // Edit recipe
    container.querySelectorAll('.out-btn-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        navigate(btn.dataset.recipeId ? `#bld?id=${btn.dataset.recipeId}` : '#lib');
      });
    });

    // Use recipe (run batch again)
    container.querySelectorAll('.out-btn-use').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        navigate(btn.dataset.recipeId ? `#set?recipe=${btn.dataset.recipeId}` : '#lib');
      });
    });

    // Delete run
    container.querySelectorAll('.out-btn-delete').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Delete this run record?')) return;
        await deleteRun(btn.dataset.id);
        await loadRuns();
      });
    });
  }

  // Clear all
  container.querySelector('#out-btn-clear-all')?.addEventListener('click', async () => {
    const runs = await getAllRuns();
    if (!runs.length) return;
    if (!confirm(`Delete all ${runs.length} run record${runs.length !== 1 ? 's' : ''}?`)) return;
    await Promise.all(runs.map(r => deleteRun(r.id)));
    window.AuroraToast?.show({ variant: 'success', title: 'All run records cleared' });
    await loadRuns();
  });

  return () => document.removeEventListener('keydown', handleKeydown);
}

let _outStyles = false;
function injectOutStyles() {
  if (_outStyles) return;
  _outStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .out-screen { display:flex; flex-direction:column; height:100%; }
    .out-body { flex:1; overflow-y:auto; padding:16px 20px; }

    .out-stats-bar { display:flex; gap:12px; margin-bottom:20px; }
    .out-stat-card { flex:1; background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:4px; }
    .out-stat-val { font-size:24px; font-weight:700; font-family:var(--font-mono); }
    .out-stat-label { font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--ps-text-faint); }

    .out-run-list { display:flex; flex-direction:column; gap:8px; }
    .out-run-row { background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:10px; overflow:hidden; }
    .out-run-header { display:flex; align-items:center; gap:10px; padding:12px 14px; cursor:pointer; transition:background 100ms; }
    .out-run-header:hover { background:var(--ps-bg-hover); }
    .out-run-info { flex:1; overflow:hidden; }
    .out-run-name { font-size:14px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:3px; }
    .out-run-meta { display:flex; gap:12px; flex-wrap:wrap; }
    .out-run-stats { display:flex; align-items:center; gap:8px; flex-shrink:0; flex-wrap:wrap; }
    .out-run-actions { display:flex; gap:4px; flex-shrink:0; align-items:center; }
    .out-stat-inline { display:flex; align-items:center; gap:3px; font-size:12px; color:var(--ps-text-muted); font-family:var(--font-mono); }

    .out-run-detail { border-top:1px solid var(--ps-border); }
    .out-log-header { display:flex; justify-content:space-between; padding:8px 14px; background:var(--ps-bg-app); }
    .out-log-body { max-height:160px; overflow-y:auto; margin:0; border-radius:0; border:none; font-size:11px; line-height:1.6; }

    /* Gallery */
    .out-gallery-section { border-bottom:1px solid var(--ps-border); background:var(--ps-bg-app); padding:12px 14px; }
    .out-gallery-header { display:flex; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:4px; }
    .out-gallery-empty { padding:16px; color:var(--ps-text-muted); font-size:13px; }
    .out-thumb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:8px; }
    .out-thumb { position:relative; border-radius:8px; overflow:hidden; cursor:pointer; aspect-ratio:1; background:var(--ps-bg-surface); border:1px solid var(--ps-border); }
    .out-thumb:hover .out-thumb-overlay { opacity:1; }
    .out-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }
    .out-thumb-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.65); display:flex; flex-direction:column; justify-content:flex-end; padding:6px; opacity:0; transition:opacity 150ms; }
    .out-thumb-name { font-size:9px; color:#fff; font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:4px; }
    .out-thumb-btns { display:flex; gap:3px; }
    .out-thumb-btns .btn-icon { width:24px; height:24px; background:rgba(255,255,255,0.15); border-radius:4px; }
    .out-thumb-btns .btn-icon:hover { background:var(--ps-blue); }

    /* Lightbox */
    .out-lightbox { position:fixed; inset:0; z-index:500; display:flex; align-items:center; justify-content:center; }
    .out-lightbox-bg { position:absolute; inset:0; background:rgba(0,0,0,0.85); }
    .out-lightbox-content { position:relative; z-index:1; width:92vw; height:90vh; background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:14px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 80px rgba(0,0,0,0.6); }
    .out-lb-toolbar { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--ps-border); flex-shrink:0; gap:8px; }
    .out-lb-view { flex:1; overflow:hidden; position:relative; background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%,var(--ps-bg-app) 0% 50%) 0 0/24px 24px; }
    .out-lb-img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; }
    /* Both images in slider share the same box — clip-path cuts the after image at the handle position */
    .lb-cmp-img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; }

    /* Reuse CMP classes (injected by cmp.js if visited, or inline here) */
    .cmp-side-view { display:flex; width:100%; height:100%; }
    .cmp-side { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
    .cmp-side-img { width:100%; height:100%; object-fit:contain; display:block; }
    .cmp-side-label { position:absolute; top:10px; left:10px; z-index:2; background:rgba(0,0,0,0.7); color:#fff; font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; font-family:var(--font-mono); }
    .cmp-side-label--blue { background:rgba(0,119,255,0.85); }
    .cmp-divider-vertical { width:2px; background:var(--ps-border); flex-shrink:0; }
    .cmp-slider-view { position:relative; width:100%; height:100%; overflow:hidden; user-select:none; cursor:col-resize; }
    .cmp-slider-base { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
    .cmp-slider-clip { position:absolute; top:0; left:0; height:100%; overflow:hidden; }
    .cmp-slider-after { position:absolute; top:0; left:0; width:100vw; max-width:none; height:100%; object-fit:contain; }
    .cmp-slider-handle { position:absolute; top:0; height:100%; transform:translateX(-50%); display:flex; align-items:center; pointer-events:none; z-index:10; }
    .cmp-handle-line { position:absolute; top:0; left:50%; width:2px; height:100%; background:rgba(255,255,255,0.9); transform:translateX(-50%); box-shadow:0 0 8px rgba(0,0,0,0.4); }
    .cmp-handle-grip { position:relative; z-index:1; width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.95); box-shadow:0 2px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; cursor:col-resize; pointer-events:all; color:#111; }
    .cmp-slider-badge { position:absolute; top:10px; z-index:5; background:rgba(0,0,0,0.7); color:#fff; font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; font-family:var(--font-mono); }
    .cmp-slider-badge--left { left:10px; }
    .cmp-slider-badge--right { right:10px; }
    .cmp-slider-badge--blue { background:rgba(0,119,255,0.85); }
    .cmp-mode-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden; }
    .cmp-mode-btn { display:flex; align-items:center; gap:5px; padding:5px 10px; font-size:12px; font-weight:500; background:transparent; border:none; color:var(--ps-text-muted); cursor:pointer; font-family:var(--font-primary); transition:background 150ms,color 150ms; }
    .cmp-mode-btn.is-active { background:var(--ps-blue); color:#fff; }
    .cmp-mode-btn:hover:not(.is-active) { background:var(--ps-bg-hover); color:var(--ps-text); }
  `;
  document.head.appendChild(s);
}
