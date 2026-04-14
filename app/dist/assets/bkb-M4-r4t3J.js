import{getBlock as C,cloneBlock as E,getAllBlocks as z,deleteBlock as T,saveBlock as L}from"./blocks-_SxbKKDb.js";import{n as p}from"./index-Cvca53V-.js";import{d as N,u as q,f as _,n as h}from"./misc-BYzs6oS8.js";import{s as A}from"./dialogs-CUir_jZ5.js";import{r as g}from"./video-Dd42h0XN.js";import{c as f,a as j,f as H}from"./nodes-D1JCSoz2.js";import"./ai-bgremoval-CLcXU_4U.js";function c(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}async function B(e){const l=await z(),a=l.filter(t=>t.isSystem).sort((t,i)=>t.name.localeCompare(i.name)),s=l.filter(t=>!t.isSystem).sort((t,i)=>(i.updatedAt||0)-(t.updatedAt||0)),m=a.length>0?`
    <div class="bkb-section-header">System Blocks</div>
    <div class="bkb-grid">${a.map(t=>$(t)).join("")}</div>`:"",b=s.length>0?`
    <div class="bkb-section-header" style="margin-top:${a.length?"24px":"0"}">My Blocks</div>
    <div class="bkb-grid">${s.map(t=>$(t)).join("")}</div>`:"",o=s.length===0?`
    <div class="empty-state" style="padding-top:${a.length?"32px":"60px"}">
      <span class="material-symbols-outlined" style="font-size:${a.length?"32px":"48px"}">add_box</span>
      <div class="empty-state-title">No custom blocks yet</div>
      <div class="empty-state-desc">Create a block to build reusable step sequences, or clone a system block to customise it.</div>
      <button class="btn-primary" id="bkb-empty-new">
        <span class="material-symbols-outlined">add</span>
        Create Block
      </button>
    </div>`:"";e.innerHTML=`
    <div class="screen bkb-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">widgets</span>
          Block Builder
        </div>
        <button class="btn-primary" id="bkb-btn-new">
          <span class="material-symbols-outlined">add</span>
          New Block
        </button>
      </div>

      <div class="bkb-list-body">
        ${m}
        ${b}
        ${o}
      </div>
    </div>`,w(),e.querySelector("#bkb-btn-new, #bkb-empty-new")?.addEventListener("click",()=>u()),e.querySelectorAll(".bkb-card-edit").forEach(t=>{t.addEventListener("click",i=>{i.stopPropagation(),p(`#bkb?id=${t.dataset.id}`)})}),e.querySelectorAll(".bkb-card-clone").forEach(t=>{t.addEventListener("click",async i=>{i.stopPropagation();const y=await E(t.dataset.id);window.AuroraToast?.show({variant:"success",title:`"${y.name}" cloned`}),p(`#bkb?id=${y.id}`)})}),e.querySelectorAll(".bkb-card-delete").forEach(t=>{t.addEventListener("click",async i=>{i.stopPropagation(),await A({title:"Delete Block?",body:"This will permanently remove this reusable block. It will be removed from any recipes that currently reference it.",confirmText:"Delete",variant:"danger",icon:"delete_forever"})&&(await T(t.dataset.id),window.AuroraToast?.show({variant:"success",title:"Block deleted"}),B(e))})}),e.querySelectorAll(".bkb-card").forEach(t=>{t.addEventListener("click",i=>{i.target.closest("button")||p(`#bkb?id=${t.dataset.id}`)})});async function u(){const t={id:q(),name:"Untitled Block",description:"",category:"General",nodes:[],createdAt:h(),updatedAt:h()};await L(t),p(`#bkb?id=${t.id}`)}}function $(e){const l=e.updatedAt?_(e.updatedAt):"—",a=e.isSystem?"var(--ps-blue)":"#a855f7";return`
    <article class="bkb-card" data-id="${e.id}" tabindex="0">
      <div class="bkb-card-icon">
        <span class="material-symbols-outlined" style="font-size:28px;color:${a}">widgets</span>
      </div>
      <div class="bkb-card-body">
        <div class="bkb-card-name">
          ${c(e.name)}
          ${e.isSystem?'<span class="ic-badge ic-badge--blue" style="font-size:10px;margin-left:6px;vertical-align:middle">System</span>':""}
        </div>
        <div class="bkb-card-desc">${c(e.description||"")}</div>
        <div class="bkb-card-meta">
          <span class="ic-badge">${c(e.category||"General")}</span>
          <span class="text-sm text-muted">${f(e.nodes)} step${f(e.nodes)!==1?"s":""}</span>
          <span class="text-sm text-muted" style="margin-left:auto">${l}</span>
        </div>
      </div>
      <div class="bkb-card-actions">
        <button class="btn-icon bkb-card-edit" data-id="${e.id}" title="${e.isSystem?"View":"Edit"}">
          <span class="material-symbols-outlined">${e.isSystem?"visibility":"edit"}</span>
        </button>
        <button class="btn-icon bkb-card-clone" data-id="${e.id}" title="Clone">
          <span class="material-symbols-outlined">content_copy</span>
        </button>
        ${e.isSystem?"":`<button class="btn-icon bkb-card-delete" data-id="${e.id}" title="Delete">
          <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
        </button>`}
      </div>
    </article>`}async function M(e,l){const a=await C(l);if(!a){p("#bkb");return}if(a.isSystem){e.innerHTML=`
      <div class="screen bkb-screen">
        <div class="screen-header">
          <div class="flex items-center gap-2">
            <button class="btn-icon" id="bkb-back">
              <span class="material-symbols-outlined">arrow_back</span>
            </button>
            <div class="screen-title">
              <span class="material-symbols-outlined">widgets</span>
              ${c(a.name)}
            </div>
            <span class="ic-badge ic-badge--blue" style="font-size:11px">System</span>
          </div>
          <button class="btn-primary" id="bkb-clone-system">
            <span class="material-symbols-outlined">content_copy</span>
            Clone to Edit
          </button>
        </div>
        <div class="bkb-readonly-body">
          <div class="bkb-readonly-info">
            <div class="text-sm text-muted" style="margin-bottom:8px">${c(a.description||"")}</div>
            <div class="flex items-center gap-2" style="margin-bottom:16px">
              <span class="ic-badge">${c(a.category||"General")}</span>
              <span class="text-sm text-muted">${f(a.nodes)} step${f(a.nodes)!==1?"s":""}</span>
            </div>
            <div class="bkb-readonly-notice">
              <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-blue)">lock</span>
              System blocks are read-only. Clone this block to create your own editable copy.
            </div>
          </div>
          <div class="bld-node-list bkb-readonly-nodes">
            ${x(a.nodes)}
          </div>
        </div>
      </div>`,w(),e.querySelector("#bkb-back")?.addEventListener("click",()=>p("#bkb")),e.querySelector("#bkb-clone-system")?.addEventListener("click",async()=>{const d=await E(a.id);window.AuroraToast?.show({variant:"success",title:`"${d.name}" created`,description:"You can now edit this block."}),p(`#bkb?id=${d.id}`)});return}let s=N(a);const m=g.getGrouped();e.innerHTML=`
    <div class="screen bkb-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="bkb-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">widgets</span>
            ${s.name}
          </div>
          <span id="bkb-save-status" class="text-sm text-muted" style="margin-left:4px"></span>
        </div>
        <button class="btn-primary" id="bkb-save-btn">
          <span class="material-symbols-outlined">save</span>
          Save Block
        </button>
      </div>

      <div class="bld-body">
        <!-- Left: meta -->
        <div class="bld-config">
          <div class="bld-config-form">
            <label class="ic-label">Name</label>
            <input type="text" id="bkb-name" class="ic-input" value="${c(s.name)}">

            <label class="ic-label" style="margin-top:12px">Description</label>
            <textarea id="bkb-desc" class="ic-input" rows="3">${c(s.description||"")}</textarea>

            <label class="ic-label" style="margin-top:12px">Category</label>
            <input type="text" id="bkb-cat" class="ic-input" value="${c(s.category||"General")}" placeholder="e.g. Color, Privacy…">
          </div>
        </div>

        <!-- Right: nodes -->
        <div class="bld-nodes-panel">
          <div class="bld-nodes-header">
            <span class="text-sm font-medium">Steps</span>
            <span id="bkb-count" class="text-sm text-muted">${s.nodes.length} step${s.nodes.length!==1?"s":""}</span>
            <button class="btn-primary" id="bkb-add-node" style="margin-left:auto">
              <span class="material-symbols-outlined">add</span>
              Add Step
            </button>
          </div>
          <div id="bkb-node-list" class="bld-node-list">
            ${x(s.nodes)}
          </div>
        </div>
      </div>
    </div>

    <!-- Add step modal -->
    <div id="bkb-add-modal" class="bld-modal-overlay" style="display:none">
      <div class="bld-modal">
        <div class="bld-modal-header">
          <span class="bld-modal-title">Add Step</span>
          <button class="btn-icon" id="bkb-modal-close"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="bld-add-body">
          ${Object.entries(m).map(([d,r])=>`
            <div class="bld-add-section">
              <div class="bld-add-cat">${d}</div>
              <div class="bld-add-grid">
                ${r.map(n=>`
                  <button class="bld-add-item" data-tid="${n.id}">
                    <span class="material-symbols-outlined" style="font-size:18px">${n.icon||"tune"}</span>
                    <span class="bld-add-item-name">${n.name}</span>
                  </button>`).join("")}
              </div>
            </div>`).join("")}
        </div>
      </div>
    </div>`,w();const b=e.querySelector("#bkb-save-status");function o(){b&&(b.textContent="Unsaved…")}async function u(){s.name=e.querySelector("#bkb-name")?.value||s.name,s.description=e.querySelector("#bkb-desc")?.value||"",s.category=e.querySelector("#bkb-cat")?.value||"General",await L(s),b&&(b.textContent="Saved"),window.AuroraToast?.show({variant:"success",title:"Block saved"})}e.querySelector("#bkb-back")?.addEventListener("click",async()=>{await u(),p("#bkb")}),e.querySelector("#bkb-save-btn")?.addEventListener("click",u),e.querySelector("#bkb-name")?.addEventListener("input",o),e.querySelector("#bkb-desc")?.addEventListener("input",o),e.querySelector("#bkb-cat")?.addEventListener("input",o);const t=e.querySelector("#bkb-add-modal");e.querySelector("#bkb-add-node")?.addEventListener("click",()=>{t&&(t.style.display="flex")}),e.querySelector("#bkb-modal-close")?.addEventListener("click",()=>{t&&(t.style.display="none")}),t?.addEventListener("click",d=>{d.target===t&&(t.style.display="none")}),e.querySelectorAll(".bld-add-item[data-tid]").forEach(d=>{d.addEventListener("click",()=>{const r=d.dataset.tid,n=g.get(r),k={};(n?.params||[]).forEach(v=>{k[v.name]=v.defaultValue??""}),s.nodes.push({id:q(),type:"transform",transformId:r,label:n?.name||r,params:k}),i(),o(),t&&(t.style.display="none")})});function i(){const d=e.querySelector("#bkb-node-list"),r=e.querySelector("#bkb-count");d&&(d.innerHTML=x(s.nodes),y());const n=f(s.nodes);r&&(r.textContent=`${n} step${n!==1?"s":""}`)}function y(){e.querySelectorAll(".bkb-del-node").forEach(d=>{d.addEventListener("click",async r=>{r.stopPropagation();const n=d.dataset.id;if(!await A({title:"Remove Step?",body:"This will remove the selected transformation from the block.",confirmText:"Remove",variant:"danger",icon:"delete_sweep"}))return;const v=j(s.nodes,n);v&&(v.parent.splice(v.index,1),i(),o())})})}y()}function x(e){const l=H(e);return l.length?l.map(a=>{const{node:s,depth:m,isBranchHeader:b}=a;if(b)return`
        <div class="bld-node-row bld-node-row--header" style="padding-left:${12+m*16}px">
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-text-faint)">subdirectory_arrow_right</span>
          <span class="bld-node-label" style="font-style:italic;font-size:11px;color:var(--ps-text-faint)">${s.label}</span>
        </div>`;const o=g.get(s.transformId),u=s.label||o?.name||s.type;return`
      <div class="bld-node-row" style="padding-left:${8+m*16}px">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-blue)">${o?.icon||"tune"}</span>
        <span style="flex:1;font-size:13px">${u}</span>
        <button class="btn-icon bkb-del-node" data-id="${s.id}" title="Remove">
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-red)">delete</span>
        </button>
      </div>`}).join(""):`<div class="empty-state" style="padding:32px">
    <span class="material-symbols-outlined">account_tree</span>
    <div class="empty-state-title">No steps yet</div></div>`}async function O(e,l){const s=new URLSearchParams(l.split("?")[1]||"").get("id");s?await M(e,s):await B(e)}let S=!1;function w(){if(S)return;S=!0;const e=document.createElement("style");e.textContent=`
    .bkb-screen { display:flex; flex-direction:column; height:100%; }
    .bkb-list-body { flex:1; overflow-y:auto; padding:20px; }
    .bkb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; }
    .bkb-card {
      background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:10px;
      display:flex; align-items:center; gap:12px; padding:14px;
      cursor:pointer; transition:border-color 150ms, box-shadow 150ms;
    }
    .bkb-card:hover { border-color:var(--ps-blue); box-shadow:0 4px 16px rgba(0,119,255,0.1); }
    .bkb-card-icon { width:48px; height:48px; border-radius:10px; background:rgba(0,119,255,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .bkb-card-body { flex:1; overflow:hidden; }
    .bkb-card-name { font-size:14px; font-weight:600; margin-bottom:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .bkb-card-desc { font-size:12px; color:var(--ps-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:6px; }
    .bkb-card-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .bkb-card-actions { display:flex; gap:4px; flex-shrink:0; }

    /* Section headers */
    .bkb-section-header { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--ps-text-muted); padding:4px 0 8px; }

    /* Read-only system block view */
    .bkb-readonly-body { display:flex; flex-direction:column; gap:16px; padding:20px 24px; overflow:auto; flex:1; }
    .bkb-readonly-info { max-width:600px; }
    .bkb-readonly-notice { display:flex; align-items:center; gap:8px; background:rgba(0,119,255,0.08); border:1px solid rgba(0,119,255,0.2); border-radius:8px; padding:10px 14px; font-size:12px; color:var(--ps-text-muted); }
    .bkb-readonly-nodes { max-width:600px; pointer-events:none; opacity:0.75; }
  `,document.head.appendChild(e)}export{O as render};
