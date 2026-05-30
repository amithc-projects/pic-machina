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
import { fileFilterForRecipe, getFolder } from '../data/folders.js';
import { renderTimeRangeSection, bindTimeRangeControls, injectTimeRangeStyles } from '../utils/time-range-strip.js';
import { wireFolderState, allowedTypesAttrForRecipe } from '../data/folder-state.js';
import { t as i18n } from '../i18n/index.js';

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
  const params      = new URLSearchParams((hash.split('?')[1] || ''));
  const recipeId    = params.get('recipe');
  const nodeId      = params.get('node');
  const nedTransient = params.get('transient') === '1';

  const recipe = recipeId ? await getRecipe(recipeId) : null;
  const node   = recipe ? findNode(recipe.nodes, nodeId) : null;

  if (!recipe || !node) {
    container.innerHTML = `<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">${i18n('ned.nodeNotFound')}</div>
        <button class="btn-primary" id="ned-back-btn">${i18n('common.back')}</button>
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
          <button class="btn-icon" onclick="window.location.hash='#hlp?id=${def?.id || node.transformId}'" title="${i18n('ned.viewDocs')}">
            <span class="material-symbols-outlined" style="color:var(--ps-blue)">help</span>
          </button>
          <button class="btn-icon" id="ned-btn-info" title="${i18n('ned.imageInfo')}">
            <span class="material-symbols-outlined">info</span>
          </button>
          <button class="btn-secondary" id="ned-btn-reset">
            <span class="material-symbols-outlined">restart_alt</span>
            ${i18n('ned.reset')}
          </button>
          <button class="btn-primary" id="ned-done-btn">
            <span class="material-symbols-outlined">check</span>
            ${i18n('ned.done')}
          </button>
        </div>
      </div>

      <div class="ned-body">
        <!-- Params panel -->
        <div class="ned-params-panel">
          <div class="ned-params-scroll">
            <div class="ned-section-title">
              <span class="material-symbols-outlined" style="font-size:14px">settings</span>
              ${i18n('ned.parameters')}
            </div>

            ${node.type === 'transform' && def ? `
              <div class="ned-fields">
                ${paramsHtml || `<div class="text-sm text-muted" style="padding:12px">${i18n('ned.noParameters')}</div>`}
              </div>` : ''}

            ${conditionHtml}
            <div id="ned-branches-wrapper">
              ${branchHtml}
            </div>

            ${timeRangeHtml}

            <!-- Label override -->
            <div class="ned-section-title" style="margin-top:16px">
              <span class="material-symbols-outlined" style="font-size:14px">label</span>
              ${i18n('ned.displayLabel')}
            </div>
            <div class="ned-fields">
              <div class="ned-field">
                <label class="ned-field-label" for="ned-label-input">${i18n('ned.stepLabel')}</label>
                <input type="text" id="ned-label-input" class="ic-input" value="${escHtml(node.label || '')}" placeholder="${i18n('ned.customLabelPlaceholder')}">
              </div>
            </div>
          </div>

          <!-- Fixed action bar always visible at bottom -->
          <div class="ned-params-actions">
            <button class="btn-secondary" id="ned-btn-reset-bottom" title="${i18n('ned.resetAllTitle')}">
              <span class="material-symbols-outlined" style="font-size:14px">restart_alt</span>
              ${i18n('ned.reset')}
            </button>
            <button class="btn-primary" id="ned-done-btn-bottom">
              <span class="material-symbols-outlined" style="font-size:14px">check</span>
              ${i18n('ned.done')}
            </button>
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
  let sk = null; // zumilabs-file-browser element — set after workspace setup
  function schedulePreview() {
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(() => {
      if (sk) sk.triggerProcess();
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

  // ── Sidekick-manager workspace (compare-mode="transform") ────
  const wsContainer = container.querySelector('#ned-workspace-container');
  wsContainer.style.position = 'relative';
  let testFile = null;
  let _nedScrubber = null;
  let _nedCurrentDirHandle = null;

  // Determine file filter for hidden-files-count warning banner
  const stepIsVideoOnly = node.transformId?.startsWith('flow-video-') || !!def?.sourceTransformId || def?.categoryKey === 'video-effect';
  const stepFileFilter  = stepIsVideoOnly
    ? { includeVideo: true, onlyVideo: true }
    : fileFilterForRecipe(recipe);

  // Create zumilabs-file-browser element
  const skEl = document.createElement('zumilabs-file-browser');
  skEl.setAttribute('compare-mode', 'transform');
  skEl.setAttribute('no-hash-routing', '');
  const nedAllowedTypes = allowedTypesAttrForRecipe(recipe, { videoOnly: stepIsVideoOnly });
  if (nedAllowedTypes) skEl.setAttribute('allowed-types', nedAllowedTypes);
  skEl.style.cssText = 'display:block;width:100%;height:100%';
  wsContainer.appendChild(skEl);
  sk = skEl;

  // Scrubber overlay — positioned above the compare viewer strip
  const scrubberMount = document.createElement('div');
  scrubberMount.id = 'ned-scrubber-mount';
  scrubberMount.style.cssText = 'position:absolute;bottom:110px;left:0;right:0;z-index:100;pointer-events:none;';
  wsContainer.appendChild(scrubberMount);

  // ── Track active file → scrubber + info panel; restore folder state ──
  // Attach BEFORE compareInfo/compareRender so the filebrowser:ready listener
  // is registered before the element fires it.
  sk.addEventListener('filebrowser:workspace', (e) => {
    if (e.detail?.currentHandle) _nedCurrentDirHandle = e.detail.currentHandle;
  });

  wireFolderState(sk, () => getFolder('input').catch(() => getFolder('browse')), {
    label: 'ned',
    onFileFocus: async (e) => {
      if (!e.detail) {
        testFile = null;
        window._icTestImage = { file: null };
        if (_nedScrubber) { _nedScrubber.destroy(); _nedScrubber = null; }
        scrubberMount.innerHTML = '';
        return;
      }
      const file = await e.detail.handle.getFile();
      testFile = file;
      window._icTestImage = { file };

      if (_infoPanel && file) {
        const inputHandle = await getFolder('input').catch(() => null);
        if (inputHandle) _infoPanel.setDirHandle(inputHandle);
        _infoPanel.setFile(file);
      }
      if (trControls && file && isVideoFile(file)) {
        trControls.loadFilmstrip(file);
      }

      if (_nedScrubber) { _nedScrubber.destroy(); _nedScrubber = null; }
      scrubberMount.style.pointerEvents = 'auto';
      if (file && isVideoFile(file)) {
        _nedScrubber = await mountVideoScrubber(scrubberMount, file, {
          initialTime: getStoredSeekTime(file.name),
          onSeek: (t) => {
            setStoredSeekTime(file.name, t);
            schedulePreview();
          },
        });
      } else {
        scrubberMount.innerHTML = '';
      }
    },
  });

  // ── Compare controls (Before/After toggles) ─────────────
  let nedCompareRef  = 'original'; // 'original' | 'prev' — what the left panel shows
  let nedResultRef   = 'step';     // 'step' | 'final'    — what the right panel shows

  const _nb = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid #374151;border-radius:5px;background:#1e293b;color:#94a3b8;font-size:11px;cursor:pointer;white-space:nowrap';
  const _nbA = 'background:#0077ff;color:#fff;border-color:#0077ff';
  const _nbI = 'background:#1e293b;color:#94a3b8;border-color:#374151';
  const _nchk = '<span style="font-size:12px;line-height:1">✓</span> ';
  const _nlbl = 'font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;flex-shrink:0';

  function _nedCmpBtn(cls, attr, val, active, title, text) {
    return `<button class="${cls}" data-${attr}="${val}" title="${title}" style="${_nb};${active ? _nbA : _nbI}">${active ? _nchk : ''}${text}</button>`;
  }
  function _buildNedControls() {
    return `<div style="display:flex;align-items:center;justify-content:center;width:100%;gap:12px">
      <span style="${_nlbl}">${i18n('ned.before')}</span>
      <div style="display:flex;gap:4px">
        ${_nedCmpBtn('ned-cmp-ref-btn','ref','original', nedCompareRef==='original',i18n('ned.compareOriginalTitle'),i18n('ned.original'))}
        ${_nedCmpBtn('ned-cmp-ref-btn','ref','prev',     nedCompareRef==='prev',    i18n('ned.comparePrevTitle'),i18n('ned.prevStep'))}
      </div>
      <div style="width:1px;height:22px;background:#374151;flex-shrink:0"></div>
      <span style="${_nlbl}">${i18n('ned.after')}</span>
      <div style="display:flex;gap:4px">
        ${_nedCmpBtn('ned-cmp-result-btn','result','step',  nedResultRef==='step', i18n('ned.showStepTitle'),i18n('ned.thisStep'))}
        ${_nedCmpBtn('ned-cmp-result-btn','result','final', nedResultRef==='final',i18n('ned.showFinalTitle'),i18n('ned.finalResult'))}
      </div>
    </div>`;
  }
  function _nedUpdateBtn(btn, isActive) {
    btn.style.cssText = `${_nb};${isActive ? _nbA : _nbI}`;
    const sp = btn.querySelector('span');
    if (isActive && !sp) btn.insertAdjacentHTML('afterbegin', _nchk);
    else if (!isActive && sp) sp.remove();
  }

  sk.compareControls = _buildNedControls();
  sk.compareBindControls = (cnt) => {
    cnt.querySelectorAll('.ned-cmp-ref-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        nedCompareRef = e.currentTarget.dataset.ref;
        cnt.querySelectorAll('.ned-cmp-ref-btn').forEach(b => _nedUpdateBtn(b, b.dataset.ref === nedCompareRef));
        if (sk) sk.triggerProcess();
      });
    });
    cnt.querySelectorAll('.ned-cmp-result-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        nedResultRef = e.currentTarget.dataset.result;
        cnt.querySelectorAll('.ned-cmp-result-btn').forEach(b => _nedUpdateBtn(b, b.dataset.result === nedResultRef));
        if (sk) sk.triggerProcess();
      });
    });
  };

  // ── compareInfo callback ─────────────────────────────────
  sk.compareInfo = async (file) => {
    const panel = await getOrCreateInfoPanel();
    await panel.setFile(file);
    panel.show();
  };

  // ── compareRender callback ───────────────────────────────
  sk.compareRender = async (file) => {
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
      return { noPreview: true, noPreviewReason: i18n('ned.videoOnlyReason') };
    }

    const params = collectParams(container, def.params || [], 'ned');
    const exif   = await extractExif(file);

    let sidecar = null;
    try {
      const { getFolder }   = await import('../data/folders.js');
      const { readSidecar } = await import('../data/sidecar.js');
      const dirHandle = _nedCurrentDirHandle || await getFolder('input').catch(() => null);
      if (dirHandle) {
        sidecar = await readSidecar(dirHandle, file.name).catch(() => null);
      }
    } catch { /* best-effort */ }

    let notice = null;
    if (node.transformId === 'flow-geo-timeline' && (!exif?.gps?.lat)) {
      notice = i18n('ned.gpsNotice');
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

    // Helper: load file into an ImageProcessor canvas
    async function _loadImageSource() {
      if (isVideoFile(file)) {
        const seekTime = getStoredSeekTime(file.name);
        return extractVideoFrame(file, seekTime);
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      return img;
    }

    // Helper: run a list of recipe nodes through ImageProcessor
    async function _runNodes(imageSource, nodes) {
      const p = new ImageProcessor();
      p.canvas.width  = imageSource.width  ?? imageSource.naturalWidth;
      p.canvas.height = imageSource.height ?? imageSource.naturalHeight;
      p.ctx.drawImage(imageSource, 0, 0);
      for (const n of (nodes || [])) {
        if (n.disabled) continue;
        const d = n.type === 'transform' ? registry.get(n.transformId) : null;
        if (!d) continue;
        const np = n.id === node.id ? params : (n.params || {});
        const applyDef = d.sourceTransformId ? registry.get(d.sourceTransformId) : d;
        const fn = typeof d.applyPerFrame === 'function'
          ? (c, pp, cx) => d.applyPerFrame(c, pp, cx)
          : applyDef?.apply ? (c, pp, cx) => applyDef.apply(c, pp, cx) : null;
        if (fn) try { await fn(p.ctx, np, context); } catch { /* ignore */ }
      }
      return p;
    }

    const imageSource = await _loadImageSource();

    // Flatten top-level nodes for prev/final computation
    const flatNodes = recipe.nodes || [];

    // --- Before (left panel) ---
    let beforeUrl;
    if (nedCompareRef === 'prev') {
      // Run all nodes strictly before the current one
      const prevNodes = [];
      for (const n of flatNodes) { if (n.id === node.id) break; prevNodes.push(n); }
      if (prevNodes.length > 0) {
        const prevProc = await _runNodes(imageSource, prevNodes);
        beforeUrl = await new Promise(r => prevProc.canvas.toBlob(b => r(b ? URL.createObjectURL(b) : null), 'image/jpeg', 0.88));
      } else {
        // No prior steps — fall back to original
        beforeUrl = isVideoFile(file)
          ? await new Promise(r => imageSource.toBlob(b => r(URL.createObjectURL(b)), 'image/jpeg', 0.88))
          : URL.createObjectURL(file);
      }
    } else {
      beforeUrl = isVideoFile(file)
        ? await new Promise(r => imageSource.toBlob(b => r(URL.createObjectURL(b)), 'image/jpeg', 0.88))
        : URL.createObjectURL(file);
    }

    // --- After (right panel) ---
    let afterUrl;
    if (nedResultRef === 'final') {
      // Run the full recipe
      const finalProc = await _runNodes(imageSource, flatNodes);
      afterUrl = await new Promise(r => finalProc.canvas.toBlob(b => r(b ? URL.createObjectURL(b) : null), 'image/jpeg', 0.88));
    } else {
      // Run only this step
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
      if (applyFn) try { await applyFn(proc.ctx, params, context); } catch { /* ignore */ }
      afterUrl = await new Promise(res => proc.canvas.toBlob(b => res(b ? URL.createObjectURL(b) : null), 'image/jpeg', 0.88));
    }

    return {
      beforeUrl,
      afterUrl,
      beforeLabel: nedCompareRef === 'prev' ? i18n('ned.prevStep') : i18n('ned.original'),
      afterLabel:  nedResultRef  === 'final' ? i18n('ned.allSteps')  : i18n('ned.thisStep'),
      context
    };
  };

  // ── Toolbar (i) button — toggle the same shared panel ────────────────
  container.querySelector('#ned-btn-info')?.addEventListener('click', async () => {
    const file = testFile ?? window._icTestImage?.file;
    if (!file) {
      window.AuroraToast?.show({ variant: 'info', title: i18n('ned.noTestImage') });
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
  container.querySelector('#ned-back')?.addEventListener('click', () => navigate(`#bld?id=${recipeId}${nedTransient ? '&transient=1' : ''}`));

  // ── Done — save params and go back ───────────────────────
  const saveNode = async () => {
    if (def) node.params = collectParams(container, def.params || [], 'ned');
    if (isConditional) node.condition = collectCondition(container);
    const labelInput = container.querySelector('#ned-label-input');
    if (labelInput) node.label = labelInput.value.trim();
    await saveRecipe(recipe);
  };

  // Commit any open freehand paint / mask overlay so unconfirmed edits aren't
  // lost when the user clicks Done while still painting.
  const commitOpenDrawEditors = () => {
    wsContainer.querySelector('#ned-paint-confirm-btn')?.click();
    wsContainer.querySelector('#ned-mask-confirm-btn')?.click();
  };

  const _doneFn = async () => { commitOpenDrawEditors(); await saveNode(); navigate(`#bld?id=${recipeId}${nedTransient ? '&transient=1' : ''}`); };
  container.querySelector('#ned-done-btn')?.addEventListener('click', _doneFn);
  container.querySelector('#ned-done-btn-bottom')?.addEventListener('click', _doneFn);

  // ── Reset ─────────────────────────────────────────────────
  const _resetFn = async () => {
    const confirmed = await showConfirm({
      title: i18n('ned.resetConfirmTitle'),
      body: i18n('ned.resetConfirmBody'),
      confirmText: i18n('ned.reset'),
      variant: 'warning',
      icon: 'restart_alt'
    });
    if (!confirmed) return;
    const defaults = {};
    (def?.params || []).forEach(p => { defaults[p.name] = p.defaultValue ?? ''; });
    node.params = defaults;
    navigate(`#ned?recipe=${recipeId}&node=${nodeId}`);
  };
  container.querySelector('#ned-btn-reset')?.addEventListener('click', _resetFn);
  container.querySelector('#ned-btn-reset-bottom')?.addEventListener('click', _resetFn);

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

  // ── Wire custom param editors (curves, levels, hsl, mask) ─
  // These store their value in a hidden <input> and dispatch bubbling
  // 'input' events when the user interacts with the canvas/sliders.
  container.querySelectorAll('input[type=hidden]').forEach(input => {
    input.addEventListener('input', schedulePreview);
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
        node.branches.push({ id: uuid(), label: i18n('ned.variantName', { letter: nextLetter }), nodes: [] });
        refreshBranchEditor();
      });

      container.querySelectorAll('.ned-btn-del-branch').forEach(btn => {
        btn.addEventListener('click', async e => {
          const idx = parseInt(btn.dataset.idx);
          if (node.branches.length <= 1) return;
          const confirmed = await showConfirm({
            title: i18n('ned.removeVariantTitle'),
            body: i18n('ned.removeVariantBody'),
            confirmText: i18n('ned.removeVariant'),
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

  // ── Drag overlay for x/y/radius percent transforms ────────
  const _xParam = def?.params?.find(p => (p.name === 'x' || p.name === 'centerX') && p.type === 'range');
  const _yParam = def?.params?.find(p => (p.name === 'y' || p.name === 'centerY') && p.type === 'range');
  const _rParam = def?.params?.find(p => p.name === 'radius' && p.type === 'range');

  if (_xParam && _yParam) {
    let _imgW = 1, _imgH = 1;
    let _dragMode = null;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    // Overlay covers the full wsContainer; we find the actual <img alt="after">
    // element inside the sidekick to get exact image bounds via getBoundingClientRect.
    const overlayDiv = document.createElement('div');
    overlayDiv.style.cssText = 'position:absolute;inset:0;z-index:88;cursor:crosshair;pointer-events:none;';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.style.cssText = 'width:100%;height:100%;pointer-events:none;overflow:visible;';
    overlayDiv.appendChild(svg);
    wsContainer.appendChild(overlayDiv);

    function _getLetterbox() {
      // The sidekick uses shadow DOM — must pierce it to find the after image
      const afterImg = (sk.shadowRoot ?? sk).querySelector('img[alt="after"]');
      if (afterImg) {
        const ir = afterImg.getBoundingClientRect();
        const cr = overlayDiv.getBoundingClientRect();
        return { x: ir.left - cr.left, y: ir.top - cr.top, w: ir.width, h: ir.height };
      }
      // Fallback: rough estimate (full width minus filmstrip)
      return { x: 0, y: 44, w: overlayDiv.offsetWidth / 2, h: overlayDiv.offsetHeight - 134 };
    }

    function _getVal(name) {
      return parseFloat(container.querySelector(`#ned-param-${name}`)?.value ?? 50);
    }
    function _setVal(name, v, param) {
      const el = container.querySelector(`#ned-param-${name}`);
      if (!el) return;
      const clamped = Math.round(Math.max(param.min ?? 0, Math.min(param.max ?? 100, v)));
      el.value = clamped;
      const valEl = container.querySelector(`#ned-param-${name}-val`);
      if (valEl) valEl.textContent = clamped;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function _mkEl(tag, attrs) {
      const el = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    }

    function _renderOverlay() {
      const lb = _getLetterbox();
      const xv = _getVal(_xParam.name);
      const yv = _getVal(_yParam.name);
      const rv = _rParam ? _getVal(_rParam.name) : null;
      const px = lb.x + (xv / 100) * lb.w;
      const py = lb.y + (yv / 100) * lb.h;
      const _rBase = node.transformId === 'gen-circle'
        ? Math.hypot(lb.w, lb.h)
        : Math.min(lb.w, lb.h);
      const pr = rv !== null ? (rv / 100) * _rBase : 0;

      // Rebuild SVG; all shapes go into a clipped group so nothing escapes the image bounds
      svg.innerHTML = `
        <defs>
          <filter id="ned-ov-shadow"><feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="black" flood-opacity="0.7"/></filter>
          <clipPath id="ned-ov-clip"><rect x="${lb.x}" y="${lb.y}" width="${lb.w}" height="${lb.h}"/></clipPath>
        </defs>`;

      // Hit-rect: transparent but captures mouse events within the image area
      const hit = _mkEl('rect', { id: 'ned-ov-hit', x: lb.x, y: lb.y, width: lb.w, height: lb.h, fill: 'transparent' });
      hit.style.cssText = 'cursor:crosshair;pointer-events:all;';
      hit.addEventListener('mousedown', _onImageMouseDown);
      svg.appendChild(hit);

      // Clipped drawing group
      const g = _mkEl('g', { 'clip-path': 'url(#ned-ov-clip)' });
      svg.appendChild(g);

      if (pr > 8) {
        g.appendChild(_mkEl('circle', { cx: px, cy: py, r: pr, fill: 'none', stroke: 'rgba(255,255,255,0.85)', 'stroke-width': '1.5', 'stroke-dasharray': '6 3', filter: 'url(#ned-ov-shadow)' }));
        if (_rParam) {
          const rh = _mkEl('circle', { cx: px + pr, cy: py, r: 7, fill: 'white', stroke: '#0077ff', 'stroke-width': '2' });
          rh.style.cssText = 'cursor:ew-resize;pointer-events:all;';
          rh.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); _dragMode = 'radius'; });
          g.appendChild(rh);
        }
      }

      [[px - 10, py, px + 10, py], [px, py - 10, px, py + 10]].forEach(([x1, y1, x2, y2]) =>
        g.appendChild(_mkEl('line', { x1, y1, x2, y2, stroke: 'white', 'stroke-width': '1.5', filter: 'url(#ned-ov-shadow)' }))
      );
      g.appendChild(_mkEl('circle', { cx: px, cy: py, r: 5, fill: '#0077ff', stroke: 'white', 'stroke-width': '1.5', filter: 'url(#ned-ov-shadow)' }));

      const lbl = _mkEl('text', { x: px + 10, y: py - 10, fill: 'white', 'font-size': '11', filter: 'url(#ned-ov-shadow)' });
      lbl.textContent = `${Math.round(xv)}%, ${Math.round(yv)}%${rv !== null ? ` r:${Math.round(rv)}%` : ''}`;
      g.appendChild(lbl);

      // Update hit area for radius handle (outside clip group intentionally resets each render)
    }

    function _onImageMouseDown(e) {
      e.preventDefault();
      const rect = overlayDiv.getBoundingClientRect();
      const lb = _getLetterbox();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;

      if (_rParam) {
        const xv = _getVal(_xParam.name), yv = _getVal(_yParam.name), rv = _getVal(_rParam.name);
        const cx = lb.x + (xv / 100) * lb.w, cy = lb.y + (yv / 100) * lb.h;
        const cr = (rv / 100) * lb.w;
        const dx = mx - (cx + cr), dy = my - cy;
        if (Math.hypot(dx, dy) < 14) { _dragMode = 'radius'; return; }
      }

      _dragMode = 'center';
      _setVal(_xParam.name, ((mx - lb.x) / lb.w) * 100, _xParam);
      _setVal(_yParam.name, ((my - lb.y) / lb.h) * 100, _yParam);
      _renderOverlay();
      schedulePreview();
    }

    const _onMove = e => {
      if (!_dragMode) return;
      const rect = overlayDiv.getBoundingClientRect();
      const lb = _getLetterbox();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (_dragMode === 'center') {
        _setVal(_xParam.name, ((mx - lb.x) / lb.w) * 100, _xParam);
        _setVal(_yParam.name, ((my - lb.y) / lb.h) * 100, _yParam);
      } else {
        const xv = _getVal(_xParam.name), yv = _getVal(_yParam.name);
        const cx = lb.x + (xv / 100) * lb.w, cy = lb.y + (yv / 100) * lb.h;
        const dist = Math.hypot(mx - cx, my - cy);
        const rBase = node.transformId === 'gen-circle' ? Math.hypot(lb.w, lb.h) : Math.min(lb.w, lb.h);
        _setVal(_rParam.name, (dist / rBase) * 100, _rParam);
      }
      _renderOverlay();
      schedulePreview();
    };
    const _onUp = () => { _dragMode = null; };
    window.addEventListener('mousemove', _onMove);
    window.addEventListener('mouseup', _onUp);

    // Capture image dimensions when a file is focused
    sk.addEventListener('filebrowser:file-focus', async e => {
      if (!e.detail?.handle) return;
      try {
        const f = await e.detail.handle.getFile();
        if (isVideoFile(f)) return;
        const url = URL.createObjectURL(f);
        const img = new Image();
        img.onload = () => { _imgW = img.naturalWidth; _imgH = img.naturalHeight; URL.revokeObjectURL(url); _renderOverlay(); };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
      } catch { /* best-effort */ }
    });

    // Re-render when sliders change
    [_xParam, _yParam, ...(_rParam ? [_rParam] : [])].forEach(p => {
      container.querySelector(`#ned-param-${p.name}`)?.addEventListener('input', _renderOverlay);
    });

    new ResizeObserver(_renderOverlay).observe(wsContainer);

    // Re-render after compareRender updates the after <img> src
    const _origCompareRender = sk.compareRender;
    sk.compareRender = async (file) => {
      const result = await _origCompareRender(file);
      // Wait one frame for the img element to be updated in DOM
      requestAnimationFrame(() => requestAnimationFrame(_renderOverlay));
      return result;
    };

    _renderOverlay();
  }

  // ── Rect overlay helper for box-based transforms ──────────
  // Used by: Clipping Mask (cx/cy/scaleW/scaleH), Rich Text box, geo-crop
  function _mountRectOverlay({ getRect, setRect, constrainAspect = false }) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    let _rdragMode = null; // 'move' | 'tl'|'tr'|'bl'|'br'|'n'|'s'|'e'|'w'
    let _rdragStart = null;

    const od = document.createElement('div');
    od.style.cssText = 'position:absolute;inset:0;z-index:88;pointer-events:none;';
    const sv = document.createElementNS(SVG_NS, 'svg');
    sv.style.cssText = 'width:100%;height:100%;pointer-events:none;overflow:visible;';
    od.appendChild(sv); wsContainer.appendChild(od);

    function _getLb() {
      const ai = (sk.shadowRoot ?? sk).querySelector('img[alt="after"]');
      if (ai) { const ir = ai.getBoundingClientRect(), cr = od.getBoundingClientRect();
        return { x: ir.left - cr.left, y: ir.top - cr.top, w: ir.width, h: ir.height }; }
      return { x: 0, y: 44, w: od.offsetWidth / 2, h: od.offsetHeight - 134 };
    }

    function _renderRect() {
      const lb = _getLb();
      const r = getRect(); // { x, y, w, h } all in 0-100 percent
      const px = lb.x + (r.x / 100) * lb.w;
      const py = lb.y + (r.y / 100) * lb.h;
      const pw = (r.w / 100) * lb.w;
      const ph = (r.h / 100) * lb.h;

      sv.innerHTML = `<defs>
        <filter id="ned-rv-shadow"><feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="black" flood-opacity="0.7"/></filter>
        <clipPath id="ned-rv-clip"><rect x="${lb.x}" y="${lb.y}" width="${lb.w}" height="${lb.h}"/></clipPath>
      </defs>`;

      const hit = document.createElementNS(SVG_NS, 'rect');
      Object.entries({ x: lb.x, y: lb.y, width: lb.w, height: lb.h, fill: 'transparent' }).forEach(([k,v]) => hit.setAttribute(k,v));
      hit.style.cssText = 'cursor:crosshair;pointer-events:all;';
      hit.addEventListener('mousedown', _onRectDown);
      sv.appendChild(hit);

      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('clip-path', 'url(#ned-rv-clip)');
      sv.appendChild(g);

      // Main rect
      const rect = document.createElementNS(SVG_NS, 'rect');
      Object.entries({ x: px, y: py, width: pw, height: ph, fill: 'none',
        stroke: 'rgba(255,255,255,0.85)', 'stroke-width': '1.5', 'stroke-dasharray': '6 3',
        filter: 'url(#ned-rv-shadow)' }).forEach(([k,v]) => rect.setAttribute(k,v));
      rect.style.cssText = 'cursor:move;pointer-events:all;';
      rect.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); _rdragMode = 'move'; _startDrag(e); });
      g.appendChild(rect);

      // 8 resize handles
      const handles = [
        { id:'tl', cx:px,       cy:py,       cursor:'nwse-resize' },
        { id:'tr', cx:px+pw,    cy:py,       cursor:'nesw-resize' },
        { id:'bl', cx:px,       cy:py+ph,    cursor:'nesw-resize' },
        { id:'br', cx:px+pw,    cy:py+ph,    cursor:'nwse-resize' },
        { id:'n',  cx:px+pw/2,  cy:py,       cursor:'ns-resize'   },
        { id:'s',  cx:px+pw/2,  cy:py+ph,    cursor:'ns-resize'   },
        { id:'e',  cx:px+pw,    cy:py+ph/2,  cursor:'ew-resize'   },
        { id:'w',  cx:px,       cy:py+ph/2,  cursor:'ew-resize'   },
      ];
      for (const h of handles) {
        const hc = document.createElementNS(SVG_NS, 'circle');
        Object.entries({ cx: h.cx, cy: h.cy, r: 7, fill: 'white', stroke: '#0077ff', 'stroke-width': '2',
          filter: 'url(#ned-rv-shadow)' }).forEach(([k,v]) => hc.setAttribute(k,v));
        hc.style.cssText = `cursor:${h.cursor};pointer-events:all;`;
        hc.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); _rdragMode = h.id; _startDrag(e); });
        g.appendChild(hc);
      }

      // Label
      const lbl = document.createElementNS(SVG_NS, 'text');
      Object.entries({ x: px+4, y: py-6, fill: 'white', 'font-size': '11', filter: 'url(#ned-rv-shadow)' }).forEach(([k,v]) => lbl.setAttribute(k,v));
      lbl.textContent = `${Math.round(r.x)}%, ${Math.round(r.y)}%  ${Math.round(r.w)}×${Math.round(r.h)}%`;
      g.appendChild(lbl);
    }

    function _startDrag(e) {
      const rect = od.getBoundingClientRect();
      _rdragStart = { mx: e.clientX, my: e.clientY, rect: { ...getRect() } };
    }

    function _onRectDown(e) {
      e.preventDefault();
      const lb = _getLb();
      const mx = e.clientX - od.getBoundingClientRect().left;
      const my = e.clientY - od.getBoundingClientRect().top;
      const r = getRect();
      const px = lb.x + (r.x / 100) * lb.w, py = lb.y + (r.y / 100) * lb.h;
      const pw = (r.w / 100) * lb.w, ph = (r.h / 100) * lb.h;
      // click inside rect = move
      if (mx >= px && mx <= px+pw && my >= py && my <= py+ph) {
        _rdragMode = 'move'; _startDrag(e);
      } else {
        // click outside = redefine from scratch
        _rdragMode = 'br';
        const nx = ((mx - lb.x) / lb.w) * 100;
        const ny = ((my - lb.y) / lb.h) * 100;
        setRect({ x: nx, y: ny, w: 0, h: 0 });
        _rdragStart = { mx: e.clientX, my: e.clientY, rect: { x: nx, y: ny, w: 0, h: 0 } };
        _renderRect();
      }
    }

    const _onRMove = e => {
      if (!_rdragMode || !_rdragStart) return;
      const lb = _getLb();
      const dx = ((e.clientX - _rdragStart.mx) / lb.w) * 100;
      const dy = ((e.clientY - _rdragStart.my) / lb.h) * 100;
      const s = _rdragStart.rect;
      let { x, y, w, h } = s;
      const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
      if (_rdragMode === 'move') {
        x = clamp(s.x + dx, 0, 100 - w); y = clamp(s.y + dy, 0, 100 - h);
      } else {
        if (_rdragMode.includes('e'))  w = clamp(s.w + dx, 1, 100 - s.x);
        if (_rdragMode.includes('s'))  h = clamp(s.h + dy, 1, 100 - s.y);
        if (_rdragMode.includes('w')) { const nw = clamp(s.w - dx, 1, s.x + s.w); x = s.x + s.w - nw; w = nw; }
        if (_rdragMode.includes('n')) { const nh = clamp(s.h - dy, 1, s.y + s.h); y = s.y + s.h - nh; h = nh; }
        if (_rdragMode === 'tl') { const nw=clamp(s.w-dx,1,s.x+s.w); const nh=clamp(s.h-dy,1,s.y+s.h); x=s.x+s.w-nw; y=s.y+s.h-nh; w=nw; h=nh; }
        if (_rdragMode === 'tr') { w=clamp(s.w+dx,1,100-s.x); const nh=clamp(s.h-dy,1,s.y+s.h); y=s.y+s.h-nh; h=nh; }
        if (_rdragMode === 'bl') { const nw=clamp(s.w-dx,1,s.x+s.w); x=s.x+s.w-nw; w=nw; h=clamp(s.h+dy,1,100-s.y); }
        if (_rdragMode === 'br') { w=clamp(s.w+dx,1,100-s.x); h=clamp(s.h+dy,1,100-s.y); }
      }
      setRect({ x: Math.round(x*10)/10, y: Math.round(y*10)/10, w: Math.round(w*10)/10, h: Math.round(h*10)/10 });
      _renderRect();
      schedulePreview();
    };
    const _onRUp = () => { _rdragMode = null; _rdragStart = null; };
    window.addEventListener('mousemove', _onRMove);
    window.addEventListener('mouseup', _onRUp);
    new ResizeObserver(_renderRect).observe(wsContainer);

    const _origCR = sk.compareRender;
    sk.compareRender = async (file) => {
      const result = await _origCR(file);
      requestAnimationFrame(() => requestAnimationFrame(_renderRect));
      return result;
    };

    _renderRect();
    return { renderRect: _renderRect, _overlayDiv: od, destroy() {
      window.removeEventListener('mousemove', _onRMove);
      window.removeEventListener('mouseup', _onRUp);
      od.remove();
    }};
  }

  // ── Clipping Mask: cx/cy/scaleW/scaleH rect overlay ───────
  const _cxParam   = def?.params?.find(p => p.name === 'cx'     && p.type === 'range');
  const _cyParam   = def?.params?.find(p => p.name === 'cy'     && p.type === 'range');
  const _scaleW    = def?.params?.find(p => p.name === 'scaleW' && p.type === 'range');
  const _scaleH    = def?.params?.find(p => p.name === 'scaleH' && p.type === 'range');

  if (_cxParam && _cyParam && _scaleW && _scaleH) {
    const _getV = n => parseFloat(container.querySelector(`#ned-param-${n}`)?.value ?? 50);
    const _setV = (name, v, param) => {
      const el = container.querySelector(`#ned-param-${name}`);
      if (!el) return;
      const clamped = Math.round(Math.max(param.min ?? 0, Math.min(param.max ?? 100, v)) * 10) / 10;
      el.value = clamped;
      const vEl = container.querySelector(`#ned-param-${name}-val`);
      if (vEl) vEl.textContent = clamped;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    _mountRectOverlay({
      getRect: () => {
        const cx = _getV('cx'), cy = _getV('cy');
        const sw = _getV('scaleW'), sh = _getV('scaleH');
        // cx/cy is centre; convert to top-left x/y for rect overlay
        return { x: cx - sw / 2, y: cy - sh / 2, w: sw, h: sh };
      },
      setRect: ({ x, y, w, h }) => {
        _setV('cx', x + w / 2, _cxParam);
        _setV('cy', y + h / 2, _cyParam);
        _setV('scaleW', w, _scaleW);
        _setV('scaleH', h, _scaleH);
      },
    });
    [_cxParam, _cyParam, _scaleW, _scaleH].forEach(p => {
      container.querySelector(`#ned-param-${p.name}`)?.addEventListener('input', () => {});
    });
  }

  // ── Rich Text: boxX/Y/W/H rect overlay ────────────────────
  const _rtBX = def?.params?.find(p => p.name === 'boxX' && p.type === 'range');
  const _rtBY = def?.params?.find(p => p.name === 'boxY' && p.type === 'range');
  const _rtBW = def?.params?.find(p => p.name === 'boxW' && p.type === 'range');
  const _rtBH = def?.params?.find(p => p.name === 'boxH' && p.type === 'range');

  if (_rtBX && _rtBY && _rtBW && _rtBH) {
    const _getV = n => parseFloat(container.querySelector(`#ned-param-${n}`)?.value ?? 50);
    const _setV = (name, v, param) => {
      const el = container.querySelector(`#ned-param-${name}`);
      if (!el) return;
      const clamped = Math.round(Math.max(param.min ?? 0, Math.min(param.max ?? 100, v)) * 10) / 10;
      el.value = clamped;
      const vEl = container.querySelector(`#ned-param-${name}-val`);
      if (vEl) vEl.textContent = clamped;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const _rtOverlay = _mountRectOverlay({
      getRect: () => {
        const bx = _getV('boxX'), by = _getV('boxY');
        const bw = _getV('boxW'), bh = _getV('boxH');
        return { x: bx - bw / 2, y: by - bh / 2, w: bw, h: bh };
      },
      setRect: ({ x, y, w, h }) => {
        _setV('boxX', x + w / 2, _rtBX);
        _setV('boxY', y + h / 2, _rtBY);
        _setV('boxW', w, _rtBW);
        _setV('boxH', h, _rtBH);
      },
    });

    const _modeEl = container.querySelector('#ned-param-positionMode');
    // Show/hide box vs anchor params based on mode
    const _boxParamNames   = ['boxX','boxY','boxW','boxH'];
    const _anchorParamNames = ['anchor','offsetX','offsetY'];
    const _updateBoxParamVisibility = () => {
      const isFree = _modeEl?.value === 'free';
      _boxParamNames.forEach(n => {
        const f = container.querySelector(`#ned-param-${n}`)?.closest('.ned-field');
        if (f) f.style.display = isFree ? '' : 'none';
      });
      _anchorParamNames.forEach(n => {
        const f = container.querySelector(`#ned-param-${n}`)?.closest('.ned-field');
        if (f) f.style.display = isFree ? 'none' : '';
      });
      if (_rtOverlay?._overlayDiv) _rtOverlay._overlayDiv.style.display = isFree ? '' : 'none';
    };
    _modeEl?.addEventListener('change', _updateBoxParamVisibility);
    _updateBoxParamVisibility();
  }

  // ── geo-crop: x/y/width/height text-type rect overlay ─────
  if (node.transformId === 'geo-crop') {
    function _parsePct(val, dim) {
      if (!val) return 0;
      const s = String(val).trim();
      if (s.endsWith('%')) return parseFloat(s);
      return (parseFloat(s) / dim) * 100;
    }
    function _getCropRect(lb) {
      const xv = container.querySelector('#ned-param-x')?.value || '0';
      const yv = container.querySelector('#ned-param-y')?.value || '0';
      const wv = container.querySelector('#ned-param-width')?.value || '100%';
      const hv = container.querySelector('#ned-param-height')?.value || '100%';
      return {
        x: _parsePct(xv, lb?.w ?? 100),
        y: _parsePct(yv, lb?.h ?? 100),
        w: _parsePct(wv, lb?.w ?? 100),
        h: _parsePct(hv, lb?.h ?? 100),
      };
    }
    function _setCropVal(name, pct) {
      const el = container.querySelector(`#ned-param-${name}`);
      if (!el) return;
      el.value = `${Math.round(pct * 10) / 10}%`;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    _mountRectOverlay({
      getRect: () => _getCropRect(),
      setRect: ({ x, y, w, h }) => {
        _setCropVal('x', x); _setCropVal('y', y);
        _setCropVal('width', w); _setCropVal('height', h);
      },
    });
  }

  // ── Rectangle & Ellipse overlays ──────────────────────────
  if (node.transformId === 'gen-rect' || node.transformId === 'gen-ellipse') {
    const isEllipse = node.transformId === 'gen-ellipse';
    const xParamName = 'x';
    const yParamName = 'y';
    const wParamName = isEllipse ? 'radiusX' : 'width';
    const hParamName = isEllipse ? 'radiusY' : 'height';
    
    const _xParam = def?.params?.find(p => p.name === xParamName && p.type === 'range');
    const _yParam = def?.params?.find(p => p.name === yParamName && p.type === 'range');
    const _wParam = def?.params?.find(p => p.name === wParamName && p.type === 'range');
    const _hParam = def?.params?.find(p => p.name === hParamName && p.type === 'range');

    if (_xParam && _yParam && _wParam && _hParam) {
      const _getV = n => parseFloat(container.querySelector(`#ned-param-${n}`)?.value ?? 50);
      const _setV = (name, v, param) => {
        const el = container.querySelector(`#ned-param-${name}`);
        if (!el) return;
        const clamped = Math.round(Math.max(param.min ?? 0, Math.min(param.max ?? 100, v)) * 10) / 10;
        el.value = clamped;
        const vEl = container.querySelector(`#ned-param-${name}-val`);
        if (vEl) vEl.textContent = clamped;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };

      _mountRectOverlay({
        getRect: () => {
          const cx = _getV(xParamName), cy = _getV(yParamName);
          const w = _getV(wParamName), h = _getV(hParamName);
          if (isEllipse) {
            return { x: cx - w, y: cy - h, w: w * 2, h: h * 2 };
          }
          return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
        },
        setRect: ({ x, y, w, h }) => {
          if (isEllipse) {
            _setV(xParamName, x + w / 2, _xParam);
            _setV(yParamName, y + h / 2, _yParam);
            _setV(wParamName, w / 2, _wParam);
            _setV(hParamName, h / 2, _hParam);
          } else {
            _setV(xParamName, x + w / 2, _xParam);
            _setV(yParamName, y + h / 2, _yParam);
            _setV(wParamName, w, _wParam);
            _setV(hParamName, h, _hParam);
          }
        },
      });
    }
  }

  // ── Vector Path: points list overlay ──────────────────────────
  if (node.transformId === 'gen-path') {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    let _pdragIdx = null;

    const od = document.createElement('div');
    od.style.cssText = 'position:absolute;inset:0;z-index:88;pointer-events:none;';
    const sv = document.createElementNS(SVG_NS, 'svg');
    sv.style.cssText = 'width:100%;height:100%;pointer-events:none;overflow:visible;';
    od.appendChild(sv); wsContainer.appendChild(od);

    function _getLb() {
      const ai = (sk.shadowRoot ?? sk).querySelector('img[alt="after"]');
      if (ai) { const ir = ai.getBoundingClientRect(), cr = od.getBoundingClientRect();
        return { x: ir.left - cr.left, y: ir.top - cr.top, w: ir.width, h: ir.height }; }
      return { x: 0, y: 44, w: od.offsetWidth / 2, h: od.offsetHeight - 134 };
    }

    function _getPoints() {
      const input = container.querySelector('#ned-param-points');
      try { return JSON.parse(input?.value || '[]'); } catch(e) { return []; }
    }

    function _setPoints(pts) {
      const input = container.querySelector('#ned-param-points');
      if (!input) return;
      input.value = JSON.stringify(pts);
      const countEl = container.querySelector('.ned-path-points-count');
      if (countEl) countEl.textContent = i18n('ned.pointsCount', { count: pts.length });
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function _renderPath() {
      const lb = _getLb();
      const pts = _getPoints();
      
      sv.innerHTML = `<defs>
        <filter id="ned-pv-shadow"><feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="black" flood-opacity="0.8"/></filter>
      </defs>`;

      const hit = document.createElementNS(SVG_NS, 'rect');
      Object.entries({ x: lb.x, y: lb.y, width: lb.w, height: lb.h, fill: 'transparent' }).forEach(([k,v]) => hit.setAttribute(k,v));
      hit.style.cssText = 'cursor:crosshair;pointer-events:all;';
      hit.addEventListener('mousedown', _onPathBgDown);
      sv.appendChild(hit);

      if (pts.length > 0) {
        const pathLine = document.createElementNS(SVG_NS, 'path');
        const d = pts.map((p, i) => {
          const px = lb.x + (p[0] / 100) * lb.w;
          const py = lb.y + (p[1] / 100) * lb.h;
          return `${i === 0 ? 'M' : 'L'} ${px} ${py}`;
        }).join(' ');
        
        const style = container.querySelector('#ned-param-style')?.value || 'stroke';
        const isClosed = style === 'closed-stroke' || style === 'fill';
        const closedD = isClosed ? d + ' Z' : d;

        Object.entries({
          d: closedD,
          fill: 'none',
          stroke: 'rgba(255,255,255,0.85)',
          'stroke-width': '2',
          'stroke-dasharray': '6 3',
          filter: 'url(#ned-pv-shadow)'
        }).forEach(([k,v]) => pathLine.setAttribute(k,v));
        sv.appendChild(pathLine);

        pts.forEach((p, idx) => {
          const px = lb.x + (p[0] / 100) * lb.w;
          const py = lb.y + (p[1] / 100) * lb.h;
          
          const circle = document.createElementNS(SVG_NS, 'circle');
          Object.entries({
            cx: px,
            cy: py,
            r: 7,
            fill: idx === 0 ? '#10b981' : '#0077ff',
            stroke: 'white',
            'stroke-width': '1.5',
            filter: 'url(#ned-pv-shadow)'
          }).forEach(([k,v]) => circle.setAttribute(k,v));
          circle.style.cssText = 'cursor:move;pointer-events:all;';
          
          circle.addEventListener('mousedown', e => {
            e.preventDefault(); e.stopPropagation();
            _pdragIdx = idx;
          });
          
          circle.addEventListener('dblclick', e => {
            e.preventDefault(); e.stopPropagation();
            const current = _getPoints();
            current.splice(idx, 1);
            _setPoints(current);
            _renderPath();
            schedulePreview();
          });

          sv.appendChild(circle);
        });
      }
    }

    function _onPathBgDown(e) {
      e.preventDefault();
      const rect = od.getBoundingClientRect();
      const lb = _getLb();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      const px = ((mx - lb.x) / lb.w) * 100;
      const py = ((my - lb.y) / lb.h) * 100;
      
      const pts = _getPoints();
      pts.push([Math.round(px * 10) / 10, Math.round(py * 10) / 10]);
      _pdragIdx = pts.length - 1;
      _setPoints(pts);
      _renderPath();
      schedulePreview();
    }

    const _onPathMove = e => {
      if (_pdragIdx === null) return;
      const rect = od.getBoundingClientRect();
      const lb = _getLb();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      const px = Math.max(0, Math.min(100, ((mx - lb.x) / lb.w) * 100));
      const py = Math.max(0, Math.min(100, ((my - lb.y) / lb.h) * 100));
      
      const pts = _getPoints();
      pts[_pdragIdx] = [Math.round(px * 10) / 10, Math.round(py * 10) / 10];
      _setPoints(pts);
      _renderPath();
      schedulePreview();
    };

    const _onPathUp = () => { _pdragIdx = null; };
    
    window.addEventListener('mousemove', _onPathMove);
    window.addEventListener('mouseup', _onPathUp);
    new ResizeObserver(_renderPath).observe(wsContainer);
    
    container.querySelector('#ned-param-style')?.addEventListener('change', _renderPath);
    container.querySelector('#ned-param-points')?.addEventListener('input', _renderPath);
    
    const _origCR = sk.compareRender;
    sk.compareRender = async (file) => {
      const result = await _origCR(file);
      requestAnimationFrame(() => requestAnimationFrame(_renderPath));
      return result;
    };

    _renderPath();
  }

  // ── Draw Paint: freehand canvas drawing UI ─────────────────
  const _paintParam = def?.params?.find(p => p.type === 'paint');
  if (_paintParam) {
    function _hexToRgb(hex) {
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 255, g: 0, b: 0 };
    }

    function _drawBrushStamp(pc, x, y, width, color, feather, erase) {
      pc.save();
      if (erase) {
        pc.globalCompositeOperation = 'destination-out';
      } else {
        pc.globalCompositeOperation = 'source-over';
      }
      
      const r = width / 2;
      if (r <= 0) {
        pc.restore();
        return;
      }
      
      if (feather <= 0) {
        pc.fillStyle = color;
        pc.beginPath();
        pc.arc(x, y, r, 0, Math.PI * 2);
        pc.fill();
      } else {
        const grad = pc.createRadialGradient(x, y, r * (1 - feather / 100), x, y, r);
        if (erase) {
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          grad.addColorStop(0, color);
          const rgb = _hexToRgb(color);
          grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        }
        pc.fillStyle = grad;
        pc.beginPath();
        pc.arc(x, y, r, 0, Math.PI * 2);
        pc.fill();
      }
      pc.restore();
    }

    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.ned-paint-edit-btn');
      if (!btn) return;
      const paramId = btn.dataset.paramId;
      const hiddenInput = container.querySelector(`#${paramId}`);
      if (!hiddenInput) return;

      const drawHost = document.createElement('div');
      drawHost.style.cssText = 'position:absolute;inset:0;z-index:200;display:flex;flex-direction:column;';

      const afterImg = (sk.shadowRoot ?? sk).querySelector('img[alt="after"]');
      const bgSrc = afterImg?.src || '';

      drawHost.innerHTML = `
        <div style="flex:1;position:relative;overflow:hidden;background:#111;">
          ${bgSrc ? `<img src="${bgSrc}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">` : ''}
          <canvas id="ned-paint-canvas" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;cursor:crosshair;touch-action:none;opacity:0.85;mix-blend-mode:normal;"></canvas>
        </div>
        <div style="flex-shrink:0;padding:12px 18px;display:flex;flex-direction:column;gap:10px;background:var(--ps-bg-surface);border-top:1px solid var(--ps-border);">
          <!-- Row 1: Swatches -->
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span style="font-size:11px;color:var(--ps-text-muted)">${i18n('ned.colorSwatches')}</span>
            <div id="ned-paint-swatches" style="display:flex;gap:6px;align-items:center;"></div>
            <span style="font-size:11px;color:var(--ps-text-muted);margin-left:12px;">${i18n('ned.custom')}</span>
            <input type="color" id="ned-paint-brush-color" value="#ff0000" style="width:36px;height:24px;border:1px solid var(--ps-border);border-radius:4px;cursor:pointer;padding:0;background:none;">
          </div>
          <!-- Row 2: Sliders & Controls -->
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;color:var(--ps-text-muted)">${i18n('ned.size')}</span>
              <input type="range" id="ned-paint-brush-size" min="2" max="150" value="15" style="width:100px">
              <span id="ned-paint-brush-size-val" style="font-size:11px;width:35px;color:var(--ps-text-muted)">15px</span>
            </div>
            
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;color:var(--ps-text-muted)">${i18n('ned.feather')}</span>
              <input type="range" id="ned-paint-brush-feather" min="0" max="100" value="20" style="width:100px">
              <span id="ned-paint-brush-feather-val" style="font-size:11px;width:35px;color:var(--ps-text-muted)">20%</span>
            </div>
            
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;font-size:11px;">
              <input type="checkbox" id="ned-paint-brush-speed" checked style="cursor:pointer;">
              <span>${i18n('ned.speedSensitiveSize')}</span>
            </label>
            
            <button class="btn-secondary" id="ned-paint-erase-btn" style="font-size:11px;display:flex;align-items:center;gap:4px;">
              <span class="material-symbols-outlined" style="font-size:14px;">ink_eraser</span>
              <span>${i18n('ned.eraseMode')}</span>
            </button>
            
            <button class="btn-secondary" id="ned-paint-clear-btn" style="font-size:11px;display:flex;align-items:center;gap:4px;">
              <span class="material-symbols-outlined" style="font-size:14px;">delete</span>
              <span>${i18n('ned.clearAll')}</span>
            </button>
            
            <div style="flex:1"></div>
            
            <button class="btn-secondary" id="ned-paint-cancel-btn">${i18n('ned.cancel')}</button>
            <button class="btn-primary"   id="ned-paint-confirm-btn">${i18n('ned.confirm')}</button>
          </div>
        </div>`;
      wsContainer.appendChild(drawHost);

      const paintCanvas = drawHost.querySelector('#ned-paint-canvas');
      const sizeSlider = drawHost.querySelector('#ned-paint-brush-size');
      const sizeVal = drawHost.querySelector('#ned-paint-brush-size-val');
      const featherSlider = drawHost.querySelector('#ned-paint-brush-feather');
      const featherVal = drawHost.querySelector('#ned-paint-brush-feather-val');
      const colorInput = drawHost.querySelector('#ned-paint-brush-color');
      const swatchesContainer = drawHost.querySelector('#ned-paint-swatches');
      
      sizeSlider.addEventListener('input', () => { sizeVal.textContent = `${sizeSlider.value}px`; });
      featherSlider.addEventListener('input', () => { featherVal.textContent = `${featherSlider.value}%`; });

      // Quick palette
      const colorsList = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000', '#f97316', '#8b5cf6'];
      colorsList.forEach(col => {
        const sw = document.createElement('div');
        sw.style.cssText = `width:18px;height:18px;border-radius:50%;background:${col};cursor:pointer;border:2px solid ${col === '#ffffff' ? 'var(--ps-border)' : 'transparent'};transition:transform 0.1s;`;
        sw.addEventListener('click', () => {
          colorInput.value = col;
          drawHost.querySelectorAll('#ned-paint-swatches > div').forEach(d => d.style.transform = '');
          sw.style.transform = 'scale(1.25)';
          if (eraseMode) {
            eraseMode = false;
            drawHost.querySelector('#ned-paint-erase-btn').classList.remove('btn-primary');
            drawHost.querySelector('#ned-paint-erase-btn').classList.add('btn-secondary');
          }
        });
        swatchesContainer.appendChild(sw);
      });
      if (swatchesContainer.children.length > 0) {
        swatchesContainer.children[0].style.transform = 'scale(1.25)';
      }

      let eraseMode = false;

      function _sizeCanvas() {
        if (afterImg) {
          const ir = afterImg.getBoundingClientRect();
          paintCanvas.width  = afterImg.naturalWidth  || ir.width;
          paintCanvas.height = afterImg.naturalHeight || ir.height;
        } else {
          paintCanvas.width  = wsContainer.offsetWidth;
          paintCanvas.height = wsContainer.offsetHeight;
        }
      }
      _sizeCanvas();

      const pc = paintCanvas.getContext('2d');
      if (hiddenInput.value) {
        const prev = new Image(); prev.src = hiddenInput.value;
        prev.onload = () => pc.drawImage(prev, 0, 0, paintCanvas.width, paintCanvas.height);
      }

      let _drawing = false;
      let lastX = null, lastY = null;
      let lastTime = null;
      let lastWidth = null;

      function _coords(ev) {
        const r = paintCanvas.getBoundingClientRect();
        const sx = paintCanvas.width  / r.width;
        const sy = paintCanvas.height / r.height;
        const cx = (ev.clientX - r.left) * sx;
        const cy = (ev.clientY - r.top)  * sy;
        return [cx, cy];
      }

      paintCanvas.addEventListener('mousedown', ev => {
        _drawing = true;
        const [x, y] = _coords(ev);
        lastX = x; lastY = y;
        lastTime = Date.now();
        lastWidth = parseInt(sizeSlider.value);
        
        const baseWidth = parseInt(sizeSlider.value);
        const col = colorInput.value;
        const feather = parseInt(featherSlider.value);
        _drawBrushStamp(pc, x, y, baseWidth, col, feather, eraseMode);
      });

      paintCanvas.addEventListener('mousemove', ev => {
        if (!_drawing) return;
        const [x, y] = _coords(ev);
        const time = Date.now();
        const dt = Math.max(1, time - lastTime);
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        const baseWidth = parseInt(sizeSlider.value);
        const col = colorInput.value;
        const feather = parseInt(featherSlider.value);
        const speedEnabled = drawHost.querySelector('#ned-paint-brush-speed').checked;
        
        const speed = dist / dt;
        let targetWidth = baseWidth;
        if (speedEnabled && !eraseMode) {
          const speedFactor = Math.min(1, speed / 5);
          targetWidth = baseWidth * (1 - 0.75 * speedFactor);
        }
        
        const steps = Math.max(1, Math.floor(dist / 1.5));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const ix = lastX + dx * t;
          const iy = lastY + dy * t;
          const iw = lastWidth + (targetWidth - lastWidth) * t;
          _drawBrushStamp(pc, ix, iy, iw, col, feather, eraseMode);
        }
        
        lastX = x; lastY = y;
        lastTime = time;
        lastWidth = targetWidth;
      });

      paintCanvas.addEventListener('mouseup',    () => { _drawing = false; });
      paintCanvas.addEventListener('mouseleave', () => { _drawing = false; });

      drawHost.querySelector('#ned-paint-erase-btn').addEventListener('click', () => {
        eraseMode = !eraseMode;
        const eraseBtn = drawHost.querySelector('#ned-paint-erase-btn');
        if (eraseMode) {
          eraseBtn.classList.remove('btn-secondary');
          eraseBtn.classList.add('btn-primary');
          drawHost.querySelectorAll('#ned-paint-swatches > div').forEach(d => d.style.transform = '');
        } else {
          eraseBtn.classList.remove('btn-primary');
          eraseBtn.classList.add('btn-secondary');
        }
      });
      
      drawHost.querySelector('#ned-paint-clear-btn').addEventListener('click', () => {
        pc.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
      });
      drawHost.querySelector('#ned-paint-cancel-btn').addEventListener('click', () => drawHost.remove());
      drawHost.querySelector('#ned-paint-confirm-btn').addEventListener('click', () => {
        hiddenInput.value = paintCanvas.toDataURL('image/png');
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        drawHost.remove();
        
        const editBtn = container.querySelector(`[data-param-id="${paramId}"]`);
        if (editBtn) editBtn.textContent = i18n('ned.editPaint');
        const parentField = editBtn?.closest('.ned-field');
        if (parentField && !parentField.querySelector('span[style*="4ade80"]')) {
          const tick = document.createElement('span');
          tick.style.cssText = 'color:#4ade80;font-size:11px;white-space:nowrap;margin-left:8px';
          tick.textContent = i18n('ned.painted');
          editBtn.after(tick);
        }
        schedulePreview();
      });
    });
  }

  // ── Draw Mask: freehand canvas drawing UI ─────────────────
  const _maskParam = def?.params?.find(p => p.type === 'mask');
  if (_maskParam) {
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.ned-mask-edit-btn');
      if (!btn) return;
      const paramId = btn.dataset.paramId;
      const hiddenInput = container.querySelector(`#${paramId}`);
      if (!hiddenInput) return;

      // Build a full-size drawing overlay over wsContainer
      const drawHost = document.createElement('div');
      drawHost.style.cssText = 'position:absolute;inset:0;z-index:200;display:flex;flex-direction:column;';

      // Find current after image to use as background
      const afterImg = (sk.shadowRoot ?? sk).querySelector('img[alt="after"]');
      const bgSrc = afterImg?.src || '';

      drawHost.innerHTML = `
        <div style="flex:1;position:relative;overflow:hidden;background:#111;">
          ${bgSrc ? `<img src="${bgSrc}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">` : ''}
          <canvas id="ned-mask-canvas" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;cursor:crosshair;touch-action:none;opacity:0.75;mix-blend-mode:screen;"></canvas>
        </div>
        <div style="flex-shrink:0;padding:10px 16px;display:flex;gap:10px;align-items:center;background:var(--ps-bg-surface);border-top:1px solid var(--ps-border);">
          <span style="font-size:11px;color:var(--ps-text-muted)">${i18n('ned.brush')}</span>
          <input type="range" id="ned-mask-brush-size" min="5" max="120" value="30" style="width:100px">
          <button class="btn-secondary" id="ned-mask-erase-btn" style="font-size:11px">${i18n('ned.erase')}</button>
          <button class="btn-secondary" id="ned-mask-clear-btn" style="font-size:11px">${i18n('ned.clear')}</button>
          <div style="flex:1"></div>
          <span style="font-size:10px;color:var(--ps-text-muted)">${i18n('ned.maskHint')}</span>
          <button class="btn-secondary" id="ned-mask-cancel-btn">${i18n('ned.cancel')}</button>
          <button class="btn-primary"   id="ned-mask-confirm-btn">${i18n('ned.confirm')}</button>
        </div>`;
      wsContainer.appendChild(drawHost);

      const maskCanvas = drawHost.querySelector('#ned-mask-canvas');
      const bgImg = drawHost.querySelector('img');
      let eraseMode = false;

      // Size canvas to match displayed image dimensions
      function _sizeCanvas() {
        if (afterImg) {
          const ir = afterImg.getBoundingClientRect();
          maskCanvas.width  = afterImg.naturalWidth  || ir.width;
          maskCanvas.height = afterImg.naturalHeight || ir.height;
        } else {
          maskCanvas.width  = wsContainer.offsetWidth;
          maskCanvas.height = wsContainer.offsetHeight;
        }
      }
      _sizeCanvas();

      const mc = maskCanvas.getContext('2d');
      // Restore existing mask if any
      if (hiddenInput.value) {
        const prev = new Image(); prev.src = hiddenInput.value;
        prev.onload = () => mc.drawImage(prev, 0, 0, maskCanvas.width, maskCanvas.height);
      }
      mc.lineCap = 'round'; mc.lineJoin = 'round';

      let _drawing = false;
      function _coords(ev) {
        const r = maskCanvas.getBoundingClientRect();
        const sx = maskCanvas.width  / r.width;
        const sy = maskCanvas.height / r.height;
        const cx = (ev.clientX - r.left) * sx;
        const cy = (ev.clientY - r.top)  * sy;
        return [cx, cy];
      }
      maskCanvas.addEventListener('mousedown', ev => {
        _drawing = true;
        const [x, y] = _coords(ev);
        mc.globalCompositeOperation = eraseMode ? 'destination-out' : 'source-over';
        mc.strokeStyle = 'white'; mc.lineWidth = parseInt(drawHost.querySelector('#ned-mask-brush-size').value) * (maskCanvas.width / maskCanvas.getBoundingClientRect().width);
        mc.beginPath(); mc.moveTo(x, y);
      });
      maskCanvas.addEventListener('mousemove', ev => {
        if (!_drawing) return;
        const [x, y] = _coords(ev);
        mc.lineTo(x, y); mc.stroke();
      });
      maskCanvas.addEventListener('mouseup',    () => { _drawing = false; });
      maskCanvas.addEventListener('mouseleave', () => { _drawing = false; });

      drawHost.querySelector('#ned-mask-erase-btn').addEventListener('click', () => {
        eraseMode = !eraseMode;
        drawHost.querySelector('#ned-mask-erase-btn').textContent = eraseMode ? i18n('ned.paint') : i18n('ned.erase');
      });
      drawHost.querySelector('#ned-mask-clear-btn').addEventListener('click', () => {
        mc.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      });
      drawHost.querySelector('#ned-mask-cancel-btn').addEventListener('click', () => drawHost.remove());
      drawHost.querySelector('#ned-mask-confirm-btn').addEventListener('click', () => {
        hiddenInput.value = maskCanvas.toDataURL('image/png');
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        drawHost.remove();
        // Refresh the button label
        const editBtn = container.querySelector(`[data-param-id="${paramId}"]`);
        if (editBtn) editBtn.textContent = i18n('ned.editMask');
        const parentField = editBtn?.closest('.ned-field');
        if (parentField && !parentField.querySelector('span[style*="4ade80"]')) {
          const tick = document.createElement('span');
          tick.style.cssText = 'color:#4ade80;font-size:11px;white-space:nowrap;margin-left:8px';
          tick.textContent = i18n('ned.painted');
          editBtn.after(tick);
        }
        schedulePreview();
      });
    });
  }

}

// ── Condition editor builder ───────────────────────────────
function buildConditionEditor(cond = {}) {
  const fields = ['width','height','aspectRatio','IsPortrait','HasGPS','MetaExists','exif.date','exif.author','meta.custom'];
  const ops    = ['exists','eq','neq','gt','lt','gte','lte','contains'];
  return `
    <div class="ned-section-title" style="margin-top:16px">
      <span class="material-symbols-outlined" style="font-size:14px">alt_route</span>
      ${i18n('ned.condition')}
    </div>
    <div class="ned-fields">
      <div class="ned-field">
        <label class="ned-field-label">${i18n('ned.field')}</label>
        <select id="ned-cond-field" class="ic-input">
          ${fields.map(f => `<option value="${f}" ${f === cond.field ? 'selected' : ''}>${f}</option>`).join('')}
          <option value="${cond.field || ''}" ${!fields.includes(cond.field) ? 'selected' : ''}>${cond.field || i18n('ned.custom2')}</option>
        </select>
      </div>
      <div class="ned-field">
        <label class="ned-field-label">${i18n('ned.operator')}</label>
        <select id="ned-cond-op" class="ic-input">
          ${ops.map(o => `<option value="${o}" ${o === cond.operator ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="ned-field">
        <label class="ned-field-label">${i18n('ned.value')}</label>
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
      ${i18n('ned.branchVariants')}
    </div>
    <div class="ned-fields">
      ${(node.branches || []).map((b, i) => `
        <div class="ned-field">
          <div class="flex items-center gap-2">
            <div style="flex:1">
              <label class="ned-field-label">${i18n('ned.variantLabel', { num: i + 1 })}</label>
              <input type="text" class="ic-input ned-branch-label" data-branch-idx="${i}" value="${escHtml(b.label || '')}" placeholder="${i18n('ned.variantLabelPlaceholder')}">
            </div>
            ${node.branches.length > 1 ? `
              <button class="btn-icon ned-btn-del-branch" data-idx="${i}" title="${i18n('ned.removeVariant')}" style="margin-top:18px">
                <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-red)">delete</span>
              </button>` : ''}
          </div>
        </div>`).join('')}
      <button class="btn-secondary" id="ned-btn-add-branch" style="margin-top:4px">
        <span class="material-symbols-outlined" style="font-size:14px">add</span>
        ${i18n('ned.addVariant')}
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

    .ned-params-panel { width:320px; flex-shrink:0; border-right:1px solid var(--ps-border); display:flex; flex-direction:column; overflow:hidden; }
    .ned-params-scroll { flex:1; overflow-y:auto; }
    .ned-params-actions { flex-shrink:0; padding:10px 16px 12px; display:flex; gap:8px; border-top:1px solid var(--ps-border); background:var(--ps-bg-surface); }
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
