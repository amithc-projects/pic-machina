const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/image-workspace-BhyNGQoU.js","assets/ai-bgremoval-CLcXU_4U.js","assets/video-frame-DqH3KaHz.js","assets/folders-Dd6tun-c.js","assets/index-Cvca53V-.js","assets/index-B3Ki0sLy.css"])))=>i.map(i=>d[i]);
import{_}from"./ai-bgremoval-CLcXU_4U.js";import{g as C,a as T,d as H}from"./runs-BVDshokl.js";import{getFolder as E,getOrCreateOutputSubfolder as O,listImages as P}from"./folders-Dd6tun-c.js";import{n as y}from"./index-Cvca53V-.js";import{a as W}from"./misc-BYzs6oS8.js";import{s as U}from"./dialogs-CUir_jZ5.js";function x(n){return String(n).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function G(n){const d={completed:["check_circle","ic-badge--green","Completed"],failed:["error","ic-badge--red","Failed"],cancelled:["cancel","","Cancelled"],running:["sync","ic-badge--blue","Running"]}[n]||["help","",n];return`<span class="ic-badge ${d[1]}"><span class="material-symbols-outlined" style="font-size:11px">${d[0]}</span> ${d[2]}</span>`}function K(n){if(!n.finishedAt||!n.startedAt)return"—";const d=n.finishedAt-n.startedAt;return d<1e3?`${d}ms`:d<6e4?`${(d/1e3).toFixed(1)}s`:`${Math.floor(d/6e4)}m ${Math.round(d%6e4/1e3)}s`}async function at(n,d){const v=new URLSearchParams((d||"").split("?")[1]||"").get("run");n.innerHTML=`
    <div class="screen out-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">history</span>
          Output History
        </div>
        <button class="btn-secondary" id="out-btn-clear-all">
          <span class="material-symbols-outlined">delete_sweep</span>
          Clear All
        </button>
      </div>
      <div id="out-body" class="out-body">
        <div class="spinner spinner--lg" style="margin:40px auto;display:block"></div>
      </div>
    </div>

    <!-- Lightbox for single-image compare -->
    <div id="out-lightbox" class="out-lightbox" style="display:none">
      <div class="out-lightbox-bg" id="out-lb-bg"></div>
      <div class="out-lightbox-content" id="out-lb-content" style="padding:0;overflow:hidden">
        <!-- ImageWorkspace mounts here -->
      </div>
    </div>`,J();let h=[],w=[],c=null;async function M(){if(c)return c;const{ImageWorkspace:t}=await _(async()=>{const{ImageWorkspace:s}=await import("./image-workspace-BhyNGQoU.js");return{ImageWorkspace:s}},__vite__mapDeps([0,1,2])),a=document.createElement("div");return a.style.position="absolute",a.style.inset="0",n.querySelector("#out-lb-content").appendChild(a),c=new t(a,{allowUpload:!1,allowFolder:!0,customControlsHtml:`
        <button class="btn-secondary btn-sm iw-download-btn" title="Download output" style="margin-left:8px">
          <span class="material-symbols-outlined" style="font-size:14px">download</span>
        </button>
        <button class="btn-icon iw-close-btn" title="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
      `,onBindCustomControls:s=>{s.querySelector(".iw-close-btn")?.addEventListener("click",$),s.querySelector(".iw-download-btn")?.addEventListener("click",()=>{if(!c.activeFile)return;const o=document.createElement("a");o.href=URL.createObjectURL(c.activeFile),o.download=c.activeFile.name,o.click()})},onRender:async s=>{const o=h.find(p=>p.outputFile===s);if(!o)return null;const e=URL.createObjectURL(o.inputFile||o.outputFile),i=URL.createObjectURL(o.outputFile);return w.push(e,i),{beforeUrl:e,afterUrl:i,beforeLabel:o.inputFile?"Input":"Output",afterLabel:(o.inputFile,"Output"),context:{filename:s.name},canCompare:!!o.inputFile}},onFilesChange:(s,o)=>{const e=a.querySelector(".iw-title");if(e&&o){const i=s.indexOf(o)+1;e.textContent=`${o.name}  (${i}/${s.length})`}}}),c}async function S(t,a){h=t,n.querySelector("#out-lightbox").style.display="flex";const s=await M(),o=t.map(e=>e.outputFile);s.setFiles(o,a)}function $(){n.querySelector("#out-lightbox").style.display="none",h=[],w.forEach(t=>URL.revokeObjectURL(t)),w=[]}n.querySelector("#out-lb-bg")?.addEventListener("click",$);function F(t){if(n.querySelector("#out-lightbox").style.display!=="none"&&(t.key==="Escape"&&$(),t.key==="ArrowLeft"||t.key==="ArrowRight")){if(!c)return;const a=c.files;if(a.length<=1)return;const s=a.indexOf(c.activeFile);let o=t.key==="ArrowLeft"?s-1:s+1;o<0&&(o=a.length-1),o>=a.length&&(o=0),c.setFiles(a,o)}}document.addEventListener("keydown",F),await k();async function k(){const t=n.querySelector("#out-body");if(!t)return;const a=await C();if(a.sort((e,i)=>(i.startedAt||0)-(e.startedAt||0)),!a.length){t.innerHTML=`<div class="empty-state" style="padding-top:60px">
        <span class="material-symbols-outlined" style="font-size:48px">history</span>
        <div class="empty-state-title">No runs yet</div>
        <div class="empty-state-desc">Process a batch to see output history here.</div>
        <button class="btn-primary" id="out-go-lib">
          <span class="material-symbols-outlined">library_books</span> Browse Recipes
        </button>
      </div>`,t.querySelector("#out-go-lib")?.addEventListener("click",()=>y("#lib"));return}const s=a.filter(e=>e.status==="completed").length,o=a.reduce((e,i)=>e+(i.successCount||0),0);if(t.innerHTML=`
      <div class="out-stats-bar">
        <div class="out-stat-card">
          <span class="out-stat-val">${a.length}</span>
          <span class="out-stat-label">Total Runs</span>
        </div>
        <div class="out-stat-card">
          <span class="out-stat-val" style="color:var(--ps-green,#22c55e)">${s}</span>
          <span class="out-stat-label">Completed</span>
        </div>
        <div class="out-stat-card">
          <span class="out-stat-val" style="color:var(--ps-blue)">${o}</span>
          <span class="out-stat-label">Images Processed</span>
        </div>
      </div>
      <div class="out-run-list">
        ${a.map(e=>D(e)).join("")}
      </div>`,B(),v){const e=n.querySelector(`.out-run-row[data-id="${v}"]`);if(e){const i=e.querySelector(`#out-detail-${v}`),p=e.querySelector(".out-run-chevron");i&&(i.style.display="block"),p&&(p.style.transform="rotate(90deg)"),setTimeout(()=>{e.querySelector(".out-btn-gallery")?.click(),e.scrollIntoView({behavior:"smooth",block:"start"})},50)}}}function D(t){return`
      <div class="out-run-row" data-id="${t.id}">
        <div class="out-run-header" data-expand-id="${t.id}">
          <span class="material-symbols-outlined out-run-chevron" style="font-size:16px;color:var(--ps-text-faint);transition:transform 200ms">chevron_right</span>
          <div class="out-run-info">
            <div class="out-run-name">${x(t.recipeName||"Unknown Recipe")}</div>
            <div class="out-run-meta">
              <span class="mono text-sm text-muted">${t.outputFolder||"—"}</span>
              <span class="text-sm text-muted">${t.startedAt?W(t.startedAt):"—"}</span>
            </div>
          </div>
          <div class="out-run-stats">
            ${G(t.status)}
            <span class="out-stat-inline"><span class="material-symbols-outlined" style="font-size:13px">image</span>${t.successCount??0}/${t.imageCount??0}</span>
            ${t.failCount?`<span class="out-stat-inline" style="color:var(--ps-red)"><span class="material-symbols-outlined" style="font-size:13px">error</span>${t.failCount} failed</span>`:""}
            <span class="out-stat-inline"><span class="material-symbols-outlined" style="font-size:13px">schedule</span>${K(t)}</span>
          </div>
          <div class="out-run-actions">
            ${t.status==="completed"?`<button class="btn-secondary out-btn-gallery" data-id="${t.id}" data-subfolder="${t.outputFolder||"output"}" style="font-size:12px;padding:5px 10px">
              <span class="material-symbols-outlined" style="font-size:14px">photo_library</span>
              View Files
            </button>
            <button class="btn-secondary out-btn-browse" data-run-id="${t.id}" title="Browse in Folder Viewer" style="font-size:12px;padding:5px 10px">
              <span class="material-symbols-outlined" style="font-size:14px">folder_open</span>
              Browse
            </button>`:""}
            <button class="btn-icon out-btn-edit" data-recipe-id="${t.recipeId}" title="Edit recipe">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="btn-icon out-btn-use" data-recipe-id="${t.recipeId}" title="Run batch again">
              <span class="material-symbols-outlined">play_arrow</span>
            </button>
            <button class="btn-icon out-btn-delete" data-id="${t.id}" title="Delete record">
              <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
            </button>
          </div>
        </div>

        <div class="out-run-detail" id="out-detail-${t.id}" style="display:none">
          <!-- Gallery section -->
          <div id="out-gallery-${t.id}" class="out-gallery-section" style="display:none"></div>
          <!-- Log section -->
          <div class="out-log-header">
            <span class="text-sm text-muted">Run log</span>
            <span class="mono text-sm text-muted">${t.id.slice(0,8)}</span>
          </div>
          <div class="terminal out-log-body">
            ${(t.log||[]).length===0?'<span style="color:var(--ps-text-faint)">No log entries.</span>':(t.log||[]).map(a=>{const s=a.level==="error"?"var(--ps-red)":a.level==="warn"?"#f59e0b":a.level==="ok"?"#22c55e":a.level==="info"?"var(--ps-text-muted)":"var(--ps-text-faint)";return`<div><span style="color:var(--ps-text-faint)">[${new Date(a.ts).toLocaleTimeString()}]</span> <span style="color:${s}">[${a.level}]</span> <span style="color:${s==="var(--ps-text-muted)"?"var(--ps-text)":s}">${x(a.msg)}</span></div>`}).join("")}
          </div>
        </div>
      </div>`}function B(){n.querySelectorAll("[data-expand-id]").forEach(t=>{t.addEventListener("click",a=>{if(a.target.closest("button"))return;const s=t.dataset.expandId,o=n.querySelector(`#out-detail-${s}`),e=t.querySelector(".out-run-chevron");if(!o)return;const i=o.style.display!=="none";o.style.display=i?"none":"block",e&&(e.style.transform=i?"":"rotate(90deg)")})}),n.querySelectorAll(".out-btn-gallery").forEach(t=>{t.addEventListener("click",async a=>{a.stopPropagation();const s=t.dataset.id,o=t.dataset.subfolder,e=n.querySelector(`#out-gallery-${s}`),i=n.querySelector(`#out-detail-${s}`);if(!e)return;i&&(i.style.display="block");const p=n.querySelector(`[data-expand-id="${s}"] .out-run-chevron`);if(p&&(p.style.transform="rotate(90deg)"),e.dataset.loaded==="1"){e.style.display=e.style.display==="none"?"block":"none";return}e.style.display="block",e.innerHTML='<div style="padding:12px;display:flex;align-items:center;gap:8px"><div class="spinner"></div><span class="text-sm text-muted">Loading output files…</span></div>';try{let A=(await T(s))?.outputHandleObj||await E("output");if(!A){e.innerHTML='<div class="out-gallery-empty">Output folder not accessible. <button class="btn-secondary out-btn-repick">Pick Folder</button></div>';return}let q;try{q=await O(A,o)}catch{e.innerHTML=`<div class="out-gallery-empty">Subfolder "${o}" not found.</div>`;return}const g=await P(q);if(!g.length){e.innerHTML='<div class="out-gallery-empty">No images found in output folder.</div>';return}const z=await E("input");let I=[];if(z)try{I=await P(z)}catch{}const b=new Map;for(const l of I){const r=l.name.replace(/\.[^.]+$/,"").replace(/_\w+$/,"");b.set(r,l),b.set(l.name.replace(/\.[^.]+$/,""),l)}const m=g.map(l=>{const r=l.name.replace(/\.[^.]+$/,""),u=r.replace(/[-_][a-z0-9]+$/i,""),f=u.replace(/\.[^.]+$/,""),V=b.get(r)||b.get(u)||b.get(f)||null;return{outputFile:l,inputFile:V}}),N=m.map((l,r)=>{const u=URL.createObjectURL(l.outputFile);return`<div class="out-thumb" data-pair-idx="${r}">
              <img src="${u}" class="out-thumb-img" draggable="false" loading="lazy">
              <div class="out-thumb-overlay">
                <span class="out-thumb-name">${x(l.outputFile.name)}</span>
                <div class="out-thumb-btns">
                  ${l.inputFile?`<button class="btn-icon out-thumb-compare" data-pair-idx="${r}" title="Compare">
                    <span class="material-symbols-outlined" style="font-size:14px">compare</span>
                  </button>`:""}
                  <button class="btn-icon out-thumb-download" data-pair-idx="${r}" title="Download">
                    <span class="material-symbols-outlined" style="font-size:14px">download</span>
                  </button>
                </div>
              </div>
            </div>`}).join(""),L=m.filter(l=>l.inputFile).length;e.innerHTML=`
            <div class="out-gallery-header">
              <span class="text-sm text-muted">${g.length} file${g.length!==1?"s":""} in <code>${o}/</code></span>
              <button class="btn-secondary out-btn-browse-gallery" data-run-id="${s}" style="font-size:11px;padding:4px 8px;margin-left:8px">
                <span class="material-symbols-outlined" style="font-size:13px">folder_open</span> Browse Folder
              </button>
              ${L?`<span class="text-sm text-muted" style="margin-left:6px">&nbsp;·&nbsp; ${L} originals matched for comparison</span>`:`<span style="margin-left:8px;display:flex;align-items:center;gap:6px">
                     <span class="ic-badge">No originals matched</span>
                     <button class="btn-secondary out-btn-reload-gallery" data-run-id="${s}" style="font-size:11px;padding:4px 8px">
                       <span class="material-symbols-outlined" style="font-size:13px">folder_open</span>
                       Re-authorize input folder
                     </button>
                   </span>`}
            </div>
            <div class="out-thumb-grid">${N}</div>`,e.dataset.loaded=L>0?"1":"0",e.querySelectorAll(".out-btn-browse-gallery").forEach(l=>{l.addEventListener("click",r=>{r.stopPropagation(),y(`#fld?run=${l.dataset.runId}&from=out`)})}),e.querySelectorAll(".out-btn-reload-gallery").forEach(l=>{l.addEventListener("click",async r=>{r.stopPropagation();try{await _(()=>import("./folders-Dd6tun-c.js"),__vite__mapDeps([3,1,4,5])).then(u=>u.pickFolder("input")),e.dataset.loaded="0",t.click()}catch{}})}),e.querySelectorAll(".out-thumb").forEach(l=>{l.addEventListener("click",r=>{if(r.target.closest("button"))return;const u=parseInt(l.dataset.pairIdx);S(m,u)})}),e.querySelectorAll(".out-thumb-compare").forEach(l=>{l.addEventListener("click",r=>{r.stopPropagation(),S(m,parseInt(l.dataset.pairIdx))})}),e.querySelectorAll(".out-thumb-download").forEach(l=>{l.addEventListener("click",r=>{r.stopPropagation();const u=m[parseInt(l.dataset.pairIdx)],f=document.createElement("a");f.href=URL.createObjectURL(u.outputFile),f.download=u.outputFile.name,f.click()})})}catch(R){e.innerHTML=`<div class="out-gallery-empty">Error: ${x(R.message)}</div>`}})}),n.querySelectorAll(".out-btn-browse").forEach(t=>{t.addEventListener("click",async a=>{a.stopPropagation();const s=t.dataset.runId,o=await T(s);if(!o)return;let e=o.outputHandleObj||await E("output");if(e)try{const i=await O(e,o.outputFolder||"output");window._icFldTargetHandle=i,y("#fld")}catch(i){window.AuroraToast?.show({variant:"danger",title:"Subfolder not found",description:i.message})}})}),n.querySelectorAll(".out-btn-edit").forEach(t=>{t.addEventListener("click",a=>{a.stopPropagation(),y(t.dataset.recipeId?`#bld?id=${t.dataset.recipeId}`:"#lib")})}),n.querySelectorAll(".out-btn-use").forEach(t=>{t.addEventListener("click",a=>{a.stopPropagation(),y(t.dataset.recipeId?`#set?recipe=${t.dataset.recipeId}`:"#lib")})}),n.querySelectorAll(".out-btn-delete").forEach(t=>{t.addEventListener("click",async a=>{a.stopPropagation(),await U({title:"Delete Run Record?",body:"This will remove the execution record and its history. This action cannot be undone.",confirmText:"Delete",variant:"danger",icon:"delete_forever"})&&(await H(t.dataset.id),await k())})})}return n.querySelector("#out-btn-clear-all")?.addEventListener("click",async()=>{const t=await C();!t.length||!await U({title:"Clear All History?",body:`Are you sure you want to delete all ${t.length} execution records? This cannot be undone.`,confirmText:"Clear All",variant:"danger",icon:"delete_sweep"})||(await Promise.all(t.map(s=>H(s.id))),window.AuroraToast?.show({variant:"success",title:"All run records cleared"}),await k())}),()=>document.removeEventListener("keydown",F)}let j=!1;function J(){if(j)return;j=!0;const n=document.createElement("style");n.textContent=`
    .out-screen { display:flex; flex-direction:column; height:100%; }
    .out-body { flex:1; overflow-y:auto; padding:16px 20px; }

    .out-stats-bar { display:flex; gap:12px; margin-bottom:20px; }
    .out-stat-card { flex:1; background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:4px; }
    .out-stat-val { font-size:24px; font-weight:700; font-family:var(--font-mono); }
    .out-stat-label { font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--ps-text-faint); }

    .out-run-list { display:flex; flex-direction:column; gap:8px; }
    .out-run-row { background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:10px; overflow:hidden; }
    .out-run-header { display:flex; align-items:center; gap:10px; padding:12px 14px; cursor:pointer; transition:background 100ms; }
    .out-run-header:hover { background:var(--ps-bg-hover); }
    .out-run-info { flex:1; overflow:hidden; }
    .out-run-name { font-size:14px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:3px; }
    .out-run-meta { display:flex; gap:12px; flex-wrap:wrap; }
    .out-run-stats { display:flex; align-items:center; gap:8px; flex-shrink:0; flex-wrap:wrap; }
    .out-run-actions { display:flex; gap:4px; flex-shrink:0; align-items:center; }
    .out-stat-inline { display:flex; align-items:center; gap:3px; font-size:12px; color:var(--ps-text-muted); font-family:var(--font-mono); }

    .out-run-detail { border-top:1px solid var(--ps-border); }
    .out-log-header { display:flex; justify-content:space-between; padding:8px 14px; background:var(--ps-bg-app); }
    .out-log-body { max-height:160px; overflow-y:auto; margin:0; border-radius:0; border:none; font-size:11px; line-height:1.6; }

    /* Gallery */
    .out-gallery-section { border-bottom:1px solid var(--ps-border); background:var(--ps-bg-app); padding:12px 14px; }
    .out-gallery-header { display:flex; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:4px; }
    .out-gallery-empty { padding:16px; color:var(--ps-text-muted); font-size:13px; }
    .out-thumb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:8px; }
    .out-thumb { position:relative; border-radius:8px; overflow:hidden; cursor:pointer; aspect-ratio:1; background:var(--ps-bg-surface); border:1px solid var(--ps-border); }
    .out-thumb:hover .out-thumb-overlay { opacity:1; }
    .out-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }
    .out-thumb-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.65); display:flex; flex-direction:column; justify-content:flex-end; padding:6px; opacity:0; transition:opacity 150ms; }
    .out-thumb-name { font-size:9px; color:#fff; font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:4px; }
    .out-thumb-btns { display:flex; gap:3px; }
    .out-thumb-btns .btn-icon { width:24px; height:24px; background:rgba(255,255,255,0.15); border-radius:4px; }
    .out-thumb-btns .btn-icon:hover { background:var(--ps-blue); }

    /* Lightbox */
    .out-lightbox { position:fixed; inset:0; z-index:500; display:flex; align-items:center; justify-content:center; }
    .out-lightbox-bg { position:absolute; inset:0; background:rgba(0,0,0,0.85); }
    .out-lightbox-content { position:relative; z-index:1; width:92vw; height:90vh; background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:14px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 80px rgba(0,0,0,0.6); }

  `,document.head.appendChild(n)}export{at as render};
