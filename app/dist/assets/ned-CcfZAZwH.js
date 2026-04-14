const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/image-workspace-BhyNGQoU.js","assets/ai-bgremoval-CLcXU_4U.js","assets/video-frame-DqH3KaHz.js"])))=>i.map(i=>d[i]);
import{_ as M}from"./ai-bgremoval-CLcXU_4U.js";import{g as D,s as W}from"./recipes-C3zZWtxZ.js";import{n as $}from"./index-Cvca53V-.js";import{u as G}from"./misc-BYzs6oS8.js";import{s as T}from"./dialogs-CUir_jZ5.js";import{r as I,I as K}from"./video-Dd42h0XN.js";import{extractExif as X}from"./exif-reader-CP0g5Y5B.js";import{r as J,b as Q,c as U}from"./param-fields-DZh8XYSX.js";import{i as Y,e as Z}from"./video-frame-DqH3KaHz.js";const ee={geo:"#38bdf8",color:"#a78bfa",overlay:"#fb923c",ai:"#34d399",flow:"#0077ff",meta:"#f472b6"};function h(e,d){for(const r of e){if(r.id===d)return r;if(r.branches)for(const i of r.branches){const v=h(i.nodes,d);if(v)return v}if(r.thenNodes){const i=h(r.thenNodes,d);if(i)return i}if(r.elseNodes){const i=h(r.elseNodes,d);if(i)return i}}return null}async function ue(e,d){const r=new URLSearchParams(d.split("?")[1]||""),i=r.get("recipe"),v=r.get("node"),x=i?await D(i):null,a=x?h(x.nodes,v):null;if(!x||!a){e.innerHTML=`<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">Node not found</div>
        <button class="btn-primary" id="ned-back-btn">Back</button>
      </div></div></div>`,e.querySelector("#ned-back-btn")?.addEventListener("click",()=>window.history.back());return}const l=a.type==="transform"?I.get(a.transformId):null,P=l?.categoryKey||a.transformId?.split("-")[0]||"other",y=ee[P]||"#6b7280",S=a.type==="conditional",_=a.type==="branch",C=S?te(a.condition):"",z=_?F(a):"",O=l?(l.params||[]).map(t=>J(t,a.params?.[t.name],"ned")).join(""):"";e.innerHTML=`
    <div class="screen ned-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="ned-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="ned-node-icon" style="background:${y}20;border-color:${y}40">
            <span class="material-symbols-outlined" style="font-size:16px;color:${y}">${l?.icon||"tune"}</span>
          </div>
          <div>
            <div class="screen-title" style="font-size:15px">${l?.name||a.label||a.type}</div>
            ${l?.description?`<div class="text-sm text-muted" style="margin-top:2px">${l.description}</div>`:""}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary" id="ned-btn-reset">
            <span class="material-symbols-outlined">restart_alt</span>
            Reset
          </button>
          <button class="btn-primary" id="ned-done-btn">
            <span class="material-symbols-outlined">check</span>
            Done
          </button>
        </div>
      </div>

      <div class="ned-body">
        <!-- Params panel -->
        <div class="ned-params-panel">
          <div class="ned-section-title">
            <span class="material-symbols-outlined" style="font-size:14px">settings</span>
            Parameters
          </div>

          ${a.type==="transform"&&l?`
            <div class="ned-fields">
              ${O||'<div class="text-sm text-muted" style="padding:12px">No parameters for this step.</div>'}
            </div>`:""}

          ${C}
          <div id="ned-branches-wrapper">
            ${z}
          </div>

          <!-- Label override -->
          <div class="ned-section-title" style="margin-top:16px">
            <span class="material-symbols-outlined" style="font-size:14px">label</span>
            Display Label
          </div>
          <div class="ned-fields">
            <div class="ned-field">
              <label class="ned-field-label" for="ned-label-input">Step Label</label>
              <input type="text" id="ned-label-input" class="ic-input" value="${E(a.label||"")}" placeholder="Custom label…">
            </div>
          </div>
        </div>

        <!-- Preview panel -->
        <div class="ned-preview-panel" style="position:relative">
          <div id="ned-notice" class="ned-notice" style="display:none;position:absolute;top:0;left:0;right:0;z-index:20;"></div>
          <div id="ned-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0"></div>
        </div>
      </div>
    </div>`,ne(),l&&l.params&&Q(e,l.params,"ned");let R=null;function b(){clearTimeout(R),R=setTimeout(()=>w?.triggerProcess(),300)}const{ImageWorkspace:V}=await M(async()=>{const{ImageWorkspace:t}=await import("./image-workspace-BhyNGQoU.js");return{ImageWorkspace:t}},__vite__mapDeps([0,1,2])),A=e.querySelector("#ned-workspace-container"),w=new V(A,{allowUpload:!0,allowFolder:!0,onFilesChange:(t,s)=>{window._icTestFolderFiles=t,window._icTestImage={file:s}},onRender:async t=>{if(!l)return{beforeUrl:URL.createObjectURL(t),afterUrl:URL.createObjectURL(t)};const s=U(e,l.params||[],"ned"),n=await X(t);let o=null;a.transformId==="flow-geo-timeline"&&!n?.gps?.lat&&(o="Timeline requires an image with GPS Exif data. This step will skip images lacking location metadata.");const u=e.querySelector("#ned-notice");u&&(u.textContent=o||"",u.style.display=o?"block":"none");const m={filename:t.name,exif:n,meta:{},variables:new Map,originalFile:t,_previewMode:!0};let c,k;if(Y(t)){const f=await Z(t);c=f,k=await new Promise(p=>f.toBlob(L=>p(URL.createObjectURL(L)),"image/jpeg",.88))}else{const f=URL.createObjectURL(t),p=new Image;await new Promise((L,B)=>{p.onload=L,p.onerror=B,p.src=f}),c=p,k=f}const g=new K;g.canvas.width=c.width??c.naturalWidth,g.canvas.height=c.height??c.naturalHeight,g.ctx.drawImage(c,0,0);const q=l.sourceTransformId?I.get(l.sourceTransformId):l;if(q?.apply)try{await q.apply(g.ctx,s,m)}catch{}const N=await new Promise(f=>g.canvas.toBlob(p=>{f(p?URL.createObjectURL(p):null)},"image/jpeg",.88));return{beforeUrl:k,afterUrl:N,beforeLabel:"Original",afterLabel:"Result",context:m}}});if(window._icTestFolderFiles&&window._icTestFolderFiles.length>0){const t=window._icTestFolderFiles.findIndex(s=>s.name===window._icTestImage?.file?.name);w.setFiles(window._icTestFolderFiles,t>=0?t:0)}else window._icTestImage?.file&&w.setFiles([window._icTestImage.file]);e.querySelector("#ned-back")?.addEventListener("click",()=>$(`#bld?id=${i}`));const H=async()=>{l&&(a.params=U(e,l.params||[],"ned")),S&&(a.condition=ae(e));const t=e.querySelector("#ned-label-input");t&&(a.label=t.value.trim()),await W(x)};if(e.querySelector("#ned-done-btn")?.addEventListener("click",async()=>{await H(),$(`#bld?id=${i}`)}),e.querySelector("#ned-btn-reset")?.addEventListener("click",async()=>{if(!await T({title:"Reset Parameters?",body:"This will restore all settings in this step to their factory defaults. This action cannot be undone.",confirmText:"Reset",variant:"warning",icon:"restart_alt"}))return;const s={};(l?.params||[]).forEach(n=>{s[n.name]=n.defaultValue??""}),a.params=s,$(`#ned?recipe=${i}&node=${v}`)}),e.querySelectorAll("input[type=range]").forEach(t=>{const s=e.querySelector(`#${t.id}-val`);s&&t.addEventListener("input",()=>{s.textContent=t.value,b()})}),e.querySelectorAll("input[type=color]").forEach(t=>{const s=e.querySelector(`#${t.id}-hex`);t.addEventListener("input",()=>{s&&(s.value=t.value),b()}),s?.addEventListener("input",n=>{/^#[0-9a-fA-F]{6}$/.test(n.target.value)&&(t.value=n.target.value,b())})}),e.querySelectorAll(".ic-input:not(.ned-branch-label), input[type=checkbox]").forEach(t=>{t.type!=="color"&&t.addEventListener("change",b)}),e.querySelectorAll(".ned-file-browse-btn").forEach(t=>{const s=t.dataset.target,n=e.querySelector(`#${s}-picker`),o=e.querySelector(`#${s}`);t.addEventListener("click",()=>n?.click()),n?.addEventListener("change",u=>{const m=u.target.files?.[0];if(!m||!o)return;o._objectUrl&&URL.revokeObjectURL(o._objectUrl);const c=URL.createObjectURL(m);o._objectUrl=c,o.value=c,b()})}),_){const t=()=>{e.querySelector("#ned-btn-add-branch")?.addEventListener("click",()=>{const n=String.fromCharCode(65+(a.branches||[]).length);a.branches.push({id:G(),label:`Variant ${n}`,nodes:[]}),s()}),e.querySelectorAll(".ned-btn-del-branch").forEach(n=>{n.addEventListener("click",async o=>{const u=parseInt(n.dataset.idx);a.branches.length<=1||!await T({title:"Remove Variant?",body:"This will delete the selected branch and every transformation step within it.",confirmText:"Remove Variant",variant:"danger",icon:"delete_sweep"})||(a.branches.splice(u,1),s())})}),e.querySelectorAll(".ned-branch-label").forEach(n=>{n.addEventListener("input",()=>{const o=parseInt(n.dataset.branchIdx);a.branches[o].label=n.value})})},s=()=>{const n=e.querySelector("#ned-branches-wrapper");n&&(n.innerHTML=F(a),t(),b())};t()}}function te(e={}){const d=["width","height","aspectRatio","IsPortrait","HasGPS","MetaExists","exif.date","exif.author","meta.custom"],r=["exists","eq","neq","gt","lt","gte","lte","contains"];return`
    <div class="ned-section-title" style="margin-top:16px">
      <span class="material-symbols-outlined" style="font-size:14px">alt_route</span>
      Condition
    </div>
    <div class="ned-fields">
      <div class="ned-field">
        <label class="ned-field-label">Field</label>
        <select id="ned-cond-field" class="ic-input">
          ${d.map(i=>`<option value="${i}" ${i===e.field?"selected":""}>${i}</option>`).join("")}
          <option value="${e.field||""}" ${d.includes(e.field)?"":"selected"}>${e.field||"(custom)"}</option>
        </select>
      </div>
      <div class="ned-field">
        <label class="ned-field-label">Operator</label>
        <select id="ned-cond-op" class="ic-input">
          ${r.map(i=>`<option value="${i}" ${i===e.operator?"selected":""}>${i}</option>`).join("")}
        </select>
      </div>
      <div class="ned-field">
        <label class="ned-field-label">Value</label>
        <input type="text" id="ned-cond-value" class="ic-input" value="${E(String(e.value??""))}">
      </div>
    </div>`}function ae(e){return{field:e.querySelector("#ned-cond-field")?.value||"width",operator:e.querySelector("#ned-cond-op")?.value||"gt",value:e.querySelector("#ned-cond-value")?.value||""}}function F(e){return`
    <div class="ned-section-title" style="margin-top:16px">
      <span class="material-symbols-outlined" style="font-size:14px">device_hub</span>
      Branch Variants
    </div>
    <div class="ned-fields">
      ${(e.branches||[]).map((d,r)=>`
        <div class="ned-field">
          <div class="flex items-center gap-2">
            <div style="flex:1">
              <label class="ned-field-label">Variant ${r+1} Label</label>
              <input type="text" class="ic-input ned-branch-label" data-branch-idx="${r}" value="${E(d.label||"")}" placeholder="Variant label…">
            </div>
            ${e.branches.length>1?`
              <button class="btn-icon ned-btn-del-branch" data-idx="${r}" title="Remove variant" style="margin-top:18px">
                <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-red)">delete</span>
              </button>`:""}
          </div>
        </div>`).join("")}
      <button class="btn-secondary" id="ned-btn-add-branch" style="margin-top:4px">
        <span class="material-symbols-outlined" style="font-size:14px">add</span>
        Add Variant
      </button>
    </div>`}function E(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}let j=!1;function ne(){if(j)return;j=!0;const e=document.createElement("style");e.textContent=`
    .ned-screen { display:flex; flex-direction:column; height:100%; }
    .ned-body { display:flex; flex:1; overflow:hidden; }
    .ned-node-icon { width:32px; height:32px; border-radius:8px; border:1px solid; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

    .ned-params-panel { width:320px; flex-shrink:0; border-right:1px solid var(--ps-border); overflow-y:auto; }
    .ned-section-title {
      display:flex; align-items:center; gap:6px;
      font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em;
      color:var(--ps-text-faint); padding:12px 16px 6px;
    }
    .ned-fields { padding:4px 16px 12px; display:flex; flex-direction:column; gap:10px; }
    .ned-field { display:flex; flex-direction:column; gap:4px; }
    .ned-field-label { display:flex; align-items:center; font-size:12px; color:var(--ps-text-muted); font-weight:500; }

    .ned-toggle { display:flex; align-items:center; cursor:pointer; width:fit-content; }
    .ned-toggle input { display:none; }
    .ned-toggle-track {
      width:36px; height:20px; border-radius:10px; background:var(--ps-bg-app);
      border:1px solid var(--ps-border); position:relative; transition:background 150ms, border-color 150ms;
    }
    .ned-toggle-track::after {
      content:''; position:absolute; top:2px; left:2px; width:14px; height:14px;
      border-radius:50%; background:#fff; transition:transform 150ms;
    }
    .ned-toggle input:checked + .ned-toggle-track { background:var(--ps-blue); border-color:var(--ps-blue); }
    .ned-toggle input:checked + .ned-toggle-track::after { transform:translateX(16px); }

    .ned-color-row { display:flex; align-items:center; gap:6px; }
    .ned-color-input { width:36px; height:32px; padding:2px; border:1px solid var(--ps-border); border-radius:6px; background:var(--ps-bg-app); cursor:pointer; }
    .ned-file-row { display:flex; align-items:center; gap:6px; }
    .ned-file-path { flex:1; min-width:0; color:var(--ps-text-muted); font-size:11px; font-family:var(--font-mono); cursor:default; }

    .ned-preview-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .ned-preview-header { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; flex-wrap:wrap; }
    .ned-notice { padding:8px 14px; font-size:12px; color:#f59e0b; background:rgba(245,158,11,0.08); border-bottom:1px solid rgba(245,158,11,0.2); flex-shrink:0; line-height:1.5; }
    .ned-preview-area {
      flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/32px 32px;
    }


  `,document.head.appendChild(e)}export{ue as render};
