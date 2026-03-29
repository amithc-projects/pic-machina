import{a as q,g as L,c as A,d as B,s as h}from"./blocks-DHwz8iYS.js";import{n as c}from"./index-DpFMNAiN.js";import{d as C,u as $,f as z,n as g}from"./misc-DpJZ-4k9.js";import{r as u}from"./processor-BO1Q6VPM.js";import"./ai-bgremoval-stlubUex.js";function p(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}async function S(e){const s=await L();s.sort((t,a)=>(a.updatedAt||0)-(t.updatedAt||0)),e.innerHTML=`
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
        ${s.length===0?`<div class="empty-state" style="padding-top:60px">
               <span class="material-symbols-outlined" style="font-size:48px">widgets</span>
               <div class="empty-state-title">No blocks yet</div>
               <div class="empty-state-desc">Blocks are reusable step sequences you can drop into any recipe.</div>
               <button class="btn-primary" id="bkb-empty-new">
                 <span class="material-symbols-outlined">add</span>
                 Create First Block
               </button>
             </div>`:`<div class="bkb-grid">
               ${s.map(t=>N(t)).join("")}
             </div>`}
      </div>
    </div>`,E(),e.querySelector("#bkb-btn-new, #bkb-empty-new")?.addEventListener("click",()=>o()),e.querySelectorAll(".bkb-card-edit").forEach(t=>{t.addEventListener("click",a=>{a.stopPropagation(),c(`#bkb?id=${t.dataset.id}`)})}),e.querySelectorAll(".bkb-card-clone").forEach(t=>{t.addEventListener("click",async a=>{a.stopPropagation();const r=await A(t.dataset.id);window.AuroraToast?.show({variant:"success",title:`"${r.name}" cloned`}),c(`#bkb?id=${r.id}`)})}),e.querySelectorAll(".bkb-card-delete").forEach(t=>{t.addEventListener("click",async a=>{a.stopPropagation(),confirm("Delete this block? It will be removed from any recipes that reference it.")&&(await B(t.dataset.id),window.AuroraToast?.show({variant:"success",title:"Block deleted"}),S(e))})}),e.querySelectorAll(".bkb-card").forEach(t=>{t.addEventListener("click",a=>{a.target.closest("button")||c(`#bkb?id=${t.dataset.id}`)})});async function o(){const t={id:$(),name:"Untitled Block",description:"",category:"General",nodes:[],createdAt:g(),updatedAt:g()};await h(t),c(`#bkb?id=${t.id}`)}}function N(e){const s=e.updatedAt?z(e.updatedAt):"—";return`
    <article class="bkb-card" data-id="${e.id}" tabindex="0">
      <div class="bkb-card-icon">
        <span class="material-symbols-outlined" style="font-size:28px;color:var(--ps-blue)">widgets</span>
      </div>
      <div class="bkb-card-body">
        <div class="bkb-card-name">${e.name}</div>
        <div class="bkb-card-desc">${e.description||""}</div>
        <div class="bkb-card-meta">
          <span class="ic-badge">${e.category||"General"}</span>
          <span class="text-sm text-muted">${e.nodes.length} step${e.nodes.length!==1?"s":""}</span>
          <span class="text-sm text-muted" style="margin-left:auto">${s}</span>
        </div>
      </div>
      <div class="bkb-card-actions">
        <button class="btn-icon bkb-card-edit" data-id="${e.id}" title="Edit">
          <span class="material-symbols-outlined">edit</span>
        </button>
        <button class="btn-icon bkb-card-clone" data-id="${e.id}" title="Clone">
          <span class="material-symbols-outlined">content_copy</span>
        </button>
        <button class="btn-icon bkb-card-delete" data-id="${e.id}" title="Delete">
          <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
        </button>
      </div>
    </article>`}async function j(e,s){const o=await q(s);if(!o){c("#bkb");return}let t=C(o);const a=u.getGrouped();e.innerHTML=`
    <div class="screen bkb-screen">
      <div class="screen-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" id="bkb-back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="screen-title">
            <span class="material-symbols-outlined">widgets</span>
            ${t.name}
          </div>
          <span id="bkb-save-status" class="text-sm text-muted"></span>
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
            <input type="text" id="bkb-name" class="ic-input" value="${p(t.name)}">

            <label class="ic-label" style="margin-top:12px">Description</label>
            <textarea id="bkb-desc" class="ic-input" rows="3">${p(t.description||"")}</textarea>

            <label class="ic-label" style="margin-top:12px">Category</label>
            <input type="text" id="bkb-cat" class="ic-input" value="${p(t.category||"General")}" placeholder="e.g. Color, Privacy…">
          </div>
        </div>

        <!-- Right: nodes -->
        <div class="bld-nodes-panel">
          <div class="bld-nodes-header">
            <span class="text-sm font-medium">Steps</span>
            <span id="bkb-count" class="text-sm text-muted">${t.nodes.length} step${t.nodes.length!==1?"s":""}</span>
            <button class="btn-primary" id="bkb-add-node" style="margin-left:auto">
              <span class="material-symbols-outlined">add</span>
              Add Step
            </button>
          </div>
          <div id="bkb-node-list" class="bld-node-list">
            ${x(t.nodes)}
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
          ${Object.entries(a).map(([d,l])=>`
            <div class="bld-add-section">
              <div class="bld-add-cat">${d}</div>
              <div class="bld-add-grid">
                ${l.map(n=>`
                  <button class="bld-add-item" data-tid="${n.id}">
                    <span class="material-symbols-outlined" style="font-size:18px">${n.icon||"tune"}</span>
                    <span class="bld-add-item-name">${n.name}</span>
                  </button>`).join("")}
              </div>
            </div>`).join("")}
        </div>
      </div>
    </div>`,E();const r=e.querySelector("#bkb-save-status");function b(){r&&(r.textContent="Unsaved…")}async function m(){t.name=e.querySelector("#bkb-name")?.value||t.name,t.description=e.querySelector("#bkb-desc")?.value||"",t.category=e.querySelector("#bkb-cat")?.value||"General",await h(t),r&&(r.textContent="Saved"),window.AuroraToast?.show({variant:"success",title:"Block saved"})}e.querySelector("#bkb-back")?.addEventListener("click",async()=>{await m(),c("#bkb")}),e.querySelector("#bkb-save-btn")?.addEventListener("click",m),e.querySelector("#bkb-name")?.addEventListener("input",b),e.querySelector("#bkb-desc")?.addEventListener("input",b),e.querySelector("#bkb-cat")?.addEventListener("input",b);const i=e.querySelector("#bkb-add-modal");e.querySelector("#bkb-add-node")?.addEventListener("click",()=>{i&&(i.style.display="flex")}),e.querySelector("#bkb-modal-close")?.addEventListener("click",()=>{i&&(i.style.display="none")}),i?.addEventListener("click",d=>{d.target===i&&(i.style.display="none")}),e.querySelectorAll(".bld-add-item[data-tid]").forEach(d=>{d.addEventListener("click",()=>{const l=d.dataset.tid,n=u.get(l),k={};(n?.params||[]).forEach(f=>{k[f.name]=f.defaultValue??""}),t.nodes.push({id:$(),type:"transform",transformId:l,label:n?.name||l,params:k}),v(),b(),i&&(i.style.display="none")})});function v(){const d=e.querySelector("#bkb-node-list"),l=e.querySelector("#bkb-count");d&&(d.innerHTML=x(t.nodes),y()),l&&(l.textContent=`${t.nodes.length} step${t.nodes.length!==1?"s":""}`)}function y(){e.querySelectorAll(".bkb-del-node").forEach(d=>{d.addEventListener("click",l=>{l.stopPropagation();const n=parseInt(d.dataset.idx);t.nodes.splice(n,1),v(),b()})})}y()}function x(e){return e.length?e.map((s,o)=>{const t=u.get(s.transformId),a=s.label||t?.name||s.type;return`<div class="bld-node-row">
      <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-blue)">${t?.icon||"tune"}</span>
      <span style="flex:1;font-size:13px">${a}</span>
      <button class="btn-icon bkb-del-node" data-idx="${o}" title="Remove">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--ps-red)">delete</span>
      </button>
    </div>`}).join(""):`<div class="empty-state" style="padding:32px">
    <span class="material-symbols-outlined">account_tree</span>
    <div class="empty-state-title">No steps yet</div></div>`}async function I(e,s){const t=new URLSearchParams(s.split("?")[1]||"").get("id");t?await j(e,t):await S(e)}let w=!1;function E(){if(w)return;w=!0;const e=document.createElement("style");e.textContent=`
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
  `,document.head.appendChild(e)}export{I as render};
