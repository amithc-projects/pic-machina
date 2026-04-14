const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-Di01Xwv9.js","assets/video-Dd42h0XN.js","assets/ai-bgremoval-CLcXU_4U.js","assets/misc-BYzs6oS8.js","assets/exif-reader-CP0g5Y5B.js","assets/video-convert-3sdvReg3.js","assets/info-modal-c7GOmgUS.js","assets/image-info-RCB_TI9T.js","assets/image-workspace-BhyNGQoU.js","assets/video-frame-DqH3KaHz.js"])))=>i.map(i=>d[i]);
import{_ as V}from"./ai-bgremoval-CLcXU_4U.js";import{g as be,f as Z,a as me}from"./recipes-C3zZWtxZ.js";import{getAllBlocks as ue}from"./blocks-_SxbKKDb.js";import{n as S}from"./index-Cvca53V-.js";import{s as fe}from"./dialogs-CUir_jZ5.js";import{d as ve,u as T}from"./misc-BYzs6oS8.js";import{r as N,I as ee}from"./video-Dd42h0XN.js";import{extractExif as ge}from"./exif-reader-CP0g5Y5B.js";import{f as U,c as ye,a as q}from"./nodes-D1JCSoz2.js";import{i as xe,e as he}from"./video-frame-DqH3KaHz.js";const de={"Geometric & Framing":{key:"geo",color:"#38bdf8"},"Color & Tone":{key:"color",color:"#a78bfa"},"Overlays & Text":{key:"overlay",color:"#fb923c"},"AI & Vision":{key:"ai",color:"#34d399"},"Flow & Export":{key:"flow",color:"#0077ff"},Metadata:{key:"meta",color:"#f472b6"}},we=[{label:"Blue",value:"#0077ff"},{label:"Purple",value:"#8b5cf6"},{label:"Green",value:"#22c55e"},{label:"Amber",value:"#f59e0b"},{label:"Pink",value:"#f472b6"},{label:"Slate",value:"#374151"},{label:"Brown",value:"#92400e"},{label:"Sky",value:"#0ea5e9"}],ke={"#0077ff":"linear-gradient(135deg,#0a1628 0%,#0044cc 100%)","#8b5cf6":"linear-gradient(135deg,#1a0a2e 0%,#6d28d9 100%)","#22c55e":"linear-gradient(135deg,#0a1e10 0%,#15803d 100%)","#f59e0b":"linear-gradient(135deg,#1e150a 0%,#b45309 100%)","#f472b6":"linear-gradient(135deg,#1e0a14 0%,#be185d 100%)","#374151":"linear-gradient(135deg,#111318 0%,#374151 100%)","#92400e":"linear-gradient(135deg,#1a0e06 0%,#92400e 100%)","#0ea5e9":"linear-gradient(135deg,#060e1a 0%,#0369a1 100%)"};function D(l){return ke[l]||"linear-gradient(135deg,#111318 0%,#1e293b 100%)"}function Se(l){const c=N.get(l);return c?Object.values(de).find(h=>h.key===c.categoryKey)||{key:c.categoryKey||"other",color:"#6b7280"}:{key:l?.split("-")[0]||"other",color:"#6b7280"}}let H=localStorage.getItem("ic-bld-cmp-mode")||"slider";function Ee(l){if(l.type==="branch")return{icon:"device_hub",color:"#0077ff"};if(l.type==="conditional")return{icon:"alt_route",color:"#0077ff"};if(l.type==="block-ref")return{icon:"widgets",color:"#6b7280"};const c=Se(l.transformId);return{icon:N.get(l.transformId)?.icon||"tune",color:c.color}}function te(l,c){const{node:n,depth:h,isBranchHeader:v}=l,{icon:a,color:p}=Ee(n),w=n.label||n.transformId||n.type;return v?`
      <div class="bld-node-row bld-node-row--header ${c?"is-selected":""}"
           data-id="${n.id}" style="padding-left:${12+h*16}px">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-text-faint)">subdirectory_arrow_right</span>
        <span class="bld-node-label" style="font-style:italic;font-size:11px;color:var(--ps-text-faint)">${w}</span>
      </div>`:`
    <div class="bld-node-row ${c?"is-selected":""} ${n.disabled?"is-disabled":""}"
         data-id="${n.id}" draggable="true" style="padding-left:${8+h*16}px">
      <button class="btn-icon bld-drag-handle" title="Drag to reorder" tabindex="-1">
        <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-text-faint)">drag_indicator</span>
      </button>
      <span class="bld-node-dot" style="background:${p}"></span>
      <span class="material-symbols-outlined" style="font-size:14px;color:${p};flex-shrink:0">${a}</span>
      <span class="bld-node-label" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${w}</span>
      ${n.disabled?'<span class="ic-badge" style="font-size:10px">off</span>':""}
      <div class="bld-node-info-icon" style="margin-right:8px; display:inline-flex" title="${f(N.get(n.transformId)?.description||"No description available")}">
        <span class="material-symbols-outlined dropdown-toggle" style="font-size:16px;color:var(--ps-blue)">info</span>
      </div>
      <div class="bld-node-actions">
        <button class="btn-icon bld-btn-toggle" data-id="${n.id}" title="${n.disabled?"Enable":"Disable"}">
          <span class="material-symbols-outlined" style="font-size:14px">${n.disabled?"visibility_off":"visibility"}</span>
        </button>
        <button class="btn-icon bld-btn-edit" data-id="${n.id}" title="Edit node">
          <span class="material-symbols-outlined" style="font-size:14px">edit</span>
        </button>
        <button class="btn-icon bld-btn-delete" data-id="${n.id}" title="Delete node">
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-red)">delete</span>
        </button>
      </div>
    </div>`}function le(l,c){const n={text:"Text",number:"Number",range:"Range",select:"Select",boolean:"Toggle",color:"Color"}[l.type]||l.type;return`
    <div class="bld-param-row" data-idx="${c}">
      <span class="ic-badge" style="font-size:10px;font-family:var(--font-mono)">${f(l.name)}</span>
      <span class="text-sm" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f(l.label)}</span>
      <span class="text-sm text-muted">${n}</span>
      <button class="btn-icon bld-param-edit" data-idx="${c}" title="Edit">
        <span class="material-symbols-outlined" style="font-size:14px">edit</span>
      </button>
      <button class="btn-icon bld-param-delete" data-idx="${c}" title="Delete" style="color:var(--ps-red)">
        <span class="material-symbols-outlined" style="font-size:14px">delete</span>
      </button>
    </div>`}function Le(l,c=[]){const n=Object.entries(l).map(([v,a])=>{const{color:p}=Object.values(de).find(w=>a.some(_=>_.categoryKey===w.key))||{color:"#6b7280"};return`
      <div class="bld-add-section">
        <div class="bld-add-cat" style="color:${p}">${v}</div>
        <div class="bld-add-grid">
          ${a.map(w=>`
            <button class="bld-add-item" data-transform-id="${w.id}">
              <span class="material-symbols-outlined" style="font-size:18px;color:${p}">${w.icon||"tune"}</span>
              <span class="bld-add-item-name">${w.name}</span>
            </button>
          `).join("")}
        </div>
      </div>`}).join(""),h=c.length===0?'<div style="padding:6px 2px;color:var(--ps-text-muted);font-size:12px">No blocks yet. <a href="#bkb" style="color:var(--ps-blue)">Create a block →</a></div>':`<div class="bld-add-grid">
        ${c.map(v=>`
          <button class="bld-add-item bld-add-block-item" data-block-id="${f(v.id)}" data-block-name="${f(v.name)}">
            <span class="material-symbols-outlined" style="font-size:18px;color:#a855f7">widgets</span>
            <span class="bld-add-item-name">${f(v.name)}</span>
            ${v.isSystem?'<span class="ic-badge" style="font-size:9px;line-height:1;padding:1px 4px;margin-top:2px">sys</span>':""}
          </button>
        `).join("")}
      </div>`;return`
    <div id="bld-add-modal" class="bld-modal-overlay" style="display:none">
      <div class="bld-modal">
        <div class="bld-modal-header">
          <span class="bld-modal-title">Add Step</span>
          <div class="flex items-center gap-2">
            <input type="text" id="bld-add-search" class="ic-input" placeholder="Search transforms & blocks…" style="width:220px" autocomplete="off">
            <button class="btn-icon" id="bld-add-close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div class="bld-add-body" id="bld-add-sections">
          ${n}
          <div class="bld-add-section bld-add-section--blocks">
            <div class="bld-add-cat" style="color:#a855f7">Blocks</div>
            ${h}
          </div>
        </div>
        <div class="bld-modal-footer">
          <button class="btn-secondary bld-add-branch-btn" data-type="branch">
            <span class="material-symbols-outlined" style="font-size:14px">device_hub</span>
            Add Branch
          </button>
          <button class="btn-secondary bld-add-branch-btn" data-type="conditional">
            <span class="material-symbols-outlined" style="font-size:14px">alt_route</span>
            Add Conditional
          </button>
        </div>
      </div>
    </div>`}async function Re(l,c){const h=new URLSearchParams(c.split("?")[1]||"").get("id"),v=h?await be(h):null;if(!v){l.innerHTML=`<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">Recipe not found</div>
        <button class="btn-primary" onclick="navigate('#lib')">Back to Library</button>
      </div></div></div>`;return}if(v.isSystem){S(`#pvw?id=${v.id}`);return}let a=ve(v),p=null;H=localStorage.getItem("ic-bld-cmp-mode")||"slider";let _=a.name==="Untitled Recipe"&&!a.description&&!a.nodes?.length;function R(){return U(a.nodes)}V(()=>import("./index-Di01Xwv9.js").then(e=>e.i),__vite__mapDeps([0,1,2,3,4,5])).catch(()=>{});const ie=N.getGrouped(),G=await ue();G.sort((e,t)=>e.isSystem!==t.isSystem?e.isSystem?-1:1:e.name.localeCompare(t.name)),l.innerHTML=`
    <div class="screen bld-screen">
      <div class="screen-header bld-header-3col">
        <div class="bld-header-left flex items-center gap-2">
          <button class="btn-icon" id="bld-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">format_list_numbered</span>
            Recipe Builder
          </div>
          <span id="bld-save-status" class="text-sm text-muted" style="margin-left:4px"></span>
        </div>
        <div class="bld-header-center">
          <span id="bld-header-name" class="bld-header-name">${f(a.name)}</span>
          <button class="btn-icon bld-config-toggle" id="bld-config-toggle" title="Edit recipe details" style="margin-left:4px">
            <span class="material-symbols-outlined" style="font-size:15px">edit</span>
          </button>
        </div>
        <div class="bld-header-right flex items-center gap-2">
          <button class="btn-secondary" id="bld-btn-preview">
            <span class="material-symbols-outlined">preview</span>
            Preview
          </button>
          <button class="btn-primary" id="bld-btn-use">
            <span class="material-symbols-outlined">play_arrow</span>
            Use
          </button>
        </div>
      </div>

      <div class="bld-body">
        <!-- Left: recipe meta -->
        <div class="bld-config">
          <div class="bld-cover-preview" id="bld-cover-preview" style="${D(a.coverColor)?`background:${D(a.coverColor)}`:""}">
            <span class="bld-cover-name" id="bld-cover-name">${a.name}</span>
          </div>

          <div class="bld-config-form">
            <label class="ic-label">Name</label>
            <input type="text" id="bld-name" class="ic-input" value="${f(a.name)}" placeholder="Recipe name…">

            <label class="ic-label" style="margin-top:12px">Description</label>
            <textarea id="bld-desc" class="ic-input" rows="3" placeholder="What does this recipe do?">${f(a.description||"")}</textarea>

            <label class="ic-label" style="margin-top:12px; display:flex; align-items:center; gap:8px; cursor:pointer; color:var(--ps-text); font-weight:normal; text-transform:none; letter-spacing:0;">
              <input type="checkbox" id="bld-is-ordered" ${a.isOrdered?"checked":""}>
              Enforce Sequence Ordering
            </label>

            <label class="ic-label" style="margin-top:12px">Cover Colour</label>
            <div class="bld-color-grid">
              ${we.map(e=>`
                <button class="bld-color-swatch ${a.coverColor===e.value?"is-active":""}"
                  data-color="${e.value}" style="background:${e.value}" title="${e.label}">
                  ${a.coverColor===e.value?'<span class="material-symbols-outlined" style="font-size:14px">check</span>':""}
                </button>`).join("")}
            </div>

            <label class="ic-label" style="margin-top:12px">Tags</label>
            <input type="text" id="bld-tags" class="ic-input" value="${(a.tags||[]).join(", ")}" placeholder="web, social, print …">
            <div class="text-sm text-muted" style="margin-top:4px">Comma-separated</div>

            <div style="display:flex;gap:12px;margin-top:16px">
              <div style="flex:1">
                <label class="ic-label">Min Items</label>
                <input type="number" id="bld-min-items" class="ic-input" value="${a.minItems??""}" placeholder="Any" min="1">
              </div>
              <div style="flex:1">
                <label class="ic-label">Max Items</label>
                <input type="number" id="bld-max-items" class="ic-input" value="${a.maxItems??""}" placeholder="Any" min="1">
              </div>
            </div>

            <div style="margin-top:12px">
              <label class="ic-label">Media Type</label>
              <select id="bld-input-type" class="ic-input">
                <option value="image" ${a.inputType==="image"||!a.inputType?"selected":""}>Images Only</option>
                <option value="video" ${a.inputType==="video"?"selected":""}>Videos Only</option>
                <option value="any" ${a.inputType==="any"?"selected":""}>Images & Videos</option>
              </select>
            </div>

            <div style="margin-top:16px;border-top:1px solid var(--ps-border);padding-top:12px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span class="material-symbols-outlined" style="font-size:15px;color:var(--ps-blue)">tune</span>
                <span class="ic-label" style="margin-bottom:0">Run Parameters</span>
                <button class="btn-ghost" id="bld-add-param" style="margin-left:auto;font-size:11px;padding:2px 8px">
                  <span class="material-symbols-outlined" style="font-size:13px">add</span> Add
                </button>
              </div>
              <div id="bld-params-list" class="bld-params-list">
                ${(a.params||[]).length===0?'<div class="text-sm text-muted" id="bld-params-empty">No parameters defined.</div>':(a.params||[]).map((e,t)=>le(e,t)).join("")}
              </div>
            </div>
          </div>
        </div>

        <!-- Middle: node list -->
        <div class="bld-nodes-panel">
          <div class="bld-nodes-header">
            <span class="text-sm font-medium">Steps</span>
            <span id="bld-node-count" class="text-sm text-muted">${a.nodes.length} step${a.nodes.length!==1?"s":""}</span>
            <button class="btn-primary bld-btn-add" id="bld-btn-add-node" style="margin-left:auto">
              <span class="material-symbols-outlined">add</span>
              Add Step
            </button>
          </div>

          <div id="bld-node-list" class="bld-node-list">
            ${R().length?R().map(e=>te(e,p===e.node.id)).join(""):`<div class="empty-state" style="padding:32px">
                   <span class="material-symbols-outlined">account_tree</span>
                   <div class="empty-state-title">No steps yet</div>
                   <div class="empty-state-desc">Click "Add Step" to build your recipe.</div>
                 </div>`}
          </div>
        </div>

        <!-- Right: inline preview -->
        <div id="bld-workspace-container" style="flex:1;display:flex;flex-direction:column;min-width:0;border-left:1px solid var(--ps-border)">
        </div>
      </div>
    </div>

    ${Le(ie,G)}`,$e();const se=l.querySelector(".bld-config");function K(){se?.classList.toggle("is-collapsed",!_);const e=l.querySelector("#bld-config-toggle");e&&e.classList.toggle("is-active",_)}K(),l.querySelector("#bld-config-toggle")?.addEventListener("click",()=>{_=!_,K()}),l.querySelector("#bld-info-btn")?.addEventListener("click",async()=>{if(!bldTestFile)return;const{renderFileInfoModal:e}=await V(async()=>{const{renderFileInfoModal:t}=await import("./info-modal-c7GOmgUS.js");return{renderFileInfoModal:t}},__vite__mapDeps([6,7,2]));e(bldTestFile,window._icBldAfterUrl)});const P=l.querySelector("#bld-save-status");let C=null,O="original";const{ImageWorkspace:oe}=await V(async()=>{const{ImageWorkspace:e}=await import("./image-workspace-BhyNGQoU.js");return{ImageWorkspace:e}},__vite__mapDeps([8,2,9])),ne=l.querySelector("#bld-workspace-container"),F=new oe(ne,{customControlsHtml:`
      <div id="bld-cmp-ref-row" class="bld-cmp-ref-row" style="display:flex;gap:4px">
        <button class="bld-cmp-ref-btn is-active" data-ref="original">Original</button>
        <button class="bld-cmp-ref-btn" data-ref="prev">Prev Step</button>
      </div>
    `,onBindCustomControls:e=>{e.querySelectorAll(".bld-cmp-ref-btn").forEach(t=>{t.addEventListener("click",d=>{e.querySelectorAll(".bld-cmp-ref-btn").forEach(s=>s.classList.remove("is-active")),d.currentTarget.classList.add("is-active"),O=d.currentTarget.dataset.ref,F.triggerProcess()})})},onFilesChange:(e,t)=>{window._icTestFolderFiles=e,window._icTestImage={file:t}},onRender:async e=>{const t=URL.createObjectURL(e),d=xe(e);let s;if(d)s=await he(t);else{const r=new Image;await new Promise((y,L)=>{r.onload=y,r.onerror=L,r.src=t}),s=r}const i=await ge(e),b={filename:e.name,exif:i,meta:{},variables:new Map,originalFile:e,_previewMode:!0};window._icBldTargetExif=i,window._icBldTargetContext=b;const g=await new ee().previewDataUrl(s,a.nodes,b,C);window._icBldAfterUrl=g;const k=U(a.nodes),m=k.find(r=>r.node.id===C),j=m?m.node.label||m.node.transformId||m.node.type:"All Steps";let E=d&&s?(()=>{const r=s,y=document.createElement("canvas");return y.width=r.width,y.height=r.height,y.getContext("2d").drawImage(r,0,0),new Promise(L=>y.toBlob($=>L(URL.createObjectURL($)),"image/jpeg",.9))})():Promise.resolve(URL.createObjectURL(e));E=await E;let M="Original";if(O==="prev"){const r=re();if(r){const y=new ee,L={filename:e.name,exif:i,meta:{},variables:new Map,originalFile:e,_previewMode:!0};E=await y.previewDataUrl(s,a.nodes,L,r);const $=k.find(pe=>pe.node.id===r);M=$?$.node.label||$.node.transformId||$.node.type:"Prev Step"}}return URL.revokeObjectURL(t),{beforeUrl:E,afterUrl:g,beforeLabel:M,afterLabel:j,context:b}}});window._icTestFolderFiles&&window._icTestFolderFiles.length>0?F.setFiles(window._icTestFolderFiles):window._icTestImage?.file&&F.setFiles([window._icTestImage.file]);function re(){const e=U(a.nodes).filter(d=>!d.isBranchHeader);if(!C)return e.length>=2?e[e.length-2].node.id:null;const t=e.findIndex(d=>d.node.id===C);return t>0?e[t-1].node.id:null}function z(e=400){clearTimeout(window._icBldTimer),window._icBldTimer=setTimeout(()=>F.triggerProcess(),e)}function u(){P&&(P.textContent="Unsaved…"),me(a,()=>{P&&(P.textContent="Saved")}),z()}function I(){const e=l.querySelector("#bld-node-list"),t=l.querySelector("#bld-node-count"),d=R();e&&(e.innerHTML=d.length?d.map(i=>te(i,p===i.node.id)).join(""):`<div class="empty-state" style="padding:32px">
             <span class="material-symbols-outlined">account_tree</span>
             <div class="empty-state-title">No steps yet</div>
             <div class="empty-state-desc">Click "Add Step" to build your recipe.</div>
           </div>`,X());const s=ye(a.nodes);t&&(t.textContent=`${s} step${s!==1?"s":""}`)}l.querySelector("#bld-back")?.addEventListener("click",async()=>{await Z(a),S("#lib")}),l.querySelector("#bld-btn-use")?.addEventListener("click",()=>S(`#set?recipe=${a.id}`)),l.querySelector("#bld-btn-preview")?.addEventListener("click",()=>S(`#pvw?id=${a.id}`)),l.querySelector("#bld-name")?.addEventListener("input",e=>{a.name=e.target.value;const t=l.querySelector("#bld-cover-name");t&&(t.textContent=a.name||"Untitled");const d=l.querySelector("#bld-header-name");d&&(d.textContent=a.name||"Untitled Recipe"),u()}),l.querySelector("#bld-desc")?.addEventListener("input",e=>{a.description=e.target.value,u()}),l.querySelector("#bld-is-ordered")?.addEventListener("change",e=>{a.isOrdered=e.target.checked,u()}),l.querySelector("#bld-tags")?.addEventListener("input",e=>{a.tags=e.target.value.split(",").map(t=>t.trim()).filter(Boolean),u()}),l.querySelector("#bld-min-items")?.addEventListener("input",e=>{const t=parseInt(e.target.value,10);a.minItems=isNaN(t)?null:t,u()}),l.querySelector("#bld-max-items")?.addEventListener("input",e=>{const t=parseInt(e.target.value,10);a.maxItems=isNaN(t)?null:t,u()}),l.querySelector("#bld-input-type")?.addEventListener("change",e=>{a.inputType=e.target.value,u()}),l.querySelectorAll(".bld-color-swatch").forEach(e=>{e.addEventListener("click",()=>{a.coverColor=e.dataset.color,l.querySelectorAll(".bld-color-swatch").forEach(d=>{d.classList.toggle("is-active",d.dataset.color===a.coverColor),d.innerHTML=d.dataset.color===a.coverColor?'<span class="material-symbols-outlined" style="font-size:14px">check</span>':""});const t=l.querySelector("#bld-cover-preview");t&&(t.style.background=D(a.coverColor)),u()})});const x=l.querySelector("#bld-add-modal"),W=l.querySelector("#bld-add-search");l.querySelector("#bld-btn-add-node")?.addEventListener("click",()=>{x&&(x.style.display="flex",W?.focus())}),l.querySelector("#bld-add-close")?.addEventListener("click",()=>{x&&(x.style.display="none")}),x?.addEventListener("click",e=>{e.target===x&&(x.style.display="none")}),W?.addEventListener("input",e=>{const t=e.target.value.toLowerCase();l.querySelectorAll(".bld-add-item").forEach(d=>{const s=d.querySelector(".bld-add-item-name")?.textContent.toLowerCase()||"",i=(d.dataset.transformId||"").toLowerCase();d.closest(".bld-add-section").style.display="",d.style.display=!t||s.includes(t)||i.includes(t)?"":"none"}),l.querySelectorAll(".bld-add-section").forEach(d=>{const s=[...d.querySelectorAll(".bld-add-item")].some(i=>i.style.display!=="none");d.style.display=s?"":"none"})}),l.querySelectorAll(".bld-add-item:not(.bld-add-block-item)").forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.transformId,d=N.get(t),s={};(d?.params||[]).forEach(b=>{s[b.name]=b.defaultValue??""});const i={id:T(),type:"transform",transformId:t,label:d?.name||t,params:s};B(i),I(),u(),x.style.display="none",S(`#ned?recipe=${a.id}&node=${i.id}`)})}),l.querySelectorAll(".bld-add-block-item").forEach(e=>{e.addEventListener("click",()=>{const t={id:T(),type:"block-ref",blockId:e.dataset.blockId,label:e.dataset.blockName};B(t),I(),u(),x.style.display="none"})});function B(e){if(!p){a.nodes.push(e);return}const d=R().find(o=>o.node.id===p);if(!d){a.nodes.push(e);return}const{parentId:s,branchIdx:i,type:b}=d.node;if(b==="_branch_header"){const o=q(a.nodes,s);o&&o.node.branches&&o.node.branches[i].nodes.unshift(e)}else{const o=q(a.nodes,p);o&&o.parent.splice(o.index+1,0,e)}p=e.id}l.querySelectorAll(".bld-add-branch-btn").forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.type;let d;t==="branch"?d={id:T(),type:"branch",label:"Branch",branches:[{id:T(),label:"Variant A",nodes:[]},{id:T(),label:"Variant B",nodes:[]}]}:d={id:T(),type:"conditional",label:"Conditional",condition:{field:"width",operator:"gt",value:1e3},thenNodes:[],elseNodes:[]},B(d),I(),u(),x.style.display="none"})});function X(){l.querySelectorAll(".bld-btn-toggle").forEach(e=>{e.addEventListener("click",t=>{t.stopPropagation();const d=e.dataset.id,s=q(a.nodes,d);s&&(s.node.disabled=!s.node.disabled,I(),u())})}),l.querySelectorAll(".bld-btn-edit").forEach(e=>{e.addEventListener("click",t=>{t.stopPropagation();const d=e.dataset.id,s=q(a.nodes,d);s?.node.type==="block-ref"?S(`#bkb?id=${s.node.blockId}`):S(`#ned?recipe=${a.id}&node=${d}`)})}),l.querySelectorAll(".bld-btn-delete").forEach(e=>{e.addEventListener("click",async t=>{t.stopPropagation();const d=e.dataset.id;if(!await fe({title:"Remove Step?",body:"This will remove the selected transformation or block from the recipe.",confirmText:"Remove",variant:"danger",icon:"delete_sweep"}))return;const i=q(a.nodes,d);i&&(i.parent.splice(i.index,1),p===d&&(p=null,C=null),I(),u())})}),l.querySelectorAll(".bld-node-row").forEach(e=>{e.addEventListener("click",t=>{if(t.target.closest(".bld-node-actions, .btn-icon"))return;const d=e.dataset.id;p=p===d?null:d,C=p,I(),z(0)}),e.addEventListener("dblclick",()=>{const t=e.dataset.id,d=q(a.nodes,t);d?.node.type==="block-ref"?S(`#bkb?id=${d.node.blockId}`):d?.node.type==="transform"&&S(`#ned?recipe=${a.id}&node=${t}`)})}),ce()}let A=null;function ce(){l.querySelectorAll('.bld-node-row[draggable="true"]').forEach(t=>{t.addEventListener("dragstart",d=>{A=t.dataset.id,t.classList.add("bld-node-dragging"),d.dataTransfer.effectAllowed="move"}),t.addEventListener("dragend",()=>{t.classList.remove("bld-node-dragging"),A=null}),t.addEventListener("dragover",d=>{d.preventDefault(),t.dataset.id!==A&&t.classList.add("bld-node-drag-over")}),t.addEventListener("dragleave",()=>t.classList.remove("bld-node-drag-over")),t.addEventListener("drop",d=>{d.preventDefault(),t.classList.remove("bld-node-drag-over");const s=t.dataset.id;if(!A||A===s)return;const i=q(a.nodes,A),b=q(a.nodes,s);if(i&&b){const[o]=i.parent.splice(i.index,1);let g=b.index;i.parent===b.parent&&i.index<b.index,b.parent.splice(g,0,o),I(),u()}})})}l.querySelector("#bld-cmp-toggle")?.addEventListener("click",()=>{bldCompareMode=!bldCompareMode;const e=l.querySelector("#bld-cmp-toggle"),t=l.querySelector("#bld-cmp-controls");e?.classList.toggle("is-active",bldCompareMode),t&&(t.style.display=bldCompareMode?"flex":"none"),z(0)}),l.querySelectorAll(".bld-cmp-mode-btn").forEach(e=>{e.addEventListener("click",()=>{H=e.dataset.layout,localStorage.setItem("ic-bld-cmp-mode",H),l.querySelectorAll(".bld-cmp-mode-btn").forEach(t=>t.classList.toggle("is-active",t===e)),bldCompareMode&&z(0)})}),l.querySelectorAll(".bld-cmp-ref-btn").forEach(e=>{e.addEventListener("click",()=>{O=e.dataset.ref,l.querySelectorAll(".bld-cmp-ref-btn").forEach(t=>t.classList.toggle("is-active",t.dataset.ref===O)),bldCompareMode&&z(0)})}),X();function J(){const e=l.querySelector("#bld-params-list");e&&((a.params||[]).length?e.innerHTML=(a.params||[]).map((t,d)=>le(t,d)).join(""):e.innerHTML='<div class="text-sm text-muted" id="bld-params-empty">No parameters defined.</div>',Q())}function Q(){l.querySelectorAll(".bld-param-delete").forEach(e=>{e.addEventListener("click",async()=>{const t=parseInt(e.dataset.idx,10);a.params=(a.params||[]).filter((d,s)=>s!==t),J(),u()})}),l.querySelectorAll(".bld-param-edit").forEach(e=>{e.addEventListener("click",()=>{const t=parseInt(e.dataset.idx,10);Y((a.params||[])[t],t)})})}function Y(e,t){const d=e?{...e}:{name:"",label:"",type:"text",defaultValue:""},s=t==null,i=document.createElement("dialog");i.className="modal",i.innerHTML=`
      <div class="modal__header">
        <h2 class="modal__title">${s?"Add":"Edit"} Parameter</h2>
      </div>
      <div class="modal__body" style="padding:16px;min-width:320px;display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="ic-label">Machine Name <span class="text-muted">(used in {{recipe.xxx}})</span></label>
          <input type="text" id="pe-name" class="ic-input" value="${f(d.name)}" placeholder="e.g. overlap">
        </div>
        <div>
          <label class="ic-label">Label</label>
          <input type="text" id="pe-label" class="ic-input" value="${f(d.label)}" placeholder="e.g. Overlap %">
        </div>
        <div>
          <label class="ic-label">Type</label>
          <select id="pe-type" class="ic-input">
            ${["text","number","range","select","boolean","color"].map(o=>`<option value="${o}" ${d.type===o?"selected":""}>${o}</option>`).join("")}
          </select>
        </div>
        <div id="pe-extra"></div>
        <div>
          <label class="ic-label">Default Value</label>
          <input type="text" id="pe-default" class="ic-input" value="${f(String(d.defaultValue??""))}">
        </div>
      </div>
      <div class="modal__footer" style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--ps-border)">
        <button class="btn-secondary" id="pe-cancel">Cancel</button>
        <button class="btn-primary" id="pe-save">Save</button>
      </div>`;function b(){const o=i.querySelector("#pe-type").value,g=i.querySelector("#pe-extra");if(o==="range"||o==="number")g.innerHTML=`
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><label class="ic-label">Min</label><input type="number" id="pe-min" class="ic-input" value="${f(String(d.min??""))}"></div>
            <div><label class="ic-label">Max</label><input type="number" id="pe-max" class="ic-input" value="${f(String(d.max??""))}"></div>
          </div>`;else if(o==="select"){const k=(d.options||[]).map(m=>`${m.label}:${m.value}`).join(", ");g.innerHTML=`
          <div><label class="ic-label">Options <span class="text-muted">(Label:value, comma-separated)</span></label>
          <input type="text" id="pe-options" class="ic-input" value="${f(k)}" placeholder="GIF:gif, MP4:mp4"></div>`}else g.innerHTML=""}document.body.appendChild(i),i.showModal(),b(),i.querySelector("#pe-type").addEventListener("change",b),i.querySelector("#pe-cancel").addEventListener("click",()=>{i.close(),i.remove()}),i.querySelector("#pe-save").addEventListener("click",()=>{const o=i.querySelector("#pe-name").value.trim().replace(/\s+/g,"_"),g=i.querySelector("#pe-label").value.trim(),k=i.querySelector("#pe-type").value;if(!o||!g)return;const m={name:o,label:g,type:k,defaultValue:i.querySelector("#pe-default").value},j=i.querySelector("#pe-min"),E=i.querySelector("#pe-max");j&&j.value!==""&&(m.min=parseFloat(j.value)),E&&E.value!==""&&(m.max=parseFloat(E.value)),(k==="range"||k==="number")&&(m.defaultValue=parseFloat(m.defaultValue)||0),k==="boolean"&&(m.defaultValue=m.defaultValue==="true");const M=i.querySelector("#pe-options");M&&(m.options=M.value.split(",").map(r=>{const[y,L]=r.split(":").map($=>$.trim());return{label:y||L,value:L||y}}).filter(r=>r.value)),a.params||(a.params=[]),s?a.params.push(m):a.params[t]=m,J(),u(),i.close(),i.remove()}),i.addEventListener("cancel",()=>{i.remove()})}return l.querySelector("#bld-add-param")?.addEventListener("click",()=>Y(null,null)),Q(),async()=>{await Z(a)}}function f(l){return String(l).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}let ae=!1;function $e(){if(ae)return;ae=!0;const l=document.createElement("style");l.textContent=`
    .bld-screen { display:flex; flex-direction:column; height:100%; }
    .bld-body { display:flex; flex:1; overflow:hidden; }

    /* 3-column header */
    .bld-header-3col { display:grid !important; grid-template-columns:1fr auto 1fr; }
    .bld-header-left { justify-self:start; }
    .bld-header-center { justify-self:center; display:flex; align-items:center; gap:2px; overflow:hidden; max-width:360px; }
    .bld-header-right { justify-self:end; }
    .bld-header-name {
      font-size:14px; font-weight:600; color:var(--ps-text);
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      display:block;
    }

    /* Compare slider */
    .bld-cmp-wrap {
      display:grid; position:relative; cursor:col-resize; user-select:none;
      max-width:100%; max-height:calc(100vh - 200px);
    }
    .bld-cmp-img {
      grid-area:1/1; display:block;
      max-width:100%; max-height:calc(100vh - 200px); object-fit:contain;
    }
    .bld-cmp-handle {
      position:absolute; top:0; bottom:0; width:0;
      transform:translateX(-50%); cursor:col-resize; z-index:10;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
    }
    .bld-cmp-handle-line {
      position:absolute; top:0; bottom:0; width:2px;
      background:rgba(255,255,255,0.85); box-shadow:0 0 4px rgba(0,0,0,0.5);
    }
    .bld-cmp-handle-knob {
      position:relative; background:#fff; border-radius:50%;
      width:32px; height:32px; display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.4); color:#111; z-index:2;
    }
    .bld-cmp-label {
      position:absolute; top:8px; background:rgba(0,0,0,0.7); color:#fff;
      font-size:10px; padding:3px 7px; border-radius:4px; font-family:var(--font-mono);
      pointer-events:none;
    }
    .bld-cmp-label--l { left:8px; }
    .bld-cmp-label--r { right:8px; }

    /* Compare toggle button */
    .bld-cmp-toggle.is-active { background:var(--ps-blue-10); color:var(--ps-blue); border-color:var(--ps-blue); }
    .bld-cmp-mode-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:6px; overflow:hidden; }
    .bld-cmp-mode-btn {
      padding:4px 8px; font-size:11px; color:var(--ps-text-muted); border:none;
      background:transparent; cursor:pointer; font-family:var(--font-primary); transition:color 100ms, background 100ms;
      display:flex; align-items:center; justify-content:center;
    }
    .bld-cmp-mode-btn.is-active { background:var(--ps-bg-surface); color:var(--ps-blue); }
    .bld-cmp-mode-btn:not(.is-active):hover { background:var(--ps-bg-hover); }

    .bld-cmp-ref-row {
      display:flex; background:var(--ps-bg-app);
      border:1px solid var(--ps-border); border-radius:6px; overflow:hidden;
    }
    .bld-cmp-ref-btn {
      padding:4px 10px; font-size:11px; color:var(--ps-text-muted); border:none;
      background:transparent; cursor:pointer; font-family:var(--font-primary); transition:color 100ms, background 100ms;
    }
    .bld-cmp-ref-btn.is-active { background:var(--ps-blue); color:#fff; }
    .bld-cmp-ref-btn:not(.is-active):hover { background:var(--ps-bg-hover); }

    /* Side by side view */
    .bld-cmp-side-view { display:flex; width:100%; height:100%; background:var(--ps-bg-app); }
    .bld-cmp-side { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
    .bld-cmp-side-img { width:100%; height:100%; object-fit:contain; display:block; }
    .bld-cmp-divider { width:1px; background:var(--ps-border); flex-shrink:0; }
    .bld-cmp-side-label {
      position:absolute; top:8px; left:8px; z-index:5;
      background:rgba(0,0,0,0.7); color:#fff; font-size:10px; padding:3px 7px; border-radius:4px; font-family:var(--font-mono);
    }
    .bld-cmp-side-label--blue { background:rgba(0,119,255,0.8); }

    /* Config panel */
    .bld-config {
      width:260px; flex-shrink:0; border-right:1px solid var(--ps-border);
      overflow-y:auto; display:flex; flex-direction:column;
      transition:width 200ms ease, border-color 200ms ease;
      min-width:0;
    }
    .bld-config.is-collapsed { width:0; border-right-color:transparent; overflow:hidden; }
    .bld-config-toggle.is-active { background:var(--ps-blue-10); color:var(--ps-blue); }
    .bld-cover-preview {
      height:90px; display:flex; align-items:flex-end; padding:10px 12px; flex-shrink:0;
      transition:background 300ms;
    }
    .bld-cover-name { font-size:14px; font-weight:700; color:#fff; text-shadow:0 1px 4px rgba(0,0,0,0.8); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:100%; }
    .bld-config-form { padding:14px; }
    .bld-color-grid { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
    .bld-color-swatch {
      width:28px; height:28px; border-radius:6px; border:2px solid transparent;
      display:flex; align-items:center; justify-content:center; cursor:pointer; transition:border-color 150ms;
    }
    .bld-color-swatch.is-active { border-color: #fff; }
    .bld-color-swatch:hover { transform:scale(1.1); }

    /* Nodes panel */
    .bld-nodes-panel { width:340px; flex-shrink:0; display:flex; flex-direction:column; overflow:hidden; border-right:1px solid var(--ps-border); }
    .bld-nodes-header { display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .bld-node-list { flex:1; overflow-y:auto; padding:8px 0; }
    .bld-params-list { display:flex; flex-direction:column; gap:4px; }
    .bld-param-row { display:flex; align-items:center; gap:6px; padding:5px 6px; border-radius:6px; background:var(--ps-bg-raised); }

    /* Inline preview panel */
    .bld-inline-preview { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }
    .bld-inline-preview-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .bld-upload-label { font-size:12px; padding:4px 10px; display:inline-flex; align-items:center; gap:5px; }
    .bld-preview-area {
      flex:1; overflow:auto; display:flex; align-items:center; justify-content:center;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/24px 24px;
    }
    .bld-preview-area.bld-preview-dragover { outline:2px dashed var(--ps-blue); outline-offset:-4px; }
    .bld-preview-img-wrapper { position:relative; max-width:100%; max-height:100%; }
    .bld-preview-result-img { display:block; max-width:100%; max-height:calc(100vh - 200px); object-fit:contain; }
    .bld-preview-img-badge {
      position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.7);
      color:#fff; font-size:10px; padding:3px 7px; border-radius:4px; font-family:var(--font-mono);
    }
    .bld-preview-img-badge--blue { background:rgba(0,119,255,0.8); }
    .bld-preview-step-info {
      display:flex; align-items:center; gap:8px;
      padding:8px 14px; border-top:1px solid var(--ps-border); flex-shrink:0;
      background:var(--ps-bg-surface);
    }

    .bld-node-row {
      display:flex; align-items:center; gap:8px; padding:8px 12px 8px 8px;
      border-bottom:1px solid transparent; cursor:default; transition:all 100ms;
      user-select:none; border-left:3px solid transparent;
    }
    .bld-node-row:hover { background:var(--ps-bg-hover); }
    .bld-node-row.is-selected { background:var(--ps-blue-10); border-left-color:var(--ps-blue); }
    .bld-node-row.is-disabled { opacity:0.5; }
    .bld-node-row--header { border-bottom:none; margin-top:4px; }
    .bld-node-row:hover .bld-node-actions { opacity:1; }
    .bld-drag-handle { cursor:grab; padding:0; }
    .bld-drag-handle:active { cursor:grabbing; }
    .bld-node-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .bld-node-actions { display:flex; gap:2px; opacity:0; transition:opacity 120ms; margin-left:auto; flex-shrink:0; }
    .bld-node-dragging { opacity:0.4; }
    .bld-node-drag-over { border-top:2px solid var(--ps-blue); }

    /* Add modal */
    .bld-modal-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:200;
      display:flex; align-items:center; justify-content:center;
    }
    .bld-modal {
      background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:14px;
      width:640px; max-height:80vh; display:flex; flex-direction:column; overflow:hidden;
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
    }
    .bld-modal-header { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .bld-modal-title { font-size:15px; font-weight:600; }
    .bld-add-body { flex:1; overflow-y:auto; padding:12px 16px; }
    .bld-add-section { margin-bottom:16px; }
    .bld-add-cat { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; }
    .bld-add-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:6px; }
    .bld-add-item {
      display:flex; flex-direction:column; align-items:center; gap:4px;
      padding:10px 8px; border-radius:8px; background:var(--ps-bg-app);
      border:1px solid var(--ps-border); cursor:pointer; font-family:var(--font-primary);
      transition:border-color 150ms, background 150ms; text-align:center;
    }
    .bld-add-item:hover { border-color:var(--ps-blue); background:var(--ps-bg-hover); }
    .bld-add-item-name { font-size:11px; color:var(--ps-text-muted); line-height:1.3; }
    .bld-modal-footer { display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--ps-border); flex-shrink:0; }
  `,document.head.appendChild(l)}export{Re as render};
