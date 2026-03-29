import { n as T } from "./index-DpFMNAiN.js"; import "./ai-bgremoval-stlubUex.js"; function z(t) {
  t.innerHTML = `
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
    </div>`, E(); const n = t.querySelector("#que-terminal"), f = t.querySelector("#que-percent"), d = t.querySelector("#que-ring-arc"), u = t.querySelector("#que-ring-label"), b = t.querySelector("#que-processed"), x = t.querySelector("#que-total"), y = t.querySelector("#que-success"), h = t.querySelector("#que-fail"), p = t.querySelector("#que-current-file"), w = t.querySelector("#que-progress-bar"), r = t.querySelector("#que-status-badge"), C = t.querySelector("#que-elapsed"), k = t.querySelector("#que-footer-actions"); let g = 0, v = 0, c = null, i = null; const l = 2 * Math.PI * 80; d.style.strokeDasharray = l, d.style.strokeDashoffset = l; function q(e, s) { const a = s > 0 ? Math.round(e / s * 100) : 0; f.textContent = a + "%", d.style.strokeDashoffset = l - l * a / 100, w.style.width = a + "%", b.textContent = e, s && (x.textContent = s) } function o(e, s) { const a = document.createElement("div"), L = e === "ok" ? "ok" : e === "error" ? "error" : e === "warn" ? "warn" : e === "info" ? "info" : "muted"; a.className = "terminal-line--" + L; const _ = new Date().toLocaleTimeString("en-GB", { hour12: !1 }); a.textContent = "[" + _ + "] " + s, n.appendChild(a), n.scrollTop = n.scrollHeight } function S() { c = Date.now(), i = setInterval(() => { const e = Math.floor((Date.now() - c) / 1e3); C.textContent = String(Math.floor(e / 60)).padStart(2, "0") + ":" + String(e % 60).padStart(2, "0") }, 1e3) } return window._queProgress = (e, s, a) => { c || S(), q(e, s), p.textContent = a, u.textContent = "Processing" }, window._queLog = (e, s) => { if (o(e, s), e === "error") v++, h.textContent = v; else if (e === "ok" && s.includes("succeeded")) { const a = s.match(/(\d+) succeeded/); a && (g = parseInt(a[1]), y.textContent = g) } }, window._queComplete = e => { clearInterval(i), q(e.imageCount, e.imageCount), u.textContent = "Complete", r.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px">check_circle</span> Done', r.className = "ic-badge ic-badge--green", o("ok", "Batch complete — " + e.successCount + " succeeded, " + e.failCount + " failed"), p.textContent = "All done"; const s = document.createElement("button"); s.className = "btn-primary", s.style.width = "100%", s.style.justifyContent = "center", s.innerHTML = '<span class="material-symbols-outlined">photo_library</span> View Results', s.addEventListener("click", () => T("#out?run=" + e.id)), k.appendChild(s) }, window._queError = e => { clearInterval(i), r.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px">error</span> Error', r.className = "ic-badge ic-badge--red", o("error", "FATAL: " + e) }, t.querySelector("#btn-cancel-batch")?.addEventListener("click", async () => { const e = window._queRunControl; e && (await e.cancel(), clearInterval(i), o("warn", "Cancelled by user."), r.textContent = "Cancelled", r.className = "ic-badge ic-badge--amber") }), t.querySelector("#btn-clear-log")?.addEventListener("click", () => { n.innerHTML = "" }), () => { clearInterval(i), delete window._queProgress, delete window._queLog, delete window._queComplete, delete window._queError }
} let m = !1; function E() {
  if (m) return; m = !0; const t = document.createElement("style"); t.textContent = `
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
  `, document.head.appendChild(t)
} export { z as render };
