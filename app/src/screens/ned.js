/**
 * ImageChef — NED: Node Editor
 *
 * Full-screen editor for a single recipe node's parameters.
 * Accessed via #ned?recipe=<recipeId>&node=<nodeId>
 * Saves params back to the recipe on Done.
 */

import { getRecipe, saveRecipe }               from '../data/recipes.js';
import { navigate }                            from '../main.js';
import { uuid, now, deepClone }                 from '../utils/misc.js';
import { showConfirm }                         from '../utils/dialogs.js';
import { registry }                            from '../engine/index.js';
import { ImageProcessor }                      from '../engine/index.js';
import { extractExif }                         from '../engine/exif-reader.js';
import { getImageInfo, renderImageInfoPanel,
         injectImageInfoStyles }               from '../utils/image-info.js';
import { renderParamField, collectParams, bindParamFieldEvents } from '../utils/param-fields.js';
import { isVideoFile, extractVideoFrame } from '../utils/video-frame.js';
import { getStoredSeekTime, setStoredSeekTime, mountVideoScrubber } from '../utils/video-scrubber.js';
import { fileFilterForRecipe } from '../data/folders.js';
import { renderTimeRangeSection, bindTimeRangeControls, injectTimeRangeStyles } from '../utils/time-range-strip.js';

// Category accent colours
const CAT_COLORS = {
  geo:     '#38bdf8',
  color:   '#a78bfa',
  overlay: '#fb923c',
  ai:      '#34d399',
  flow:    '#0077ff',
  meta:    '#f472b6',
};

// ── Find node in recipe tree by id ─────────────────────────
function findNode(nodes, nodeId) {
  for (const n of nodes) {
    if (n.id === nodeId) return n;
    if (n.branches) {
      for (const b of n.branches) {
        const found = findNode(b.nodes, nodeId);
        if (found) return found;
      }
    }
    if (n.thenNodes) {
      const f = findNode(n.thenNodes, nodeId);
      if (f) return f;
    }
    if (n.elseNodes) {
      const f = findNode(n.elseNodes, nodeId);
      if (f) return f;
    }
  }
  return null;
}

export async function render(container, hash) {
  // Captured during each preview run — used by the {{vars}} picker modal
  // to show the current file's resolved variable values.
  let _latestVarContext = null;
  const params   = new URLSearchParams((hash.split('?')[1] || ''));
  const recipeId = params.get('recipe');
  const nodeId   = params.get('node');

  const recipe = recipeId ? await getRecipe(recipeId) : null;
  const node   = recipe ? findNode(recipe.nodes, nodeId) : null;

  if (!recipe || !node) {
    container.innerHTML = `<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">Node not found</div>
        <button class="btn-primary" id="ned-back-btn">Back</button>
      </div></div></div>`;
    container.querySelector('#ned-back-btn')?.addEventListener('click', () => window.history.back());
    return;
  }

  const def     = node.type === 'transform' ? registry.get(node.transformId) : null;
  const catKey  = def?.categoryKey || node.transformId?.split('-')[0] || 'other';
  const accent  = CAT_COLORS[catKey] || '#6b7280';

  // ── Condition editor for conditional nodes ─────────────────
  const isConditional = node.type === 'conditional';
  const isBranch      = node.type === 'branch';

  const conditionHtml = isConditional ? buildConditionEditor(node.condition) : '';
  const branchHtml    = isBranch      ? buildBranchEditor(node)              : '';
  const paramsHtml    = def ? (def.params || []).map(p => renderParamField(p, node.params?.[p.name], 'ned')).join('') : '';
  const isVideoEffect = def?.categoryKey === 'video-effect';
  const timeRangeHtml = isVideoEffect ? renderTimeRangeSection(node, def) : '';

  container.innerHTML = `
    <div class="screen ned-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="ned-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="ned-node-icon" style="background:${accent}20;border-color:${accent}40">
            <span class="material-symbols-outlined" style="font-size:16px;color:${accent}">${def?.icon || 'tune'}</span>
          </div>
          <div>
            <div class="screen-title" style="font-size:15px">${def?.name || node.label || node.type}</div>
            ${def?.description ? `<div class="text-sm text-muted" style="margin-top:2px">${def.description}</div>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-icon" onclick="window.location.hash='#hlp?id=${def?.id || node.transformId}'" title="View Documentation for this Step">
            <span class="material-symbols-outlined" style="color:var(--ps-blue)">help</span>
          </button>
          <button class="btn-icon" id="ned-btn-info" title="Image info for test image">
            <span class="material-symbols-outlined">info</span>
          </button>
          <button class="btn-secondary" id="ned-btn-reset">
            <span class="material-symbols-outlined">restart_alt</span>
            Reset
          </button>
          <button class="btn-primary" id="ned-done-btn">
            <span class="material-symbols-outlined">check</span>
            Done
          </button>
        </div>
      </div>

      <div class="ned-body">
        <!-- Params panel -->
        <div class="ned-params-panel">
          <div class="ned-section-title">
            <span class="material-symbols-outlined" style="font-size:14px">settings</span>
            Parameters
          </div>

          ${node.type === 'transform' && def ? `
            <div class="ned-fields">
              ${paramsHtml || '<div class="text-sm text-muted" style="padding:12px">No parameters for this step.</div>'}
            </div>` : ''}

          ${conditionHtml}
          <div id="ned-branches-wrapper">
            ${branchHtml}
          </div>

          ${timeRangeHtml}

          <!-- Label override -->
          <div class="ned-section-title" style="margin-top:16px">
            <span class="material-symbols-outlined" style="font-size:14px">label</span>
            Display Label
          </div>
          <div class="ned-fields">
            <div class="ned-field">
              <label class="ned-field-label" for="ned-label-input">Step Label</label>
              <input type="text" id="ned-label-input" class="ic-input" value="${escHtml(node.label || '')}" placeholder="Custom label…">
            </div>
          </div>
        </div>

        <!-- Preview panel -->
        <div class="ned-preview-panel" style="position:relative">
          <div id="ned-notice" class="ned-notice" style="display:none;position:absolute;top:0;left:0;right:0;z-index:20;"></div>
          <div id="ned-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0"></div>
        </div>
      </div>
    </div>`;

  injectNedStyles();
  if (isVideoEffect) injectTimeRangeStyles();

  if (def && def.params) {
    // Provide recipe variable names for autocomplete in variable-bind mode
    const getRecipeVars = () => (recipe?.params || []).map(p => p.name);
    // Track the latest preview context so the {{vars}} picker can show
    // resolved values for the currently-previewed file. We return a promise
    // so the picker can `await` the richer getImageInfo() walk — that gets
    // us XMP / IPTC / camera / capture sections the flat extractExif misses.
    const getVarContext = async () => {
      const ctx = _latestVarContext || {};
      const baseRecipe = Object.fromEntries((recipe?.params || []).map(p => [p.name, p.defaultValue]));
      const base = {
        filename: ctx.filename || '',
        ext:      ctx.ext || '',
        exif:     { ...(ctx.exif || {}) },
        meta:     ctx.meta || {},
        sidecar:  ctx.sidecar || null,
        recipe:   baseRecipe,
        recipeVars: getRecipeVars(),
        sourceFilename: ctx.sourceFilename || null,
      };
      // Pull structured info from the currently-previewed file if available —
      // camera/capture/meta/gps/xmp/iptc all get surfaced to the picker.
      if (ctx.file) {
        try {
          const { getImageInfo } = await import('../utils/image-info.js');
          const info = await getImageInfo(ctx.file);
          // Merge structured sections into exif so interpolate() can resolve
          // dotted paths like {{exif.camera.Make}} or {{exif.gps.lat}}.
          base.exif = {
            ...base.exif,
            camera:  info.camera  || {},
            capture: info.capture || {},
            ...(info.gps ? { gps: info.gps } : {}),
            file:    { width: info.width, height: info.height, size: info.fileSize, mimeType: info.mimeType },
          };
          base.xmp  = info.xmp  || {};
          base.iptc = info.iptc || {};
          // Author/rights live on info.meta — merge into meta ns
          base.meta = { ...(base.meta || {}), ...(info.meta || {}) };
        } catch { /* info is best-effort */ }
      }
      return base;
    };
    bindParamFieldEvents(container, def.params, 'ned', { getRecipeVars, getVarContext });
  }

  let _previewTimer = null;
  function schedulePreview() {
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(() => {
       if (workspace && workspace.compareWorkspace) workspace.compareWorkspace.triggerProcess();
    }, 300);
  }

  // ── Time Range controls (video-effect only) ──────────────
  const trControls = isVideoEffect
    ? bindTimeRangeControls(container, node, def, { onChange: schedulePreview })
    : null;

  // ── Metadata panel — lazy, shared by iw-info-btn and ned-btn-info ──────
  let _infoPanel = null;
  async function getOrCreateInfoPanel() {
    if (!_infoPanel) {
      const { MetadataPanel } = await import('../components/metadata-panel.js');
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;top:0;right:0;height:100vh;z-index:200;';
      container.appendChild(host);
      // Try to get the input folder handle so sidecar data can be read
      const { getFolder } = await import('../data/folders.js');
      const inputHandle = await getFolder('input').catch(() => null);
      _infoPanel = new MetadataPanel(host, { dirHandle: inputHandle, startHidden: true });
    }
    return _infoPanel;
  }

  // ── Unified Image Workspace ───────────────────────────────
  const { MediaBrowser } = await import('../components/media-browser.js');
  const wsContainer = container.querySelector('#ned-workspace-container');
  let testFile = null;
  let _nedScrubber = null;

  let mbDirStack = [];
  let mbCurrentHandle = null;
  let workspace = null;

  const stepIsVideoOnly = node.transformId?.startsWith('flow-video-') || !!def?.sourceTransformId || def?.categoryKey === 'video-effect';
  const stepFileFilter  = stepIsVideoOnly
    ? { includeVideo: true, onlyVideo: true }
    : fileFilterForRecipe(recipe);

  async function loadNedFolder(handle) {
    if (!handle) return;
    mbCurrentHandle = handle;
    const { IMAGE_EXTS, VIDEO_EXTS } = await import('../data/folders.js');
    const { includeVideo, onlyVideo } = stepFileFilter;
    
    const files = [];
    const allFolders = [];
    
    for await (const [name, entry] of handle.entries()) {
      if (name.startsWith('.')) continue;
      if (entry.kind === 'directory') allFolders.push({ name, handle: entry });
      else if (entry.kind === 'file') {
        const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
        const isImg = IMAGE_EXTS.has(ext);
        const isVid = VIDEO_EXTS.has(ext);
        let match = false;
        if (onlyVideo) match = isVid;
        else if (includeVideo) match = isImg || isVid;
        else match = isImg;
        if (match) files.push({ file: await entry.getFile(), handle: entry });
      }
    }
    files.sort((a,b) => a.file.name.localeCompare(b.file.name));
    allFolders.sort((a,b) => a.name.localeCompare(b.name));
    
    const mbEntries = [];
    if (mbDirStack.length > 0) mbEntries.push({ name: '..', isFolder: true, handle: null });
    allFolders.forEach(f => mbEntries.push({ name: f.name, isFolder: true, handle: f.handle }));
    files.forEach(f => mbEntries.push({ name: f.file.name, file: f.file, isFolder: false, handle: f.handle }));

    if (!workspace) {
      workspace = new MediaBrowser(wsContainer, {
        mode: 'compare',
        enableCompare: true,
        entries: mbEntries,
        breadcrumbs: mbDirStack.map(d => d.name),
        currentFolderName: handle.name,
        canGoUp: mbDirStack.length > 0,
        onChangeFolderClick: async () => {
          const { pickFolder } = await import('../data/folders.js');
          const h = await pickFolder('input');
          if (h) { mbDirStack = []; await loadNedFolder(h); }
        },
        onNavigateUp: async () => {
          if (mbDirStack.length === 0) return;
          const parent = mbDirStack.pop();
          await loadNedFolder(parent.handle);
        },
        onDoubleClick: async (ent) => {
          if (ent.isFolder && ent.name !== '..') {
            mbDirStack.push({ name: handle.name, handle: handle });
            await loadNedFolder(ent.handle);
          }
        },
        onSelectionChange: async (selectedIds, entries) => {
           let activeFile = null;
           if (selectedIds.length > 0) {
             const activeEnt = entries.find(e => e.name === selectedIds[0]);
             if (activeEnt) activeFile = activeEnt.file;
           }
           const filesList = entries.filter(e => !e.isFolder).map(e => e.file);
           
           window._icTestFolderFiles = filesList;
           window._icTestImage = { file: activeFile };
           testFile = activeFile;
           if (_infoPanel && activeFile) {
             const { getFolder } = await import('../data/folders.js');
             const inputHandle = await getFolder('input').catch(() => null);
             if (inputHandle) _infoPanel.setDirHandle(inputHandle);
             _infoPanel.setFile(activeFile);
           }
           if (trControls && activeFile && isVideoFile(activeFile)) {
             trControls.loadFilmstrip(activeFile);
           }
           if (_nedScrubber) { _nedScrubber.destroy(); _nedScrubber = null; }
           const scrubberMount = wsContainer.querySelector('#ned-scrubber-mount');
           if (activeFile && isVideoFile(activeFile) && scrubberMount) {
             _nedScrubber = await mountVideoScrubber(scrubberMount, activeFile, {
               initialTime: getStoredSeekTime(activeFile.name),
               onSeek: (t) => {
                 setStoredSeekTime(activeFile.name, t);
                 schedulePreview();
               },
             });
           } else if (scrubberMount) {
             scrubberMount.innerHTML = '';
           }
        },
        onCompareInfo: async (file) => {
          const panel = await getOrCreateInfoPanel();
          await panel.setFile(file);
          panel.show();
        },
        onCompareRender: async (file) => {
          if (!def) return { noPreview: true };

          const NO_PREVIEW_IDS = new Set([
            'flow-create-gif', 'flow-create-video', 'flow-create-pdf', 'flow-create-pptx',
            'flow-create-zip', 'flow-video-wall', 'flow-video-stitcher', 'flow-geo-timeline',
            'flow-contact-sheet', 'flow-photo-stack', 'flow-animate-stack',
            'flow-template-aggregator', 'flow-face-swap', 'flow-gif-from-states',
            'flow-video-concat',
            'flow-video-convert', 'flow-video-trim', 'flow-video-compress',
            'flow-video-change-fps', 'flow-video-speed',
            'flow-video-strip-audio', 'flow-video-extract-audio',
            'flow-video-remix-audio',
          ]);
          if (NO_PREVIEW_IDS.has(node.transformId)) {
            return { noPreview: true };
          }

          const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);
          const fileIsVideo = VIDEO_EXTS.has(file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase());
          if (!fileIsVideo && (def.sourceTransformId || def.categoryKey === 'video-effect')) {
            return { noPreview: true, noPreviewReason: 'This step only applies to video files. Select a video to preview.' };
          }

          const params = collectParams(container, def.params || [], 'ned');
          const exif   = await extractExif(file);

          let sidecar = null;
          try {
            const { getFolder }   = await import('../data/folders.js');
            const { readSidecar } = await import('../data/sidecar.js');
            const inputHandle = await getFolder('input').catch(() => null);
            if (inputHandle) {
              sidecar = await readSidecar(inputHandle, file.name).catch(() => null);
            }
          } catch { /* best-effort */ }

          let notice = null;
          if (node.transformId === 'flow-geo-timeline' && (!exif?.gps?.lat)) {
            notice = 'Timeline requires an image with GPS Exif data. This step will skip images lacking location metadata.';
          }
          const noticeEl = container.querySelector('#ned-notice');
          if (noticeEl) {
            noticeEl.textContent = notice || '';
            noticeEl.style.display = notice ? 'block' : 'none';
          }

          const context = {
            filename: file.name, exif, meta: {}, sidecar, variables: new Map(),
            originalFile: file,
            _previewMode: true,
          };

          _latestVarContext = {
            filename: file.name.replace(/\.[^.]+$/, ''),
            ext: file.name.slice(file.name.lastIndexOf('.') + 1),
            sourceFilename: file.name,
            file,
            exif, meta: {}, sidecar,
          };

          let imageSource;
          let beforeUrl;
          if (isVideoFile(file)) {
            const seekTime = getStoredSeekTime(file.name);
            const frameCanvas = await extractVideoFrame(file, seekTime);
            imageSource = frameCanvas;
            beforeUrl = await new Promise(r => frameCanvas.toBlob(b => r(URL.createObjectURL(b)), 'image/jpeg', 0.88));
          } else {
            const rawUrl = URL.createObjectURL(file);
            const img    = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = rawUrl; });
            imageSource = img;
            beforeUrl   = rawUrl;
          }

          const proc = new ImageProcessor();
          proc.canvas.width  = imageSource.width  ?? imageSource.naturalWidth;
          proc.canvas.height = imageSource.height ?? imageSource.naturalHeight;
          proc.ctx.drawImage(imageSource, 0, 0);

          let applyFn;
          if (typeof def.applyPerFrame === 'function') {
            applyFn = (ctx, p, c) => def.applyPerFrame(ctx, p, c);
          } else {
            const applyDef = def.sourceTransformId ? registry.get(def.sourceTransformId) : def;
            if (applyDef?.apply) applyFn = (ctx, p, c) => applyDef.apply(ctx, p, c);
          }
          if (applyFn) {
            try { await applyFn(proc.ctx, params, context); } catch (err) { /* ignore */ }
          }

          const afterUrl = await new Promise(res => proc.canvas.toBlob(b => {
            res(b ? URL.createObjectURL(b) : null);
          }, 'image/jpeg', 0.88));

          return {
            beforeUrl,
            afterUrl,
            beforeLabel: 'Original',
            afterLabel: 'Result',
            context
          };
        }
      });
      
      const idx = window._icTestFolderFiles?.findIndex(f => f.name === window._icTestImage?.file?.name) ?? 0;
      const fileToSelect = files[idx] || files[0];
      if (fileToSelect) {
         workspace.selectedIds.add(fileToSelect.file.name);
         workspace.lastSelectedIdx = mbEntries.findIndex(e => e.name === fileToSelect.file.name);
         workspace._syncSelectionUI();
      }
    } else {
      workspace.options.breadcrumbs = mbDirStack.map(d => d.name);
      workspace.options.currentFolderName = handle.name;
      workspace.options.canGoUp = mbDirStack.length > 0;
      workspace.entries = mbEntries;
      workspace.applyFilters();
      workspace.renderHeader();
    }
  }

  // Inject scrubber mount point
  {
    const mount = document.createElement('div');
    mount.id = 'ned-scrubber-mount';
    mount.style.position = 'absolute';
    mount.style.bottom = '110px';
    mount.style.left = '0';
    mount.style.right = '0';
    mount.style.zIndex = '100';
    wsContainer.style.position = 'relative';
    wsContainer.appendChild(mount);
  }

  if (window._icTestFolderFiles && window._icTestFolderFiles.length > 0) {
    const { getFolder } = await import('../data/folders.js');
    const initHandle = await getFolder('input').catch(()=>null);
    await loadNedFolder(initHandle);
  } else {
    const { getFolder } = await import('../data/folders.js');
    const initHandle = await getFolder('input').catch(()=>null);
    await loadNedFolder(initHandle);
  }

  // ── Toolbar (i) button — toggle the same shared panel ────────────────
  container.querySelector('#ned-btn-info')?.addEventListener('click', async () => {
    const file = testFile ?? window._icTestImage?.file;
    if (!file) {
      window.AuroraToast?.show({ variant: 'info', title: 'No test image selected yet' });
      return;
    }
    const panel = await getOrCreateInfoPanel();
    if (panel.isVisible()) {
      panel.hide();
    } else {
      await panel.setFile(file);
      panel.show();
    }
  });

  // ── Back ──────────────────────────────────────────────────
  container.querySelector('#ned-back')?.addEventListener('click', () => navigate(`#bld?id=${recipeId}`));

  // ── Done — save params and go back ───────────────────────
  const saveNode = async () => {
    if (def) node.params = collectParams(container, def.params || [], 'ned');
    if (isConditional) node.condition = collectCondition(container);
    const labelInput = container.querySelector('#ned-label-input');
    if (labelInput) node.label = labelInput.value.trim();
    await saveRecipe(recipe);
  };

  container.querySelector('#ned-done-btn')?.addEventListener('click', async () => {
    await saveNode();
    navigate(`#bld?id=${recipeId}`);
  });

  // ── Reset ─────────────────────────────────────────────────
  container.querySelector('#ned-btn-reset')?.addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: 'Reset Parameters?',
      body: 'This will restore all settings in this step to their factory defaults. This action cannot be undone.',
      confirmText: 'Reset',
      variant: 'warning',
      icon: 'restart_alt'
    });
    if (!confirmed) return;
    const defaults = {};
    (def?.params || []).forEach(p => { defaults[p.name] = p.defaultValue ?? ''; });
    node.params = defaults;
    navigate(`#ned?recipe=${recipeId}&node=${nodeId}`); // re-render
  });

  // ── Wire range inputs ─────────────────────────────────────
  container.querySelectorAll('input[type=range]').forEach(input => {
    const valEl = container.querySelector(`#${input.id}-val`);
    if (valEl) {
      input.addEventListener('input', () => { valEl.textContent = input.value; schedulePreview(); });
    }
  });

  // ── Wire color inputs ─────────────────────────────────────
  container.querySelectorAll('input[type=color]').forEach(input => {
    const hexInput = container.querySelector(`#${input.id}-hex`);
    input.addEventListener('input', () => { if (hexInput) hexInput.value = input.value; schedulePreview(); });
    hexInput?.addEventListener('input', e => {
      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) { input.value = e.target.value; schedulePreview(); }
    });
  });

  // ── Wire all other inputs ─────────────────────────────────
  container.querySelectorAll('.ic-input:not(.ned-branch-label), input[type=checkbox]').forEach(input => {
    if (input.type !== 'color') input.addEventListener('change', schedulePreview);
  });

  // ── Wire file-browse buttons ──────────────────────────────
  container.querySelectorAll('.ned-file-browse-btn').forEach(btn => {
    const targetId  = btn.dataset.target;
    const picker    = container.querySelector(`#${targetId}-picker`);
    const pathInput = container.querySelector(`#${targetId}`);
    btn.addEventListener('click', () => picker?.click());
    picker?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file || !pathInput) return;
      if (pathInput._objectUrl) URL.revokeObjectURL(pathInput._objectUrl);
      const url = URL.createObjectURL(file);
      pathInput._objectUrl = url;
      pathInput.value = url;
      schedulePreview();
    });
  });

  // ── Branch actions ────────────────────────────────────────
  if (isBranch) {
    const bindBranchActions = () => {
      container.querySelector('#ned-btn-add-branch')?.addEventListener('click', () => {
        const nextLetter = String.fromCharCode(65 + (node.branches || []).length);
        node.branches.push({ id: uuid(), label: `Variant ${nextLetter}`, nodes: [] });
        refreshBranchEditor();
      });

      container.querySelectorAll('.ned-btn-del-branch').forEach(btn => {
        btn.addEventListener('click', async e => {
          const idx = parseInt(btn.dataset.idx);
          if (node.branches.length <= 1) return;
          const confirmed = await showConfirm({
            title: 'Remove Variant?',
            body: 'This will delete the selected branch and every transformation step within it.',
            confirmText: 'Remove Variant',
            variant: 'danger',
            icon: 'delete_sweep'
          });
          if (!confirmed) return;
          node.branches.splice(idx, 1);
          refreshBranchEditor();
        });
      });

      container.querySelectorAll('.ned-branch-label').forEach(input => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.dataset.branchIdx);
          node.branches[idx].label = input.value;
        });
      });
    };

    const refreshBranchEditor = () => {
      const containerEl = container.querySelector('#ned-branches-wrapper');
      if (containerEl) {
        containerEl.innerHTML = buildBranchEditor(node);
        bindBranchActions();
        schedulePreview();
      }
    };

    bindBranchActions();
  }


}

// ── Condition editor builder ───────────────────────────────
function buildConditionEditor(cond = {}) {
  const fields = ['width','height','aspectRatio','IsPortrait','HasGPS','MetaExists','exif.date','exif.author','meta.custom'];
  const ops    = ['exists','eq','neq','gt','lt','gte','lte','contains'];
  return `
    <div class="ned-section-title" style="margin-top:16px">
      <span class="material-symbols-outlined" style="font-size:14px">alt_route</span>
      Condition
    </div>
    <div class="ned-fields">
      <div class="ned-field">
        <label class="ned-field-label">Field</label>
        <select id="ned-cond-field" class="ic-input">
          ${fields.map(f => `<option value="${f}" ${f === cond.field ? 'selected' : ''}>${f}</option>`).join('')}
          <option value="${cond.field || ''}" ${!fields.includes(cond.field) ? 'selected' : ''}>${cond.field || '(custom)'}</option>
        </select>
      </div>
      <div class="ned-field">
        <label class="ned-field-label">Operator</label>
        <select id="ned-cond-op" class="ic-input">
          ${ops.map(o => `<option value="${o}" ${o === cond.operator ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="ned-field">
        <label class="ned-field-label">Value</label>
        <input type="text" id="ned-cond-value" class="ic-input" value="${escHtml(String(cond.value ?? ''))}">
      </div>
    </div>`;
}

function collectCondition(container) {
  return {
    field:    container.querySelector('#ned-cond-field')?.value  || 'width',
    operator: container.querySelector('#ned-cond-op')?.value     || 'gt',
    value:    container.querySelector('#ned-cond-value')?.value  || '',
  };
}

// ── Branch editor builder ──────────────────────────────────
function buildBranchEditor(node) {
  return `
    <div class="ned-section-title" style="margin-top:16px">
      <span class="material-symbols-outlined" style="font-size:14px">device_hub</span>
      Branch Variants
    </div>
    <div class="ned-fields">
      ${(node.branches || []).map((b, i) => `
        <div class="ned-field">
          <div class="flex items-center gap-2">
            <div style="flex:1">
              <label class="ned-field-label">Variant ${i + 1} Label</label>
              <input type="text" class="ic-input ned-branch-label" data-branch-idx="${i}" value="${escHtml(b.label || '')}" placeholder="Variant label…">
            </div>
            ${node.branches.length > 1 ? `
              <button class="btn-icon ned-btn-del-branch" data-idx="${i}" title="Remove variant" style="margin-top:18px">
                <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-red)">delete</span>
              </button>` : ''}
          </div>
        </div>`).join('')}
      <button class="btn-secondary" id="ned-btn-add-branch" style="margin-top:4px">
        <span class="material-symbols-outlined" style="font-size:14px">add</span>
        Add Variant
      </button>
    </div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _nedStyles = false;
function injectNedStyles() {
  if (_nedStyles) return;
  _nedStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .ned-screen { display:flex; flex-direction:column; height:100%; }
    .ned-body { display:flex; flex:1; overflow:hidden; }
    .ned-node-icon { width:32px; height:32px; border-radius:8px; border:1px solid; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

    .ned-params-panel { width:320px; flex-shrink:0; border-right:1px solid var(--ps-border); overflow-y:auto; }
    .ned-section-title {
      display:flex; align-items:center; gap:6px;
      font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;
      color:var(--ps-text-faint); padding:12px 16px 6px;
    }
    .ned-fields { padding:4px 16px 12px; display:flex; flex-direction:column; gap:10px; }
    .ned-field { display:flex; flex-direction:column; gap:4px; }
    .ned-field-label { display:flex; align-items:center; font-size:12px; color:var(--ps-text-muted); font-weight:500; }

    .ned-toggle { display:flex; align-items:center; cursor:pointer; width:fit-content; }
    .ned-toggle input { display:none; }
    .ned-toggle-track {
      width:36px; height:20px; border-radius:10px; background:var(--ps-bg-app);
      border:1px solid var(--ps-border); position:relative; transition:background 150ms, border-color 150ms;
    }
    .ned-toggle-track::after {
      content:''; position:absolute; top:2px; left:2px; width:14px; height:14px;
      border-radius:50%; background:#fff; transition:transform 150ms;
    }
    .ned-toggle input:checked + .ned-toggle-track { background:var(--ps-blue); border-color:var(--ps-blue); }
    .ned-toggle input:checked + .ned-toggle-track::after { transform:translateX(16px); }

    .ned-color-row { display:flex; align-items:center; gap:6px; }
    .ned-color-input { width:36px; height:32px; padding:2px; border:1px solid var(--ps-border); border-radius:6px; background:var(--ps-bg-app); cursor:pointer; }
    .ned-file-row { display:flex; align-items:center; gap:6px; }
    .ned-file-path { flex:1; min-width:0; color:var(--ps-text-muted); font-size:11px; font-family:var(--font-mono); cursor:default; }

    .ned-preview-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .ned-preview-header { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; flex-wrap:wrap; }
    .ned-notice { padding:8px 14px; font-size:12px; color:#f59e0b; background:rgba(245,158,11,0.08); border-bottom:1px solid rgba(245,158,11,0.2); flex-shrink:0; line-height:1.5; }
    .ned-preview-area {
      flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/32px 32px;
    }


  `;
  document.head.appendChild(s);
}
