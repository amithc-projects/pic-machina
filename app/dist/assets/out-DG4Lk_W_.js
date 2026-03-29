const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/runs-vZMHdHCv.js","assets/ai-bgremoval-stlubUex.js","assets/index-DpFMNAiN.js","assets/index-B9dHTdXV.css","assets/misc-DpJZ-4k9.js"])))=>i.map(i=>d[i]);
import{_ as O}from"./ai-bgremoval-stlubUex.js";import{d as F,b as j,g as B,l as _,e as M}from"./runs-vZMHdHCv.js";import{n as H}from"./index-DpFMNAiN.js";import{b as D}from"./misc-DpJZ-4k9.js";function L(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function N(t){const o={completed:["check_circle","ic-badge--green","Completed"],failed:["error","ic-badge--red","Failed"],cancelled:["cancel","","Cancelled"],running:["sync","ic-badge--blue","Running"]}[t]||["help","",t];return`<span class="ic-badge ${o[1]}"><span class="material-symbols-outlined" style="font-size:11px">${o[0]}</span> ${o[2]}</span>`}function X(t){if(!t.finishedAt||!t.startedAt)return"—";const o=t.finishedAt-t.startedAt;return o<1e3?`${o}ms`:o<6e4?`${(o/1e3).toFixed(1)}s`:`${Math.floor(o/6e4)}m ${Math.round(o%6e4/1e3)}s`}async function W(t){t.innerHTML=`
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
      <div class="out-lightbox-content">
        <div class="out-lb-toolbar">
          <span id="out-lb-title" class="text-sm font-medium"></span>
          <div class="flex items-center gap-2">
            <button class="cmp-mode-btn is-active" data-lb-mode="slider">
              <span class="material-symbols-outlined" style="font-size:14px">swap_horiz</span> Slider
            </button>
            <button class="cmp-mode-btn" data-lb-mode="side">
              <span class="material-symbols-outlined" style="font-size:14px">view_column</span> Side by Side
            </button>
            <button class="btn-icon" id="out-lb-prev" title="Previous image">
              <span class="material-symbols-outlined">chevron_left</span>
            </button>
            <button class="btn-icon" id="out-lb-next" title="Next image">
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
            <button class="btn-secondary btn-sm" id="out-lb-download" title="Download output">
              <span class="material-symbols-outlined" style="font-size:14px">download</span>
            </button>
            <button class="btn-icon" id="out-lb-close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div id="out-lb-view" class="out-lb-view"></div>
      </div>
    </div>`,V();let o=[],c=0,q="slider",$=50,k=!1;function A(e,s){o=e,c=s,t.querySelector("#out-lightbox").style.display="flex",v()}function S(){t.querySelector("#out-lightbox").style.display="none",o=[],t.querySelectorAll("[data-lb-url]").forEach(e=>URL.revokeObjectURL(e.dataset.lbUrl))}t.querySelector("#out-lb-bg")?.addEventListener("click",S),t.querySelector("#out-lb-close")?.addEventListener("click",S),t.querySelector("#out-lb-prev")?.addEventListener("click",()=>{c=(c-1+o.length)%o.length,v()}),t.querySelector("#out-lb-next")?.addEventListener("click",()=>{c=(c+1)%o.length,v()}),document.addEventListener("keydown",R),t.querySelectorAll("[data-lb-mode]").forEach(e=>{e.addEventListener("click",()=>{q=e.dataset.lbMode,t.querySelectorAll("[data-lb-mode]").forEach(s=>s.classList.toggle("is-active",s===e)),v()})}),t.querySelector("#out-lb-download")?.addEventListener("click",()=>{const e=o[c];if(!e?.outputFile)return;const s=document.createElement("a");s.href=URL.createObjectURL(e.outputFile),s.download=e.outputFile.name,s.click()});function R(e){t.querySelector("#out-lightbox").style.display!=="none"&&(e.key==="Escape"&&S(),e.key==="ArrowLeft"&&(c=(c-1+o.length)%o.length,v()),e.key==="ArrowRight"&&(c=(c+1)%o.length,v()))}async function v(){const e=o[c];if(!e)return;const s=t.querySelector("#out-lb-title");s&&(s.textContent=`${e.outputFile.name}  (${c+1}/${o.length})`);const r=t.querySelector("#out-lb-prev"),p=t.querySelector("#out-lb-next");r&&(r.style.visibility=o.length>1?"":"hidden"),p&&(p.style.visibility=o.length>1?"":"hidden");const a=URL.createObjectURL(e.outputFile),n=e.inputFile?URL.createObjectURL(e.inputFile):null,u=t.querySelector("#out-lb-view");if(u){if(!n){u.innerHTML=`<img src="${a}" class="out-lb-img" data-lb-url="${a}">`;return}if(q==="side")u.innerHTML=`
        <div class="cmp-side-view">
          <div class="cmp-side">
            <div class="cmp-side-label">Before</div>
            <img src="${n}" class="cmp-side-img" data-lb-url="${n}" draggable="false">
          </div>
          <div class="cmp-divider-vertical"></div>
          <div class="cmp-side">
            <div class="cmp-side-label cmp-side-label--blue">After</div>
            <img src="${a}" class="cmp-side-img" data-lb-url="${a}" draggable="false">
          </div>
        </div>`;else{let x=function(b){const g=f.getBoundingClientRect();$=Math.max(0,Math.min(100,(b-g.left)/g.width*100)),y&&(y.style.clipPath=`inset(0 ${100-$}% 0 0)`),m&&(m.style.left=`${$}%`)};$=50,u.innerHTML=`
        <div class="cmp-slider-view" id="lb-slider-view">
          <img src="${n}" class="lb-cmp-img" draggable="false">
          <img src="${a}"  class="lb-cmp-img" id="lb-after-img" draggable="false"
               style="clip-path:inset(0 50% 0 0)">
          <div class="cmp-slider-handle" id="lb-handle" style="left:50%">
            <div class="cmp-handle-line"></div>
            <div class="cmp-handle-grip">
              <span class="material-symbols-outlined" style="font-size:16px">swap_horiz</span>
            </div>
          </div>
          <div class="cmp-slider-badge cmp-slider-badge--left">Before</div>
          <div class="cmp-slider-badge cmp-slider-badge--right cmp-slider-badge--blue">After</div>
        </div>`;const f=u.querySelector("#lb-slider-view"),y=u.querySelector("#lb-after-img"),m=u.querySelector("#lb-handle");m?.addEventListener("mousedown",b=>{k=!0,b.preventDefault()}),document.addEventListener("mousemove",b=>{k&&x(b.clientX)}),document.addEventListener("mouseup",()=>{k=!1}),f?.addEventListener("click",b=>{k||x(b.clientX)})}}}await E();async function E(){const e=t.querySelector("#out-body");if(!e)return;const s=await F();if(s.sort((a,n)=>(n.startedAt||0)-(a.startedAt||0)),!s.length){e.innerHTML=`<div class="empty-state" style="padding-top:60px">
        <span class="material-symbols-outlined" style="font-size:48px">history</span>
        <div class="empty-state-title">No runs yet</div>
        <div class="empty-state-desc">Process a batch to see output history here.</div>
        <button class="btn-primary" id="out-go-lib">
          <span class="material-symbols-outlined">library_books</span> Browse Recipes
        </button>
      </div>`,e.querySelector("#out-go-lib")?.addEventListener("click",()=>H("#lib"));return}const r=s.filter(a=>a.status==="completed").length,p=s.reduce((a,n)=>a+(n.successCount||0),0);e.innerHTML=`
      <div class="out-stats-bar">
        <div class="out-stat-card">
          <span class="out-stat-val">${s.length}</span>
          <span class="out-stat-label">Total Runs</span>
        </div>
        <div class="out-stat-card">
          <span class="out-stat-val" style="color:var(--ps-green,#22c55e)">${r}</span>
          <span class="out-stat-label">Completed</span>
        </div>
        <div class="out-stat-card">
          <span class="out-stat-val" style="color:var(--ps-blue)">${p}</span>
          <span class="out-stat-label">Images Processed</span>
        </div>
      </div>
      <div class="out-run-list">
        ${s.map(a=>T(a)).join("")}
      </div>`,C()}function T(e){return`
      <div class="out-run-row" data-id="${e.id}">
        <div class="out-run-header" data-expand-id="${e.id}">
          <span class="material-symbols-outlined out-run-chevron" style="font-size:16px;color:var(--ps-text-faint);transition:transform 200ms">chevron_right</span>
          <div class="out-run-info">
            <div class="out-run-name">${L(e.recipeName||"Unknown Recipe")}</div>
            <div class="out-run-meta">
              <span class="mono text-sm text-muted">${e.outputFolder||"—"}</span>
              <span class="text-sm text-muted">${e.startedAt?D(e.startedAt):"—"}</span>
            </div>
          </div>
          <div class="out-run-stats">
            ${N(e.status)}
            <span class="out-stat-inline"><span class="material-symbols-outlined" style="font-size:13px">image</span>${e.successCount??0}/${e.imageCount??0}</span>
            ${e.failCount?`<span class="out-stat-inline" style="color:var(--ps-red)"><span class="material-symbols-outlined" style="font-size:13px">error</span>${e.failCount} failed</span>`:""}
            <span class="out-stat-inline"><span class="material-symbols-outlined" style="font-size:13px">schedule</span>${X(e)}</span>
          </div>
          <div class="out-run-actions">
            ${e.status==="completed"?`<button class="btn-secondary out-btn-gallery" data-id="${e.id}" data-subfolder="${e.outputFolder||"output"}" style="font-size:12px;padding:5px 10px">
              <span class="material-symbols-outlined" style="font-size:14px">photo_library</span>
              View Files
            </button>`:""}
            <button class="btn-icon out-btn-use" data-recipe-id="${e.recipeId}" title="Use recipe again">
              <span class="material-symbols-outlined">play_arrow</span>
            </button>
            <button class="btn-icon out-btn-delete" data-id="${e.id}" title="Delete record">
              <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
            </button>
          </div>
        </div>

        <div class="out-run-detail" id="out-detail-${e.id}" style="display:none">
          <!-- Gallery section -->
          <div id="out-gallery-${e.id}" class="out-gallery-section" style="display:none"></div>
          <!-- Log section -->
          <div class="out-log-header">
            <span class="text-sm text-muted">Run log</span>
            <span class="mono text-sm text-muted">${e.id.slice(0,8)}</span>
          </div>
          <div class="terminal out-log-body">
            ${(e.log||[]).length===0?'<span style="color:var(--ps-text-faint)">No log entries.</span>':(e.log||[]).map(s=>{const r=s.level==="error"?"var(--ps-red)":s.level==="warn"?"#f59e0b":"var(--ps-text-muted)";return`<div><span style="color:var(--ps-text-faint)">[${new Date(s.ts).toLocaleTimeString()}]</span> <span style="color:${r}">[${s.level}]</span> ${L(s.msg)}</div>`}).join("")}
          </div>
        </div>
      </div>`}function C(){t.querySelectorAll("[data-expand-id]").forEach(e=>{e.addEventListener("click",s=>{if(s.target.closest("button"))return;const r=e.dataset.expandId,p=t.querySelector(`#out-detail-${r}`),a=e.querySelector(".out-run-chevron");if(!p)return;const n=p.style.display!=="none";p.style.display=n?"none":"block",a&&(a.style.transform=n?"":"rotate(90deg)")})}),t.querySelectorAll(".out-btn-gallery").forEach(e=>{e.addEventListener("click",async s=>{s.stopPropagation();const r=e.dataset.id,p=e.dataset.subfolder,a=t.querySelector(`#out-gallery-${r}`),n=t.querySelector(`#out-detail-${r}`);if(!a)return;n&&(n.style.display="block");const u=t.querySelector(`[data-expand-id="${r}"] .out-run-chevron`);if(u&&(u.style.transform="rotate(90deg)"),a.dataset.loaded==="1"){a.style.display=a.style.display==="none"?"block":"none";return}a.style.display="block",a.innerHTML='<div style="padding:12px;display:flex;align-items:center;gap:8px"><div class="spinner"></div><span class="text-sm text-muted">Loading output files…</span></div>';try{const f=await j("output");if(!f){a.innerHTML='<div class="out-gallery-empty">Output folder not accessible. <button class="btn-secondary out-btn-repick">Pick Folder</button></div>';return}let y;try{y=await B(f,p)}catch{a.innerHTML=`<div class="out-gallery-empty">Subfolder "${p}" not found.</div>`;return}const m=await _(y);if(!m.length){a.innerHTML='<div class="out-gallery-empty">No images found in output folder.</div>';return}const x=await j("input");let b=[];if(x)try{b=await _(x)}catch{}const g=new Map;for(const l of b){const i=l.name.replace(/\.[^.]+$/,"").replace(/_\w+$/,"");g.set(i,l),g.set(l.name.replace(/\.[^.]+$/,""),l)}const h=m.map(l=>{const i=l.name.replace(/\.[^.]+$/,""),d=i.replace(/_[a-z0-9]+$/i,""),w=d.replace(/\.[^.]+$/,""),P=g.get(i)||g.get(d)||g.get(w)||null;return{outputFile:l,inputFile:P}}),U=h.map((l,i)=>{const d=URL.createObjectURL(l.outputFile);return`<div class="out-thumb" data-pair-idx="${i}">
              <img src="${d}" class="out-thumb-img" draggable="false" loading="lazy">
              <div class="out-thumb-overlay">
                <span class="out-thumb-name">${L(l.outputFile.name)}</span>
                <div class="out-thumb-btns">
                  ${l.inputFile?`<button class="btn-icon out-thumb-compare" data-pair-idx="${i}" title="Compare">
                    <span class="material-symbols-outlined" style="font-size:14px">compare</span>
                  </button>`:""}
                  <button class="btn-icon out-thumb-download" data-pair-idx="${i}" title="Download">
                    <span class="material-symbols-outlined" style="font-size:14px">download</span>
                  </button>
                </div>
              </div>
            </div>`}).join(""),z=h.filter(l=>l.inputFile).length;a.innerHTML=`
            <div class="out-gallery-header">
              <span class="text-sm text-muted">${m.length} file${m.length!==1?"s":""} in <code>${p}/</code></span>
              ${z?`<span class="text-sm text-muted" style="margin-left:6px">&nbsp;·&nbsp; ${z} originals matched for comparison</span>`:`<span style="margin-left:8px;display:flex;align-items:center;gap:6px">
                     <span class="ic-badge">No originals matched</span>
                     <button class="btn-secondary out-btn-reload-gallery" data-run-id="${r}" style="font-size:11px;padding:4px 8px">
                       <span class="material-symbols-outlined" style="font-size:13px">folder_open</span>
                       Re-authorize input folder
                     </button>
                   </span>`}
            </div>
            <div class="out-thumb-grid">${U}</div>`,a.dataset.loaded=z>0?"1":"0",a.querySelectorAll(".out-btn-reload-gallery").forEach(l=>{l.addEventListener("click",async i=>{i.stopPropagation();try{await O(()=>import("./runs-vZMHdHCv.js").then(d=>d.f),__vite__mapDeps([0,1,2,3,4])).then(d=>d.pickFolder("input")),a.dataset.loaded="0",e.click()}catch{}})}),a.querySelectorAll(".out-thumb").forEach(l=>{l.addEventListener("click",i=>{if(i.target.closest("button"))return;const d=parseInt(l.dataset.pairIdx);A(h,d)})}),a.querySelectorAll(".out-thumb-compare").forEach(l=>{l.addEventListener("click",i=>{i.stopPropagation(),A(h,parseInt(l.dataset.pairIdx))})}),a.querySelectorAll(".out-thumb-download").forEach(l=>{l.addEventListener("click",i=>{i.stopPropagation();const d=h[parseInt(l.dataset.pairIdx)],w=document.createElement("a");w.href=URL.createObjectURL(d.outputFile),w.download=d.outputFile.name,w.click()})})}catch(f){a.innerHTML=`<div class="out-gallery-empty">Error: ${L(f.message)}</div>`}})}),t.querySelectorAll(".out-btn-use").forEach(e=>{e.addEventListener("click",s=>{s.stopPropagation(),H(e.dataset.recipeId?`#set?recipe=${e.dataset.recipeId}`:"#lib")})}),t.querySelectorAll(".out-btn-delete").forEach(e=>{e.addEventListener("click",async s=>{s.stopPropagation(),confirm("Delete this run record?")&&(await M(e.dataset.id),await E())})})}return t.querySelector("#out-btn-clear-all")?.addEventListener("click",async()=>{const e=await F();e.length&&confirm(`Delete all ${e.length} run record${e.length!==1?"s":""}?`)&&(await Promise.all(e.map(s=>M(s.id))),window.AuroraToast?.show({variant:"success",title:"All run records cleared"}),await E())}),()=>document.removeEventListener("keydown",R)}let I=!1;function V(){if(I)return;I=!0;const t=document.createElement("style");t.textContent=`
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
    .out-lb-toolbar { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--ps-border); flex-shrink:0; gap:8px; }
    .out-lb-view { flex:1; overflow:hidden; position:relative; background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%,var(--ps-bg-app) 0% 50%) 0 0/24px 24px; }
    .out-lb-img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; }
    /* Both images in slider share the same box — clip-path cuts the after image at the handle position */
    .lb-cmp-img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; }

    /* Reuse CMP classes (injected by cmp.js if visited, or inline here) */
    .cmp-side-view { display:flex; width:100%; height:100%; }
    .cmp-side { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
    .cmp-side-img { width:100%; height:100%; object-fit:contain; display:block; }
    .cmp-side-label { position:absolute; top:10px; left:10px; z-index:2; background:rgba(0,0,0,0.7); color:#fff; font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; font-family:var(--font-mono); }
    .cmp-side-label--blue { background:rgba(0,119,255,0.85); }
    .cmp-divider-vertical { width:2px; background:var(--ps-border); flex-shrink:0; }
    .cmp-slider-view { position:relative; width:100%; height:100%; overflow:hidden; user-select:none; cursor:col-resize; }
    .cmp-slider-base { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
    .cmp-slider-clip { position:absolute; top:0; left:0; height:100%; overflow:hidden; }
    .cmp-slider-after { position:absolute; top:0; left:0; width:100vw; max-width:none; height:100%; object-fit:contain; }
    .cmp-slider-handle { position:absolute; top:0; height:100%; transform:translateX(-50%); display:flex; align-items:center; pointer-events:none; z-index:10; }
    .cmp-handle-line { position:absolute; top:0; left:50%; width:2px; height:100%; background:rgba(255,255,255,0.9); transform:translateX(-50%); box-shadow:0 0 8px rgba(0,0,0,0.4); }
    .cmp-handle-grip { position:relative; z-index:1; width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.95); box-shadow:0 2px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; cursor:col-resize; pointer-events:all; color:#111; }
    .cmp-slider-badge { position:absolute; top:10px; z-index:5; background:rgba(0,0,0,0.7); color:#fff; font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; font-family:var(--font-mono); }
    .cmp-slider-badge--left { left:10px; }
    .cmp-slider-badge--right { right:10px; }
    .cmp-slider-badge--blue { background:rgba(0,119,255,0.85); }
    .cmp-mode-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden; }
    .cmp-mode-btn { display:flex; align-items:center; gap:5px; padding:5px 10px; font-size:12px; font-weight:500; background:transparent; border:none; color:var(--ps-text-muted); cursor:pointer; font-family:var(--font-primary); transition:background 150ms,color 150ms; }
    .cmp-mode-btn.is-active { background:var(--ps-blue); color:#fff; }
    .cmp-mode-btn:hover:not(.is-active) { background:var(--ps-bg-hover); color:var(--ps-text); }
  `,document.head.appendChild(t)}export{W as render};
