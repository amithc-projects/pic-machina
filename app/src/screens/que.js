/**
 * ImageChef — QUE: Processing Queue
 */

import { navigate } from '../main.js';

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

  container.querySelector('#btn-cancel-batch')?.addEventListener('click', async () => {
    const ctrl = window._queRunControl;
    if (ctrl) {
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
