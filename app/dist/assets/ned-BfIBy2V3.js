import{a as G,s as K}from"./recipes-qesXpeyQ.js";import{n as E}from"./index-DpFMNAiN.js";import{r as W,I as J}from"./processor-BO1Q6VPM.js";import{e as Q}from"./exif-reader-DgBCZqHm.js";import"./misc-DpJZ-4k9.js";import"./ai-bgremoval-stlubUex.js";const Y={geo:"#38bdf8",color:"#a78bfa",overlay:"#fb923c",ai:"#34d399",flow:"#0077ff",meta:"#f472b6"};function Z(e,a){const i=`ned-param-${e.name}`,l=a??e.defaultValue??"";switch(e.type){case"boolean":return`
        <div class="ned-field">
          <label class="ned-field-label" for="${i}">${e.label}</label>
          <label class="ned-toggle">
            <input type="checkbox" id="${i}" name="${e.name}" ${l?"checked":""}>
            <span class="ned-toggle-track"></span>
          </label>
        </div>`;case"select":return`
        <div class="ned-field">
          <label class="ned-field-label" for="${i}">${e.label}</label>
          <select id="${i}" name="${e.name}" class="ic-input">
            ${(e.options||[]).map(o=>`<option value="${m(o.value)}" ${o.value==l?"selected":""}>${m(o.label)}</option>`).join("")}
          </select>
        </div>`;case"range":return`
        <div class="ned-field">
          <label class="ned-field-label" for="${i}">${e.label}
            <span id="${i}-val" class="mono text-sm" style="margin-left:auto;color:var(--ps-blue)">${l}</span>
          </label>
          <input type="range" id="${i}" name="${e.name}" class="ic-range"
            min="${e.min??0}" max="${e.max??100}" step="${e.step??1}" value="${l}">
        </div>`;case"color":return`
        <div class="ned-field">
          <label class="ned-field-label" for="${i}">${e.label}</label>
          <div class="ned-color-row">
            <input type="color" id="${i}" name="${e.name}" value="${l}" class="ned-color-input">
            <input type="text" id="${i}-hex" class="ic-input" value="${l}" maxlength="7"
              style="flex:1;font-family:var(--font-mono);font-size:12px">
          </div>
        </div>`;case"number":return`
        <div class="ned-field">
          <label class="ned-field-label" for="${i}">${e.label}</label>
          <input type="number" id="${i}" name="${e.name}" class="ic-input"
            value="${l}" ${e.min!=null?`min="${e.min}"`:""} ${e.max!=null?`max="${e.max}"`:""}
            ${e.step!=null?`step="${e.step}"`:""}>
        </div>`;case"textarea":return`
        <div class="ned-field">
          <label class="ned-field-label" for="${i}">${e.label}</label>
          <textarea id="${i}" name="${e.name}" class="ic-input" rows="4">${m(String(l))}</textarea>
        </div>`;default:return`
        <div class="ned-field">
          <label class="ned-field-label" for="${i}">${e.label}</label>
          <input type="text" id="${i}" name="${e.name}" class="ic-input" value="${m(String(l))}">
        </div>`}}function M(e,a){const i={};for(const l of a){const o=`ned-param-${l.name}`,p=e.querySelector(`#${o}`);p&&(l.type==="boolean"?i[l.name]=p.checked:l.type==="range"||l.type==="number"?i[l.name]=parseFloat(p.value):i[l.name]=p.value)}return i}function k(e,a){for(const i of e){if(i.id===a)return i;if(i.branches)for(const l of i.branches){const o=k(l.nodes,a);if(o)return o}if(i.thenNodes){const l=k(i.thenNodes,a);if(l)return l}if(i.elseNodes){const l=k(i.elseNodes,a);if(l)return l}}return null}async function ce(e,a){const i=new URLSearchParams(a.split("?")[1]||""),l=i.get("recipe"),o=i.get("node"),p=l?await G(l):null,n=p?k(p.nodes,o):null;if(!p||!n){e.innerHTML=`<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">Node not found</div>
        <button class="btn-primary" id="ned-back-btn">Back</button>
      </div></div></div>`,e.querySelector("#ned-back-btn")?.addEventListener("click",()=>window.history.back());return}const d=n.type==="transform"?W.get(n.transformId):null,_=d?.categoryKey||n.transformId?.split("-")[0]||"other",S=Y[_]||"#6b7280",L=n.type==="conditional",N=n.type==="branch",H=L?ee(n.condition):"",U=N?le(n):"",I=d?(d.params||[]).map(t=>Z(t,n.params?.[t.name])).join(""):"";e.innerHTML=`
    <div class="screen ned-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="ned-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="ned-node-icon" style="background:${S}20;border-color:${S}40">
            <span class="material-symbols-outlined" style="font-size:16px;color:${S}">${d?.icon||"tune"}</span>
          </div>
          <div>
            <div class="screen-title" style="font-size:15px">${d?.name||n.label||n.type}</div>
            ${d?.description?`<div class="text-sm text-muted" style="margin-top:2px">${d.description}</div>`:""}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary" id="ned-reset-btn">
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

          ${n.type==="transform"&&d?`
            <div class="ned-fields">
              ${I||'<div class="text-sm text-muted" style="padding:12px">No parameters for this step.</div>'}
            </div>`:""}

          ${H}
          ${U}

          <!-- Label override -->
          <div class="ned-section-title" style="margin-top:16px">
            <span class="material-symbols-outlined" style="font-size:14px">label</span>
            Display Label
          </div>
          <div class="ned-fields">
            <div class="ned-field">
              <label class="ned-field-label" for="ned-label-input">Step Label</label>
              <input type="text" id="ned-label-input" class="ic-input" value="${m(n.label||"")}" placeholder="Custom label…">
            </div>
          </div>
        </div>

        <!-- Preview panel -->
        <div class="ned-preview-panel">
          <div class="ned-preview-header">
            <div class="cmp-mode-toggle" role="group" id="ned-mode-toggle" style="display:none">
              <button class="cmp-mode-btn is-active" data-ned-mode="slider">
                <span class="material-symbols-outlined" style="font-size:14px">swap_horiz</span> Slider
              </button>
              <button class="cmp-mode-btn" data-ned-mode="side">
                <span class="material-symbols-outlined" style="font-size:14px">view_column</span> Side by Side
              </button>
            </div>
            <span class="text-sm text-muted" id="ned-preview-label" style="flex:1;padding-left:4px">Live Preview</span>
            <label class="btn-secondary" style="cursor:pointer;font-size:12px">
              <span class="material-symbols-outlined" style="font-size:14px">upload</span>
              Test Image
              <input type="file" id="ned-file-input" accept="image/*" style="display:none">
            </label>
          </div>
          <div id="ned-notice" class="ned-notice" style="display:none"></div>
          <div id="ned-preview-area" class="ned-preview-area">
            <div class="empty-state">
              <span class="material-symbols-outlined" style="font-size:40px">image</span>
              <div class="empty-state-title">Upload a test image</div>
              <div class="empty-state-desc">See a live before/after comparison for this step.</div>
            </div>
          </div>
        </div>
      </div>
    </div>`,ie();let f=null,x=null,u=null,g=null,q="slider",y=50,h=!1;e.querySelectorAll("[data-ned-mode]").forEach(t=>{t.addEventListener("click",()=>{q=t.dataset.nedMode,e.querySelectorAll("[data-ned-mode]").forEach(s=>s.classList.toggle("is-active",s===t)),u&&g&&j()})}),e.querySelector("#ned-back")?.addEventListener("click",()=>E(`#bld?id=${l}`)),e.querySelector("#ned-done-btn")?.addEventListener("click",async()=>{await B(),E(`#bld?id=${l}`)}),e.querySelector("#ned-reset-btn")?.addEventListener("click",()=>{if(!confirm("Reset all parameters to defaults?"))return;const t={};(d?.params||[]).forEach(s=>{t[s.name]=s.defaultValue??""}),n.params=t,E(`#ned?recipe=${l}&node=${o}`)}),e.querySelectorAll("input[type=range]").forEach(t=>{const s=e.querySelector(`#${t.id}-val`);s&&t.addEventListener("input",()=>{s.textContent=t.value,$()})}),e.querySelectorAll("input[type=color]").forEach(t=>{const s=e.querySelector(`#${t.id}-hex`);t.addEventListener("input",()=>{s&&(s.value=t.value),$()}),s?.addEventListener("input",r=>{/^#[0-9a-fA-F]{6}$/.test(r.target.value)&&(t.value=r.target.value,$())})}),e.querySelectorAll(".ic-input, input[type=checkbox]").forEach(t=>{t.type!=="color"&&t.addEventListener("change",$)}),e.querySelector("#ned-file-input")?.addEventListener("change",async t=>{const s=t.target.files?.[0];s&&(x=s,u&&URL.revokeObjectURL(u),u=URL.createObjectURL(s),f=new Image,await new Promise((r,v)=>{f.onload=r,f.onerror=v,f.src=u}),P())});let z=null;function $(){clearTimeout(z),z=setTimeout(P,300)}async function B(){d&&(n.params=M(e,d.params||[]));const t=e.querySelector("#ned-label-input");t&&(n.label=t.value||d?.name||n.type),L&&(n.condition=te(e)),await K(p)}const D=new Set(["overlay-map"]),F=new Set(["ai-face-privacy","geo-face-crop"]),O=new Set(["ai-remove-bg","ai-clipping-mask"]);function X(t,s){return D.has(t)&&!s?.gps?"⚠ This step uses GPS coordinates from EXIF data. The test image has no GPS — upload a geotagged photo to see the map overlay.":F.has(t)?"ℹ This step requires face detection (MediaPipe). Preview may take a moment on first use.":O.has(t)?"ℹ Background removal runs a WASM model — first preview may take several seconds to load.":null}async function P(){if(!f||!d)return;const t=e.querySelector("#ned-preview-area"),s=e.querySelector("#ned-notice");if(t)try{const r=M(e,d.params||[]),v=x?await Q(x):{},w={filename:x?.name||"test.jpg",exif:v,meta:{},variables:new Map},c=X(n.transformId,v);s&&(s.textContent=c||"",s.style.display=c?"block":"none");const b=new J;b.canvas.width=f.naturalWidth,b.canvas.height=f.naturalHeight,b.ctx.drawImage(f,0,0),await d.apply(b.ctx,r,w),g&&URL.revokeObjectURL(g),await new Promise(V=>b.canvas.toBlob(A=>{g=A?URL.createObjectURL(A):null,V()},"image/jpeg",.88));const R=e.querySelector("#ned-mode-toggle");R&&(R.style.display="");const C=e.querySelector("#ned-preview-label");C&&(C.textContent=""),j()}catch(r){t&&(t.innerHTML=`<div class="empty-state">
        <span class="material-symbols-outlined">error</span>
        <div class="empty-state-title">Preview failed</div>
        <div class="empty-state-desc">${m(r.message)}</div>
      </div>`)}}function j(){const t=e.querySelector("#ned-preview-area");if(!(!t||!u||!g))if(q==="side")t.innerHTML=`
        <div class="ned-side-view">
          <div class="ned-side">
            <div class="ned-side-label">Before</div>
            <img src="${u}" class="ned-cmp-img" draggable="false">
          </div>
          <div style="width:2px;background:var(--ps-border);flex-shrink:0"></div>
          <div class="ned-side">
            <div class="ned-side-label ned-side-label--blue">After</div>
            <img src="${g}" class="ned-cmp-img" draggable="false">
          </div>
        </div>`;else{let w=function(c){const b=s.getBoundingClientRect();y=Math.max(0,Math.min(100,(c-b.left)/b.width*100)),r&&(r.style.clipPath=`inset(0 ${100-y}% 0 0)`),v&&(v.style.left=`${y}%`)};y=50,t.innerHTML=`
        <div class="ned-slider-view" id="ned-slider-view">
          <img src="${u}" class="ned-cmp-img" draggable="false">
          <img src="${g}"  class="ned-cmp-img" id="ned-after-img" draggable="false"
               style="clip-path:inset(0 50% 0 0)">
          <div class="ned-slider-handle" id="ned-slider-handle" style="left:50%">
            <div class="ned-handle-line"></div>
            <div class="ned-handle-grip">
              <span class="material-symbols-outlined" style="font-size:15px">swap_horiz</span>
            </div>
          </div>
          <div class="ned-slider-badge ned-badge--left">Before</div>
          <div class="ned-slider-badge ned-badge--right">After</div>
        </div>`;const s=t.querySelector("#ned-slider-view"),r=t.querySelector("#ned-after-img"),v=t.querySelector("#ned-slider-handle");v?.addEventListener("mousedown",c=>{h=!0,c.preventDefault()}),document.addEventListener("mousemove",c=>{h&&w(c.clientX)}),document.addEventListener("mouseup",()=>{h=!1}),s?.addEventListener("click",c=>{h||w(c.clientX)})}}}function ee(e={}){const a=["width","height","aspectRatio","IsPortrait","HasGPS","MetaExists","exif.date","exif.author","meta.custom"],i=["exists","eq","neq","gt","lt","gte","lte","contains"];return`
    <div class="ned-section-title" style="margin-top:16px">
      <span class="material-symbols-outlined" style="font-size:14px">alt_route</span>
      Condition
    </div>
    <div class="ned-fields">
      <div class="ned-field">
        <label class="ned-field-label">Field</label>
        <select id="ned-cond-field" class="ic-input">
          ${a.map(l=>`<option value="${l}" ${l===e.field?"selected":""}>${l}</option>`).join("")}
          <option value="${e.field||""}" ${a.includes(e.field)?"":"selected"}>${e.field||"(custom)"}</option>
        </select>
      </div>
      <div class="ned-field">
        <label class="ned-field-label">Operator</label>
        <select id="ned-cond-op" class="ic-input">
          ${i.map(l=>`<option value="${l}" ${l===e.operator?"selected":""}>${l}</option>`).join("")}
        </select>
      </div>
      <div class="ned-field">
        <label class="ned-field-label">Value</label>
        <input type="text" id="ned-cond-value" class="ic-input" value="${m(String(e.value??""))}">
      </div>
    </div>`}function te(e){return{field:e.querySelector("#ned-cond-field")?.value||"width",operator:e.querySelector("#ned-cond-op")?.value||"gt",value:e.querySelector("#ned-cond-value")?.value||""}}function le(e){return`
    <div class="ned-section-title" style="margin-top:16px">
      <span class="material-symbols-outlined" style="font-size:14px">device_hub</span>
      Branch Variants
    </div>
    <div class="ned-fields">
      ${(e.branches||[]).map((a,i)=>`
        <div class="ned-field">
          <label class="ned-field-label">Variant ${i+1} Label</label>
          <input type="text" class="ic-input ned-branch-label" data-branch-idx="${i}" value="${m(a.label||"")}">
        </div>`).join("")}
      <div class="text-sm text-muted">Edit branch nodes in the Recipe Builder.</div>
    </div>`}function m(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}let T=!1;function ie(){if(T)return;T=!0;const e=document.createElement("style");e.textContent=`
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

    .ned-preview-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .ned-preview-header { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; flex-wrap:wrap; }
    .ned-notice { padding:8px 14px; font-size:12px; color:#f59e0b; background:rgba(245,158,11,0.08); border-bottom:1px solid rgba(245,158,11,0.2); flex-shrink:0; line-height:1.5; }
    .ned-preview-area {
      flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/32px 32px;
    }

    /* Comparison layouts */
    .ned-side-view { display:flex; width:100%; height:100%; }
    .ned-side { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
    .ned-cmp-img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; }
    .ned-side-label { position:absolute; top:8px; left:8px; z-index:2; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; font-weight:600; padding:2px 7px; border-radius:12px; font-family:var(--font-mono); }
    .ned-side-label--blue { background:rgba(0,119,255,0.85); }

    .ned-slider-view { position:relative; width:100%; height:100%; overflow:hidden; user-select:none; cursor:col-resize; }
    .ned-slider-handle { position:absolute; top:0; height:100%; transform:translateX(-50%); display:flex; align-items:center; z-index:10; pointer-events:none; }
    .ned-handle-line { position:absolute; top:0; left:50%; width:2px; height:100%; background:rgba(255,255,255,0.9); transform:translateX(-50%); box-shadow:0 0 6px rgba(0,0,0,0.4); }
    .ned-handle-grip { position:relative; z-index:1; width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.95); box-shadow:0 2px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; cursor:col-resize; pointer-events:all; color:#111; }
    .ned-slider-badge { position:absolute; top:8px; z-index:5; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; font-weight:600; padding:2px 7px; border-radius:12px; font-family:var(--font-mono); }
    .ned-badge--left { left:8px; }
    .ned-badge--right { right:8px; background:rgba(0,119,255,0.85); }

    /* Mode toggle (shared with cmp/out) */
    .cmp-mode-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden; }
    .cmp-mode-btn { display:flex; align-items:center; gap:5px; padding:5px 10px; font-size:12px; font-weight:500; background:transparent; border:none; color:var(--ps-text-muted); cursor:pointer; font-family:var(--font-primary); transition:background 150ms,color 150ms; }
    .cmp-mode-btn.is-active { background:var(--ps-blue); color:#fff; }
    .cmp-mode-btn:hover:not(.is-active) { background:var(--ps-bg-hover); color:var(--ps-text); }
  `,document.head.appendChild(e)}export{ce as render};
