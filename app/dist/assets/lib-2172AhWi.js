import{g as u,s as x,c as h,d as w}from"./recipes-qesXpeyQ.js";import{n as c}from"./index-DpFMNAiN.js";import{u as _,f as k,n as f}from"./misc-DpJZ-4k9.js";import"./ai-bgremoval-stlubUex.js";function A(e=document){e.querySelectorAll(".tabs").forEach(s=>{const l=s.querySelector('[role="tablist"]');if(!l)return;const a=[...l.querySelectorAll('[role="tab"]')],n=l.getAttribute("aria-orientation")==="vertical";a.forEach(t=>{t.addEventListener("click",()=>y(t,a)),t.addEventListener("keydown",i=>{const r=a.indexOf(i.target),d=n?"ArrowUp":"ArrowLeft",o=n?"ArrowDown":"ArrowRight";i.key===o?(i.preventDefault(),b(a,(r+1)%a.length)):i.key===d?(i.preventDefault(),b(a,(r-1+a.length)%a.length)):i.key==="Home"?(i.preventDefault(),b(a,0)):i.key==="End"&&(i.preventDefault(),b(a,a.length-1))})})})}function b(e,s){e[s].focus(),y(e[s],e)}function y(e,s){e.getAttribute("aria-disabled")!=="true"&&s.forEach(l=>{const a=l===e;l.setAttribute("aria-selected",String(a)),l.setAttribute("tabindex",a?"0":"-1");const n=l.getAttribute("aria-controls");if(n){const t=document.getElementById(n);t&&(a?t.removeAttribute("hidden"):t.setAttribute("hidden",""))}})}const v={"#0077ff":"linear-gradient(135deg, #0a1628 0%, #0044cc 100%)","#8b5cf6":"linear-gradient(135deg, #1a0a2e 0%, #6d28d9 100%)","#22c55e":"linear-gradient(135deg, #0a1e10 0%, #15803d 100%)","#f59e0b":"linear-gradient(135deg, #1e150a 0%, #b45309 100%)","#f472b6":"linear-gradient(135deg, #1e0a14 0%, #be185d 100%)","#374151":"linear-gradient(135deg, #111318 0%, #374151 100%)","#92400e":"linear-gradient(135deg, #1a0e06 0%, #92400e 100%)","#0ea5e9":"linear-gradient(135deg, #060e1a 0%, #0369a1 100%)"};function S(e){return e.coverColor&&v[e.coverColor]?`background: ${v[e.coverColor]};`:"background: linear-gradient(135deg, #111318 0%, #1e293b 100%);"}function p(e=[]){let s=0;for(const l of e)s++,l.branches&&l.branches.forEach(a=>{s+=p(a.nodes)}),l.thenNodes&&(s+=p(l.thenNodes)),l.elseNodes&&(s+=p(l.elseNodes));return s}function $(e){const s=p(e.nodes),l=e.updatedAt?k(e.updatedAt):"—",a=e.isSystem;return`
    <article class="lib-card" data-id="${e.id}" tabindex="0" role="button" aria-label="Recipe: ${e.name}">
      <div class="lib-card__cover" style="${S(e)}">
        <div class="lib-card__cover-overlay">
          <div class="lib-card__badges">
            ${a?'<span class="ic-badge ic-badge--blue"><span class="material-symbols-outlined" style="font-size:11px">lock</span> System</span>':'<span class="ic-badge ic-badge--green"><span class="material-symbols-outlined" style="font-size:11px">person</span> Yours</span>'}
          </div>
          <div class="lib-card__quick-actions">
            <button class="btn-icon lib-action-preview" data-id="${e.id}" title="Preview recipe">
              <span class="material-symbols-outlined">preview</span>
            </button>
            ${a?`<button class="btn-icon lib-action-clone" data-id="${e.id}" title="Clone recipe">
                   <span class="material-symbols-outlined">content_copy</span>
                 </button>`:`<button class="btn-icon lib-action-edit" data-id="${e.id}" title="Edit recipe">
                   <span class="material-symbols-outlined">edit</span>
                 </button>
                 <button class="btn-icon lib-action-delete" data-id="${e.id}" title="Delete recipe">
                   <span class="material-symbols-outlined">delete</span>
                 </button>`}
          </div>
        </div>
      </div>
      <div class="lib-card__body">
        <h3 class="lib-card__name">${e.name}</h3>
        <p class="lib-card__desc">${e.description||""}</p>
        <div class="lib-card__meta">
          <span class="mono text-sm text-muted">
            <span class="material-symbols-outlined" style="font-size:13px;vertical-align:-2px">account_tree</span>
            ${s} node${s!==1?"s":""}
          </span>
          <span class="text-sm text-muted">${l}</span>
        </div>
        <div class="lib-card__tags">
          ${(e.tags||[]).map(n=>`<span class="ic-badge">${n}</span>`).join("")}
        </div>
      </div>
      <div class="lib-card__footer">
        <button class="btn-primary lib-action-use" data-id="${e.id}" style="width:100%;justify-content:center;">
          <span class="material-symbols-outlined">play_arrow</span>
          Use Recipe
        </button>
      </div>
    </article>`}async function D(e){e.innerHTML=`
    <div class="screen lib-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">library_books</span>
          Recipe Library
        </div>
        <div class="flex items-center gap-2">
          <div style="position:relative;">
            <span class="material-symbols-outlined" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:17px;color:var(--ps-text-faint);pointer-events:none">search</span>
            <input id="lib-search" class="ic-input" placeholder="Search recipes…" style="padding-left:32px;width:220px;" autocomplete="off">
          </div>
          <button class="btn-primary" id="btn-new-recipe">
            <span class="material-symbols-outlined">add</span>
            New Recipe
          </button>
        </div>
      </div>

      <div class="lib-tabs-row">
        <div class="tabs" id="lib-tabs">
          <div role="tablist" aria-label="Recipe filter">
            <button role="tab" aria-selected="true"  aria-controls="lib-panel-all"    id="lib-tab-all"    tabindex="0">All</button>
            <button role="tab" aria-selected="false" aria-controls="lib-panel-system" id="lib-tab-system" tabindex="-1">System</button>
            <button role="tab" aria-selected="false" aria-controls="lib-panel-user"   id="lib-tab-user"   tabindex="-1">My Recipes</button>
          </div>
        </div>
        <span id="lib-count" class="text-sm text-muted" style="margin-left:auto;padding-right:4px;"></span>
      </div>

      <div class="lib-body overflow-y-auto flex-1">
        <div id="lib-panel-all"    role="tabpanel" aria-labelledby="lib-tab-all">
          <div id="lib-grid-all"    class="lib-grid"></div>
        </div>
        <div id="lib-panel-system" role="tabpanel" aria-labelledby="lib-tab-system" hidden>
          <div id="lib-grid-system" class="lib-grid"></div>
        </div>
        <div id="lib-panel-user"   role="tabpanel" aria-labelledby="lib-tab-user"   hidden>
          <div id="lib-grid-user"   class="lib-grid"></div>
        </div>
      </div>
    </div>`,E();let s=await u();s.sort((t,i)=>t.isSystem!==i.isSystem?t.isSystem?-1:1:(i.updatedAt||0)-(t.updatedAt||0));function l(t,i){const r=e.querySelector(`#${t}`);if(r){if(!i.length){r.innerHTML=`<div class="empty-state">
        <span class="material-symbols-outlined">inbox</span>
        <div class="empty-state-title">No recipes here yet</div>
        <div class="empty-state-desc">Click "New Recipe" to create your first one.</div>
      </div>`;return}r.innerHTML=i.map($).join("")}}function a(t=""){const i=t.toLowerCase(),r=i?s.filter(o=>o.name.toLowerCase().includes(i)||(o.description||"").toLowerCase().includes(i)||(o.tags||[]).some(g=>g.toLowerCase().includes(i))):s;l("lib-grid-all",r),l("lib-grid-system",r.filter(o=>o.isSystem)),l("lib-grid-user",r.filter(o=>!o.isSystem));const d=e.querySelector("#lib-count");d&&(d.textContent=`${r.length} recipe${r.length!==1?"s":""}`),n()}a(),A(e),e.querySelector("#lib-search")?.addEventListener("input",t=>a(t.target.value)),e.querySelector("#btn-new-recipe")?.addEventListener("click",async()=>{const t={id:_(),name:"Untitled Recipe",description:"",isSystem:!1,coverColor:"#0077ff",tags:[],nodes:[],createdAt:f(),updatedAt:f()};await x(t),c(`#bld?id=${t.id}`)});function n(){e.querySelectorAll(".lib-action-use").forEach(t=>{t.addEventListener("click",i=>{i.stopPropagation(),c(`#set?recipe=${t.dataset.id}`)})}),e.querySelectorAll(".lib-action-preview").forEach(t=>{t.addEventListener("click",i=>{i.stopPropagation(),c(`#pvw?id=${t.dataset.id}`)})}),e.querySelectorAll(".lib-action-clone").forEach(t=>{t.addEventListener("click",async i=>{i.stopPropagation();const r=await h(t.dataset.id);s=await u(),s.sort((d,o)=>d.isSystem!==o.isSystem?d.isSystem?-1:1:o.updatedAt-d.updatedAt),a(e.querySelector("#lib-search")?.value||""),window.AuroraToast?.show({variant:"success",title:`"${r.name}" cloned`,description:"You can now edit it."}),c(`#bld?id=${r.id}`)})}),e.querySelectorAll(".lib-action-edit").forEach(t=>{t.addEventListener("click",i=>{i.stopPropagation(),c(`#bld?id=${t.dataset.id}`)})}),e.querySelectorAll(".lib-action-delete").forEach(t=>{t.addEventListener("click",async i=>{i.stopPropagation(),confirm("Delete this recipe? This cannot be undone.")&&(await w(t.dataset.id),s=s.filter(r=>r.id!==t.dataset.id),a(e.querySelector("#lib-search")?.value||""),window.AuroraToast?.show({variant:"success",title:"Recipe deleted"}))})}),e.querySelectorAll(".lib-card").forEach(t=>{t.addEventListener("click",i=>{i.target.closest("button")||c(`#pvw?id=${t.dataset.id}`)}),t.addEventListener("keydown",i=>{(i.key==="Enter"||i.key===" ")&&(i.preventDefault(),c(`#pvw?id=${t.dataset.id}`))})})}}let m=!1;function E(){if(m)return;m=!0;const e=document.createElement("style");e.textContent=`
    .lib-screen { display: flex; flex-direction: column; height: 100%; }

    .lib-tabs-row {
      display: flex;
      align-items: center;
      padding: 0 20px;
      border-bottom: 1px solid var(--ps-border);
      background: var(--ps-bg-surface);
      flex-shrink: 0;
    }
    .lib-tabs-row .tabs { flex: 1; border: none; background: transparent; }
    .lib-tabs-row [role="tablist"] { display: flex; gap: 0; border: none; }
    .lib-tabs-row [role="tab"] {
      background: transparent; border: none; border-bottom: 2px solid transparent;
      color: var(--ps-text-muted); padding: 12px 16px; font-size: 13px; font-weight: 500;
      cursor: pointer; font-family: var(--font-primary); transition: color 150ms ease, border-color 150ms ease;
    }
    .lib-tabs-row [role="tab"][aria-selected="true"] {
      color: var(--ps-blue); border-bottom-color: var(--ps-blue);
    }
    .lib-tabs-row [role="tab"]:hover { color: var(--ps-text); }

    .lib-body { flex: 1; overflow-y: auto; padding: 20px; }

    .lib-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }

    .lib-card {
      background: var(--ps-bg-surface);
      border: 1px solid var(--ps-border);
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
      display: flex;
      flex-direction: column;
      outline: none;
    }
    .lib-card:hover {
      transform: translateY(-3px);
      border-color: var(--ps-blue);
      box-shadow: 0 8px 24px rgba(0,119,255,0.12);
    }
    .lib-card:focus-visible {
      box-shadow: var(--ps-blue-glow);
    }

    .lib-card__cover {
      height: 140px;
      position: relative;
      overflow: hidden;
    }
    .lib-card__cover-overlay {
      position: absolute; inset: 0;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 60%);
      opacity: 0;
      transition: opacity 150ms ease;
    }
    .lib-card:hover .lib-card__cover-overlay { opacity: 1; }

    .lib-card__badges { display: flex; gap: 5px; }
    .lib-card__quick-actions { display: flex; gap: 4px; }
    .lib-card__quick-actions .btn-icon {
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      width: 28px; height: 28px; border-radius: 6px;
      color: var(--ps-text);
    }
    .lib-card__quick-actions .btn-icon:hover { background: var(--ps-blue); }

    .lib-card__body { padding: 12px 14px 8px; flex: 1; }
    .lib-card__name { font-size: 14px; font-weight: 600; color: var(--ps-text); margin-bottom: 4px; }
    .lib-card__desc {
      font-size: 12px; color: var(--ps-text-muted); line-height: 1.5;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      margin-bottom: 8px; min-height: 36px;
    }
    .lib-card__meta {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px;
    }
    .lib-card__tags { display: flex; flex-wrap: wrap; gap: 4px; min-height: 22px; }
    .lib-card__footer { padding: 10px 14px; border-top: 1px solid var(--ps-border); }
    .lib-card__footer .btn-primary { font-size: 12px; padding: 7px 12px; }
  `,document.head.appendChild(e)}export{D as render};
