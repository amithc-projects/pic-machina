const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/image-workspace-BhyNGQoU.js","assets/ai-bgremoval-CLcXU_4U.js","assets/video-frame-DqH3KaHz.js"])))=>i.map(i=>d[i]);
import{_ as $}from"./ai-bgremoval-CLcXU_4U.js";import{getBlock as I,cloneBlock as L}from"./blocks-_SxbKKDb.js";import{n as b}from"./index-Cvca53V-.js";import{r as _,I as U}from"./video-Dd42h0XN.js";import{extractExif as q}from"./exif-reader-CP0g5Y5B.js";import{f as E}from"./misc-BYzs6oS8.js";function f(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}const j={geo:"#38bdf8",color:"#a78bfa",overlay:"#fb923c",ai:"#34d399",flow:"#0077ff",meta:"#f472b6"};async function D(s,y){const x=new URLSearchParams(y.split("?")[1]||"").get("id");if(!x){b("#bkb");return}const t=await I(x);if(!t){s.innerHTML=`<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">Block not found</div>
        <button class="btn-primary" onclick="navigate('#bkb')">Back to Blocks</button>
      </div></div></div>`;return}s.innerHTML=`
    <div class="screen ins-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="ins-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">widgets</span>
            ${f(t.name)}
          </div>
          <span class="ic-badge">${f(t.category||"General")}</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary" id="ins-edit-btn">
            <span class="material-symbols-outlined">edit</span>
            Edit Block
          </button>
          <button class="btn-secondary" id="ins-clone-btn">
            <span class="material-symbols-outlined">content_copy</span>
            Clone
          </button>
        </div>
      </div>

      <div class="ins-body">
        <!-- Left: meta + steps -->
        <div class="ins-sidebar">
          <div class="ins-meta">
            <div class="ins-meta-icon">
              <span class="material-symbols-outlined" style="font-size:32px;color:var(--ps-blue)">widgets</span>
            </div>
            <div>
              ${t.description?`<p class="ins-desc">${f(t.description)}</p>`:""}
              <div class="text-sm text-muted">
                ${t.nodes.length} step${t.nodes.length!==1?"s":""}
                &nbsp;·&nbsp;
                Updated ${t.updatedAt?E(t.updatedAt):"—"}
              </div>
            </div>
          </div>

          <div class="ins-steps-title">Steps</div>
          <div class="ins-steps-list">
            ${t.nodes.length===0?'<div class="empty-state" style="padding:24px"><div class="empty-state-title">No steps</div></div>':t.nodes.map((e,i)=>{const n=_.get(e.transformId),o=n?.categoryKey||e.transformId?.split("-")[0]||"other",d=j[o]||"#6b7280",c=e.label||n?.name||e.type;return`
                    <div class="ins-step-row" data-idx="${i}">
                      <span class="ins-step-num">${i+1}</span>
                      <span class="material-symbols-outlined" style="font-size:14px;color:${d};flex-shrink:0">${n?.icon||"tune"}</span>
                      <span class="ins-step-label">${f(c)}</span>
                    </div>`}).join("")}
          </div>
        </div>

        <!-- Right: preview -->
        <div class="ins-preview-panel" style="display:flex;flex-direction:column;">
          <div id="ins-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0"></div>
          
          <div id="ins-step-scrubber" class="ins-step-scrubber" style="display:none">
            <span class="text-sm text-muted" style="flex-shrink:0">Step:</span>
            <input type="range" id="ins-step-slider" class="ic-range" min="0" value="0" style="flex:1">
            <span id="ins-step-label" class="mono text-sm" style="min-width:80px;text-align:right">Original</span>
          </div>
        </div>
      </div>
    </div>`,O(),s.querySelector("#ins-back")?.addEventListener("click",()=>b("#bkb")),s.querySelector("#ins-edit-btn")?.addEventListener("click",()=>b(`#bkb?id=${t.id}`)),s.querySelector("#ins-clone-btn")?.addEventListener("click",async()=>{const e=await L(t.id);window.AuroraToast?.show({variant:"success",title:`"${e.name}" cloned`}),b(`#bkb?id=${e.id}`)});let a=[],m=null,l=0,u=null;const{ImageWorkspace:w}=await $(async()=>{const{ImageWorkspace:e}=await import("./image-workspace-BhyNGQoU.js");return{ImageWorkspace:e}},__vite__mapDeps([0,1,2])),h=s.querySelector("#ins-workspace-container"),g=new w(h,{allowUpload:!0,allowFolder:!1,onFilesChange:(e,i)=>{window._icTestImage={file:i},u=i,i||(s.querySelector("#ins-step-scrubber").style.display="none",a=[],m=null)},onRender:async e=>{if(m!==e){m=e;const i=URL.createObjectURL(e),n=new Image;await new Promise((r,p)=>{n.onload=r,n.onerror=p,n.src=i});const o=await q(e),d={filename:e.name,exif:o,meta:{}};a=[{label:"Original",dataUrl:i}];for(let r=0;r<t.nodes.length;r++){const p=new U;await p.process(n,t.nodes,{...d,variables:new Map},r);const S=t.nodes[r].label||t.nodes[r].transformId||t.nodes[r].type;a.push({label:S,dataUrl:p.canvas.toDataURL("image/jpeg",.85)})}l=a.length-1;const c=s.querySelector("#ins-step-slider");c&&(c.max=a.length-1,c.value=l),s.querySelector("#ins-step-scrubber").style.display="flex"}return k(l),{beforeUrl:a[0]?.dataUrl,afterUrl:a[l]?.dataUrl||a[0]?.dataUrl,beforeLabel:"Original",afterLabel:l===0?"Original":`Step ${l}: ${a[l]?.label}`,context:{filename:e.name}}}});window._icTestImage?.file&&g.setFiles([window._icTestImage.file]);function k(e){const i=a[e];if(!i)return;const n=s.querySelector("#ins-step-label");n&&(n.textContent=e===0?"Original":`Step ${e}: ${i.label}`),s.querySelectorAll(".ins-step-row").forEach((o,d)=>{o.classList.toggle("ins-step-row--active",d===e-1)})}s.querySelectorAll(".ins-step-row").forEach(e=>{e.addEventListener("click",()=>{const i=parseInt(e.dataset.idx)+1,n=s.querySelector("#ins-step-slider");n&&(n.value=i),l=i,u&&g.triggerProcess()})}),s.querySelector("#ins-step-slider")?.addEventListener("input",e=>{l=parseInt(e.target.value),u&&g.triggerProcess()})}let v=!1;function O(){if(v)return;v=!0;const s=document.createElement("style");s.textContent=`
    .ins-screen { display:flex; flex-direction:column; height:100%; }
    .ins-body { display:flex; flex:1; overflow:hidden; }

    .ins-sidebar { width:280px; flex-shrink:0; border-right:1px solid var(--ps-border); overflow-y:auto; display:flex; flex-direction:column; }
    .ins-meta { display:flex; align-items:flex-start; gap:12px; padding:16px; border-bottom:1px solid var(--ps-border); }
    .ins-meta-icon { width:52px; height:52px; border-radius:12px; background:rgba(0,119,255,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ins-desc { font-size:12px; color:var(--ps-text-muted); line-height:1.5; margin-bottom:6px; }
    .ins-steps-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--ps-text-faint); padding:12px 16px 6px; flex-shrink:0; }
    .ins-steps-list { flex:1; overflow-y:auto; }

    .ins-step-row {
      display:flex; align-items:center; gap:8px; padding:8px 16px;
      cursor:pointer; transition:background 100ms; border-radius:0;
    }
    .ins-step-row:hover { background:var(--ps-bg-hover); }
    .ins-step-row--active { background:rgba(0,119,255,0.08); }
    .ins-step-num { width:18px; height:18px; border-radius:50%; background:var(--ps-bg-app); border:1px solid var(--ps-border); font-size:10px; font-family:var(--font-mono); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--ps-text-muted); }
    .ins-step-label { font-size:12px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    .ins-preview-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .ins-preview-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .ins-preview-area {
      flex:1; display:flex; align-items:center; justify-content:center; overflow:auto;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/32px 32px;
    }
    .ins-result-img { max-width:100%; max-height:100%; object-fit:contain; display:block; }
    .ins-step-scrubber { display:flex; align-items:center; gap:10px; padding:10px 16px; border-top:1px solid var(--ps-border); flex-shrink:0; background:var(--ps-bg-surface); }
  `,document.head.appendChild(s)}export{D as render};
