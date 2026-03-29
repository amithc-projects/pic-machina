import{a as $}from"./recipes-qesXpeyQ.js";import{n as w}from"./index-DpFMNAiN.js";import{I as z}from"./processor-BO1Q6VPM.js";import{e as q}from"./exif-reader-DgBCZqHm.js";import"./misc-DpJZ-4k9.js";import"./ai-bgremoval-stlubUex.js";function v(i){return String(i).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}async function A(i,L){const u=new URLSearchParams(L.split("?")[1]||"").get("recipe"),r=u?await $(u):null;i.innerHTML=`
    <div class="screen cmp-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="cmp-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">compare</span>
            ${r?v(r.name):"Comparison"}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- Mode toggle -->
          <div class="cmp-mode-toggle" role="group" aria-label="Comparison mode">
            <button class="cmp-mode-btn is-active" data-mode="slider" title="Slider">
              <span class="material-symbols-outlined" style="font-size:16px">swap_horiz</span>
              Slider
            </button>
            <button class="cmp-mode-btn" data-mode="side" title="Side by side">
              <span class="material-symbols-outlined" style="font-size:16px">view_column</span>
              Side by Side
            </button>
          </div>
          <label class="btn-secondary" style="cursor:pointer">
            <span class="material-symbols-outlined">upload</span>
            Load Image
            <input type="file" id="cmp-file-input" accept="image/*" style="display:none">
          </label>
        </div>
      </div>

      <!-- Comparison workspace -->
      <div id="cmp-workspace" class="cmp-workspace">
        <div class="empty-state" style="padding-top:80px">
          <span class="material-symbols-outlined" style="font-size:52px">compare</span>
          <div class="empty-state-title">Upload an image to compare</div>
          <div class="empty-state-desc">
            ${r?`See before/after for <strong>${v(r.name)}</strong>.`:"Load an image to see the before/after comparison."}
          </div>
          <label class="btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            <span class="material-symbols-outlined">upload</span>
            Upload Image
            <input type="file" id="cmp-file-input-2" accept="image/*" style="display:none">
          </label>
        </div>
      </div>

      <div id="cmp-footer" class="cmp-footer" style="display:none">
        <div class="cmp-footer-left">
          <span class="ic-badge">Before</span>
          <span id="cmp-before-info" class="mono text-sm text-muted"></span>
        </div>
        <div class="cmp-footer-right">
          <span class="ic-badge ic-badge--blue">After</span>
          <span id="cmp-after-info" class="mono text-sm text-muted"></span>
          <button class="btn-secondary" id="cmp-btn-save" style="margin-left:8px">
            <span class="material-symbols-outlined">download</span>
            Save After
          </button>
        </div>
      </div>
    </div>`,j();let b="slider",n=null,m=null,d=null,o=!1,f=50;i.querySelector("#cmp-back")?.addEventListener("click",()=>{r?w(`#pvw?id=${r.id}`):w("#lib")}),i.querySelectorAll(".cmp-mode-btn").forEach(t=>{t.addEventListener("click",()=>{b=t.dataset.mode,i.querySelectorAll(".cmp-mode-btn").forEach(e=>e.classList.toggle("is-active",e===t)),n&&m&&h()})});function x(t){i.querySelector(`#${t}`)?.addEventListener("change",async e=>{const l=e.target.files?.[0];l&&await y(l)})}x("cmp-file-input"),x("cmp-file-input-2");const a=i.querySelector("#cmp-workspace");a?.addEventListener("dragover",t=>{t.preventDefault(),a.classList.add("cmp-dragover")}),a?.addEventListener("dragleave",()=>a.classList.remove("cmp-dragover")),a?.addEventListener("drop",async t=>{t.preventDefault(),a.classList.remove("cmp-dragover");const e=t.dataTransfer?.files?.[0];e?.type.startsWith("image/")&&await y(e)});async function y(t){a.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px">
      <div class="spinner spinner--lg"></div>
      <div class="text-sm text-muted">Processing with recipe…</div>
    </div>`;try{n=URL.createObjectURL(t);const e=new Image;if(await new Promise((s,p)=>{e.onload=s,e.onerror=p,e.src=n}),r){const s=await q(t),p={filename:t.name,exif:s,meta:{},variables:new Map},g=new z;await g.process(e,r.nodes,p),d=g.canvas,m=g.canvas.toDataURL("image/jpeg",.92)}else m=n;const l=i.querySelector("#cmp-before-info"),c=i.querySelector("#cmp-after-info");l&&(l.textContent=`${e.naturalWidth}×${e.naturalHeight}`),d&&c&&(c.textContent=`${d.width}×${d.height}`),i.querySelector("#cmp-footer").style.display="flex",h()}catch(e){a.innerHTML=`<div class="empty-state">
        <span class="material-symbols-outlined">error</span>
        <div class="empty-state-title">Processing failed</div>
        <div class="empty-state-desc">${v(e.message)}</div>
      </div>`}}function h(){b==="side"?S():E()}function S(){a.innerHTML=`
      <div class="cmp-side-view">
        <div class="cmp-side">
          <div class="cmp-side-label">Before</div>
          <img src="${n}" class="cmp-side-img" draggable="false">
        </div>
        <div class="cmp-divider-vertical"></div>
        <div class="cmp-side">
          <div class="cmp-side-label cmp-side-label--blue">After</div>
          <img src="${m}" class="cmp-side-img" draggable="false">
        </div>
      </div>`}function E(){a.innerHTML=`
      <div class="cmp-slider-view" id="cmp-slider-view">
        <img src="${n}" class="cmp-slider-base" draggable="false">
        <div class="cmp-slider-clip" id="cmp-slider-clip" style="width:${f}%">
          <img src="${m}" class="cmp-slider-after" draggable="false">
        </div>
        <div class="cmp-slider-handle" id="cmp-slider-handle" style="left:${f}%">
          <div class="cmp-handle-line"></div>
          <div class="cmp-handle-grip">
            <span class="material-symbols-outlined" style="font-size:16px">swap_horiz</span>
          </div>
        </div>
        <div class="cmp-slider-badge cmp-slider-badge--left">Before</div>
        <div class="cmp-slider-badge cmp-slider-badge--right cmp-slider-badge--blue">After</div>
      </div>`;const t=i.querySelector("#cmp-slider-view"),e=i.querySelector("#cmp-slider-clip"),l=i.querySelector("#cmp-slider-handle");if(!t)return;function c(s){const p=t.getBoundingClientRect();f=Math.max(2,Math.min(98,(s-p.left)/p.width*100)),e&&(e.style.width=`${f}%`),l&&(l.style.left=`${f}%`)}l?.addEventListener("mousedown",s=>{o=!0,s.preventDefault()}),document.addEventListener("mousemove",s=>{o&&c(s.clientX)}),document.addEventListener("mouseup",()=>{o=!1}),l?.addEventListener("touchstart",s=>{o=!0,s.preventDefault()},{passive:!1}),document.addEventListener("touchmove",s=>{o&&c(s.touches[0].clientX)},{passive:!0}),document.addEventListener("touchend",()=>{o=!1}),t.addEventListener("click",s=>{o||c(s.clientX)})}i.querySelector("#cmp-btn-save")?.addEventListener("click",()=>{d&&d.toBlob(t=>{const e=document.createElement("a");e.href=URL.createObjectURL(t),e.download=`${r?.name?.replace(/\s+/g,"_")||"output"}_after.jpg`,e.click()},"image/jpeg",.92)})}let k=!1;function j(){if(k)return;k=!0;const i=document.createElement("style");i.textContent=`
    .cmp-screen { display:flex; flex-direction:column; height:100%; }
    .cmp-workspace {
      flex:1; overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/24px 24px;
      transition:outline 150ms;
    }
    .cmp-workspace.cmp-dragover { outline:2px dashed var(--ps-blue); outline-offset:-4px; }

    /* Side by side */
    .cmp-side-view { display:flex; width:100%; height:100%; }
    .cmp-side { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
    .cmp-side-img { width:100%; height:100%; object-fit:contain; display:block; }
    .cmp-side-label {
      position:absolute; top:12px; left:12px; z-index:2;
      background:rgba(0,0,0,0.7); color:#fff; font-size:11px; font-weight:600;
      padding:3px 9px; border-radius:20px; font-family:var(--font-mono);
    }
    .cmp-side-label--blue { background:rgba(0,119,255,0.85); }
    .cmp-divider-vertical { width:2px; background:var(--ps-border); flex-shrink:0; }

    /* Slider */
    .cmp-slider-view { position:relative; width:100%; height:100%; overflow:hidden; user-select:none; cursor:col-resize; }
    .cmp-slider-base { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; }
    .cmp-slider-clip { position:absolute; top:0; left:0; height:100%; overflow:hidden; }
    .cmp-slider-after { position:absolute; top:0; left:0; width:100vw; max-width:none; height:100%; object-fit:contain; display:block; }
    .cmp-slider-handle { position:absolute; top:0; height:100%; transform:translateX(-50%); display:flex; align-items:center; pointer-events:none; z-index:10; }
    .cmp-handle-line { position:absolute; top:0; left:50%; width:2px; height:100%; background:rgba(255,255,255,0.9); transform:translateX(-50%); box-shadow:0 0 8px rgba(0,0,0,0.4); }
    .cmp-handle-grip {
      position:relative; z-index:1; width:36px; height:36px; border-radius:50%;
      background:rgba(255,255,255,0.95); box-shadow:0 2px 10px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center; cursor:col-resize; pointer-events:all;
      color:#111;
    }
    .cmp-slider-badge {
      position:absolute; top:12px; z-index:5;
      background:rgba(0,0,0,0.7); color:#fff; font-size:11px; font-weight:600;
      padding:3px 9px; border-radius:20px; font-family:var(--font-mono);
    }
    .cmp-slider-badge--left  { left:12px; }
    .cmp-slider-badge--right { right:12px; }
    .cmp-slider-badge--blue  { background:rgba(0,119,255,0.85); }

    /* Mode toggle */
    .cmp-mode-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden; }
    .cmp-mode-btn {
      display:flex; align-items:center; gap:5px; padding:6px 12px; font-size:12px; font-weight:500;
      background:transparent; border:none; color:var(--ps-text-muted); cursor:pointer; font-family:var(--font-primary);
      transition:background 150ms, color 150ms;
    }
    .cmp-mode-btn.is-active { background:var(--ps-blue); color:#fff; }
    .cmp-mode-btn:hover:not(.is-active) { background:var(--ps-bg-hover); color:var(--ps-text); }

    /* Footer */
    .cmp-footer { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-top:1px solid var(--ps-border); background:var(--ps-bg-surface); flex-shrink:0; }
    .cmp-footer-left, .cmp-footer-right { display:flex; align-items:center; gap:8px; }
  `,document.head.appendChild(i)}export{A as render};
