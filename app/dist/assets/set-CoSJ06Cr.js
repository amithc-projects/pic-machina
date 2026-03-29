import{g as L,c as R,a as z,w as I,u as S,b as E,p as q,l as $}from"./runs-vZMHdHCv.js";import{g as O,a as A}from"./recipes-qesXpeyQ.js";import{g as N}from"./blocks-DHwz8iYS.js";import{n as B}from"./index-DpFMNAiN.js";import{a as T}from"./misc-DpJZ-4k9.js";import"./ai-bgremoval-stlubUex.js";let C=null;function j(){return C||(C=new Worker(new URL("/assets/worker-Cbg-OAKr.js",import.meta.url),{type:"module"})),C}async function F({recipe:i,files:x,outputHandle:b,subfolder:n="output",onProgress:p,onLog:o,onComplete:r,onError:u}){const v=await L(b,n),h=await N(),w=Object.fromEntries(h.map(f=>[f.id,f])),a=await R({recipeId:i.id,recipeName:i.name,inputFolder:"",outputFolder:n,imageCount:x.length}),g=j();return g.onmessage=async f=>{const{type:d,payload:l}=f.data;if(l.runId===a.id){if(d==="PROGRESS"&&(a.successCount=l.processed,p?.(l.processed,l.total,l.filename)),d==="LOG"&&(await z(a,l.level,l.msg),o?.(l.level,l.msg)),d==="FILE_DONE")try{const y=l.subfolder?await L(b,l.subfolder):v;await I(y,l.filename,l.blob)}catch(y){o?.("error",`Write failed: ${l.filename} — ${y.message}`)}d==="COMPLETE"&&(a.finishedAt=Date.now(),a.status="completed",a.successCount=l.successCount,a.failCount=l.failCount,await S(a),r?.(a)),d==="ERROR"&&(a.status="failed",a.finishedAt=Date.now(),await S(a),u?.(l.msg))}},g.postMessage({type:"START",payload:{recipe:i,files:x,outputConfig:{subfolder:n,blocks:w},runId:a.id}}),{runId:a.id,cancel:async()=>{g.postMessage({type:"CANCEL",payload:{runId:a.id}}),a.status="cancelled",a.finishedAt=Date.now(),await S(a)}}}async function K(i,x){const b=new URLSearchParams(x.split("?")[1]||"").get("recipe");let n=null,p=null,o=[],r=new Set,u=null,v=[],h=null;i.innerHTML=`
    <div class="screen set-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">folder_open</span>
          Batch Setup
        </div>
        <div class="flex items-center gap-2">
          <span id="set-sel-count" class="ic-badge"></span>
          <button class="btn-secondary" id="btn-select-all">Select All</button>
          <button class="btn-primary" id="btn-run" disabled>
            <span class="material-symbols-outlined">play_arrow</span>
            Run Batch
          </button>
        </div>
      </div>

      <div class="set-body">
        <!-- Left config panel -->
        <div class="set-config">
          <!-- Recipe selector -->
          <section class="set-section">
            <div class="set-section-title">Recipe</div>
            <div id="set-recipe-display" class="set-recipe-pill">
              <span class="material-symbols-outlined">format_list_numbered</span>
              <span id="set-recipe-name">No recipe selected</span>
              <button class="btn-ghost" id="btn-pick-recipe" style="margin-left:auto">
                <span class="material-symbols-outlined">swap_horiz</span>Change
              </button>
            </div>
          </section>

          <!-- Input folder -->
          <section class="set-section">
            <div class="set-section-title">Input Folder</div>
            <div class="set-folder-row" id="set-input-row">
              <span class="material-symbols-outlined" style="color:var(--ps-text-faint)">folder</span>
              <span id="set-input-path" class="set-folder-path text-muted">Not selected</span>
              <button class="btn-secondary" id="btn-pick-input">
                <span class="material-symbols-outlined">folder_open</span>Browse
              </button>
            </div>
            <div id="set-input-stats" class="text-sm text-muted" style="margin-top:4px;"></div>
          </section>

          <!-- Output folder -->
          <section class="set-section">
            <div class="set-section-title">Output Folder</div>
            <div class="set-folder-row" id="set-output-row">
              <span class="material-symbols-outlined" style="color:var(--ps-text-faint)">drive_folder_upload</span>
              <span id="set-output-path" class="set-folder-path text-muted">Not selected</span>
              <button class="btn-secondary" id="btn-pick-output">
                <span class="material-symbols-outlined">folder_open</span>Browse
              </button>
            </div>
            <div class="set-subfolder-row">
              <label class="ic-label">Output subfolder</label>
              <input id="set-subfolder" class="ic-input" value="output" style="max-width:160px">
            </div>
          </section>

          <!-- Options -->
          <section class="set-section">
            <div class="set-section-title">Options</div>
            <label class="set-checkbox-row">
              <input type="checkbox" id="opt-skip-existing" checked>
              <span>Skip already-processed files</span>
            </label>
          </section>
        </div>

        <!-- Right: image grid -->
        <div class="set-grid-area">
          <div id="set-image-grid" class="set-image-grid">
            <div class="empty-state" style="grid-column:1/-1">
              <span class="material-symbols-outlined">photo_library</span>
              <div class="empty-state-title">No input folder selected</div>
              <div class="empty-state-desc">Pick an input folder to see images here.</div>
            </div>
          </div>
        </div>
      </div>
    </div>`,M(),v=await O(),n=await E("input").catch(()=>null),p=await E("output").catch(()=>null),n&&(i.querySelector("#set-input-path").textContent=n.name,await w()),p&&(i.querySelector("#set-output-path").textContent=p.name),b&&(u=await A(b),u&&l()),d(),i.querySelector("#btn-pick-recipe").addEventListener("click",()=>y()),i.querySelector("#btn-pick-input").addEventListener("click",async()=>{try{n=await q("input"),i.querySelector("#set-input-path").textContent=n.name,await w(),d()}catch(t){t.name!=="AbortError"&&console.error(t)}}),i.querySelector("#btn-pick-output").addEventListener("click",async()=>{try{p=await q("output"),i.querySelector("#set-output-path").textContent=p.name,d()}catch(t){t.name!=="AbortError"&&console.error(t)}}),i.querySelector("#btn-select-all").addEventListener("click",()=>{r=r.size===o.length?new Set:new Set(o.map(e=>e.name)),g()}),i.querySelector("#btn-run").addEventListener("click",async()=>{if(!u||!n||!p)return;const t=r.size>0?o.filter(s=>r.has(s.name)):o;if(!t.length)return;const e=i.querySelector("#set-subfolder").value.trim()||"output";B("#que"),setTimeout(async()=>{h=await F({recipe:u,files:t,outputHandle:p,subfolder:e,onProgress:(s,c,m)=>window._queProgress?.(s,c,m),onLog:(s,c)=>window._queLog?.(s,c),onComplete:s=>window._queComplete?.(s),onError:s=>window._queError?.(s)}),window._queRunControl=h},50)});async function w(){if(n)try{o=await $(n),r=new Set(o.map(e=>e.name)),a();const t=i.querySelector("#set-input-stats");t&&(t.textContent=`${o.length} image${o.length!==1?"s":""} found`),d()}catch(t){console.error("[SET] listImages failed:",t)}}function a(){const t=i.querySelector("#set-image-grid");if(!o.length){t.innerHTML=`<div class="empty-state" style="grid-column:1/-1">
        <span class="material-symbols-outlined">image_not_supported</span>
        <div class="empty-state-title">No images found</div>
        <div class="empty-state-desc">This folder contains no supported image files.</div>
      </div>`;return}t.innerHTML=o.map(e=>`
      <label class="set-img-cell ${r.has(e.name)?"is-selected":""}" data-name="${e.name}">
        <input type="checkbox" class="set-img-check" data-name="${e.name}" ${r.has(e.name)?"checked":""} style="display:none">
        <div class="set-img-thumb" data-file-name="${e.name}">
          <span class="material-symbols-outlined set-img-placeholder">image</span>
        </div>
        <div class="set-img-check-icon">
          <span class="material-symbols-outlined">check_circle</span>
        </div>
        <div class="set-img-name">${e.name}</div>
        <div class="set-img-size">${T(e.size)}</div>
      </label>`).join(""),t.querySelectorAll("[data-file-name]").forEach(e=>{const s=o.find(k=>k.name===e.dataset.fileName);if(!s)return;const c=URL.createObjectURL(s),m=new Image;m.onload=()=>{e.style.backgroundImage=`url(${c})`,e.style.backgroundSize="cover",e.style.backgroundPosition="center",e.querySelector(".set-img-placeholder")?.remove()},m.onerror=()=>URL.revokeObjectURL(c),m.src=c,setTimeout(()=>URL.revokeObjectURL(c),6e4)}),t.querySelectorAll(".set-img-cell").forEach(e=>{e.addEventListener("click",()=>{const s=e.dataset.name;r.has(s)?r.delete(s):r.add(s),g()})})}function g(){i.querySelectorAll(".set-img-cell").forEach(t=>{const e=r.has(t.dataset.name);t.classList.toggle("is-selected",e);const s=t.querySelector(".set-img-check");s&&(s.checked=e)}),f()}function f(){const t=i.querySelector("#set-sel-count");if(!t)return;const e=r.size;t.textContent=e?`${e} selected`:"None selected",t.className=`ic-badge ${e?"ic-badge--blue":""}`}function d(){const t=i.querySelector("#btn-run");if(!t)return;const e=u&&n&&p&&o.length>0;t.disabled=!e}function l(){const t=i.querySelector("#set-recipe-name");t&&(t.textContent=u?.name||"No recipe selected"),d()}function y(){const t=document.getElementById("recipe-picker-modal");t&&t.remove();const e=document.createElement("dialog");e.id="recipe-picker-modal",e.className="modal",e.innerHTML=`
      <div class="modal__header">
        <h2 class="modal__title">Choose a Recipe</h2>
        <button class="modal__close" aria-label="Close"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="modal__body" style="padding:0">
        <div style="padding:12px 16px;border-bottom:1px solid var(--ps-border)">
          <input class="ic-input" id="recipe-picker-search" placeholder="Search…" autocomplete="off">
        </div>
        <ul id="recipe-picker-list" style="list-style:none;padding:8px;margin:0;max-height:400px;overflow-y:auto;">
          ${v.map(s=>`
            <li class="recipe-picker-item" data-id="${s.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background 100ms">
              <div class="recipe-picker-swatch" style="width:24px;height:24px;border-radius:6px;background:${s.coverColor||"#374151"};flex-shrink:0"></div>
              <div>
                <div style="font-size:13px;font-weight:500;color:var(--ps-text)">${s.name}</div>
                <div style="font-size:11px;color:var(--ps-text-muted)">${s.isSystem?"System":"Yours"}</div>
              </div>
            </li>`).join("")}
        </ul>
      </div>`,document.body.appendChild(e),e.showModal(),e.querySelector(".modal__close")?.addEventListener("click",()=>e.close()),e.addEventListener("click",s=>{s.target===e&&e.close()}),e.querySelector("#recipe-picker-search")?.addEventListener("input",s=>{const c=s.target.value.toLowerCase();e.querySelectorAll(".recipe-picker-item").forEach(m=>{const k=m.querySelector("div > div")?.textContent?.toLowerCase()||"";m.style.display=k.includes(c)?"":"none"})}),e.querySelectorAll(".recipe-picker-item").forEach(s=>{s.addEventListener("mouseenter",()=>s.style.background="var(--ps-bg-raised)"),s.addEventListener("mouseleave",()=>s.style.background=""),s.addEventListener("click",()=>{u=v.find(c=>c.id===s.dataset.id),l(),e.close()})})}}let _=!1;function M(){if(_)return;_=!0;const i=document.createElement("style");i.textContent=`
    .set-screen { display:flex; flex-direction:column; height:100%; }
    .set-body { display:flex; flex:1; overflow:hidden; }

    .set-config {
      width: 280px; min-width: 280px;
      border-right: 1px solid var(--ps-border);
      overflow-y: auto;
      padding: 16px;
      display: flex; flex-direction: column; gap: 16px;
      background: var(--ps-bg-surface);
    }
    .set-section-title {
      font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.07em;
      color:var(--ps-text-muted); margin-bottom:8px;
    }
    .set-recipe-pill {
      display:flex; align-items:center; gap:8px;
      background:var(--ps-bg-raised); border:1px solid var(--ps-border);
      border-radius:8px; padding:8px 10px; font-size:13px; color:var(--ps-text);
    }
    .set-recipe-pill .material-symbols-outlined { color:var(--ps-blue); font-size:18px; }
    .set-folder-row {
      display:flex; align-items:center; gap:8px;
      background:var(--ps-bg-overlay); border:1px solid var(--ps-border);
      border-radius:8px; padding:8px 10px; font-size:13px;
    }
    .set-folder-path { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
    .set-subfolder-row { margin-top:8px; display:flex; align-items:center; gap:8px; }
    .set-subfolder-row .ic-label { white-space:nowrap; margin-bottom:0; }
    .set-checkbox-row { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ps-text); cursor:pointer; }

    .set-grid-area { flex:1; overflow-y:auto; padding:16px; }
    .set-image-grid {
      display:grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap:10px;
    }
    .set-img-cell {
      position:relative; border-radius:8px; overflow:hidden; cursor:pointer;
      border:2px solid var(--ps-border); transition:border-color 150ms ease;
    }
    .set-img-cell.is-selected { border-color:var(--ps-blue); }
    .set-img-thumb {
      width:100%; aspect-ratio:1; background:var(--ps-bg-raised);
      display:flex; align-items:center; justify-content:center;
    }
    .set-img-thumb .material-symbols-outlined { font-size:32px; color:var(--ps-text-faint); }
    .set-img-check-icon {
      position:absolute; top:4px; right:4px;
      background:var(--ps-bg-raised); border-radius:50%; padding:1px;
      display:none; color:var(--ps-blue);
    }
    .set-img-cell.is-selected .set-img-check-icon { display:block; }
    .set-img-name {
      font-size:10px; color:var(--ps-text-muted); padding:3px 5px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .set-img-size { font-size:9px; color:var(--ps-text-faint); padding:0 5px 4px; font-family:var(--font-mono); }
  `,document.head.appendChild(i)}export{K as render};
