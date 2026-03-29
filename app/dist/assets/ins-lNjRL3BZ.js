import{a as y,c as h}from"./blocks-DHwz8iYS.js";import{n as m}from"./index-DpFMNAiN.js";import{r as w,I as k}from"./processor-BO1Q6VPM.js";import{e as S}from"./exif-reader-DgBCZqHm.js";import{f as $}from"./misc-DpJZ-4k9.js";import"./ai-bgremoval-stlubUex.js";function p(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}const L={geo:"#38bdf8",color:"#a78bfa",overlay:"#fb923c",ai:"#34d399",flow:"#0077ff",meta:"#f472b6"};async function R(s,g){const u=new URLSearchParams(g.split("?")[1]||"").get("id");if(!u){m("#bkb");return}const t=await y(u);if(!t){s.innerHTML=`<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
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
            ${p(t.name)}
          </div>
          <span class="ic-badge">${p(t.category||"General")}</span>
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
              ${t.description?`<p class="ins-desc">${p(t.description)}</p>`:""}
              <div class="text-sm text-muted">
                ${t.nodes.length} step${t.nodes.length!==1?"s":""}
                &nbsp;·&nbsp;
                Updated ${t.updatedAt?$(t.updatedAt):"—"}
              </div>
            </div>
          </div>

          <div class="ins-steps-title">Steps</div>
          <div class="ins-steps-list">
            ${t.nodes.length===0?'<div class="empty-state" style="padding:24px"><div class="empty-state-title">No steps</div></div>':t.nodes.map((e,i)=>{const a=w.get(e.transformId),n=a?.categoryKey||e.transformId?.split("-")[0]||"other",o=L[n]||"#6b7280",d=e.label||a?.name||e.type;return`
                    <div class="ins-step-row" data-idx="${i}">
                      <span class="ins-step-num">${i+1}</span>
                      <span class="material-symbols-outlined" style="font-size:14px;color:${o};flex-shrink:0">${a?.icon||"tune"}</span>
                      <span class="ins-step-label">${p(d)}</span>
                    </div>`}).join("")}
          </div>
        </div>

        <!-- Right: preview -->
        <div class="ins-preview-panel">
          <div class="ins-preview-header">
            <span class="text-sm text-muted">Test Image</span>
            <label class="btn-secondary" style="cursor:pointer">
              <span class="material-symbols-outlined">upload</span>
              Upload Image
              <input type="file" id="ins-file-input" accept="image/*" style="display:none">
            </label>
          </div>

          <div id="ins-preview-area" class="ins-preview-area">
            <div class="empty-state">
              <span class="material-symbols-outlined" style="font-size:48px">image</span>
              <div class="empty-state-title">Upload a test image</div>
              <div class="empty-state-desc">Preview how this block transforms images.</div>
            </div>
          </div>

          <div id="ins-step-scrubber" class="ins-step-scrubber" style="display:none">
            <span class="text-sm text-muted" style="flex-shrink:0">Step:</span>
            <input type="range" id="ins-step-slider" class="ic-range" min="0" value="0" style="flex:1">
            <span id="ins-step-label" class="mono text-sm" style="min-width:80px;text-align:right">Original</span>
          </div>
        </div>
      </div>
    </div>`,q(),s.querySelector("#ins-back")?.addEventListener("click",()=>m("#bkb")),s.querySelector("#ins-edit-btn")?.addEventListener("click",()=>m(`#bkb?id=${t.id}`)),s.querySelector("#ins-clone-btn")?.addEventListener("click",async()=>{const e=await h(t.id);window.AuroraToast?.show({variant:"success",title:`"${e.name}" cloned`}),m(`#bkb?id=${e.id}`)}),s.querySelectorAll(".ins-step-row").forEach(e=>{e.addEventListener("click",()=>{const i=parseInt(e.dataset.idx)+1,a=s.querySelector("#ins-step-slider");a&&(a.value=i,v(i))})});let r=[];s.querySelector("#ins-step-slider")?.addEventListener("input",e=>v(parseInt(e.target.value))),s.querySelector("#ins-file-input")?.addEventListener("change",async e=>{const i=e.target.files?.[0];i&&await x(i)});async function x(e){const i=s.querySelector("#ins-preview-area");if(i){i.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:12px"><div class="spinner spinner--lg"></div><div class="text-sm text-muted">Processing…</div></div>';try{const a=URL.createObjectURL(e),n=new Image;await new Promise((l,c)=>{n.onload=l,n.onerror=c,n.src=a});const o=await S(e),d={filename:e.name,exif:o,meta:{}};r=[{label:"Original",dataUrl:a}];for(let l=0;l<t.nodes.length;l++){const c=new k;await c.process(n,t.nodes,{...d,variables:new Map},l),r.push({label:t.nodes[l].label||t.nodes[l].transformId||t.nodes[l].type,dataUrl:c.canvas.toDataURL("image/jpeg",.85)})}const b=s.querySelector("#ins-step-slider");b&&(b.max=r.length-1,b.value=r.length-1),s.querySelector("#ins-step-scrubber").style.display="flex",v(r.length-1)}catch(a){const n=s.querySelector("#ins-preview-area");n&&(n.innerHTML=`<div class="empty-state"><span class="material-symbols-outlined">error</span><div class="empty-state-desc">${p(a.message)}</div></div>`)}}}function v(e){const i=r[e];if(!i)return;const a=s.querySelector("#ins-step-label");a&&(a.textContent=e===0?"Original":`Step ${e}: ${i.label}`);const n=s.querySelector("#ins-preview-area");n&&(n.innerHTML=`<img src="${i.dataUrl}" class="ins-result-img" draggable="false">`),s.querySelectorAll(".ins-step-row").forEach((o,d)=>{o.classList.toggle("ins-step-row--active",d===e-1)})}}let f=!1;function q(){if(f)return;f=!0;const s=document.createElement("style");s.textContent=`
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
  `,document.head.appendChild(s)}export{R as render};
