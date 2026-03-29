const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-DJSWaQP7.js","assets/processor-BO1Q6VPM.js","assets/ai-bgremoval-stlubUex.js","assets/misc-DpJZ-4k9.js","assets/exif-reader-DgBCZqHm.js"])))=>i.map(i=>d[i]);
import{_}from"./ai-bgremoval-stlubUex.js";import{a as I,f as $,b as z}from"./recipes-qesXpeyQ.js";import{n as b}from"./index-DpFMNAiN.js";import{d as j,u as m}from"./misc-DpJZ-4k9.js";import{r as g}from"./processor-BO1Q6VPM.js";const A={"Geometric & Framing":{key:"geo",color:"#38bdf8"},"Color & Tone":{key:"color",color:"#a78bfa"},"Overlays & Text":{key:"overlay",color:"#fb923c"},"AI & Vision":{key:"ai",color:"#34d399"},"Flow & Export":{key:"flow",color:"#0077ff"},Metadata:{key:"meta",color:"#f472b6"}},R=[{label:"Blue",value:"#0077ff"},{label:"Purple",value:"#8b5cf6"},{label:"Green",value:"#22c55e"},{label:"Amber",value:"#f59e0b"},{label:"Pink",value:"#f472b6"},{label:"Slate",value:"#374151"},{label:"Brown",value:"#92400e"},{label:"Sky",value:"#0ea5e9"}],D={"#0077ff":"linear-gradient(135deg,#0a1628 0%,#0044cc 100%)","#8b5cf6":"linear-gradient(135deg,#1a0a2e 0%,#6d28d9 100%)","#22c55e":"linear-gradient(135deg,#0a1e10 0%,#15803d 100%)","#f59e0b":"linear-gradient(135deg,#1e150a 0%,#b45309 100%)","#f472b6":"linear-gradient(135deg,#1e0a14 0%,#be185d 100%)","#374151":"linear-gradient(135deg,#111318 0%,#374151 100%)","#92400e":"linear-gradient(135deg,#1a0e06 0%,#92400e 100%)","#0ea5e9":"linear-gradient(135deg,#060e1a 0%,#0369a1 100%)"};function h(e){return D[e]||"linear-gradient(135deg,#111318 0%,#1e293b 100%)"}function N(e){const s=g.get(e);return s?Object.values(A).find(n=>n.key===s.categoryKey)||{key:s.categoryKey||"other",color:"#6b7280"}:{key:e?.split("-")[0]||"other",color:"#6b7280"}}function O(e){if(e.type==="branch")return{icon:"device_hub",color:"#0077ff"};if(e.type==="conditional")return{icon:"alt_route",color:"#0077ff"};if(e.type==="block-ref")return{icon:"widgets",color:"#6b7280"};const s=N(e.transformId);return{icon:g.get(e.transformId)?.icon||"tune",color:s.color}}function E(e,s){const{icon:u,color:n}=O(e),i=e.label||e.transformId||e.type;return`
    <div class="bld-node-row" data-idx="${s}" draggable="true">
      <button class="btn-icon bld-drag-handle" title="Drag to reorder" tabindex="-1">
        <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-text-faint)">drag_indicator</span>
      </button>
      <span class="bld-node-dot" style="background:${n}"></span>
      <span class="material-symbols-outlined" style="font-size:14px;color:${n};flex-shrink:0">${u}</span>
      <span class="bld-node-label" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i}</span>
      ${e.disabled?'<span class="ic-badge" style="font-size:10px">off</span>':""}
      <div class="bld-node-actions">
        <button class="btn-icon bld-btn-toggle" data-idx="${s}" title="${e.disabled?"Enable":"Disable"}">
          <span class="material-symbols-outlined" style="font-size:14px">${e.disabled?"visibility_off":"visibility"}</span>
        </button>
        <button class="btn-icon bld-btn-edit" data-idx="${s}" title="Edit node">
          <span class="material-symbols-outlined" style="font-size:14px">edit</span>
        </button>
        <button class="btn-icon bld-btn-delete" data-idx="${s}" title="Delete node">
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-red)">delete</span>
        </button>
      </div>
    </div>`}function T(e){return`
    <div id="bld-add-modal" class="bld-modal-overlay" style="display:none">
      <div class="bld-modal">
        <div class="bld-modal-header">
          <span class="bld-modal-title">Add Step</span>
          <div class="flex items-center gap-2">
            <input type="text" id="bld-add-search" class="ic-input" placeholder="Search transforms…" style="width:200px" autocomplete="off">
            <button class="btn-icon" id="bld-add-close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div class="bld-add-body" id="bld-add-sections">
          ${Object.entries(e).map(([u,n])=>{const{color:i}=Object.values(A).find(t=>n.some(x=>x.categoryKey===t.key))||{color:"#6b7280"};return`
      <div class="bld-add-section">
        <div class="bld-add-cat" style="color:${i}">${u}</div>
        <div class="bld-add-grid">
          ${n.map(t=>`
            <button class="bld-add-item" data-transform-id="${t.id}">
              <span class="material-symbols-outlined" style="font-size:18px;color:${i}">${t.icon||"tune"}</span>
              <span class="bld-add-item-name">${t.name}</span>
            </button>
          `).join("")}
        </div>
      </div>`}).join("")}
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
    </div>`}async function U(e,s){const n=new URLSearchParams(s.split("?")[1]||"").get("id"),i=n?await I(n):null;if(!i){e.innerHTML=`<div class="screen"><div class="screen-body" style="align-items:center;justify-content:center">
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">Recipe not found</div>
        <button class="btn-primary" onclick="navigate('#lib')">Back to Library</button>
      </div></div></div>`;return}if(i.isSystem){b(`#pvw?id=${i.id}`);return}let t=j(i);_(()=>import("./index-DJSWaQP7.js"),__vite__mapDeps([0,1,2,3,4])).catch(()=>{});const x=g.getGrouped();e.innerHTML=`
    <div class="screen bld-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="bld-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">format_list_numbered</span>
            Recipe Builder
          </div>
          <span id="bld-save-status" class="text-sm text-muted" style="margin-left:4px"></span>
        </div>
        <div class="flex items-center gap-2">
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
          <div class="bld-cover-preview" id="bld-cover-preview" style="${h(t.coverColor)?`background:${h(t.coverColor)}`:""}">
            <span class="bld-cover-name" id="bld-cover-name">${t.name}</span>
          </div>

          <div class="bld-config-form">
            <label class="ic-label">Name</label>
            <input type="text" id="bld-name" class="ic-input" value="${L(t.name)}" placeholder="Recipe name…">

            <label class="ic-label" style="margin-top:12px">Description</label>
            <textarea id="bld-desc" class="ic-input" rows="3" placeholder="What does this recipe do?">${L(t.description||"")}</textarea>

            <label class="ic-label" style="margin-top:12px">Cover Colour</label>
            <div class="bld-color-grid">
              ${R.map(l=>`
                <button class="bld-color-swatch ${t.coverColor===l.value?"is-active":""}"
                  data-color="${l.value}" style="background:${l.value}" title="${l.label}">
                  ${t.coverColor===l.value?'<span class="material-symbols-outlined" style="font-size:14px">check</span>':""}
                </button>`).join("")}
            </div>

            <label class="ic-label" style="margin-top:12px">Tags</label>
            <input type="text" id="bld-tags" class="ic-input" value="${(t.tags||[]).join(", ")}" placeholder="web, social, print …">
            <div class="text-sm text-muted" style="margin-top:4px">Comma-separated</div>
          </div>
        </div>

        <!-- Right: node list -->
        <div class="bld-nodes-panel">
          <div class="bld-nodes-header">
            <span class="text-sm font-medium">Steps</span>
            <span id="bld-node-count" class="text-sm text-muted">${t.nodes.length} step${t.nodes.length!==1?"s":""}</span>
            <button class="btn-primary bld-btn-add" id="bld-btn-add-node" style="margin-left:auto">
              <span class="material-symbols-outlined">add</span>
              Add Step
            </button>
          </div>

          <div id="bld-node-list" class="bld-node-list">
            ${t.nodes.length?t.nodes.map((l,d)=>E(l,d)).join(""):`<div class="empty-state" style="padding:32px">
                   <span class="material-symbols-outlined">account_tree</span>
                   <div class="empty-state-title">No steps yet</div>
                   <div class="empty-state-desc">Click "Add Step" to build your recipe.</div>
                 </div>`}
          </div>
        </div>
      </div>
    </div>

    ${T(x)}`,B();const y=e.querySelector("#bld-save-status");function r(){y&&(y.textContent="Unsaved…"),z(t,()=>{y&&(y.textContent="Saved")})}function f(){const l=e.querySelector("#bld-node-list"),d=e.querySelector("#bld-node-count");l&&(l.innerHTML=t.nodes.length?t.nodes.map((a,o)=>E(a,o)).join(""):`<div class="empty-state" style="padding:32px">
             <span class="material-symbols-outlined">account_tree</span>
             <div class="empty-state-title">No steps yet</div>
             <div class="empty-state-desc">Click "Add Step" to build your recipe.</div>
           </div>`,k()),d&&(d.textContent=`${t.nodes.length} step${t.nodes.length!==1?"s":""}`)}e.querySelector("#bld-back")?.addEventListener("click",async()=>{await $(t),b("#lib")}),e.querySelector("#bld-btn-use")?.addEventListener("click",()=>b(`#set?recipe=${t.id}`)),e.querySelector("#bld-btn-preview")?.addEventListener("click",()=>b(`#pvw?id=${t.id}`)),e.querySelector("#bld-name")?.addEventListener("input",l=>{t.name=l.target.value;const d=e.querySelector("#bld-cover-name");d&&(d.textContent=t.name||"Untitled"),r()}),e.querySelector("#bld-desc")?.addEventListener("input",l=>{t.description=l.target.value,r()}),e.querySelector("#bld-tags")?.addEventListener("input",l=>{t.tags=l.target.value.split(",").map(d=>d.trim()).filter(Boolean),r()}),e.querySelectorAll(".bld-color-swatch").forEach(l=>{l.addEventListener("click",()=>{t.coverColor=l.dataset.color,e.querySelectorAll(".bld-color-swatch").forEach(a=>{a.classList.toggle("is-active",a.dataset.color===t.coverColor),a.innerHTML=a.dataset.color===t.coverColor?'<span class="material-symbols-outlined" style="font-size:14px">check</span>':""});const d=e.querySelector("#bld-cover-preview");d&&(d.style.background=h(t.coverColor)),r()})});const c=e.querySelector("#bld-add-modal"),w=e.querySelector("#bld-add-search");e.querySelector("#bld-btn-add-node")?.addEventListener("click",()=>{c&&(c.style.display="flex",w?.focus())}),e.querySelector("#bld-add-close")?.addEventListener("click",()=>{c&&(c.style.display="none")}),c?.addEventListener("click",l=>{l.target===c&&(c.style.display="none")}),w?.addEventListener("input",l=>{const d=l.target.value.toLowerCase();e.querySelectorAll(".bld-add-item").forEach(a=>{const o=a.querySelector(".bld-add-item-name")?.textContent.toLowerCase()||"",p=(a.dataset.transformId||"").toLowerCase();a.closest(".bld-add-section").style.display="",a.style.display=!d||o.includes(d)||p.includes(d)?"":"none"}),e.querySelectorAll(".bld-add-section").forEach(a=>{const o=[...a.querySelectorAll(".bld-add-item")].some(p=>p.style.display!=="none");a.style.display=o?"":"none"})}),e.querySelectorAll(".bld-add-item").forEach(l=>{l.addEventListener("click",()=>{const d=l.dataset.transformId,a=g.get(d),o={};(a?.params||[]).forEach(S=>{o[S.name]=S.defaultValue??""});const p={id:m(),type:"transform",transformId:d,label:a?.name||d,params:o};t.nodes.push(p),f(),r(),c.style.display="none",b(`#ned?recipe=${t.id}&node=${p.id}`)})}),e.querySelectorAll(".bld-add-branch-btn").forEach(l=>{l.addEventListener("click",()=>{l.dataset.type==="branch"?t.nodes.push({id:m(),type:"branch",label:"Branch",branches:[{id:m(),label:"Variant A",nodes:[]},{id:m(),label:"Variant B",nodes:[]}]}):t.nodes.push({id:m(),type:"conditional",label:"Conditional",condition:{field:"width",operator:"gt",value:1e3},thenNodes:[],elseNodes:[]}),f(),r(),c.style.display="none"})});function k(){e.querySelectorAll(".bld-btn-toggle").forEach(l=>{l.addEventListener("click",d=>{d.stopPropagation();const a=parseInt(l.dataset.idx);t.nodes[a].disabled=!t.nodes[a].disabled,f(),r()})}),e.querySelectorAll(".bld-btn-edit").forEach(l=>{l.addEventListener("click",d=>{d.stopPropagation();const a=parseInt(l.dataset.idx),o=t.nodes[a];b(`#ned?recipe=${t.id}&node=${o.id}`)})}),e.querySelectorAll(".bld-btn-delete").forEach(l=>{l.addEventListener("click",d=>{d.stopPropagation();const a=parseInt(l.dataset.idx);confirm("Remove this step?")&&(t.nodes.splice(a,1),f(),r())})}),e.querySelectorAll(".bld-node-row").forEach(l=>{l.addEventListener("dblclick",()=>{const d=parseInt(l.dataset.idx),a=t.nodes[d];a&&a.type==="transform"&&b(`#ned?recipe=${t.id}&node=${a.id}`)})}),q()}let v=null;function q(){e.querySelectorAll(".bld-node-row").forEach(d=>{d.addEventListener("dragstart",a=>{v=parseInt(d.dataset.idx),d.classList.add("bld-node-dragging"),a.dataTransfer.effectAllowed="move"}),d.addEventListener("dragend",()=>{d.classList.remove("bld-node-dragging"),v=null}),d.addEventListener("dragover",a=>{a.preventDefault(),d.classList.add("bld-node-drag-over")}),d.addEventListener("dragleave",()=>d.classList.remove("bld-node-drag-over")),d.addEventListener("drop",a=>{a.preventDefault(),d.classList.remove("bld-node-drag-over");const o=parseInt(d.dataset.idx);if(v===null||v===o)return;const[p]=t.nodes.splice(v,1);t.nodes.splice(o,0,p),f(),r()})})}return k(),async()=>{await $(t)}}function L(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}let C=!1;function B(){if(C)return;C=!0;const e=document.createElement("style");e.textContent=`
    .bld-screen { display:flex; flex-direction:column; height:100%; }
    .bld-body { display:flex; flex:1; overflow:hidden; }

    /* Config panel */
    .bld-config { width:260px; flex-shrink:0; border-right:1px solid var(--ps-border); overflow-y:auto; display:flex; flex-direction:column; }
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
    .bld-nodes-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .bld-nodes-header { display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .bld-node-list { flex:1; overflow-y:auto; padding:8px 0; }

    .bld-node-row {
      display:flex; align-items:center; gap:8px; padding:8px 12px 8px 8px;
      border-bottom:1px solid transparent; cursor:default; transition:background 100ms;
      user-select:none;
    }
    .bld-node-row:hover { background:var(--ps-bg-hover); }
    .bld-node-row:hover .bld-node-actions { opacity:1; }
    .bld-drag-handle { cursor:grab; }
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
  `,document.head.appendChild(e)}export{U as render};
