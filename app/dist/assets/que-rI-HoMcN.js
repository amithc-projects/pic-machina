import{n as g}from"./index-Cvca53V-.js";import{s as _}from"./dialogs-CUir_jZ5.js";import"./ai-bgremoval-CLcXU_4U.js";function I(t){t.innerHTML=`
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
    </div>`,M();const l=t.querySelector("#que-terminal"),k=t.querySelector("#que-percent"),m=t.querySelector("#que-ring-arc"),q=t.querySelector("#que-ring-label"),L=t.querySelector("#que-processed"),S=t.querySelector("#que-total"),x=t.querySelector("#que-success"),y=t.querySelector("#que-fail"),h=t.querySelector("#que-current-file"),T=t.querySelector("#que-progress-bar"),r=t.querySelector("#que-status-badge"),w=t.querySelector("#que-elapsed"),d=t.querySelector("#que-footer-actions");let v=0,f=0,u=null,o=null;const p=2*Math.PI*80;m.style.strokeDasharray=p,m.style.strokeDashoffset=p;function b(e,s,n=null){const a=n!==null?n:s>0?Math.round(e/s*100):0;k.textContent=a+"%",m.style.strokeDashoffset=p-p*a/100,T.style.width=a+"%",L.textContent=e,s&&(S.textContent=s)}function c(e,s){const n=document.createElement("div"),a=e==="ok"?"ok":e==="error"?"error":e==="warn"?"warn":e==="info"?"info":"muted";n.className="terminal-line--"+a;const i=new Date().toLocaleTimeString("en-GB",{hour12:!1});n.textContent="["+i+"] "+s,l.appendChild(n),l.scrollTop=l.scrollHeight}function E(){u=Date.now(),o=setInterval(()=>{const e=Math.floor((Date.now()-u)/1e3);w.textContent=String(Math.floor(e/60)).padStart(2,"0")+":"+String(e%60).padStart(2,"0")},1e3)}return window._queProgress=(e,s,n,a=null)=>{u||E(),b(e,s,a),h.textContent=n,q.textContent="Processing"},window._queLog=(e,s)=>{if(c(e,s),e==="error")f++,y.textContent=f;else if(e==="ok"&&s.includes("succeeded")){const n=s.match(/(\d+) succeeded/);n&&(v=parseInt(n[1]),x.textContent=v)}},window._queComplete=e=>{clearInterval(o),b(e.imageCount,e.imageCount),q.textContent="Complete",r.innerHTML='<span class="material-symbols-outlined" style="font-size:13px">check_circle</span> Done',r.className="ic-badge ic-badge--green",c("ok","Batch complete — "+e.successCount+" succeeded, "+e.failCount+" failed"),h.textContent="All done";const s=t.querySelector("#btn-cancel-batch");if(s&&(s.innerHTML='<span class="material-symbols-outlined">library_books</span> Library',s.className="btn-secondary",s.id="btn-que-library",s.addEventListener("click",()=>g("#lib"))),window._queRunAgain){const i=document.createElement("button");i.className="btn-secondary",i.style.cssText="width:100%;justify-content:center;margin-bottom:8px;border-color:var(--ps-blue);color:var(--ps-blue);",i.innerHTML='<span class="material-symbols-outlined">replay</span> Run Again',i.addEventListener("click",()=>{d.innerHTML="",l.innerHTML="",c("info",'Executing "Run Again" using previous batch configuration...'),x.textContent="0",y.textContent="0",v=0,f=0,u=null,w.textContent="00:00",b(0,100),window._queRunAgain()}),d.appendChild(i)}const n=document.createElement("button");n.className="btn-primary",n.style.cssText="width:100%;justify-content:center;margin-bottom:8px",n.innerHTML='<span class="material-symbols-outlined">folder_open</span> Browse Output',n.addEventListener("click",()=>g("#fld?run="+e.id+"&from=que")),d.appendChild(n);const a=document.createElement("button");a.className="btn-secondary",a.style.cssText="width:100%;justify-content:center",a.innerHTML='<span class="material-symbols-outlined">history</span> View Run History',a.addEventListener("click",()=>g("#out?run="+e.id)),d.appendChild(a)},window._queError=e=>{clearInterval(o),r.innerHTML='<span class="material-symbols-outlined" style="font-size:13px">error</span> Error',r.className="ic-badge ic-badge--red",c("error","FATAL: "+e)},t.querySelector("#btn-cancel-batch")?.addEventListener("click",async()=>{const e=window._queRunControl;if(e){if(!await _({title:"Cancel Batch?",body:"Are you sure you want to stop processing? Images already completed will be preserved.",confirmText:"Stop Batch",variant:"danger",icon:"cancel"}))return;await e.cancel(),clearInterval(o),c("warn","Cancelled by user."),r.textContent="Cancelled",r.className="ic-badge ic-badge--amber"}else g("#set")}),t.querySelector("#btn-clear-log")?.addEventListener("click",()=>{l.innerHTML=""}),()=>{clearInterval(o),delete window._queProgress,delete window._queLog,delete window._queComplete,delete window._queError}}let C=!1;function M(){if(C)return;C=!0;const t=document.createElement("style");t.textContent=`
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
  `,document.head.appendChild(t)}export{I as render};
