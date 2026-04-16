/**
 * PicMachina — SHC: ShowCase Screen
 *
 * List view: searchable, filterable grid of curated run outputs.
 * Detail view: before/after thumbnails, editable title/description, pipeline diagram.
 *
 * Routes:
 *   #shc          — list view
 *   #shc?id=<id>  — detail view
 */

import { getAllShowcases, getShowcase, saveShowcase, deleteShowcase } from '../data/showcases.js';
import { getRun }                        from '../data/runs.js';
import { getRecipe }                     from '../data/recipes.js';
import { getFolder, getOrCreateOutputSubfolder,
         listImages }                    from '../data/folders.js';
import { registry }                      from '../engine/index.js';
import { navigate }                      from '../main.js';
import { formatDateTime }                from '../utils/misc.js';
import { showConfirm }                   from '../utils/dialogs.js';

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm']);

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function mediaTypeOf(sampleFileNames) {
  if (!sampleFileNames?.length) return 'image';
  return sampleFileNames.some(n => VIDEO_EXTS.has(n.slice(n.lastIndexOf('.')).toLowerCase())) ? 'video' : 'image';
}

export async function render(container, hash) {
  const params      = new URLSearchParams((hash || '').split('?')[1] || '');
  const showcaseId  = params.get('id');

  injectShcStyles();

  if (showcaseId) {
    await renderDetail(container, showcaseId);
  } else {
    await renderList(container);
  }
}

// ─── List View ────────────────────────────────────────────────────────────────

async function renderList(container) {
  container.innerHTML = `
    <div class="screen shc-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">star</span>
          ShowCase
        </div>
      </div>
      <div class="shc-list-toolbar">
        <div class="shc-search-wrap">
          <span class="material-symbols-outlined shc-search-icon">search</span>
          <input id="shc-search" class="shc-search-input" placeholder="Search by title, recipe, description…" type="search">
        </div>
        <div class="shc-filter-tabs" role="tablist">
          <button class="shc-filter-tab is-active" data-filter="all" role="tab">All</button>
          <button class="shc-filter-tab" data-filter="image" role="tab">
            <span class="material-symbols-outlined" style="font-size:14px">image</span> Images
          </button>
          <button class="shc-filter-tab" data-filter="video" role="tab">
            <span class="material-symbols-outlined" style="font-size:14px">movie</span> Videos
          </button>
        </div>
      </div>
      <div id="shc-body" class="shc-body">
        <div class="spinner spinner--lg" style="margin:60px auto;display:block"></div>
      </div>
    </div>`;

  const body = container.querySelector('#shc-body');
  const showcases = await getAllShowcases();
  showcases.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!showcases.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding-top:60px">
        <span class="material-symbols-outlined" style="font-size:48px">star_border</span>
        <div class="empty-state-title">No showcase entries yet</div>
        <div class="empty-state-desc">Go to Output History and click the star on a completed run to add it here.</div>
        <button class="btn-primary" id="shc-go-out">
          <span class="material-symbols-outlined">history</span> Output History
        </button>
      </div>`;
    body.querySelector('#shc-go-out')?.addEventListener('click', () => navigate('#out'));
    return;
  }

  body.innerHTML = `
    <div id="shc-empty-filtered" class="shc-empty-filtered" style="display:none">
      <span class="material-symbols-outlined" style="font-size:36px;opacity:.4">search_off</span>
      <div class="text-muted" style="margin-top:8px">No entries match your search.</div>
    </div>
    <div class="shc-grid" id="shc-grid"></div>`;

  const grid = body.querySelector('#shc-grid');

  for (const entry of showcases) {
    const type = mediaTypeOf(entry.sampleFileNames);
    const searchText = [entry.title, entry.recipeName, entry.description].filter(Boolean).join(' ').toLowerCase();

    const card = document.createElement('div');
    card.className = 'shc-card';
    card.dataset.id     = entry.id;
    card.dataset.type   = type;
    card.dataset.search = searchText;
    card.innerHTML = `
      <div class="shc-card-hero shc-card-hero--loading">
        ${type === 'video'
          ? `<span class="material-symbols-outlined shc-card-hero-placeholder">movie</span>`
          : `<span class="material-symbols-outlined shc-card-hero-placeholder">image</span>`}
      </div>
      <div class="shc-card-body">
        <div class="shc-card-title">${escHtml(entry.title || entry.recipeName || 'Untitled')}</div>
        <div class="shc-card-meta">
          <span class="shc-card-type-badge shc-card-type-badge--${type}">${type}</span>
          <span class="text-sm text-muted">${escHtml(entry.recipeName || '')}</span>
          <span class="text-sm text-muted">${entry.createdAt ? formatDateTime(entry.createdAt) : ''}</span>
        </div>
        ${entry.description ? `<div class="shc-card-desc">${escHtml(entry.description)}</div>` : ''}
      </div>
      <div class="shc-card-hover-actions">
        <button class="btn-icon shc-card-edit" data-id="${entry.id}" title="Open">
          <span class="material-symbols-outlined">open_in_full</span>
        </button>
        <button class="btn-icon shc-card-delete" data-id="${entry.id}" title="Delete">
          <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
        </button>
      </div>`;
    grid.appendChild(card);

    loadCardHeroImage(card, entry).catch(() => {});

    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      navigate(`#shc?id=${entry.id}`);
    });
  }

  // ── Hover actions ──
  grid.querySelectorAll('.shc-card-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); navigate(`#shc?id=${btn.dataset.id}`); });
  });

  grid.querySelectorAll('.shc-card-delete').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const confirmed = await showConfirm({
        title: 'Delete Showcase Entry?',
        body: 'This will remove the showcase entry. The original run and its files are unaffected.',
        confirmText: 'Delete', variant: 'danger', icon: 'delete_forever',
      });
      if (!confirmed) return;
      await deleteShowcase(btn.dataset.id);
      btn.closest('.shc-card')?.remove();
      applyFilter();
    });
  });

  // ── Filter & search ──
  let activeFilter = 'all';
  let searchQuery  = '';

  function applyFilter() {
    const cards = grid.querySelectorAll('.shc-card');
    let visible = 0;
    cards.forEach(card => {
      const typeMatch   = activeFilter === 'all' || card.dataset.type === activeFilter;
      const searchMatch = !searchQuery || card.dataset.search.includes(searchQuery);
      const show = typeMatch && searchMatch;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    body.querySelector('#shc-empty-filtered').style.display = visible === 0 ? 'flex' : 'none';
  }

  container.querySelectorAll('.shc-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.shc-filter-tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      activeFilter = tab.dataset.filter;
      applyFilter();
    });
  });

  let searchDebounce;
  container.querySelector('#shc-search')?.addEventListener('input', e => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = e.target.value.trim().toLowerCase();
      applyFilter();
    }, 150);
  });
}

async function loadCardHeroImage(card, entry) {
  const hero = card.querySelector('.shc-card-hero');
  if (!entry.sampleFileNames?.length) return;

  const run = await getRun(entry.runId);
  if (!run?.outputHandleObj) return;

  const subHandle = await getOrCreateOutputSubfolder(run.outputHandleObj, run.outputFolder || 'output');
  const firstName = entry.sampleFileNames[0];

  for await (const [name, fileEntry] of subHandle.entries()) {
    if (name === firstName && fileEntry.kind === 'file') {
      const file = await fileEntry.getFile();
      const isVideo = VIDEO_EXTS.has(name.slice(name.lastIndexOf('.')).toLowerCase());
      if (isVideo) {
        hero.innerHTML = `<div class="shc-card-hero-video">
          <span class="material-symbols-outlined" style="font-size:48px;opacity:.7">movie</span>
          <span class="shc-card-hero-video-name">${escHtml(name)}</span>
        </div>`;
      } else {
        const url = URL.createObjectURL(file);
        hero.innerHTML = `<img src="${url}" class="shc-card-hero-img" alt="">`;
        hero.querySelector('img').addEventListener('load', () => URL.revokeObjectURL(url));
      }
      hero.classList.remove('shc-card-hero--loading');
      return;
    }
  }
}

// ─── Detail View ──────────────────────────────────────────────────────────────

async function renderDetail(container, showcaseId) {
  container.innerHTML = `
    <div class="screen shc-screen">
      <div class="screen-header">
        <button class="btn-icon" id="shc-back" title="Back to ShowCase">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="screen-title">
          <span class="material-symbols-outlined">star</span>
          ShowCase
        </div>
      </div>
      <div id="shc-detail-body" class="shc-detail-body">
        <div class="spinner spinner--lg" style="margin:60px auto;display:block"></div>
      </div>
    </div>`;

  container.querySelector('#shc-back')?.addEventListener('click', () => navigate('#shc'));

  const entry = await getShowcase(showcaseId);
  if (!entry) {
    container.querySelector('#shc-detail-body').innerHTML = `
      <div class="empty-state" style="padding-top:60px">
        <span class="material-symbols-outlined" style="font-size:48px">error_outline</span>
        <div class="empty-state-title">Showcase entry not found</div>
        <button class="btn-secondary" id="shc-back2">Back to ShowCase</button>
      </div>`;
    container.querySelector('#shc-back2')?.addEventListener('click', () => navigate('#shc'));
    return;
  }

  const [run, recipe] = await Promise.all([
    getRun(entry.runId),
    getRecipe(entry.recipeId).catch(() => null),
  ]);

  const body = container.querySelector('#shc-detail-body');
  body.innerHTML = `
    <div class="shc-detail-layout">
      <div class="shc-detail-left">
        <div class="shc-thumb-section" id="shc-thumb-section">
          <div class="spinner" style="margin:20px auto"></div>
        </div>

        <div class="shc-meta-edit">
          <label class="shc-field-label">Title</label>
          <input id="shc-title" class="ic-input shc-title-input" value="${escHtml(entry.title || entry.recipeName || '')}" placeholder="Add a title…">

          <label class="shc-field-label" style="margin-top:12px">Description</label>
          <textarea id="shc-desc" class="ic-input shc-desc-input" placeholder="Add a description…" rows="4">${escHtml(entry.description || '')}</textarea>
        </div>

        <div class="shc-links-row">
          <button class="btn-secondary btn-sm" id="shc-recipe-link">
            <span class="material-symbols-outlined" style="font-size:15px">edit</span>
            Edit Recipe
          </button>
          <button class="btn-primary btn-sm" id="shc-run-again">
            <span class="material-symbols-outlined" style="font-size:15px">play_arrow</span>
            Run Again
          </button>
        </div>

        <div class="shc-detail-meta text-sm text-muted" style="margin-top:8px">
          <span>Recipe: <strong>${escHtml(entry.recipeName || '—')}</strong></span>
          <span>Created: ${entry.createdAt ? formatDateTime(entry.createdAt) : '—'}</span>
        </div>
      </div>

      <div class="shc-detail-right">
        <div class="shc-pipeline-label text-sm text-muted">Pipeline</div>
        <div class="shc-pipeline" id="shc-pipeline">
          <div class="spinner" style="margin:20px auto"></div>
        </div>
      </div>
    </div>

    <div class="shc-detail-footer">
      <button class="btn-secondary btn-sm" id="shc-delete">
        <span class="material-symbols-outlined" style="font-size:15px;color:var(--ps-red)">delete</span>
        Delete Showcase Entry
      </button>
    </div>`;

  // ── Debounced save ───────────────────────────────────────────
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      entry.title       = container.querySelector('#shc-title')?.value ?? entry.title;
      entry.description = container.querySelector('#shc-desc')?.value  ?? entry.description;
      await saveShowcase(entry);
    }, 800);
  }
  container.querySelector('#shc-title')?.addEventListener('input', scheduleSave);
  container.querySelector('#shc-desc')?.addEventListener('input', scheduleSave);

  container.querySelector('#shc-recipe-link')?.addEventListener('click', () =>
    navigate(entry.recipeId ? `#bld?id=${entry.recipeId}` : '#lib'));
  container.querySelector('#shc-run-again')?.addEventListener('click', () =>
    navigate(entry.recipeId ? `#set?recipe=${entry.recipeId}` : '#lib'));

  container.querySelector('#shc-delete')?.addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: 'Delete Showcase Entry?',
      body: 'This will remove the showcase entry. The original run and its files are unaffected.',
      confirmText: 'Delete', variant: 'danger', icon: 'delete_forever',
    });
    if (!confirmed) return;
    clearTimeout(saveTimer);
    await deleteShowcase(entry.id);
    navigate('#shc');
  });

  loadDetailThumbs(container, entry, run);
  renderPipeline(container.querySelector('#shc-pipeline'), recipe);
}

// ─── Before / After two-strip section ────────────────────────────────────────

async function loadDetailThumbs(container, entry, run) {
  const section = container.querySelector('#shc-thumb-section');
  if (!section) return;

  if (!entry.sampleFileNames?.length || !run?.outputHandleObj) {
    section.innerHTML = `<div class="text-sm text-muted" style="padding:4px">No sample images available.</div>`;
    return;
  }

  // ── Load output files ──────────────────────────────────────
  let subHandle;
  try {
    subHandle = await getOrCreateOutputSubfolder(run.outputHandleObj, run.outputFolder || 'output');
  } catch {
    section.innerHTML = `<div class="text-sm text-muted" style="padding:4px">Output folder not accessible.</div>`;
    return;
  }

  const outputFileMap = new Map();
  for await (const [name, fe] of subHandle.entries()) {
    if (fe.kind === 'file' && entry.sampleFileNames.includes(name))
      outputFileMap.set(name, await fe.getFile());
  }
  const outputFiles = entry.sampleFileNames.map(n => outputFileMap.get(n)).filter(Boolean);

  if (!outputFiles.length) {
    section.innerHTML = `<div class="text-sm text-muted" style="padding:4px">Output files not found.</div>`;
    return;
  }

  // ── Load input files ───────────────────────────────────────
  // Prefer stored sampleInputFileNames; fall back to name-matching at render time
  let inputFiles = [];
  try {
    const inputHandle = await getFolder('input');
    if (inputHandle) {
      if (entry.sampleInputFileNames?.length) {
        // Load exactly the stored filenames
        for await (const [name, fe] of inputHandle.entries()) {
          if (fe.kind === 'file' && entry.sampleInputFileNames.includes(name))
            inputFiles.push(await fe.getFile());
        }
        // Preserve stored order
        const ordered = new Map(inputFiles.map(f => [f.name, f]));
        inputFiles = entry.sampleInputFileNames.map(n => ordered.get(n)).filter(Boolean);
      } else {
        // Legacy: match by filename heuristic against output files
        const allInputs = await listImages(inputHandle, { includeVideo: true });
        const inputByBase = new Map();
        for (const f of allInputs) {
          inputByBase.set(f.name.replace(/\.[^.]+$/, ''), f);
          inputByBase.set(f.name, f);
        }
        for (const outFile of outputFiles) {
          const base     = outFile.name.replace(/\.[^.]+$/, '');
          const stripped = base.replace(/[-_][a-z0-9]+$/i, '');
          const match    = inputByBase.get(base) || inputByBase.get(stripped);
          if (match) inputFiles.push(match);
        }
        // Fallback: first 5 inputs
        if (!inputFiles.length) inputFiles = allInputs.slice(0, 5);
      }
    }
  } catch {}

  // ── Render two-strip layout ────────────────────────────────
  const lbBlobUrls = [];

  function thumbHTML(files, stripId) {
    return files.map((f, i) => {
      const isVideo = VIDEO_EXTS.has(f.name.slice(f.name.lastIndexOf('.')).toLowerCase());
      const url = isVideo ? null : URL.createObjectURL(f);
      if (url) lbBlobUrls.push(url);
      return `<div class="shc-thumb" data-strip="${stripId}" data-idx="${i}" title="${escHtml(f.name)}">
        ${isVideo
          ? `<span class="material-symbols-outlined" style="font-size:32px;color:var(--ps-text-muted)">play_circle</span>`
          : `<img src="${url}" class="shc-thumb-img" alt="">`}
        <div class="shc-thumb-overlay">
          <div class="shc-thumb-name">${escHtml(f.name)}</div>
        </div>
      </div>`;
    }).join('');
  }

  const showInputStrip = inputFiles.length > 0;

  section.innerHTML = `
    ${showInputStrip ? `
    <div class="shc-strip-block">
      <div class="shc-strip-header">
        <span class="material-symbols-outlined shc-strip-icon shc-strip-icon--before">photo_camera</span>
        <span class="shc-strip-label">Before</span>
        <span class="text-sm text-muted">(${inputFiles.length} input${inputFiles.length !== 1 ? 's' : ''})</span>
      </div>
      <div class="shc-thumb-strip" id="shc-strip-before">${thumbHTML(inputFiles, 'before')}</div>
    </div>
    <div class="shc-strip-arrow">
      <span class="material-symbols-outlined">arrow_downward</span>
      <span class="shc-strip-arrow-label">transformed by ${escHtml(entry.recipeName || 'recipe')}</span>
      <span class="material-symbols-outlined">arrow_downward</span>
    </div>` : ''}
    <div class="shc-strip-block">
      <div class="shc-strip-header">
        <span class="material-symbols-outlined shc-strip-icon shc-strip-icon--after">auto_fix_high</span>
        <span class="shc-strip-label">After</span>
        <span class="text-sm text-muted">(${outputFiles.length} output${outputFiles.length !== 1 ? 's' : ''})</span>
        ${showInputStrip ? `<button class="btn-secondary btn-sm shc-compare-all-btn" style="margin-left:auto;font-size:11px;padding:3px 10px">
          <span class="material-symbols-outlined" style="font-size:13px">compare</span> Compare side by side
        </button>` : ''}
      </div>
      <div class="shc-thumb-strip" id="shc-strip-after">${thumbHTML(outputFiles, 'after')}</div>
    </div>`;

  // ── Click handlers ─────────────────────────────────────────
  // Build pairs for the compare lightbox (output[i] paired with input[i] or null)
  const pairs = outputFiles.map((outFile, i) => ({
    outFile,
    inFile: inputFiles[i] || null,
  }));

  // Input strip: simple lightbox
  section.querySelector('#shc-strip-before')?.querySelectorAll('.shc-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const f = inputFiles[parseInt(thumb.dataset.idx)];
      if (f) openSimpleLight(f);
    });
  });

  // Output strip: compare if pair exists, else simple
  section.querySelector('#shc-strip-after')?.querySelectorAll('.shc-thumb').forEach(thumb => {
    thumb.addEventListener('click', async () => {
      const idx  = parseInt(thumb.dataset.idx);
      const pair = pairs[idx];
      if (!pair) return;
      const isVideo = VIDEO_EXTS.has(pair.outFile.name.slice(pair.outFile.name.lastIndexOf('.')).toLowerCase());
      if (pair.inFile && !isVideo) {
        await openCompareLight(container, pairs, idx, lbBlobUrls);
      } else {
        openSimpleLight(pair.outFile);
      }
    });
  });

  // "Compare side by side" opens ImageWorkspace at idx 0
  section.querySelector('.shc-compare-all-btn')?.addEventListener('click', async () => {
    await openCompareLight(container, pairs, 0, lbBlobUrls);
  });
}

async function openCompareLight(container, pairs, startIdx, blobUrls) {
  // Remove any existing lightbox
  document.querySelector('.shc-cmp-lightbox')?.remove();

  const lb = document.createElement('div');
  lb.className = 'shc-cmp-lightbox';
  lb.innerHTML = `
    <div class="shc-lb-bg"></div>
    <div class="shc-cmp-content">
      <div class="shc-cmp-ws" id="shc-cmp-ws"></div>
    </div>`;
  document.body.appendChild(lb);

  function close() {
    lb.remove();
    blobUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    blobUrls.length = 0;
    document.removeEventListener('keydown', onKey);
  }

  lb.querySelector('.shc-lb-bg').addEventListener('click', close);

  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);

  const wsDiv = lb.querySelector('#shc-cmp-ws');
  const { ImageWorkspace } = await import('../components/image-workspace.js');

  let currentPairs = pairs;
  const ws = new ImageWorkspace(wsDiv, {
    allowUpload: false,
    allowFolder: pairs.length > 1,
    customControlsHtml: `
      <button class="btn-icon iw-close-btn" title="Close" style="margin-left:8px">
        <span class="material-symbols-outlined">close</span>
      </button>`,
    onBindCustomControls: cnt => {
      cnt.querySelector('.iw-close-btn')?.addEventListener('click', close);
    },
    onRender: async file => {
      const pair = currentPairs.find(p => p.outFile === file);
      if (!pair) return null;

      const afterUrl  = URL.createObjectURL(pair.outFile);
      blobUrls.push(afterUrl);

      if (pair.inFile) {
        const beforeUrl = URL.createObjectURL(pair.inFile);
        blobUrls.push(beforeUrl);
        return { beforeUrl, afterUrl, beforeLabel: 'Before', afterLabel: 'After', canCompare: true };
      }
      return { beforeUrl: afterUrl, afterUrl, beforeLabel: 'Output', afterLabel: 'Output', canCompare: false };
    },
  });

  // Only pass files that are images (skip video in compare view)
  const imageFiles = pairs
    .filter(p => !VIDEO_EXTS.has(p.outFile.name.slice(p.outFile.name.lastIndexOf('.')).toLowerCase()))
    .map(p => p.outFile);
  ws.setFiles(imageFiles, Math.min(startIdx, imageFiles.length - 1));
}

function openSimpleLight(file) {
  document.querySelector('.shc-simple-lightbox')?.remove();

  const url = URL.createObjectURL(file);
  const isVideo = VIDEO_EXTS.has(file.name.slice(file.name.lastIndexOf('.')).toLowerCase());

  const lb = document.createElement('div');
  lb.className = 'shc-simple-lightbox shc-lightbox';
  lb.innerHTML = `
    <div class="shc-lb-bg"></div>
    <div class="shc-lb-content">
      <button class="btn-icon" style="position:absolute;top:12px;right:12px;z-index:2" id="shc-slb-close">
        <span class="material-symbols-outlined">close</span>
      </button>
      ${isVideo
        ? `<video src="${url}" class="shc-lb-img" controls autoplay loop style="max-height:82vh"></video>`
        : `<img src="${url}" class="shc-lb-img" alt="">`}
      <div class="shc-lb-caption">${escHtml(file.name)}</div>
    </div>`;
  document.body.appendChild(lb);

  function close() {
    lb.remove();
    URL.revokeObjectURL(url);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  lb.querySelector('.shc-lb-bg').addEventListener('click', close);
  lb.querySelector('#shc-slb-close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}

// ─── Pipeline Diagram ─────────────────────────────────────────────────────────

function renderPipeline(el, recipe) {
  if (!recipe?.nodes?.length) {
    el.innerHTML = `<div class="text-sm text-muted" style="padding:12px">Recipe not found or has no steps.</div>`;
    return;
  }

  const allDefs = registry.getAll();
  const defMap  = new Map(allDefs.map(d => [d.id, d]));

  const cards = recipe.nodes.map((node, i) => nodeCard(node, defMap, i)).join('');
  el.innerHTML = `<div class="shc-pipeline-track">${cards}</div>`;

  el.querySelectorAll('.shc-pipe-card').forEach(card => {
    card.addEventListener('click', () => {
      const existing = el.querySelector('.shc-pipe-popover');
      if (existing) { existing.remove(); return; }

      const idx  = parseInt(card.dataset.idx);
      const node = recipe.nodes[idx];
      if (!node?.params || !Object.keys(node.params).length) return;

      const pop = document.createElement('div');
      pop.className = 'shc-pipe-popover';
      pop.innerHTML = `
        <div class="shc-pop-title">${escHtml(card.querySelector('.shc-pipe-name')?.textContent || 'Step')}</div>
        ${Object.entries(node.params).map(([k, v]) =>
          `<div class="shc-pop-row"><span class="shc-pop-key">${escHtml(k)}</span><span class="shc-pop-val">${escHtml(String(v))}</span></div>`
        ).join('')}`;
      card.appendChild(pop);

      setTimeout(() => {
        document.addEventListener('click', function handler(e) {
          if (!card.contains(e.target)) { pop.remove(); document.removeEventListener('click', handler); }
        });
      }, 0);
    });
  });
}

function nodeCard(node, defMap, idx) {
  const disabled = node.disabled ? 'shc-pipe-card--disabled' : '';

  if (node.type === 'branch' || node.type === 'conditional') {
    return `<div class="shc-pipe-arrow" aria-hidden="true">▶</div>
      <div class="shc-pipe-card shc-pipe-card--branch ${disabled}" data-idx="${idx}" title="Branch">
        <span class="material-symbols-outlined shc-pipe-icon">call_split</span>
        <span class="shc-pipe-name">Branch</span>
      </div>`;
  }

  if (node.type === 'block-ref') {
    return `<div class="shc-pipe-arrow" aria-hidden="true">▶</div>
      <div class="shc-pipe-card ${disabled}" data-idx="${idx}" title="${escHtml(node.blockName || 'Block')}">
        <span class="material-symbols-outlined shc-pipe-icon">widgets</span>
        <span class="shc-pipe-name">${escHtml(node.blockName || 'Block')} <span style="opacity:.6">⧉</span></span>
      </div>`;
  }

  const def    = defMap.get(node.transformId);
  const icon   = def?.icon || 'auto_fix_high';
  const name   = def?.name || node.transformId || 'Step';
  const params = node.params ? Object.entries(node.params).slice(0, 3) : [];

  return `${idx > 0 ? '<div class="shc-pipe-arrow" aria-hidden="true">▶</div>' : ''}
    <div class="shc-pipe-card ${disabled}" data-idx="${idx}" title="${escHtml(name)}">
      <span class="material-symbols-outlined shc-pipe-icon">${escHtml(icon)}</span>
      <span class="shc-pipe-name">${escHtml(name)}</span>
      ${params.length ? `<div class="shc-pipe-params">
        ${params.map(([k, v]) => `<span class="shc-pipe-pill">${escHtml(k)}: ${escHtml(String(v))}</span>`).join('')}
      </div>` : ''}
    </div>`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

let _shcStyles = false;
function injectShcStyles() {
  if (_shcStyles) return;
  _shcStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .shc-screen { display:flex; flex-direction:column; height:100%; }
    .shc-body { flex:1; overflow-y:auto; padding:20px; }

    /* ── List toolbar ── */
    .shc-list-toolbar { display:flex; align-items:center; gap:12px; padding:8px 20px; border-bottom:1px solid var(--ps-border); flex-wrap:wrap; }
    .shc-search-wrap { position:relative; flex:1; min-width:180px; max-width:360px; }
    .shc-search-icon { position:absolute; left:9px; top:50%; transform:translateY(-50%); font-size:18px; color:var(--ps-text-faint); pointer-events:none; }
    .shc-search-input { width:100%; padding:7px 10px 7px 34px; background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:8px; color:var(--ps-text); font-size:13px; outline:none; }
    .shc-search-input:focus { border-color:var(--ps-blue); }
    .shc-filter-tabs { display:flex; gap:4px; }
    .shc-filter-tab { display:flex; align-items:center; gap:5px; padding:6px 14px; border-radius:7px; border:1px solid var(--ps-border); background:transparent; color:var(--ps-text-muted); font-size:13px; cursor:pointer; transition:all 150ms; }
    .shc-filter-tab:hover { border-color:var(--ps-blue); color:var(--ps-text); }
    .shc-filter-tab.is-active { background:var(--ps-blue); border-color:var(--ps-blue); color:#fff; }

    /* ── Empty filtered state ── */
    .shc-empty-filtered { flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; color:var(--ps-text-muted); }

    /* ── Card Grid ── */
    .shc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
    .shc-card { background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:12px; overflow:hidden; cursor:pointer; transition:border-color 150ms,box-shadow 150ms; position:relative; }
    .shc-card:hover { border-color:var(--ps-blue); box-shadow:0 4px 20px rgba(0,0,0,0.25); }
    .shc-card-hero { width:100%; height:200px; background:var(--ps-bg-app); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-direction:column; gap:8px; }
    .shc-card-hero--loading { color:var(--ps-text-faint); }
    .shc-card-hero-placeholder { font-size:48px; opacity:.3; }
    .shc-card-hero-img { width:100%; height:100%; object-fit:cover; display:block; }
    .shc-card-hero-video { display:flex; flex-direction:column; align-items:center; gap:8px; color:var(--ps-text-faint); }
    .shc-card-hero-video-name { font-size:11px; font-family:var(--font-mono); opacity:.6; }
    .shc-card-body { padding:14px; }
    .shc-card-title { font-size:15px; font-weight:600; margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .shc-card-meta { display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-bottom:4px; }
    .shc-card-desc { font-size:12px; color:var(--ps-text-muted); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:6px; }
    .shc-card-hover-actions { position:absolute; top:8px; right:8px; display:none; gap:4px; background:rgba(0,0,0,0.6); border-radius:8px; padding:4px; }
    .shc-card:hover .shc-card-hover-actions { display:flex; }
    .shc-card-type-badge { font-size:10px; text-transform:uppercase; letter-spacing:.06em; padding:2px 6px; border-radius:4px; font-weight:600; }
    .shc-card-type-badge--image { background:rgba(59,130,246,.15); color:#60a5fa; }
    .shc-card-type-badge--video { background:rgba(168,85,247,.15); color:#c084fc; }

    /* ── Detail Layout ── */
    .shc-detail-body { flex:1; overflow-y:auto; padding:20px; }
    .shc-detail-layout { display:flex; gap:20px; flex-wrap:wrap; }
    .shc-detail-left { flex:1; min-width:280px; max-width:520px; display:flex; flex-direction:column; gap:12px; }
    .shc-detail-right { flex:1; min-width:280px; }

    /* ── Before/After strips ── */
    .shc-thumb-section { display:flex; flex-direction:column; gap:10px; }
    .shc-strip-block { display:flex; flex-direction:column; gap:8px; }
    .shc-strip-header { display:flex; align-items:center; gap:6px; }
    .shc-strip-label { font-size:13px; font-weight:600; }
    .shc-strip-icon { font-size:16px; }
    .shc-strip-icon--before { color:#60a5fa; }
    .shc-strip-icon--after  { color:#4ade80; }
    .shc-strip-arrow { display:flex; align-items:center; gap:8px; color:var(--ps-text-faint); padding:2px 4px; }
    .shc-strip-arrow .material-symbols-outlined { font-size:16px; }
    .shc-strip-arrow-label { font-size:11px; font-style:italic; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px; }
    .shc-thumb-strip { display:flex; gap:8px; flex-wrap:wrap; }
    .shc-thumb { position:relative; width:110px; height:110px; border-radius:8px; overflow:hidden; cursor:pointer; border:1px solid var(--ps-border); background:var(--ps-bg-app); display:flex; align-items:center; justify-content:center; flex-direction:column; gap:4px; transition:border-color 150ms,box-shadow 150ms; }
    .shc-thumb:hover { border-color:var(--ps-blue); box-shadow:0 2px 12px rgba(0,0,0,0.3); }
    .shc-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }
    .shc-thumb-overlay { position:absolute; inset:0; background:rgba(0,0,0,0); display:flex; flex-direction:column; justify-content:flex-end; padding:6px; transition:background 150ms; }
    .shc-thumb:hover .shc-thumb-overlay { background:rgba(0,0,0,.55); }
    .shc-thumb-name { font-size:9px; color:#fff; font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:0; transition:opacity 150ms; }
    .shc-thumb:hover .shc-thumb-name { opacity:1; }
    .shc-thumb-compare-badge { display:flex; align-items:center; gap:3px; font-size:10px; color:var(--ps-blue); margin-top:3px; opacity:0; transition:opacity 150ms; }
    .shc-thumb:hover .shc-thumb-compare-badge { opacity:1; }

    /* ── Meta edit ── */
    .shc-meta-edit { display:flex; flex-direction:column; gap:6px; }
    .shc-field-label { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--ps-text-faint); }
    .shc-title-input { font-size:15px; font-weight:600; }
    .shc-desc-input { resize:vertical; min-height:80px; font-size:13px; }
    .shc-links-row { display:flex; gap:8px; flex-wrap:wrap; }
    .shc-detail-meta { display:flex; gap:16px; flex-wrap:wrap; }
    .shc-detail-footer { margin-top:20px; padding-top:16px; border-top:1px solid var(--ps-border); }

    /* ── Compare lightbox ── */
    .shc-cmp-lightbox { position:fixed; inset:0; z-index:600; display:flex; align-items:center; justify-content:center; }
    .shc-lb-bg { position:absolute; inset:0; background:rgba(0,0,0,0.88); }
    .shc-cmp-content { position:relative; z-index:1; width:92vw; height:90vh; background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:14px; overflow:hidden; box-shadow:0 24px 80px rgba(0,0,0,0.6); }
    .shc-cmp-ws { position:absolute; inset:0; }

    /* ── Simple lightbox ── */
    .shc-simple-lightbox { position:fixed; inset:0; z-index:600; display:flex; align-items:center; justify-content:center; }
    .shc-lb-content { position:relative; z-index:1; max-width:90vw; max-height:90vh; display:flex; flex-direction:column; align-items:center; gap:12px; }
    .shc-lb-img { max-width:88vw; max-height:82vh; object-fit:contain; border-radius:8px; box-shadow:0 16px 60px rgba(0,0,0,0.7); }
    .shc-lb-caption { color:#fff; font-size:12px; font-family:var(--font-mono); opacity:.75; }

    /* ── Pipeline diagram ── */
    .shc-pipeline-label { margin-bottom:8px; }
    .shc-pipeline { background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:10px; padding:16px; overflow-x:auto; }
    .shc-pipeline-track { display:flex; align-items:flex-start; gap:0; width:max-content; }
    .shc-pipe-arrow { color:var(--ps-text-faint); font-size:14px; margin:0 4px; padding-top:14px; flex-shrink:0; }
    .shc-pipe-card { background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:8px; padding:10px 12px; min-width:100px; max-width:160px; display:flex; flex-direction:column; gap:4px; cursor:pointer; transition:border-color 150ms; position:relative; flex-shrink:0; }
    .shc-pipe-card:hover { border-color:var(--ps-blue); }
    .shc-pipe-card--disabled { opacity:.45; text-decoration:line-through; }
    .shc-pipe-card--branch { border-style:dashed; }
    .shc-pipe-icon { font-size:18px; color:var(--ps-blue); }
    .shc-pipe-name { font-size:12px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .shc-pipe-params { display:flex; flex-direction:column; gap:2px; margin-top:2px; }
    .shc-pipe-pill { font-size:10px; color:var(--ps-text-muted); font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .shc-pipe-popover { position:absolute; top:calc(100% + 6px); left:0; z-index:50; background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:8px; padding:10px; min-width:180px; max-width:260px; box-shadow:0 8px 24px rgba(0,0,0,0.4); }
    .shc-pop-title { font-size:12px; font-weight:600; margin-bottom:8px; color:var(--ps-text); }
    .shc-pop-row { display:flex; justify-content:space-between; gap:8px; margin-bottom:4px; }
    .shc-pop-key { font-size:11px; color:var(--ps-text-muted); font-family:var(--font-mono); }
    .shc-pop-val { font-size:11px; color:var(--ps-text); font-family:var(--font-mono); text-align:right; word-break:break-all; }
  `;
  document.head.appendChild(s);
}
