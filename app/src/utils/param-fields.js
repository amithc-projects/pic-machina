/**
 * PicMachina — Shared param field renderer
 *
 * Provides renderParamField() and collectParams() for rendering
 * typed form fields from a param definition array.
 * Used by: ned.js (node editor), set.js (run-params dialog), bld.js (recipe params editor).
 */

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Render a single param field as an HTML string.
 * @param {object} param     — { name, label, type, defaultValue, min, max, step, options }
 * @param {*}      value     — current value (falls back to defaultValue)
 * @param {string} [prefix]  — DOM id prefix (default 'rp')
 */
export function renderParamField(param, value, prefix = 'rp') {
  const id  = `${prefix}-param-${param.name}`;
  const val = value ?? param.defaultValue ?? '';

  switch (param.type) {
    case 'boolean':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${escHtml(param.label)}</label>
          <label class="ned-toggle">
            <input type="checkbox" id="${id}" name="${param.name}" ${val ? 'checked' : ''}>
            <span class="ned-toggle-track"></span>
          </label>
        </div>`;

    case 'template-select':
    case 'select':
      const selClass = param.type === 'template-select' ? 'ic-input ic-template-select' : 'ic-input';
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${escHtml(param.label)}</label>
          <select id="${id}" name="${param.name}" class="${selClass}" data-value="${escHtml(String(val))}">
            ${(param.options || []).map(opt =>
              `<option value="${escHtml(opt.value)}" ${opt.value == val ? 'selected' : ''}>${escHtml(opt.label)}</option>`
            ).join('')}
          </select>
        </div>`;

    case 'range':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${escHtml(param.label)}
            <span id="${id}-val" class="mono text-sm" style="margin-left:auto;color:var(--ps-blue)">${val}</span>
          </label>
          <input type="range" id="${id}" name="${param.name}" class="ic-range"
            min="${param.min ?? 0}" max="${param.max ?? 100}" step="${param.step ?? 1}" value="${val}">
        </div>`;

    case 'color':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${escHtml(param.label)}</label>
          <div class="ned-color-row">
            <input type="color" id="${id}" name="${param.name}" value="${val}" class="ned-color-input">
            <input type="text" id="${id}-hex" class="ic-input" value="${val}" maxlength="7"
              style="flex:1;font-family:var(--font-mono);font-size:12px">
          </div>
        </div>`;

    case 'number':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${escHtml(param.label)}</label>
          <input type="number" id="${id}" name="${param.name}" class="ic-input"
            value="${val}" ${param.min != null ? `min="${param.min}"` : ''} ${param.max != null ? `max="${param.max}"` : ''}
            ${param.step != null ? `step="${param.step}"` : ''}>
        </div>`;

    case 'textarea':
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${escHtml(param.label)}</label>
          <textarea id="${id}" name="${param.name}" class="ic-input" rows="4">${escHtml(String(val))}</textarea>
        </div>`;

    default: // 'text'
      return `
        <div class="ned-field">
          <label class="ned-field-label" for="${id}">${escHtml(param.label)}</label>
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
  for (const p of paramDefs) {
    const id = `${prefix}-param-${p.name}`;
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
  `;
  document.head.appendChild(s);
}

/**
 * Wire up live interactions for rendered fields (range value display, color sync).
 * Call after inserting the rendered HTML into the DOM.
 * @param {Element} container
 * @param {object[]} paramDefs
 * @param {string} [prefix]
 */
export function bindParamFieldEvents(container, paramDefs, prefix = 'rp') {
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
      if (picker && hex) {
        picker.addEventListener('input', () => { hex.value = picker.value; });
        hex.addEventListener('input',   () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) picker.value = hex.value; });
      }
    }
  }

  // Handle dynamic template drop-downs asynchronously
  const templateSelects = container.querySelectorAll('.ic-template-select');
  if (templateSelects.length > 0) {
    import('../data/templates.js').then(({ getAllTemplates }) => {
      getAllTemplates().then(templates => {
        templateSelects.forEach(select => {
          const currentVal = select.dataset.value || select.value;
          let html = '<option value="">-- Select Template --</option>';
          templates.forEach(t => {
            html += `<option value="${t.id}" ${t.id === currentVal ? 'selected' : ''}>${escHtml(t.name)}</option>`;
          });
          select.innerHTML = html;
        });
      });
    });
  }
}
