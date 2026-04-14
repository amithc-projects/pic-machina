import{b as m,s as h,d as E,c as $,e as q,h as R,i as L}from"./recipes-C3zZWtxZ.js";import{n as v}from"./index-Cvca53V-.js";import{u as w,f as T,n as _}from"./misc-BYzs6oS8.js";import{c as C}from"./nodes-D1JCSoz2.js";import{s as k}from"./dialogs-CUir_jZ5.js";import"./ai-bgremoval-CLcXU_4U.js";function z(e=document){e.querySelectorAll(".tabs").forEach(s=>{const d=s.querySelector('[role="tablist"]');if(!d)return;const l=[...d.querySelectorAll('[role="tab"]')],f=d.getAttribute("aria-orientation")==="vertical";l.forEach(p=>{p.addEventListener("click",()=>A(p,l)),p.addEventListener("keydown",c=>{const b=l.indexOf(c.target),y=f?"ArrowUp":"ArrowLeft",i=f?"ArrowDown":"ArrowRight";c.key===i?(c.preventDefault(),g(l,(b+1)%l.length)):c.key===y?(c.preventDefault(),g(l,(b-1+l.length)%l.length)):c.key==="Home"?(c.preventDefault(),g(l,0)):c.key==="End"&&(c.preventDefault(),g(l,l.length-1))})})})}function g(e,s){e[s].focus(),A(e[s],e)}function A(e,s){e.getAttribute("aria-disabled")!=="true"&&s.forEach(d=>{const l=d===e;d.setAttribute("aria-selected",String(l)),d.setAttribute("tabindex",l?"0":"-1");const f=d.getAttribute("aria-controls");if(f){const p=document.getElementById(f);p&&(l?p.removeAttribute("hidden"):p.setAttribute("hidden",""))}})}const j={"#0077ff":"linear-gradient(135deg, #0a1628 0%, #0044cc 100%)","#8b5cf6":"linear-gradient(135deg, #1a0a2e 0%, #6d28d9 100%)","#22c55e":"linear-gradient(135deg, #0a1e10 0%, #15803d 100%)","#f59e0b":"linear-gradient(135deg, #1e150a 0%, #b45309 100%)","#f472b6":"linear-gradient(135deg, #1e0a14 0%, #be185d 100%)","#374151":"linear-gradient(135deg, #111318 0%, #374151 100%)","#92400e":"linear-gradient(135deg, #1a0e06 0%, #92400e 100%)","#0ea5e9":"linear-gradient(135deg, #060e1a 0%, #0369a1 100%)"};function D(e){if(e.thumbnail)return`background-image:url(${e.thumbnail});background-size:cover;background-position:center;`;const s=j[e.coverColor]||"linear-gradient(135deg, #111318 0%, #1e293b 100%)";return e.isSystem?`background: url(./samples/${e.id}.jpg) center/cover, ${s};`:`background: ${s};`}function N(e){const s=C(e.nodes),d=e.updatedAt?T(e.updatedAt):"—",l=e.isSystem;return`
    <article class="lib-card" data-id="${e.id}" tabindex="0" role="button" aria-label="Recipe: ${e.name}">
      <div class="lib-card__cover" style="${D(e)}">
        <div class="lib-card__cover-overlay">
          <div class="lib-card__badges">
            ${l?'<span class="ic-badge ic-badge--blue"><span class="material-symbols-outlined" style="font-size:11px">lock</span> System</span>':'<span class="ic-badge ic-badge--green"><span class="material-symbols-outlined" style="font-size:11px">person</span> Yours</span>'}
          </div>
          <div class="lib-card__quick-actions">
            <button class="btn-icon lib-action-preview" data-id="${e.id}" title="Preview recipe">
              <span class="material-symbols-outlined">preview</span>
            </button>
            ${l?`<button class="btn-icon lib-action-clone" data-id="${e.id}" title="Clone recipe">
                   <span class="material-symbols-outlined">content_copy</span>
                 </button>`:`<button class="btn-icon lib-action-edit" data-id="${e.id}" title="Edit recipe">
                   <span class="material-symbols-outlined">edit</span>
                 </button>
                 <button class="btn-icon lib-action-export" data-id="${e.id}" title="Export to JSON">
                   <span class="material-symbols-outlined">download</span>
                 </button>
                 ${e.thumbnail?`<button class="btn-icon lib-action-remove-thumb" data-id="${e.id}" title="Remove thumbnail">
                   <span class="material-symbols-outlined" style="color:var(--ps-text-muted)">hide_image</span>
                 </button>`:""}
                 <button class="btn-icon lib-action-delete" data-id="${e.id}" title="Delete recipe">
                   <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
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
          <span class="text-sm text-muted">${d}</span>
        </div>
        <div class="lib-card__tags">
          ${(e.tags||[]).map(f=>`<span class="ic-badge">${f}</span>`).join("")}
        </div>
      </div>
      <div class="lib-card__footer">
        <button class="btn-primary lib-action-use" data-id="${e.id}" style="width:100%;justify-content:center;">
          <span class="material-symbols-outlined">play_arrow</span>
          Use Recipe
        </button>
      </div>
    </article>`}async function J(e){e.innerHTML=`
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
          <button class="btn-secondary" id="btn-import-recipe">
            <span class="material-symbols-outlined">upload</span>
            Import JSON
          </button>
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
            <button role="tab" aria-selected="false" aria-controls="lib-panel-recent" id="lib-tab-recent" tabindex="-1">Recent</button>
          </div>
        </div>
        <div class="flex items-center gap-2" style="margin-left:auto">
          <select id="lib-sort" class="ic-input" style="width:auto;min-width:160px;font-size:12px;padding:5px 8px">
            <option value="updated">Recently Updated</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>
          <span id="lib-count" class="text-sm text-muted" style="padding-right:4px;white-space:nowrap"></span>
        </div>
      </div>

      <div id="lib-tag-filter-row" class="lib-tag-filter-row" style="display:none">
        <span class="text-xs text-muted" style="flex-shrink:0">Filter by tag:</span>
        <div id="lib-tag-chips" class="lib-tag-chips"></div>
        <button id="lib-tag-clear" class="btn-ghost" style="font-size:11px;padding:2px 8px;display:none">Clear</button>
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
        <div id="lib-panel-recent" role="tabpanel" aria-labelledby="lib-tab-recent" hidden>
          <div id="lib-grid-recent" class="lib-grid"></div>
        </div>
      </div>
    </div>`,U();let s=await m(),d=new Set,l="updated";function f(i){return l==="name-asc"?[...i].sort((t,a)=>t.name.localeCompare(a.name)):l==="name-desc"?[...i].sort((t,a)=>a.name.localeCompare(t.name)):[...i].sort((t,a)=>(a.updatedAt||0)-(t.updatedAt||0))}function p(i,t){const a=e.querySelector(`#${i}`);if(a){if(!t.length){a.innerHTML=`<div class="empty-state">
        <span class="material-symbols-outlined">inbox</span>
        <div class="empty-state-title">No recipes here yet</div>
        <div class="empty-state-desc">Click "New Recipe" to create your first one.</div>
      </div>`;return}a.innerHTML=t.map(N).join("")}}function c(){const i=[...new Set(s.flatMap(r=>r.tags||[]))].sort(),t=e.querySelector("#lib-tag-filter-row"),a=e.querySelector("#lib-tag-chips"),o=e.querySelector("#lib-tag-clear");if(!(!t||!a)){if(!i.length){t.style.display="none";return}t.style.display="flex",a.innerHTML=i.map(r=>`<button class="lib-tag-chip ${d.has(r)?"is-active":""}" data-tag="${r}">${r}</button>`).join(""),o&&(o.style.display=d.size?"":"none"),a.querySelectorAll(".lib-tag-chip").forEach(r=>{r.addEventListener("click",()=>{const n=r.dataset.tag;d.has(n)?d.delete(n):d.add(n),c(),b(e.querySelector("#lib-search")?.value||"")})}),o?.addEventListener("click",()=>{d.clear(),c(),b(e.querySelector("#lib-search")?.value||"")})}}function b(i=""){const t=i.toLowerCase();let a=s.filter(n=>!(t&&!n.name.toLowerCase().includes(t)&&!(n.description||"").toLowerCase().includes(t)&&!(n.tags||[]).some(u=>u.toLowerCase().includes(t))||d.size>0&&![...d].some(u=>(n.tags||[]).includes(u))));a=f(a),p("lib-grid-all",a),p("lib-grid-system",a.filter(n=>n.isSystem)),p("lib-grid-user",a.filter(n=>!n.isSystem));const o=[...s].filter(n=>n.lastUsedAt).sort((n,u)=>(u.lastUsedAt||0)-(n.lastUsedAt||0));p("lib-grid-recent",o);const r=e.querySelector("#lib-count");r&&(r.textContent=`${a.length} recipe${a.length!==1?"s":""}`),y()}b(),c(),z(e),e.querySelector("#lib-sort")?.addEventListener("change",i=>{l=i.target.value,b(e.querySelector("#lib-search")?.value||"")}),e.querySelector("#lib-search")?.addEventListener("input",i=>b(i.target.value)),e.querySelector("#btn-new-recipe")?.addEventListener("click",async()=>{const i={id:w(),name:"Untitled Recipe",description:"",isSystem:!1,coverColor:"#0077ff",tags:[],nodes:[],createdAt:_(),updatedAt:_()};await h(i),v(`#bld?id=${i.id}`)}),e.querySelector("#btn-import-recipe")?.addEventListener("click",()=>{const i=document.createElement("input");i.type="file",i.accept=".json",i.onchange=async t=>{const a=t.target.files[0];if(a)try{const o=await a.text(),r=JSON.parse(o);if(r.type!=="PicMachinaRecipeBundle")throw new Error("This file does not appear to be a PicMachina recipe bundle.");const u=(await m()).find(x=>x.id===r.recipe.id);u&&(await k({title:"Recipe Already Exists",body:`A recipe named "${u.name}" already exists. Do you want to overwrite it?`,confirmText:"Overwrite",cancelText:"Keep Both",variant:"warning",icon:"warning"})||(r.recipe.id=w(),r.recipe.name=`${r.recipe.name} (Imported)`)),await E(r),s=await m(),b(e.querySelector("#lib-search")?.value||""),c(),window.AuroraToast?.show({variant:"success",title:"Recipe imported",description:`Successfully loaded "${r.recipe.name}".`})}catch(o){window.AuroraToast?.show({variant:"danger",title:"Import failed",description:o.message})}},i.click()});function y(){async function i(t){const a=s.find(o=>o.id===t);a&&(a.lastUsedAt=Date.now(),await h(a)),v(`#set?recipe=${t}`)}e.querySelectorAll(".lib-action-use").forEach(t=>{t.addEventListener("click",async a=>{a.stopPropagation(),await i(t.dataset.id)})}),e.querySelectorAll(".lib-action-preview").forEach(t=>{t.addEventListener("click",a=>{a.stopPropagation(),v(`#pvw?id=${t.dataset.id}`)})}),e.querySelectorAll(".lib-action-clone").forEach(t=>{t.addEventListener("click",async a=>{a.stopPropagation();const o=await $(t.dataset.id);s=await m(),b(e.querySelector("#lib-search")?.value||""),c(),window.AuroraToast?.show({variant:"success",title:`"${o.name}" cloned`,description:"You can now edit it."}),v(`#bld?id=${o.id}`)})}),e.querySelectorAll(".lib-action-edit").forEach(t=>{t.addEventListener("click",a=>{a.stopPropagation(),v(`#bld?id=${t.dataset.id}`)})}),e.querySelectorAll(".lib-action-delete").forEach(t=>{t.addEventListener("click",async a=>{a.stopPropagation(),await k({title:"Delete Recipe?",body:"This will permanently delete this recipe from your library. This action cannot be undone.",confirmText:"Delete",variant:"danger",icon:"delete_forever"})&&(await q(t.dataset.id),s=s.filter(r=>r.id!==t.dataset.id),b(e.querySelector("#lib-search")?.value||""),c(),window.AuroraToast?.show({variant:"success",title:"Recipe deleted"}))})}),e.querySelectorAll(".lib-action-remove-thumb").forEach(t=>{t.addEventListener("click",async a=>{a.stopPropagation(),await R(t.dataset.id),s=await m(),b(e.querySelector("#lib-search")?.value||""),window.AuroraToast?.show({variant:"success",title:"Thumbnail removed"})})}),e.querySelectorAll(".lib-action-export").forEach(t=>{t.addEventListener("click",async a=>{a.stopPropagation();try{const o=await L(t.dataset.id),r=new Blob([JSON.stringify(o,null,2)],{type:"application/json"}),n=URL.createObjectURL(r),u=document.createElement("a");u.href=n,u.download=`${o.recipe.name.replace(/[^a-z0-9]/gi,"_")}.json`,u.click(),URL.revokeObjectURL(n),window.AuroraToast?.show({variant:"success",title:"Recipe exported",description:"JSON file downloaded."})}catch(o){console.error(o),window.AuroraToast?.show({variant:"danger",title:"Export failed"})}})}),e.querySelectorAll(".lib-card").forEach(t=>{t.addEventListener("click",async a=>{a.target.closest("button")||await i(t.dataset.id)}),t.addEventListener("keydown",async a=>{(a.key==="Enter"||a.key===" ")&&(a.preventDefault(),await i(t.dataset.id))})})}}let S=!1;function U(){if(S)return;S=!0;const e=document.createElement("style");e.textContent=`
    .lib-screen { display: flex; flex-direction: column; height: 100%; }

    .lib-tabs-row {
      display: flex;
      align-items: center;
      padding: 0 20px;
      border-bottom: 1px solid var(--ps-border);
      background: var(--ps-bg-surface);
      flex-shrink: 0;
      gap: 8px;
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

    .lib-tag-filter-row {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 8px 20px; border-bottom: 1px solid var(--ps-border);
      background: var(--ps-bg-surface); flex-shrink: 0;
    }
    .lib-tag-chips { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
    .lib-tag-chip {
      padding: 3px 10px; font-size: 11px; border-radius: 12px;
      border: 1px solid var(--ps-border); background: var(--ps-bg-raised);
      color: var(--ps-text-muted); cursor: pointer; font-family: var(--font-primary);
      transition: all 100ms;
    }
    .lib-tag-chip.is-active { background: var(--ps-blue); border-color: var(--ps-blue); color: #fff; }
    .lib-tag-chip:not(.is-active):hover { border-color: var(--ps-blue); color: var(--ps-text); }

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
  `,document.head.appendChild(e)}export{J as render};
