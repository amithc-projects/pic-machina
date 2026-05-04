/**
 * PicMachina — Time Range Strip Component (Phase 6)
 *
 * Renders an interactive time-range editor for video-effect nodes in NED.
 * Includes mode toggle (Standard/Freeze), numeric fields, easing selector,
 * and a visual timeline bar with filmstrip background and draggable handles.
 */

import { extractVideoFilmstrip } from './video-frame.js';

// ── HTML ─────────────────────────────────────────────────────────────────────

/**
 * Build the HTML for the time-range section in the NED params panel.
 * @param {object} node       Recipe node (may have node.timeRange)
 * @param {object} def        Transform definition (has def.strengthParam)
 */
export function renderTimeRangeSection(node, def) {
  const tr = node.timeRange || {};
  const enabled  = !!node.timeRange;
  const mode     = tr.mode || 'standard';
  const start    = tr.start ?? 0;
  const end      = tr.end ?? 4;
  const insertDur = tr.insertDuration ?? 2;
  const fadeIn   = tr.fadeIn ?? 0;
  const fadeOut  = tr.fadeOut ?? 0;
  const easing   = tr.easing || 'linear';
  const strengthLabel = def.strengthParam
    ? (def.params || []).find(p => p.name === def.strengthParam)?.label || def.strengthParam
    : '(binary on/off)';

  return `
    <div class="ned-section-title" style="margin-top:16px">
      <span class="material-symbols-outlined" style="font-size:14px">timeline</span>
      Time Range
    </div>
    <div class="ned-fields">
      <div class="ned-field">
        <label class="ned-field-label">Enable Time Range</label>
        <label class="ned-toggle">
          <input type="checkbox" id="ned-tr-enabled" ${enabled ? 'checked' : ''}>
          <span class="ned-toggle-track"></span>
        </label>
      </div>

      <div id="ned-tr-controls" style="display:${enabled ? 'flex' : 'none'};flex-direction:column;gap:10px">
        <!-- Mode -->
        <div class="ned-field">
          <label class="ned-field-label">Mode</label>
          <select id="ned-tr-mode" class="ic-input">
            <option value="standard" ${mode === 'standard' ? 'selected' : ''}>Standard — modulate existing frames</option>
            <option value="freeze" ${mode === 'freeze' ? 'selected' : ''}>Freeze — insert new frames</option>
          </select>
        </div>

        <!-- Standard fields -->
        <div id="ned-tr-standard-fields" style="display:${mode === 'standard' ? 'flex' : 'none'};flex-direction:column;gap:10px">
          <div class="ned-field">
            <label class="ned-field-label">Start (s)</label>
            <input type="number" id="ned-tr-start" class="ic-input" value="${start}" min="0" step="0.1">
          </div>
          <div class="ned-field">
            <label class="ned-field-label">End (s)</label>
            <input type="number" id="ned-tr-end" class="ic-input" value="${end}" min="0" step="0.1">
          </div>
        </div>

        <!-- Freeze fields -->
        <div id="ned-tr-freeze-fields" style="display:${mode === 'freeze' ? 'flex' : 'none'};flex-direction:column;gap:10px">
          <div class="ned-field">
            <label class="ned-field-label">Capture Frame At (s)</label>
            <input type="number" id="ned-tr-freeze-at" class="ic-input" value="${start}" min="0" step="0.1">
          </div>
          <div class="ned-field">
            <label class="ned-field-label">Insert Duration (s)</label>
            <input type="number" id="ned-tr-insert-dur" class="ic-input" value="${insertDur}" min="0.1" step="0.1">
          </div>
        </div>

        <!-- Fade / Easing -->
        <div class="ned-field">
          <label class="ned-field-label">Fade In (s)</label>
          <input type="number" id="ned-tr-fade-in" class="ic-input" value="${fadeIn}" min="0" step="0.1">
        </div>
        <div class="ned-field">
          <label class="ned-field-label">Fade Out (s)</label>
          <input type="number" id="ned-tr-fade-out" class="ic-input" value="${fadeOut}" min="0" step="0.1">
        </div>
        <div class="ned-field">
          <label class="ned-field-label">Easing</label>
          <select id="ned-tr-easing" class="ic-input">
            <option value="linear"   ${easing === 'linear'   ? 'selected' : ''}>Linear</option>
            <option value="ease-in"  ${easing === 'ease-in'  ? 'selected' : ''}>Ease In (accelerate)</option>
            <option value="ease-out" ${easing === 'ease-out' ? 'selected' : ''}>Ease Out (decelerate)</option>
          </select>
        </div>

        <!-- Animated param badge -->
        <div class="ned-field" style="opacity:0.65">
          <label class="ned-field-label">Animated Parameter</label>
          <span class="ned-tr-badge">${strengthLabel}</span>
        </div>

        <!-- Visual timeline strip -->
        <div class="ned-tr-strip-wrapper">
          <div class="ned-tr-strip" id="ned-tr-strip">
            <div class="ned-tr-strip-filmstrip" id="ned-tr-filmstrip"></div>
            <div class="ned-tr-strip-overlay" id="ned-tr-overlay"></div>
            <div class="ned-tr-handle ned-tr-handle-start" id="ned-tr-handle-start" title="Drag to set start"></div>
            <div class="ned-tr-handle ned-tr-handle-end"   id="ned-tr-handle-end"   title="Drag to set end"></div>
          </div>
          <div class="ned-tr-strip-labels" id="ned-tr-strip-labels">
            <span>0s</span>
            <span id="ned-tr-dur-label">—</span>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Binding ──────────────────────────────────────────────────────────────────

/**
 * Wire up event listeners for the time-range controls.
 * Call this after the HTML is in the DOM.
 *
 * @param {HTMLElement} container   NED screen container
 * @param {object} node            Recipe node (mutated in place)
 * @param {object} def             Transform definition
 * @param {{ onChange?: Function }} opts
 * @returns {{ loadFilmstrip: (file: File) => Promise<void>, destroy: () => void }}
 */
export function bindTimeRangeControls(container, node, def, { onChange } = {}) {
  const $ = (sel) => container.querySelector(sel);

  const enabledCb   = $('#ned-tr-enabled');
  const controlsDiv = $('#ned-tr-controls');
  const modeSelect  = $('#ned-tr-mode');
  const stdFields   = $('#ned-tr-standard-fields');
  const freezeFields = $('#ned-tr-freeze-fields');
  const startInput  = $('#ned-tr-start');
  const endInput    = $('#ned-tr-end');
  const freezeAt    = $('#ned-tr-freeze-at');
  const insertDur   = $('#ned-tr-insert-dur');
  const fadeInInput = $('#ned-tr-fade-in');
  const fadeOutInput = $('#ned-tr-fade-out');
  const easingSelect = $('#ned-tr-easing');
  const strip       = $('#ned-tr-strip');
  const overlay     = $('#ned-tr-overlay');
  const handleStart = $('#ned-tr-handle-start');
  const handleEnd   = $('#ned-tr-handle-end');
  const filmstripEl = $('#ned-tr-filmstrip');
  const durLabel    = $('#ned-tr-dur-label');

  if (!enabledCb) return { loadFilmstrip: async () => {}, destroy: () => {} };

  let videoDuration = 10; // default until filmstrip loaded
  let filmstripUrls = [];

  // ── Collect timeRange from inputs ──
  function collectTimeRange() {
    if (!enabledCb.checked) {
      node.timeRange = undefined;
      return;
    }
    const mode = modeSelect.value;
    node.timeRange = {
      mode,
      start:          mode === 'freeze' ? parseFloat(freezeAt.value) || 0 : parseFloat(startInput.value) || 0,
      end:            mode === 'standard' ? parseFloat(endInput.value) || 4 : null,
      insertDuration: mode === 'freeze' ? parseFloat(insertDur.value) || 2 : undefined,
      fadeIn:         parseFloat(fadeInInput.value) || 0,
      fadeOut:        parseFloat(fadeOutInput.value) || 0,
      easing:         easingSelect.value,
    };
  }

  // ── Redraw the visual strip overlay ──
  function redrawStrip() {
    if (!strip || !overlay) return;
    const tr = node.timeRange;
    if (!tr) {
      overlay.style.display = 'none';
      handleStart.style.display = 'none';
      handleEnd.style.display = 'none';
      return;
    }
    overlay.style.display = '';
    handleStart.style.display = '';
    handleEnd.style.display = '';

    const W = strip.clientWidth;
    if (W <= 0) return;

    if (tr.mode === 'standard') {
      const s = Math.max(0, tr.start || 0);
      const e = Math.min(videoDuration, tr.end ?? videoDuration);
      const fi = tr.fadeIn || 0;
      const fo = tr.fadeOut || 0;

      const xS = (s / videoDuration) * W;
      const xE = (e / videoDuration) * W;
      const xFI = ((s + fi) / videoDuration) * W;
      const xFO = ((e - fo) / videoDuration) * W;

      overlay.style.left  = `${xS}px`;
      overlay.style.width = `${xE - xS}px`;

      // Gradient showing fade envelope
      const relFI = fi > 0 ? (fi / (e - s)) * 100 : 0;
      const relFO = fo > 0 ? (1 - fo / (e - s)) * 100 : 100;
      overlay.style.background = `linear-gradient(to right,
        rgba(59,130,246,0.1) 0%,
        rgba(59,130,246,0.5) ${relFI}%,
        rgba(59,130,246,0.5) ${relFO}%,
        rgba(59,130,246,0.1) 100%
      )`;

      handleStart.style.left = `${xS - 4}px`;
      handleEnd.style.left   = `${xE - 4}px`;
    } else {
      // Freeze: show the capture point as a pin and insert duration as a block
      const s = Math.max(0, tr.start || 0);
      const xS = (s / videoDuration) * W;
      const insertW = ((tr.insertDuration || 2) / videoDuration) * W;

      overlay.style.left  = `${xS}px`;
      overlay.style.width = `${Math.min(insertW, W - xS)}px`;
      overlay.style.background = 'repeating-linear-gradient(45deg, rgba(251,146,60,0.3), rgba(251,146,60,0.3) 4px, rgba(251,146,60,0.15) 4px, rgba(251,146,60,0.15) 8px)';

      handleStart.style.left = `${xS - 4}px`;
      handleEnd.style.display = 'none';
    }
  }

  // ── Handle dragging ──
  function setupDrag(handle, getVal, setVal) {
    let dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = strip.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const t = (x / rect.width) * videoDuration;
      setVal(Math.round(t * 10) / 10);
      collectTimeRange();
      redrawStrip();
      onChange?.();
    });
    handle.addEventListener('pointerup', () => { dragging = false; });
  }

  if (handleStart && strip) {
    setupDrag(handleStart,
      () => parseFloat(startInput.value) || 0,
      (v) => {
        if (modeSelect.value === 'freeze') freezeAt.value = v;
        else startInput.value = v;
      }
    );
  }
  if (handleEnd && strip) {
    setupDrag(handleEnd,
      () => parseFloat(endInput.value) || 4,
      (v) => { endInput.value = v; }
    );
  }

  // ── Wire inputs ──
  function onInput() {
    collectTimeRange();
    redrawStrip();
    onChange?.();
  }

  enabledCb.addEventListener('change', () => {
    controlsDiv.style.display = enabledCb.checked ? 'flex' : 'none';
    onInput();
  });

  modeSelect.addEventListener('change', () => {
    stdFields.style.display    = modeSelect.value === 'standard' ? 'flex' : 'none';
    freezeFields.style.display = modeSelect.value === 'freeze'   ? 'flex' : 'none';
    onInput();
  });

  [startInput, endInput, freezeAt, insertDur, fadeInInput, fadeOutInput, easingSelect].forEach(el => {
    el?.addEventListener('change', onInput);
    el?.addEventListener('input',  onInput);
  });

  // ── Filmstrip loading ──
  async function loadFilmstrip(file) {
    if (!file || !filmstripEl) return;
    try {
      const { urls, duration } = await extractVideoFilmstrip(file, 8, 48);
      filmstripUrls = urls;
      videoDuration = duration;
      if (durLabel) durLabel.textContent = `${duration.toFixed(1)}s`;

      // Render filmstrip as horizontal images
      filmstripEl.innerHTML = urls.map(u =>
        `<img src="${u}" style="height:100%;flex-shrink:0;object-fit:cover">`
      ).join('');

      redrawStrip();
    } catch { /* ignore */ }
  }

  function destroy() {
    filmstripUrls = [];
  }

  // Initial strip draw
  redrawStrip();

  return { loadFilmstrip, destroy };
}

// ── Styles ───────────────────────────────────────────────────────────────────

let _injected = false;
export function injectTimeRangeStyles() {
  if (_injected) return;
  _injected = true;
  const s = document.createElement('style');
  s.textContent = `
    .ned-tr-badge {
      display:inline-block; padding:3px 8px; border-radius:4px;
      font-size:11px; font-weight:500;
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      color:var(--ps-text-muted);
    }

    .ned-tr-strip-wrapper { margin-top:4px; }
    .ned-tr-strip {
      position:relative; height:48px; border-radius:6px; overflow:hidden;
      background:var(--ps-bg-app); border:1px solid var(--ps-border);
      cursor:crosshair; user-select:none;
    }
    .ned-tr-strip-filmstrip {
      position:absolute; inset:0; display:flex; overflow:hidden;
      opacity:0.5; pointer-events:none;
    }
    .ned-tr-strip-filmstrip img { height:100%; flex-shrink:0; object-fit:cover; }
    .ned-tr-strip-overlay {
      position:absolute; top:0; bottom:0;
      border-radius:3px; pointer-events:none;
      border:1px solid rgba(59,130,246,0.6);
      transition:left 80ms, width 80ms;
    }
    .ned-tr-handle {
      position:absolute; top:0; bottom:0; width:8px; cursor:ew-resize;
      background:rgba(59,130,246,0.7); border-radius:2px;
      z-index:2; touch-action:none;
      transition:left 80ms;
    }
    .ned-tr-handle:hover, .ned-tr-handle:active { background:rgba(59,130,246,1); }
    .ned-tr-strip-labels {
      display:flex; justify-content:space-between; padding:2px 2px 0;
      font-size:10px; color:var(--ps-text-faint);
    }
  `;
  document.head.appendChild(s);
}
