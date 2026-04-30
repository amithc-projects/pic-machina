/**
 * PicMachina — Shared param field renderer
 *
 * Provides renderParamField() and collectParams() for rendering
 * typed form fields from a param definition array.
 * Used by: ned.js (node editor), set.js (run-params dialog), bld.js (recipe params editor).
 */

import { getSettings } from './settings.js';

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Render a param label as HTML, converting any occurrence of the literal
 * "{{vars}}" token (case-insensitive) into a clickable button that opens
 * the variable picker modal for the field `id`.
 *
 * Recognised label hints: "{{vars}}", "{{var}}", "{{variables}}".
 */
function renderLabelHtml(label, id, param = null) {
  const safe = escHtml(label || '');
  let html = safe.replace(/\{\{(vars?|variables)\}\}/gi, (match) => {
    return `<button type="button" class="ned-vars-link" data-vars-link="${id}"
      title="Click to browse and insert variables"
      style="background:none;border:none;padding:0 2px;margin:0;font:inherit;font-family:var(--font-mono,monospace);color:var(--ps-blue,#3b82f6);cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px">${match}</button>`;
  });
  if (param && param.textStyleOverride) {
    html = `<input type="checkbox" class="ic-text-override-toggle" data-target="${param.name}" title="Override Style Property" style="margin-right:4px;" /> ` + html;
  }
  return html;
}

/** Returns true if val is a {{...}} variable reference */
function isVarRef(val) {
  return typeof val === 'string' && /^\{\{/.test(val.trim());
}

/**
 * Render the variable-bind toggle button that sits next to the field label.
 * @param {string} id       — field DOM id
 * @param {boolean} active  — whether variable mode is currently active
 */
function varBindBtn(id, active) {
  return `<button type="button" class="ned-var-bind-btn${active ? ' ned-var-bind-btn--active' : ''}"
    data-var-bind="${id}" title="Bind to recipe variable"
    style="margin-left:auto;padding:0 2px;min-height:0;height:16px;display:flex;align-items:center;background:none;border:none;cursor:pointer;color:${active ? 'var(--ps-blue)' : 'var(--ps-text-muted)'}">
    <span class="material-symbols-outlined" style="font-size:14px;line-height:1">data_object</span>
  </button>`;
}

/**
 * Render a variable-mode text input (replaces the native widget when binding is active).
 * @param {string} id   — field DOM id
 * @param {string} val  — current value (a {{...}} string)
 */
function varInput(id, name, val) {
  return `<input type="text" id="${id}" name="${name}" class="ic-input ned-var-input"
    value="${escHtml(String(val))}"
    placeholder="{{recipe.variable-name}}"
    style="border-color:var(--ps-blue);font-family:var(--font-mono);font-size:12px">`;
}

/**
 * Render a single param field as an HTML string.
 * @param {object} param     — { name, label, type, defaultValue, min, max, step, options }
 * @param {*}      value     — current value (falls back to defaultValue)
 * @param {string} [prefix]  — DOM id prefix (default 'rp')
 * @param {object} [opts]    — { showVarBind: bool } — set false to hide the { } button (e.g. in set.js run-params)
 */
export function renderParamField(param, value, prefix = 'rp', { showVarBind = true } = {}) {
  const id  = `${prefix}-param-${param.name}`;
  const val = value ?? param.defaultValue ?? '';
  const overrideClass = param.textStyleOverride ? ' ic-text-override-field' : '';

  // For text / textarea types, variable refs work natively — no toggle needed
  const supportsVarBind = showVarBind && !['text', 'textarea'].includes(param.type);
  const varActive = supportsVarBind && isVarRef(val);

  switch (param.type) {
    case 'boolean':
      return `
        <div class="ned-field${overrideClass}">
          <label class="ned-field-label" for="${id}">${renderLabelHtml(param.label, id, param)}${supportsVarBind ? varBindBtn(id, varActive) : ''}</label>
          ${varActive
            ? varInput(id, param.name, val)
            : `<label class="ned-toggle">
                <input type="checkbox" id="${id}" name="${param.name}" ${val ? 'checked' : ''}>
                <span class="ned-toggle-track"></span>
              </label>`
          }
        </div>`;

    case 'text-style-select': {
      let savedStylesHtml = '<option value="">None (Custom Settings)</option>';
      try {
        const saved = getSettings().textStyles || [];
        savedStylesHtml += saved.map(s => `<option value="${escHtml(s.id)}" ${s.id === val ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('');
      } catch(e) {}
      
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${renderLabelHtml(param.label, id, param)}${supportsVarBind ? varBindBtn(id, varActive) : ''}</label>
          ${varActive
            ? varInput(id, param.name, val)
            : `<select id="${id}" name="${param.name}" class="ic-input ic-text-style-select" data-value="${escHtml(String(val))}">
                ${savedStylesHtml}
              </select>`
          }
        </div>`;
    }

    case 'font-select': {
      let fontOptionsHtml = '';
      try {
        const saved = getSettings().masterFonts || [];
        if (saved.length > 0) {
           fontOptionsHtml = saved.map(f => `<option value="${escHtml(f.value)}" ${f.value === val ? 'selected' : ''}>${escHtml(f.label)}</option>`).join('');
        } else {
           fontOptionsHtml = `<option value="Inter" ${val==='Inter'?'selected':''}>Inter</option>
                              <option value="monospace" ${val==='monospace'?'selected':''}>Monospace</option>
                              <option value="serif" ${val==='serif'?'selected':''}>Serif</option>`;
        }
      } catch(e) {}
      
      return `
        <div class="ned-field${overrideClass}">
          <label class="ned-field-label" for="${id}">${renderLabelHtml(param.label, id, param)}${supportsVarBind ? varBindBtn(id, varActive) : ''}</label>
          ${varActive
            ? varInput(id, param.name, val)
            : `<select id="${id}" name="${param.name}" class="ic-input ic-font-select" data-value="${escHtml(String(val))}">
                ${fontOptionsHtml}
              </select>`
          }
        </div>`;
    }

    case 'device-family-select':
    case 'device-model-select':
    case 'device-variant-select':
    case 'video-layout-select':
    case 'template-select':
    case 'select': {
      let selClass = 'ic-input';
      if (param.type === 'template-select') selClass += ' ic-template-select';
      else if (param.type === 'video-layout-select') selClass += ' ic-video-layout-select';
      else if (param.type.startsWith('device-')) selClass += ` ic-${param.type}`;
      
      return `
        <div class="ned-field${overrideClass}">
          <label class="ned-field-label" for="${id}">${renderLabelHtml(param.label, id, param)}${supportsVarBind ? varBindBtn(id, varActive) : ''}</label>
          ${varActive
            ? varInput(id, param.name, val)
            : `<select id="${id}" name="${param.name}" class="${selClass}" data-value="${escHtml(String(val))}">
                ${(param.options || []).map(opt =>
                  `<option value="${escHtml(opt.value)}" ${opt.value == val ? 'selected' : ''}>${escHtml(opt.label)}</option>`
                ).join('')}
              </select>`
          }
        </div>`;
    }

    case 'range':
      return `
        <div class="ned-field${overrideClass}">
          <label class="ned-field-label" for="${id}">${renderLabelHtml(param.label, id, param)}
            ${!varActive ? `<span id="${id}-val" class="mono text-sm" style="margin-left:auto;color:var(--ps-blue)">${val}</span>` : ''}
            ${supportsVarBind ? varBindBtn(id, varActive) : ''}
          </label>
          ${varActive
            ? varInput(id, param.name, val)
            : `<input type="range" id="${id}" name="${param.name}" class="ic-range"
                min="${param.min ?? 0}" max="${param.max ?? 100}" step="${param.step ?? 1}" value="${val}">`
          }
        </div>`;

    case 'color': {
      let savedColorsHtml = '';
      try {
        const saved = getSettings().palette || [
            { label: 'Black',  color: '#000000' },
            { label: 'White',  color: '#ffffff' },
            { label: 'Pink',   color: '#f472b6' },
            { label: 'Blue',   color: '#3b82f6' }
        ];
        savedColorsHtml = saved.map(c => `
          <div class="ned-saved-color" data-color="${c.color}" style="background:${c.color}; width:20px; height:20px; border-radius:4px; border:1px solid rgba(255,255,255,0.2); cursor:pointer;" title="${c.label}"></div>
        `).join('');
      } catch (e) {}

      return `
        <div class="ned-field${overrideClass}">
          <label class="ned-field-label" for="${id}">${renderLabelHtml(param.label, id, param)}${supportsVarBind ? varBindBtn(id, varActive) : ''}</label>
          ${varActive
            ? varInput(id, param.name, val)
            : `<div class="ned-color-row" style="margin-bottom:4px;">
                <input type="color" id="${id}" name="${param.name}" value="${val}" class="ned-color-input">
                <input type="text" id="${id}-hex" class="ic-input" value="${val}" maxlength="7"
                  style="flex:1;font-family:var(--font-mono);font-size:12px">
              </div>
              <div class="ned-saved-colors-wrap" id="${id}-saved-wrap" style="display:flex; gap:4px; flex-wrap:wrap;">
                ${savedColorsHtml}
                <button class="btn-ghost" title="Manage Swatches..." onclick="document.querySelector('#nav-settings')?.click()" style="padding:0; min-height:20px; width:20px; height:20px; margin-left:2px; border-radius:4px; background:var(--ps-bg-overlay);">
                   <span class="material-symbols-outlined" style="font-size:14px; color:var(--ps-text-muted);">settings</span>
                </button>
              </div>`
          }
        </div>`;
    }

    case 'number':
      return `
        <div class="ned-field${overrideClass}">
          <label class="ned-field-label" for="${id}">${renderLabelHtml(param.label, id, param)}${supportsVarBind ? varBindBtn(id, varActive) : ''}</label>
          ${varActive
            ? varInput(id, param.name, val)
            : `<input type="number" id="${id}" name="${param.name}" class="ic-input"
                value="${val}" ${param.min != null ? `min="${param.min}"` : ''} ${param.max != null ? `max="${param.max}"` : ''}
                ${param.step != null ? `step="${param.step}"` : ''}>`
          }
        </div>`;

    case 'textarea':
      return `
        <div class="ned-field${overrideClass}">
          <label class="ned-field-label" for="${id}">${renderLabelHtml(param.label, id, param)}</label>
          <textarea id="${id}" name="${param.name}" class="ic-input" rows="4">${escHtml(String(val))}</textarea>
        </div>`;
        
    case 'file-text':
      return `
        <div class="ned-field${overrideClass}">
          <label class="ned-field-label" for="${id}" style="display:flex; justify-content:space-between; align-items:center;">
             <span>${renderLabelHtml(param.label, id, param)}</span>
             <input type="file" id="${id}-file" accept="${param.accept || '.srt,.vtt,.txt'}" style="font-size:10px; max-width:160px;">
          </label>
          <textarea id="${id}" name="${param.name}" class="ic-input" rows="6" placeholder="Paste contents here, or use the file upload button above...">${escHtml(String(val))}</textarea>
        </div>`;

    case 'file': {
      // Image file browse + preview. The hidden input carries the data-URL value
      // so collectParams() reads it like any other text field.
      const hasVal = !!(val && String(val).length > 0);
      return `
        <div class="ned-field${overrideClass}">
          <label class="ned-field-label">${escHtml(param.label || 'Image')}</label>
          <input type="hidden" id="${id}" name="${param.name}" value="${escHtml(String(val))}">
          <div class="ned-file-wrap" id="${id}-wrap">
            <div class="ned-file-preview-area" id="${id}-preview-area">
              ${hasVal
                ? `<img class="ned-file-thumb" id="${id}-thumb" src="${escHtml(String(val))}" alt="Preview">`
                : `<div class="ned-file-empty" id="${id}-thumb"><span class="material-symbols-outlined">image</span><span>No image selected</span></div>`}
            </div>
            <div class="ned-file-actions">
              <label class="btn-secondary btn-sm ned-file-browse-label" title="Browse for image file">
                <span class="material-symbols-outlined" style="font-size:14px">folder_open</span>
                Browse…
                <input type="file" id="${id}-file" accept="${param.accept || 'image/*'}" style="display:none">
              </label>
              <button class="btn-secondary btn-sm ned-file-clear-btn" id="${id}-clear"
                      title="Clear image" style="display:${hasVal ? 'flex' : 'none'}">
                <span class="material-symbols-outlined" style="font-size:14px">close</span>
              </button>
            </div>
          </div>
        </div>`;
    }

    default: // 'text'
      return `
        <div class="ned-field${overrideClass}">
          <label class="ned-field-label" for="${id}">${renderLabelHtml(param.label, id, param)}</label>
          <input type="text" id="${id}" name="${param.name}" class="ic-input" value="${escHtml(String(val))}">
        </div>`;
  }
}

/**
 * Collect current values from rendered param fields.
 * @param {Element} container  — DOM container with the rendered fields
 * @param {object[]} paramDefs — param definition array
 * @param {string} [prefix]    — DOM id prefix (default 'rp')
 */
export function collectParams(container, paramDefs, prefix = 'rp') {
  const result = {};

  const textStyleParam = paramDefs.find(p => p.type === 'text-style-select');
  let hasTextStyle = false;
  if (textStyleParam) {
     const tsEl = container.querySelector(`#${prefix}-param-${textStyleParam.name}`);
     if (tsEl && tsEl.value && tsEl.value !== 'none') {
         hasTextStyle = true;
     }
  }

  for (const p of paramDefs) {
    const id = `${prefix}-param-${p.name}`;
    const el = container.querySelector(`#${id}`);
    if (!el) continue;

    if (p.textStyleOverride && hasTextStyle) {
       const toggle = container.querySelector(`.ic-text-override-toggle[data-target="${p.name}"]`);
       if (toggle && !toggle.checked) continue;
    }

    if (p.type === 'boolean' && el.type === 'checkbox') {
      result[p.name] = el.checked;
    } else if ((p.type === 'range' || p.type === 'number') && !isVarRef(el.value)) {
      // Only parseFloat if it's not a variable reference
      result[p.name] = parseFloat(el.value);
    } else {
      // text, textarea, select, variable-mode inputs — store as string
      result[p.name] = el.value;
    }
  }
  return result;
}

// ── Ensure field styles are available globally ─────────────
let _pfStylesInjected = false;
export function injectParamFieldStyles() {
  if (_pfStylesInjected || typeof document === 'undefined') return;
  _pfStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    .ned-field { display:flex; flex-direction:column; gap:4px; margin-bottom:2px; }
    .ned-field-label { font-size:12px; font-weight:500; color:var(--ps-text-muted); display:flex; align-items:center; gap:4px; }
    .ned-toggle { display:flex; align-items:center; cursor:pointer; width:fit-content; }
    .ned-toggle input[type=checkbox] { display:none; }
    .ned-toggle-track {
      width:36px; height:20px; border-radius:10px; background:var(--ps-bg-overlay);
      border:1px solid var(--ps-border); position:relative; transition:background 150ms;
    }
    .ned-toggle input:checked + .ned-toggle-track { background:var(--ps-blue); border-color:var(--ps-blue); }
    .ned-toggle-track::after {
      content:''; position:absolute; top:3px; left:3px;
      width:12px; height:12px; border-radius:50%; background:#fff; transition:transform 150ms;
    }
    .ned-toggle input:checked + .ned-toggle-track::after { transform:translateX(16px); }
    .ned-color-row { display:flex; align-items:center; gap:8px; }
    .ned-color-input { width:36px; height:32px; padding:2px; border:1px solid var(--ps-border); border-radius:6px; background:var(--ps-bg-app); cursor:pointer; }
    .ic-range { width:100%; accent-color:var(--ps-blue); }
    .ned-var-bind-btn { transition:color 150ms; }
    .ned-var-bind-btn:hover { color:var(--ps-blue) !important; }
    .ned-var-input { border-color:var(--ps-blue) !important; }

    /* Image file browse field */
    .ned-file-wrap { display:flex; flex-direction:column; gap:6px; }
    .ned-file-preview-area { border-radius:8px; overflow:hidden; background:var(--ps-bg-app); border:1px solid var(--ps-border); min-height:72px; display:flex; align-items:center; justify-content:center; }
    .ned-file-thumb { width:100%; max-height:140px; object-fit:contain; display:block; }
    .ned-file-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:16px; color:var(--ps-text-faint); }
    .ned-file-empty .material-symbols-outlined { font-size:28px; }
    .ned-file-empty span:last-child { font-size:11px; }
    .ned-file-actions { display:flex; align-items:center; gap:6px; }
    .ned-file-browse-label { display:flex; align-items:center; gap:4px; cursor:pointer; }
    .ned-file-clear-btn { display:flex; align-items:center; color:var(--ps-text-muted); }
    .ned-file-clear-btn:hover { color:var(--ps-red, #ef4444); }
  `;
  document.head.appendChild(s);
}

/**
 * Wire up live interactions for rendered fields (range value display, color sync, var-bind toggle).
 * Call after inserting the rendered HTML into the DOM.
 * @param {Element} container
 * @param {object[]} paramDefs
 * @param {string} [prefix]
 * @param {object} [opts]      — { getRecipeVars: () => string[] } — optional list of recipe var names for autocomplete
 */
export function bindParamFieldEvents(container, paramDefs, prefix = 'rp', { getRecipeVars, getVarContext } = {}) {
  // ── Wire {{vars}} clickable label hints → variable picker modal ──
  const varLinks = container.querySelectorAll('[data-vars-link]');
  if (varLinks.length) {
    // Merge getRecipeVars into the context accessor so the picker always
    // has the recipe variable list even when the caller didn't pass ctx.
    const ctxAccessor = () => {
      const raw = (typeof getVarContext === 'function') ? getVarContext() : {};
      const injectRecipe = (b) => {
        const base = b || {};
        if (!base.recipeVars && typeof getRecipeVars === 'function') {
          base.recipeVars = getRecipeVars() || [];
        }
        return base;
      };
      // getVarContext may be async (ned.js walks getImageInfo()) — unwrap.
      if (raw && typeof raw.then === 'function') return raw.then(injectRecipe);
      return injectRecipe(raw);
    };
    varLinks.forEach(link => {
      if (link.dataset.varsWired === '1') return;
      link.dataset.varsWired = '1';
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = link.getAttribute('data-vars-link');
        const target = container.querySelector(`#${targetId}`);
        if (!target) return;
        const { openVariablePicker } = await import('./variable-picker.js');
        openVariablePicker(target, { getVarContext: ctxAccessor });
      });
    });
  }

  for (const p of paramDefs) {
    const id = `${prefix}-param-${p.name}`;

    if (p.type === 'range') {
      const input = container.querySelector(`#${id}`);
      const disp  = container.querySelector(`#${id}-val`);
      if (input && disp) input.addEventListener('input', () => { disp.textContent = input.value; });
    }

    if (p.type === 'color') {
      const picker = container.querySelector(`#${id}`);
      const hex    = container.querySelector(`#${id}-hex`);
      const wrap   = container.querySelector(`#${id}-saved-wrap`);

      if (picker && hex) {
        picker.addEventListener('input', () => { hex.value = picker.value; });
        hex.addEventListener('input',   () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) picker.value = hex.value; });

        if (wrap) {
          wrap.addEventListener('click', (e) => {
            if (e.target.classList.contains('ned-saved-color')) {
              const col = e.target.getAttribute('data-color');
              picker.value = col;
              hex.value = col;
              picker.dispatchEvent(new Event('input', { bubbles: true }));
              picker.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        }
      }
    }
    
    if (p.type === 'file-text') {
      const fileInput = container.querySelector(`#${id}-file`);
      const textInput = container.querySelector(`#${id}`);
      if (fileInput && textInput) {
        fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            textInput.value = ev.target.result;
            // dispatch input event so changes save to recipe state automatically
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
          };
          reader.readAsText(file);
        });
      }
    }

    if (p.type === 'file') {
      const hiddenInput  = container.querySelector(`#${id}`);
      const fileInput    = container.querySelector(`#${id}-file`);
      const previewArea  = container.querySelector(`#${id}-preview-area`);
      const clearBtn     = container.querySelector(`#${id}-clear`);

      const setPreview = (dataUrl) => {
        if (!previewArea) return;
        if (dataUrl) {
          previewArea.innerHTML = `<img class="ned-file-thumb" id="${id}-thumb" src="${dataUrl}" alt="Preview">`;
          if (clearBtn) clearBtn.style.display = 'flex';
        } else {
          previewArea.innerHTML = `<div class="ned-file-empty" id="${id}-thumb"><span class="material-symbols-outlined">image</span><span>No image selected</span></div>`;
          if (clearBtn) clearBtn.style.display = 'none';
        }
      };

      if (fileInput && hiddenInput) {
        fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            hiddenInput.value = dataUrl;
            setPreview(dataUrl);
            hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
          };
          reader.readAsDataURL(file);
        });
      }

      if (clearBtn && hiddenInput) {
        clearBtn.addEventListener('click', () => {
          hiddenInput.value = '';
          if (fileInput) fileInput.value = '';
          setPreview(null);
          hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
    }

    // Variable-bind toggle button
    const btn = container.querySelector(`[data-var-bind="${id}"]`);
    if (btn) {
      btn.addEventListener('click', () => {
        const field = btn.closest('.ned-field');
        const isActive = btn.classList.contains('ned-var-bind-btn--active');

        if (isActive) {
          // Switch back to native widget — re-render this param at its default
          const defaultVal = p.defaultValue ?? '';
          const html = renderParamField(p, defaultVal, prefix, { showVarBind: true });
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          field.replaceWith(tmp.firstElementChild);
          // Re-wire events for the newly inserted field
          bindParamFieldEvents(container, [p], prefix, { getRecipeVars, getVarContext });
        } else {
          // Switch to variable mode — replace widget with text input
          const currentNativeEl = container.querySelector(`#${id}`);
          const currentVal = currentNativeEl?.value ?? '';
          const seed = currentVal && !isVarRef(currentVal) ? '{{recipe.' : (currentVal || '{{recipe.');
          const html = renderParamField(p, seed, prefix, { showVarBind: true });
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          field.replaceWith(tmp.firstElementChild);
          // Focus and position cursor after "{{recipe."
          const newInput = container.querySelector(`#${id}`);
          if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(newInput.value.length, newInput.value.length);
            // Wire autocomplete if recipe vars are available
            if (getRecipeVars) _wireVarAutocomplete(newInput, getRecipeVars);
          }
          // Re-wire toggle on the new element
          bindParamFieldEvents(container, [p], prefix, { getRecipeVars, getVarContext });
        }
      });

      // If already in variable mode on initial render, wire autocomplete
      if (btn.classList.contains('ned-var-bind-btn--active')) {
        const input = container.querySelector(`#${id}`);
        if (input && getRecipeVars) _wireVarAutocomplete(input, getRecipeVars);
      }
    }
  }

  // Handle dynamic template drop-downs asynchronously
  const templateSelects = container.querySelectorAll('.ic-template-select');
  const videoLayoutSelects = container.querySelectorAll('.ic-video-layout-select');

  if (templateSelects.length > 0 || videoLayoutSelects.length > 0) {
    import('../data/templates.js').then(({ getAllTemplates }) => {
      getAllTemplates().then(templates => {
        // Exclusive template selectors
        templateSelects.forEach(select => {
          const currentVal = select.dataset.value || select.value;
          let html = '<option value="">-- Select Template --</option>';
          templates.forEach(t => {
            html += `<option value="${t.id}" ${t.id === currentVal ? 'selected' : ''}>${escHtml(t.name)}</option>`;
          });
          select.innerHTML = html;
        });

        // Hybrid selectors (preserves existing defined options)
        videoLayoutSelects.forEach(select => {
          const currentVal = select.dataset.value || select.value;
          let html = select.innerHTML;
          if (templates.length > 0) {
              html += '<optgroup label="Templates">';
              templates.forEach(t => {
                html += `<option value="${t.id}" ${t.id === currentVal ? 'selected' : ''}>${escHtml(t.name)}</option>`;
              });
              html += '</optgroup>';
          }
          select.innerHTML = html;
          // After injecting, explicitly update the value just in case it wasn't statically matched
          if (currentVal) select.value = currentVal;
        });
      });
    });
  }

  // Handle device frame cascading selectors
  const familySelects = container.querySelectorAll('.ic-device-family-select');
  const modelSelects = container.querySelectorAll('.ic-device-model-select');
  const variantSelects = container.querySelectorAll('.ic-device-variant-select');

  if (familySelects.length > 0) {
    const MASTER_URL = 'https://raw.githubusercontent.com/jonnyjackson26/device-frames-media/main/device-frames-output/index.json';
    fetch(MASTER_URL).then(r => r.json()).then(data => {
      familySelects.forEach((fSel, idx) => {
        const mSel = modelSelects[idx];
        const vSel = variantSelects[idx];
        if (!mSel || !vSel) return;

        let fHTML = '<option value="">-- Family --</option>';
        Object.keys(data).forEach(fKey => {
           fHTML += `<option value="${fKey}">${escHtml(fKey)}</option>`;
        });
        fSel.innerHTML = fHTML;

        const updateModels = () => {
           const fVal = fSel.value;
           let mHTML = '<option value="">-- Model --</option>';
           if (fVal && data[fVal]) {
             Object.keys(data[fVal]).forEach(mKey => {
                mHTML += `<option value="${mKey}">${escHtml(mKey)}</option>`;
             });
           }
           mSel.innerHTML = mHTML;
           vSel.innerHTML = '<option value="">-- Color --</option>';
        };

        const updateVariants = () => {
           const fVal = fSel.value;
           const mVal = mSel.value;
           let vHTML = '<option value="">-- Color --</option>';
           if (fVal && mVal && data[fVal] && data[fVal][mVal]) {
              Object.keys(data[fVal][mVal]).forEach(vKey => {
                 vHTML += `<option value="${vKey}">${escHtml(vKey)}</option>`;
              });
           }
           vSel.innerHTML = vHTML;
        };

        fSel.addEventListener('change', () => { updateModels(); mSel.dispatchEvent(new Event('change')); });
        mSel.addEventListener('change', updateVariants);

        // Pre-fill initial selection if they exist in dataset
        const initFVal = fSel.dataset.value || fSel.value;
        const initMVal = mSel.dataset.value || mSel.value;
        const initVVal = vSel.dataset.value || vSel.value;
        
        if (initFVal) {
           fSel.value = initFVal;
           updateModels();
           if (initMVal) {
             mSel.value = initMVal;
             updateVariants();
             if (initVVal) {
               vSel.value = initVVal;
             }
           }
        }
      });
    }).catch(e => console.warn('[device-frames] Failed to load index.json', e));
  }

  // ── Wrap text-style overrides in a <details> block ──
  const tsSelect = container.querySelector('.ic-text-style-select');
  if (tsSelect) {
    const overrideFields = Array.from(container.querySelectorAll('.ic-text-override-field'));
    if (overrideFields.length > 0) {
      const wrapper = document.createElement('details');
      wrapper.className = 'ic-text-overrides-details';
      wrapper.style.cssText = 'background:var(--ps-bg-overlay); border:1px solid var(--ps-border); border-radius:8px; margin-top:8px; margin-bottom:8px;';
      wrapper.innerHTML = `
        <summary style="cursor:pointer; padding:8px 12px; font-size:12px; font-weight:600; color:var(--ps-text); display:flex; align-items:center; gap:6px;">
           <span class="material-symbols-outlined" style="font-size:16px;">tune</span> Style Overrides
        </summary>
        <div class="details-content" style="padding:12px; display:flex; flex-direction:column; gap:10px; border-top:1px solid var(--ps-border);"></div>
      `;
      const content = wrapper.querySelector('.details-content');
      overrideFields[0].parentNode.insertBefore(wrapper, overrideFields[0]);
      overrideFields.forEach(f => content.appendChild(f));

      // Handle visibility/state of overrides based on textStyle selection
      const updateOverrides = () => {
         const hasStyle = tsSelect.value && tsSelect.value !== 'none';
         if (hasStyle) {
            // Style selected: overrides are optional, hide them behind the accordion
            wrapper.style.display = 'block';
            // Enable checkboxes
            wrapper.querySelectorAll('.ic-text-override-toggle').forEach(chk => {
                chk.style.display = 'inline-block';
            });
         } else {
            // No style selected: all fields are mandatory, remove accordion wrap visually
            wrapper.style.display = 'block';
            wrapper.open = true; // force open
            // Hide checkboxes and force them checked so collectParams reads the value
            wrapper.querySelectorAll('.ic-text-override-toggle').forEach(chk => {
                chk.style.display = 'none';
                chk.checked = true;
                // Dispatch change so styles update
                chk.dispatchEvent(new Event('change', { bubbles: true }));
            });
         }
      };

      tsSelect.addEventListener('change', updateOverrides);

      // Handle checkbox toggles to dim/disable inputs
      wrapper.querySelectorAll('.ic-text-override-toggle').forEach(chk => {
          const targetName = chk.dataset.target;
          const targetField = wrapper.querySelector(`[name="${targetName}"]`);
          const targetEl = targetField ? targetField.closest('.ned-field') : null;
          
          const updateFieldState = () => {
              if (targetEl) {
                  const label = targetEl.querySelector('.ned-field-label');
                  // we don't want to dim the checkbox itself, so we dim the elements after the label, or just the input
                  const inputs = Array.from(targetEl.children).filter(c => c !== label);
                  inputs.forEach(input => {
                      input.style.opacity = chk.checked ? '1' : '0.5';
                      input.style.pointerEvents = chk.checked ? 'auto' : 'none';
                  });
              }
          };
          chk.addEventListener('change', updateFieldState);
          updateFieldState();
      });

      // Call initial update
      updateOverrides();
    }
  }
}

/**
 * Wire a lightweight autocomplete dropdown to a variable-mode text input.
 * Shows matching recipe variable names as the user types after "{{recipe.",
 * and sidecar field names after "{{sidecar.".
 */
function _wireVarAutocomplete(input, getRecipeVars) {
  let dropdown = null;

  function removeDropdown() {
    if (dropdown) { dropdown.remove(); dropdown = null; }
  }

  function showDropdown(items, onSelect) {
    removeDropdown();
    if (!items.length) return;
    dropdown = document.createElement('div');
    dropdown.className = 'ned-var-autocomplete';
    dropdown.style.cssText = `
      position:absolute; z-index:9999; background:var(--ps-bg-panel,#1a1a2e);
      border:1px solid var(--ps-blue); border-radius:6px; overflow:hidden;
      box-shadow:0 4px 12px rgba(0,0,0,.4); min-width:200px; max-height:200px; overflow-y:auto;
    `;
    for (const v of items) {
      const item = document.createElement('div');
      item.textContent = v;
      item.style.cssText = 'padding:6px 10px;cursor:pointer;font-size:12px;font-family:var(--font-mono);';
      item.addEventListener('mouseenter', () => { item.style.background = 'var(--ps-blue)'; item.style.color = '#fff'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; item.style.color = ''; });
      item.addEventListener('mousedown', (e) => { e.preventDefault(); onSelect(v); removeDropdown(); });
      dropdown.appendChild(item);
    }
    const rect = input.getBoundingClientRect();
    dropdown.style.top  = `${rect.bottom + window.scrollY + 2}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    document.body.appendChild(dropdown);
  }

  input.addEventListener('input', async () => {
    removeDropdown();
    const val = input.value;

    // ── {{recipe.* autocomplete ──────────────────────────────
    const recipeMatch = val.match(/\{\{recipe\.([^}]*)$/);
    if (recipeMatch) {
      const typed = recipeMatch[1].toLowerCase();
      const vars = (getRecipeVars() || []).filter(v => v.toLowerCase().includes(typed));
      showDropdown(vars, v => {
        input.value = val.replace(/\{\{recipe\.[^}]*$/, `{{recipe.${v}}}`);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return;
    }

    // ── {{sidecar.* autocomplete ─────────────────────────────
    const sidecarMatch = val.match(/\{\{sidecar\.([^}]*)$/);
    if (sidecarMatch) {
      const typed = sidecarMatch[1].toLowerCase();
      // Import SIDECAR_SCHEMA_KEYS lazily so param-fields has no hard dep on sidecar.js
      const { SIDECAR_SCHEMA_KEYS } = await import('../data/sidecar.js');
      const hits = SIDECAR_SCHEMA_KEYS
        .filter(k => k.replace('sidecar.', '').toLowerCase().includes(typed));
      showDropdown(hits, fullKey => {
        input.value = val.replace(/\{\{sidecar\.[^}]*$/, `{{${fullKey}}}`);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return;
    }
  });

  input.addEventListener('blur', () => setTimeout(removeDropdown, 150));
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') removeDropdown(); });
}
