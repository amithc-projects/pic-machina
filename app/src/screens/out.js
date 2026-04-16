/**
 * ImageChef — OUT: Output Browser
 *
 * Shows run history. Each run can be expanded to browse its output image gallery.
 * Clicking an output image opens a before/after comparison in CMP.
 */

import { getAllRuns, deleteRun, getRun }       from '../data/runs.js';
import { getFolder, listImages,
         getOrCreateOutputSubfolder }          from '../data/folders.js';
import { saveShowcase }                        from '../data/showcases.js';
import { navigate }                            from '../main.js';
import { formatDateTime, formatBytes, uuid, now } from '../utils/misc.js';
import { showConfirm }                            from '../utils/dialogs.js';
import { getSettings }                            from '../utils/settings.js';

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
      <div class="out-lightbox-content" id="out-lb-content" style="padding:0;overflow:hidden">
        <!-- ImageWorkspace mounts here -->
      </div>
    </div>`;

  injectOutStyles();

  // ── Lightbox state ────────────────────────────────────────
  let currentPairs = [];
  let blobUrls = [];
  let fldWorkspace = null;

  async function ensureWorkspace() {
    if (fldWorkspace) return fldWorkspace;
    const { ImageWorkspace } = await import('../components/image-workspace.js');

    const wsDiv = document.createElement('div');
    wsDiv.style.position = 'absolute';
    wsDiv.style.inset = '0';
    container.querySelector('#out-lb-content').appendChild(wsDiv);

    fldWorkspace = new ImageWorkspace(wsDiv, {
      allowUpload: false,
      allowFolder: true, // Show carousel if multiple files
      customControlsHtml: `
        <button class="btn-secondary btn-sm iw-download-btn" title="Download output" style="margin-left:8px">
          <span class="material-symbols-outlined" style="font-size:14px">download</span>
        </button>
        <button class="btn-icon iw-close-btn" title="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
      `,
      onBindCustomControls: (cnt) => {
        cnt.querySelector('.iw-close-btn')?.addEventListener('click', closeLightbox);
        cnt.querySelector('.iw-download-btn')?.addEventListener('click', () => {
          if (!fldWorkspace.activeFile) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(fldWorkspace.activeFile);
          a.download = fldWorkspace.activeFile.name;
          a.click();
        });
      },
      onRender: async (file) => {
        const pair = currentPairs.find(p => p.outputFile === file);
        if (!pair) return null;

        const beforeUrl = URL.createObjectURL(pair.inputFile || pair.outputFile);
        const afterUrl = URL.createObjectURL(pair.outputFile);
        blobUrls.push(beforeUrl, afterUrl);

        return {
          beforeUrl,
          afterUrl,
          beforeLabel: pair.inputFile ? 'Input' : 'Output',
          afterLabel: pair.inputFile ? 'Output' : 'Output',
          context: { filename: file.name },
          canCompare: !!pair.inputFile
        };
      },
      onFilesChange: (files, activeFile) => {
        const titleEl = wsDiv.querySelector('.iw-title');
        if (titleEl && activeFile) {
          const idx = files.indexOf(activeFile) + 1;
          titleEl.textContent = `${activeFile.name}  (${idx}/${files.length})`;
        }
      }
    });

    return fldWorkspace;
  }

  async function openLightbox(pairs, startIdx) {
    currentPairs = pairs;
    container.querySelector('#out-lightbox').style.display = 'flex';
    const ws = await ensureWorkspace();
    const files = pairs.map(p => p.outputFile);
    ws.setFiles(files, startIdx);

  }

  function closeLightbox() {
    container.querySelector('#out-lightbox').style.display = 'none';
    currentPairs = [];
    blobUrls.forEach(u => URL.revokeObjectURL(u));
    blobUrls = [];
  }

  container.querySelector('#out-lb-bg')?.addEventListener('click', closeLightbox);

  function handleKeydown(e) {
    if (container.querySelector('#out-lightbox').style.display === 'none') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (!fldWorkspace) return;
      const files = fldWorkspace.files;
      if (files.length <= 1) return;
      
      const idx = files.indexOf(fldWorkspace.activeFile);
      let newIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
      if (newIdx < 0) newIdx = files.length - 1;
      if (newIdx >= files.length) newIdx = 0;
      
      fldWorkspace.setFiles(files, newIdx);
    }
  }
  document.addEventListener('keydown', handleKeydown);

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
            </button>
            <button class="btn-icon out-btn-showcase" data-run-id="${run.id}" title="Add to ShowCase">
              <span class="material-symbols-outlined">star</span>
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
          const run = await getRun(runId);
          let outputHandle = run?.outputHandleObj || await getFolder('output');
          
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
            const withoutSuffix = withoutExt.replace(/[-_][a-z0-9]+$/i, '');    // "a_bw"    → "a"
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
              <button class="btn-secondary out-btn-showcase-gallery" data-run-id="${runId}" style="font-size:11px;padding:4px 8px;margin-left:4px">
                <span class="material-symbols-outlined" style="font-size:13px">star</span> Add to ShowCase
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

          // Add to ShowCase button in gallery header
          galleryEl.querySelectorAll('.out-btn-showcase-gallery').forEach(shcBtn => {
            shcBtn.addEventListener('click', async e => {
              e.stopPropagation();
              const r = await getRun(shcBtn.dataset.runId);
              if (r) await addRunToShowcase(r, outputFiles);
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
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const runId = btn.dataset.runId;
        const run = await getRun(runId);
        if (!run) return;
        let outputHandle = run.outputHandleObj || await getFolder('output');
        if (!outputHandle) return;
        try {
          const subHandle = await getOrCreateOutputSubfolder(outputHandle, run.outputFolder || 'output');
          window._icFldTargetHandle = subHandle;
          navigate('#fld');
        } catch (err) {
          window.AuroraToast?.show({ variant: 'danger', title: 'Subfolder not found', description: err.message });
        }
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

    // Add to ShowCase (from run row)
    container.querySelectorAll('.out-btn-showcase').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const run = await getRun(btn.dataset.runId);
        if (run) await addRunToShowcase(run);
      });
    });

    // Delete run
    container.querySelectorAll('.out-btn-delete').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const confirmed = await showConfirm({
          title: 'Delete Run Record?',
          body: 'This will remove the execution record and its history. This action cannot be undone.',
          confirmText: 'Delete',
          variant: 'danger',
          icon: 'delete_forever'
        });
        if (!confirmed) return;
        await deleteRun(btn.dataset.id);
        await loadRuns();
      });
    });
  }

  // Clear all
  container.querySelector('#out-btn-clear-all')?.addEventListener('click', async () => {
    const runs = await getAllRuns();
    if (!runs.length) return;
    const confirmed = await showConfirm({
      title: 'Clear All History?',
      body: `Are you sure you want to delete all ${runs.length} execution records? This cannot be undone.`,
      confirmText: 'Clear All',
      variant: 'danger',
      icon: 'delete_sweep'
    });
    if (!confirmed) return;
    await Promise.all(runs.map(r => deleteRun(r.id)));
    window.AuroraToast?.show({ variant: 'success', title: 'All run records cleared' });
    await loadRuns();
  });

  return () => document.removeEventListener('keydown', handleKeydown);
}

// ── Add to ShowCase helper ────────────────────────────────────────────────────
async function addRunToShowcase(run, preloadedFiles) {
  try {
    let files = preloadedFiles;
    if (!files) {
      let outputHandle = run.outputHandleObj || await getFolder('output');
      if (!outputHandle) {
        window.AuroraToast?.show({ variant: 'warning', title: 'Output folder not accessible' });
        return;
      }
      const subHandle = await getOrCreateOutputSubfolder(outputHandle, run.outputFolder || 'output');
      files = await listImages(subHandle, { includeVideo: true });
    }

    const sampleFiles     = files.slice(0, 5);
    const sampleFileNames = sampleFiles.map(f => f.name);

    // Capture matching input filenames so the showcase can show before/after
    let sampleInputFileNames = [];
    try {
      const inputHandle = await getFolder('input');
      if (inputHandle) {
        const inputFiles = await listImages(inputHandle, { includeVideo: true });
        const inputByBase = new Map();
        for (const f of inputFiles) {
          inputByBase.set(f.name.replace(/\.[^.]+$/, ''), f.name);
          inputByBase.set(f.name, f.name);
        }
        // Try 1:1 match for each output filename
        sampleInputFileNames = sampleFiles.map(outFile => {
          const base     = outFile.name.replace(/\.[^.]+$/, '');
          const stripped = base.replace(/[-_][a-z0-9]+$/i, '');
          return inputByBase.get(base) || inputByBase.get(stripped) || null;
        }).filter(Boolean);
        // Fallback: take the first 5 inputs when no name matches found
        if (!sampleInputFileNames.length && inputFiles.length) {
          sampleInputFileNames = inputFiles.slice(0, 5).map(f => f.name);
        }
      }
    } catch {}

    const entry = {
      id:                   uuid(),
      runId:                run.id,
      recipeId:             run.recipeId,
      recipeName:           run.recipeName,
      title:                run.recipeName,
      description:          '',
      sampleFileNames,
      sampleInputFileNames,
      createdAt:            now(),
      updatedAt:            now(),
    };
    await saveShowcase(entry);

    window.AuroraToast?.show({
      variant: 'success',
      title: 'Added to ShowCase',
      description: `<a href="#shc?id=${entry.id}" style="color:var(--ps-blue)">View entry →</a>`,
    });
  } catch (err) {
    console.error('[addRunToShowcase]', err);
    window.AuroraToast?.show({ variant: 'danger', title: 'Failed to add to ShowCase', description: err.message });
  }
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

  `;
  document.head.appendChild(s);
}
