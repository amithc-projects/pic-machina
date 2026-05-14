/**
 * ImageChef — QUE: Processing Queue
 */

import { navigate } from '../main.js';
import { showConfirm } from '../utils/dialogs.js';

export function render(container) {
  container.innerHTML = `
    <div class="screen que-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">pending_actions</span>
          Processing Queue
        </div>
        <div class="flex items-center gap-2">
          <span id="que-status-badge" class="ic-badge ic-badge--blue">
            <span class="material-symbols-outlined" style="font-size:13px;animation:spin 1s linear infinite">refresh</span>
            Waiting…
          </span>
          <button class="btn-danger" id="btn-cancel-batch">
            <span class="material-symbols-outlined">stop</span>
            Cancel
          </button>
        </div>
      </div>

      <div class="que-body">
        <div class="que-progress-panel">
          <div class="que-progress-ring-wrap">
            <svg class="que-ring" viewBox="0 0 200 200">
              <circle class="que-ring-track" cx="100" cy="100" r="80"/>
              <circle class="que-ring-fill"  cx="100" cy="100" r="80" id="que-ring-arc"/>
            </svg>
            <div class="que-ring-center">
              <div class="que-percent" id="que-percent">0%</div>
              <div class="que-ring-label" id="que-ring-label">Starting</div>
            </div>
          </div>
          <div class="que-stats">
            <div class="que-stat"><div class="que-stat-value" id="que-processed">0</div><div class="que-stat-label">Done</div></div>
            <div class="que-stat"><div class="que-stat-value" id="que-total">—</div><div class="que-stat-label">Total</div></div>
            <div class="que-stat"><div class="que-stat-value" style="color:var(--ps-success)" id="que-success">0</div><div class="que-stat-label">OK</div></div>
            <div class="que-stat"><div class="que-stat-value" style="color:var(--ps-danger)" id="que-fail">0</div><div class="que-stat-label">Failed</div></div>
          </div>
          <div class="que-current-file mono text-sm text-muted" id="que-current-file">—</div>
          <div style="margin-top:16px;width:100%;height:4px;border-radius:2px;overflow:hidden;background:var(--ps-bg-overlay)">
            <div id="que-progress-bar" style="height:4px;background:var(--ps-blue);width:0%;transition:width 300ms ease;border-radius:2px;"></div>
          </div>
          <div id="que-footer-actions" style="margin-top:24px;width:100%;"></div>
        </div>

        <div class="que-log-panel">
          <div class="panel-header">
            <span class="panel-header-title">Execution Log</span>
            <div class="flex items-center gap-2">
              <span id="que-elapsed" class="mono text-sm text-muted">00:00</span>
              <button class="btn-ghost" id="btn-clear-log" title="Clear log">
                <span class="material-symbols-outlined">delete_sweep</span>
              </button>
            </div>
          </div>
          <div class="terminal" id="que-terminal" style="flex:1;border-radius:0;border:none;border-top:1px solid var(--ps-border);font-size:11.5px;height:0;">
            <div class="terminal-line--muted">[PicMachina] Ready — waiting for batch…</div>
          </div>
        </div>
      </div>
    </div>`;

  injectStyles();

  const terminal    = container.querySelector('#que-terminal');
  const percent     = container.querySelector('#que-percent');
  const ringArc     = container.querySelector('#que-ring-arc');
  const ringLabel   = container.querySelector('#que-ring-label');
  const statProc    = container.querySelector('#que-processed');
  const statTotal   = container.querySelector('#que-total');
  const statOK      = container.querySelector('#que-success');
  const statFail    = container.querySelector('#que-fail');
  const currentFile = container.querySelector('#que-current-file');
  const progressBar = container.querySelector('#que-progress-bar');
  const statusBadge = container.querySelector('#que-status-badge');
  const elapsedEl   = container.querySelector('#que-elapsed');
  const footerActs  = container.querySelector('#que-footer-actions');

  let successCount = 0, failCount = 0;
  let startTime = null, elapsedTimer = null;

  const CIRC = 2 * Math.PI * 80;
  ringArc.style.strokeDasharray  = CIRC;
  ringArc.style.strokeDashoffset = CIRC;

  function setProgress(done, total, overridePct = null) {
    const pct = overridePct !== null ? overridePct : (total > 0 ? Math.round(done / total * 100) : 0);
    percent.textContent = pct + '%';
    ringArc.style.strokeDashoffset = CIRC - (CIRC * pct / 100);
    progressBar.style.width = pct + '%';
    statProc.textContent = done;
    if (total) statTotal.textContent = total;
  }

  function appendLog(level, msg) {
    const div = document.createElement('div');
    const cls = level === 'ok' ? 'ok' : level === 'error' ? 'error' : level === 'warn' ? 'warn' : level === 'info' ? 'info' : 'muted';
    div.className = 'terminal-line--' + cls;
    const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
    div.textContent = '[' + ts + '] ' + msg;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
  }

  function startElapsedTimer() {
    startTime = Date.now();
    elapsedTimer = setInterval(() => {
      const s = Math.floor((Date.now() - startTime) / 1000);
      elapsedEl.textContent = String(Math.floor(s / 60)).padStart(2,'0') + ':' + String(s % 60).padStart(2,'0');
    }, 1000);
  }

  window._queProgress = (processed, total, filename, overridePct = null) => {
    if (!startTime) startElapsedTimer();
    setProgress(processed, total, overridePct);
    currentFile.textContent = filename;
    ringLabel.textContent = 'Processing';
  };

  window._queLog = (level, msg) => {
    appendLog(level, msg);
    if (level === 'error') { failCount++; statFail.textContent = failCount; }
    else if (level === 'ok' && msg.includes('succeeded')) {
      const m = msg.match(/(\d+) succeeded/);
      if (m) { successCount = parseInt(m[1]); statOK.textContent = successCount; }
    }
  };

  window._queComplete = (run) => {
    clearInterval(elapsedTimer);
    setProgress(run.imageCount, run.imageCount);
    ringLabel.textContent = 'Complete';
    statusBadge.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px">check_circle</span> Done';
    statusBadge.className = 'ic-badge ic-badge--green';
    appendLog('ok', 'Batch complete — ' + run.successCount + ' succeeded, ' + run.failCount + ' failed');
    currentFile.textContent = 'All done';
    const cancelBtn = container.querySelector('#btn-cancel-batch');
    if (cancelBtn) {
      cancelBtn.innerHTML = '<span class="material-symbols-outlined">library_books</span> Library';
      cancelBtn.className = 'btn-secondary';
      cancelBtn.id = 'btn-que-library';
      cancelBtn.addEventListener('click', () => navigate('#lib'));
    }

    if (window._queRunAgain) {
      const runAgainBtn = document.createElement('button');
      runAgainBtn.className = 'btn-secondary';
      runAgainBtn.style.cssText = 'width:100%;justify-content:center;margin-bottom:8px;border-color:var(--ps-blue);color:var(--ps-blue);';
      runAgainBtn.innerHTML = '<span class="material-symbols-outlined">replay</span> Run Again';
      runAgainBtn.addEventListener('click', () => {
        footerActs.innerHTML = '';
        terminal.innerHTML = '';
        appendLog('info', 'Executing "Run Again" using previous batch configuration...');
        statOK.textContent = '0';
        statFail.textContent = '0';
        successCount = 0;
        failCount = 0;
        startTime = null;
        elapsedEl.textContent = '00:00';
        setProgress(0, 100);
        window._queRunAgain();
      });
      footerActs.appendChild(runAgainBtn);
    }

    const browseBtn = document.createElement('button');
    browseBtn.className = 'btn-primary';
    browseBtn.style.cssText = 'width:100%;justify-content:center;margin-bottom:8px';
    browseBtn.innerHTML = '<span class="material-symbols-outlined">folder_open</span> Browse Output';
    browseBtn.addEventListener('click', () => navigate('#fld?run=' + run.id + '&from=que'));
    footerActs.appendChild(browseBtn);

    const histBtn = document.createElement('button');
    histBtn.className = 'btn-secondary';
    histBtn.style.cssText = 'width:100%;justify-content:center';
    histBtn.innerHTML = '<span class="material-symbols-outlined">history</span> View Run History';
    histBtn.addEventListener('click', () => navigate('#out?run=' + run.id));
    footerActs.appendChild(histBtn);
  };

  window._queError = (msg) => {
    clearInterval(elapsedTimer);
    statusBadge.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px">error</span> Error';
    statusBadge.className = 'ic-badge ic-badge--red';
    appendLog('error', 'FATAL: ' + msg);
  };

  window._queInteractiveYield = (nodeId, snapshotCanvas) => {
    return new Promise((resolve) => {
      appendLog('warn', `Recipe paused. Waiting for user interaction...`);
      statusBadge.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;animation:pulse 2s infinite">pan_tool</span> Yielded';
      statusBadge.className = 'ic-badge ic-badge--amber';

      const modal = document.createElement('dialog');
      modal.className = 'modal';
      modal.style.display = 'flex';
      modal.style.flexDirection = 'column';
      modal.style.maxWidth = '90vw';
      modal.style.maxHeight = '90vh';
      modal.style.width = '800px';

      modal.innerHTML = `
        <div class="modal__header">
          <h2 class="modal__title">Interactive Eraser</h2>
        </div>
        <div class="modal__body" style="flex:1; display:flex; flex-direction:column; align-items:center; gap:16px; background:#1e1e1e;">
          <p style="color:var(--ps-text-muted); font-size:13px; margin:0;">Draw over the object you want to erase, then click Confirm.</p>
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="color:var(--ps-text-muted); font-size:12px;">Brush Size:</label>
            <input type="range" id="yield-brush-size" min="5" max="100" value="30" style="width:150px;">
          </div>
          <div style="position:relative; border:1px solid var(--ps-border); border-radius:4px; overflow:hidden;">
            <canvas id="yield-bg-canvas" style="display:block; max-width:100%; max-height:55vh;"></canvas>
            <canvas id="yield-draw-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; cursor:crosshair;"></canvas>
          </div>
        </div>
        <div class="modal__footer" style="justify-content:flex-end;">
          <button class="btn-primary" id="btn-yield-confirm">Confirm Mask</button>
        </div>
      `;

      document.body.appendChild(modal);
      modal.showModal();

      const bgCanvas = modal.querySelector('#yield-bg-canvas');
      const drawCanvas = modal.querySelector('#yield-draw-canvas');
      const brushSlider = modal.querySelector('#yield-brush-size');
      
      // Calculate aspect-correct display size
      const maxW = window.innerWidth * 0.8;
      const maxH = window.innerHeight * 0.55;
      let w = snapshotCanvas.width;
      let h = snapshotCanvas.height;
      if (w > maxW) { h = h * (maxW / w); w = maxW; }
      if (h > maxH) { w = w * (maxH / h); h = maxH; }
      
      bgCanvas.width = snapshotCanvas.width;
      bgCanvas.height = snapshotCanvas.height;
      bgCanvas.style.width = `${w}px`;
      bgCanvas.style.height = `${h}px`;
      bgCanvas.getContext('2d').drawImage(snapshotCanvas, 0, 0);

      drawCanvas.width = snapshotCanvas.width;
      drawCanvas.height = snapshotCanvas.height;
      drawCanvas.style.width = `${w}px`;
      drawCanvas.style.height = `${h}px`;

      const ctx = drawCanvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      
      const updateBrushSize = () => {
        // Scale the brush size relative to the actual canvas resolution vs screen display size
        const scale = drawCanvas.width / w;
        ctx.lineWidth = parseInt(brushSlider.value, 10) * scale;
      };
      brushSlider.addEventListener('input', updateBrushSize);
      updateBrushSize();

      let isDrawing = false;
      let lastX = 0, lastY = 0;

      const getCoords = (e) => {
        const rect = drawCanvas.getBoundingClientRect();
        const scaleX = drawCanvas.width / rect.width;
        const scaleY = drawCanvas.height / rect.height;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
        };
      };

      drawCanvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const { x, y } = getCoords(e);
        lastX = x; lastY = y;
        ctx.beginPath();
        ctx.moveTo(x, y);
      });

      drawCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
      });

      drawCanvas.addEventListener('mouseup', () => {
        isDrawing = false;
      });
      drawCanvas.addEventListener('mouseleave', () => {
        isDrawing = false;
      });

      modal.querySelector('#btn-yield-confirm').addEventListener('click', (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Processing...';
        btn.style.opacity = '0.7';
        
        // Give the browser a moment to repaint the button state before blocking the main thread
        setTimeout(() => {
          // Create a binary mask (white on black)
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = snapshotCanvas.width;
          maskCanvas.height = snapshotCanvas.height;
          const mCtx = maskCanvas.getContext('2d');
          mCtx.fillStyle = '#000';
          mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
          
          // Draw the user's strokes in solid white
          mCtx.drawImage(drawCanvas, 0, 0);
          const imgData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
          for (let i = 0; i < imgData.data.length; i += 4) {
            if (imgData.data[i] > 50) { // If there's any red drawn
              imgData.data[i] = 255;
              imgData.data[i+1] = 255;
              imgData.data[i+2] = 255;
              imgData.data[i+3] = 255;
            }
          }
          mCtx.putImageData(imgData, 0, 0);

          modal.remove();
          
          // Reset status
          statusBadge.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;animation:spin 1s linear infinite">refresh</span> Processing';
          statusBadge.className = 'ic-badge ic-badge--blue';
          appendLog('ok', `Mask received, resuming recipe...`);
          
          resolve(maskCanvas);
        }, 50);
      });
    });
  };

  container.querySelector('#btn-cancel-batch')?.addEventListener('click', async () => {
    const ctrl = window._queRunControl;
    if (ctrl) {
      const confirmed = await showConfirm({
        title: 'Cancel Batch?',
        body: 'Are you sure you want to stop processing? Images already completed will be preserved.',
        confirmText: 'Stop Batch',
        variant: 'danger',
        icon: 'cancel'
      });
      if (!confirmed) return;

      await ctrl.cancel();
      clearInterval(elapsedTimer);
      appendLog('warn', 'Cancelled by user.');
      statusBadge.textContent = 'Cancelled';
      statusBadge.className = 'ic-badge ic-badge--amber';
    } else {
      // No active batch (error state or batch never started) — go back to setup
      navigate('#set');
    }
  });

  container.querySelector('#btn-clear-log')?.addEventListener('click', () => { terminal.innerHTML = ''; });

  return () => {
    clearInterval(elapsedTimer);
    delete window._queProgress;
    delete window._queLog;
    delete window._queComplete;
    delete window._queError;
  };
}

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return; _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    .que-screen { display:flex; flex-direction:column; height:100%; }
    .que-body { display:flex; flex:1; overflow:hidden; }
    .que-progress-panel {
      width:300px; min-width:300px; border-right:1px solid var(--ps-border);
      background:var(--ps-bg-surface); padding:28px 20px;
      display:flex; flex-direction:column; align-items:center; overflow-y:auto;
    }
    .que-progress-ring-wrap { position:relative; width:180px; height:180px; margin-bottom:20px; }
    .que-ring { width:180px; height:180px; transform:rotate(-90deg); }
    .que-ring-track { fill:none; stroke:var(--ps-bg-overlay); stroke-width:12; }
    .que-ring-fill { fill:none; stroke:var(--ps-blue); stroke-width:12; stroke-linecap:round; transition:stroke-dashoffset 400ms ease; }
    .que-ring-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .que-percent { font-size:36px; font-weight:700; font-family:var(--font-mono); color:var(--ps-text); line-height:1; }
    .que-ring-label { font-size:12px; color:var(--ps-text-muted); margin-top:4px; }
    .que-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; width:100%; margin-bottom:12px; }
    .que-stat { text-align:center; }
    .que-stat-value { font-size:20px; font-weight:700; color:var(--ps-text); font-family:var(--font-mono); }
    .que-stat-label { font-size:10px; color:var(--ps-text-muted); text-transform:uppercase; letter-spacing:.06em; }
    .que-current-file { max-width:260px; text-align:center; word-break:break-all; min-height:20px; }
    .que-log-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; background:var(--ps-bg-app); }
  `;
  document.head.appendChild(s);
}
