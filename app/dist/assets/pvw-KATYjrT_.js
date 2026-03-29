import{a as _,c as E}from"./recipes-qesXpeyQ.js";import{n as m}from"./index-DpFMNAiN.js";import{I as C}from"./processor-BO1Q6VPM.js";import{e as q}from"./exif-reader-DgBCZqHm.js";import"./misc-DpJZ-4k9.js";import"./ai-bgremoval-stlubUex.js";const R={geo:"#38bdf8",color:"#a78bfa",overlay:"#fb923c",ai:"#34d399",flow:"#0077ff",meta:"#f472b6"};function T(e){return e.type==="branch"?{icon:"device_hub",label:e.label||"Branch",cat:"flow"}:e.type==="conditional"?{icon:"alt_route",label:e.label||"Conditional",cat:"flow"}:e.type==="block-ref"?{icon:"widgets",label:e.label||"Block Ref",cat:"flow"}:e.type==="transform"?{icon:"tune",label:e.label||e.transformId,cat:e.categoryKey||e.transformId?.split("-")[0]}:{icon:"help_outline",label:e.label||e.type,cat:"other"}}function v(e=[],r=0){const i=[];for(const l of e){if(i.push({node:l,depth:r}),l.branches)for(const s of l.branches)i.push({node:{type:"_branch_header",label:s.label||"Variant"},depth:r+1,isBranchHeader:!0}),i.push(...v(s.nodes,r+2));l.thenNodes?.length&&(i.push({node:{type:"_branch_header",label:"Then"},depth:r+1,isBranchHeader:!0}),i.push(...v(l.thenNodes,r+2))),l.elseNodes?.length&&(i.push({node:{type:"_branch_header",label:"Else"},depth:r+1,isBranchHeader:!0}),i.push(...v(l.elseNodes,r+2)))}return i}function I(e){const r=v(e);return r.length?r.map(({node:i,depth:l,isBranchHeader:s})=>{if(s)return`<div class="pvw-node-row pvw-node-row--header" style="padding-left:${16+l*16}px">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-text-faint)">subdirectory_arrow_right</span>
        <span class="pvw-node-variant-label">${i.label}</span>
      </div>`;const{icon:u,label:b,cat:d}=T(i),p=R[d]||"#6b7280";return`<div class="pvw-node-row" style="padding-left:${16+l*16}px">
      <span class="pvw-node-dot" style="background:${p}"></span>
      <span class="material-symbols-outlined" style="font-size:14px;color:${p};flex-shrink:0">${u}</span>
      <span class="pvw-node-label">${b}</span>
      ${i.disabled?'<span class="ic-badge" style="margin-left:auto;font-size:10px">disabled</span>':""}
    </div>`}).join(""):'<div class="empty-state" style="padding:24px"><div class="empty-state-title">No nodes</div></div>'}async function A(e,r){const l=new URLSearchParams(r.split("?")[1]||"").get("id");e.innerHTML=`<div class="screen" style="align-items:center;justify-content:center">
    <div class="spinner spinner--lg"></div>
  </div>`;const s=l?await _(l):null;if(!s){e.innerHTML=`<div class="screen">
      <div class="screen-body" style="align-items:center;justify-content:center">
        <div class="empty-state">
          <span class="material-symbols-outlined">error_outline</span>
          <div class="empty-state-title">Recipe not found</div>
          <div class="empty-state-desc">The requested recipe does not exist.</div>
          <button class="btn-primary" onclick="navigate('#lib')">Back to Library</button>
        </div>
      </div>
    </div>`;return}const u=v(s.nodes).filter(t=>!t.isBranchHeader).length;e.innerHTML=`
    <div class="screen pvw-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="pvw-back" title="Back to Library">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">preview</span>
            ${s.name}
          </div>
          ${s.isSystem?'<span class="ic-badge ic-badge--blue"><span class="material-symbols-outlined" style="font-size:11px">lock</span> System</span>':'<span class="ic-badge ic-badge--green"><span class="material-symbols-outlined" style="font-size:11px">person</span> Yours</span>'}
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary" id="pvw-btn-compare" disabled title="Compare requires a test image">
            <span class="material-symbols-outlined">compare</span>
            Compare
          </button>
          ${s.isSystem?`<button class="btn-secondary" id="pvw-btn-clone">
                 <span class="material-symbols-outlined">content_copy</span>
                 Clone
               </button>`:`<button class="btn-secondary" id="pvw-btn-edit">
                 <span class="material-symbols-outlined">edit</span>
                 Edit
               </button>`}
          <button class="btn-primary" id="pvw-btn-use">
            <span class="material-symbols-outlined">play_arrow</span>
            Use Recipe
          </button>
        </div>
      </div>

      <div class="pvw-body">
        <!-- Left panel: meta + nodes -->
        <div class="pvw-sidebar">
          <div class="pvw-meta-card">
            <div class="pvw-cover" style="${z(s)}">
              <div class="pvw-cover-overlay">
                <span class="text-sm text-muted mono">${u} step${u!==1?"s":""}</span>
              </div>
            </div>
            <div class="pvw-meta-body">
              ${s.description?`<p class="pvw-desc">${s.description}</p>`:""}
              <div class="pvw-tags">
                ${(s.tags||[]).map(t=>`<span class="ic-badge">${t}</span>`).join("")}
              </div>
            </div>
          </div>

          <div class="pvw-section-title">Steps</div>
          <div class="pvw-node-list">
            ${I(s.nodes)}
          </div>
        </div>

        <!-- Right panel: preview -->
        <div class="pvw-preview-panel">
          <div class="pvw-preview-header">
            <span class="text-sm text-muted">Test Image</span>
            <label class="btn-secondary pvw-upload-btn" style="cursor:pointer">
              <span class="material-symbols-outlined">upload</span>
              Upload Image
              <input type="file" id="pvw-file-input" accept="image/*" style="display:none">
            </label>
          </div>

          <div id="pvw-preview-area" class="pvw-preview-area">
            <div class="empty-state">
              <span class="material-symbols-outlined" style="font-size:48px">image</span>
              <div class="empty-state-title">Upload a test image</div>
              <div class="empty-state-desc">See how this recipe transforms your image.</div>
            </div>
          </div>

          <div id="pvw-step-scrubber" class="pvw-step-scrubber" style="display:none">
            <span class="text-sm text-muted" style="flex-shrink:0">Step:</span>
            <input type="range" id="pvw-step-slider" class="ic-range" min="0" value="0" style="flex:1">
            <span id="pvw-step-label" class="mono text-sm" style="min-width:80px;text-align:right">Original</span>
          </div>
        </div>
      </div>
    </div>`,H();let b=null,d=null,p=[];e.querySelector("#pvw-back")?.addEventListener("click",()=>m("#lib")),e.querySelector("#pvw-btn-use")?.addEventListener("click",()=>m(`#set?recipe=${s.id}`)),e.querySelector("#pvw-btn-edit")?.addEventListener("click",()=>m(`#bld?id=${s.id}`)),e.querySelector("#pvw-btn-clone")?.addEventListener("click",async()=>{const t=await E(s.id);window.AuroraToast?.show({variant:"success",title:`"${t.name}" cloned`}),m(`#bld?id=${t.id}`)}),e.querySelector("#pvw-btn-compare")?.addEventListener("click",()=>{b&&m(`#cmp?recipe=${s.id}&file=_test`)}),e.querySelector("#pvw-file-input")?.addEventListener("change",async t=>{const a=t.target.files?.[0];a&&(b=a,await y(a))});const o=e.querySelector("#pvw-preview-area");o?.addEventListener("dragover",t=>{t.preventDefault(),o.classList.add("pvw-dragover")}),o?.addEventListener("dragleave",()=>o.classList.remove("pvw-dragover")),o?.addEventListener("drop",async t=>{t.preventDefault(),o.classList.remove("pvw-dragover");const a=t.dataTransfer?.files?.[0];a&&a.type.startsWith("image/")&&(b=a,await y(a))}),e.querySelector("#pvw-step-slider")?.addEventListener("input",t=>{x(parseInt(t.target.value))});async function y(t){o.innerHTML='<div class="pvw-processing"><div class="spinner spinner--lg"></div><div class="text-sm text-muted" style="margin-top:12px">Processing…</div></div>';try{const a=URL.createObjectURL(t);d=new Image,await new Promise((n,f)=>{d.onload=n,d.onerror=f,d.src=a});const g=await q(t),$={filename:t.name,exif:g,meta:{}},c=s.nodes,U=v(c).filter(n=>!n.isBranchHeader);p=[{label:"Original",dataUrl:a}];for(let n=0;n<c.length;n++){const f=new C;await f.process(d,c,{...$,variables:new Map},n);const L=f.canvas.toDataURL("image/jpeg",.85),S=c[n].label||c[n].transformId||c[n].type;p.push({label:S,dataUrl:L})}const w=e.querySelector("#pvw-step-slider");w&&(w.max=p.length-1,w.value=p.length-1),e.querySelector("#pvw-step-scrubber").style.display="flex",e.querySelector("#pvw-btn-compare").disabled=!1,x(p.length-1)}catch(a){console.error("[pvw] Preview error:",a),o.innerHTML=`<div class="empty-state">
        <span class="material-symbols-outlined">error</span>
        <div class="empty-state-title">Preview failed</div>
        <div class="empty-state-desc">${a.message}</div>
      </div>`}}function x(t){const a=p[t];if(!a)return;const g=e.querySelector("#pvw-step-label");g&&(g.textContent=t===0?"Original":`Step ${t}: ${a.label}`),o.innerHTML=`
      <div class="pvw-img-wrapper">
        <img src="${a.dataUrl}" class="pvw-result-img" draggable="false">
        ${t===0?'<div class="pvw-img-badge">Original</div>':`<div class="pvw-img-badge pvw-img-badge--blue">After step ${t}</div>`}
      </div>`}}const h={"#0077ff":"linear-gradient(135deg, #0a1628 0%, #0044cc 100%)","#8b5cf6":"linear-gradient(135deg, #1a0a2e 0%, #6d28d9 100%)","#22c55e":"linear-gradient(135deg, #0a1e10 0%, #15803d 100%)","#f59e0b":"linear-gradient(135deg, #1e150a 0%, #b45309 100%)","#f472b6":"linear-gradient(135deg, #1e0a14 0%, #be185d 100%)","#374151":"linear-gradient(135deg, #111318 0%, #374151 100%)","#92400e":"linear-gradient(135deg, #1a0e06 0%, #92400e 100%)","#0ea5e9":"linear-gradient(135deg, #060e1a 0%, #0369a1 100%)"};function z(e){return e.coverColor&&h[e.coverColor]?`background:${h[e.coverColor]};`:"background:linear-gradient(135deg,#111318 0%,#1e293b 100%);"}let k=!1;function H(){if(k)return;k=!0;const e=document.createElement("style");e.textContent=`
    .pvw-screen { display:flex; flex-direction:column; height:100%; }
    .pvw-body { display:flex; flex:1; overflow:hidden; gap:0; }

    /* Sidebar */
    .pvw-sidebar { width:280px; flex-shrink:0; display:flex; flex-direction:column; border-right:1px solid var(--ps-border); overflow-y:auto; }
    .pvw-meta-card { flex-shrink:0; }
    .pvw-cover { height:100px; position:relative; }
    .pvw-cover-overlay {
      position:absolute; inset:0; display:flex; align-items:flex-end; padding:8px 12px;
      background:linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%);
    }
    .pvw-meta-body { padding:12px 14px; }
    .pvw-desc { font-size:12px; color:var(--ps-text-muted); line-height:1.5; margin-bottom:8px; }
    .pvw-tags { display:flex; flex-wrap:wrap; gap:4px; }

    .pvw-section-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;
      color:var(--ps-text-faint); padding:12px 14px 6px; border-top:1px solid var(--ps-border); flex-shrink:0; }
    .pvw-node-list { flex:1; overflow-y:auto; padding-bottom:12px; }

    .pvw-node-row {
      display:flex; align-items:center; gap:7px; padding:6px 14px;
      font-size:12px; color:var(--ps-text-muted); transition:background 100ms;
    }
    .pvw-node-row:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .pvw-node-row--header { color:var(--ps-text-faint); font-size:11px; gap:4px; }
    .pvw-node-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
    .pvw-node-label { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pvw-node-variant-label { font-style:italic; }

    /* Preview panel */
    .pvw-preview-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .pvw-preview-header { display:flex; align-items:center; justify-content:space-between;
      padding:12px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }

    .pvw-preview-area {
      flex:1; overflow:auto; display:flex; align-items:center; justify-content:center;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/32px 32px;
      transition:outline 150ms;
    }
    .pvw-preview-area.pvw-dragover { outline:2px dashed var(--ps-blue); outline-offset:-4px; }
    .pvw-processing { display:flex; flex-direction:column; align-items:center; }
    .pvw-img-wrapper { position:relative; max-width:100%; max-height:100%; }
    .pvw-result-img { display:block; max-width:calc(100vw - 360px); max-height:calc(100vh - 180px); object-fit:contain; }
    .pvw-img-badge {
      position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.7);
      color:#fff; font-size:10px; padding:3px 7px; border-radius:4px; font-family:var(--font-mono);
    }
    .pvw-img-badge--blue { background:rgba(0,119,255,0.8); }

    .pvw-step-scrubber {
      display:flex; align-items:center; gap:10px;
      padding:10px 16px; border-top:1px solid var(--ps-border); flex-shrink:0;
      background:var(--ps-bg-surface);
    }
  `,document.head.appendChild(e)}export{A as render};
