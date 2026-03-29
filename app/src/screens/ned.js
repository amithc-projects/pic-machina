/**
 * ImageChef — NED: Node Editor
 *
 * Full-screen editor for a single recipe node's parameters.
 * Accessed via #ned?recipe=<recipeId>&node=<nodeId>
 * Saves params back to the recipe on Done.
 */

import { getRecipe, saveRecipe }               from '../data/recipes.js';
import { navigate }                            from '../main.js';
import { registry }                            from '../engine/index.js';
import { ImageProcessor }                      from '../engine/index.js';
import { extractExif }                         from '../engine/exif-reader.js';
import { getImageInfo, renderImageInfoPanel,
         injectImageInfoStyles }               from '../utils/image-info.js';

// Category accent colours
const CAT_COLORS = {
  geo:     '#38bdf8',
  color:   '#a78bfa',
  overlay: '#fb923c',
  ai:      '#34d399',
  flow:    '#0077ff',
  meta:    '#f472b6',
};

// ── Param field renderer ───────────────────────────────────
function renderParamField(param, value) {
  const id = `ned-param-${param.name}`;
  const val = value ?? param.defaultValue ?? '';

  switch (param.type) {
    case 'boolean':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${param.label}</label>
          <label class="ned-toggle">
            <input type="checkbox" id="${id}" name="${param.name}" ${val ? 'checked' : ''}>
            <span class="ned-toggle-track"></span>
          </label>
        </div>`;

    case 'select':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${param.label}</label>
          <select id="${id}" name="${param.name}" class="ic-input">
            ${(param.options || []).map(opt =>
              `<option value="${escHtml(opt.value)}" ${opt.value == val ? 'selected' : ''}>${escHtml(opt.label)}</option>`
            ).join('')}
          </select>
        </div>`;

    case 'range':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${param.label}
            <span id="${id}-val" class="mono text-sm" style="margin-left:auto;color:var(--ps-blue)">${val}</span>
          </label>
          <input type="range" id="${id}" name="${param.name}" class="ic-range"
            min="${param.min ?? 0}" max="${param.max ?? 100}" step="${param.step ?? 1}" value="${val}">
        </div>`;

    case 'color':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${param.label}</label>
          <div class="ned-color-row">
            <input type="color" id="${id}" name="${param.name}" value="${val}" class="ned-color-input">
            <input type="text" id="${id}-hex" class="ic-input" value="${val}" maxlength="7"
              style="flex:1;font-family:var(--font-mono);font-size:12px">
          </div>
        </div>`;

    case 'number':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${param.label}</label>
          <input type="number" id="${id}" name="${param.name}" class="ic-input"
            value="${val}" ${param.min != null ? `min="${param.min}"` : ''} ${param.max != null ? `max="${param.max}"` : ''}
            ${param.step != null ? `step="${param.step}"` : ''}>
        </div>`;

    case 'textarea':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${param.label}</label>
          <textarea id="${id}" name="${param.name}" class="ic-input" rows="4">${escHtml(String(val))}</textarea>
        </div>`;

    default: // 'text'
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${param.label}</label>
          <input type="text" id="${id}" name="${param.name}" class="ic-input" value="${escHtml(String(val))}">
        </div>`;
  }
}

// ── Collect form values ────────────────────────────────────
function collectParams(container, paramDefs) {
  const result = {};
  for (const p of paramDefs) {
    const id = `ned-param-${p.name}`;
    const el = container.querySelector(`#${id}`);
    if (!el) continue;
    if (p.type === 'boolean') {
      result[p.name] = el.checked;
    } else if (p.type === 'range' || p.type === 'number') {
      result[p.name] = parseFloat(el.value);
    } else {
      result[p.name] = el.value;
    }
  }
  return result;
}

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
    if (n.thenNodes) { const f = findNode(n.thenNodes, nodeId); if (f) return f; }
    if (n.elseNodes) { const f = findNode(n.elseNodes, nodeId); if (f) return f; }
  }
  return null;
}

export async function render(container, hash) {
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
  const paramsHtml    = def ? (def.params || []).map(p => renderParamField(p, node.params?.[p.name])).join('') : '';

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
          <button class="btn-secondary" id="ned-reset-btn">
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
          ${branchHtml}

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
        <div class="ned-preview-panel">
          <div class="ned-preview-header">
            <div class="cmp-mode-toggle" role="group" id="ned-mode-toggle" style="display:none">
              <button class="cmp-mode-btn is-active" data-ned-mode="slider">
                <span class="material-symbols-outlined" style="font-size:14px">swap_horiz</span> Slider
              </button>
              <button class="cmp-mode-btn" data-ned-mode="side">
                <span class="material-symbols-outlined" style="font-size:14px">view_column</span> Side by Side
              </button>
            </div>
            <span class="text-sm text-muted" id="ned-preview-label" style="flex:1;padding-left:4px">Live Preview</span>
            <button class="btn-icon" id="ned-btn-info" title="Image info / metadata" style="display:none">
              <span class="material-symbols-outlined">info</span>
            </button>
            <label class="btn-secondary" style="cursor:pointer;font-size:12px">
              <span class="material-symbols-outlined" style="font-size:14px">upload</span>
              Test Image
              <input type="file" id="ned-file-input" accept="image/*" style="display:none">
            </label>
          </div>
          <div id="ned-notice" class="ned-notice" style="display:none"></div>
          <div id="ned-preview-area" class="ned-preview-area">
            <div class="empty-state">
              <span class="material-symbols-outlined" style="font-size:40px">image</span>
              <div class="empty-state-title">Upload a test image</div>
              <div class="empty-state-desc">See a live before/after comparison for this step.</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  injectNedStyles();
  injectImageInfoStyles();

  let testImage  = null;
  let testFile   = null;
  let beforeUrl  = null;
  let afterUrl   = null;
  let nedMode    = 'slider';
  let sliderPct  = 50;
  let isDragging = false;

  // Restore persisted test image from previous session
  if (window._icTestImage?.file) {
    testFile = window._icTestImage.file;
    beforeUrl = URL.createObjectURL(testFile);
    testImage = new Image();
    testImage.src = beforeUrl;
    await new Promise(res => { testImage.onload = res; testImage.onerror = res; });
    const infoBtn = container.querySelector('#ned-btn-info');
    if (infoBtn) infoBtn.style.display = '';
    setTimeout(runPreview, 0);
  }

  // ── Mode toggle ───────────────────────────────────────────
  container.querySelectorAll('[data-ned-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      nedMode = btn.dataset.nedMode;
      container.querySelectorAll('[data-ned-mode]').forEach(b => b.classList.toggle('is-active', b === btn));
      if (beforeUrl && afterUrl) renderComparison();
    });
  });

  // ── Back ──────────────────────────────────────────────────
  container.querySelector('#ned-back')?.addEventListener('click', () => navigate(`#bld?id=${recipeId}`));

  // ── Done — save params and go back ───────────────────────
  container.querySelector('#ned-done-btn')?.addEventListener('click', async () => {
    await saveNode();
    navigate(`#bld?id=${recipeId}`);
  });

  // ── Reset ─────────────────────────────────────────────────
  container.querySelector('#ned-reset-btn')?.addEventListener('click', () => {
    if (!confirm('Reset all parameters to defaults?')) return;
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
  container.querySelectorAll('.ic-input, input[type=checkbox]').forEach(input => {
    if (input.type !== 'color') input.addEventListener('change', schedulePreview);
  });

  // ── Image info modal ──────────────────────────────────────
  container.querySelector('#ned-btn-info')?.addEventListener('click', () => {
    if (!testFile) return;
    let modal = document.getElementById('ned-info-modal');
    if (modal) modal.remove();
    modal = document.createElement('dialog');
    modal.id = 'ned-info-modal';
    modal.style.cssText = 'width:520px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;padding:0;border-radius:14px;border:1px solid var(--ps-border);background:var(--ps-bg-surface)';
    modal.innerHTML = `
      <div style="padding:12px 16px;border-bottom:1px solid var(--ps-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <span style="font-size:14px;font-weight:600;color:var(--ps-text)">Image Info</span>
        <button class="btn-icon" id="ned-info-close"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div id="ned-info-body" style="flex:1;overflow-y:auto;padding:0">
        <div style="display:flex;align-items:center;justify-content:center;height:120px;gap:8px">
          <div class="spinner"></div><span class="text-sm text-muted">Reading metadata…</span>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.showModal();
    modal.querySelector('#ned-info-close')?.addEventListener('click', () => modal.close());
    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
    getImageInfo(testFile).then(info => {
      const body = modal.querySelector('#ned-info-body');
      if (body) { body.innerHTML = ''; body.appendChild(renderImageInfoPanel(info)); }
    });
  });

  // ── File input ─────────────────────────────────────────────
  container.querySelector('#ned-file-input')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    testFile = file;
    window._icTestImage = { file };
    container.querySelector('#ned-btn-info').style.display = '';
    if (beforeUrl) URL.revokeObjectURL(beforeUrl);
    beforeUrl = URL.createObjectURL(file);
    testImage = new Image();
    await new Promise((res, rej) => { testImage.onload = res; testImage.onerror = rej; testImage.src = beforeUrl; });
    runPreview();
  });

  let _previewTimer = null;
  function schedulePreview() {
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(runPreview, 300);
  }

  async function saveNode() {
    if (def) node.params = collectParams(container, def.params || []);
    const labelInput = container.querySelector('#ned-label-input');
    if (labelInput) node.label = labelInput.value || def?.name || node.type;
    if (isConditional) node.condition = collectCondition(container);
    await saveRecipe(recipe);
  }

  // Transforms that need specific EXIF/data to produce a visible change
  const NEEDS_GPS    = new Set(['overlay-map']);
  const NEEDS_FACES  = new Set(['ai-face-privacy', 'geo-face-crop']);
  const NEEDS_ALPHA  = new Set(['ai-remove-bg', 'ai-clipping-mask']);

  function getTransformNotice(transformId, exif) {
    if (NEEDS_GPS.has(transformId) && !exif?.gps)
      return '⚠ This step uses GPS coordinates from EXIF data. The test image has no GPS — upload a geotagged photo to see the map overlay.';
    if (NEEDS_FACES.has(transformId))
      return 'ℹ This step requires face detection (MediaPipe). Preview may take a moment on first use.';
    if (NEEDS_ALPHA.has(transformId))
      return 'ℹ Background removal runs a WASM model — first preview may take several seconds to load.';
    return null;
  }

  async function runPreview() {
    if (!testImage || !def) return;
    const previewArea = container.querySelector('#ned-preview-area');
    const noticeEl    = container.querySelector('#ned-notice');
    if (!previewArea) return;

    try {
      const params  = collectParams(container, def.params || []);
      const exif    = testFile ? await extractExif(testFile) : {};
      const context = { filename: testFile?.name || 'test.jpg', exif, meta: {}, variables: new Map() };

      // Show contextual notice
      const notice = getTransformNotice(node.transformId, exif);
      if (noticeEl) {
        noticeEl.textContent = notice || '';
        noticeEl.style.display = notice ? 'block' : 'none';
      }

      const proc = new ImageProcessor();
      proc.canvas.width  = testImage.naturalWidth;
      proc.canvas.height = testImage.naturalHeight;
      proc.ctx.drawImage(testImage, 0, 0);

      await def.apply(proc.ctx, params, context);

      if (afterUrl) URL.revokeObjectURL(afterUrl);
      await new Promise(res => proc.canvas.toBlob(b => {
        afterUrl = b ? URL.createObjectURL(b) : null;
        res();
      }, 'image/jpeg', 0.88));

      // Show mode toggle
      const toggle = container.querySelector('#ned-mode-toggle');
      if (toggle) toggle.style.display = '';
      const label = container.querySelector('#ned-preview-label');
      if (label) label.textContent = '';

      renderComparison();
    } catch (err) {
      if (previewArea) previewArea.innerHTML = `<div class="empty-state">
        <span class="material-symbols-outlined">error</span>
        <div class="empty-state-title">Preview failed</div>
        <div class="empty-state-desc">${escHtml(err.message)}</div>
      </div>`;
    }
  }

  function renderComparison() {
    const previewArea = container.querySelector('#ned-preview-area');
    if (!previewArea || !beforeUrl || !afterUrl) return;

    if (nedMode === 'side') {
      previewArea.innerHTML = `
        <div class="ned-side-view">
          <div class="ned-side">
            <div class="ned-side-label">Before</div>
            <img src="${beforeUrl}" class="ned-cmp-img" draggable="false">
          </div>
          <div style="width:2px;background:var(--ps-border);flex-shrink:0"></div>
          <div class="ned-side">
            <div class="ned-side-label ned-side-label--blue">After</div>
            <img src="${afterUrl}" class="ned-cmp-img" draggable="false">
          </div>
        </div>`;
    } else {
      sliderPct = 50;
      previewArea.innerHTML = `
        <div class="ned-slider-view" id="ned-slider-view">
          <img src="${beforeUrl}" class="ned-cmp-img" draggable="false">
          <img src="${afterUrl}"  class="ned-cmp-img" id="ned-after-img" draggable="false"
               style="clip-path:inset(0 50% 0 0)">
          <div class="ned-slider-handle" id="ned-slider-handle" style="left:50%">
            <div class="ned-handle-line"></div>
            <div class="ned-handle-grip">
              <span class="material-symbols-outlined" style="font-size:15px">swap_horiz</span>
            </div>
          </div>
          <div class="ned-slider-badge ned-badge--left">Before</div>
          <div class="ned-slider-badge ned-badge--right">After</div>
        </div>`;

      const view     = previewArea.querySelector('#ned-slider-view');
      const afterImg = previewArea.querySelector('#ned-after-img');
      const handle   = previewArea.querySelector('#ned-slider-handle');

      function setSlider(x) {
        const rect = view.getBoundingClientRect();
        sliderPct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
        if (afterImg) afterImg.style.clipPath = `inset(0 ${100 - sliderPct}% 0 0)`;
        if (handle)   handle.style.left = `${sliderPct}%`;
      }

      handle?.addEventListener('mousedown', e => { isDragging = true; e.preventDefault(); });
      document.addEventListener('mousemove', e => { if (isDragging) setSlider(e.clientX); });
      document.addEventListener('mouseup',   () => { isDragging = false; });
      view?.addEventListener('click', e => { if (!isDragging) setSlider(e.clientX); });
    }
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
          <label class="ned-field-label">Variant ${i + 1} Label</label>
          <input type="text" class="ic-input ned-branch-label" data-branch-idx="${i}" value="${escHtml(b.label || '')}">
        </div>`).join('')}
      <div class="text-sm text-muted">Edit branch nodes in the Recipe Builder.</div>
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

    .ned-preview-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .ned-preview-header { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; flex-wrap:wrap; }
    .ned-notice { padding:8px 14px; font-size:12px; color:#f59e0b; background:rgba(245,158,11,0.08); border-bottom:1px solid rgba(245,158,11,0.2); flex-shrink:0; line-height:1.5; }
    .ned-preview-area {
      flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/32px 32px;
    }

    /* Comparison layouts */
    .ned-side-view { display:flex; width:100%; height:100%; }
    .ned-side { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
    .ned-cmp-img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; }
    .ned-side-label { position:absolute; top:8px; left:8px; z-index:2; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; font-weight:600; padding:2px 7px; border-radius:12px; font-family:var(--font-mono); }
    .ned-side-label--blue { background:rgba(0,119,255,0.85); }

    .ned-slider-view { position:relative; width:100%; height:100%; overflow:hidden; user-select:none; cursor:col-resize; }
    .ned-slider-handle { position:absolute; top:0; height:100%; transform:translateX(-50%); display:flex; align-items:center; z-index:10; pointer-events:none; }
    .ned-handle-line { position:absolute; top:0; left:50%; width:2px; height:100%; background:rgba(255,255,255,0.9); transform:translateX(-50%); box-shadow:0 0 6px rgba(0,0,0,0.4); }
    .ned-handle-grip { position:relative; z-index:1; width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.95); box-shadow:0 2px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; cursor:col-resize; pointer-events:all; color:#111; }
    .ned-slider-badge { position:absolute; top:8px; z-index:5; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; font-weight:600; padding:2px 7px; border-radius:12px; font-family:var(--font-mono); }
    .ned-badge--left { left:8px; }
    .ned-badge--right { right:8px; background:rgba(0,119,255,0.85); }

    /* Mode toggle (shared with cmp/out) */
    .cmp-mode-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden; }
    .cmp-mode-btn { display:flex; align-items:center; gap:5px; padding:5px 10px; font-size:12px; font-weight:500; background:transparent; border:none; color:var(--ps-text-muted); cursor:pointer; font-family:var(--font-primary); transition:background 150ms,color 150ms; }
    .cmp-mode-btn.is-active { background:var(--ps-blue); color:#fff; }
    .cmp-mode-btn:hover:not(.is-active) { background:var(--ps-bg-hover); color:var(--ps-text); }
  `;
  document.head.appendChild(s);
}
