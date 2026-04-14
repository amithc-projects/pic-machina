const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/image-workspace-BhyNGQoU.js","assets/ai-bgremoval-CLcXU_4U.js","assets/video-frame-DqH3KaHz.js"])))=>i.map(i=>d[i]);
import{_ as S}from"./ai-bgremoval-CLcXU_4U.js";import{g as L,c as I}from"./recipes-C3zZWtxZ.js";import{n as p}from"./index-Cvca53V-.js";import{I as C}from"./video-Dd42h0XN.js";import{extractExif as T}from"./exif-reader-CP0g5Y5B.js";import{c as E,f as h}from"./nodes-D1JCSoz2.js";import"./misc-BYzs6oS8.js";const R={geo:"#38bdf8",color:"#a78bfa",overlay:"#fb923c",ai:"#34d399",flow:"#0077ff",meta:"#f472b6"};function q(e){return e.type==="branch"?{icon:"device_hub",label:e.label||"Branch",cat:"flow"}:e.type==="conditional"?{icon:"alt_route",label:e.label||"Conditional",cat:"flow"}:e.type==="block-ref"?{icon:"widgets",label:e.label||"Block Ref",cat:"flow"}:e.type==="transform"?{icon:"tune",label:e.label||e.transformId,cat:e.categoryKey||e.transformId?.split("-")[0]}:{icon:"help_outline",label:e.label||e.type,cat:"other"}}function z(e,w){const b=h(e);return b.length?b.map(({node:s,depth:t,isBranchHeader:c})=>{if(c)return`<div class="pvw-node-row pvw-node-row--header" style="padding-left:${16+t*16}px">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-text-faint)">subdirectory_arrow_right</span>
        <span class="pvw-node-variant-label" style="font-style:italic;font-size:11px">${s.label}</span>
      </div>`;const{icon:r,label:f,cat:m}=q(s),l=R[m]||"#6b7280",a=s.id===w;return`<div class="pvw-node-row${a?" is-active":""}" style="padding-left:${16+t*16}px" data-node-id="${s.id}" title="Click eye to preview up to this step">
      <span class="pvw-node-dot" style="background:${a?"var(--ps-blue)":l}"></span>
      <span class="material-symbols-outlined" style="font-size:14px;color:${a?"var(--ps-blue)":l};flex-shrink:0">${r}</span>
      <span class="pvw-node-label">${f}</span>
      <button class="pvw-node-eye btn-icon" data-eye-id="${s.id}">
        <span class="material-symbols-outlined">${a?"visibility":"visibility_off"}</span>
      </button>
      ${s.disabled?'<span class="ic-badge" style="margin-left:auto;font-size:10px">off</span>':""}
    </div>`}).join(""):'<div class="empty-state" style="padding:24px"><div class="empty-state-title">No nodes</div></div>'}async function H(e,w){const s=new URLSearchParams(w.split("?")[1]||"").get("id");e.innerHTML=`<div class="screen" style="align-items:center;justify-content:center">
    <div class="spinner spinner--lg"></div>
  </div>`;const t=s?await L(s):null;if(!t){e.innerHTML=`<div class="screen">
      <div class="screen-body" style="align-items:center;justify-content:center">
        <div class="empty-state">
          <span class="material-symbols-outlined">error_outline</span>
          <div class="empty-state-title">Recipe not found</div>
          <div class="empty-state-desc">The requested recipe does not exist.</div>
          <button class="btn-primary" onclick="navigate('#lib')">Back to Library</button>
        </div>
      </div>
    </div>`;return}const c=E(t.nodes);e.innerHTML=`
    <div class="screen pvw-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="pvw-back" title="Back to Library">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">preview</span>
            ${t.name}
          </div>
          ${t.isSystem?'<span class="ic-badge ic-badge--blue"><span class="material-symbols-outlined" style="font-size:11px">lock</span> System</span>':'<span class="ic-badge ic-badge--green"><span class="material-symbols-outlined" style="font-size:11px">person</span> Yours</span>'}
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary" id="pvw-btn-compare" disabled title="Compare requires a test image">
            <span class="material-symbols-outlined">compare</span>
            Compare
          </button>
          ${t.isSystem?`<button class="btn-secondary" id="pvw-btn-clone">
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
            <div class="pvw-cover" style="${F(t)}">
              <div class="pvw-cover-overlay">
                <span class="text-sm text-muted mono">${c} step${c!==1?"s":""}</span>
              </div>
            </div>
            <div class="pvw-meta-body">
              ${t.description?`<p class="pvw-desc">${t.description}</p>`:""}
              <div class="pvw-tags">
                ${(t.tags||[]).map(a=>`<span class="ic-badge">${a}</span>`).join("")}
              </div>
            </div>
          </div>

          <div class="pvw-section-title">Steps</div>
          <div class="pvw-node-list" id="pvw-node-list">
            ${z(t.nodes,null)}
          </div>
        </div>

        <!-- Right panel: unified workspace -->
        <div id="pvw-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0"></div>
      </div>
    </div>`,j();let r=null;const{ImageWorkspace:f}=await S(async()=>{const{ImageWorkspace:a}=await import("./image-workspace-BhyNGQoU.js");return{ImageWorkspace:a}},__vite__mapDeps([0,1,2])),m=e.querySelector("#pvw-workspace-container"),l=new f(m,{allowUpload:!0,allowFolder:!0,onFilesChange:(a,i)=>{window._icTestFolderFiles=a,window._icTestImage={file:i};const n=e.querySelector("#pvw-btn-compare");n&&(n.disabled=!i)},onRender:async a=>{const i=new Image,n=URL.createObjectURL(a);await new Promise((g,$)=>{i.onload=g,i.onerror=$,i.src=n});const o=await T(a),d={filename:a.name,exif:o,meta:{},variables:new Map},k=await new C().previewDataUrl(i,t.nodes,d,r),v=h(t.nodes).find(g=>g.node.id===r),_=v?v.node.label||v.node.transformId||v.node.type:"All Steps";return{beforeUrl:n,afterUrl:k,beforeLabel:"Original",afterLabel:r?`Up to: ${_}`:"Result",context:d}}});window._icTestFolderFiles&&window._icTestFolderFiles.length>0?l.setFiles(window._icTestFolderFiles):window._icTestImage?.file&&l.setFiles([window._icTestImage.file]),e.querySelector("#pvw-back")?.addEventListener("click",()=>p("#lib")),e.querySelector("#pvw-btn-use")?.addEventListener("click",()=>p(`#set?recipe=${t.id}`)),e.querySelector("#pvw-btn-edit")?.addEventListener("click",()=>p(`#bld?id=${t.id}`)),e.querySelector("#pvw-btn-clone")?.addEventListener("click",async()=>{const a=await I(t.id);window.AuroraToast?.show({variant:"success",title:`"${a.name}" cloned`}),p(`#bld?id=${a.id}`)}),e.querySelector("#pvw-btn-compare")?.addEventListener("click",()=>{window._icTestImage?.file&&p(`#cmp?recipe=${t.id}&file=_test`)}),e.querySelector("#pvw-node-list")?.addEventListener("click",a=>{const i=a.target.closest(".pvw-node-row");if(!i)return;const n=i.dataset.nodeId;n&&(r=n,e.querySelectorAll(".pvw-node-row").forEach(o=>{const d=o.dataset.nodeId===n;o.classList.toggle("is-active",d),o.querySelector(".pvw-node-dot"),o.querySelector('.material-symbols-outlined[style*="color"]');const u=o.querySelector(".pvw-node-eye .material-symbols-outlined");u&&(u.textContent=d?"visibility":"visibility_off")}),window._icTestImage?.file&&l.triggerProcess())})}const y={"#0077ff":"linear-gradient(135deg, #0a1628 0%, #0044cc 100%)","#8b5cf6":"linear-gradient(135deg, #1a0a2e 0%, #6d28d9 100%)","#22c55e":"linear-gradient(135deg, #0a1e10 0%, #15803d 100%)","#f59e0b":"linear-gradient(135deg, #1e150a 0%, #b45309 100%)","#f472b6":"linear-gradient(135deg, #1e0a14 0%, #be185d 100%)","#374151":"linear-gradient(135deg, #111318 0%, #374151 100%)","#92400e":"linear-gradient(135deg, #1a0e06 0%, #92400e 100%)","#0ea5e9":"linear-gradient(135deg, #060e1a 0%, #0369a1 100%)"};function F(e){return e.coverColor&&y[e.coverColor]?`background:${y[e.coverColor]};`:"background:linear-gradient(135deg,#111318 0%,#1e293b 100%);"}let x=!1;function j(){if(x)return;x=!0;const e=document.createElement("style");e.textContent=`
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
      cursor:pointer; position:relative;
    }
    .pvw-node-row:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .pvw-node-row.is-active { background:rgba(0,119,255,0.08); color:var(--ps-text); }
    .pvw-node-row--header { color:var(--ps-text-faint); font-size:11px; gap:4px; cursor:default; }
    .pvw-node-row--header:hover { background:transparent; }
    .pvw-node-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
    .pvw-node-label { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pvw-node-variant-label { font-style:italic; }

    .pvw-node-eye { opacity:0; padding:2px; margin-left:auto; }
    .pvw-node-row:hover .pvw-node-eye, .pvw-node-row.is-active .pvw-node-eye { opacity:1; }
    .pvw-node-eye .material-symbols-outlined { font-size:16px; }

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

    .pvw-step-info {
      display:flex; align-items:center; gap:8px;
      padding:10px 16px; border-top:1px solid var(--ps-border); flex-shrink:0;
      background:var(--ps-bg-surface);
    }
  `,document.head.appendChild(e)}export{H as render};
