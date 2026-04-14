const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/image-workspace-BhyNGQoU.js","assets/ai-bgremoval-CLcXU_4U.js","assets/video-frame-DqH3KaHz.js"])))=>i.map(i=>d[i]);
import{_ as w}from"./ai-bgremoval-CLcXU_4U.js";import{g as y}from"./recipes-C3zZWtxZ.js";import{n as f}from"./index-Cvca53V-.js";import{I as k}from"./video-Dd42h0XN.js";import{extractExif as _}from"./exif-reader-CP0g5Y5B.js";import"./misc-BYzs6oS8.js";function C(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}async function q(e,b){const l=new URLSearchParams(b.split("?")[1]||"").get("recipe"),t=l?await y(l):null;e.innerHTML=`
    <div class="screen cmp-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="cmp-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">compare</span>
            ${t?C(t.name):"Comparison"}
          </div>
        </div>
      </div>

      <!-- Unified Image Workspace -->
      <div id="cmp-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0"></div>

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
    </div>`,S();let a=null;e.querySelector("#cmp-back")?.addEventListener("click",()=>{t?f(`#pvw?id=${t.id}`):f("#lib")});const{ImageWorkspace:u}=await w(async()=>{const{ImageWorkspace:i}=await import("./image-workspace-BhyNGQoU.js");return{ImageWorkspace:i}},__vite__mapDeps([0,1,2])),x=e.querySelector("#cmp-workspace-container"),h=new u(x,{allowUpload:!0,allowFolder:!1,onFilesChange:(i,o)=>{window._icCmpFile=o},onRender:async i=>{const o=URL.createObjectURL(i),r=new Image;await new Promise((n,v)=>{r.onload=n,r.onerror=v,r.src=o});const c=await _(i);window._icCmpTargetExif=c;const p={filename:i.name,exif:c,meta:{},variables:new Map};let s=o;if(a=null,t){const n=new k;await n.process(r,t.nodes,p),a=n.canvas,s=n.canvas.toDataURL("image/jpeg",.92)}window._icCmpAfterUrl=s;const d=e.querySelector("#cmp-before-info"),m=e.querySelector("#cmp-after-info");return d&&(d.textContent=`${r.naturalWidth}×${r.naturalHeight}`),a&&m&&(m.textContent=`${a.width}×${a.height}`),e.querySelector("#cmp-footer").style.display="flex",{beforeUrl:o,afterUrl:s,beforeLabel:"Original",afterLabel:t?t.name:"Result",context:p}}});window._icCmpFile&&h.setFiles([window._icCmpFile]),e.querySelector("#cmp-btn-save")?.addEventListener("click",()=>{a&&a.toBlob(i=>{const o=document.createElement("a");o.href=URL.createObjectURL(i),o.download=`${t?.name?.replace(/\\s+/g,"_")||"output"}_after.jpg`,o.click()},"image/jpeg",.92)})}let g=!1;function S(){if(g)return;g=!0;const e=document.createElement("style");e.textContent=`
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
  `,document.head.appendChild(e)}export{q as render};
